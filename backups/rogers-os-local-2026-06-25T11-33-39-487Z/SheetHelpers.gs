/**
 * Rogers Holdings OS - SheetHelpers.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function updateSelectedProspectLastActivity_(sheet, headers, selectedRow) {
  if (!headers['Last Activity']) {
    return;
  }

  sheet.getRange(selectedRow, headers['Last Activity']).setValue(new Date());
}

function updateSelectedProspectFollowUpDate_(sheet, headers, selectedRow, daysFromToday) {
  if (!headers['Follow-Up Date']) {
    return;
  }

  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + daysFromToday);
  followUpDate.setHours(0, 0, 0, 0);
  sheet.getRange(selectedRow, headers['Follow-Up Date']).setValue(followUpDate);
}

function refreshSalesOperatingSystem_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  standardizeMasterProspectTrackerColumns_();
  ensureAuditPackageColumns_();
  getOrCreateClientsSheet_(ss);
  getOrCreateClientWorkspaceSheet_(ss);
  updatePipelineDashboardMetrics_();
  refreshExecutiveDashboard();
  applyPipelineStatusConditionalFormatting_();
  applyPipelineStatusValidation_();
  applyRogersHoldingsVisualDesign_();
}

function runNextAction() {
  const context = getSelectedProspectContextOrAlert_([
    'Company',
    'Status'
  ]);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const company = String(getValueByHeader_(context.values, context.table.headers, 'Company') || '').trim();
  const rawStatus = String(getValueByHeader_(context.values, context.table.headers, 'Status') || '').trim();
  const status = normalizePipelineStage_(rawStatus) || rawStatus || 'Lead Found';
  let completedAction = '';

  try {
    logPipelineActivity_(context.ss, company, 'Next Action Started', `Next Action Engine started from status: ${status}.`);

    if (status === 'Lead Found') {
      completedAction = runLeadFoundNextAction_(context);
    } else if (status === 'Audit Complete') {
      completedAction = runAuditCompleteNextAction_(context);
    } else if (status === 'Audit Package Sent') {
      completedAction = runAuditPackageSentNextAction_(context);
    } else if (status === 'Draft Created') {
      completedAction = promptReviewGmailDraft_(context);
    } else if (status === 'Email Sent') {
      completedAction = scheduleNextActionFollowUp_(context);
    } else if (status === 'Follow Up Due') {
      completedAction = promptFollowUpOutcome_(context);
    } else if (status === 'Proposal Sent') {
      completedAction = promptScheduleDiscoveryFromNextAction_(context);
    } else if (status === 'Discovery Scheduled') {
      completedAction = promptDiscoveryOutcome_(context);
    } else if (status === 'Won') {
      completedAction = openOrCreateClientFromNextAction_(context);
    } else if (status === 'Lost') {
      completedAction = archiveLostProspectFromNextAction_(context);
    } else {
      completedAction = runDefaultNextAction_(context, status);
    }

    logPipelineActivity_(context.ss, company, 'Next Action Complete', completedAction);
    refreshNextActionDashboards_();

    ui.alert(
      'Rogers Holdings OS',
      `Next Action complete for ${company}.\n\n${completedAction}`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    try {
      logPipelineActivity_(context.ss, company, 'Next Action Failed', `Status: ${status}. Error: ${message}`);
      refreshNextActionDashboards_();
    } catch (logError) {
      console.warn('Next Action failure could not be logged: ' + (logError && logError.message ? logError.message : String(logError)));
    }

    ui.alert('Rogers Holdings OS', `Run Next Action failed.\n\n${message}`, ui.ButtonSet.OK);
  }
}

function getSelectedProspectContextOrAlert_(requiredHeaders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();

  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
    ui.alert('Rogers Holdings OS', 'Run Next Action from a selected row on Master Prospect Tracker.', ui.ButtonSet.OK);
    return null;
  }

  const activeRange = sheet.getActiveRange();
  if (!activeRange) {
    ui.alert('Rogers Holdings OS', 'Select one prospect row before running Next Action.', ui.ButtonSet.OK);
    return null;
  }

  const table = getHeaderTable_(sheet, requiredHeaders || ['Company', 'Status']);
  const selectedRow = activeRange.getRow();
  if (selectedRow <= table.headerRow) {
    ui.alert('Rogers Holdings OS', 'Select a prospect data row below the header row.', ui.ButtonSet.OK);
    return null;
  }

  const values = sheet.getRange(selectedRow, 1, 1, table.lastColumn).getValues()[0];
  const company = String(getValueByHeader_(values, table.headers, 'Company') || '').trim();
  if (!company) {
    ui.alert('Rogers Holdings OS', 'The selected prospect row is blank or missing Company.', ui.ButtonSet.OK);
    return null;
  }

  return {
    ss: ss,
    sheet: sheet,
    table: table,
    selectedRow: selectedRow,
    values: values,
    prospect: {
      company: company,
      status: getValueByHeader_(values, table.headers, 'Status')
    }
  };
}

function runLeadFoundNextAction_(context) {
  if (hasAuditDataForNextAction_(context)) {
    generateAuditPackage();
    return 'Audit data already existed, so Rogers Holdings OS skipped the audit and generated the audit package.';
  }

  runRealWebsiteAudit();
  return 'Ran the real Website Audit workflow.';
}

function runAuditCompleteNextAction_(context) {
  if (isAuditPackageAlreadyGeneratedForNextAction_(context)) {
    createOutreachGmailDraft();
    return 'Audit package already existed, so Rogers Holdings OS created the Gmail draft.';
  }

  generateAuditPackage();
  return 'Generated the audit package.';
}

function runAuditPackageSentNextAction_(context) {
  if (isHeaderMarkedYesForNextAction_(context, 'Gmail Draft Created')) {
    return promptReviewGmailDraft_(context);
  }

  createOutreachGmailDraft();
  return 'Created the Gmail draft.';
}

function runDefaultNextAction_(context, status) {
  if (!hasAuditDataForNextAction_(context)) {
    runRealWebsiteAudit();
    return `Status "${status}" was not mapped, so Rogers Holdings OS ran the real Website Audit workflow.`;
  }

  if (!isAuditPackageAlreadyGeneratedForNextAction_(context)) {
    generateAuditPackage();
    return `Status "${status}" was not mapped, so Rogers Holdings OS generated the audit package.`;
  }

  createOutreachGmailDraft();
  return `Status "${status}" was not mapped, so Rogers Holdings OS created the Gmail draft.`;
}

function promptReviewGmailDraft_(context) {
  const company = String(getValueByHeader_(context.values, context.table.headers, 'Company') || '').trim();
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:18px;color:#202020;">' +
      '<h2 style="margin:0 0 10px;color:#111;">Review Gmail Draft</h2>' +
      '<p style="line-height:1.5;">Open Gmail Drafts, review the outreach email for <strong>' + escapeHtml_(company) + '</strong>, then send it manually when ready.</p>' +
      '<p><a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:4px;">Open Gmail Drafts</a></p>' +
      '<p style="font-size:12px;color:#6f6a60;">Apps Script cannot reliably open a specific Gmail draft, so this opens the Gmail Drafts folder.</p>' +
    '</div>'
  ).setWidth(420).setHeight(260);

  SpreadsheetApp.getUi().showModalDialog(html, 'Rogers Holdings OS');
  logPipelineActivity_(context.ss, company, 'Gmail Draft Review Prompted', 'Prompted user to review and send the Gmail draft.');
  return 'Opened a Gmail Draft review prompt.';
}

function scheduleNextActionFollowUp_(context) {
  const headers = context.table.headers;
  const company = String(getValueByHeader_(context.values, headers, 'Company') || '').trim();

  setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Follow Up Due');
  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Follow Up');
  updateSelectedProspectFollowUpDate_(context.sheet, headers, context.selectedRow, 7);
  updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
  logPipelineActivity_(context.ss, company, 'Follow-Up Scheduled', 'Follow-up scheduled 7 days after email sent.');
  return 'Scheduled follow-up for 7 days from today.';
}

function promptFollowUpOutcome_(context) {
  const ui = SpreadsheetApp.getUi();
  const headers = context.table.headers;
  const company = String(getValueByHeader_(context.values, headers, 'Company') || '').trim();
  const history = buildNextActionFollowUpHistory_(context.ss, company);
  const response = ui.prompt(
    'Follow-Up Outcome',
    history + '\n\nEnter next outcome: Draft, Proposal, Discovery, Won, Lost, Nurture, or Follow Up',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return 'Follow-up history displayed. No outcome was selected.';
  }

  const outcome = String(response.getResponseText() || '').trim().toLowerCase();
  if (outcome === 'draft') {
    createOutreachGmailDraft();
    return 'Created a new Gmail draft from follow-up outcome.';
  }
  if (outcome === 'proposal') {
    setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Proposal Sent');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Schedule Discovery');
    updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
    logPipelineActivity_(context.ss, company, 'Proposal Sent', 'Follow-up outcome marked as Proposal Sent.');
    return 'Marked prospect as Proposal Sent.';
  }
  if (outcome === 'discovery') {
    createDiscoveryCall();
    return 'Started Discovery Call scheduling.';
  }
  if (outcome === 'won') {
    markProspectWon();
    return 'Marked prospect as Won.';
  }
  if (outcome === 'lost') {
    markProspectLost();
    return 'Marked prospect as Lost.';
  }
  if (outcome === 'nurture') {
    setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Nurture');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Nurture');
    updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
    logPipelineActivity_(context.ss, company, 'Prospect Nurture', 'Follow-up outcome marked as Nurture.');
    return 'Moved prospect to Nurture.';
  }

  scheduleNextActionFollowUp_(context);
  return 'Scheduled the next follow-up.';
}

function promptScheduleDiscoveryFromNextAction_(context) {
  const ui = SpreadsheetApp.getUi();
  const company = String(getValueByHeader_(context.values, context.table.headers, 'Company') || '').trim();
  const response = ui.alert(
    'Schedule Discovery',
    `Schedule a discovery call for ${company}?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return 'Discovery scheduling prompt displayed. No call was scheduled.';
  }

  createDiscoveryCall();
  return 'Started Discovery Call scheduling.';
}

function promptDiscoveryOutcome_(context) {
  const ui = SpreadsheetApp.getUi();
  const company = String(getValueByHeader_(context.values, context.table.headers, 'Company') || '').trim();
  const response = ui.alert(
    'Discovery Outcome',
    `Mark ${company} as Won?\n\nChoose No to mark Lost, or Cancel to leave unchanged.`,
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (response === ui.Button.YES) {
    markProspectWon();
    return 'Marked prospect as Won after discovery.';
  }
  if (response === ui.Button.NO) {
    markProspectLost();
    return 'Marked prospect as Lost after discovery.';
  }

  return 'Discovery outcome prompt displayed. No status change was made.';
}

function openOrCreateClientFromNextAction_(context) {
  const result = convertWonProspectToClient_(context);
  return result.created
    ? `Created client record ${result.clientId}.`
    : `Updated existing client record ${result.clientId}.`;
}

function archiveLostProspectFromNextAction_(context) {
  const headers = context.table.headers;
  const company = String(getValueByHeader_(context.values, headers, 'Company') || '').trim();

  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Archived');
  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Archived', 'Yes');
  updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
  logPipelineActivity_(context.ss, company, 'Prospect Archived', 'Archived lost prospect.');
  return 'Archived the lost prospect.';
}

function hasAuditDataForNextAction_(context) {
  const headers = context.table.headers;
  const auditScore = getValueByHeader_(context.values, headers, 'Audit Score');
  const auditOutcome = getValueByHeader_(context.values, headers, 'Audit Outcome');

  return String(auditScore || '').trim() !== '' && String(auditOutcome || '').trim() !== '';
}

function isAuditPackageAlreadyGeneratedForNextAction_(context) {
  if (typeof isAuditPackageGenerated_ === 'function' && isAuditPackageGenerated_(context.values, context.table.headers)) {
    return true;
  }

  return isHeaderMarkedYesForNextAction_(context, 'Audit Package Generated');
}

function isHeaderMarkedYesForNextAction_(context, header) {
  const value = getValueByHeader_(context.values, context.table.headers, header);
  return String(value || '').trim().toLowerCase() === 'yes';
}

function buildNextActionFollowUpHistory_(ss, company) {
  const activities = getRecentActivityForCompany_(ss, company, 5);
  if (!activities.length) {
    return 'No recent follow-up history found.';
  }

  return 'Recent activity:\n' + activities.map(function(activity) {
    return '- ' + formatDisplayDate_(activity.date) + ': ' + activity.activityType + (activity.notes ? ' - ' + activity.notes : '');
  }).join('\n');
}

function refreshNextActionDashboards_() {
  updatePipelineDashboardMetrics_();
  refreshExecutiveDashboard();
}

function advanceProspectStage() {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  const currentStage = normalizePipelineStage_(getValueByHeader_(context.values, context.table.headers, 'Status'));
  const nextStage = getNextPipelineStage_(currentStage);

  setProspectStatus_(context.sheet, context.table.headers, context.selectedRow, nextStage);
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  logPipelineActivity_(context.ss, context.prospect.company, 'Prospect Stage Advanced', `Advanced prospect stage from ${currentStage || 'Unassigned'} to ${nextStage}.`);
  refreshSalesOperatingSystem_();

  SpreadsheetApp.getUi().alert('Rogers Holdings OS', `Prospect advanced to ${nextStage}.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function markProspectWon() {
  setSelectedProspectTerminalStage_('Won', 'Deal Won', 'Marked prospect as Won.');
}

function markProspectLost() {
  setSelectedProspectTerminalStage_('Lost', 'Deal Lost', 'Marked prospect as Lost.');
}

function markEmailSent() {
  updateSelectedProspectFollowUpStage_(
    'Email Sent',
    'Email Sent',
    'Intro email sent',
    'Intro email sent'
  );
}

function markFollowUpComplete() {
  updateSelectedProspectFollowUpStage_(
    'Follow Up Due',
    'Follow-Up Completed',
    'Follow-up completed; next follow-up scheduled',
    'Follow-up completed'
  );
}

function updateSelectedProspectFollowUpStage_(status, activityType, activityNotes, successMessage) {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  setProspectStatus_(context.sheet, context.table.headers, context.selectedRow, status);
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  updateSelectedProspectFollowUpDate_(context.sheet, context.table.headers, context.selectedRow, 7);
  logPipelineActivity_(context.ss, context.prospect.company, activityType, activityNotes);
  refreshSalesOperatingSystem_();

  SpreadsheetApp.getUi().alert('Rogers Holdings OS', successMessage + '.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function normalizeDropdownValue_(value) {
  return String(value || '').trim().toLowerCase();
}

function getDemoProspectHeaders_() {
  return [
    'Company',
    'Contact',
    'Email',
    'Phone',
    'Website',
    'City',
    'State',
    'Industry',
    'Source',
    'Audit Score',
    'Audit Outcome',
    'Priority Tier',
    'Status',
    'Next Action',
    'Follow-Up Date',
    'Offer / Service',
    'Notes',
    'Summary',
    'Audit Package Generated',
    'Audit Package Date',
    'Last Activity'
  ];
}

function firstNonBlank_(values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

function setIfHeaderCell_(sheet, headers, row, header, value) {
  if (!headers[header]) {
    return;
  }

  sheet.getRange(row, headers[header]).setValue(value);
}

function openProspectWorkspace() {
  const context = getSelectedProspectContext_(['Company']);
  if (!context) {
    return;
  }

  const workspace = buildProspectWorkspaceData_(context);
  const html = HtmlService
    .createHtmlOutput(buildProspectWorkspaceHtml_(workspace))
    .setTitle('Prospect Workspace');

  SpreadsheetApp.getUi().showSidebar(html);
}

function openClientWorkspace() {
  const context = getActiveClientWorkspaceContext_(true);
  if (!context) {
    return;
  }

  refreshClientWorkspaceForClientRow_(context.ss, context.clientSheet, context.headers, context.rowNumber, {
    logOpen: true
  });
  context.ss.setActiveSheet(context.ss.getSheetByName(CLIENT_WORKSPACE_SHEET));
}

function refreshClientWorkspace() {
  const context = getActiveClientWorkspaceContext_(true);
  if (!context) {
    return;
  }

  refreshClientWorkspaceForClientRow_(context.ss, context.clientSheet, context.headers, context.rowNumber, {
    logOpen: false
  });

  SpreadsheetApp.getUi().alert('Rogers Holdings OS', 'Client Workspace refreshed.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function getOrCreateClientWorkspaceSheet_(ss) {
  let sheet = ss.getSheetByName(CLIENT_WORKSPACE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CLIENT_WORKSPACE_SHEET);
  }

  return sheet;
}

function getActiveClientWorkspaceContext_(showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const activeSheet = ss.getActiveSheet();
  const clientSheet = getOrCreateClientsSheet_(ss);
  const table = ensureClientColumns_(clientSheet);
  let clientRow = null;

  if (activeSheet && activeSheet.getName() === CLIENTS_SHEET) {
    const selectedRow = activeSheet.getActiveRange() ? activeSheet.getActiveRange().getRow() : 0;
    if (selectedRow > table.headerRow) {
      clientRow = selectedRow;
    }
  }

  if (!clientRow && activeSheet && activeSheet.getName() === MASTER_PROSPECT_SHEET) {
    const prospectContext = getSelectedProspectContext_(['Company']);
    if (prospectContext) {
      const company = getValueByHeader_(prospectContext.values, prospectContext.table.headers, 'Company');
      const website = getValueByHeader_(prospectContext.values, prospectContext.table.headers, 'Website');
      const existing = findExistingClientRow_(clientSheet, table.headers, company, website);
      if (existing) {
        clientRow = existing.rowNumber;
      }
    }
  }

  if (!clientRow && activeSheet && activeSheet.getName() === CLIENT_WORKSPACE_SHEET) {
    const clientId = String(activeSheet.getRange(4, 2).getValue() || '').trim();
    const existingById = findClientRowById_(clientSheet, table.headers, clientId);
    if (existingById) {
      clientRow = existingById.rowNumber;
    }
  }

  if (!clientRow) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a client row on the Clients sheet, or select a prospect that has already been converted to a client.', ui.ButtonSet.OK);
    }
    return null;
  }

  return {
    ss: ss,
    clientSheet: clientSheet,
    headers: table.headers,
    rowNumber: clientRow,
    values: clientSheet.getRange(clientRow, 1, 1, table.lastColumn).getValues()[0]
  };
}

function findClientRowById_(sheet, headers, clientId) {
  const key = String(clientId || '').trim();
  if (!key || !headers['Client ID']) {
    return null;
  }

  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return null;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(getValueByHeader_(values[index], headers, 'Client ID') || '').trim() === key) {
      return {
        rowNumber: dataStartRow + index,
        values: values[index]
      };
    }
  }

  return null;
}

function refreshClientWorkspaceForClientRow_(ss, clientSheet, headers, rowNumber, options) {
  const settings = options || {};
  const table = ensureClientColumns_(clientSheet);
  const values = clientSheet.getRange(rowNumber, 1, 1, table.lastColumn).getValues()[0];
  const model = buildClientWorkspaceModel_(ss, values, table.headers);
  const workspaceSheet = getOrCreateClientWorkspaceSheet_(ss);

  renderClientWorkspace_(workspaceSheet, model);
  if (settings.logOpen) {
    logPipelineActivity_(ss, model.company, 'Workspace Opened', 'Client Workspace opened.');
  }
}

function buildClientWorkspaceModel_(ss, values, headers) {
  const company = firstNonBlank_([
    getValueByHeader_(values, headers, 'Company'),
    getValueByHeader_(values, headers, 'Client Name')
  ]);
  const folderInfo = getClientWorkspaceFolderInfo_(company);

  return {
    clientId: getValueByHeader_(values, headers, 'Client ID'),
    company: company,
    contact: getValueByHeader_(values, headers, 'Contact'),
    email: getValueByHeader_(values, headers, 'Email'),
    phone: getValueByHeader_(values, headers, 'Phone'),
    website: getValueByHeader_(values, headers, 'Website'),
    industry: getValueByHeader_(values, headers, 'Industry'),
    servicePackage: firstNonBlank_([
      getValueByHeader_(values, headers, 'Service Package'),
      getValueByHeader_(values, headers, 'Service')
    ]),
    startDate: getValueByHeader_(values, headers, 'Start Date') || getValueByHeader_(values, headers, 'Client Since'),
    renewalDate: getValueByHeader_(values, headers, 'Renewal Date'),
    status: getValueByHeader_(values, headers, 'Status'),
    assignedTo: getValueByHeader_(values, headers, 'Assigned To'),
    currentProject: getValueByHeader_(values, headers, 'Current Project'),
    projectStatus: getValueByHeader_(values, headers, 'Project Status'),
    dueDate: getValueByHeader_(values, headers, 'Due Date'),
    lastActivity: getValueByHeader_(values, headers, 'Last Activity'),
    notes: getValueByHeader_(values, headers, 'Notes'),
    folderUrl: folderInfo.url,
    documents: folderInfo.documents,
    activity: getRecentActivityForCompany_(ss, company, 8)
  };
}

function getClientWorkspaceFolderInfo_(company) {
  const folderName = sanitizeDriveFileName_(company || '');
  const result = {
    url: '',
    documents: []
  };
  if (!folderName) {
    return result;
  }

  const folders = DriveApp.getFoldersByName(folderName);
  if (!folders.hasNext()) {
    return result;
  }

  const folder = folders.next();
  result.url = folder.getUrl();
  const files = folder.getFiles();
  let count = 0;
  while (files.hasNext() && count < 8) {
    const file = files.next();
    result.documents.push(file.getName());
    count += 1;
  }

  return result;
}

function renderClientWorkspace_(sheet, model) {
  ensureExecutiveDashboardSize_(sheet, 70, 10);
  sheet.getRange(1, 1, 70, 10).breakApart().clearContent().clearFormat();
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(ROGERS_OS_THEME.black);
  safeSetFrozenRows_(sheet, 3);

  const black = ROGERS_OS_THEME.black;
  const gold = ROGERS_OS_THEME.gold;
  const white = ROGERS_OS_THEME.white;
  const neutral = ROGERS_OS_THEME.softNeutral;
  const border = ROGERS_OS_THEME.border;

  sheet.setColumnWidths(1, 10, 135);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(4, 180);
  sheet.setColumnWidth(5, 230);
  sheet.setColumnWidth(7, 180);
  sheet.setColumnWidth(8, 230);
  sheet.setRowHeights(1, 70, 30);
  sheet.setRowHeight(1, 42);
  sheet.setRowHeight(2, 34);

  sheet.getRange(1, 1, 1, 10).merge().setValue('ROGERS HOLDINGS OS | CLIENT WORKSPACE')
    .setBackground(black)
    .setFontColor(gold)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('left');
  sheet.getRange(2, 1, 1, 10).merge().setValue(model.company || 'No Client Selected')
    .setBackground(black)
    .setFontColor(white)
    .setFontWeight('bold')
    .setFontSize(20);

  writeClientWorkspaceSection_(sheet, 4, 1, 2, 'Client Overview', [
    ['Client ID', model.clientId],
    ['Company', model.company],
    ['Status', model.status],
    ['Industry', model.industry],
    ['Service Package', model.servicePackage]
  ]);
  writeClientWorkspaceSection_(sheet, 4, 4, 2, 'Contact Information', [
    ['Contact', model.contact],
    ['Email', model.email],
    ['Phone', model.phone],
    ['Website', model.website],
    ['Assigned To', model.assignedTo]
  ]);
  writeClientWorkspaceSection_(sheet, 4, 7, 2, 'Current Project', [
    ['Project', model.currentProject],
    ['Project Status', model.projectStatus],
    ['Start Date', formatDisplayDate_(model.startDate)],
    ['Due Date', formatDisplayDate_(model.dueDate)],
    ['Renewal Date', formatDisplayDate_(model.renewalDate)]
  ]);

  writeClientWorkspaceSection_(sheet, 13, 1, 5, 'Timeline / Recent Activity', clientActivityRows_(model.activity));
  writeClientWorkspaceSection_(sheet, 13, 7, 3, 'Documents', clientDocumentRows_(model));
  writeClientWorkspaceSection_(sheet, 28, 1, 3, 'Quick Actions', [
    ['Open Client Workspace', 'Use Rogers Holdings OS > Open Client Workspace'],
    ['Refresh Client Workspace', 'Use Rogers Holdings OS > Refresh Client Workspace'],
    ['Next Action', 'Use Rogers Holdings OS > Run Next Action']
  ]);
  writeClientWorkspaceSection_(sheet, 28, 5, 5, 'Next Steps', [
    ['Current Project', model.currentProject],
    ['Project Status', model.projectStatus],
    ['Due Date', formatDisplayDate_(model.dueDate)],
    ['Last Activity', formatDisplayDate_(model.lastActivity)],
    ['Notes', model.notes]
  ]);

  sheet.getRange(1, 1, 70, 10)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.getRange(4, 1, 32, 10)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(5, 1, 8, 10).setBackground(neutral);
}

function writeClientWorkspaceSection_(sheet, startRow, startColumn, valueColumnSpan, title, rows) {
  const width = valueColumnSpan + 1;
  sheet.getRange(startRow, startColumn, 1, width).merge().setValue(title)
    .setBackground(ROGERS_OS_THEME.black)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold')
    .setFontSize(11);

  const output = (rows || []).map(function(row) {
    return [row[0] || '', clientWorkspaceDisplayValue_(row[1])];
  });
  if (!output.length) {
    return;
  }

  sheet.getRange(startRow + 1, startColumn, output.length, 2).setValues(output);
  sheet.getRange(startRow + 1, startColumn, output.length, 1)
    .setFontWeight('bold')
    .setFontColor(ROGERS_OS_THEME.muted);
  sheet.getRange(startRow + 1, startColumn + 1, output.length, Math.max(valueColumnSpan, 1))
    .setBackground(ROGERS_OS_THEME.softNeutral);
}

function clientWorkspaceDisplayValue_(value) {
  if (value instanceof Date) {
    return value;
  }

  if (value === 0) {
    return 0;
  }

  const text = String(value || '').trim();
  return text ? value : 'Not set yet';
}

function clientActivityRows_(activities) {
  const values = (activities || []).slice(0, 8).map(function(activity) {
    return [
      formatDisplayDate_(activity.date),
      `${activity.activityType || ''}${activity.notes ? ' - ' + activity.notes : ''}`
    ];
  });
  return values.length ? values : [['Activity', 'No recent client activity yet.']];
}

function clientDocumentRows_(model) {
  const rows = [];
  if (model.folderUrl) {
    rows.push(['Drive Folder', model.folderUrl]);
  }
  (model.documents || []).slice(0, 7).forEach(function(fileName) {
    rows.push(['File', fileName]);
  });
  return rows.length ? rows : [['Documents', 'No client documents found yet.']];
}

function openBulkProspectImport() {
  const html = HtmlService
    .createHtmlOutput(buildBulkProspectImportHtml_())
    .setTitle('Bulk Prospect Import');

  SpreadsheetApp.getUi().showSidebar(html);
}

function buildBulkProspectImportHtml_() {
  return `
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            margin: 0;
            background: #111111;
            color: #f7f3ea;
            font-family: Arial, Helvetica, sans-serif;
          }
          .wrap {
            padding: 18px;
          }
          .brand {
            border-bottom: 2px solid #b88728;
            margin-bottom: 16px;
            padding-bottom: 12px;
          }
          .brand span {
            color: #d8ad4d;
            display: block;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.8px;
            text-transform: uppercase;
          }
          h1 {
            margin: 4px 0 0;
            color: #ffffff;
            font-size: 21px;
            line-height: 1.2;
          }
          label {
            display: block;
            margin: 12px 0 6px;
            color: #d8ad4d;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          input,
          textarea {
            box-sizing: border-box;
            width: 100%;
            border: 1px solid rgba(184, 135, 40, .55);
            background: #181818;
            color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            padding: 10px;
          }
          textarea {
            min-height: 190px;
            resize: vertical;
          }
          .hint {
            color: #cfc6b6;
            font-size: 12px;
            line-height: 1.45;
            margin: 10px 0;
          }
          button {
            width: 100%;
            min-height: 40px;
            margin-top: 14px;
            border: 1px solid #b88728;
            background: #b88728;
            color: #111111;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .result {
            border: 1px solid rgba(184, 135, 40, .45);
            background: #181818;
            margin-top: 14px;
            padding: 12px;
            color: #ffffff;
            font-size: 13px;
            line-height: 1.55;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="brand">
            <span>Rogers Holdings OS</span>
            <h1>Bulk Prospect Import</h1>
          </div>

          <label for="company">Company Name</label>
          <input id="company" placeholder="Joe's Roofing">

          <label for="website">Website</label>
          <input id="website" placeholder="https://joesroofing.com">

          <label for="city">City</label>
          <input id="city" placeholder="Lexington">

          <label for="state">State</label>
          <input id="state" placeholder="KY">

          <label for="industry">Industry</label>
          <input id="industry" placeholder="Roofing">

          <button onclick="addSingleLine()">Add To Paste Area</button>

          <label for="bulk">Paste Prospects</label>
          <textarea id="bulk" placeholder="Company | Website | City | State | Industry"></textarea>
          <div class="hint">One prospect per line. Format: Company | Website | City | State | Industry</div>

          <button onclick="importProspects()">Import Prospects</button>
          <div id="result" class="result">Imported: 0\\nSkipped Duplicates: 0\\nErrors: 0</div>
        </div>

        <script>
          function addSingleLine() {
            const values = ['company', 'website', 'city', 'state', 'industry'].map(function(id) {
              return document.getElementById(id).value.trim();
            });
            if (!values[0]) {
              document.getElementById('result').textContent = 'Company Name is required before adding a single line.';
              return;
            }
            const textarea = document.getElementById('bulk');
            textarea.value = [textarea.value.trim(), values.join(' | ')].filter(Boolean).join('\\n');
          }

          function importProspects() {
            const result = document.getElementById('result');
            result.textContent = 'Importing...';
            google.script.run
              .withSuccessHandler(function(summary) {
                result.textContent = [
                  'Imported: ' + summary.imported,
                  'Skipped Duplicates: ' + summary.skippedDuplicates,
                  'Errors: ' + summary.errors.length,
                  summary.errors.length ? '\\nErrors:\\n- ' + summary.errors.join('\\n- ') : ''
                ].join('\\n');
              })
              .withFailureHandler(function(error) {
                result.textContent = error && error.message ? error.message : String(error);
              })
              .bulkImportProspects(document.getElementById('bulk').value);
          }
        </script>
      </body>
    </html>
  `;
}

function bulkImportProspects(rawText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const table = getHeaderTable_(sheet, ['Company']);
  const headers = table.headers;
  const existing = getExistingProspectKeys_(sheet, table);
  const lines = String(rawText || '').split(/\r?\n/).map(function(line) {
    return line.trim();
  }).filter(Boolean);
  const summary = {
    imported: 0,
    skippedDuplicates: 0,
    errors: []
  };

  lines.forEach(function(line, index) {
    try {
      const prospect = parseProspectImportLine_(line);
      if (!prospect.company) {
        summary.errors.push('Line ' + (index + 1) + ': Company Name is required.');
        return;
      }

      const companyKey = normalizeLookupKey_(prospect.company);
      const websiteKey = normalizeWebsiteKey_(prospect.website);
      if ((companyKey && existing.companies[companyKey]) || (websiteKey && existing.websites[websiteKey])) {
        summary.skippedDuplicates += 1;
        return;
      }

      appendImportedProspect_(sheet, headers, prospect);
      logPipelineActivity_(ss, prospect.company, 'Prospect Imported', 'Prospect imported via manual bulk import');
      existing.companies[companyKey] = true;
      if (websiteKey) {
        existing.websites[websiteKey] = true;
      }
      summary.imported += 1;
    } catch (error) {
      summary.errors.push('Line ' + (index + 1) + ': ' + (error && error.message ? error.message : String(error)));
    }
  });

  refreshSalesOperatingSystem_();
  return summary;
}

function parseProspectImportLine_(line) {
  const parts = String(line || '').split('|').map(function(part) {
    return part.trim();
  });
  const legacyFourPartFormat = parts.length === 4;

  return {
    company: parts[0] || '',
    website: parts[1] || '',
    city: parts[2] || '',
    state: legacyFourPartFormat ? '' : (parts[3] || ''),
    industry: legacyFourPartFormat ? (parts[3] || '') : (parts[4] || '')
  };
}

function getExistingProspectKeys_(sheet, table) {
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  const existing = {
    companies: {},
    websites: {}
  };

  if (rowCount <= 0) {
    return existing;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row) {
    const companyKey = normalizeLookupKey_(getValueByHeader_(row, table.headers, 'Company'));
    const websiteKey = normalizeWebsiteKey_(getValueByHeader_(row, table.headers, 'Website'));
    if (companyKey) {
      existing.companies[companyKey] = true;
    }
    if (websiteKey) {
      existing.websites[websiteKey] = true;
    }
  });

  return existing;
}

function appendImportedProspect_(sheet, headers, prospect) {
  const rowValues = new Array(sheet.getLastColumn()).fill('');
  const now = new Date();
  const notes = [
    prospect.city ? 'City: ' + prospect.city : '',
    prospect.state ? 'State: ' + prospect.state : '',
    prospect.industry ? 'Industry: ' + prospect.industry : ''
  ].filter(Boolean).join('\n');

  setIfHeader_(rowValues, headers, 'Company', prospect.company);
  setIfHeader_(rowValues, headers, 'Website', prospect.website);
  setIfHeader_(rowValues, headers, 'Source', 'Manual Import');
  setIfHeader_(rowValues, headers, 'Status', 'Lead Found');
  setIfHeader_(rowValues, headers, 'Priority Tier', '');
  setIfHeader_(rowValues, headers, 'Audit Score', '');
  setIfHeader_(rowValues, headers, 'Audit Outcome', '');
  setIfHeader_(rowValues, headers, 'Last Activity', now);
  setIfHeader_(rowValues, headers, 'City', prospect.city);
  setIfHeader_(rowValues, headers, 'State', prospect.state);
  setIfHeader_(rowValues, headers, 'Industry', prospect.industry);
  if (!headers.City || !headers.State || !headers.Industry) {
    setIfHeader_(rowValues, headers, 'Notes', notes);
  }

  const targetRow = Math.max(sheet.getLastRow() + 1, findBestHeaderRow_(sheet) + 1);
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
}

function buildProspectWorkspaceData_(context) {
  const headers = context.table.headers;
  const values = context.values;
  const prospect = {
    company: getValueByHeader_(values, headers, 'Company'),
    contact: getValueByHeader_(values, headers, 'Contact'),
    email: getValueByHeader_(values, headers, 'Email'),
    phone: getValueByHeader_(values, headers, 'Phone'),
    website: getValueByHeader_(values, headers, 'Website'),
    city: getValueByHeader_(values, headers, 'City'),
    state: getValueByHeader_(values, headers, 'State'),
    industry: getValueByHeader_(values, headers, 'Industry'),
    auditScore: getValueByHeader_(values, headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(values, headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(values, headers, 'Priority Tier'),
    offerService: getValueByHeader_(values, headers, 'Offer / Service'),
    status: getValueByHeader_(values, headers, 'Status'),
    lastActivity: getValueByHeader_(values, headers, 'Last Activity'),
    followUpDate: getValueByHeader_(values, headers, 'Follow-Up Date'),
    nextAction: getValueByHeader_(values, headers, 'Next Action')
  };

  return {
    prospect: prospect,
    client: getClientInfoForProspect_(context.ss, prospect),
    activity: getRecentActivityForCompany_(context.ss, prospect.company, 10)
  };
}

function getClientInfoForProspect_(ss, prospect) {
  const sheet = ss.getSheetByName(CLIENTS_SHEET);
  if (!sheet) {
    return null;
  }

  const table = ensureClientColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return null;
  }

  const companyKey = normalizeLookupKey_(prospect.company);
  const websiteKey = normalizeWebsiteKey_(prospect.website);
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const existingCompany = normalizeLookupKey_(row[table.headers['Client Name'] - 1] || (table.headers.Client ? row[table.headers.Client - 1] : ''));
    const existingWebsite = normalizeWebsiteKey_(row[table.headers.Website - 1]);

    if ((companyKey && existingCompany === companyKey) || (websiteKey && existingWebsite === websiteKey)) {
      return {
        contractValue: row[table.headers['Contract Value'] - 1],
        clientSince: row[table.headers['Client Since'] - 1],
        status: row[table.headers.Status - 1]
      };
    }
  }

  return null;
}

function getRecentActivityForCompany_(ss, company, limit) {
  const sheet = ss.getSheetByName(ACTIVITY_FEED_SHEET);
  if (!sheet) {
    return [];
  }

  const table = getHeaderTable_(sheet, ['Date', 'Company', 'Activity Type', 'Activity Notes']);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const companyKey = normalizeLookupKey_(company);
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();

  return values
    .map(function(row) {
      return {
        date: row[table.headers.Date - 1],
        company: row[table.headers.Company - 1],
        activityType: row[table.headers['Activity Type'] - 1],
        notes: row[table.headers['Activity Notes'] - 1]
      };
    })
    .filter(function(activity) {
      return normalizeLookupKey_(activity.company) === companyKey;
    })
    .sort(function(a, b) {
      return dateSortValue_(b.date) - dateSortValue_(a.date);
    })
    .slice(0, limit);
}

function buildProspectWorkspaceHtml_(workspace) {
  const prospect = workspace.prospect;
  const client = workspace.client;
  const activityRows = workspace.activity.length
    ? workspace.activity.map(function(activity) {
      return `
        <div class="activity">
          <div class="activity-top">
            <strong>${escapeHtml_(activity.activityType || 'Activity')}</strong>
            <span>${escapeHtml_(formatDisplayDate_(activity.date))}</span>
          </div>
          <p>${escapeHtml_(activity.notes || '')}</p>
        </div>
      `;
    }).join('')
    : '<p class="muted">No activity recorded yet.</p>';

  const clientHtml = client
    ? `
      <div class="grid">
        ${workspaceFieldHtml_('Contract Value', formatCurrency_(client.contractValue))}
        ${workspaceFieldHtml_('Client Since', formatDisplayDate_(client.clientSince))}
        ${workspaceFieldHtml_('Client Status', client.status)}
      </div>
    `
    : '<p class="muted">No active client record found.</p>';

  return `
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            margin: 0;
            background: #111111;
            color: #f7f3ea;
            font-family: Arial, Helvetica, sans-serif;
          }
          .wrap {
            padding: 18px;
          }
          .brand {
            border-bottom: 2px solid #b88728;
            margin-bottom: 16px;
            padding-bottom: 12px;
          }
          .brand span {
            color: #d8ad4d;
            display: block;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.8px;
            text-transform: uppercase;
          }
          h1 {
            margin: 4px 0 0;
            color: #ffffff;
            font-size: 21px;
            line-height: 1.2;
          }
          h2 {
            margin: 20px 0 10px;
            color: #d8ad4d;
            font-size: 12px;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }
          .section {
            border: 1px solid rgba(184, 135, 40, .45);
            background: #181818;
            padding: 12px;
            margin-bottom: 12px;
          }
          .grid {
            display: grid;
            gap: 8px;
          }
          .field {
            border-bottom: 1px solid rgba(255,255,255,.09);
            padding-bottom: 7px;
          }
          .label {
            color: #a8a8a8;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .value {
            color: #ffffff;
            font-size: 13px;
            margin-top: 3px;
            overflow-wrap: anywhere;
          }
          .actions {
            display: grid;
            gap: 8px;
            margin: 14px 0;
          }
          button {
            min-height: 38px;
            border: 1px solid #b88728;
            background: #b88728;
            color: #111111;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          button.secondary {
            background: transparent;
            color: #f7f3ea;
          }
          .activity {
            border-left: 3px solid #b88728;
            background: #202020;
            margin-bottom: 8px;
            padding: 9px 10px;
          }
          .activity-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #ffffff;
            font-size: 12px;
          }
          .activity-top span {
            color: #bfb6a4;
            white-space: nowrap;
          }
          .activity p,
          .muted {
            color: #d6d0c6;
            font-size: 12px;
            line-height: 1.45;
            margin: 6px 0 0;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="brand">
            <span>Rogers Holdings OS</span>
            <h1>${escapeHtml_(prospect.company)}</h1>
          </div>

          <div class="actions">
            <button onclick="runAction('workspaceRunRealWebsiteAudit')">Run Real Website Audit</button>
            <button onclick="runAction('workspaceRunWebsiteAudit')">Quick Internal Audit</button>
            <button onclick="runAction('workspaceGenerateAuditPackage')">Generate Audit Package</button>
            <button onclick="runAction('workspaceCreateGmailDraft')">Create Gmail Draft</button>
            <button onclick="runAction('workspaceGenerateProposal')" class="secondary">Generate Proposal</button>
            <button onclick="runAction('workspaceMarkEmailSent')" class="secondary">Mark Email Sent</button>
            <button onclick="runAction('workspaceMarkFollowUpComplete')" class="secondary">Mark Follow-Up Complete</button>
            <button onclick="runAction('workspaceConvertToClient')" class="secondary">Convert To Client</button>
          </div>

          <h2>Company</h2>
          <div class="section grid">
            ${workspaceFieldHtml_('Company', prospect.company)}
            ${workspaceFieldHtml_('Contact', prospect.contact)}
            ${workspaceFieldHtml_('Email', prospect.email)}
            ${workspaceFieldHtml_('Phone', prospect.phone)}
            ${workspaceFieldHtml_('Website', prospect.website)}
            ${workspaceFieldHtml_('City', prospect.city)}
            ${workspaceFieldHtml_('State', prospect.state)}
            ${workspaceFieldHtml_('Industry', prospect.industry)}
          </div>

          <h2>Audit</h2>
          <div class="section grid">
            ${workspaceFieldHtml_('Audit Score', prospect.auditScore)}
            ${workspaceFieldHtml_('Audit Outcome', prospect.auditOutcome)}
            ${workspaceFieldHtml_('Priority Tier', prospect.priorityTier)}
            ${workspaceFieldHtml_('Offer / Service', prospect.offerService)}
          </div>

          <h2>Pipeline</h2>
          <div class="section grid">
            ${workspaceFieldHtml_('Status', prospect.status)}
            ${workspaceFieldHtml_('Last Activity', formatDisplayDate_(prospect.lastActivity))}
            ${workspaceFieldHtml_('Follow-Up Date', formatDisplayDate_(prospect.followUpDate))}
            ${workspaceFieldHtml_('Next Action', prospect.nextAction)}
          </div>

          <h2>Client Info</h2>
          <div class="section">${clientHtml}</div>

          <h2>Activity History</h2>
          <div class="section">${activityRows}</div>
        </div>

        <script>
          function runAction(actionName) {
            google.script.run
              .withFailureHandler(function(error) {
                alert(error && error.message ? error.message : error);
              })[actionName]();
          }
        </script>
      </body>
    </html>
  `;
}

function workspaceFieldHtml_(label, value) {
  return `
    <div class="field">
      <div class="label">${escapeHtml_(label)}</div>
      <div class="value">${escapeHtml_(formatWorkspaceValue_(value))}</div>
    </div>
  `;
}

function workspaceCreateGmailDraft() {
  createOutreachGmailDraft();
}

function workspaceRunWebsiteAudit() {
  runWebsiteAudit();
}

function workspaceRunRealWebsiteAudit() {
  runRealWebsiteAudit();
}

function workspaceGenerateAuditPackage() {
  generateAuditPackage();
}

function workspaceGenerateProposal() {
  generateProposal();
}

function workspaceMarkEmailSent() {
  markEmailSent();
}

function workspaceMarkFollowUpComplete() {
  markFollowUpComplete();
}

function workspaceConvertToClient() {
  convertToClient();
}

function ensureAuditPackageColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    return null;
  }

  return ensureSheetColumns_(sheet, [
    'Audit Package Generated',
    'Audit Package Date'
  ]).headers;
}

function standardizeMasterProspectTrackerColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    return {
      changed: false,
      error: `Required sheet not found: "${MASTER_PROSPECT_SHEET}".`
    };
  }

  let table = getHealthHeaderTable_(sheet);
  if (!table.headers.Website) {
    return {
      changed: false,
      error: 'Website header not found on Master Prospect Tracker.'
    };
  }

  let changed = false;
  let anchorHeader = 'Website';
  MASTER_PROSPECT_STANDARD_ORDER_AFTER_WEBSITE.forEach(function(header) {
    table = getHealthHeaderTable_(sheet);
    const result = placeMasterProspectColumnAfter_(sheet, table, header, anchorHeader);
    changed = changed || result.changed;
    anchorHeader = header;
  });

  const duplicateResult = renameDuplicateMasterProspectStandardHeaders_(sheet);
  changed = changed || duplicateResult.changed;

  return {
    changed: changed,
    headerOrder: getMasterProspectHeaderOrderAroundWebsite_(sheet)
  };
}

function placeMasterProspectColumnAfter_(sheet, table, header, anchorHeader) {
  const anchorColumn = table.headers[anchorHeader];
  if (!anchorColumn) {
    return {
      changed: false
    };
  }

  const sourceColumn = table.headers[header];
  if (!sourceColumn) {
    sheet.insertColumnAfter(anchorColumn);
    sheet.getRange(table.headerRow, anchorColumn + 1).setValue(header);
    return {
      changed: true
    };
  }

  if (sourceColumn === anchorColumn + 1) {
    return {
      changed: false
    };
  }

  sheet.insertColumnAfter(anchorColumn);
  const targetColumn = anchorColumn + 1;
  const adjustedSourceColumn = sourceColumn > anchorColumn ? sourceColumn + 1 : sourceColumn;
  const rowCount = Math.max(sheet.getMaxRows(), table.headerRow);

  sheet
    .getRange(1, adjustedSourceColumn, rowCount, 1)
    .moveTo(sheet.getRange(1, targetColumn, rowCount, 1));
  sheet.deleteColumn(adjustedSourceColumn);

  return {
    changed: true
  };
}

function renameDuplicateMasterProspectStandardHeaders_(sheet) {
  const table = getHealthHeaderTable_(sheet);
  const standardHeaders = MASTER_PROSPECT_STANDARD_ORDER_AFTER_WEBSITE.reduce(function(result, header) {
    result[header] = true;
    return result;
  }, {});
  const headerValues = sheet.getRange(table.headerRow, 1, 1, table.lastColumn).getDisplayValues()[0];
  const counts = {};
  let changed = false;

  headerValues.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (!standardHeaders[header]) {
      return;
    }

    counts[header] = counts[header] || 0;
    counts[header] += 1;

    if (counts[header] > 1) {
      sheet.getRange(table.headerRow, index + 1).setValue(nextAvailableHeaderName_(table.headers, header + ' Duplicate'));
      changed = true;
    }
  });

  return {
    changed: changed
  };
}

function nextAvailableHeaderName_(headers, baseName) {
  if (!headers[baseName]) {
    headers[baseName] = true;
    return baseName;
  }

  let index = 2;
  while (headers[baseName + ' ' + index]) {
    index += 1;
  }

  headers[baseName + ' ' + index] = true;
  return baseName + ' ' + index;
}

function getMasterProspectHeaderOrderAroundWebsite_(sheet) {
  const table = getHealthHeaderTable_(sheet);
  const expected = [
    'Company',
    'Contact',
    'Email',
    'Phone',
    'Website',
    'City',
    'State',
    'Industry',
    'Source'
  ];

  return expected.map(function(header) {
    return table.headers[header] ? header : '';
  }).filter(Boolean).join(' | ');
}

function ensureSheetColumns_(sheet, columns) {
  const headerRow = findBestHeaderRow_(sheet);
  let lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headerValues = sheet.getRange(headerRow, 1, 1, lastColumn).getDisplayValues()[0];
  const headers = {};

  headerValues.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (header && !headers[header]) {
      headers[header] = index + 1;
    }
  });

  columns.forEach(function(column) {
    if (headers[column]) {
      return;
    }

    lastColumn += 1;
    sheet.getRange(headerRow, lastColumn).setValue(column);
    headers[column] = lastColumn;
  });

  return {
    headerRow: headerRow,
    headers: headers,
    lastColumn: lastColumn
  };
}

function findBestHeaderRow_(sheet) {
  const maxRowsToScan = Math.min(10, sheet.getMaxRows());
  const maxColumns = Math.max(sheet.getLastColumn(), 1);
  const rows = sheet.getRange(1, 1, maxRowsToScan, maxColumns).getDisplayValues();
  let bestRow = 1;
  let bestCount = 0;

  rows.forEach(function(row, index) {
    const count = row.filter(function(value) {
      return String(value || '').trim() !== '';
    }).length;

    if (count > bestCount) {
      bestCount = count;
      bestRow = index + 1;
    }
  });

  return bestRow;
}

function normalizeLookupKey_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeWebsiteKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim();
}

function setSelectedProspectTerminalStage_(stage, activityType, activityNotes) {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  setProspectStatus_(context.sheet, context.table.headers, context.selectedRow, stage);
  updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
  logPipelineActivity_(context.ss, context.prospect.company, activityType, activityNotes);
  let clientMessage = '';
  if (stage === 'Won') {
    const clientResult = convertWonProspectToClient_(context);
    clientMessage = clientResult.created
      ? `\n\nClient record created: ${clientResult.clientId}`
      : `\n\nClient record updated: ${clientResult.clientId}`;
  }
  refreshSalesOperatingSystem_();

  SpreadsheetApp.getUi().alert('Rogers Holdings OS', `Prospect marked ${stage}.${clientMessage}`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function getSelectedProspectContext_(requiredHeaders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();

  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
    ui.alert('Rogers Holdings OS', 'Select a prospect row on the Master Prospect Tracker sheet first.', ui.ButtonSet.OK);
    return null;
  }

  const selectedRow = sheet.getActiveRange().getRow();
  const table = getHeaderTable_(sheet, requiredHeaders || ['Company']);

  if (selectedRow <= table.headerRow) {
    ui.alert('Rogers Holdings OS', 'Select a data row below the Master Prospect Tracker header row.', ui.ButtonSet.OK);
    return null;
  }

  const values = sheet.getRange(selectedRow, 1, 1, table.lastColumn).getValues()[0];
  const prospect = {
    company: getValueByHeader_(values, table.headers, 'Company'),
    status: getValueByHeader_(values, table.headers, 'Status')
  };

  if (!prospect.company) {
    ui.alert('Rogers Holdings OS', 'The selected row does not have a Company value.', ui.ButtonSet.OK);
    return null;
  }

  return {
    ss: ss,
    sheet: sheet,
    table: table,
    selectedRow: selectedRow,
    values: values,
    prospect: prospect
  };
}

function normalizePipelineStage_(stage) {
  const value = String(stage || '').trim().toLowerCase();
  const match = PIPELINE_STAGES.filter(function(candidate) {
    return candidate.toLowerCase() === value;
  })[0];
  return match || '';
}

function getNextPipelineStage_(currentStage) {
  if (!currentStage) {
    return PIPELINE_STAGES[0];
  }

  if (currentStage === 'Won' || currentStage === 'Lost') {
    return currentStage;
  }

  const index = PIPELINE_STAGES.indexOf(currentStage);
  if (index === -1 || index >= PIPELINE_STAGES.length - 1) {
    return PIPELINE_STAGES[0];
  }

  return PIPELINE_STAGES[index + 1];
}

function setProspectStatus_(sheet, headers, selectedRow, status) {
  if (!headers.Status) {
    throw new Error('Status header not found on Master Prospect Tracker.');
  }

  sheet.getRange(selectedRow, headers.Status).setValue(status);
}

function setProspectStatusIfHeader_(sheet, headers, selectedRow, status) {
  if (!headers.Status) {
    return;
  }

  sheet.getRange(selectedRow, headers.Status).setValue(status);
}

function logPipelineActivity_(ss, company, activityType, activityNotes) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, [
    'Date',
    'Company',
    'Activity Type',
    'Activity Notes'
  ]);

  const rowValues = new Array(table.lastColumn).fill('');
  setIfHeader_(rowValues, table.headers, 'Date', new Date());
  setIfHeader_(rowValues, table.headers, 'Company', company);
  setIfHeader_(rowValues, table.headers, 'Activity Type', activityType);
  setIfHeader_(rowValues, table.headers, 'Activity Notes', activityNotes);

  const targetRow = Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
}

function getHeaderTable_(sheet, requiredHeaders) {
  const maxRowsToScan = Math.min(10, sheet.getMaxRows());
  const maxColumns = sheet.getLastColumn();
  const rows = sheet.getRange(1, 1, maxRowsToScan, maxColumns).getDisplayValues();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const headers = {};
    rows[rowIndex].forEach(function(value, colIndex) {
      const header = String(value || '').trim();
      if (header && !headers[header]) {
        headers[header] = colIndex + 1;
      }
    });

    const missing = requiredHeaders.filter(function(header) {
      return !headers[header];
    });

    if (missing.length === 0) {
      return {
        headerRow: rowIndex + 1,
        headers: headers,
        lastColumn: maxColumns
      };
    }
  }

  throw new Error(
    `Required headers not found on sheet "${sheet.getName()}": ${requiredHeaders.join(', ')}`
  );
}

function getRequiredSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Required sheet not found: "${sheetName}".`);
  }
  return sheet;
}

function updatePipelineDashboardMetrics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prospectSheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  const metricsSheet = ss.getSheetByName(DASHBOARD_METRICS_SHEET);

  if (!prospectSheet || !metricsSheet) {
    return;
  }

  const table = getHeaderTable_(prospectSheet, ['Company', 'Status']);
  const dataStartRow = table.headerRow + 1;
  const lastRow = prospectSheet.getLastRow();
  const rowCount = Math.max(lastRow - dataStartRow + 1, 0);
  const statusCounts = {};
  let totalLeads = 0;
  let followUpsDueToday = 0;
  let overdueFollowUps = 0;
  const today = startOfDay_(new Date());

  PIPELINE_STAGES.forEach(function(stage) {
    statusCounts[stage] = 0;
  });

  if (rowCount > 0) {
    const values = prospectSheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
    values.forEach(function(row) {
      const company = String(row[table.headers.Company - 1] || '').trim();
      if (!company) {
        return;
      }

      totalLeads += 1;
      const status = normalizePipelineStage_(row[table.headers.Status - 1]);
      if (status) {
        statusCounts[status] += 1;
      }

      if (table.headers['Follow-Up Date']) {
        const followUpDate = dateValueOrNull_(row[table.headers['Follow-Up Date'] - 1]);
        if (followUpDate) {
          const normalizedFollowUp = startOfDay_(followUpDate);
          if (normalizedFollowUp.getTime() === today.getTime()) {
            followUpsDueToday += 1;
          } else if (normalizedFollowUp.getTime() < today.getTime()) {
            overdueFollowUps += 1;
          }
        }
      }
    });
  }

  const followUpsCompleted = countActivityTypes_(['Follow-Up Completed', 'Follow Up Completed']);
  const discoveryCallsScheduled = countActivityType_('Discovery Call Scheduled');
  const auditPackagesGenerated = countActivityType_('Audit Package Generated');
  const auditPackagesSent = countActivityType_('Audit Package Sent');
  const auditsCompletedToday = countActivityTypesToday_(['Website Audit Tool', 'Website Audit']);
  const packagesGeneratedToday = countActivityTypeToday_('Audit Package Generated');
  const clientMetrics = getClientRevenueMetrics_();
  const wonDeals = statusCounts.Won || 0;
  const lostDeals = statusCounts.Lost || 0;
  const decidedDeals = wonDeals + lostDeals;
  const winRate = decidedDeals ? wonDeals / decidedDeals : 0;
  const rows = [
    ['Metric', 'Value', 'Updated At'],
    ['Total Leads', totalLeads, new Date()],
    ['Audits Completed', statusCounts['Audit Complete'], new Date()],
    ['Audits Completed Today', auditsCompletedToday, new Date()],
    ['Drafts Created', statusCounts['Draft Created'], new Date()],
    ['Emails Sent', statusCounts['Email Sent'], new Date()],
    ['Proposals Sent', statusCounts['Proposal Sent'], new Date()],
    ['Won Deals', wonDeals, new Date()],
    ['Lost Deals', lostDeals, new Date()],
    ['Win Rate %', winRate, new Date()],
    ['Follow-Ups Due Today', followUpsDueToday, new Date()],
    ['Overdue Follow-Ups', overdueFollowUps, new Date()],
    ['Follow-Ups Completed', followUpsCompleted, new Date()],
    ['Discovery Calls Scheduled', discoveryCallsScheduled, new Date()],
    ['Audit Packages Generated', auditPackagesGenerated, new Date()],
    ['Packages Generated Today', packagesGeneratedToday, new Date()],
    ['Audit Packages Sent', auditPackagesSent, new Date()],
    ['Total Clients', clientMetrics.totalClients, new Date()],
    ['Active Clients', clientMetrics.activeClients, new Date()],
    ['Total Revenue', clientMetrics.totalRevenue, new Date()],
    ['Average Deal Size', clientMetrics.averageDealSize, new Date()],
    ['Clients This Month', clientMetrics.clientsThisMonth, new Date()],
    ['Revenue This Month', clientMetrics.revenueThisMonth, new Date()]
  ];

  metricsSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  metricsSheet.getRange(10, 2).setNumberFormat('0.00%');
  metricsSheet.getRange(20, 2, 1, 1).setNumberFormat('$#,##0.00');
  metricsSheet.getRange(21, 2, 1, 1).setNumberFormat('$#,##0.00');
  metricsSheet.getRange(23, 2, 1, 1).setNumberFormat('$#,##0.00');
}

function refreshExecutiveDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboardSheet = ss.getSheetByName('Executive Dashboard');
  if (!dashboardSheet) {
    return;
  }

  const data = buildExecutiveDashboardData_(ss);
  data.dashboardSheet = dashboardSheet;
  prepareExecutiveDashboardSheet_(dashboardSheet);
  updateDashboardKPIs_(data);
  updatePipelineSummary_(data);
  updateRecentActivity_(data);
  updateFollowUpQueue_(data);
  updateTopOpportunities_(data);
  updateQuickActions_(data);
  updateSystemStatus_(data);
  applyExecutiveDashboardBranding_(dashboardSheet);
}

function buildExecutiveDashboardData_(ss) {
  const prospectSheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  const activitySheet = ss.getSheetByName(ACTIVITY_FEED_SHEET);
  const today = startOfDay_(new Date());
  const data = {
    ss: ss,
    generatedAt: new Date(),
    today: today,
    prospects: [],
    activities: [],
    statusCounts: {},
    totalProspects: 0,
    followUpsDueToday: 0,
    overdueFollowUps: 0,
    averageAuditScore: 0,
    clientMetrics: getClientRevenueMetrics_()
  };

  PIPELINE_STAGES.forEach(function(stage) {
    data.statusCounts[stage] = 0;
  });

  if (prospectSheet) {
    const table = getHeaderTable_(prospectSheet, ['Company']);
    const dataStartRow = table.headerRow + 1;
    const rowCount = Math.max(prospectSheet.getLastRow() - dataStartRow + 1, 0);
    let auditScoreTotal = 0;
    let auditScoreCount = 0;

    if (rowCount > 0) {
      const values = prospectSheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
      values.forEach(function(row, index) {
        const company = String(getValueByHeader_(row, table.headers, 'Company') || '').trim();
        if (!company) {
          return;
        }

        const status = normalizePipelineStage_(getValueByHeader_(row, table.headers, 'Status'));
        const followUpDate = table.headers['Follow-Up Date']
          ? dateValueOrNull_(getValueByHeader_(row, table.headers, 'Follow-Up Date'))
          : null;
        const lastActivity = table.headers['Last Activity']
          ? dateValueOrNull_(getValueByHeader_(row, table.headers, 'Last Activity'))
          : null;
        const auditScoreRaw = getValueByHeader_(row, table.headers, 'Audit Score');
        const auditScore = Number(auditScoreRaw);
        const record = {
          rowNumber: dataStartRow + index,
          company: company,
          contact: getValueByHeader_(row, table.headers, 'Contact'),
          email: getValueByHeader_(row, table.headers, 'Email'),
          website: getValueByHeader_(row, table.headers, 'Website'),
          status: status || String(getValueByHeader_(row, table.headers, 'Status') || '').trim(),
          nextAction: getValueByHeader_(row, table.headers, 'Next Action'),
          priorityTier: getValueByHeader_(row, table.headers, 'Priority Tier'),
          auditScore: Number.isNaN(auditScore) ? '' : auditScore,
          followUpDate: followUpDate,
          lastActivity: lastActivity
        };

        data.prospects.push(record);
        data.totalProspects += 1;
        if (status) {
          data.statusCounts[status] = (data.statusCounts[status] || 0) + 1;
        }
        if (!Number.isNaN(auditScore)) {
          auditScoreTotal += auditScore;
          auditScoreCount += 1;
        }
        if (followUpDate) {
          const normalizedFollowUp = startOfDay_(followUpDate);
          if (normalizedFollowUp.getTime() === today.getTime()) {
            data.followUpsDueToday += 1;
          } else if (normalizedFollowUp.getTime() < today.getTime()) {
            data.overdueFollowUps += 1;
          }
        }
      });
    }

    data.averageAuditScore = auditScoreCount ? auditScoreTotal / auditScoreCount : 0;
  }

  if (activitySheet) {
    const table = getHeaderTable_(activitySheet, ['Date', 'Company', 'Activity Type']);
    const dataStartRow = table.headerRow + 1;
    const rowCount = Math.max(activitySheet.getLastRow() - dataStartRow + 1, 0);
    if (rowCount > 0) {
      const values = activitySheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
      data.activities = values.map(function(row) {
        return {
          timestamp: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Date')),
          company: getValueByHeader_(row, table.headers, 'Company'),
          activity: getValueByHeader_(row, table.headers, 'Activity Type'),
          user: getValueByHeader_(row, table.headers, 'User') || getValueByHeader_(row, table.headers, 'Owner') || ''
        };
      }).filter(function(activity) {
        return activity.timestamp || activity.company || activity.activity;
      }).sort(function(a, b) {
        return dateSortValue_(b.timestamp) - dateSortValue_(a.timestamp);
      });
    }
  }

  return data;
}

function prepareExecutiveDashboardSheet_(sheet) {
  ensureExecutiveDashboardSize_(sheet, 80, 12);
  sheet.getRange(1, 1, 80, 12).clearContent().clearFormat();
  sheet.setHiddenGridlines(true);
  safeSetFrozenRows_(sheet, 2);
  sheet.setTabColor(ROGERS_OS_THEME.black);
  sheet.setColumnWidths(1, 12, 125);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 170);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 230);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 170);
  sheet.setColumnWidth(9, 140);
  sheet.setColumnWidth(10, 120);
  sheet.setColumnWidth(11, 150);
  sheet.setColumnWidth(12, 125);
  sheet.setRowHeights(1, 80, 30);
  sheet.setRowHeight(1, 38);
  sheet.setRowHeight(2, 32);
  sheet.setRowHeights(3, 8, 36);
  sheet.setRowHeights(12, 18, 30);
  sheet.setRowHeights(32, 16, 32);
}

function ensureExecutiveDashboardSize_(sheet, minRows, minColumns) {
  const currentRows = sheet.getMaxRows();
  const currentColumns = sheet.getMaxColumns();
  if (currentRows < minRows) {
    sheet.insertRowsAfter(currentRows, minRows - currentRows);
  }
  if (currentColumns < minColumns) {
    sheet.insertColumnsAfter(currentColumns, minColumns - currentColumns);
  }
}

function updateDashboardKPIs_(data) {
  const sheet = data.dashboardSheet;
  const rows = [
    ['ROGERS HOLDINGS OS', '', '', '', '', '', '', '', '', '', '', ''],
    ['EXECUTIVE DASHBOARD', 'Last Refresh', data.generatedAt, '', '', '', '', '', '', '', '', ''],
    ['Total Prospects', '', '', 'Leads Found', '', '', 'Draft Created', '', '', 'Proposal Sent', '', ''],
    [data.totalProspects, '', '', data.statusCounts['Lead Found'] || 0, '', '', data.statusCounts['Draft Created'] || 0, '', '', data.statusCounts['Proposal Sent'] || 0, '', ''],
    ['Audit Package Sent', '', '', 'Discovery Scheduled', '', '', 'Won', '', '', 'Lost', '', ''],
    [data.statusCounts['Audit Package Sent'] || 0, '', '', data.statusCounts['Discovery Scheduled'] || 0, '', '', data.statusCounts.Won || 0, '', '', data.statusCounts.Lost || 0, '', ''],
    ['Follow-Ups Due Today', '', '', 'Overdue Follow-Ups', '', '', 'Average Audit Score', '', '', 'Total Clients', '', ''],
    [data.followUpsDueToday, '', '', data.overdueFollowUps, '', '', data.averageAuditScore, '', '', data.clientMetrics.totalClients || 0, '', ''],
    ['Active Clients', '', '', 'New Clients This Month', '', '', 'Active Projects', '', '', '', '', ''],
    [data.clientMetrics.activeClients || 0, '', '', data.clientMetrics.clientsThisMonth || 0, '', '', data.clientMetrics.activeProjects || 0, '', '', '', '', '']
  ];

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(2, 3).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(4, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(6, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(8, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(8, 7).setNumberFormat('0.0');
  sheet.getRange(10, 1, 1, 12).setNumberFormat('0');
}

function updatePipelineSummary_(data) {
  const sheet = data.dashboardSheet;
  const stages = [
    'Lead Found',
    'Audit Complete',
    'Draft Created',
    'Email Sent',
    'Follow Up Due',
    'Proposal Sent',
    'Discovery Scheduled',
    'Won',
    'Lost'
  ];
  const rows = [
    ['SALES PIPELINE', '', ''],
    ['Stage', 'Count', 'Percent']
  ].concat(stages.map(function(stage) {
    const count = data.statusCounts[stage] || 0;
    return [stage, count, data.totalProspects ? count / data.totalProspects : 0];
  }));

  sheet.getRange(12, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(14, 2, stages.length, 1).setNumberFormat('0');
  sheet.getRange(14, 3, stages.length, 1).setNumberFormat('0.0%');
}

function updateRecentActivity_(data) {
  const sheet = data.dashboardSheet;
  const rows = [
    ['RECENT ACTIVITY', '', '', ''],
    ['Timestamp', 'Company', 'Activity', 'User']
  ].concat(data.activities.slice(0, 15).map(function(activity) {
    return [
      activity.timestamp || '',
      activity.company || '',
      activity.activity || '',
      activity.user || ''
    ];
  }));

  sheet.getRange(12, 5, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(14, 5, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
}

function updateFollowUpQueue_(data) {
  const sheet = data.dashboardSheet;
  const today = data.today.getTime();
  const queue = data.prospects.filter(function(prospect) {
    return prospect.followUpDate;
  }).map(function(prospect) {
    const followUpTime = startOfDay_(prospect.followUpDate).getTime();
    let bucket = 2;
    if (followUpTime < today) {
      bucket = 0;
    } else if (followUpTime === today) {
      bucket = 1;
    }
    return Object.assign({}, prospect, { bucket: bucket, followUpTime: followUpTime });
  }).sort(function(a, b) {
    if (a.bucket !== b.bucket) {
      return a.bucket - b.bucket;
    }
    return a.followUpTime - b.followUpTime;
  });
  const rows = [
    ['FOLLOW-UP QUEUE', '', '', '', '', '', ''],
    ['Company', 'Contact', 'Email', 'Status', 'Follow-Up Date', 'Next Action', 'Last Activity']
  ].concat(queue.slice(0, 12).map(function(item) {
    return [
      item.company,
      item.contact,
      item.email,
      item.status,
      item.followUpDate || '',
      item.nextAction,
      item.lastActivity || ''
    ];
  }));

  sheet.getRange(32, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(34, 5, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(34, 7, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
  applyFollowUpQueueStatusColors_(sheet, queue.slice(0, 12), 34, 1, 7);
}

function updateTopOpportunities_(data) {
  const sheet = data.dashboardSheet;
  const priorityRank = {
    'A - Hot': 1,
    A: 1,
    'B - Good': 2,
    B: 2,
    'C - Later': 3,
    C: 3
  };
  const rows = [
    ['TOP OPPORTUNITIES', '', '', '', ''],
    ['Company', 'Priority', 'Audit Score', 'Status', 'Last Activity']
  ].concat(data.prospects.slice().sort(function(a, b) {
    const rankA = priorityRank[String(a.priorityTier || '').trim()] || 9;
    const rankB = priorityRank[String(b.priorityTier || '').trim()] || 9;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const scoreDiff = (Number(b.auditScore) || 0) - (Number(a.auditScore) || 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return dateSortValue_(b.lastActivity) - dateSortValue_(a.lastActivity);
  }).slice(0, 10).map(function(item) {
    return [item.company, item.priorityTier, item.auditScore, item.status, item.lastActivity || ''];
  }));

  sheet.getRange(32, 8, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(34, 10, Math.max(rows.length - 2, 1), 1).setNumberFormat('0.0');
  sheet.getRange(34, 12, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
}

function updateQuickActions_(data) {
  const sheet = data.dashboardSheet;
  const rows = [
    ['QUICK ACTIONS', '', ''],
    ['Run Full Prospect Package', 'Create Gmail Draft', 'Generate Audit Package'],
    ['Run Website Audit', 'System Health Check', 'Refresh Dashboard']
  ];

  sheet.getRange(52, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(53, 1, 2, 3).setNotes([
    ['Use Rogers Holdings OS > Run Full Prospect Package', 'Use Rogers Holdings OS > Create Outreach Gmail Draft', 'Use Rogers Holdings OS > Generate Audit Package'],
    ['Use Rogers Holdings OS > Run Real Website Audit', 'Use Rogers Holdings OS > System Health Check', 'Use Rogers Holdings OS > Refresh Executive Dashboard']
  ]);
}

function updateSystemStatus_(data) {
  const sheet = data.dashboardSheet;
  const properties = PropertiesService.getScriptProperties();
  const lastHealthCheck = properties.getProperty('ROGERS_OS_LAST_HEALTH_CHECK_AT') || '';
  const healthResult = properties.getProperty('ROGERS_OS_LAST_HEALTH_CHECK_RESULT') || 'Not Run';
  const gmailStatus = properties.getProperty('ROGERS_OS_LAST_GMAIL_STATUS') || 'Unknown';
  const driveStatus = properties.getProperty('ROGERS_OS_LAST_DRIVE_STATUS') || 'Unknown';
  const pdfStatus = properties.getProperty('ROGERS_OS_LAST_PDF_STATUS') || 'Unknown';
  const rows = [
    ['SYSTEM STATUS', '', ''],
    ['Last Dashboard Refresh', data.generatedAt, 'Pass'],
    ['Last Health Check', lastHealthCheck, healthResult],
    ['Gmail Status', gmailStatus, gmailStatus],
    ['Drive Status', driveStatus, driveStatus],
    ['PDF Engine Status', pdfStatus, pdfStatus]
  ];

  sheet.getRange(52, 5, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(53, 6, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(54, 6, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  applySystemStatusColors_(sheet, 53, 7, rows.slice(1).map(function(row) { return row[2]; }));
}

function applyExecutiveDashboardBranding_(sheet) {
  const black = ROGERS_OS_THEME.black;
  const gold = ROGERS_OS_THEME.gold;
  const white = ROGERS_OS_THEME.white;
  const neutral = ROGERS_OS_THEME.softNeutral;
  const text = ROGERS_OS_THEME.text;
  const border = ROGERS_OS_THEME.border;

  sheet.getRange(1, 1, 80, 12)
    .setFontFamily('Arial')
    .setFontColor(text)
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.getRange(1, 1, 2, 12)
    .setBackground(black)
    .setFontColor(gold)
    .setFontWeight('bold')
    .setBorder(false, false, true, false, false, false, gold, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.getRange(1, 1).setFontSize(18);
  sheet.getRange(2, 1, 1, 12).setFontColor(white);

  [
    [12, 1, 1, 3],
    [12, 5, 1, 4],
    [32, 1, 1, 7],
    [32, 8, 1, 5],
    [52, 1, 1, 3],
    [52, 5, 1, 3]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .setBackground(black)
      .setFontColor(gold)
      .setFontWeight('bold')
      .setFontSize(11)
      .setBorder(false, false, true, false, false, false, gold, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  [
    [3, 1, 2, 3],
    [3, 4, 2, 3],
    [3, 7, 2, 3],
    [3, 10, 2, 3],
    [5, 1, 2, 3],
    [5, 4, 2, 3],
    [5, 7, 2, 3],
    [5, 10, 2, 3],
    [7, 1, 2, 3],
    [7, 4, 2, 3],
    [7, 7, 2, 3],
    [7, 10, 2, 3],
    [9, 1, 2, 3],
    [9, 4, 2, 3],
    [9, 7, 2, 3]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .setBackground(neutral)
      .setFontColor(text)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, border, SpreadsheetApp.BorderStyle.SOLID);
  });

  [3, 5, 7, 9].forEach(function(row) {
    sheet.getRange(row, 1, 1, 12)
      .setFontSize(9)
      .setFontColor('#5f5b52')
      .setHorizontalAlignment('center');
  });
  [4, 6, 8, 10].forEach(function(row) {
    sheet.getRange(row, 1, 1, 12)
      .setFontSize(18)
      .setFontColor(black)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });

  [
    [13, 1, 1, 3],
    [13, 5, 1, 4],
    [33, 1, 1, 7],
    [33, 8, 1, 5]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .setFontWeight('bold')
      .setBackground(ROGERS_OS_THEME.softGold)
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, border, SpreadsheetApp.BorderStyle.SOLID);
  });

  sheet.getRange(14, 1, 9, 3)
    .setBackground(neutral)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(14, 5, 15, 4)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(34, 1, 12, 7)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(34, 8, 10, 5)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(53, 1, 2, 3)
    .setBackground(black)
    .setFontColor(white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true, gold, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(53, 5, 5, 3)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(53, 7, 5, 1).setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(14, 2, 9, 2).setHorizontalAlignment('center');
  sheet.getRange(34, 5, 12, 1).setHorizontalAlignment('center');
  sheet.getRange(34, 7, 12, 1).setHorizontalAlignment('center');
  sheet.getRange(34, 10, 10, 1).setHorizontalAlignment('center');
  sheet.getRange(34, 12, 10, 1).setHorizontalAlignment('center');
}

function applyFollowUpQueueStatusColors_(sheet, queue, startRow, startColumn, columnCount) {
  if (!queue.length) {
    return;
  }

  const backgrounds = queue.map(function(item) {
    let color = '#d9ead3';
    if (item.bucket === 0) {
      color = '#f4cccc';
    } else if (item.bucket === 1) {
      color = '#fff2cc';
    }
    return new Array(columnCount).fill(color);
  });
  sheet.getRange(startRow, startColumn, backgrounds.length, columnCount).setBackgrounds(backgrounds);
}

function applySystemStatusColors_(sheet, startRow, statusColumn, statuses) {
  const backgrounds = statuses.map(function(status) {
    const value = String(status || '').toLowerCase();
    if (value.indexOf('fail') !== -1) {
      return ['#f4cccc'];
    }
    if (value.indexOf('warning') !== -1 || value.indexOf('unknown') !== -1 || value.indexOf('not run') !== -1) {
      return ['#fff2cc'];
    }
    return ['#d9ead3'];
  });
  sheet.getRange(startRow, statusColumn, backgrounds.length, 1).setBackgrounds(backgrounds);
}

function applyPipelineStatusConditionalFormatting_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    return;
  }

  const table = getHeaderTable_(sheet, ['Status']);
  const statusColumn = table.headers.Status;
  const startRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getMaxRows() - table.headerRow, 1);
  const range = sheet.getRange(startRow, statusColumn, rowCount, 1);
  const existingRules = sheet.getConditionalFormatRules().filter(function(rule) {
    const ranges = rule.getRanges();
    return !ranges.some(function(ruleRange) {
      return ruleRange.getColumn() === statusColumn &&
        ruleRange.getSheet().getSheetId() === sheet.getSheetId();
    });
  });

  const pipelineRules = PIPELINE_STAGES.map(function(stage) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(stage)
      .setBackground(PIPELINE_STAGE_COLORS[stage])
      .setFontColor(ROGERS_OS_THEME.text)
      .setBold(true)
      .setRanges([range])
      .build();
  });

  sheet.setConditionalFormatRules(existingRules.concat(pipelineRules));
}

function applyPipelineStatusValidation_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    return;
  }

  const table = getHeaderTable_(sheet, ['Status']);
  const statusColumn = table.headers.Status;
  const startRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getMaxRows() - table.headerRow, 1);
  const range = sheet.getRange(startRow, statusColumn, rowCount, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PIPELINE_STAGES, true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(rule);
}

function applyRogersHoldingsVisualDesign_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  runVisualFormattingStep_(ss.getSheetByName('Executive Dashboard'), 'Format Executive Dashboard', function(sheet) {
    formatExecutiveDashboardSheet_(sheet);
  });
  runVisualFormattingStep_(ss.getSheetByName(DASHBOARD_METRICS_SHEET), 'Format Dashboard Metrics', function(sheet) {
    formatDashboardMetricsSheet_(sheet);
  });
  runVisualFormattingStep_(ss.getSheetByName(MASTER_PROSPECT_SHEET), 'Format Master Prospect Tracker', function(sheet) {
    formatMasterProspectTrackerSheet_(sheet);
  });
  runVisualFormattingStep_(ss.getSheetByName(CLIENTS_SHEET), 'Format Clients', function(sheet) {
    formatClientsSheet_(sheet);
  });
  runVisualFormattingStep_(ss.getSheetByName(ACTIVITY_FEED_SHEET), 'Format Activity Feed', function(sheet) {
    formatActivityFeedSheet_(sheet);
  });
  runVisualFormattingStep_(ss.getSheetByName('Settings'), 'Format Settings', function(sheet) {
    formatSettingsSheet_(sheet);
  });
}

function runVisualFormattingStep_(sheet, label, action) {
  if (!sheet) {
    return;
  }

  try {
    action(sheet);
  } catch (error) {
    console.warn(
      `Visual formatting skipped: ${label} on "${sheet.getName()}": ` +
      (error && error.message ? error.message : String(error))
    );
  }
}

function runSheetFormattingStep_(sheet, label, action) {
  try {
    action();
  } catch (error) {
    console.warn(
      `Visual formatting step skipped: ${label} on "${sheet.getName()}": ` +
      (error && error.message ? error.message : String(error))
    );
  }
}

function safeSetFrozenRows_(sheet, rowCount) {
  runSheetFormattingStep_(sheet, 'Freeze rows', function() {
    if (rowCount <= 0 || !freezeWouldSplitMergedRange_(sheet, rowCount, 0)) {
      sheet.setFrozenRows(rowCount);
    }
  });
}

function safeSetFrozenColumns_(sheet, columnCount) {
  runSheetFormattingStep_(sheet, 'Freeze columns', function() {
    if (columnCount <= 0 || !freezeWouldSplitMergedRange_(sheet, 0, columnCount)) {
      sheet.setFrozenColumns(columnCount);
    }
  });
}

function freezeWouldSplitMergedRange_(sheet, frozenRows, frozenColumns) {
  const mergedRanges = sheet
    .getRange(1, 1, Math.max(sheet.getMaxRows(), 1), Math.max(sheet.getMaxColumns(), 1))
    .getMergedRanges();

  return mergedRanges.some(function(range) {
    const firstRow = range.getRow();
    const lastRow = range.getLastRow();
    const firstColumn = range.getColumn();
    const lastColumn = range.getLastColumn();
    const rowSplit = frozenRows > 0 && firstRow <= frozenRows && lastRow > frozenRows;
    const columnSplit = frozenColumns > 0 && firstColumn <= frozenColumns && lastColumn > frozenColumns;

    return rowSplit || columnSplit;
  });
}

function formatExecutiveDashboardSheet_(sheet) {
  if (!sheet) {
    return;
  }

  runSheetFormattingStep_(sheet, 'Executive tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.black);
  });
  safeSetFrozenRows_(sheet, 2);
  runSheetFormattingStep_(sheet, 'Executive gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  runSheetFormattingStep_(sheet, 'Executive base font', function() {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), Math.max(sheet.getMaxColumns(), 1))
      .setFontFamily('Arial')
      .setFontColor(ROGERS_OS_THEME.text)
      .setVerticalAlignment('middle');
  });
  runSheetFormattingStep_(sheet, 'Executive banner styling', function() {
    sheet.getRange(1, 1, 1, Math.max(sheet.getMaxColumns(), 1))
      .setBackground(ROGERS_OS_THEME.black)
      .setFontColor(ROGERS_OS_THEME.gold)
      .setFontWeight('bold')
      .setFontSize(14);
  });
  runSheetFormattingStep_(sheet, 'Executive column widths', function() {
    ensureExecutiveDashboardSize_(sheet, 80, 12);
    sheet.setColumnWidths(1, 12, 125);
    sheet.setColumnWidth(1, 170);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 170);
    sheet.setColumnWidth(5, 150);
    sheet.setColumnWidth(6, 230);
    sheet.setColumnWidth(7, 150);
    sheet.setColumnWidth(8, 170);
    sheet.setColumnWidth(9, 140);
    sheet.setColumnWidth(10, 120);
    sheet.setColumnWidth(11, 150);
    sheet.setColumnWidth(12, 125);
  });
  runSheetFormattingStep_(sheet, 'Executive row heights', function() {
    sheet.setRowHeights(1, Math.min(sheet.getMaxRows(), 80), 30);
    sheet.setRowHeight(1, 38);
    sheet.setRowHeight(2, 32);
    sheet.setRowHeights(3, 8, 36);
    sheet.setRowHeights(12, 18, 30);
    sheet.setRowHeights(32, 16, 32);
  });
  runSheetFormattingStep_(sheet, 'Executive dashboard branding', function() {
    applyExecutiveDashboardBranding_(sheet);
  });
}

function formatDashboardMetricsSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const table = getHealthHeaderTable_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), table.headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), 3);

  runSheetFormattingStep_(sheet, 'Dashboard Metrics tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.gold);
  });
  safeSetFrozenRows_(sheet, table.headerRow);
  runSheetFormattingStep_(sheet, 'Dashboard Metrics gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Dashboard Metrics body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setBorder(true, false, true, false, false, false, '#eee6d5', SpreadsheetApp.BorderStyle.SOLID);
  });
  runSheetFormattingStep_(sheet, 'Dashboard Metrics column widths', function() {
    sheet.setColumnWidth(1, 230);
    sheet.setColumnWidth(2, 145);
    sheet.setColumnWidth(3, 150);
  });
  runSheetFormattingStep_(sheet, 'Dashboard Metrics value alignment', function() {
    if (lastRow > table.headerRow) {
      sheet.getRange(table.headerRow + 1, 2, lastRow - table.headerRow, 1).setHorizontalAlignment('right');
      sheet.getRange(table.headerRow + 1, 3, lastRow - table.headerRow, 1).setNumberFormat('yyyy-mm-dd hh:mm').setHorizontalAlignment('center');
    }
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
}

function formatMasterProspectTrackerSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const table = getHealthHeaderTable_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), table.headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), table.lastColumn);

  runSheetFormattingStep_(sheet, 'Master Prospect tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.gold);
  });
  safeSetFrozenRows_(sheet, table.headerRow);
  safeSetFrozenColumns_(sheet, Math.min(table.headers.Website || 5, 5));
  runSheetFormattingStep_(sheet, 'Master Prospect gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Master Prospect body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setBorder(true, false, true, false, false, false, '#eee6d5', SpreadsheetApp.BorderStyle.SOLID);
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  applyMasterProspectColumnWidths_(sheet, table.headers);
  applyColumnFormattingByHeader_(sheet, table.headers, table.headerRow, lastRow, {
    'Audit Score': { horizontalAlignment: 'center', numberFormat: '0' },
    'Status': { horizontalAlignment: 'center' },
    'Priority Tier': { horizontalAlignment: 'center' },
    'Follow-Up Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Last Activity': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' },
    'Audit Package Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' },
    'Discovery Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' },
    'Closed Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' }
  });
  applyWrapByHeader_(sheet, table.headers, table.headerRow, lastRow, [
    'Audit Outcome',
    'Next Action',
    'Notes',
    'Summary'
  ]);
  runSheetFormattingStep_(sheet, 'Master Prospect row heights', function() {
    sheet.setRowHeights(table.headerRow + 1, Math.max(lastRow - table.headerRow, 1), 34);
  });
}

function formatClientsSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const table = getHealthHeaderTable_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), table.headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), table.lastColumn);

  runSheetFormattingStep_(sheet, 'Clients tab color', function() {
    sheet.setTabColor('#6aa84f');
  });
  safeSetFrozenRows_(sheet, table.headerRow);
  runSheetFormattingStep_(sheet, 'Clients gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Clients body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle');
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  setColumnWidthIfHeader_(sheet, table.headers, 'Client ID', 155);
  setColumnWidthIfHeader_(sheet, table.headers, 'Company', 210);
  setColumnWidthIfHeader_(sheet, table.headers, 'Client Name', 210);
  setColumnWidthIfHeader_(sheet, table.headers, 'Contact', 160);
  setColumnWidthIfHeader_(sheet, table.headers, 'Email', 220);
  setColumnWidthIfHeader_(sheet, table.headers, 'Phone', 135);
  setColumnWidthIfHeader_(sheet, table.headers, 'Website', 230);
  setColumnWidthIfHeader_(sheet, table.headers, 'Industry', 150);
  setColumnWidthIfHeader_(sheet, table.headers, 'Service Package', 220);
  setColumnWidthIfHeader_(sheet, table.headers, 'Service', 220);
  setColumnWidthIfHeader_(sheet, table.headers, 'Current Project', 220);
  setColumnWidthIfHeader_(sheet, table.headers, 'Project Status', 140);
  setColumnWidthIfHeader_(sheet, table.headers, 'Status', 120);
  applyColumnFormattingByHeader_(sheet, table.headers, table.headerRow, lastRow, {
    'Contract Value': { horizontalAlignment: 'right', numberFormat: '$#,##0.00' },
    'Client Since': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Start Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Renewal Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Due Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Last Activity': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' },
    'Status': { horizontalAlignment: 'center' },
    'Project Status': { horizontalAlignment: 'center' }
  });
  applyWrapByHeader_(sheet, table.headers, table.headerRow, lastRow, [
    'Current Project',
    'Notes'
  ]);
}

function formatActivityFeedSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const table = getHealthHeaderTable_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), table.headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), table.lastColumn);

  runSheetFormattingStep_(sheet, 'Activity Feed tab color', function() {
    sheet.setTabColor('#666666');
  });
  safeSetFrozenRows_(sheet, table.headerRow);
  runSheetFormattingStep_(sheet, 'Activity Feed gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Activity Feed body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('top');
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  setColumnWidthIfHeader_(sheet, table.headers, 'Date', 150);
  setColumnWidthIfHeader_(sheet, table.headers, 'Company', 210);
  setColumnWidthIfHeader_(sheet, table.headers, 'Activity Type', 190);
  setColumnWidthIfHeader_(sheet, table.headers, 'Activity Notes', 430);
  setColumnWidthIfHeader_(sheet, table.headers, 'Related Prospect ID', 160);
  applyColumnFormattingByHeader_(sheet, table.headers, table.headerRow, lastRow, {
    'Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' },
    'Activity Type': { horizontalAlignment: 'center' }
  });
  applyWrapByHeader_(sheet, table.headers, table.headerRow, lastRow, ['Activity Notes']);
  runSheetFormattingStep_(sheet, 'Activity Feed row heights', function() {
    sheet.setRowHeights(table.headerRow + 1, Math.max(lastRow - table.headerRow, 1), 42);
  });
}

function formatSettingsSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const table = getHealthHeaderTable_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), table.headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), table.lastColumn);

  runSheetFormattingStep_(sheet, 'Settings tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.charcoal);
  });
  safeSetFrozenRows_(sheet, table.headerRow);
  runSheetFormattingStep_(sheet, 'Settings gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Settings body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle');
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Settings column widths', function() {
    sheet.setColumnWidths(1, Math.min(lastColumn, 4), 190);
  });
}

function formatTableHeader_(sheet, headerRow, lastColumn) {
  runSheetFormattingStep_(sheet, 'Table header styling', function() {
    sheet.getRange(headerRow, 1, 1, lastColumn)
      .setBackground(ROGERS_OS_THEME.black)
      .setFontColor(ROGERS_OS_THEME.gold)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBorder(true, true, true, true, true, true, ROGERS_OS_THEME.gold, SpreadsheetApp.BorderStyle.SOLID);
  });
  runSheetFormattingStep_(sheet, 'Table header row height', function() {
    sheet.setRowHeight(headerRow, 38);
  });
}

function applyAlternatingRows_(sheet, startRow, lastRow, lastColumn) {
  if (lastRow < startRow) {
    return;
  }

  const rowCount = lastRow - startRow + 1;
  const backgrounds = [];
  for (let index = 0; index < rowCount; index += 1) {
    const color = index % 2 === 0 ? ROGERS_OS_THEME.white : ROGERS_OS_THEME.softNeutral;
    backgrounds.push(new Array(lastColumn).fill(color));
  }
  runSheetFormattingStep_(sheet, 'Alternating row backgrounds', function() {
    sheet.getRange(startRow, 1, rowCount, lastColumn).setBackgrounds(backgrounds);
  });
}

function applySectionHeaderStyle_(sheet, startColumn, columnCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 0) {
    return;
  }

  const values = sheet.getRange(1, startColumn, lastRow, 1).getDisplayValues();
  values.forEach(function(row, index) {
    const value = String(row[0] || '').trim();
    if (value && value === value.toUpperCase() && value.length > 3) {
      runSheetFormattingStep_(sheet, 'Section header styling', function() {
        sheet.getRange(index + 1, startColumn, 1, columnCount)
          .setBackground(ROGERS_OS_THEME.black)
          .setFontColor(ROGERS_OS_THEME.gold)
          .setFontWeight('bold')
          .setFontSize(11)
          .setBorder(true, true, true, true, false, false, ROGERS_OS_THEME.gold, SpreadsheetApp.BorderStyle.SOLID);
      });
    }
  });
}

function applyMetricCardStyle_(sheet, startRow, rowCount, startColumn, columnCount) {
  const maxRows = sheet.getMaxRows();
  if (startRow > maxRows) {
    return;
  }

  const safeRowCount = Math.min(rowCount, maxRows - startRow + 1);
  runSheetFormattingStep_(sheet, 'Metric card styling', function() {
    sheet.getRange(startRow, startColumn, safeRowCount, columnCount)
      .setBackground(ROGERS_OS_THEME.softNeutral)
      .setBorder(true, true, true, true, true, true, ROGERS_OS_THEME.border, SpreadsheetApp.BorderStyle.SOLID)
      .setFontFamily('Arial')
      .setVerticalAlignment('middle');
  });
}

function applyMasterProspectColumnWidths_(sheet, headers) {
  setColumnWidthIfHeader_(sheet, headers, 'Company', 210);
  setColumnWidthIfHeader_(sheet, headers, 'Contact', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Email', 210);
  setColumnWidthIfHeader_(sheet, headers, 'Phone', 130);
  setColumnWidthIfHeader_(sheet, headers, 'Website', 230);
  setColumnWidthIfHeader_(sheet, headers, 'City', 120);
  setColumnWidthIfHeader_(sheet, headers, 'State', 75);
  setColumnWidthIfHeader_(sheet, headers, 'Industry', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Source', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Audit Score', 95);
  setColumnWidthIfHeader_(sheet, headers, 'Audit Outcome', 230);
  setColumnWidthIfHeader_(sheet, headers, 'Priority Tier', 130);
  setColumnWidthIfHeader_(sheet, headers, 'Status', 140);
  setColumnWidthIfHeader_(sheet, headers, 'Next Action', 240);
  setColumnWidthIfHeader_(sheet, headers, 'Follow-Up Date', 130);
  setColumnWidthIfHeader_(sheet, headers, 'Notes', 330);
  setColumnWidthIfHeader_(sheet, headers, 'Summary', 330);
}

function setColumnWidthIfHeader_(sheet, headers, header, width) {
  if (headers[header]) {
    runSheetFormattingStep_(sheet, `Column width ${header}`, function() {
      sheet.setColumnWidth(headers[header], width);
    });
  }
}

function applyColumnFormattingByHeader_(sheet, headers, headerRow, lastRow, formatByHeader) {
  const rowCount = Math.max(lastRow - headerRow, 1);
  Object.keys(formatByHeader).forEach(function(header) {
    if (!headers[header]) {
      return;
    }

    const format = formatByHeader[header];
    runSheetFormattingStep_(sheet, `Column formatting ${header}`, function() {
      const range = sheet.getRange(headerRow + 1, headers[header], rowCount, 1);
      if (format.horizontalAlignment) {
        range.setHorizontalAlignment(format.horizontalAlignment);
      }
      if (format.numberFormat) {
        range.setNumberFormat(format.numberFormat);
      }
    });
  });
}

function applyWrapByHeader_(sheet, headers, headerRow, lastRow, headerNames) {
  const rowCount = Math.max(lastRow - headerRow, 1);
  headerNames.forEach(function(header) {
    if (headers[header]) {
      runSheetFormattingStep_(sheet, `Wrap ${header}`, function() {
        sheet.getRange(headerRow + 1, headers[header], rowCount, 1).setWrap(true);
      });
    }
  });
}

function updateExecutiveDashboardFollowUpQueue_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prospectSheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  const dashboardSheet = ss.getSheetByName('Executive Dashboard');

  if (!prospectSheet || !dashboardSheet) {
    return;
  }

  refreshExecutiveDashboard();
}

function updateExecutiveDashboardClientSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboardSheet = ss.getSheetByName('Executive Dashboard');
  if (!dashboardSheet) {
    return;
  }

  const metrics = getClientRevenueMetrics_();
  const recentConversions = getRecentClientConversions_();
  const discoveryCallsScheduled = countActivityType_('Discovery Call Scheduled');
  const auditPackagesGenerated = countActivityType_('Audit Package Generated');
  const auditPackagesSent = countActivityType_('Audit Package Sent');
  const output = [
    ['CLIENT SUMMARY', '', ''],
    ['Total Clients', metrics.totalClients, ''],
    ['Active Clients', metrics.activeClients, ''],
    ['New Clients This Month', metrics.clientsThisMonth, ''],
    ['Revenue', metrics.totalRevenue, ''],
    ['Discovery Calls Scheduled', discoveryCallsScheduled, ''],
    ['Audit Packages Generated', auditPackagesGenerated, ''],
    ['Audit Packages Sent', auditPackagesSent, ''],
    ['Recent Conversions', '', '']
  ].concat(recentConversions.map(function(conversion) {
    return [conversion.clientName, conversion.clientSince, conversion.contractValue];
  }));

  const startRow = 46;
  const startColumn = 1;
  const clearRows = 12;
  const clearColumns = 3;
  dashboardSheet.getRange(startRow, startColumn, clearRows, clearColumns).clearContent();
  dashboardSheet.getRange(startRow, startColumn, output.length, output[0].length).setValues(output);
  dashboardSheet.getRange(startRow, startColumn, 1, clearColumns).setFontWeight('bold');
  dashboardSheet.getRange(startRow + 1, startColumn, 8, 1).setFontWeight('bold');
  dashboardSheet.getRange(startRow + 4, startColumn + 1).setNumberFormat('$#,##0.00');
  if (recentConversions.length) {
    dashboardSheet.getRange(startRow + 9, startColumn + 1, recentConversions.length, 1).setNumberFormat('yyyy-mm-dd');
    dashboardSheet.getRange(startRow + 9, startColumn + 2, recentConversions.length, 1).setNumberFormat('$#,##0.00');
  }
}

function getClientRevenueMetrics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLIENTS_SHEET);
  const emptyMetrics = {
    totalClients: 0,
    activeClients: 0,
    totalRevenue: 0,
    averageDealSize: 0,
    clientsThisMonth: 0,
    revenueThisMonth: 0,
    activeProjects: 0
  };

  if (!sheet) {
    return emptyMetrics;
  }

  const table = ensureClientColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return emptyMetrics;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let activeClients = 0;
  let clientCount = 0;
  let totalRevenue = 0;
  let clientsThisMonth = 0;
  let revenueThisMonth = 0;
  let activeProjects = 0;

  values.forEach(function(row) {
    const clientName = String(
      getValueByHeader_(row, table.headers, 'Company') ||
      getValueByHeader_(row, table.headers, 'Client Name') ||
      ''
    ).trim();
    if (!clientName) {
      return;
    }

    const status = String(getValueByHeader_(row, table.headers, 'Status') || '').trim();
    const projectStatus = String(getValueByHeader_(row, table.headers, 'Project Status') || '').trim();
    const contractValue = Number(getValueByHeader_(row, table.headers, 'Contract Value')) || 0;
    const clientSince = dateValueOrNull_(
      getValueByHeader_(row, table.headers, 'Start Date') ||
      getValueByHeader_(row, table.headers, 'Client Since')
    );
    clientCount += 1;

    if (status === 'Active') {
      activeClients += 1;
    }
    if (projectStatus === 'Active' || projectStatus === 'In Progress') {
      activeProjects += 1;
    }

    totalRevenue += contractValue;

    if (clientSince && clientSince.getMonth() === currentMonth && clientSince.getFullYear() === currentYear) {
      clientsThisMonth += 1;
      revenueThisMonth += contractValue;
    }
  });

  return {
    totalClients: clientCount,
    activeClients: activeClients,
    totalRevenue: totalRevenue,
    averageDealSize: clientCount ? totalRevenue / clientCount : 0,
    clientsThisMonth: clientsThisMonth,
    revenueThisMonth: revenueThisMonth,
    activeProjects: activeProjects
  };
}

function getRecentClientConversions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLIENTS_SHEET);
  if (!sheet) {
    return [];
  }

  const table = ensureClientColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  return values
    .map(function(row) {
      return {
        clientName: row[table.headers['Client Name'] - 1] || '',
        clientSince: dateValueOrNull_(row[table.headers['Client Since'] - 1]),
        contractValue: Number(row[table.headers['Contract Value'] - 1]) || 0
      };
    })
    .filter(function(record) {
      return String(record.clientName || '').trim() && record.clientSince;
    })
    .sort(function(a, b) {
      return b.clientSince.getTime() - a.clientSince.getTime();
    })
    .slice(0, 5);
}

function countActivityType_(activityType) {
  return countActivityTypes_([activityType]);
}

function countActivityTypeToday_(activityType) {
  return countActivityTypesToday_([activityType]);
}

function countActivityTypes_(activityTypes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ACTIVITY_FEED_SHEET);
  if (!sheet) {
    return 0;
  }

  const table = getHeaderTable_(sheet, ['Activity Type']);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return 0;
  }

  const values = sheet.getRange(dataStartRow, table.headers['Activity Type'], rowCount, 1).getValues();
  const types = activityTypes.reduce(function(result, activityType) {
    result[String(activityType || '').trim()] = true;
    return result;
  }, {});

  return values.filter(function(row) {
    return types[String(row[0] || '').trim()] === true;
  }).length;
}

function countActivityTypesToday_(activityTypes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ACTIVITY_FEED_SHEET);
  if (!sheet) {
    return 0;
  }

  const table = getHeaderTable_(sheet, ['Date', 'Activity Type']);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return 0;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  const types = activityTypes.reduce(function(result, activityType) {
    result[String(activityType || '').trim()] = true;
    return result;
  }, {});
  const today = startOfDay_(new Date()).getTime();

  return values.filter(function(row) {
    const activityDate = dateValueOrNull_(row[table.headers.Date - 1]);
    const activityType = String(row[table.headers['Activity Type'] - 1] || '').trim();
    return activityDate &&
      startOfDay_(activityDate).getTime() === today &&
      types[activityType] === true;
  }).length;
}

function startOfDay_(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateValueOrNull_(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function dateSortValue_(value) {
  const date = dateValueOrNull_(value);
  return date ? date.getTime() : 0;
}

function formatDisplayDate_(value) {
  const date = dateValueOrNull_(value);
  if (!date) {
    return '';
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatCurrency_(value) {
  const number = Number(value);
  if (Number.isNaN(number) || value === '' || value === null || value === undefined) {
    return '';
  }

  return '$' + number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatWorkspaceValue_(value) {
  if (value instanceof Date) {
    return formatDisplayDate_(value);
  }

  if (value === null || value === undefined || String(value).trim() === '') {
    return '-';
  }

  return value;
}

function setIfHeader_(rowValues, headers, header, value) {
  if (!headers[header]) {
    return;
  }
  rowValues[headers[header] - 1] = value;
}

function getValueByHeader_(rowValues, headers, header) {
  if (!headers[header]) {
    return '';
  }

  return rowValues[headers[header] - 1];
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textIncludesAny_(value, needles) {
  const text = String(value || '').toLowerCase();
  return needles.some(function(needle) {
    return text.indexOf(String(needle).toLowerCase()) !== -1;
  });
}
