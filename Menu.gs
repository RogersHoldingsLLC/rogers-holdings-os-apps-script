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
    .addItem('Run Next Action', 'runNextAction')
    .addItem('Run Full Prospect Package', 'runFullProspectPackage')
    .addItem('Run Real Website Audit', 'runRealWebsiteAudit')
    .addItem('Generate Audit Package', 'generateAuditPackage')
    .addItem('Create Outreach Gmail Draft', 'createOutreachGmailDraft')
    .addItem('Send Audit Package', 'sendAuditPackage')
    .addItem('Generate Proposal', 'generateProposal')
    .addItem('Create Discovery Call', 'createDiscoveryCall')
    .addItem('Bulk Prospect Import', 'openBulkProspectImport')
    .addItem('Run Bulk Audit Pipeline', 'runBulkAuditPipeline')
    .addItem('Quick Internal Audit', 'runWebsiteAudit');

  const pipelineMenu = ui.createMenu('Pipeline')
    .addItem('Advance Prospect Stage', 'advanceProspectStage')
    .addItem('Mark Email Sent', 'markEmailSent')
    .addItem('Mark Follow-Up Complete', 'markFollowUpComplete')
    .addItem('Mark Won', 'markProspectWon')
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
    .addItem('Convert Won Prospect to Client', 'convertWonProspectToClient')
    .addItem('Create Project', 'createProject')
    .addItem('Update Project Status', 'updateProjectStatus')
    .addItem('Complete Project', 'completeProject')
    .addItem('Refresh Projects', 'refreshProjects');

  const systemMenu = ui.createMenu('System')
    .addItem('Refresh Executive Dashboard', 'refreshExecutiveDashboard')
    .addItem('System Health Check', 'runSystemHealthCheck')
    .addItem('Reset Demo Data', 'resetDemoData');

  ui.createMenu('Rogers Holdings OS')
    .addSubMenu(navigateMenu)
    .addSubMenu(salesMenu)
    .addSubMenu(pipelineMenu)
    .addSubMenu(workspaceMenu)
    .addSubMenu(followUpMenu)
    .addSubMenu(clientProjectMenu)
    .addSubMenu(systemMenu)
    .addToUi();

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
