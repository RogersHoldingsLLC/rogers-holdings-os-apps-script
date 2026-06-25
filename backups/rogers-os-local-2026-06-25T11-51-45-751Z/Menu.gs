/**
 * Rogers Holdings OS - Menu.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Rogers Holdings OS')
    .addItem('Create Outreach Gmail Draft', 'createOutreachGmailDraft')
    .addItem('Generate Proposal', 'generateProposal')
    .addItem('Open Prospect Workspace', 'openProspectWorkspace')
    .addItem('Open Client Workspace', 'openClientWorkspace')
    .addItem('Refresh Client Workspace', 'refreshClientWorkspace')
    .addItem('Bulk Prospect Import', 'openBulkProspectImport')
    .addItem('Run Real Website Audit', 'runRealWebsiteAudit')
    .addItem('Quick Internal Audit', 'runWebsiteAudit')
    .addItem('Run Next Action', 'runNextAction')
    .addItem('Generate Audit Package', 'generateAuditPackage')
    .addItem('Run Full Prospect Package', 'runFullProspectPackage')
    .addItem('Run Bulk Audit Pipeline', 'runBulkAuditPipeline')
    .addItem('Send Audit Package', 'sendAuditPackage')
    .addItem('Create Discovery Call', 'createDiscoveryCall')
    .addItem('System Health Check', 'runSystemHealthCheck')
    .addItem('Refresh Executive Dashboard', 'refreshExecutiveDashboard')
    .addItem('Refresh Follow-Ups', 'refreshFollowUps')
    .addItem('Reset Demo Data', 'resetDemoData')
    .addSeparator()
    .addItem('Advance Prospect Stage', 'advanceProspectStage')
    .addItem('Mark Email Sent', 'markEmailSent')
    .addItem('Mark Follow-Up Complete', 'markFollowUpComplete')
    .addItem('Create Follow-Up', 'createFollowUp')
    .addItem('Complete Follow-Up', 'completeFollowUp')
    .addItem('Mark Won', 'markProspectWon')
    .addItem('Mark Lost', 'markProspectLost')
    .addSeparator()
    .addItem('Convert Prospect To Client', 'convertToClient')
    .addItem('Convert Won Prospect to Client', 'convertWonProspectToClient')
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
