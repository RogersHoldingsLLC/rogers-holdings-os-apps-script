/**
 * Rogers Holdings OS - Menu.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  const navigateMenu = ui.createMenu('Navigate')
    .addItem('Open Executive Dashboard', 'openExecutiveDashboard')
    .addItem('Open Master Prospect Tracker', 'openMasterProspectTracker')
    .addItem('Open Clients', 'openClientsSheet')
    .addItem('Open Follow-Ups', 'openFollowUpsSheet')
    .addItem('Open Projects', 'openProjectsSheet')
    .addItem('Open Activity Feed', 'openActivityFeedSheet');

  const salesMenu = ui.createMenu('Sales Workflow')
    .addItem('Run Full Prospect Package', 'runFullProspectPackage')
    .addSeparator()
    .addItem('Generate Executive Snapshot', 'generateExecutiveSnapshot')
    .addItem('Create Outreach Gmail Draft', 'createOutreachGmailDraft')
    .addItem('Generate Digital Business Assessment', 'generateAuditPackage')
    .addItem('Generate Improvement Plan', 'generateProposal')
    .addItem('Create Discovery Call', 'createDiscoveryCall');

  const pipelineMenu = ui.createMenu('Pipeline')
    .addItem('Run Next Action', 'runNextAction')
    .addItem('Bulk Prospect Import', 'openBulkProspectImport')
    .addItem('Run Bulk Audit Pipeline', 'runBulkAuditPipeline')
    .addItem('Send Digital Business Assessment', 'sendAuditPackage')
    .addSeparator()
    .addItem('Confirm Executive Snapshot Sent', 'confirmExecutiveSnapshotSent')
    .addItem('Confirm Assessment Presented', 'confirmAssessmentPresented')
    .addItem('Confirm Improvement Plan Sent', 'confirmImprovementPlanSent')
    .addItem('Record Improvement Plan Accepted / Start Project', 'recordImprovementPlanAccepted')
    .addItem('Complete Client Onboarding', 'completeClientOnboarding')
    .addItem('Move to Nurture', 'moveProspectToNurture')
    .addItem('Reactivate Nurtured Prospect', 'reactivateNurturedProspect')
    .addItem('Mark Lost', 'markProspectLost');

  const workspaceMenu = ui.createMenu('Workspaces')
    .addItem('Open Prospect Workspace', 'openProspectWorkspace')
    .addItem('Open Client Workspace', 'openClientWorkspace')
    .addItem('Refresh Client Workspace', 'refreshClientWorkspace');

  const followUpMenu = ui.createMenu('Follow-Ups')
    .addItem('Create Follow-Up', 'createFollowUp')
    .addItem('Complete Follow-Up', 'completeFollowUp')
    .addItem('Refresh Follow-Ups', 'refreshFollowUps');

  const clientProjectMenu = ui.createMenu('Clients & Projects')
    .addItem('Convert Prospect to Client', 'convertWonProspectToClient')
    .addItem('Create Project', 'createProject')
    .addItem('Update Project Status', 'updateProjectStatus')
    .addItem('Complete Project', 'completeProject')
    .addItem('Refresh Projects', 'refreshProjects');

  const productMenu = ui.createMenu('Product')
    .addItem('Open Product Feedback', 'openProductFeedback')
    .addSeparator()
    .addItem('About Business Optimization Platform', 'showProductAbout');

  const systemMenu = ui.createMenu('System')
    .addItem('Refresh Executive Dashboard', 'refreshExecutiveDashboard')
    .addItem('Open Daily Friction Log', 'openDailyFrictionLog')
    .addItem('System Health Check', 'runSystemHealthCheck')
    .addItem('Audit Legacy Lifecycle Values', 'auditLegacyLifecycleValues')
    .addItem('Repair Invalid Dropdown Values', 'repairInvalidDropdownValues')
    .addItem('Reset Test Data', 'resetTestData')
    .addItem('Reset Demo Data', 'resetDemoData');

  const rogersMenu = ui.createMenu('Business Optimization Platform')
    .addSubMenu(navigateMenu)
    .addSubMenu(salesMenu)
    .addSubMenu(pipelineMenu)
    .addSubMenu(workspaceMenu)
    .addSubMenu(followUpMenu)
    .addSubMenu(clientProjectMenu)
    .addSubMenu(productMenu)
    .addSubMenu(systemMenu);

  if (typeof isDeveloperModeEnabled_ === 'function' && isDeveloperModeEnabled_()) {
    const developmentMenu = ui.createMenu('Development')
      .addItem('Inspection Playground', 'openInspectionPlayground')
      .addSeparator()
      .addItem('Run Real Website Audit', 'runRealWebsiteAudit')
      .addItem('Quick Internal Audit', 'runWebsiteAudit')
      .addItem('Fetch Website Document', 'fetchPlaygroundWebsiteDocument')
      .addItem('Run Selected Inspector', 'runSelectedInspector')
      .addItem('Run Full Inspection', 'runFullInspection')
      .addItem('Copy Inspection JSON', 'copyInspectionJson')
      .addItem('View Priority Matrix', 'viewPriorityMatrix')
      .addItem('View Category Scores', 'viewCategoryScores')
      .addItem('Export Inspection Result', 'exportInspectionResult');
    rogersMenu.addSubMenu(developmentMenu);
  }

  rogersMenu.addToUi();

  refreshSalesOperatingSystem_();
}

function showProductAbout() {
  const properties = PropertiesService.getScriptProperties();
  const deploymentTarget = String(properties.getProperty('DEPLOYMENT_TARGET') || properties.getProperty('ROGERS_OS_DEPLOYMENT_TARGET') || 'Not configured').trim();
  const gitCommit = String(properties.getProperty('GIT_COMMIT') || properties.getProperty('ROGERS_OS_GIT_COMMIT') || 'Not available').trim();
  const html = HtmlService.createHtmlOutput(`
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { box-sizing: border-box; margin: 0; padding: 26px; background: #111; color: #f7f3ea; font-family: Arial, Helvetica, sans-serif; }
          .eyebrow { color: #d8ad4d; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; }
          h1 { margin: 7px 0 8px; color: #fff; font-size: 24px; line-height: 1.2; }
          .subtitle { margin: 0 0 22px; color: #cfc6b6; font-size: 13px; }
          dl { display: grid; grid-template-columns: 145px 1fr; margin: 0; border-top: 1px solid rgba(184, 135, 40, .45); }
          dt, dd { margin: 0; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, .08); font-size: 13px; }
          dt { color: #d8ad4d; font-weight: 700; }
          dd { color: #fff; overflow-wrap: anywhere; }
          .footer { margin-top: 18px; color: #9f978a; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="eyebrow">Rogers Holdings LLC</div>
        <h1>${escapeHtml_(PRODUCT_NAME)}</h1>
        <p class="subtitle">Release candidate information — not yet approved for production</p>
        <dl>
          <dt>Version</dt><dd>${escapeHtml_(PRODUCT_VERSION)}</dd>
          <dt>Build</dt><dd>${escapeHtml_(PRODUCT_BUILD)}</dd>
          <dt>Deployment Target</dt><dd>${escapeHtml_(deploymentTarget)}</dd>
          <dt>Git Commit</dt><dd>${escapeHtml_(gitCommit)}</dd>
        </dl>
        <div class="footer">Deployment metadata appears when provided through Apps Script properties.</div>
      </body>
    </html>
  `).setWidth(520).setHeight(390);
  SpreadsheetApp.getUi().showModalDialog(html, 'About');
}

function testRogersMenuIndexing() {
  Logger.log('Rogers Holdings OS indexing OK');
}

function restoreRogersHoldingsMenu() {
  onOpen();
}

function onEdit(e) {
  let lock = null;
  try {
    if (!e || !e.range) {
      return;
    }

    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
      return;
    }

    const table = getHeaderTable_(sheet, ['Status']);
    const statusColumn = table.headers.Status;
    const editFirstColumn = e.range.getColumn();
    const editLastColumn = editFirstColumn + e.range.getNumColumns() - 1;
    if (statusColumn < editFirstColumn || statusColumn > editLastColumn || e.range.getLastRow() <= table.headerRow) {
      return;
    }

    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) {
      let unknownRows = [];
      for (let row = Math.max(e.range.getRow(), table.headerRow + 1); row <= e.range.getLastRow(); row += 1) {
        const knownPrior = getLifecycleStatusSnapshot_(sheet, row);
        const restoredValue = restoreManualStatusCell_(sheet.getRange(row, statusColumn), knownPrior);
        if (!knownPrior) unknownRows.push(row);
        markLifecycleReconciliationRequired_(sheet, table.headers, row, knownPrior
          ? `Unsupported multi-cell Status edit; verified prior Status ${restoredValue} was restored.`
          : 'Unsupported multi-cell Status edit; prior Status snapshot was unavailable, so only the Status cell was cleared.');
      }
      notifyLifecycleOperator_(unknownRows.length
        ? `Multi-cell Status edits are not supported. Known prior Status values were restored without changing adjacent cells. Reconciliation is required for row(s): ${unknownRows.join(', ')}.`
        : 'Multi-cell Status edits are not supported. Prior Status values were restored; adjacent cells were not changed. Update one Status cell at a time.');
      return;
    }

    const snapshotStatus = getLifecycleStatusSnapshot_(sheet, e.range.getRow());
    if ((e.oldValue === undefined || e.oldValue === null || String(e.oldValue).trim() === '') && !snapshotStatus) {
      restoreManualStatusCell_(e.range, '');
      markLifecycleReconciliationRequired_(sheet, table.headers, e.range.getRow(), 'Manual Status edit could not be validated because the prior Status was unavailable. The unverified Status was cleared; explicit reconciliation is required.');
      notifyLifecycleOperator_('The prior confirmed Status was unavailable, so the unverified edit was cleared. Reconciliation is required before using an explicit confirmation action.');
      return;
    }

    lock = LockService.getDocumentLock();
    lock.waitLock(30000);

    const priorValue = e.oldValue === undefined || e.oldValue === null || String(e.oldValue).trim() === '' ? snapshotStatus : e.oldValue;
    const previousStatus = normalizePipelineStage_(priorValue) || String(priorValue || '').trim();
    const requestedStatus = normalizePipelineStage_(e.range.getValue()) || String(e.range.getValue() || '').trim();
    const validation = validateProspectStageTransition_(previousStatus, requestedStatus);
    if (!validation.allowed) {
      e.range.setValue(previousStatus);
      notifyLifecycleOperator_(validation.message);
      return;
    }
    if (validation.idempotent) {
      return;
    }

    const values = sheet.getRange(e.range.getRow(), 1, 1, table.lastColumn).getValues()[0];
    const company = String(getValueByHeader_(values, table.headers, 'Company') || '').trim();
    const context = {
      ss: e.source || SpreadsheetApp.getActiveSpreadsheet(), sheet: sheet, table: table,
      selectedRow: e.range.getRow(), values: values, prospect: { company: company, status: previousStatus }
    };
    applyConfirmedProspectTransition_(context, requestedStatus, 'CRM Status Manually Changed', `Operator changed CRM Status from ${previousStatus} to ${requestedStatus}.`, { lockHeld: true, previousStage: previousStatus });
    const persisted = normalizePipelineStage_(e.range.getValue()) || String(e.range.getValue() || '').trim();
    if (persisted !== requestedStatus) {
      markLifecycleReconciliationRequired_(sheet, context.table.headers, e.range.getRow(), `Manual Status verification failed. Expected ${requestedStatus}; found ${persisted || '(blank)'}.`);
      notifyLifecycleOperator_('The Status write could not be verified. Reconciliation is required before further lifecycle changes.');
      return;
    }
    updatePipelineDashboardMetrics_();
    updateExecutiveDashboardFollowUpQueue_();
  } catch (error) {
    console.error(error);
    notifyLifecycleOperator_('The Status edit could not be completed safely. Review the Lifecycle Operation State and Details columns before continuing. ' + (error && error.message ? error.message : String(error)));
  } finally {
    if (lock) lock.releaseLock();
  }
}

function restoreManualStatusCell_(statusCell, priorStatus) {
  const restoredValue = String(priorStatus || '').trim();
  if (restoredValue) statusCell.setValue(restoredValue);
  else statusCell.clearContent();
  const persisted = String(statusCell.getValue() || '').trim();
  if (persisted !== restoredValue) {
    throw new Error(`Status restoration verification failed; expected ${restoredValue || '(blank)'}, found ${persisted || '(blank)'}.`);
  }
  return persisted;
}

function notifyLifecycleOperator_(message) {
  try {
    SpreadsheetApp.getUi().alert('Rogers Holdings OS', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    console.warn('Lifecycle operator notification unavailable: ' + message);
  }
}

function onSelectionChange(e) {
  try {
    handleExecutiveDashboardQuickActionSelection_(e);
  } catch (error) {
    console.error(error);
  }
}
