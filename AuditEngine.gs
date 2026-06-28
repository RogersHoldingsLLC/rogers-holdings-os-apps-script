/**
 * Rogers Holdings OS - AuditEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function runRealWebsiteAudit() {
  const context = getSelectedProspectContext_(['Company', 'Website']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const prospect = {
    company: getValueByHeader_(context.values, context.table.headers, 'Company'),
    website: getValueByHeader_(context.values, context.table.headers, 'Website'),
    city: getValueByHeader_(context.values, context.table.headers, 'City'),
    state: getValueByHeader_(context.values, context.table.headers, 'State')
  };

  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company'],
    ['Website', 'website']
  ]);

  if (missing.length) {
    ui.alert(
      'Rogers Holdings OS',
      'Add the missing required field before running the real Website Audit Tool: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  const confirm = ui.alert(
    'Rogers Holdings OS',
    `Run full Website Audit Tool for ${prospect.company}?\n\nThis will execute the real audit workflow and may take several moments.`,
    ui.ButtonSet.OK_CANCEL
  );

  if (confirm !== ui.Button.OK) {
    return;
  }

  try {
    const auditPayload = runWebsiteAuditToolWorkflow_(prospect);
    applyWebsiteAuditToolResults_(context, auditPayload);
    refreshSalesOperatingSystem_();

    ui.alert('Rogers Holdings OS', 'Website Audit Tool completed and prospect record updated.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert(
      'Rogers Holdings OS',
      error && error.message ? error.message : String(error),
      ui.ButtonSet.OK
    );
  }
}

function runBulkAuditPipeline() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    ui.alert('Rogers Holdings OS', 'Master Prospect Tracker sheet was not found.', ui.ButtonSet.OK);
    return;
  }

  const table = getHeaderTable_(sheet, ['Company', 'Website']);
  const eligibleRows = getBulkAuditPipelineEligibleRows_(sheet, table);
  const skipCount = Math.max(getProspectDataRowCount_(sheet, table) - eligibleRows.length, 0);
  if (!eligibleRows.length) {
    ui.alert(
      'Rogers Holdings OS',
      `Bulk Audit Pipeline complete.\n\nSuccess: 0\nFailures: 0\nSkipped: ${skipCount}`,
      ui.ButtonSet.OK
    );
    return;
  }

  const confirm = ui.alert(
    'Rogers Holdings OS',
    `Run Bulk Audit Pipeline for ${eligibleRows.length} prospect(s)?\n\nProspects are processed sequentially and may take several minutes.`,
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) {
    return;
  }

  showBulkAuditPipelineProgressDialog_(eligibleRows.length);

  const summary = {
    successCount: 0,
    failureCount: 0,
    skipCount: skipCount,
    failures: []
  };

  eligibleRows.forEach(function(item, index) {
    try {
      console.log('Bulk Audit Pipeline: processing prospect', {
        row: item.row,
        index: index + 1,
        total: eligibleRows.length,
        company: item.prospect.company,
        website: item.prospect.website
      });
      runBulkAuditPipelineForProspect_(ss, sheet, item);
      summary.successCount += 1;
    } catch (error) {
      summary.failureCount += 1;
      const message = error && error.message ? error.message : String(error);
      summary.failures.push(`${item.prospect.company || 'Row ' + item.row}: ${message}`);
      console.error('Bulk Audit Pipeline: prospect failed', {
        row: item.row,
        company: item.prospect.company,
        message: message
      });
    }
  });

  refreshSalesOperatingSystem_();
  showBulkAuditPipelineSummary_(summary);
}

function runBulkAuditPipelineForProspect_(ss, sheet, item) {
  const context = buildProspectContextForRow_(ss, sheet, item.row);
  let prospect = buildSelectedProspectForAuditPackage_(context);
  prospect.company = prospect.company || item.prospect.company;
  prospect.website = prospect.website || item.prospect.website;

  const auditPayload = runWebsiteAuditToolWorkflow_(prospect);
  applyWebsiteAuditToolResults_(context, auditPayload);

  const refreshedContext = buildProspectContextForRow_(ss, sheet, item.row);
  prospect = buildSelectedProspectForAuditPackage_(refreshedContext);
  generateAuditPackageForContext_(refreshedContext, prospect);
}

function generateAuditPackageForContext_(context, prospect) {
  const reportFile = requestWebsiteAuditPackageReport_(prospect);
  const drafts = buildOutreachDrafts_(prospect);
  const proposal = buildProposal_(prospect);
  const folder = getOrCreateAuditPackageFolder_(prospect.company);
  const createdFiles = storeAuditPackageFiles_(folder, reportFile, drafts, proposal, prospect);
  const headers = ensureSheetColumns_(context.sheet, [
    'Audit Package Generated',
    'Audit Package Date'
  ]).headers;
  const now = new Date();

  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Audit Package Generated', 'Yes');
  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Audit Package Date', now);
  updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
  logPipelineActivity_(
    context.ss,
    prospect.company,
    'Audit Package Generated',
    `Generated audit package folder "${folder.getName()}" with ${createdFiles.length} files.`
  );
  logPipelineActivity_(
    context.ss,
    prospect.company,
    'Proposal Generated',
    'Generated proposal draft for audit package.'
  );
  logPipelineActivity_(
    context.ss,
    prospect.company,
    'Outreach Draft Generated',
    'Generated outreach draft for audit package.'
  );

  return {
    folder: folder,
    createdFiles: createdFiles
  };
}

function getBulkAuditPipelineEligibleRows_(sheet, table) {
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  return values.map(function(row, index) {
    const prospect = buildBulkAuditProspectFromRow_(row, table.headers);
    return {
      row: dataStartRow + index,
      values: row,
      prospect: prospect
    };
  }).filter(function(item) {
    if (!String(item.prospect.company || '').trim() || !String(item.prospect.website || '').trim()) {
      return false;
    }

    return !String(item.prospect.auditScore || '').trim() || !isAuditPackageGeneratedFromValues_(item.values, table.headers);
  });
}

function buildBulkAuditProspectFromRow_(row, headers) {
  return {
    company: getValueByHeader_(row, headers, 'Company'),
    website: getValueByHeader_(row, headers, 'Website'),
    city: getValueByHeader_(row, headers, 'City'),
    state: getValueByHeader_(row, headers, 'State'),
    auditScore: getValueByHeader_(row, headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(row, headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(row, headers, 'Priority Tier'),
    offerService: getValueByHeader_(row, headers, 'Offer / Service'),
    notes: getValueByHeader_(row, headers, 'Notes')
  };
}

function buildProspectContextForRow_(ss, sheet, selectedRow) {
  const refreshedTable = getHeaderTable_(sheet, ['Company', 'Website']);
  const values = sheet.getRange(selectedRow, 1, 1, refreshedTable.lastColumn).getValues()[0];
  return {
    ss: ss,
    sheet: sheet,
    table: refreshedTable,
    selectedRow: selectedRow,
    values: values,
    prospect: {
      company: getValueByHeader_(values, refreshedTable.headers, 'Company'),
      status: getValueByHeader_(values, refreshedTable.headers, 'Status')
    }
  };
}

function isAuditPackageGeneratedFromValues_(rowValues, headers) {
  const generated = String(getValueByHeader_(rowValues, headers, 'Audit Package Generated') || '').trim().toLowerCase();
  return generated === 'yes' || generated === 'true' || generated === 'generated';
}

function getProspectDataRowCount_(sheet, table) {
  const dataStartRow = table.headerRow + 1;
  if (sheet.getLastRow() < dataStartRow) {
    return 0;
  }

  const rowCount = sheet.getLastRow() - dataStartRow + 1;
  const values = sheet.getRange(dataStartRow, table.headers.Company, rowCount, 1).getValues();
  return values.filter(function(row) {
    return String(row[0] || '').trim();
  }).length;
}

function showBulkAuditPipelineProgressDialog_(totalCount) {
  const html = HtmlService.createHtmlOutput(
    [
      '<div style="font-family:Arial,sans-serif;padding:18px;background:#111;color:#fff;">',
      '<h2 style="margin:0 0 12px;color:#d6a84f;font-size:18px;">Bulk Audit Pipeline</h2>',
      '<p style="margin:0 0 8px;">Processing prospects sequentially.</p>',
      `<p style="margin:0;">Queued prospects: <strong>${totalCount}</strong></p>`,
      '<p style="margin:14px 0 0;color:#d8c7a4;font-size:12px;">Leave this spreadsheet open until the completion message appears.</p>',
      '</div>'
    ].join('')
  ).setWidth(360).setHeight(190);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Rogers Holdings OS');
}

function showBulkAuditPipelineSummary_(summary) {
  const failureLines = summary.failures.length
    ? '\n\nFailures:\n' + summary.failures.slice(0, 8).join('\n')
    : '';

  SpreadsheetApp.getUi().alert(
    'Rogers Holdings OS',
    `Bulk Audit Pipeline complete.\n\nSuccess: ${summary.successCount}\nFailures: ${summary.failureCount}\nSkipped: ${summary.skipCount}${failureLines}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function runWebsiteAuditToolWorkflow_(prospect) {
  const endpoint = getWebsiteAuditToolEndpoint_();
  if (!endpoint) {
    throw new Error('Set Script Property WEBSITE_AUDIT_TOOL_URL to the Website Audit Tool runner endpoint, then run Run Real Website Audit again.');
  }

  const payload = buildWebsiteAuditToolLaunchPayload_(prospect);
  logWebsiteAuditToolLaunchPayload_(payload);

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Website Audit Tool request failed with HTTP ${statusCode}: ${responseText}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error('Website Audit Tool response was not valid JSON.');
  }

  return normalizeWebsiteAuditToolPayload_(parsed, prospect);
}

function getWebsiteAuditToolEndpoint_() {
  const properties = PropertiesService.getScriptProperties();
  return String(
    properties.getProperty('WEBSITE_AUDIT_TOOL_URL') ||
    properties.getProperty('WEBSITE_AUDIT_TOOL_ENDPOINT') ||
    ''
  ).trim();
}

function buildWebsiteAuditToolLaunchPayload_(prospect) {
  return {
    company: String(prospect.company || '').trim(),
    website: String(prospect.website || '').trim(),
    city: String(prospect.city || '').trim(),
    state: String(prospect.state || '').trim(),
    source: 'Rogers Holdings OS',
    requestedBy: 'Rogers Holdings OS'
  };
}

function logWebsiteAuditToolLaunchPayload_(payload) {
  console.log('Run Real Website Audit payload fields', {
    company: payload.company,
    website: payload.website,
    city: payload.city,
    state: payload.state,
    source: payload.source,
    requestedBy: payload.requestedBy,
    requestType: payload.requestType || '',
    includeReport: payload.includeReport || false,
    formats: payload.formats || ''
  });
}

function normalizeWebsiteAuditToolPayload_(response, prospect) {
  const payload = response && (response.payload || response.audit || response.result || response.data || response);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Website Audit Tool response did not include an audit payload.');
  }

  const normalized = {
    company: firstNonBlank_([payload.company, payload.Company, prospect.company]),
    website: firstNonBlank_([payload.website, payload.Website, prospect.website]),
    auditScore: firstNonBlank_([payload.auditScore, payload.score, payload['Audit Score']]),
    auditOutcome: firstNonBlank_([payload.auditOutcome, payload.outcome, payload['Audit Outcome']]),
    priorityTier: firstNonBlank_([payload.priorityTier, payload.priority, payload['Priority Tier']]),
    offerService: firstNonBlank_([payload.offerService, payload.offer, payload.service, payload['Offer / Service']]),
    notes: firstNonBlank_([payload.notes, payload.Notes]),
    summary: firstNonBlank_([payload.summary, payload.Summary]),
    websiteScreenshotUrl: firstNonBlank_([payload.websiteScreenshotUrl, payload.screenshotUrl, payload.screenshot, payload['Website Screenshot URL']]),
    websiteScreenshotBase64: firstNonBlank_([payload.websiteScreenshotBase64, payload.screenshotBase64, payload['Website Screenshot Base64']]),
    websiteScreenshotMimeType: firstNonBlank_([payload.websiteScreenshotMimeType, payload.screenshotMimeType]),
    mobileScreenshotUrl: firstNonBlank_([payload.mobileScreenshotUrl, payload.mobileScreenshot, payload['Mobile Screenshot URL']]),
    mobileScreenshotBase64: firstNonBlank_([payload.mobileScreenshotBase64, payload['Mobile Screenshot Base64']]),
    mobileScreenshotMimeType: firstNonBlank_([payload.mobileScreenshotMimeType]),
    competitivePosition: firstNonBlank_([payload.competitivePosition, payload.competitiveSummary, payload['Competitive Position']]),
    competitorSummary: firstNonBlank_([payload.competitorSummary, payload.competitors])
  };
  const missing = requiredProspectFieldsMissing_(normalized, [
    ['auditScore', 'auditScore'],
    ['auditOutcome', 'auditOutcome'],
    ['priorityTier', 'priorityTier']
  ]);

  if (missing.length) {
    throw new Error('Website Audit Tool response is missing required result fields: ' + missing.join(', ') + '.');
  }

  return normalized;
}

function applyWebsiteAuditToolResults_(context, auditPayload) {
  const sheet = context.sheet;
  const headers = context.table.headers;
  const selectedRow = context.selectedRow;
  const summary = auditPayload.summary || `Website Audit Tool completed for ${auditPayload.company}.`;

  setIfHeaderCell_(sheet, headers, selectedRow, 'Audit Score', auditPayload.auditScore);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Audit Outcome', auditPayload.auditOutcome);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Priority Tier', auditPayload.priorityTier);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Opportunity Level', auditPayload.priorityTier);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Offer / Service', auditPayload.offerService);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Recommended Focus', buildRecommendedNextStep_(auditPayload));
  setIfHeaderCell_(sheet, headers, selectedRow, 'Notes', auditPayload.notes);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Summary', summary);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Website Screenshot URL', auditPayload.websiteScreenshotUrl);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Website Screenshot Base64', auditPayload.websiteScreenshotBase64);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Mobile Screenshot URL', auditPayload.mobileScreenshotUrl);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Mobile Screenshot Base64', auditPayload.mobileScreenshotBase64);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Competitive Position', auditPayload.competitivePosition);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Competitor Summary', auditPayload.competitorSummary);
  setIfHeaderCell_(sheet, headers, selectedRow, 'Audit Source', 'Website Audit Tool');
  setProspectStatusIfHeader_(sheet, headers, selectedRow, 'Audit Complete');
  updateSelectedProspectLastActivity_(sheet, headers, selectedRow);
  logPipelineActivity_(context.ss, auditPayload.company, 'Website Audit Tool', summary);
}

function generateAuditPackage() {
  const context = getSelectedProspectContext_([
    'Company',
    'Website'
  ]);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  let activeContext = context;
  let prospect = buildSelectedProspectForAuditPackage_(activeContext);
  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company'],
    ['Website', 'website']
  ]);

  if (missing.length) {
    ui.alert(
      'Rogers Holdings OS',
      'Add the missing required fields before generating the audit package: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  let auditWasRunFirst = false;

  try {
    if (isAuditDataMissingForPackage_(prospect)) {
      const auditPayload = runWebsiteAuditToolWorkflow_(prospect);
      applyWebsiteAuditToolResults_(activeContext, auditPayload);
      activeContext = buildProspectContextForRow_(context.ss, context.sheet, context.selectedRow);
      prospect = buildSelectedProspectForAuditPackage_(activeContext);
      auditWasRunFirst = true;
    }

    const packageResult = generateAuditPackageForContext_(activeContext, prospect);
    refreshSalesOperatingSystem_();

    ui.alert(
      'Rogers Holdings OS',
      auditWasRunFirst
        ? `Audit data was missing, so Rogers Holdings OS ran the website audit first and then generated the package.\n\nFolder: ${packageResult.folder.getName()}`
        : `Audit package generated for ${prospect.company}.\n\nFolder: ${packageResult.folder.getName()}`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Rogers Holdings OS',
      error && error.message ? error.message : String(error),
      ui.ButtonSet.OK
    );
  }
}

function runFullProspectPackage() {
  const context = getSelectedProspectContext_([
    'Company',
    'Website'
  ]);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  let activeContext = context;
  let prospect = buildSelectedProspectForAuditPackage_(activeContext);
  prospect.email = getValueByHeader_(activeContext.values, activeContext.table.headers, 'Email');
  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company'],
    ['Website', 'website'],
    ['Email', 'email']
  ]);

  if (missing.length) {
    ui.alert(
      'Rogers Holdings OS',
      'Add the missing required fields before running the full prospect package: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  let currentStep = 'Starting full prospect package';
  let packageResult = null;
  let gmailDraftCreated = false;
  let folder = null;

  try {
    logFullPackageActivity_(activeContext.ss, prospect.company, 'Full Prospect Package Started', 'Started full prospect package workflow.');

    currentStep = 'Create or reuse Drive folder';
    folder = getOrCreateAuditPackageFolder_(prospect.company);

    currentStep = 'Run real Website Audit if audit data is missing';
    if (isAuditDataMissingForPackage_(prospect)) {
      const auditPayload = runWebsiteAuditToolWorkflow_(prospect);
      applyWebsiteAuditToolResults_(activeContext, auditPayload);
      activeContext = buildProspectContextForRow_(context.ss, context.sheet, context.selectedRow);
      prospect = buildSelectedProspectForAuditPackage_(activeContext);
      prospect.email = getValueByHeader_(activeContext.values, activeContext.table.headers, 'Email');
    }

    currentStep = 'Generate audit package files';
    packageResult = generateAuditPackageForContext_(activeContext, prospect);
    folder = packageResult.folder || folder;

    currentStep = 'Create outreach Gmail draft';
    const drafts = buildOutreachDrafts_(prospect);
    GmailApp.createDraft(String(prospect.email || '').trim(), drafts.subject, drafts.initialEmail);
    gmailDraftCreated = true;
    logFullPackageActivity_(activeContext.ss, prospect.company, 'Gmail Draft Created', 'Created outreach Gmail draft as part of full prospect package.');

    currentStep = 'Update prospect row';
    updateFullPackageProspectFields_(activeContext.sheet, activeContext.table.headers, activeContext.selectedRow);
    logFullPackageActivity_(activeContext.ss, prospect.company, 'Full Prospect Package Complete', 'Completed full prospect package workflow.');
    refreshSalesOperatingSystem_();

    ui.alert(
      'Rogers Holdings OS',
      buildFullProspectPackageSummary_(prospect, folder, packageResult, gmailDraftCreated),
      ui.ButtonSet.OK
    );
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    try {
      logFullPackageActivity_(
        activeContext.ss,
        prospect.company,
        'Full Prospect Package Failed',
        `Step failed: ${currentStep}. Error: ${message}`
      );
    } catch (logError) {
      console.warn('Full Prospect Package failure could not be logged: ' + (logError && logError.message ? logError.message : String(logError)));
    }

    ui.alert(
      'Rogers Holdings OS',
      `Full Prospect Package failed during step: ${currentStep}.\n\n${message}\n\nPrevious successful work was preserved.`,
      ui.ButtonSet.OK
    );
  }
}

function buildFullProspectPackageSummary_(prospect, folder, packageResult, gmailDraftCreated) {
  const createdFileNames = (packageResult && packageResult.createdFiles || []).map(function(file) {
    return file.getName();
  });
  const auditReportStatus = createdFileNames.indexOf('Audit Report.pdf') !== -1 ? 'generated' : 'found';
  const proposalStatus = createdFileNames.indexOf('Proposal.pdf') !== -1 ? 'generated' : 'found';

  return [
    'Full Prospect Package Complete',
    '',
    'Company: ' + prospect.company,
    'Folder: ' + (folder ? folder.getName() : 'Not available'),
    'Audit Report.pdf: ' + auditReportStatus,
    'Proposal.pdf: ' + proposalStatus,
    'Gmail draft created: ' + (gmailDraftCreated ? 'Yes' : 'No'),
    'Next Action: Send Intro Email'
  ].join('\n');
}

function updateFullPackageProspectFields_(sheet, headers, selectedRow) {
  setIfHeaderCell_(sheet, headers, selectedRow, 'Status', 'Draft Created');
  setIfHeaderCell_(sheet, headers, selectedRow, 'Next Action', 'Review Email');
  setIfHeaderCell_(sheet, headers, selectedRow, 'Last Activity', new Date());
  setIfHeaderCell_(sheet, headers, selectedRow, 'Audit Package Generated', 'Yes');
  setIfHeaderCell_(sheet, headers, selectedRow, 'Proposal Generated', 'Yes');
  setIfHeaderCell_(sheet, headers, selectedRow, 'Gmail Draft Created', 'Yes');
}

function logFullPackageActivity_(ss, company, activityType, activityNotes) {
  logPipelineActivity_(ss, company, activityType, activityNotes);
}

function isAuditDataMissingForPackage_(prospect) {
  return !String(prospect.auditScore || '').trim() || !String(prospect.auditOutcome || '').trim();
}

function isAuditPackageGenerated_(rowValues, headers) {
  const generated = String(getValueByHeader_(rowValues, headers, 'Audit Package Generated') || '').trim().toLowerCase();
  const generatedDate = getValueByHeader_(rowValues, headers, 'Audit Package Date');
  return generated === 'yes' || generated === 'true' || generatedDate !== '';
}

function getAuditPackageFolder_(company) {
  const folderName = sanitizeDriveFileName_(company || 'Audit Package');
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : null;
}

function buildSelectedProspectForAuditPackage_(context) {
  const headers = context.table.headers;
  const values = context.values;
  return {
    company: getValueByHeader_(values, headers, 'Company'),
    website: getValueByHeader_(values, headers, 'Website'),
    city: getValueByHeader_(values, headers, 'City'),
    state: getValueByHeader_(values, headers, 'State'),
    industry: getValueByHeader_(values, headers, 'Industry'),
    auditScore: getValueByHeader_(values, headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(values, headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(values, headers, 'Priority Tier'),
    offerService: getValueByHeader_(values, headers, 'Offer / Service'),
    notes: getValueByHeader_(values, headers, 'Notes'),
    summary: getValueByHeader_(values, headers, 'Summary'),
    websiteScreenshotUrl: getValueByHeader_(values, headers, 'Website Screenshot URL'),
    websiteScreenshotBase64: getValueByHeader_(values, headers, 'Website Screenshot Base64'),
    websiteScreenshotMimeType: getValueByHeader_(values, headers, 'Website Screenshot MIME Type'),
    mobileScreenshotUrl: getValueByHeader_(values, headers, 'Mobile Screenshot URL'),
    mobileScreenshotBase64: getValueByHeader_(values, headers, 'Mobile Screenshot Base64'),
    mobileScreenshotMimeType: getValueByHeader_(values, headers, 'Mobile Screenshot MIME Type'),
    competitivePosition: getValueByHeader_(values, headers, 'Competitive Position'),
    competitorSummary: getValueByHeader_(values, headers, 'Competitor Summary'),
    competitors: getValueByHeader_(values, headers, 'Competitors')
  };
}

function requestWebsiteAuditPackageReport_(prospect) {
  const endpoint = getWebsiteAuditToolEndpoint_();
  if (!endpoint) {
    throw new Error('Set Script Property WEBSITE_AUDIT_TOOL_URL to the Website Audit Tool runner endpoint, then run Generate Audit Package again.');
  }

  const payload = buildWebsiteAuditToolLaunchPayload_(prospect);
  payload.requestType = 'auditPackage';
  payload.includeReport = true;
  payload.formats = ['pdf', 'txt'];
  logWebsiteAuditToolLaunchPayload_(payload);

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const statusCode = response.getResponseCode();
  const contentType = getResponseContentType_(response);

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Website Audit Tool report request failed with HTTP ${statusCode}: ${response.getContentText()}`);
  }

  if (contentType.indexOf('application/pdf') !== -1) {
    return {
      fileName: 'Audit Report.pdf',
      blob: response.getBlob().setName('Audit Report.pdf')
    };
  }

  if (contentType.indexOf('application/json') !== -1) {
    let parsed;
    try {
      parsed = JSON.parse(response.getContentText());
    } catch (error) {
      throw new Error('Website Audit Tool report response was not valid JSON.');
    }
    logAuditPackageApiResponseDebug_(parsed);
    return normalizeAuditPackageReportResponse_(parsed);
  }

  return {
    fileName: 'Audit Report.txt',
    text: response.getContentText()
  };
}

function logAuditPackageApiResponseDebug_(responseJson) {
  const report = responseJson && responseJson.report;
  const reportText = report && report.reportText;
  const summary = responseJson && responseJson.summary;

  console.log('Audit Package API full response JSON', responseJson);
  console.log('Audit Package API response diagnostics', {
    reportExists: !!report,
    reportTextExists: reportText !== null && reportText !== undefined && String(reportText).trim() !== '',
    reportTextLength: reportText === null || reportText === undefined ? 0 : String(reportText).length,
    summaryLength: summary === null || summary === undefined ? 0 : String(summary).length
  });
}

function getResponseContentType_(response) {
  const headers = response.getHeaders();
  const keys = Object.keys(headers || {});
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index].toLowerCase() === 'content-type') {
      return String(headers[keys[index]] || '').toLowerCase();
    }
  }

  return '';
}

function normalizeAuditPackageReportResponse_(response) {
  const payload = response && (response.report || response.payload || response.data || response);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Website Audit Tool response did not include an audit report.');
  }

  if (payload.pdfBase64 || payload.reportPdfBase64) {
    const base64 = payload.pdfBase64 || payload.reportPdfBase64;
    const bytes = Utilities.base64Decode(base64);
    const fileName = payload.fileName || 'Audit Report.pdf';
    return {
      fileName: fileName,
      blob: Utilities.newBlob(bytes, MimeType.PDF, fileName)
    };
  }

  const reportText = String(payload.reportText || '').trim();
  const summary = String((response && response.summary) || payload.summary || '').trim();
  let text = '';
  let source = '';

  if (reportText) {
    text = payload.reportText;
    source = 'reportText';
  } else if (summary) {
    text = summary;
    source = 'summary';
  } else {
    text = payload.text || payload.txt || payload.report || '';
    source = text ? 'legacy report text field' : 'none';
  }

  console.log('Audit Package report content selected', {
    reportTextLength: reportText.length,
    contentSource: source
  });

  if (!String(text || '').trim()) {
    throw new Error('Website Audit Tool response did not include PDF or TXT report content.');
  }

  return {
    fileName: payload.fileName || 'Audit Report.txt',
    text: text,
    screenshotUrl: firstNonBlank_([payload.websiteScreenshotUrl, payload.screenshotUrl, payload.screenshot]),
    screenshotBase64: firstNonBlank_([payload.websiteScreenshotBase64, payload.screenshotBase64]),
    screenshotMimeType: firstNonBlank_([payload.websiteScreenshotMimeType, payload.screenshotMimeType]),
    mobileScreenshotUrl: firstNonBlank_([payload.mobileScreenshotUrl, payload.mobileScreenshot]),
    mobileScreenshotBase64: firstNonBlank_([payload.mobileScreenshotBase64]),
    mobileScreenshotMimeType: firstNonBlank_([payload.mobileScreenshotMimeType])
  };
}

function runWebsiteAudit() {
  const context = getSelectedProspectContext_(['Company', 'Website']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const prospect = {
    company: getValueByHeader_(context.values, context.table.headers, 'Company'),
    website: getValueByHeader_(context.values, context.table.headers, 'Website'),
    source: getValueByHeader_(context.values, context.table.headers, 'Source'),
    auditSource: getValueByHeader_(context.values, context.table.headers, 'Audit Source')
  };

  if (!String(prospect.website || '').trim()) {
    ui.alert('Rogers Holdings OS', 'Add a Website before running the internal audit.', ui.ButtonSet.OK);
    return;
  }

  if (isWebsiteAuditToolResult_(prospect)) {
    ui.alert(
      'Rogers Holdings OS',
      'This prospect already has Website Audit Tool results. Quick Internal Audit will not overwrite full audit data.',
      ui.ButtonSet.OK
    );
    return;
  }

  const confirm = ui.alert(
    'Rogers Holdings OS',
    `This is a quick internal placeholder audit, not the full Website Audit Tool report. It should not be used as a final client-facing audit. Continue?\n\nProspect: ${prospect.company}`,
    ui.ButtonSet.OK_CANCEL
  );

  if (confirm !== ui.Button.OK) {
    return;
  }

  const audit = generatePlaceholderAuditResults_(prospect);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Audit Score', audit.auditScore);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Audit Outcome', audit.auditOutcome);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Offer / Service', audit.offerService);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Priority Tier', audit.priorityTier);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Notes', audit.notes);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Summary', audit.summary);
  setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Audit Source', 'Quick Internal Audit');
  setProspectStatusIfHeader_(context.sheet, context.table.headers, context.selectedRow, 'Audit Complete');
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  logPipelineActivity_(context.ss, prospect.company, 'Quick Internal Audit', audit.summary);
  refreshSalesOperatingSystem_();

  ui.alert('Rogers Holdings OS', 'Internal website audit complete.', ui.ButtonSet.OK);
}

function isWebsiteAuditToolResult_(prospect) {
  return isWebsiteAuditToolSource_(prospect.auditSource) || isWebsiteAuditToolSource_(prospect.source);
}

function isWebsiteAuditToolSource_(value) {
  return String(value || '').trim().toLowerCase() === 'website audit tool';
}

function generatePlaceholderAuditResults_(prospect) {
  const website = String(prospect.website || '').trim();
  const hasHttps = website.toLowerCase().indexOf('https://') === 0;
  const auditScore = hasHttps ? 72 : 58;
  const auditOutcome = hasHttps ? 'Good Fit' : 'Needs Nurture';
  const priorityTier = auditScore >= 70 ? 'B - Good' : 'A - Hot';
  const offerService = 'Website Audit';
  const findings = [
    'Customers may benefit from clearer reasons to contact the business.',
    'Local visibility may improve with stronger search and service messaging.',
    hasHttps ? 'The website has a usable foundation for practical improvements.' : 'Trust may improve with stronger website security and presentation.',
    'The next step should focus on making it easier for visitors to take action.'
  ];
  const notes = [
    'QUICK INTERNAL AUDIT ONLY - Not from full Website Audit Tool.',
    'Audit Source: Quick Internal Audit'
  ].concat(findings).join('\n');
  const summary = `Internal placeholder audit completed for ${prospect.company}. Score: ${auditScore}/100. Outcome: ${auditOutcome}.`;

  return {
    auditScore: auditScore,
    auditOutcome: auditOutcome,
    offerService: offerService,
    priorityTier: priorityTier,
    notes: notes,
    summary: summary
  };
}

function getSmartFindings_(prospect) {
  const findings = [];
  const seen = {};

  SMART_AUDIT_FINDINGS_LIBRARY.forEach(function(rule) {
    if (findings.length >= 5) {
      return;
    }

    if (rule.matches(prospect) && !seen[rule.finding]) {
      findings.push(rule.finding);
      seen[rule.finding] = true;
    }
  });

  return findings.slice(0, 5);
}

function applySmartFindingsToProspect_(sheet, headers, selectedRow, prospect) {
  const findings = getSmartFindings_(prospect);
  const notes = findings.join('\n');

  prospect.notes = notes;
  prospect.findings = findings;

  if (headers.Notes && notes) {
    sheet.getRange(selectedRow, headers.Notes).setValue(notes);
  }

  return findings;
}
