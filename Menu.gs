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
    .addItem('Advance Prospect Stage', 'advanceProspectStage')
    .addItem('Mark Email Sent', 'markEmailSent')
    .addItem('Mark Follow-Up Complete', 'markFollowUpComplete')
    .addItem('Convert to Client', 'markProspectWon')
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
    .addItem('Convert Prospect To Client', 'convertToClient')
    .addItem('Convert Prospect to Client', 'convertWonProspectToClient')
    .addItem('Create Project', 'createProject')
    .addItem('Update Project Status', 'updateProjectStatus')
    .addItem('Complete Project', 'completeProject')
    .addItem('Refresh Projects', 'refreshProjects');

  const productMenu = ui.createMenu('Product')
    .addItem('Open Product Feedback', 'openProductFeedback');

  const systemMenu = ui.createMenu('System')
    .addItem('Refresh Executive Dashboard', 'refreshExecutiveDashboard')
    .addItem('Open Daily Friction Log', 'openDailyFrictionLog')
    .addItem('System Health Check', 'runSystemHealthCheck')
    .addItem('Repair Invalid Dropdown Values', 'repairInvalidDropdownValues')
    .addItem('Reset Test Data', 'resetTestData')
    .addItem('Reset Demo Data', 'resetDemoData');

  const rogersMenu = ui.createMenu('Rogers Holdings OS')
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

function testRogersMenuIndexing() {
  Logger.log('Rogers Holdings OS indexing OK');
}

function restoreRogersHoldingsMenu() {
  onOpen();
}

function onEdit(e) {
  try {
    if (!e || !e.range) {
      return;
    }

    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
      return;
    }

    const table = getHeaderTable_(sheet, ['Status']);
    if (e.range.getColumn() !== table.headers.Status || e.range.getRow() <= table.headerRow) {
      return;
    }

    syncFollowUpForProspectRow_(sheet, table.headers, e.range.getRow(), e.range.getValue());
    updateSelectedProspectLastActivity_(sheet, table.headers, e.range.getRow());
    updatePipelineDashboardMetrics_();
    updateExecutiveDashboardFollowUpQueue_();
  } catch (error) {
    console.error(error);
  }
}

function onSelectionChange(e) {
  try {
    handleExecutiveDashboardQuickActionSelection_(e);
  } catch (error) {
    console.error(error);
  }
}
