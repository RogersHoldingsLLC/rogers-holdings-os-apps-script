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
  getOrCreateDailyFrictionLogSheet_(ss);
  getOrCreateProductFeedbackSheet_(ss);
  refreshFollowUps();
  refreshProjects();
  updatePipelineDashboardMetrics_();
  refreshExecutiveDashboard();
  applyPipelineStatusConditionalFormatting_();
  applyPipelineStatusValidation_();
  applyRogersHoldingsVisualDesign_();
}

function resetTestData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset Test Data',
    'This will delete test/prospect/client/follow-up/project/activity data but preserve Rogers Holdings OS structure. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];
  results.push(clearResetTableData_(ss, MASTER_PROSPECT_SHEET, ['Company']));
  results.push(clearResetTableData_(ss, CLIENTS_SHEET, ['Company']));
  results.push(clearResetTableData_(ss, FOLLOW_UPS_SHEET, ['Follow-Up ID']));
  results.push(clearResetTableData_(ss, PROJECTS_SHEET, ['Project ID']));
  results.push(clearResetTableData_(ss, ACTIVITY_FEED_SHEET, ['Date', 'Company', 'Activity Type']));
  results.push(clearDashboardMetricsDemoRows_(ss));
  results.push(clearResetWorkspaceContent_(ss, 'Prospect Workspace'));
  results.push(clearResetWorkspaceContent_(ss, CLIENT_WORKSPACE_SHEET));

  refreshFollowUps();
  refreshProjects();
  updatePipelineDashboardMetrics_();
  refreshClientWorkspaceAfterTestReset_(ss);

  if (ss.getSheetByName(ACTIVITY_FEED_SHEET)) {
    logPipelineActivity_(
      ss,
      'Rogers Holdings OS',
      'System Reset',
      'Reset Test Data cleared operational records while preserving workbook structure.'
    );
  }

  refreshExecutiveDashboard();
  applyRogersHoldingsVisualDesign_();

  const clearedRows = results.reduce(function(total, result) {
    return total + (result && result.rowsCleared ? result.rowsCleared : 0);
  }, 0);
  const summary = results
    .filter(function(result) {
      return result && result.sheet;
    })
    .map(function(result) {
      return `${result.sheet}: ${result.rowsCleared || 0} row(s)`;
    })
    .join('\n');

  ui.alert(
    'Rogers Holdings OS',
    `Reset Test Data complete.\n\nRows cleared: ${clearedRows}\n${summary}`,
    ui.ButtonSet.OK
  );
}

function repairInvalidDropdownValues() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET);
  if (!sheet) {
    ui.alert('Rogers Holdings OS', 'Master Prospect Tracker not found.', ui.ButtonSet.OK);
    return;
  }

  const table = getHeaderTable_(sheet, ['Company']);
  const result = repairInvalidDropdownValuesForSheet_(sheet, table);
  if (result.changedCells > 0) {
    logPipelineActivity_(
      ss,
      'Rogers Holdings OS',
      'Dropdown Values Repaired',
      `Repaired ${result.changedCells} invalid dropdown value(s) across ${result.changedRows} prospect row(s).`
    );
  }
  refreshExecutiveDashboard();

  ui.alert(
    'Rogers Holdings OS',
    `Dropdown repair complete.\n\nCells repaired: ${result.changedCells}\nRows affected: ${result.changedRows}`,
    ui.ButtonSet.OK
  );
}

function repairInvalidDropdownValuesForSheet_(sheet, table) {
  const headers = table.headers;
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const targetHeaders = getProspectDropdownRepairHeaders_(headers);
  if (rowCount <= 0 || !targetHeaders.length) {
    return {
      changedCells: 0,
      changedRows: 0
    };
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  let changedCells = 0;
  const changedRows = {};

  values.forEach(function(rowValues, rowIndex) {
    targetHeaders.forEach(function(header) {
      const columnIndex = headers[header] - 1;
      const originalValue = rowValues[columnIndex];
      if (originalValue === null || originalValue === undefined || String(originalValue).trim() === '') {
        return;
      }

      const normalizedValue = normalizeProspectDropdownValue_(sheet, headers, header, originalValue);
      if (String(normalizedValue || '').trim() !== String(originalValue || '').trim()) {
        rowValues[columnIndex] = normalizedValue;
        changedCells += 1;
        changedRows[dataStartRow + rowIndex] = true;
      }
    });
  });

  if (changedCells > 0) {
    sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).setValues(values);
  }

  return {
    changedCells: changedCells,
    changedRows: Object.keys(changedRows).length
  };
}

function getProspectDropdownRepairHeaders_(headers) {
  return [
    'Audit Outcome',
    'Priority Tier',
    'Status',
    'Next Action',
    'Offer / Service',
    'Moved to CRM'
  ].filter(function(header) {
    return !!headers[header];
  });
}

function findInvalidProspectDropdownValues_(sheet, table) {
  const headers = table.headers;
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const targetHeaders = getProspectDropdownRepairHeaders_(headers);
  const issues = [];
  if (rowCount <= 0 || !targetHeaders.length) {
    return issues;
  }

  const allowedByHeader = targetHeaders.reduce(function(result, header) {
    result[header] = approvedProspectDropdownValues_(
      getApprovedProspectDropdownValues_(sheet, headers, header),
      header
    );
    return result;
  }, {});
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(rowValues, rowIndex) {
    targetHeaders.forEach(function(header) {
      const value = getValueByHeader_(rowValues, headers, header);
      const text = String(value || '').trim();
      if (!text) {
        return;
      }

      const allowedValues = allowedByHeader[header] || [];
      if (!inferAllowedDropdownValue_(allowedValues, text)) {
        issues.push({
          row: dataStartRow + rowIndex,
          header: header,
          value: text,
          suggestedValue: normalizeProspectDropdownValue_(sheet, headers, header, text)
        });
      }
    });
  });

  return issues;
}

function clearResetTableData_(ss, sheetName, requiredHeaders) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      sheet: sheetName,
      rowsCleared: 0,
      skipped: true
    };
  }

  try {
    return {
      sheet: sheetName,
      rowsCleared: clearAllRowsBelowHeaderPreservingFormulas_(sheet, requiredHeaders || [])
    };
  } catch (error) {
    console.warn(
      `Reset Test Data skipped "${sheetName}": ` +
      (error && error.message ? error.message : String(error))
    );
    return {
      sheet: sheetName,
      rowsCleared: 0,
      skipped: true
    };
  }
}

function clearDashboardMetricsDemoRows_(ss) {
  const sheet = ss.getSheetByName(DASHBOARD_METRICS_SHEET);
  if (!sheet) {
    return {
      sheet: DASHBOARD_METRICS_SHEET,
      rowsCleared: 0,
      skipped: true
    };
  }

  try {
    const table = getHealthHeaderTable_(sheet);
    const dataStartRow = table.headerRow + 1;
    const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
    if (rowCount <= 0) {
      return {
        sheet: DASHBOARD_METRICS_SHEET,
        rowsCleared: 0
      };
    }

    const lastColumn = Math.max(table.lastColumn, sheet.getLastColumn());
    const range = sheet.getRange(dataStartRow, 1, rowCount, lastColumn);
    const values = range.getDisplayValues();
    let clearedRows = 0;

    values.forEach(function(row, index) {
      const rowText = row.join(' ').toLowerCase();
      if (!/\b(demo reset|demo data|sample data|test data)\b/.test(rowText)) {
        return;
      }

      const rowRange = sheet.getRange(dataStartRow + index, 1, 1, lastColumn);
      const formulas = rowRange.getFormulas();
      rowRange.clearContent();
      restoreFormulas_(rowRange, formulas);
      clearedRows += 1;
    });

    return {
      sheet: DASHBOARD_METRICS_SHEET,
      rowsCleared: clearedRows
    };
  } catch (error) {
    console.warn(
      'Reset Test Data skipped Dashboard Metrics demo rows: ' +
      (error && error.message ? error.message : String(error))
    );
    return {
      sheet: DASHBOARD_METRICS_SHEET,
      rowsCleared: 0,
      skipped: true
    };
  }
}

function clearResetWorkspaceContent_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      sheet: sheetName,
      rowsCleared: 0,
      skipped: true
    };
  }

  try {
    const startRow = 4;
    const rowCount = Math.max(sheet.getLastRow() - startRow + 1, 0);
    const columnCount = Math.max(sheet.getLastColumn(), 1);
    if (rowCount <= 0) {
      return {
        sheet: sheetName,
        rowsCleared: 0
      };
    }

    const range = sheet.getRange(startRow, 1, rowCount, columnCount);
    const formulas = range.getFormulas();
    range.clearContent();
    restoreFormulas_(range, formulas);
    return {
      sheet: sheetName,
      rowsCleared: rowCount
    };
  } catch (error) {
    console.warn(
      `Reset Test Data skipped workspace "${sheetName}": ` +
      (error && error.message ? error.message : String(error))
    );
    return {
      sheet: sheetName,
      rowsCleared: 0,
      skipped: true
    };
  }
}

function refreshClientWorkspaceAfterTestReset_(ss) {
  const workspaceSheet = getOrCreateClientWorkspaceSheet_(ss);
  renderClientWorkspace_(workspaceSheet, buildEmptyClientWorkspaceModel_());
}

function buildEmptyClientWorkspaceModel_() {
  return {
    clientId: '',
    company: 'No Client Selected',
    contact: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    servicePackage: '',
    status: '',
    assignedTo: '',
    currentProject: '',
    projectStatus: '',
    dueDate: '',
    lastActivity: '',
    notes: 'Select a client row to populate this workspace.',
    activity: [],
    documents: [],
    followUps: [],
    projects: []
  };
}

function openExecutiveDashboard() {
  openRogersOsSheet_('Executive Dashboard', true);
}

function openMasterProspectTracker() {
  openRogersOsSheet_(MASTER_PROSPECT_SHEET, true);
}

function openClientsSheet() {
  getOrCreateClientsSheet_(SpreadsheetApp.getActiveSpreadsheet());
  openRogersOsSheet_(CLIENTS_SHEET, true);
}

function openFollowUpsSheet() {
  getOrCreateFollowUpsSheet_(SpreadsheetApp.getActiveSpreadsheet());
  openRogersOsSheet_(FOLLOW_UPS_SHEET, true);
}

function openProjectsSheet() {
  getOrCreateProjectsSheet_(SpreadsheetApp.getActiveSpreadsheet());
  openRogersOsSheet_(PROJECTS_SHEET, true);
}

function openActivityFeedSheet() {
  openRogersOsSheet_(ACTIVITY_FEED_SHEET, true);
}

function openDailyFrictionLog() {
  getOrCreateDailyFrictionLogSheet_(SpreadsheetApp.getActiveSpreadsheet());
  openRogersOsSheet_(DAILY_FRICTION_LOG_SHEET, true);
}

function openProductFeedback() {
  getOrCreateProductFeedbackSheet_(SpreadsheetApp.getActiveSpreadsheet());
  openRogersOsSheet_(PRODUCT_FEEDBACK_SHEET, true);
}

function openRogersOsSheet_(sheetName, showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (showAlert) {
      SpreadsheetApp.getUi().alert('Rogers Holdings OS', `Sheet not found: ${sheetName}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  ss.setActiveSheet(sheet);
}

function createFollowUp() {
  const context = getSelectedFollowUpSourceContext_(true);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const typePrompt = ui.prompt('Create Follow-Up', 'Follow-Up Type', ui.ButtonSet.OK_CANCEL);
  if (typePrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const duePrompt = ui.prompt('Create Follow-Up', 'Due date, for example 2026-06-30. Leave blank for today.', ui.ButtonSet.OK_CANCEL);
  if (duePrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const dueDate = parseDateInputOrToday_(duePrompt.getResponseText());
  if (!dueDate) {
    ui.alert('Rogers Holdings OS', 'Enter a valid due date, then run Create Follow-Up again.', ui.ButtonSet.OK);
    return;
  }

  const result = upsertOpenFollowUp_(context.ss, {
    company: context.company,
    contact: context.contact,
    email: context.email,
    relatedProspectId: context.prospectId,
    relatedClientId: context.clientId,
    currentStatus: context.status,
    followUpType: String(typePrompt.getResponseText() || 'Follow-Up').trim() || 'Follow-Up',
    dueDate: dueDate,
    priority: context.priority,
    assignedTo: getRogersContactInfo_().name,
    notes: 'Manual follow-up created.'
  });

  logPipelineActivity_(context.ss, context.company, result.created ? 'Follow-Up Created' : 'Follow-Up Updated', `${result.followUpType} due ${formatDisplayDate_(dueDate)}.`);
  refreshSalesOperatingSystem_();
  ui.alert('Rogers Holdings OS', result.created ? 'Follow-up created.' : 'Existing open follow-up updated.', ui.ButtonSet.OK);
}

function completeFollowUp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const activeSheet = ss.getActiveSheet();
  const followUpSheet = getOrCreateFollowUpsSheet_(ss);
  const table = ensureFollowUpColumns_(followUpSheet);
  let completedCount = 0;
  let company = '';

  if (activeSheet && activeSheet.getName() === FOLLOW_UPS_SHEET && activeSheet.getActiveRange().getRow() > table.headerRow) {
    const rowNumber = activeSheet.getActiveRange().getRow();
    const values = followUpSheet.getRange(rowNumber, 1, 1, table.lastColumn).getValues()[0];
    company = getValueByHeader_(values, table.headers, 'Company');
    markFollowUpRowCompleted_(followUpSheet, table.headers, rowNumber);
    completedCount = 1;
  } else {
    const context = getSelectedFollowUpSourceContext_(true);
    if (!context) {
      return;
    }

    company = context.company;
    completedCount = completeOpenFollowUpsForCompany_(ss, context.company);
  }

  if (!completedCount) {
    ui.alert('Rogers Holdings OS', 'No open follow-ups were found to complete.', ui.ButtonSet.OK);
    return;
  }

  logPipelineActivity_(ss, company, 'Follow-Up Completed', `${completedCount} follow-up task(s) completed.`);
  refreshSalesOperatingSystem_();
  ui.alert('Rogers Holdings OS', 'Follow-up completed.', ui.ButtonSet.OK);
}

function refreshFollowUps() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateFollowUpsSheet_(ss);
  const table = ensureFollowUpColumns_(sheet);
  refreshFollowUpDaysUntilDue_(sheet, table.headers);
  formatFollowUpsSheet_(sheet, table.headers);
}

function getOrCreateFollowUpsSheet_(ss) {
  let sheet = ss.getSheetByName(FOLLOW_UPS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(FOLLOW_UPS_SHEET);
  }

  ensureFollowUpColumns_(sheet);
  return sheet;
}

function ensureFollowUpColumns_(sheet) {
  if (sheet.getMaxColumns() < FOLLOW_UP_COLUMNS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), FOLLOW_UP_COLUMNS.length - sheet.getMaxColumns());
  }
  const headerRow = findBestHeaderRow_(sheet);
  const headerValues = sheet.getRange(headerRow, 1, 1, Math.max(sheet.getLastColumn(), FOLLOW_UP_COLUMNS.length)).getValues()[0];
  const headers = {};

  headerValues.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (header && !headers[header]) {
      headers[header] = index + 1;
    }
  });

  if (!Object.keys(headers).length) {
    sheet.getRange(headerRow, 1, 1, FOLLOW_UP_COLUMNS.length).setValues([FOLLOW_UP_COLUMNS]);
    FOLLOW_UP_COLUMNS.forEach(function(header, index) {
      headers[header] = index + 1;
    });
  }

  let lastColumn = Math.max(sheet.getLastColumn(), 1);
  FOLLOW_UP_COLUMNS.forEach(function(header) {
    if (headers[header]) {
      return;
    }
    lastColumn += 1;
    sheet.getRange(headerRow, lastColumn).setValue(header);
    headers[header] = lastColumn;
  });

  sheet.getRange(headerRow, 1, 1, lastColumn)
    .setBackground(ROGERS_OS_THEME.black)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold');
  sheet.setFrozenRows(headerRow);
  sheet.setTabColor(ROGERS_OS_THEME.gold);

  return {
    headerRow: headerRow,
    headers: headers,
    lastColumn: lastColumn
  };
}

function syncFollowUpForProspectRow_(sheet, headers, selectedRow, status) {
  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET || !selectedRow || selectedRow <= findBestHeaderRow_(sheet)) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const normalizedStatus = normalizePipelineStage_(status) || String(status || '').trim();
  const rule = getFollowUpRuleForStatus_(normalizedStatus);
  const values = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const company = String(getValueByHeader_(values, headers, 'Company') || '').trim();
  if (!company) {
    return;
  }

  const completedCount = completeOpenFollowUpsForCompany_(ss, company);
  if (completedCount) {
    logPipelineActivity_(ss, company, 'Follow-Up Completed', `${completedCount} previous open follow-up task(s) completed after status changed to ${normalizedStatus}.`);
  }
  if (!rule || rule.archive) {
    if (rule && rule.archive) {
      logPipelineActivity_(ss, company, 'Follow-Up Archived', 'Open follow-ups completed because the record moved to Lost.');
    }
    return;
  }

  const dueDate = getFollowUpDueDateForRule_(rule, values, headers);
  const result = upsertOpenFollowUp_(ss, {
    company: company,
    contact: getValueByHeader_(values, headers, 'Contact'),
    email: getValueByHeader_(values, headers, 'Email'),
    relatedProspectId: getValueByHeader_(values, headers, 'Prospect ID') || `MPT-${selectedRow}`,
    relatedClientId: '',
    currentStatus: normalizedStatus,
    followUpType: rule.type,
    dueDate: dueDate,
    priority: getValueByHeader_(values, headers, 'Priority Tier') || rule.priority,
    assignedTo: getRogersContactInfo_().name,
    notes: rule.notes
  });

  logPipelineActivity_(ss, company, result.created ? 'Follow-Up Created' : 'Follow-Up Updated', `${rule.type} due ${formatDisplayDate_(dueDate)}.`);
}

function syncFollowUpForClient_(ss, clientValues, clientHeaders) {
  const company = firstNonBlank_([
    getValueByHeader_(clientValues, clientHeaders, 'Company'),
    getValueByHeader_(clientValues, clientHeaders, 'Client Name')
  ]);
  if (!company) {
    return;
  }

  const dueDate = startOfDay_(new Date());
  const result = upsertOpenFollowUp_(ss, {
    company: company,
    contact: getValueByHeader_(clientValues, clientHeaders, 'Contact'),
    email: getValueByHeader_(clientValues, clientHeaders, 'Email'),
    relatedProspectId: '',
    relatedClientId: getValueByHeader_(clientValues, clientHeaders, 'Client ID'),
    currentStatus: getValueByHeader_(clientValues, clientHeaders, 'Status') || 'Active',
    followUpType: 'Client Welcome Task',
    dueDate: dueDate,
    priority: 'A - Hot',
    assignedTo: getRogersContactInfo_().name,
    notes: 'Welcome client and confirm onboarding next steps.'
  });

  logPipelineActivity_(ss, company, result.created ? 'Follow-Up Created' : 'Follow-Up Updated', `Client Welcome Task due ${formatDisplayDate_(dueDate)}.`);
}

function getFollowUpRuleForStatus_(status) {
  const rules = {
    'Lead Found': { type: 'Executive Snapshot', days: 0, priority: 'A - Hot', notes: 'Generate Executive Snapshot today.' },
    'Executive Snapshot Sent': { type: 'Discovery Meeting', days: 3, priority: 'A - Hot', notes: 'Schedule discovery meeting.' },
    'Discovery Meeting Scheduled': { type: 'Discovery Reminder', days: 1, priority: 'A - Hot', notes: 'Reminder one day before discovery meeting.', useDiscoveryDate: true },
    'Digital Business Assessment Presented': { type: 'Improvement Plan', days: 1, priority: 'A - Hot', notes: 'Generate Improvement Plan after assessment review.' },
    'Improvement Plan Sent': { type: 'Follow-Up', days: 3, priority: 'A - Hot', notes: 'Follow up after Improvement Plan sent.' },
    'Project Started': { type: 'Project Kickoff', days: 0, priority: 'A - Hot', notes: 'Confirm kickoff details and first project milestone.' },
    'Client': { type: 'Client Welcome Task', days: 0, priority: 'A - Hot', notes: 'Welcome client and confirm onboarding next steps.' },
    'No Response': { type: 'Follow-Up', days: 7, priority: 'B - Good', notes: 'Follow up after no response.' },
    'Second No Response': { type: 'Final Follow-Up', days: 14, priority: 'B - Good', notes: 'Send final follow-up.' },
    'Lost': { archive: true }
  };
  return rules[status] || null;
}

function getFollowUpDueDateForRule_(rule, rowValues, headers) {
  if (rule.useDiscoveryDate) {
    const discoveryDate = dateValueOrNull_(getValueByHeader_(rowValues, headers, 'Discovery Date'));
    if (discoveryDate) {
      const reminderDate = startOfDay_(discoveryDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      return reminderDate;
    }
  }

  const dueDate = startOfDay_(new Date());
  dueDate.setDate(dueDate.getDate() + (rule.days || 0));
  return dueDate;
}

function upsertOpenFollowUp_(ss, followUp) {
  const sheet = getOrCreateFollowUpsSheet_(ss);
  const table = ensureFollowUpColumns_(sheet);
  const existing = findOpenFollowUp_(sheet, table.headers, followUp);
  const targetRow = existing ? existing.rowNumber : Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  const rowValues = existing
    ? existing.values.concat(new Array(Math.max(table.lastColumn - existing.values.length, 0)).fill('')).slice(0, table.lastColumn)
    : new Array(table.lastColumn).fill('');

  setIfHeader_(rowValues, table.headers, 'Follow-Up ID', getValueByHeader_(rowValues, table.headers, 'Follow-Up ID') || generateFollowUpId_(followUp.company));
  setIfHeader_(rowValues, table.headers, 'Company', followUp.company);
  setIfHeader_(rowValues, table.headers, 'Contact', followUp.contact);
  setIfHeader_(rowValues, table.headers, 'Email', followUp.email);
  setIfHeader_(rowValues, table.headers, 'Related Prospect ID', followUp.relatedProspectId);
  setIfHeader_(rowValues, table.headers, 'Related Client ID', followUp.relatedClientId);
  setIfHeader_(rowValues, table.headers, 'Current Status', followUp.currentStatus);
  setIfHeader_(rowValues, table.headers, 'Follow-Up Type', followUp.followUpType);
  setIfHeader_(rowValues, table.headers, 'Due Date', followUp.dueDate);
  setIfHeader_(rowValues, table.headers, 'Days Until Due', daysUntil_(followUp.dueDate));
  setIfHeader_(rowValues, table.headers, 'Priority', followUp.priority);
  setIfHeader_(rowValues, table.headers, 'Assigned To', followUp.assignedTo);
  setIfHeader_(rowValues, table.headers, 'Notes', followUp.notes);
  setIfHeader_(rowValues, table.headers, 'Completed', false);
  setIfHeader_(rowValues, table.headers, 'Completed Date', '');

  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
  formatFollowUpsSheet_(sheet, table.headers);

  return {
    created: !existing,
    updated: !!existing,
    rowNumber: targetRow,
    followUpType: followUp.followUpType
  };
}

function findOpenFollowUp_(sheet, headers, followUp) {
  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return null;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  const companyKey = normalizeLookupKey_(followUp.company);
  const prospectId = String(followUp.relatedProspectId || '').trim();
  const clientId = String(followUp.relatedClientId || '').trim();
  const type = String(followUp.followUpType || '').trim();

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const completed = isFollowUpCompletedValue_(getValueByHeader_(row, headers, 'Completed'));
    if (completed) {
      continue;
    }

    const rowCompanyKey = normalizeLookupKey_(getValueByHeader_(row, headers, 'Company'));
    const rowProspectId = String(getValueByHeader_(row, headers, 'Related Prospect ID') || '').trim();
    const rowClientId = String(getValueByHeader_(row, headers, 'Related Client ID') || '').trim();
    const rowType = String(getValueByHeader_(row, headers, 'Follow-Up Type') || '').trim();
    const sameRecord = (prospectId && rowProspectId === prospectId) ||
      (clientId && rowClientId === clientId) ||
      (companyKey && rowCompanyKey === companyKey);

    if (sameRecord && rowType === type) {
      return {
        rowNumber: dataStartRow + index,
        values: row
      };
    }
  }

  return null;
}

function completeOpenFollowUpsForCompany_(ss, company) {
  const sheet = getOrCreateFollowUpsSheet_(ss);
  const table = ensureFollowUpColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return 0;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  const companyKey = normalizeLookupKey_(company);
  let completed = 0;
  values.forEach(function(row, index) {
    if (isFollowUpCompletedValue_(getValueByHeader_(row, table.headers, 'Completed'))) {
      return;
    }
    if (normalizeLookupKey_(getValueByHeader_(row, table.headers, 'Company')) !== companyKey) {
      return;
    }

    markFollowUpRowCompleted_(sheet, table.headers, dataStartRow + index);
    completed += 1;
  });

  return completed;
}

function markFollowUpRowCompleted_(sheet, headers, rowNumber) {
  if (headers.Completed) {
    sheet.getRange(rowNumber, headers.Completed).setValue(true);
  }
  if (headers['Completed Date']) {
    sheet.getRange(rowNumber, headers['Completed Date']).setValue(new Date()).setNumberFormat('yyyy-mm-dd');
  }
}

function refreshFollowUpDaysUntilDue_(sheet, headers) {
  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0 || !headers['Due Date'] || !headers['Days Until Due']) {
    return;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  const output = values.map(function(row) {
    return [daysUntil_(getValueByHeader_(row, headers, 'Due Date'))];
  });
  sheet.getRange(dataStartRow, headers['Days Until Due'], output.length, 1).setValues(output);
}

function formatFollowUpsSheet_(sheet, headers) {
  const headerRow = findBestHeaderRow_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), FOLLOW_UP_COLUMNS.length);
  sheet.setHiddenGridlines(true);
  safeSetFrozenRows_(sheet, headerRow);
  sheet.setTabColor(ROGERS_OS_THEME.gold);
  applyOperatingSystemSheetChrome_(sheet, 'FOLLOW-UPS', headerRow, lastColumn);
  sheet.getRange(headerRow, 1, 1, lastColumn)
    .setBackground(ROGERS_OS_THEME.black)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  if (headers['Due Date']) {
    sheet.getRange(1, headers['Due Date'], Math.max(sheet.getMaxRows(), 1), 1).setNumberFormat('yyyy-mm-dd');
  }
  if (headers['Completed Date']) {
    sheet.getRange(1, headers['Completed Date'], Math.max(sheet.getMaxRows(), 1), 1).setNumberFormat('yyyy-mm-dd');
  }
  setColumnWidthIfHeader_(sheet, headers, 'Follow-Up ID', 160);
  setColumnWidthIfHeader_(sheet, headers, 'Company', 210);
  setColumnWidthIfHeader_(sheet, headers, 'Contact', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Email', 220);
  setColumnWidthIfHeader_(sheet, headers, 'Current Status', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Follow-Up Type', 180);
  setColumnWidthIfHeader_(sheet, headers, 'Due Date', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Days Until Due', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Priority', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Assigned To', 170);
  setColumnWidthIfHeader_(sheet, headers, 'Notes', 360);
  setColumnWidthIfHeader_(sheet, headers, 'Completed', 110);
  setColumnWidthIfHeader_(sheet, headers, 'Completed Date', 130);
  applyAlternatingRows_(sheet, headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, headerRow, lastRow, lastColumn);
  applyVisualComfortBody_(sheet, headerRow + 1, lastRow, lastColumn, {
    rowHeight: 34
  });
  applyWrapByHeader_(sheet, headers, headerRow, lastRow, ['Notes']);
  applyColumnFormattingByHeader_(sheet, headers, headerRow, lastRow, {
    'Due Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Days Until Due': { horizontalAlignment: 'center', numberFormat: '0' },
    Priority: { horizontalAlignment: 'center' },
    Completed: { horizontalAlignment: 'center' },
    'Completed Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' }
  });
  applyFollowUpPriorityColors_(sheet, headers, headerRow, lastRow);
  sheet.setRowHeights(headerRow + 1, Math.max(lastRow - headerRow, 1), 34);
}

function getFollowUpMetrics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FOLLOW_UPS_SHEET);
  const metrics = {
    today: 0,
    overdue: 0,
    dueThisWeek: 0,
    completedToday: 0
  };
  if (!sheet) {
    return metrics;
  }

  const table = ensureFollowUpColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return metrics;
  }

  const today = startOfDay_(new Date());
  const weekEnd = startOfDay_(new Date());
  weekEnd.setDate(weekEnd.getDate() + 7);
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row) {
    const completed = isFollowUpCompletedValue_(getValueByHeader_(row, table.headers, 'Completed'));
    const dueDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date'));
    const completedDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Completed Date'));

    if (completedDate && startOfDay_(completedDate).getTime() === today.getTime()) {
      metrics.completedToday += 1;
    }
    if (completed || !dueDate) {
      return;
    }

    const normalizedDue = startOfDay_(dueDate);
    if (normalizedDue.getTime() === today.getTime()) {
      metrics.today += 1;
    }
    if (normalizedDue.getTime() < today.getTime()) {
      metrics.overdue += 1;
    }
    if (normalizedDue.getTime() >= today.getTime() && normalizedDue.getTime() <= weekEnd.getTime()) {
      metrics.dueThisWeek += 1;
    }
  });

  return metrics;
}

function getFollowUpsForCompany_(ss, company, limit) {
  const sheet = ss.getSheetByName(FOLLOW_UPS_SHEET);
  if (!sheet || !company) {
    return [];
  }

  const table = ensureFollowUpColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const companyKey = normalizeLookupKey_(company);
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  return values.map(function(row) {
    return {
      id: getValueByHeader_(row, table.headers, 'Follow-Up ID'),
      company: getValueByHeader_(row, table.headers, 'Company'),
      type: getValueByHeader_(row, table.headers, 'Follow-Up Type'),
      dueDate: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date')),
      priority: getValueByHeader_(row, table.headers, 'Priority'),
      notes: getValueByHeader_(row, table.headers, 'Notes'),
      completed: isFollowUpCompletedValue_(getValueByHeader_(row, table.headers, 'Completed')),
      completedDate: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Completed Date'))
    };
  }).filter(function(item) {
    return normalizeLookupKey_(item.company) === companyKey;
  }).sort(function(a, b) {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return dateSortValue_(a.dueDate) - dateSortValue_(b.dueDate);
  }).slice(0, limit || 8);
}

function generateFollowUpId_(company) {
  const clean = String(company || 'FOLLOWUP').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'FOLLOWUP';
  return `FU-${clean}-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss')}`;
}

function daysUntil_(dateValue) {
  const date = dateValueOrNull_(dateValue);
  if (!date) {
    return '';
  }
  const today = startOfDay_(new Date()).getTime();
  return Math.round((startOfDay_(date).getTime() - today) / 86400000);
}

function isFollowUpCompletedValue_(value) {
  const text = String(value || '').trim().toLowerCase();
  return value === true || text === 'true' || text === 'yes' || text === 'completed';
}

function createProject() {
  const context = getSelectedProjectSourceContext_(true);
  if (!context) {
    return;
  }

  const result = upsertProjectFromClient_(context.ss, context.client, {
    status: 'Planning',
    notes: 'Project created manually.'
  });
  logPipelineActivity_(context.ss, context.client.company, result.created ? 'Project Created' : 'Project Updated', result.created ? 'Project created from selected client.' : 'Existing project updated from selected client.');
  refreshSalesOperatingSystem_();
  SpreadsheetApp.getUi().alert('Rogers Holdings OS', result.created ? 'Project created.' : 'Existing project updated.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function updateProjectStatus() {
  const context = getSelectedProjectContext_(true);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt(
    'Update Project Status',
    `Enter status: ${PROJECT_STATUSES.join(', ')}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const status = normalizeProjectStatus_(prompt.getResponseText());
  if (!status) {
    ui.alert('Rogers Holdings OS', 'Enter a valid project status, then run Update Project Status again.', ui.ButtonSet.OK);
    return;
  }

  updateProjectRowStatus_(context.sheet, context.headers, context.rowNumber, status);
  logProjectStatusActivity_(context.ss, context.company, status);
  if (status === 'Completed') {
    logPipelineActivity_(context.ss, context.company, 'Deliverable Completed', getProjectDeliverableActivityNotes_(context.values, context.headers));
  }
  refreshSalesOperatingSystem_();
  ui.alert('Rogers Holdings OS', `Project status updated to ${status}.`, ui.ButtonSet.OK);
}

function completeProject() {
  const context = getSelectedProjectContext_(true);
  if (!context) {
    return;
  }

  updateProjectRowStatus_(context.sheet, context.headers, context.rowNumber, 'Completed');
  logPipelineActivity_(context.ss, context.company, 'Project Completed', 'Project marked completed.');
  logPipelineActivity_(context.ss, context.company, 'Deliverable Completed', getProjectDeliverableActivityNotes_(context.values, context.headers));
  refreshSalesOperatingSystem_();
  SpreadsheetApp.getUi().alert('Rogers Holdings OS', 'Project completed.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function refreshProjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateProjectsSheet_(ss);
  const table = ensureProjectColumns_(sheet);
  createProjectsForActiveClients_(ss);
  refreshProjectProgressFormatting_(sheet, table.headers);
  formatProjectsSheet_(sheet, table.headers);
}

function getOrCreateProjectsSheet_(ss) {
  let sheet = ss.getSheetByName(PROJECTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PROJECTS_SHEET);
  }

  ensureProjectColumns_(sheet);
  return sheet;
}

function ensureProjectColumns_(sheet) {
  if (sheet.getMaxColumns() < PROJECT_COLUMNS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), PROJECT_COLUMNS.length - sheet.getMaxColumns());
  }
  const headerRow = findBestHeaderRow_(sheet);
  const headerValues = sheet.getRange(headerRow, 1, 1, Math.max(sheet.getLastColumn(), PROJECT_COLUMNS.length)).getValues()[0];
  const headers = {};

  headerValues.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (header && !headers[header]) {
      headers[header] = index + 1;
    }
  });

  if (!Object.keys(headers).length) {
    sheet.getRange(headerRow, 1, 1, PROJECT_COLUMNS.length).setValues([PROJECT_COLUMNS]);
    PROJECT_COLUMNS.forEach(function(header, index) {
      headers[header] = index + 1;
    });
  }

  let lastColumn = Math.max(sheet.getLastColumn(), 1);
  PROJECT_COLUMNS.forEach(function(header) {
    if (headers[header]) {
      return;
    }
    lastColumn += 1;
    sheet.getRange(headerRow, lastColumn).setValue(header);
    headers[header] = lastColumn;
  });

  sheet.getRange(headerRow, 1, 1, lastColumn)
    .setBackground(ROGERS_OS_THEME.black)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(headerRow);
  sheet.setTabColor(ROGERS_OS_THEME.charcoal);

  return {
    headerRow: headerRow,
    headers: headers,
    lastColumn: lastColumn
  };
}

function createProjectsForActiveClients_(ss) {
  const clientsSheet = ss.getSheetByName(CLIENTS_SHEET);
  if (!clientsSheet) {
    return;
  }

  const table = ensureClientColumns_(clientsSheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(clientsSheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return;
  }

  const values = clientsSheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row) {
    const status = String(getValueByHeader_(row, table.headers, 'Status') || '').trim();
    if (status !== 'Active') {
      return;
    }

    const client = buildProjectClientModel_(row, table.headers);
    if (client.company) {
      const result = upsertProjectFromClient_(ss, client, { status: 'Planning', notes: 'Project verified from active client.' });
      if (result.created) {
        logPipelineActivity_(ss, client.company, 'Project Created', 'Project created automatically from active client.');
      }
    }
  });
}

function upsertProjectFromClient_(ss, client, options) {
  const sheet = getOrCreateProjectsSheet_(ss);
  const table = ensureProjectColumns_(sheet);
  const existing = findExistingProject_(sheet, table.headers, client.clientId, client.company, client.service);
  const targetRow = existing ? existing.rowNumber : Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  const rowValues = existing
    ? existing.values.concat(new Array(Math.max(table.lastColumn - existing.values.length, 0)).fill('')).slice(0, table.lastColumn)
    : new Array(table.lastColumn).fill('');
  const settings = options || {};
  const now = new Date();
  const startDate = client.startDate || startOfDay_(new Date());
  const status = existing ? getValueByHeader_(rowValues, table.headers, 'Status') || settings.status || 'Planning' : settings.status || 'Planning';
  const projectId = getValueByHeader_(rowValues, table.headers, 'Project ID') || generateProjectId_(client.company);

  setIfHeader_(rowValues, table.headers, 'Project ID', projectId);
  setIfHeader_(rowValues, table.headers, 'Client ID', client.clientId);
  setIfHeader_(rowValues, table.headers, 'Client', client.company);
  setIfHeader_(rowValues, table.headers, 'Service', client.service);
  setIfHeader_(rowValues, table.headers, 'Package', client.packageName);
  setIfHeader_(rowValues, table.headers, 'Status', status);
  setIfHeader_(rowValues, table.headers, 'Priority', client.priority || 'B - Good');
  setIfHeader_(rowValues, table.headers, 'Start Date', startDate);
  setIfHeader_(rowValues, table.headers, 'Due Date', client.dueDate || addDaysFromDate_(startDate, 30));
  setIfHeader_(rowValues, table.headers, 'Progress %', getProjectProgressForStatus_(status));
  setIfHeader_(rowValues, table.headers, 'Assigned To', client.assignedTo || getRogersContactInfo_().name);
  setIfHeader_(rowValues, table.headers, 'Current Phase', status);
  setIfHeader_(rowValues, table.headers, 'Deliverables', inferProjectDeliverables_(client.service));
  setIfHeader_(rowValues, table.headers, 'Folder', getClientProjectFolderUrl_(client.company));
  setIfHeader_(rowValues, table.headers, 'Notes', firstNonBlank_([settings.notes, getValueByHeader_(rowValues, table.headers, 'Notes')]));
  setIfHeader_(rowValues, table.headers, 'Last Updated', now);

  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
  formatProjectsSheet_(sheet, table.headers);

  return {
    created: !existing,
    updated: !!existing,
    rowNumber: targetRow,
    projectId: projectId
  };
}

function findExistingProject_(sheet, headers, clientId, company, service) {
  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return null;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  const clientKey = String(clientId || '').trim();
  const companyKey = normalizeLookupKey_(company);
  const serviceKey = normalizeLookupKey_(service);
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const rowStatus = String(getValueByHeader_(row, headers, 'Status') || '').trim();
    if (rowStatus === 'Completed' || rowStatus === 'Cancelled') {
      continue;
    }
    const rowClientId = String(getValueByHeader_(row, headers, 'Client ID') || '').trim();
    const rowCompanyKey = normalizeLookupKey_(getValueByHeader_(row, headers, 'Client'));
    const rowServiceKey = normalizeLookupKey_(getValueByHeader_(row, headers, 'Service'));
    const sameClient = (clientKey && rowClientId === clientKey) || (companyKey && rowCompanyKey === companyKey);
    if (sameClient && (!serviceKey || !rowServiceKey || rowServiceKey === serviceKey)) {
      return {
        rowNumber: dataStartRow + index,
        values: row
      };
    }
  }

  return null;
}

function buildProjectClientModel_(row, headers) {
  const company = firstNonBlank_([
    getValueByHeader_(row, headers, 'Company'),
    getValueByHeader_(row, headers, 'Client Name')
  ]);
  const service = firstNonBlank_([
    getValueByHeader_(row, headers, 'Service Package'),
    getValueByHeader_(row, headers, 'Service'),
    getValueByHeader_(row, headers, 'Current Project')
  ]);

  return {
    clientId: getValueByHeader_(row, headers, 'Client ID'),
    company: company,
    service: service || 'Consulting',
    packageName: service || 'Business Systems',
    priority: getValueByHeader_(row, headers, 'Priority Tier'),
    startDate: dateValueOrNull_(getValueByHeader_(row, headers, 'Start Date') || getValueByHeader_(row, headers, 'Client Since')),
    dueDate: dateValueOrNull_(getValueByHeader_(row, headers, 'Due Date')),
    assignedTo: getValueByHeader_(row, headers, 'Assigned To')
  };
}

function getSelectedProjectSourceContext_(showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();
  if (!sheet || sheet.getName() !== CLIENTS_SHEET) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a client row on the Clients sheet before creating a project.', ui.ButtonSet.OK);
    }
    return null;
  }

  const table = ensureClientColumns_(sheet);
  const rowNumber = sheet.getActiveRange() ? sheet.getActiveRange().getRow() : 0;
  if (rowNumber <= table.headerRow) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a client data row below the header.', ui.ButtonSet.OK);
    }
    return null;
  }

  const values = sheet.getRange(rowNumber, 1, 1, table.lastColumn).getValues()[0];
  const client = buildProjectClientModel_(values, table.headers);
  if (!client.company) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'The selected client row is missing Company.', ui.ButtonSet.OK);
    }
    return null;
  }

  return {
    ss: ss,
    client: client
  };
}

function getSelectedProjectContext_(showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();
  if (!sheet || sheet.getName() !== PROJECTS_SHEET) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a project row on the Projects sheet.', ui.ButtonSet.OK);
    }
    return null;
  }

  const table = ensureProjectColumns_(sheet);
  const rowNumber = sheet.getActiveRange() ? sheet.getActiveRange().getRow() : 0;
  if (rowNumber <= table.headerRow) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a project data row below the header.', ui.ButtonSet.OK);
    }
    return null;
  }

  const values = sheet.getRange(rowNumber, 1, 1, table.lastColumn).getValues()[0];
  const company = getValueByHeader_(values, table.headers, 'Client');
  return {
    ss: ss,
    sheet: sheet,
    headers: table.headers,
    rowNumber: rowNumber,
    values: values,
    company: company
  };
}

function updateProjectRowStatus_(sheet, headers, rowNumber, status) {
  setIfHeaderCell_(sheet, headers, rowNumber, 'Status', status);
  setIfHeaderCell_(sheet, headers, rowNumber, 'Current Phase', status);
  setIfHeaderCell_(sheet, headers, rowNumber, 'Progress %', getProjectProgressForStatus_(status));
  setIfHeaderCell_(sheet, headers, rowNumber, 'Last Updated', new Date());
}

function logProjectStatusActivity_(ss, company, status) {
  if (status === 'Completed') {
    logPipelineActivity_(ss, company, 'Project Completed', 'Project marked completed.');
  } else if (status === 'Cancelled') {
    logPipelineActivity_(ss, company, 'Project Cancelled', 'Project marked cancelled.');
  } else {
    logPipelineActivity_(ss, company, 'Project Updated', `Project status updated to ${status}.`);
  }
}

function getProjectMetrics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PROJECTS_SHEET);
  const metrics = {
    activeProjects: 0,
    dueThisWeek: 0,
    overdueProjects: 0,
    completedThisMonth: 0,
    averageCompletionTime: 0
  };
  if (!sheet) {
    return metrics;
  }

  const table = ensureProjectColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return metrics;
  }

  const today = startOfDay_(new Date());
  const weekEnd = startOfDay_(new Date());
  weekEnd.setDate(weekEnd.getDate() + 7);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  let completionDaysTotal = 0;
  let completionCount = 0;

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row) {
    const status = String(getValueByHeader_(row, table.headers, 'Status') || '').trim();
    const dueDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date'));
    const startDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Start Date'));
    const lastUpdated = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Last Updated'));
    const isActive = status && status !== 'Completed' && status !== 'Cancelled' && status !== 'Maintenance';
    if (isActive) {
      metrics.activeProjects += 1;
    }
    if (isActive && dueDate) {
      const due = startOfDay_(dueDate);
      if (due.getTime() < today.getTime()) {
        metrics.overdueProjects += 1;
      }
      if (due.getTime() >= today.getTime() && due.getTime() <= weekEnd.getTime()) {
        metrics.dueThisWeek += 1;
      }
    }
    if (status === 'Completed' && lastUpdated && lastUpdated.getMonth() === currentMonth && lastUpdated.getFullYear() === currentYear) {
      metrics.completedThisMonth += 1;
      if (startDate) {
        completionDaysTotal += Math.max(Math.round((startOfDay_(lastUpdated).getTime() - startOfDay_(startDate).getTime()) / 86400000), 0);
        completionCount += 1;
      }
    }
  });

  metrics.averageCompletionTime = completionCount ? completionDaysTotal / completionCount : 0;
  return metrics;
}

function getProjectsForClient_(ss, clientId, company, limit) {
  const sheet = ss.getSheetByName(PROJECTS_SHEET);
  if (!sheet) {
    return [];
  }
  const table = ensureProjectColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const clientKey = String(clientId || '').trim();
  const companyKey = normalizeLookupKey_(company);
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  return values.map(function(row) {
    return {
      projectId: getValueByHeader_(row, table.headers, 'Project ID'),
      clientId: getValueByHeader_(row, table.headers, 'Client ID'),
      client: getValueByHeader_(row, table.headers, 'Client'),
      service: getValueByHeader_(row, table.headers, 'Service'),
      packageName: getValueByHeader_(row, table.headers, 'Package'),
      status: getValueByHeader_(row, table.headers, 'Status'),
      priority: getValueByHeader_(row, table.headers, 'Priority'),
      startDate: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Start Date')),
      dueDate: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date')),
      progress: getValueByHeader_(row, table.headers, 'Progress %'),
      currentPhase: getValueByHeader_(row, table.headers, 'Current Phase'),
      deliverables: getValueByHeader_(row, table.headers, 'Deliverables'),
      folder: getValueByHeader_(row, table.headers, 'Folder'),
      notes: getValueByHeader_(row, table.headers, 'Notes'),
      lastUpdated: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Last Updated'))
    };
  }).filter(function(project) {
    return (clientKey && String(project.clientId || '').trim() === clientKey) ||
      (companyKey && normalizeLookupKey_(project.client) === companyKey);
  }).sort(function(a, b) {
    return dateSortValue_(b.lastUpdated) - dateSortValue_(a.lastUpdated);
  }).slice(0, limit || 5);
}

function formatProjectsSheet_(sheet, headers) {
  const headerRow = findBestHeaderRow_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), PROJECT_COLUMNS.length);
  sheet.setHiddenGridlines(true);
  safeSetFrozenRows_(sheet, headerRow);
  sheet.setTabColor(ROGERS_OS_THEME.charcoal);
  applyOperatingSystemSheetChrome_(sheet, 'PROJECTS', headerRow, lastColumn);
  sheet.getRange(headerRow, 1, 1, lastColumn)
    .setBackground(ROGERS_OS_THEME.black)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setColumnWidthIfHeader_(sheet, headers, 'Project ID', 160);
  setColumnWidthIfHeader_(sheet, headers, 'Client ID', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Client', 220);
  setColumnWidthIfHeader_(sheet, headers, 'Service', 170);
  setColumnWidthIfHeader_(sheet, headers, 'Package', 190);
  setColumnWidthIfHeader_(sheet, headers, 'Status', 150);
  setColumnWidthIfHeader_(sheet, headers, 'Priority', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Start Date', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Due Date', 120);
  setColumnWidthIfHeader_(sheet, headers, 'Progress %', 110);
  setColumnWidthIfHeader_(sheet, headers, 'Assigned To', 170);
  setColumnWidthIfHeader_(sheet, headers, 'Current Phase', 160);
  setColumnWidthIfHeader_(sheet, headers, 'Deliverables', 260);
  setColumnWidthIfHeader_(sheet, headers, 'Folder', 240);
  setColumnWidthIfHeader_(sheet, headers, 'Notes', 340);
  setColumnWidthIfHeader_(sheet, headers, 'Last Updated', 150);
  applyColumnFormattingByHeader_(sheet, headers, headerRow, lastRow, {
    'Start Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Due Date': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    'Progress %': { horizontalAlignment: 'center', numberFormat: '0%' },
    Status: { horizontalAlignment: 'center' },
    Priority: { horizontalAlignment: 'center' },
    'Last Updated': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd hh:mm' }
  });
  applyAlternatingRows_(sheet, headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, headerRow, lastRow, lastColumn);
  applyVisualComfortBody_(sheet, headerRow + 1, lastRow, lastColumn, {
    rowHeight: 36
  });
  applyProjectStatusColors_(sheet, headers, headerRow, lastRow);
  applyWrapByHeader_(sheet, headers, headerRow, lastRow, ['Deliverables', 'Folder', 'Notes']);
  applyProjectValidation_(sheet, headers, headerRow);
  sheet.setRowHeights(headerRow + 1, Math.max(lastRow - headerRow, 1), 36);
}

function applyFollowUpPriorityColors_(sheet, headers, headerRow, lastRow) {
  if (!headers.Priority || lastRow <= headerRow) {
    return;
  }
  const rowCount = lastRow - headerRow;
  const values = sheet.getRange(headerRow + 1, headers.Priority, rowCount, 1).getValues();
  const colors = values.map(function(row) {
    const value = String(row[0] || '').toLowerCase();
    if (value.indexOf('hot') !== -1 || value === 'a') {
      return ['#f4cccc'];
    }
    if (value.indexOf('good') !== -1 || value === 'b') {
      return ['#fff2cc'];
    }
    return ['#d9ead3'];
  });
  sheet.getRange(headerRow + 1, headers.Priority, rowCount, 1).setBackgrounds(colors);
}

function applyProjectStatusColors_(sheet, headers, headerRow, lastRow) {
  if (!headers.Status || lastRow <= headerRow) {
    return;
  }
  const rowCount = lastRow - headerRow;
  const values = sheet.getRange(headerRow + 1, headers.Status, rowCount, 1).getValues();
  const colors = values.map(function(row) {
    const status = String(row[0] || '').trim();
    if (status === 'Completed' || status === 'Maintenance') {
      return ['#d9ead3'];
    }
    if (status === 'Cancelled') {
      return ['#f4cccc'];
    }
    if (status === 'Waiting on Client' || status === 'Review') {
      return ['#fff2cc'];
    }
    return ['#d9eaf7'];
  });
  sheet.getRange(headerRow + 1, headers.Status, rowCount, 1).setBackgrounds(colors);
}

function applyProjectValidation_(sheet, headers, headerRow) {
  const rowCount = Math.max(sheet.getMaxRows() - headerRow, 1);
  if (headers.Status) {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PROJECT_STATUSES, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(headerRow + 1, headers.Status, rowCount, 1).setDataValidation(statusRule);
  }
  if (headers.Deliverables) {
    const deliverableRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PROJECT_DELIVERABLE_TYPES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(headerRow + 1, headers.Deliverables, rowCount, 1).setDataValidation(deliverableRule);
  }
}

function getProjectDeliverableActivityNotes_(values, headers) {
  const deliverables = getValueByHeader_(values, headers, 'Deliverables') || 'Project deliverables';
  return `${deliverables} marked complete.`;
}

function refreshProjectProgressFormatting_(sheet, headers) {
  const headerRow = findBestHeaderRow_(sheet);
  const dataStartRow = headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0 || !headers.Status || !headers['Progress %']) {
    return;
  }
  const statuses = sheet.getRange(dataStartRow, headers.Status, rowCount, 1).getValues();
  const progressValues = statuses.map(function(row) {
    return [getProjectProgressForStatus_(row[0])];
  });
  sheet.getRange(dataStartRow, headers['Progress %'], progressValues.length, 1).setValues(progressValues);
}

function normalizeProjectStatus_(value) {
  const text = String(value || '').trim().toLowerCase();
  return PROJECT_STATUSES.filter(function(status) {
    return status.toLowerCase() === text;
  })[0] || '';
}

function getProjectProgressForStatus_(status) {
  const progress = {
    Planning: 0.05,
    Discovery: 0.15,
    'In Progress': 0.5,
    'Waiting on Client': 0.65,
    Review: 0.85,
    Completed: 1,
    Maintenance: 1,
    Cancelled: 0
  };
  return progress[normalizeProjectStatus_(status) || status] || 0.05;
}

function inferProjectDeliverables_(service) {
  const text = String(service || '').toLowerCase();
  const deliverables = [];
  if (text.indexOf('website') !== -1) {
    deliverables.push('Website');
  }
  if (text.indexOf('seo') !== -1 || text.indexOf('google') !== -1) {
    deliverables.push(text.indexOf('google') !== -1 ? 'Google Business' : 'SEO');
  }
  if (text.indexOf('automation') !== -1 || text.indexOf('system') !== -1) {
    deliverables.push('Automation');
  }
  if (text.indexOf('consult') !== -1) {
    deliverables.push('Consulting');
  }
  return deliverables.length ? deliverables.join(', ') : 'Consulting';
}

function getClientProjectFolderUrl_(company) {
  const folderName = sanitizeDriveFileName_(company || '');
  if (!folderName) {
    return '';
  }
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next().getUrl() : '';
}

function generateProjectId_(company) {
  const clean = String(company || 'PROJECT').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'PROJECT';
  return `PRJ-${clean}-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss')}`;
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
    } else if (status === 'Executive Snapshot Sent') {
      completedAction = runExecutiveSnapshotSentNextAction_(context);
    } else if (status === 'Discovery Meeting Scheduled') {
      completedAction = runDiscoveryMeetingNextAction_(context);
    } else if (status === 'Digital Business Assessment Presented') {
      completedAction = runDigitalBusinessAssessmentNextAction_(context);
    } else if (status === 'Improvement Plan Sent') {
      completedAction = promptImprovementPlanOutcome_(context);
    } else if (status === 'Project Started' || status === 'Client') {
      completedAction = openOrCreateClientFromNextAction_(context);
    } else if (status === 'Lost') {
      completedAction = archiveLostProspectFromNextAction_(context);
    } else if (status === 'Nurture') {
      completedAction = scheduleNextActionFollowUp_(context);
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
  generateExecutiveSnapshot();
  return 'Generated the Executive Snapshot.';
}

function runExecutiveSnapshotSentNextAction_(context) {
  if (isHeaderMarkedYesForNextAction_(context, 'Gmail Draft Created')) {
    return promptScheduleDiscoveryFromNextAction_(context);
  }

  createOutreachGmailDraft();
  return 'Created the outreach draft.';
}

function runDigitalBusinessAssessmentNextAction_(context) {
  generateProposal();
  return 'Generated the Improvement Plan.';
}

function runDiscoveryMeetingNextAction_(context) {
  if (isAuditPackageAlreadyGeneratedForNextAction_(context)) {
    return 'Digital Business Assessment already existed. Present it during the discovery meeting.';
  }

  generateAuditPackage();
  return 'Generated the Digital Business Assessment.';
}

function runDefaultNextAction_(context, status) {
  if (status === 'Follow Up Due') {
    return promptFollowUpOutcome_(context);
  }

  if (status === 'Draft Created' || status === 'Email Sent') {
    return promptScheduleDiscoveryFromNextAction_(context);
  }

  if (status === 'Audit Complete' || status === 'Audit Package Sent') {
    return runDiscoveryMeetingNextAction_(context);
  }

  if (status === 'Proposal Sent') {
    return promptImprovementPlanOutcome_(context);
  }

  if (status === 'Won') {
    return openOrCreateClientFromNextAction_(context);
  }

  generateExecutiveSnapshot();
  return `Status "${status}" was not mapped, so Rogers Holdings OS generated the Executive Snapshot.`;
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

  setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Nurture');
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
    history + '\n\nEnter next outcome: Snapshot, Discovery, Assessment, Improvement Plan, Client, Lost, Nurture, or Follow Up',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return 'Follow-up history displayed. No outcome was selected.';
  }

  const outcome = String(response.getResponseText() || '').trim().toLowerCase();
  if (outcome === 'snapshot') {
    createOutreachGmailDraft();
    return 'Created a new outreach draft from follow-up outcome.';
  }
  if (outcome === 'assessment') {
    setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Digital Business Assessment Presented');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Generate Improvement Plan');
    updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
    logPipelineActivity_(context.ss, company, 'Digital Business Assessment Presented', 'Follow-up outcome marked as Digital Business Assessment Presented.');
    return 'Marked Digital Business Assessment as presented.';
  }
  if (outcome === 'improvement plan' || outcome === 'plan') {
    setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Improvement Plan Sent');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Convert to Client');
    updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
    logPipelineActivity_(context.ss, company, 'Improvement Plan Sent', 'Follow-up outcome marked as Improvement Plan Sent.');
    return 'Marked Improvement Plan as sent.';
  }
  if (outcome === 'discovery' || outcome === 'meeting') {
    createDiscoveryCall();
    return 'Started Discovery Meeting scheduling.';
  }
  if (outcome === 'client' || outcome === 'won') {
    markProspectWon();
    return 'Converted prospect to Client.';
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
    'Schedule Discovery Meeting',
    `Schedule a discovery meeting for ${company}?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return 'Discovery Meeting scheduling prompt displayed. No meeting was scheduled.';
  }

  createDiscoveryCall();
  return 'Started Discovery Meeting scheduling.';
}

function promptImprovementPlanOutcome_(context) {
  const ui = SpreadsheetApp.getUi();
  const company = String(getValueByHeader_(context.values, context.table.headers, 'Company') || '').trim();
  const response = ui.alert(
    'Improvement Plan Outcome',
    `Convert ${company} to Client?\n\nChoose No to mark Lost, or Cancel to leave unchanged.`,
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (response === ui.Button.YES) {
    markProspectWon();
    return 'Converted prospect to Client after Improvement Plan review.';
  }
  if (response === ui.Button.NO) {
    markProspectLost();
    return 'Marked prospect as Lost after Improvement Plan review.';
  }

  return 'Improvement Plan outcome prompt displayed. No status change was made.';
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
  setSelectedProspectTerminalStage_('Client', 'Client Converted', 'Converted prospect to Client.');
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

function normalizeProspectDropdownWriteValue_(sheet, headers, header, value) {
  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
    return value;
  }

  return normalizeProspectDropdownValue_(sheet, headers, header, value);
}

function normalizeProspectDropdownValue_(sheet, headers, header, value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return value;
  }

  if (header === 'Audit Outcome') {
    return normalizeAuditOutcome_(value, getApprovedProspectDropdownValues_(sheet, headers, header));
  }
  if (header === 'Priority Tier' || header === 'Opportunity Level') {
    return normalizePriorityTier_(value, getApprovedProspectDropdownValues_(sheet, headers, 'Priority Tier'));
  }
  if (header === 'Status') {
    return normalizeProspectStatus_(value, getApprovedProspectDropdownValues_(sheet, headers, header));
  }
  if (header === 'Next Action') {
    return normalizeNextAction_(value, getApprovedProspectDropdownValues_(sheet, headers, header));
  }
  if (header === 'Offer / Service') {
    return normalizeOfferService_(value, getApprovedProspectDropdownValues_(sheet, headers, header));
  }
  if (header === 'Moved to CRM') {
    return normalizeMovedToCrm_(value, getApprovedProspectDropdownValues_(sheet, headers, header));
  }

  return value;
}

function normalizeAuditOutcome_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidatesByKey = {
    'high opportunity': ['Strong Fit', 'Good Fit'],
    high: ['Strong Fit', 'Good Fit'],
    'strong digital foundation': ['Strong Fit', 'Good Fit'],
    'very strong': ['Strong Fit', 'Good Fit'],
    'good foundation with visibility and conversion opportunities': ['Good Fit'],
    'basic visibility opportunity with trust improvements needed': ['Needs Nurture', 'Good Fit'],
    medium: ['Good Fit', 'Needs Nurture'],
    moderate: ['Good Fit', 'Needs Nurture'],
    low: ['Needs Nurture', 'Poor Fit'],
    nurture: ['Needs Nurture'],
    'needs nurture': ['Needs Nurture'],
    'poor fit': ['Poor Fit'],
    'not audited': ['Not Audited']
  };
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Audit Outcome'),
    (candidatesByKey[key] || [text]).concat(['Good Fit', 'Needs Nurture', 'Not Audited']),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function normalizePriorityTier_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidatesByKey = {
    high: ['A - Hot'],
    'high opportunity': ['A - Hot'],
    hot: ['A - Hot'],
    a: ['A - Hot'],
    'a - hot': ['A - Hot'],
    medium: ['B - Good'],
    moderate: ['B - Good'],
    good: ['B - Good'],
    b: ['B - Good'],
    'b - good': ['B - Good'],
    low: ['C - Later'],
    later: ['C - Later'],
    c: ['C - Later'],
    'c - later': ['C - Later']
  };
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Priority Tier'),
    (candidatesByKey[key] || [text]).concat(['B - Good', 'A - Hot', 'C - Later']),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function normalizeProspectStatus_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidatesByKey = {
    draft: ['Executive Snapshot Sent'],
    'draft created': ['Executive Snapshot Sent'],
    'gmail draft created': ['Executive Snapshot Sent'],
    'executive snapshot generated': ['Executive Snapshot Sent'],
    'executive snapshot sent': ['Executive Snapshot Sent'],
    audited: ['Digital Business Assessment Presented'],
    'audit complete': ['Digital Business Assessment Presented'],
    'audit completed': ['Digital Business Assessment Presented'],
    'audit package sent': ['Digital Business Assessment Presented'],
    'package sent': ['Digital Business Assessment Presented'],
    'digital business assessment presented': ['Digital Business Assessment Presented'],
    discovery: ['Discovery Meeting Scheduled'],
    'discovery scheduled': ['Discovery Meeting Scheduled'],
    'discovery meeting scheduled': ['Discovery Meeting Scheduled'],
    'proposal sent': ['Improvement Plan Sent'],
    proposal: ['Improvement Plan Sent'],
    'improvement plan sent': ['Improvement Plan Sent'],
    'follow up due': ['Nurture'],
    won: ['Client'],
    active: ['Client'],
    client: ['Client'],
    'project started': ['Project Started'],
    archived: ['Lost']
  };
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Status'),
    (candidatesByKey[key] || [text]).concat(['Lead Found']),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function normalizeNextAction_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidatesByKey = {
    'generate executive snapshot': ['Generate Executive Snapshot'],
    snapshot: ['Generate Executive Snapshot'],
    'review email': ['Create Outreach Draft', 'Follow Up'],
    'review gmail draft': ['Create Outreach Draft', 'Follow Up'],
    'send email': ['Create Outreach Draft'],
    'send intro': ['Create Outreach Draft'],
    'send intro email': ['Create Outreach Draft'],
    'create outreach draft': ['Create Outreach Draft'],
    'send proposal': ['Generate Improvement Plan'],
    proposal: ['Generate Improvement Plan'],
    'generate improvement plan': ['Generate Improvement Plan'],
    'schedule discovery': ['Schedule Discovery Meeting', 'Follow Up'],
    'schedule discovery call': ['Schedule Discovery Meeting', 'Follow Up'],
    'schedule discovery meeting': ['Schedule Discovery Meeting', 'Follow Up'],
    'conduct discovery call': ['Present Digital Business Assessment'],
    'present digital business assessment': ['Present Digital Business Assessment'],
    discovery: ['Schedule Discovery Meeting'],
    'convert to client': ['Convert to Client'],
    'start project': ['Start Project'],
    'follow-up': ['Follow Up'],
    'follow up': ['Follow Up'],
    archived: ['Nurture', 'Follow Up'],
    nurture: ['Nurture']
  };
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Next Action'),
    (candidatesByKey[key] || [text]).concat(['Follow Up', 'Send Intro Email']),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function normalizeOfferService_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidatesByKey = {
    'website and local visibility review': ['Website Audit', 'Local SEO'],
    'website trust and visibility cleanup': ['Website Audit', 'Local SEO'],
    'digital visibility & conversion improvement package': ['Client Website', 'Local SEO', 'Website Audit'],
    'digital visibility and conversion improvement package': ['Client Website', 'Local SEO', 'Website Audit'],
    'growth & optimization review': ['Consulting', 'Local SEO'],
    'growth and optimization review': ['Consulting', 'Local SEO'],
    'google business': ['Google Business Optimization'],
    gbp: ['Google Business Optimization'],
    seo: ['Local SEO'],
    website: ['Client Website', 'Website Audit'],
    automation: ['AI Automation'],
    systems: ['Business Systems'],
    support: ['Monthly Support'],
    project: ['One-Time Project']
  };
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Offer / Service'),
    (candidatesByKey[key] || [text]).concat(['Website Audit', 'Consulting']),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function normalizeMovedToCrm_(value, allowedValues) {
  const text = String(value || '').trim();
  const key = normalizeDropdownValue_(text);
  const candidates = ['yes', 'y', 'true', '1', 'moved', 'converted'].indexOf(key) !== -1
    ? ['Yes']
    : ['No'];
  return chooseAllowedValue_(
    approvedProspectDropdownValues_(allowedValues, 'Moved to CRM'),
    candidates.concat([text]),
    inferAllowedDropdownValue_(allowedValues, text) || text
  );
}

function approvedProspectDropdownValues_(allowedValues, header) {
  return (allowedValues && allowedValues.length)
    ? allowedValues
    : ((PROSPECT_DROPDOWN_DEFAULTS && PROSPECT_DROPDOWN_DEFAULTS[header]) || []);
}

function inferAllowedDropdownValue_(allowedValues, value) {
  const allowed = allowedValues || [];
  const key = normalizeDropdownValue_(value);
  for (let index = 0; index < allowed.length; index += 1) {
    if (normalizeDropdownValue_(allowed[index]) === key) {
      return allowed[index];
    }
  }
  return '';
}

function getApprovedProspectDropdownValues_(sheet, headers, header) {
  if (!sheet || !headers || !headers[header]) {
    return approvedProspectDropdownValues_([], header);
  }

  const table = {
    headerRow: findBestHeaderRow_(sheet),
    headers: headers
  };
  const validationValues = getDropdownAllowedValuesForHeader_(sheet, table, header);
  if (validationValues.length) {
    return validationValues;
  }

  const settingsValues = getSettingsDropdownValuesForHeader_(SpreadsheetApp.getActiveSpreadsheet(), header);
  return settingsValues.length
    ? settingsValues
    : approvedProspectDropdownValues_([], header);
}

function getSettingsDropdownValuesForHeader_(ss, header) {
  const sheet = ss && ss.getSheetByName('Settings');
  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getDisplayValues();
  const targetKey = normalizeDropdownValue_(header);
  for (let row = 0; row < values.length; row += 1) {
    for (let column = 0; column < values[row].length; column += 1) {
      if (normalizeDropdownValue_(values[row][column]) !== targetKey) {
        continue;
      }

      const collected = [];
      for (let nextRow = row + 1; nextRow < values.length; nextRow += 1) {
        const nextValue = String(values[nextRow][column] || '').trim();
        if (!nextValue) {
          break;
        }
        collected.push(nextValue);
      }
      for (let nextColumn = column + 1; nextColumn < values[row].length; nextColumn += 1) {
        const nextValue = String(values[row][nextColumn] || '').trim();
        if (!nextValue) {
          break;
        }
        collected.push(nextValue);
      }
      return uniqueNonBlankValues_(collected);
    }
  }

  return [];
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

  sheet.getRange(row, headers[header]).setValue(normalizeProspectDropdownWriteValue_(sheet, headers, header, value));
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
    activity: getRecentActivityForCompany_(ss, company, 8),
    followUps: getFollowUpsForCompany_(ss, company, 8),
    projects: getProjectsForClient_(ss, getValueByHeader_(values, headers, 'Client ID'), company, 5)
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
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 215);
  sheet.setColumnWidth(3, 26);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 215);
  sheet.setColumnWidth(6, 26);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 215);
  sheet.setColumnWidth(9, 26);
  sheet.setColumnWidth(10, 26);
  sheet.setRowHeights(1, 70, 30);
  sheet.setRowHeight(1, 42);
  sheet.setRowHeight(2, 34);

  sheet.getRange(1, 1, 1, 10).merge().setValue('ROGERS HOLDINGS OS | CLIENT WORKSPACE')
    .setBackground(black)
    .setFontColor(gold)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 1, 1, 10).merge().setValue(model.company || 'No Client Selected')
    .setBackground(black)
    .setFontColor(white)
    .setFontWeight('bold')
    .setFontSize(20)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

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
    ['Project', clientCurrentProjectSummary_(model)],
    ['Project Status', clientCurrentProjectStatus_(model)],
    ['Progress', clientCurrentProjectProgress_(model)],
    ['Due Date', clientCurrentProjectDueDate_(model)],
    ['Deliverables', clientCurrentProjectDeliverables_(model)]
  ]);

  writeClientWorkspaceSection_(sheet, 13, 1, 5, 'Timeline / Recent Activity', clientActivityRows_(model.activity));
  writeClientWorkspaceSection_(sheet, 13, 7, 3, 'Documents', clientDocumentRows_(model));
  writeClientWorkspaceSection_(sheet, 22, 1, 9, 'Project Delivery', clientProjectRows_(model.projects));
  writeClientWorkspaceSection_(sheet, 28, 1, 3, 'Quick Actions', [
    ['Open Client Workspace', 'Use Rogers Holdings OS > Open Client Workspace'],
    ['Refresh Client Workspace', 'Use Rogers Holdings OS > Refresh Client Workspace'],
    ['Open Projects', 'Use Rogers Holdings OS > Open Projects'],
    ['Next Action', 'Use Rogers Holdings OS > Run Next Action']
  ]);
  writeClientWorkspaceSection_(sheet, 28, 5, 5, 'Next Steps', [
    ['Next Follow-Up', clientNextFollowUpSummary_(model.followUps)],
    ['Last Follow-Up', clientLastFollowUpSummary_(model.followUps)],
    ['Current Project', model.currentProject],
    ['Project Status', model.projectStatus],
    ['Due Date', formatDisplayDate_(model.dueDate)],
    ['Last Activity', formatDisplayDate_(model.lastActivity)],
    ['Notes', model.notes]
  ]);
  writeClientWorkspaceSection_(sheet, 39, 1, 9, 'Upcoming Tasks', clientUpcomingTaskRows_(model.followUps));

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
    .setBackground(ROGERS_OS_THEME.charcoal)
    .setFontColor(ROGERS_OS_THEME.gold)
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const output = (rows || []).map(function(row) {
    return [row[0] || '', clientWorkspaceDisplayValue_(row[1])];
  });
  if (!output.length) {
    return;
  }

  sheet.getRange(startRow + 1, startColumn, output.length, 2).setValues(output);
  sheet.getRange(startRow + 1, startColumn, output.length, 1)
    .setFontWeight('bold')
    .setFontColor(ROGERS_OS_THEME.muted)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
  sheet.getRange(startRow + 1, startColumn + 1, output.length, Math.max(valueColumnSpan, 1))
    .setBackground(ROGERS_OS_THEME.softNeutral)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
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

function clientCurrentProject_(model) {
  return (model.projects || []).filter(function(project) {
    return project.status !== 'Completed' && project.status !== 'Cancelled';
  })[0] || (model.projects || [])[0] || null;
}

function clientCurrentProjectSummary_(model) {
  const project = clientCurrentProject_(model);
  return project ? `${project.service || project.packageName || 'Project'} (${project.projectId || 'No ID'})` : model.currentProject;
}

function clientCurrentProjectStatus_(model) {
  const project = clientCurrentProject_(model);
  return project ? project.status : model.projectStatus;
}

function clientCurrentProjectProgress_(model) {
  const project = clientCurrentProject_(model);
  if (!project) {
    return 'Not set yet';
  }
  return `${Math.round((Number(project.progress) || 0) * 100)}%`;
}

function clientCurrentProjectDueDate_(model) {
  const project = clientCurrentProject_(model);
  return project ? formatDisplayDate_(project.dueDate) : formatDisplayDate_(model.dueDate);
}

function clientCurrentProjectDeliverables_(model) {
  const project = clientCurrentProject_(model);
  return project ? project.deliverables : 'Not set yet';
}

function clientProjectRows_(projects) {
  const rows = (projects || []).slice(0, 5).map(function(project) {
    return [
      `${project.service || 'Project'} | ${project.status || 'Planning'} | ${Math.round((Number(project.progress) || 0) * 100)}%`,
      `${project.deliverables || 'Deliverables not set'} | Due ${formatDisplayDate_(project.dueDate)}`
    ];
  });
  return rows.length ? rows : [['Projects', 'No active project yet.']];
}

function clientNextFollowUpSummary_(followUps) {
  const next = (followUps || []).filter(function(item) {
    return !item.completed;
  })[0];
  if (!next) {
    return 'No open follow-up scheduled.';
  }
  return `${next.type || 'Follow-Up'} due ${formatDisplayDate_(next.dueDate)}`;
}

function clientLastFollowUpSummary_(followUps) {
  const completed = (followUps || []).filter(function(item) {
    return item.completed;
  }).sort(function(a, b) {
    return dateSortValue_(b.completedDate) - dateSortValue_(a.completedDate);
  })[0];
  if (!completed) {
    return 'No completed follow-up yet.';
  }
  return `${completed.type || 'Follow-Up'} completed ${formatDisplayDate_(completed.completedDate)}`;
}

function clientUpcomingTaskRows_(followUps) {
  const rows = (followUps || []).filter(function(item) {
    return !item.completed;
  }).slice(0, 6).map(function(item) {
    return [
      `${item.type || 'Follow-Up'} | ${formatDisplayDate_(item.dueDate)}`,
      item.notes || item.priority || 'Follow-up task'
    ];
  });
  return rows.length ? rows : [['Upcoming Tasks', 'No open follow-up tasks.']];
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
            background: #f7f3ea;
            color: #202020;
            font-family: Arial, Helvetica, sans-serif;
          }
          .wrap {
            padding: 18px;
          }
          .brand {
            background: #111111;
            border-bottom: 2px solid #b88728;
            margin: -18px -18px 16px;
            padding: 18px 18px 14px;
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
            background: #ffffff;
            padding: 12px;
            margin-bottom: 12px;
          }
          .grid {
            display: grid;
            gap: 8px;
          }
          .field {
            border-bottom: 1px solid #eee6d5;
            padding-bottom: 7px;
          }
          .label {
            color: #6f6a60;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .value {
            color: #202020;
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
            color: #111111;
          }
          .activity {
            border-left: 3px solid #b88728;
            background: #ffffff;
            margin-bottom: 8px;
            padding: 9px 10px;
          }
          .activity-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #202020;
            font-size: 12px;
          }
          .activity-top span {
            color: #6f6a60;
            white-space: nowrap;
          }
          .activity p,
          .muted {
            color: #6f6a60;
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
            <button onclick="runAction('workspaceGenerateAuditPackage')">Generate Digital Business Assessment</button>
            <button onclick="runAction('workspaceCreateGmailDraft')">Create Gmail Draft</button>
            <button onclick="runAction('workspaceGenerateProposal')" class="secondary">Generate Improvement Plan</button>
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

function getOrCreateDailyFrictionLogSheet_(ss) {
  let sheet = ss.getSheetByName(DAILY_FRICTION_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DAILY_FRICTION_LOG_SHEET);
  }

  const table = ensureSheetColumns_(sheet, DAILY_FRICTION_LOG_COLUMNS);
  formatDailyFrictionLogSheet_(sheet, table.headers);
  return sheet;
}

function getOrCreateProductFeedbackSheet_(ss) {
  let sheet = ss.getSheetByName(PRODUCT_FEEDBACK_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PRODUCT_FEEDBACK_SHEET);
  }

  const table = ensureSheetColumns_(sheet, PRODUCT_FEEDBACK_COLUMNS);
  formatProductFeedbackSheet_(sheet, table.headers);
  return sheet;
}

function formatProductFeedbackSheet_(sheet, headers) {
  if (!sheet) {
    return;
  }

  const headerRow = findBestHeaderRow_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), PRODUCT_FEEDBACK_COLUMNS.length);

  runSheetFormattingStep_(sheet, 'Product Feedback tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.charcoal);
  });
  safeSetFrozenRows_(sheet, headerRow);
  runSheetFormattingStep_(sheet, 'Product Feedback gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  applyOperatingSystemSheetChrome_(sheet, 'PRODUCT FEEDBACK', headerRow, lastColumn);
  formatTableHeader_(sheet, headerRow, lastColumn);
  applyAlternatingRows_(sheet, headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, headerRow, lastRow, lastColumn);
  applyVisualComfortBody_(sheet, headerRow + 1, lastRow, lastColumn, {
    rowHeight: 40,
    wrap: true,
    verticalAlignment: 'top'
  });
  runSheetFormattingStep_(sheet, 'Product Feedback column widths', function() {
    setColumnWidthIfHeader_(sheet, headers, 'Feedback ID', 145);
    setColumnWidthIfHeader_(sheet, headers, 'Date Logged', 130);
    setColumnWidthIfHeader_(sheet, headers, 'Source', 170);
    setColumnWidthIfHeader_(sheet, headers, 'Priority', 130);
    setColumnWidthIfHeader_(sheet, headers, 'Type', 150);
    setColumnWidthIfHeader_(sheet, headers, 'Area', 170);
    setColumnWidthIfHeader_(sheet, headers, 'Description', 360);
    setColumnWidthIfHeader_(sheet, headers, 'Business Impact', 300);
    setColumnWidthIfHeader_(sheet, headers, 'Status', 130);
    setColumnWidthIfHeader_(sheet, headers, 'Target Version', 145);
    setColumnWidthIfHeader_(sheet, headers, 'Notes', 300);
  });
  runSheetFormattingStep_(sheet, 'Product Feedback validation', function() {
    const rowCount = Math.max(sheet.getMaxRows() - headerRow, 1);
    if (headers.Priority) {
      sheet.getRange(headerRow + 1, headers.Priority, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(PRODUCT_FEEDBACK_PRIORITIES));
    }
    if (headers.Type) {
      sheet.getRange(headerRow + 1, headers.Type, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(PRODUCT_FEEDBACK_TYPES));
    }
    if (headers.Status) {
      sheet.getRange(headerRow + 1, headers.Status, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(PRODUCT_FEEDBACK_STATUSES));
    }
  });
  applyColumnFormattingByHeader_(sheet, headers, headerRow, lastRow, {
    'Date Logged': { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    Priority: { horizontalAlignment: 'center' },
    Type: { horizontalAlignment: 'center' },
    Status: { horizontalAlignment: 'center' },
    'Target Version': { horizontalAlignment: 'center' }
  });
  applyWrapByHeader_(sheet, headers, headerRow, lastRow, [
    'Description',
    'Business Impact',
    'Notes'
  ]);
}

function formatDailyFrictionLogSheet_(sheet, headers) {
  if (!sheet) {
    return;
  }

  const headerRow = findBestHeaderRow_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), headerRow);
  const lastColumn = Math.max(sheet.getLastColumn(), DAILY_FRICTION_LOG_COLUMNS.length);

  runSheetFormattingStep_(sheet, 'Daily Friction Log tab color', function() {
    sheet.setTabColor(ROGERS_OS_THEME.gold);
  });
  safeSetFrozenRows_(sheet, headerRow);
  runSheetFormattingStep_(sheet, 'Daily Friction Log gridlines', function() {
    sheet.setHiddenGridlines(true);
  });
  applyOperatingSystemSheetChrome_(sheet, "BRIAN'S DAILY FRICTION LOG", headerRow, lastColumn);
  formatTableHeader_(sheet, headerRow, lastColumn);
  applyAlternatingRows_(sheet, headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, headerRow, lastRow, lastColumn);
  applyVisualComfortBody_(sheet, headerRow + 1, lastRow, lastColumn, {
    rowHeight: 40,
    wrap: true,
    verticalAlignment: 'top'
  });
  runSheetFormattingStep_(sheet, 'Daily Friction Log column widths', function() {
    setColumnWidthIfHeader_(sheet, headers, 'Date', 120);
    setColumnWidthIfHeader_(sheet, headers, 'Area', 170);
    setColumnWidthIfHeader_(sheet, headers, 'Issue / Observation', 360);
    setColumnWidthIfHeader_(sheet, headers, 'Type', 160);
    setColumnWidthIfHeader_(sheet, headers, 'Priority', 135);
    setColumnWidthIfHeader_(sheet, headers, 'Impact', 260);
    setColumnWidthIfHeader_(sheet, headers, 'Possible Fix', 300);
    setColumnWidthIfHeader_(sheet, headers, 'Status', 130);
    setColumnWidthIfHeader_(sheet, headers, 'Notes', 300);
  });
  runSheetFormattingStep_(sheet, 'Daily Friction Log validation', function() {
    const rowCount = Math.max(sheet.getMaxRows() - headerRow, 1);
    if (headers.Type) {
      sheet.getRange(headerRow + 1, headers.Type, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(DAILY_FRICTION_LOG_TYPES));
    }
    if (headers.Priority) {
      sheet.getRange(headerRow + 1, headers.Priority, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(DAILY_FRICTION_LOG_PRIORITIES));
    }
    if (headers.Status) {
      sheet.getRange(headerRow + 1, headers.Status, rowCount, 1)
        .setDataValidation(buildDropdownValidation_(DAILY_FRICTION_LOG_STATUSES));
    }
  });
  applyColumnFormattingByHeader_(sheet, headers, headerRow, lastRow, {
    Date: { horizontalAlignment: 'center', numberFormat: 'yyyy-mm-dd' },
    Type: { horizontalAlignment: 'center' },
    Priority: { horizontalAlignment: 'center' },
    Status: { horizontalAlignment: 'center' }
  });
  applyWrapByHeader_(sheet, headers, headerRow, lastRow, [
    'Issue / Observation',
    'Impact',
    'Possible Fix',
    'Notes'
  ]);
}

function buildDropdownValidation_(values) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
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
  if (normalizePipelineStage_(stage) === 'Client' || stage === 'Won') {
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

function getSelectedFollowUpSourceContext_(showAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();
  if (!sheet) {
    if (showAlert) {
      ui.alert('Rogers Holdings OS', 'Select a prospect or client row before creating a follow-up.', ui.ButtonSet.OK);
    }
    return null;
  }

  if (sheet.getName() === MASTER_PROSPECT_SHEET) {
    const context = getSelectedProspectContext_(['Company']);
    if (!context) {
      return null;
    }
    const headers = context.table.headers;
    return {
      ss: ss,
      source: 'Prospect',
      company: getValueByHeader_(context.values, headers, 'Company'),
      contact: getValueByHeader_(context.values, headers, 'Contact'),
      email: getValueByHeader_(context.values, headers, 'Email'),
      prospectId: getValueByHeader_(context.values, headers, 'Prospect ID') || `MPT-${context.selectedRow}`,
      clientId: '',
      status: getValueByHeader_(context.values, headers, 'Status'),
      priority: getValueByHeader_(context.values, headers, 'Priority Tier')
    };
  }

  if (sheet.getName() === CLIENTS_SHEET) {
    const table = ensureClientColumns_(sheet);
    const selectedRow = sheet.getActiveRange() ? sheet.getActiveRange().getRow() : 0;
    if (selectedRow <= table.headerRow) {
      if (showAlert) {
        ui.alert('Rogers Holdings OS', 'Select a client data row below the Clients header row.', ui.ButtonSet.OK);
      }
      return null;
    }

    const values = sheet.getRange(selectedRow, 1, 1, table.lastColumn).getValues()[0];
    const company = firstNonBlank_([
      getValueByHeader_(values, table.headers, 'Company'),
      getValueByHeader_(values, table.headers, 'Client Name')
    ]);
    if (!company) {
      if (showAlert) {
        ui.alert('Rogers Holdings OS', 'The selected client row is missing Company.', ui.ButtonSet.OK);
      }
      return null;
    }

    return {
      ss: ss,
      source: 'Client',
      company: company,
      contact: getValueByHeader_(values, table.headers, 'Contact'),
      email: getValueByHeader_(values, table.headers, 'Email'),
      prospectId: '',
      clientId: getValueByHeader_(values, table.headers, 'Client ID'),
      status: getValueByHeader_(values, table.headers, 'Status'),
      priority: 'A - Hot'
    };
  }

  if (showAlert) {
    ui.alert('Rogers Holdings OS', 'Select a row on Master Prospect Tracker or Clients before creating a follow-up.', ui.ButtonSet.OK);
  }
  return null;
}

function normalizePipelineStage_(stage) {
  const value = String(stage || '').trim().toLowerCase();
  const aliases = {
    'audit complete': 'Digital Business Assessment Presented',
    'audit completed': 'Digital Business Assessment Presented',
    'audit package sent': 'Digital Business Assessment Presented',
    'draft created': 'Executive Snapshot Sent',
    'gmail draft created': 'Executive Snapshot Sent',
    'email sent': 'Executive Snapshot Sent',
    'follow up due': 'Nurture',
    'proposal sent': 'Improvement Plan Sent',
    'discovery scheduled': 'Discovery Meeting Scheduled',
    'discovery call scheduled': 'Discovery Meeting Scheduled',
    won: 'Client',
    active: 'Client'
  };
  const normalizedValue = String(aliases[value] || value).toLowerCase();
  const match = PIPELINE_STAGES.filter(function(candidate) {
    return candidate.toLowerCase() === normalizedValue;
  })[0];
  return match || '';
}

function getNextPipelineStage_(currentStage) {
  if (!currentStage) {
    return PIPELINE_STAGES[0];
  }

  if (currentStage === 'Client' || currentStage === 'Won' || currentStage === 'Lost') {
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

  const normalizedStatus = normalizeProspectDropdownWriteValue_(sheet, headers, 'Status', status);
  sheet.getRange(selectedRow, headers.Status).setValue(normalizedStatus);
  syncFollowUpForProspectRow_(sheet, headers, selectedRow, normalizedStatus);
}

function setProspectStatusIfHeader_(sheet, headers, selectedRow, status) {
  if (!headers.Status) {
    return;
  }

  const normalizedStatus = normalizeProspectDropdownWriteValue_(sheet, headers, 'Status', status);
  sheet.getRange(selectedRow, headers.Status).setValue(normalizedStatus);
  syncFollowUpForProspectRow_(sheet, headers, selectedRow, normalizedStatus);
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
  const discoveryCallsScheduled = countActivityTypes_(['Discovery Meeting Scheduled', 'Discovery Call Scheduled']);
  const auditPackagesGenerated = countActivityTypes_(['Digital Business Assessment Generated', 'Audit Package Generated']);
  const auditPackagesSent = countActivityTypes_(['Digital Business Assessment Sent', 'Audit Package Sent']);
  const auditsCompletedToday = countActivityTypesToday_(['Website Audit Tool', 'Website Audit']);
  const packagesGeneratedToday = countActivityTypesToday_(['Digital Business Assessment Generated', 'Audit Package Generated']);
  const clientMetrics = getClientRevenueMetrics_();
  const followUpMetrics = getFollowUpMetrics_();
  const projectMetrics = getProjectMetrics_();
  const wonDeals = statusCounts.Client || statusCounts.Won || 0;
  const lostDeals = statusCounts.Lost || 0;
  const decidedDeals = wonDeals + lostDeals;
  const winRate = decidedDeals ? wonDeals / decidedDeals : 0;
  const rows = [
    ['Metric', 'Value', 'Updated At'],
    ['Total Leads', totalLeads, new Date()],
    ['Digital Business Assessments Presented', statusCounts['Digital Business Assessment Presented'] || statusCounts['Audit Complete'] || 0, new Date()],
    ['Audits Completed Today', auditsCompletedToday, new Date()],
    ['Outreach Drafts Created', statusCounts['Executive Snapshot Sent'] || statusCounts['Draft Created'] || 0, new Date()],
    ['Emails Sent', statusCounts['Email Sent'] || 0, new Date()],
    ['Improvement Plans Sent', statusCounts['Improvement Plan Sent'] || statusCounts['Proposal Sent'] || 0, new Date()],
    ['Clients', wonDeals, new Date()],
    ['Lost Deals', lostDeals, new Date()],
    ['Win Rate %', winRate, new Date()],
    ["Today's Follow-Ups", followUpMetrics.today || followUpsDueToday, new Date()],
    ['Overdue Follow-Ups', followUpMetrics.overdue || overdueFollowUps, new Date()],
    ['Follow-Ups Due This Week', followUpMetrics.dueThisWeek, new Date()],
    ['Completed Today', followUpMetrics.completedToday, new Date()],
    ['Follow-Ups Completed', followUpsCompleted, new Date()],
    ['Discovery Meetings Scheduled', discoveryCallsScheduled, new Date()],
    ['Digital Business Assessments Generated', auditPackagesGenerated, new Date()],
    ['Packages Generated Today', packagesGeneratedToday, new Date()],
    ['Digital Business Assessments Sent', auditPackagesSent, new Date()],
    ['Total Clients', clientMetrics.totalClients, new Date()],
    ['Active Clients', clientMetrics.activeClients, new Date()],
    ['Total Revenue', clientMetrics.totalRevenue, new Date()],
    ['Average Deal Size', clientMetrics.averageDealSize, new Date()],
    ['Clients This Month', clientMetrics.clientsThisMonth, new Date()],
    ['Revenue This Month', clientMetrics.revenueThisMonth, new Date()],
    ['Active Projects', projectMetrics.activeProjects, new Date()],
    ['Projects Due This Week', projectMetrics.dueThisWeek, new Date()],
    ['Overdue Projects', projectMetrics.overdueProjects, new Date()],
    ['Completed This Month', projectMetrics.completedThisMonth, new Date()],
    ['Average Completion Time', projectMetrics.averageCompletionTime, new Date()]
  ];

  metricsSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  metricsSheet.getRange(10, 2).setNumberFormat('0.00%');
  metricsSheet.getRange(22, 2, 1, 1).setNumberFormat('$#,##0.00');
  metricsSheet.getRange(23, 2, 1, 1).setNumberFormat('$#,##0.00');
  metricsSheet.getRange(25, 2, 1, 1).setNumberFormat('$#,##0.00');
  metricsSheet.getRange(30, 2, 1, 1).setNumberFormat('0.0');
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
    clientMetrics: getClientRevenueMetrics_(),
    followUpMetrics: getFollowUpMetrics_(),
    projectMetrics: getProjectMetrics_()
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
  sheet.getRange(1, 1, 80, 12)
    .breakApart()
    .clearContent()
    .clearFormat()
    .clearDataValidations()
    .clearNote();
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
  sheet.setRowHeights(14, 18, 30);
  sheet.setRowHeights(34, 16, 32);
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
  const followUpMetrics = data.followUpMetrics || {
    today: data.followUpsDueToday || 0,
    overdue: data.overdueFollowUps || 0,
    dueThisWeek: 0,
    completedToday: 0
  };
  const projectMetrics = data.projectMetrics || {
    activeProjects: data.clientMetrics.activeProjects || 0,
    dueThisWeek: 0,
    overdueProjects: 0,
    completedThisMonth: 0,
    averageCompletionTime: 0
  };
  const rows = [
    ['ROGERS HOLDINGS OS', '', '', '', '', '', '', '', '', '', '', ''],
    ['EXECUTIVE DASHBOARD', '', '', '', '', '', '', '', '', 'Last Refresh', data.generatedAt, ''],
    ['Total Prospects', '', '', 'Leads Found', '', '', 'Executive Snapshot Sent', '', '', 'Improvement Plan Sent', '', ''],
    [data.totalProspects, '', '', data.statusCounts['Lead Found'] || 0, '', '', data.statusCounts['Executive Snapshot Sent'] || 0, '', '', data.statusCounts['Improvement Plan Sent'] || 0, '', ''],
    ['Digital Business Assessment Presented', '', '', 'Discovery Meeting Scheduled', '', '', 'Client', '', '', 'Lost', '', ''],
    [data.statusCounts['Digital Business Assessment Presented'] || 0, '', '', data.statusCounts['Discovery Meeting Scheduled'] || 0, '', '', data.statusCounts.Client || 0, '', '', data.statusCounts.Lost || 0, '', ''],
    ["Today's Follow-Ups", '', '', 'Overdue Follow-Ups', '', '', 'Follow-Ups Due This Week', '', '', 'Completed Today', '', ''],
    [followUpMetrics.today || 0, '', '', followUpMetrics.overdue || 0, '', '', followUpMetrics.dueThisWeek || 0, '', '', followUpMetrics.completedToday || 0, '', ''],
    ['Average Audit Score', '', '', 'Total Clients', '', '', 'Active Clients', '', '', 'Active Projects', '', ''],
    [data.averageAuditScore, '', '', data.clientMetrics.totalClients || 0, '', '', data.clientMetrics.activeClients || 0, '', '', projectMetrics.activeProjects || data.clientMetrics.activeProjects || 0, '', ''],
    ['Projects Due This Week', '', '', 'Overdue Projects', '', '', 'Completed This Month', '', '', 'Avg Completion Days', '', ''],
    [projectMetrics.dueThisWeek || 0, '', '', projectMetrics.overdueProjects || 0, '', '', projectMetrics.completedThisMonth || 0, '', '', projectMetrics.averageCompletionTime || 0, '', '']
  ];

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(2, 11).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(4, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(6, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(8, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(10, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(10, 1).setNumberFormat('0.0');
  sheet.getRange(12, 1, 1, 12).setNumberFormat('0');
  sheet.getRange(12, 10).setNumberFormat('0.0');
}

function updatePipelineSummary_(data) {
  const sheet = data.dashboardSheet;
  const stages = [
    'Lead Found',
    'Executive Snapshot Sent',
    'Discovery Meeting Scheduled',
    'Digital Business Assessment Presented',
    'Improvement Plan Sent',
    'Project Started',
    'Client'
  ];
  const rows = [
    ['SALES PIPELINE', '', ''],
    ['Stage', 'Count', 'Percent']
  ].concat(stages.map(function(stage) {
    const count = data.statusCounts[stage] || 0;
    return [stage, count, data.totalProspects ? count / data.totalProspects : 0];
  }));

  sheet.getRange(14, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(16, 2, stages.length, 1).setNumberFormat('0');
  sheet.getRange(16, 3, stages.length, 1).setNumberFormat('0.0%');
}

function updateRecentActivity_(data) {
  const sheet = data.dashboardSheet;
  const activityRows = data.activities.length
    ? data.activities.slice(0, 15).map(function(activity) {
      return [
        activity.timestamp || '',
        activity.company || '',
        activity.activity || '',
        activity.user || ''
      ];
    })
    : [['No recent activity yet.', '', '', '']];
  const rows = [
    ['RECENT ACTIVITY', '', '', ''],
    ['Timestamp', 'Company', 'Activity', 'User']
  ].concat(activityRows);

  sheet.getRange(14, 5, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(16, 5, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  if (!data.activities.length) {
    sheet.getRange(16, 5, 1, 4)
      .setFontColor(ROGERS_OS_THEME.muted)
      .setFontStyle('italic')
      .setHorizontalAlignment('center');
  }
}

function updateFollowUpQueue_(data) {
  const sheet = data.dashboardSheet;
  const today = data.today.getTime();
  const followUpQueue = getOpenFollowUpQueue_(data.ss, 12);
  const queue = followUpQueue.length ? followUpQueue : data.prospects.filter(function(prospect) {
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
  ].concat(queue.length ? queue.slice(0, 12).map(function(item) {
    return [
      item.company,
      item.contact,
      item.email,
      item.status,
      item.followUpDate || item.dueDate || '',
      item.nextAction || item.followUpType || '',
      item.lastActivity || ''
    ];
  }) : [['No open follow-ups. Create one from the Follow-Ups menu when needed.', '', '', '', '', '', '']]);

  sheet.getRange(34, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(36, 5, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(36, 7, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
  if (!queue.length) {
    sheet.getRange(36, 1, 1, 7)
      .setFontColor(ROGERS_OS_THEME.muted)
      .setFontStyle('italic')
      .setHorizontalAlignment('center');
  }
  applyFollowUpQueueStatusColors_(sheet, queue.slice(0, 12), 36, 1, 7);
}

function getOpenFollowUpQueue_(ss, limit) {
  const sheet = ss.getSheetByName(FOLLOW_UPS_SHEET);
  if (!sheet) {
    return [];
  }

  const table = ensureFollowUpColumns_(sheet);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return [];
  }

  const today = startOfDay_(new Date()).getTime();
  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  return values.map(function(row) {
    const dueDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date'));
    const dueTime = dueDate ? startOfDay_(dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    let bucket = 2;
    if (dueTime < today) {
      bucket = 0;
    } else if (dueTime === today) {
      bucket = 1;
    }
    return {
      company: getValueByHeader_(row, table.headers, 'Company'),
      contact: getValueByHeader_(row, table.headers, 'Contact'),
      email: getValueByHeader_(row, table.headers, 'Email'),
      status: getValueByHeader_(row, table.headers, 'Current Status'),
      followUpType: getValueByHeader_(row, table.headers, 'Follow-Up Type'),
      dueDate: dueDate,
      followUpDate: dueDate,
      lastActivity: '',
      bucket: bucket,
      followUpTime: dueTime,
      completed: isFollowUpCompletedValue_(getValueByHeader_(row, table.headers, 'Completed'))
    };
  }).filter(function(item) {
    return item.company && !item.completed;
  }).sort(function(a, b) {
    if (a.bucket !== b.bucket) {
      return a.bucket - b.bucket;
    }
    return a.followUpTime - b.followUpTime;
  }).slice(0, limit || 12);
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
  const opportunities = data.prospects.slice().sort(function(a, b) {
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
  }).filter(function(item) {
    return item.company && (item.priorityTier || item.auditScore || item.status || item.lastActivity);
  }).slice(0, 10);
  const rows = [
    ['TOP OPPORTUNITIES', '', '', '', ''],
    ['Company', 'Priority', 'Audit Score', 'Status', 'Last Activity']
  ].concat(opportunities.length ? opportunities.map(function(item) {
    return [item.company, item.priorityTier, item.auditScore, item.status, item.lastActivity || ''];
  }) : [['No priority opportunities yet. Add prospects or run audits to populate this panel.', '', '', '', '']]);

  sheet.getRange(34, 8, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(36, 10, Math.max(rows.length - 2, 1), 1).setNumberFormat('0.0');
  sheet.getRange(36, 12, Math.max(rows.length - 2, 1), 1).setNumberFormat('yyyy-mm-dd');
  if (!opportunities.length) {
    sheet.getRange(36, 8, 1, 5)
      .setFontColor(ROGERS_OS_THEME.muted)
      .setFontStyle('italic')
      .setHorizontalAlignment('center');
  }
}

function updateQuickActions_(data) {
  const sheet = data.dashboardSheet;
  const rows = [
    ['QUICK ACTIONS', '', ''],
    ['Open Prospects', 'Open Clients', 'Open Follow-Ups'],
    ['Open Projects', 'System Health Check', 'Refresh Dashboard']
  ];

  sheet.getRange(56, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(57, 1, 2, 3).setNotes([
    ['Click to open Master Prospect Tracker', 'Click to open Clients', 'Click to open Follow-Ups'],
    ['Click to open Projects', 'Click to run System Health Check', 'Click to refresh Executive Dashboard']
  ]);
}

function handleExecutiveDashboardQuickActionSelection_(e) {
  if (!e || !e.range) {
    return;
  }

  const range = e.range;
  const sheet = range.getSheet();
  if (!sheet || sheet.getName() !== 'Executive Dashboard') {
    return;
  }

  const row = range.getRow();
  const column = range.getColumn();
  const actionMap = {
    '57:1': openMasterProspectTracker,
    '57:2': openClientsSheet,
    '57:3': openFollowUpsSheet,
    '58:1': openProjectsSheet,
    '58:2': runSystemHealthCheck,
    '58:3': refreshExecutiveDashboard
  };
  const action = actionMap[row + ':' + column];
  if (!action) {
    return;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('Running dashboard action...', 'Rogers Holdings OS', 3);
  action();
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

  sheet.getRange(56, 5, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(57, 6, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(58, 6, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  applySystemStatusColors_(sheet, 57, 7, rows.slice(1).map(function(row) { return row[2]; }));
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
  sheet.getRange(1, 1, 1, 12).breakApart().merge()
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 1, 1, 9).breakApart().merge()
    .setFontColor(white)
    .setFontSize(15)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 10, 1, 2)
    .setFontColor(white)
    .setFontSize(10)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');

  [
    [14, 1, 1, 3],
    [14, 5, 1, 4],
    [34, 1, 1, 7],
    [34, 8, 1, 5],
    [56, 1, 1, 3],
    [56, 5, 1, 3]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .breakApart()
      .merge()
      .setBackground(black)
      .setFontColor(gold)
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
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
    [9, 7, 2, 3],
    [9, 10, 2, 3],
    [11, 1, 2, 3],
    [11, 4, 2, 3],
    [11, 7, 2, 3],
    [11, 10, 2, 3]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .setBackground(neutral)
      .setFontColor(text)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, border, SpreadsheetApp.BorderStyle.SOLID);
  });

  [3, 5, 7, 9, 11].forEach(function(row) {
    sheet.getRange(row, 1, 1, 12)
      .setFontSize(9)
      .setFontColor('#5f5b52')
      .setHorizontalAlignment('center');
  });
  [4, 6, 8, 10, 12].forEach(function(row) {
    sheet.getRange(row, 1, 1, 12)
      .setFontSize(18)
      .setFontColor(black)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });
  [
    [3, 1], [3, 4], [3, 7], [3, 10],
    [5, 1], [5, 4], [5, 7], [5, 10],
    [7, 1], [7, 4], [7, 7], [7, 10],
    [9, 1], [9, 4], [9, 7], [9, 10],
    [11, 1], [11, 4], [11, 7], [11, 10]
  ].forEach(function(cardSpec) {
    sheet.getRange(cardSpec[0], cardSpec[1], 1, 3).breakApart().merge()
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.getRange(cardSpec[0] + 1, cardSpec[1], 1, 3).breakApart().merge()
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });

  [
    [15, 1, 1, 3],
    [15, 5, 1, 4],
    [35, 1, 1, 7],
    [35, 8, 1, 5],
    [57, 1, 1, 3],
    [57, 5, 1, 3]
  ].forEach(function(rangeSpec) {
    sheet.getRange(rangeSpec[0], rangeSpec[1], rangeSpec[2], rangeSpec[3])
      .setFontWeight('bold')
      .setBackground(ROGERS_OS_THEME.softGold)
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, border, SpreadsheetApp.BorderStyle.SOLID);
  });

  sheet.getRange(16, 1, 9, 3)
    .setBackground(neutral)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(16, 5, 15, 4)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(36, 1, 12, 7)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(36, 8, 10, 5)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(36, 1, 12, 7)
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.getRange(36, 8, 10, 5)
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.getRange(57, 1, 2, 3)
    .setBackground(black)
    .setFontColor(white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, gold, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(56, 1, 3, 3)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(57, 5, 5, 3)
    .setBackground(white)
    .setBorder(true, true, true, true, true, true, border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(57, 7, 5, 1).setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange(16, 2, 9, 2).setHorizontalAlignment('center');
  sheet.getRange(36, 5, 12, 1).setHorizontalAlignment('center');
  sheet.getRange(36, 7, 12, 1).setHorizontalAlignment('center');
  sheet.getRange(36, 10, 10, 1).setHorizontalAlignment('center');
  sheet.getRange(36, 12, 10, 1).setHorizontalAlignment('center');
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
  runVisualFormattingStep_(ss.getSheetByName(FOLLOW_UPS_SHEET), 'Format Follow-Ups', function(sheet) {
    formatFollowUpsSheet_(sheet, ensureFollowUpColumns_(sheet).headers);
  });
  runVisualFormattingStep_(ss.getSheetByName(PROJECTS_SHEET), 'Format Projects', function(sheet) {
    formatProjectsSheet_(sheet, ensureProjectColumns_(sheet).headers);
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
    sheet.setRowHeights(14, 18, 30);
    sheet.setRowHeights(34, 16, 32);
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
  applyVisualComfortBody_(sheet, table.headerRow + 1, lastRow, lastColumn, {
    rowHeight: 28
  });
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
  applyOperatingSystemSheetChrome_(sheet, 'MASTER PROSPECT TRACKER', table.headerRow, lastColumn);
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Master Prospect body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setBorder(true, false, true, false, false, false, '#eee6d5', SpreadsheetApp.BorderStyle.SOLID);
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, table.headerRow, lastRow, lastColumn);
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
  applyVisualComfortBody_(sheet, table.headerRow + 1, lastRow, lastColumn, {
    rowHeight: 34
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
  applyOperatingSystemSheetChrome_(sheet, 'CLIENTS', table.headerRow, lastColumn);
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Clients body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle');
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, table.headerRow, lastRow, lastColumn);
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
  applyVisualComfortBody_(sheet, table.headerRow + 1, lastRow, lastColumn, {
    rowHeight: 34
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
  applyOperatingSystemSheetChrome_(sheet, 'ACTIVITY FEED', table.headerRow, lastColumn);
  formatTableHeader_(sheet, table.headerRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Activity Feed body styling', function() {
    sheet.getRange(table.headerRow + 1, 1, Math.max(lastRow - table.headerRow, 1), lastColumn)
      .setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('top');
  });
  applyAlternatingRows_(sheet, table.headerRow + 1, lastRow, lastColumn);
  applyOperatingSystemTableSurface_(sheet, table.headerRow, lastRow, lastColumn);
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
  applyVisualComfortBody_(sheet, table.headerRow + 1, lastRow, lastColumn, {
    rowHeight: 42,
    wrap: true,
    verticalAlignment: 'top'
  });
}

function formatSettingsSheet_(sheet) {
  if (!sheet) {
    return;
  }

  if (typeof ensureSystemSettingsSection_ === 'function') {
    ensureSystemSettingsSection_(SpreadsheetApp.getActiveSpreadsheet());
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
  applyOperatingSystemTableSurface_(sheet, table.headerRow, lastRow, lastColumn);
  runSheetFormattingStep_(sheet, 'Settings column widths', function() {
    sheet.setColumnWidths(1, Math.min(lastColumn, 4), 190);
  });
  applyVisualComfortBody_(sheet, table.headerRow + 1, lastRow, lastColumn, {
    rowHeight: 30
  });
  if (typeof formatSystemSettingsSection_ === 'function') {
    formatSystemSettingsSection_(sheet);
  }
  if (typeof formatDropdownListsSection_ === 'function') {
    formatDropdownListsSection_(sheet);
  }
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

function applyOperatingSystemSheetChrome_(sheet, title, headerRow, lastColumn) {
  runSheetFormattingStep_(sheet, 'Operating system sheet chrome', function() {
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), Math.max(sheet.getMaxColumns(), 1))
      .setFontFamily('Arial')
      .setFontColor(ROGERS_OS_THEME.text)
      .setVerticalAlignment('middle');

    if (headerRow > 1 && lastColumn > 1) {
      sheet.getRange(1, 1, 1, lastColumn).breakApart().merge()
        .setValue(title)
        .setBackground(ROGERS_OS_THEME.black)
        .setFontColor(ROGERS_OS_THEME.gold)
        .setFontWeight('bold')
        .setFontSize(16)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBorder(true, true, true, true, false, false, ROGERS_OS_THEME.gold, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
      sheet.setRowHeight(1, 42);
      if (headerRow > 2) {
        sheet.getRange(2, 1, headerRow - 2, lastColumn)
          .setBackground(ROGERS_OS_THEME.white)
          .setBorder(false, false, true, false, false, false, '#eee6d5', SpreadsheetApp.BorderStyle.SOLID);
      }
    }
  });
}

function applyOperatingSystemTableSurface_(sheet, headerRow, lastRow, lastColumn) {
  const bodyStartRow = headerRow + 1;
  const bodyRows = Math.max(lastRow - headerRow, 1);
  runSheetFormattingStep_(sheet, 'Operating system table surface', function() {
    sheet.getRange(headerRow, 1, 1, lastColumn)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
    sheet.getRange(bodyStartRow, 1, bodyRows, lastColumn)
      .setVerticalAlignment('middle')
      .setWrap(false)
      .setBorder(true, false, true, false, false, false, '#eee6d5', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(headerRow, 1, Math.max(lastRow - headerRow + 1, 1), lastColumn)
      .setBorder(true, true, true, true, false, false, ROGERS_OS_THEME.border, SpreadsheetApp.BorderStyle.SOLID);
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

function applyVisualComfortBody_(sheet, startRow, lastRow, lastColumn, options) {
  if (lastRow < startRow || lastColumn <= 0) {
    return;
  }

  const settings = options || {};
  const rowCount = lastRow - startRow + 1;
  runSheetFormattingStep_(sheet, 'Visual comfort body styling', function() {
    sheet.getRange(startRow, 1, rowCount, lastColumn)
      .setFontFamily('Arial')
      .setFontSize(settings.fontSize || 10)
      .setFontColor(ROGERS_OS_THEME.text)
      .setVerticalAlignment(settings.verticalAlignment || 'middle')
      .setWrap(settings.wrap === true)
      .setBorder(true, false, true, false, false, false, ROGERS_OS_THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  });

  if (settings.rowHeight) {
    runSheetFormattingStep_(sheet, 'Visual comfort row height', function() {
      sheet.setRowHeights(startRow, rowCount, settings.rowHeight);
    });
  }
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
  const discoveryCallsScheduled = countActivityTypes_(['Discovery Meeting Scheduled', 'Discovery Call Scheduled']);
  const auditPackagesGenerated = countActivityTypes_(['Digital Business Assessment Generated', 'Audit Package Generated']);
  const auditPackagesSent = countActivityTypes_(['Digital Business Assessment Sent', 'Audit Package Sent']);
  const output = [
    ['CLIENT SUMMARY', '', ''],
    ['Total Clients', metrics.totalClients, ''],
    ['Active Clients', metrics.activeClients, ''],
    ['New Clients This Month', metrics.clientsThisMonth, ''],
    ['Revenue', metrics.totalRevenue, ''],
    ['Discovery Meetings Scheduled', discoveryCallsScheduled, ''],
    ['Digital Business Assessments Generated', auditPackagesGenerated, ''],
    ['Digital Business Assessments Sent', auditPackagesSent, ''],
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
