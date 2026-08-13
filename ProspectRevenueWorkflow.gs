/**
 * Prospect-to-Revenue Workflow v1.
 * Composes existing engines; never sends email or advances CRM Status.
 */

function validateSelectedProspectForRevenue() {
  const context = getSelectedProspectContext_(['Company']);
  if (!context) return null;
  const result = validateProspectRevenueContext_(context);
  SpreadsheetApp.getUi().alert(result.ready ? 'Prospect Ready' : 'Prospect Blocked', result.details, SpreadsheetApp.getUi().ButtonSet.OK);
  return result;
}

function prepareProspectForOutreach() {
  return runProspectRevenuePreparation_(false);
}

function resumeProspectRevenueWorkflow() {
  return runProspectRevenuePreparation_(true);
}

function openProspectRevenueReview() {
  openProspectWorkspace();
}

function approveProspectForManualOutreach() {
  return recordProspectRevenueReviewDecision_('Approved');
}

function requestProspectRevenueChanges() {
  return recordProspectRevenueReviewDecision_('Changes Required');
}

function ensureProspectRevenueWorkflowSchema_(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  const prospectSheet = getRequiredSheet_(spreadsheet, MASTER_PROSPECT_SHEET);
  const activitySheet = getRequiredSheet_(spreadsheet, ACTIVITY_FEED_SHEET);
  const prospectTable = ensureSheetColumns_(prospectSheet, PROSPECT_REVENUE_WORKFLOW_COLUMNS);
  ensureProspectRevenueNextActionValidation_(prospectSheet, prospectTable);
  return {
    prospectSheet: prospectSheet,
    prospectTable: prospectTable,
    activitySheet: activitySheet,
    activityTable: ensureSheetColumns_(activitySheet, PROSPECT_REVENUE_ACTIVITY_COLUMNS)
  };
}

function ensureProspectRevenueNextActionValidation_(sheet, table) {
  if (!table.headers['Next Action']) return false;
  const range = sheet.getRange(
    table.headerRow + 1,
    table.headers['Next Action'],
    Math.max(sheet.getMaxRows() - table.headerRow, 1),
    1
  );
  const approved = PROSPECT_DROPDOWN_DEFAULTS['Next Action'];
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(approved, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
  return true;
}

function validateProspectRevenueContext_(context) {
  const schema = ensureProspectRevenueWorkflowSchema_(context.ss);
  context.table = schema.prospectTable;
  context.values = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  const prospectId = ensureProspectRevenueId_(context);
  const missing = ['Company', 'Website', 'Email', 'Contact'].filter(function(header) {
    return !String(getValueByHeader_(context.values, context.table.headers, header) || '').trim();
  });
  const invalid = [];
  const email = String(getValueByHeader_(context.values, context.table.headers, 'Email') || '').trim();
  const website = String(getValueByHeader_(context.values, context.table.headers, 'Website') || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid.push('Email');
  if (website && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(website)) invalid.push('Website');
  const blocked = missing.length || invalid.length;
  const details = blocked
    ? [missing.length ? 'Missing: ' + missing.join(', ') : '', invalid.length ? 'Invalid: ' + invalid.join(', ') : ''].filter(Boolean).join('. ')
    : 'Required prospect information is ready.';
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Validation Status', blocked ? 'Blocked' : 'Ready');
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Validation Details', details);
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  logProspectRevenueActivity_(context, 'Prospect Validation ' + (blocked ? 'Blocked' : 'Ready'), details, '');
  return { ready: !blocked, status: blocked ? 'Blocked' : 'Ready', details: details, missing: missing, invalid: invalid, prospectId: prospectId };
}

function ensureProspectRevenueId_(context) {
  const existing = String(getValueByHeader_(context.values, context.table.headers, 'Prospect ID') || '').trim();
  if (existing) {
    assertUniqueProspectRevenueId_(context.sheet, context.table, context.selectedRow, existing);
    return existing;
  }
  let generated = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = 'PROS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    if (!prospectRevenueIdExists_(context.sheet, context.table, context.selectedRow, candidate)) {
      generated = candidate;
      break;
    }
  }
  if (!generated) {
    throw new Error('Unable to generate a unique Prospect ID.');
  }
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Prospect ID', generated);
  context.values[context.table.headers['Prospect ID'] - 1] = generated;
  assertUniqueProspectRevenueId_(context.sheet, context.table, context.selectedRow, generated);
  return generated;
}

function prospectRevenueIdExists_(sheet, table, selectedRow, prospectId) {
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - start + 1, 0);
  if (!count) return false;
  return sheet.getRange(start, table.headers['Prospect ID'], count, 1).getDisplayValues()
    .some(function(row, index) {
      return start + index !== selectedRow &&
        String(row[0] || '').trim().toLowerCase() === prospectId.toLowerCase();
    });
}

function assertUniqueProspectRevenueId_(sheet, table, selectedRow, prospectId) {
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - start + 1, 0);
  if (!count) return;
  const matches = sheet.getRange(start, table.headers['Prospect ID'], count, 1).getDisplayValues().reduce(function(rows, row, index) {
    if (String(row[0] || '').trim().toLowerCase() === prospectId.toLowerCase()) rows.push(start + index);
    return rows;
  }, []);
  if (matches.length !== 1 || matches[0] !== selectedRow) throw new Error('Duplicate Prospect ID detected. Resolve the duplicate before continuing.');
}

function runProspectRevenuePreparation_(isResume) {
  const context = getSelectedProspectContext_(['Company']);
  if (!context) return null;
  const ui = SpreadsheetApp.getUi();
  let goldStandardPreflight;
  try {
    goldStandardPreflight = preflightProspectRevenueGoldStandard_(context);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    ui.alert('Prospect Not Ready', message, ui.ButtonSet.OK);
    return { readyForReview: false, failedStep: 'Gold Standard evidence preflight', error: message };
  }

  const validation = validateProspectRevenueContext_(context);
  if (!validation.ready) {
    ui.alert('Prospect Not Ready', validation.details, ui.ButtonSet.OK);
    return validation;
  }
  const operationKey = 'PTR:' + validation.prospectId + ':V1';
  let currentStep = 'Starting';
  try {
    setProspectRevenueWorkflowState_(context, operationKey, 'In Progress', isResume ? 'Resuming persisted workflow state.' : 'Preparing prospect for outreach.');
    logProspectRevenueActivity_(context, isResume ? 'Prospect Workflow Resumed' : 'Prospect Workflow Started', 'Prospect preparation started.', operationKey);
    let activeContext = buildProspectContextForRow_(context.ss, context.sheet, context.selectedRow);
    let prospect = buildSelectedProspectForAuditPackage_(activeContext);
    prospect.email = getValueByHeader_(activeContext.values, activeContext.table.headers, 'Email');

    currentStep = 'Website inspection';
    if (!isVerifiedAuditDataForLocalRendering_(prospect)) {
      setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Inspection Status', 'In Progress');
      setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Inspection Attempted At', new Date());
      applyWebsiteAuditToolResults_(activeContext, runWebsiteAuditToolWorkflow_(prospect));
      setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Inspection Completed At', new Date());
      logProspectRevenueActivity_(context, 'Website Inspection Complete', 'Verified Website Audit Tool API evidence was recorded.', operationKey);
    } else {
      logProspectRevenueActivity_(context, 'Website Inspection Reused', 'Existing verified Website Audit Tool API evidence was reused.', operationKey);
    }
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Inspection Status', 'Complete');

    activeContext = buildProspectContextForRow_(context.ss, context.sheet, context.selectedRow);
    prospect = buildSelectedProspectForAuditPackage_(activeContext);
    prospect.email = getValueByHeader_(activeContext.values, activeContext.table.headers, 'Email');
    currentStep = 'Executive deliverables';
    generateExecutiveSnapshotForRevenueContext_(activeContext, prospect, goldStandardPreflight.input);
    generateAuditPackageForContext_(activeContext, prospect);

    currentStep = 'Outreach Gmail draft';
    const drafts = buildOutreachDrafts_(prospect);
    const gmailResult = reconcileExactGmailDraft_(String(prospect.email || '').trim(), drafts.subject, drafts.initialEmail);
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Gmail Draft Created', 'Yes');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Proposal Generated', 'Yes');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Review Status', 'Needs Brian Review');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Reviewed At', '');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Review Notes', '');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Next Action', 'Review Outreach');
    setProspectRevenueWorkflowState_(context, operationKey, 'Awaiting Review', 'Review evidence, deliverables, recipient, subject, and Gmail draft. No email was sent.');
    logProspectRevenueActivity_(context, gmailResult.created ? 'Outreach Gmail Draft Created' : 'Outreach Gmail Draft Updated', 'Draft reconciled; manual review and sending are required.', operationKey);
    logProspectRevenueActivity_(context, 'Brian Review Requested', 'Deliverables and outreach draft are ready for explicit review.', operationKey);
    refreshSalesOperatingSystem_();
    ui.alert('Prospect Ready for Review', 'Executive deliverables and one reconciled Gmail draft are ready.\n\nNo email was sent and CRM Status was not advanced.', ui.ButtonSet.OK);
    return { readyForReview: true, operationKey: operationKey };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (currentStep === 'Website inspection') setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Inspection Status', 'Failed');
    setProspectRevenueWorkflowState_(context, operationKey, 'Reconciliation Required', currentStep + ' failed: ' + message + ' Previous successful work was preserved.');
    logProspectRevenueActivity_(context, 'Prospect Workflow Failed', currentStep + ' failed. ' + message, operationKey);
    ui.alert('Prospect Workflow Paused', currentStep + ' could not be completed.\n\n' + message + '\n\nCorrect the issue, then run Resume Prospect Workflow.', ui.ButtonSet.OK);
    return { readyForReview: false, operationKey: operationKey, failedStep: currentStep, error: message };
  }
}

function preflightProspectRevenueGoldStandard_(context) {
  const prospect = buildSelectedProspectForAuditPackage_(context);
  prospect.email = getValueByHeader_(context.values, context.table.headers, 'Email');
  const reportFile = buildLocalAuditReportInput_(prospect);
  const input = buildGoldStandardDeliverableInput_(prospect, reportFile);

  // Build all client-facing HTML in memory so content/lineage errors fail before
  // validation state, Activity, Drive, or any other external mutation.
  buildGoldStandardExecutiveBriefHtml_(input);
  buildGoldStandardAssessmentHtml_(input);
  buildGoldStandardImprovementPlanHtml_(input);
  return { prospect: prospect, reportFile: reportFile, input: input };
}

function generateExecutiveSnapshotForRevenueContext_(context, prospect, preflightInput) {
  const reportFile = {
    sourceUrl: prospect.website,
    websiteScreenshotUrl: prospect.websiteScreenshotUrl,
    websiteScreenshotBase64: prospect.websiteScreenshotBase64,
    mobileScreenshotUrl: prospect.mobileScreenshotUrl,
    mobileScreenshotBase64: prospect.mobileScreenshotBase64,
    evidence: {
      websiteScreenshotUrl: prospect.websiteScreenshotUrl,
      websiteScreenshotBase64: prospect.websiteScreenshotBase64,
      mobileScreenshotUrl: prospect.mobileScreenshotUrl,
      mobileScreenshotBase64: prospect.mobileScreenshotBase64
    }
  };
  const goldStandardInput = preflightInput || buildGoldStandardDeliverableInput_(prospect, reportFile);
  const folder = getOrCreateAuditPackageFolder_(prospect.company);
  upsertAuditPackageBlobFile_(folder, 'Executive Brief.pdf', buildGoldStandardExecutiveBriefPdfBlob_(goldStandardInput));
  logPipelineActivity_(context.ss, prospect.company, 'Executive Brief Generated', 'Generated through Prospect-to-Revenue Workflow v1.');
}

function setProspectRevenueWorkflowState_(context, operationKey, status, details) {
  const table = ensureSheetColumns_(context.sheet, PROSPECT_REVENUE_WORKFLOW_COLUMNS);
  context.table = table;
  setIfHeaderCell_(context.sheet, table.headers, context.selectedRow, 'Workflow Operation Key', operationKey);
  setIfHeaderCell_(context.sheet, table.headers, context.selectedRow, 'Workflow Status', status);
  setIfHeaderCell_(context.sheet, table.headers, context.selectedRow, 'Workflow Details', details);
  updateSelectedProspectLastActivity_(context.sheet, table.headers, context.selectedRow);
}

function recordProspectRevenueReviewDecision_(decision) {
  let context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) return null;
  ensureProspectRevenueWorkflowSchema_(context.ss);
  context = buildProspectContextForRow_(context.ss, context.sheet, context.selectedRow);
  const current = String(getValueByHeader_(context.values, context.table.headers, 'Review Status') || '');
  const ui = SpreadsheetApp.getUi();
  if (decision === 'Approved' && current !== 'Needs Brian Review') {
    ui.alert('Review Not Ready', 'Prepare the prospect before approval.', ui.ButtonSet.OK);
    return null;
  }
  const prompt = ui.prompt(decision, decision === 'Approved' ? 'Enter optional approval notes. This does not send email.' : 'Describe the required changes.', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return null;
  const notes = String(prompt.getResponseText() || '').trim();
  if (decision === 'Changes Required' && !notes) {
    ui.alert('Changes Required', 'Enter the required changes so the workflow remains auditable.', ui.ButtonSet.OK);
    return null;
  }
  const operationKey = String(getValueByHeader_(context.values, context.table.headers, 'Workflow Operation Key') || '');
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Review Status', decision);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Reviewed At', new Date());
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Review Notes', notes);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Workflow Status', decision === 'Approved' ? 'Approved for Manual Outreach' : 'Changes Required');
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Workflow Details', decision === 'Approved' ? 'Approved for manual sending. Apps Script sent no email.' : 'Revise materials, then resume and review again.');
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Next Action', decision === 'Approved' ? 'Confirm Executive Brief Sent' : 'Create Outreach Draft');
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  logProspectRevenueActivity_(context, 'Brian Review ' + decision, notes || 'Review decision recorded. No email was sent.', operationKey);
  refreshSalesOperatingSystem_();
  ui.alert(decision, decision === 'Approved' ? 'Send the Gmail draft manually, then run Confirm Executive Brief Sent.' : 'Update the record, then run Resume Prospect Workflow.', ui.ButtonSet.OK);
  return { decision: decision, operationKey: operationKey };
}

function logProspectRevenueActivity_(context, activityType, activityNotes, operationKey) {
  const schema = ensureProspectRevenueWorkflowSchema_(context.ss);
  const rowValues = new Array(schema.activityTable.lastColumn).fill('');
  const prospectTable = getHeaderTable_(context.sheet, ['Company']);
  const values = context.sheet.getRange(context.selectedRow, 1, 1, prospectTable.lastColumn).getValues()[0];
  setIfHeader_(rowValues, schema.activityTable.headers, 'Date', new Date());
  setIfHeader_(rowValues, schema.activityTable.headers, 'Company', getValueByHeader_(values, prospectTable.headers, 'Company'));
  setIfHeader_(rowValues, schema.activityTable.headers, 'Activity Type', activityType);
  setIfHeader_(rowValues, schema.activityTable.headers, 'Activity Notes', activityNotes);
  setIfHeader_(rowValues, schema.activityTable.headers, 'Prospect ID', getValueByHeader_(values, prospectTable.headers, 'Prospect ID'));
  setIfHeader_(rowValues, schema.activityTable.headers, 'Operation Key', operationKey || '');
  const row = Math.max(schema.activitySheet.getLastRow() + 1, schema.activityTable.headerRow + 1);
  schema.activitySheet.getRange(row, 1, 1, schema.activityTable.lastColumn)
    .setValues([literalizeBusinessSnapshotSheetRow_(rowValues)]);
}
