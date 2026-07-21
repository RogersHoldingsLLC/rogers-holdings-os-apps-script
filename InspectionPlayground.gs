/**
 * Business Optimization Platform - Inspection Playground.
 * Developer-only QA surface for running inspectors without changing production
 * workflows, audit data, PDFs, Gmail drafts, Drive routing, or dashboards.
 */

function openInspectionPlayground() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateInspectionPlaygroundSheet_(ss);
  renderInspectionPlayground_(sheet);
  sheet.showSheet();
  ss.setActiveSheet(sheet);
}

function runSelectedInspector() {
  runInspectionPlayground_(false);
}

function runFullInspection() {
  runInspectionPlayground_(true);
}

function fetchPlaygroundWebsiteDocument() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateInspectionPlaygroundSheet_(ss);
  renderInspectionPlayground_(sheet);

  const url = String(sheet.getRange('B6').getDisplayValue() || '').trim();
  if (!url) {
    SpreadsheetApp.getUi().alert('Enter a Website URL before fetching a WebsiteDocument.');
    return;
  }

  const startedAt = new Date();
  appendInspectionPlaygroundLog_(sheet, 'Started WebsiteDocument fetch for ' + url);
  let document;
  try {
    document = fetchWebsiteDocument(url, {});
  } catch (error) {
    document = {
      objectType: 'WebsiteDocument',
      originalUrl: url,
      finalUrl: url,
      fetchStatus: 'Failed',
      errors: [error && error.message ? error.message : String(error)],
      warnings: [],
      executionMetadata: {
        startedAt: startedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime()
      }
    };
  }

  writeInspectionPlaygroundWebsiteDocument_(sheet, document, startedAt, new Date());
  appendInspectionPlaygroundLog_(sheet, 'Completed WebsiteDocument fetch with status: ' + document.fetchStatus);
  SpreadsheetApp.getUi().alert('WebsiteDocument fetch complete.');
}

function exportInspectionResult() {
  const sheet = getOrCreateInspectionPlaygroundSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const json = getInspectionPlaygroundJson_(sheet);
  if (!json) {
    SpreadsheetApp.getUi().alert('Run an inspection or fetch a WebsiteDocument before exporting JSON.');
    return;
  }

  const parsed = getInspectionPlaygroundParsedJson_(sheet);
  const prefix = parsed && parsed.objectType === 'WebsiteDocument' ? 'website-document-' : 'inspection-result-';
  const fileName = prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '.json';
  const file = DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);
  appendInspectionPlaygroundLog_(sheet, 'Exported JSON to Drive: ' + file.getName());
  SpreadsheetApp.getUi().alert('Inspection JSON exported to Drive:\n' + file.getUrl());
}

function copyInspectionJson() {
  const sheet = getOrCreateInspectionPlaygroundSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const json = getInspectionPlaygroundJson_(sheet);
  if (!json) {
    SpreadsheetApp.getUi().alert('Run an inspection or fetch a WebsiteDocument before copying JSON.');
    return;
  }

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:16px;">' +
      '<h2 style="margin:0 0 12px;color:#111;">Inspection Playground JSON</h2>' +
      '<p style="margin:0 0 12px;color:#555;">Select the JSON below and copy it for debugging or QA notes.</p>' +
      '<textarea id="inspectionJson" style="box-sizing:border-box;width:100%;height:420px;font-family:Menlo,Consolas,monospace;font-size:12px;">' +
        escapeHtml_(json) +
      '</textarea>' +
      '<div style="margin-top:12px;">' +
        '<button onclick="copyJson()" style="background:#05070A;color:#fff;border:1px solid #C8A15A;padding:9px 14px;border-radius:4px;">Copy JSON</button>' +
        '<span id="copyStatus" style="margin-left:10px;color:#666;"></span>' +
      '</div>' +
      '<script>' +
        'function copyJson(){var el=document.getElementById("inspectionJson");el.focus();el.select();' +
        'try{document.execCommand("copy");document.getElementById("copyStatus").textContent="Copied.";}' +
        'catch(e){document.getElementById("copyStatus").textContent="Copy failed. Select manually.";}}' +
      '</script>' +
    '</div>'
  ).setWidth(760).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Inspection Playground JSON');
}

function viewPriorityMatrix() {
  const sheet = getOrCreateInspectionPlaygroundSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const result = getInspectionPlaygroundResult_(sheet);
  if (!result) {
    SpreadsheetApp.getUi().alert('Run an inspection before viewing the priority matrix.');
    return;
  }
  showInspectionPlaygroundObjectModal_('Priority Matrix', result.priorityMatrix || {});
}

function viewCategoryScores() {
  const sheet = getOrCreateInspectionPlaygroundSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const result = getInspectionPlaygroundResult_(sheet);
  if (!result) {
    SpreadsheetApp.getUi().alert('Run an inspection before viewing category scores.');
    return;
  }
  showInspectionPlaygroundObjectModal_('Category Scores', result.categoryScores || {});
}

function getOrCreateInspectionPlaygroundSheet_(ss) {
  let sheet = ss.getSheetByName(getInspectionPlaygroundSheetName_());
  if (!sheet) {
    sheet = ss.insertSheet(getInspectionPlaygroundSheetName_());
    sheet.hideSheet();
  }
  return sheet;
}

function renderInspectionPlayground_(sheet) {
  const previousUrl = String(sheet.getRange('B6').getDisplayValue() || '').trim();
  const previousInspector = String(sheet.getRange('B7').getDisplayValue() || '').trim();
  const previousText = String(sheet.getRange('B8').getDisplayValue() || '').trim();

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setTabColor('#C8A15A');
  safeSetFrozenRows_(sheet, 3);

  const headers = [
    ['BUSINESS OPTIMIZATION PLATFORM', '', '', '', '', '', '', ''],
    ['INSPECTION PLAYGROUND', '', '', '', '', '', '', ''],
    ['Developer QA tool. Runs inspectors without modifying production records, reports, workflows, or dashboards.', '', '', '', '', '', '', '']
  ];
  sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers);
  sheet.getRange('A1:H1').merge().setBackground('#05070A').setFontColor('#C8A15A').setFontWeight('bold').setFontSize(13);
  sheet.getRange('A2:H2').merge().setBackground('#05070A').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(20);
  sheet.getRange('A3:H3').merge().setBackground('#111827').setFontColor('#E5E7EB').setFontSize(10);

  sheet.getRange('A5:B11').setBackground('#FFFFFF').setBorder(true, true, true, true, false, false, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('A5:B5').merge().setValue('Inspector Controls').setBackground('#F8F6F0').setFontColor('#111111').setFontWeight('bold');
  sheet.getRange('A6').setValue('Website URL');
  sheet.getRange('A7').setValue('Inspector Selection');
  sheet.getRange('A8').setValue('Optional Page Text');
  sheet.getRange('A9').setValue('Run Button');
  sheet.getRange('A10').setValue('Fetch Button');
  sheet.getRange('B6').setValue(previousUrl);
  sheet.getRange('B7').setDataValidation(buildDropdownValidation_(getInspectionPlaygroundInspectorNames_()));
  sheet.getRange('B7').setValue(previousInspector || 'Contact Information');
  sheet.getRange('B8').setValue(previousText);
  sheet.getRange('B8').setWrap(true);
  sheet.getRange('B9').setValue('Use menu: Development > Run Selected or Run Full').setFontColor('#6B7280');
  sheet.getRange('B10').setValue('Use menu: Development > Fetch Website Document').setFontColor('#6B7280');

  sheet.getRange('D5:H11').setBackground('#FFFFFF').setBorder(true, true, true, true, false, false, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('D5:H5').merge().setValue('Execution Summary').setBackground('#F8F6F0').setFontWeight('bold');
  sheet.getRange('D6').setValue('Execution Time');
  sheet.getRange('D7').setValue('Overall Score');
  sheet.getRange('D8').setValue('Overall Grade');
  sheet.getRange('D9').setValue('Findings Created');
  sheet.getRange('D10').setValue('Evidence Created');
  sheet.getRange('D11').setValue('Last Run');

  writeInspectionPlaygroundSection_(sheet, 13, 1, 4, 'Category Scores');
  writeInspectionPlaygroundSection_(sheet, 13, 6, 3, 'Priority Matrix');
  writeInspectionPlaygroundSection_(sheet, 25, 1, 8, 'Inspector Results');
  writeInspectionPlaygroundSection_(sheet, 38, 1, 8, 'Structured JSON Output');
  writeInspectionPlaygroundSection_(sheet, 59, 1, 8, 'Execution Log');

  sheet.getRange('A14:D14').setValues([['Category', 'Score', 'Findings', 'High/Critical']]);
  sheet.getRange('F14:H14').setValues([['Priority', 'Meaning', 'Action']]);
  sheet.getRange('A26:H26').setValues([['Inspector', 'Category', 'Version', 'Status', 'Runtime ms', 'Findings', 'Evidence', 'Error / Notes']]);
  sheet.getRange('A60:H60').setValues([['Timestamp', 'Event', '', '', '', '', '', '']]);

  sheet.getRangeList(['A6:A10', 'D6:D11', 'A14:D14', 'F14:H14', 'A26:H26', 'A60:H60']).setFontWeight('bold');
  sheet.getRange('A38:H58').merge().setValue('Run an inspection or fetch a WebsiteDocument to view structured JSON output.').setVerticalAlignment('top').setWrap(true).setFontFamily('Menlo');

  sheet.setColumnWidths(1, 1, 160);
  sheet.setColumnWidths(2, 1, 330);
  sheet.setColumnWidths(3, 1, 120);
  sheet.setColumnWidths(4, 1, 150);
  sheet.setColumnWidths(5, 1, 20);
  sheet.setColumnWidths(6, 1, 170);
  sheet.setColumnWidths(7, 1, 220);
  sheet.setColumnWidths(8, 1, 220);
  sheet.setRowHeights(1, 3, 28);
  sheet.setRowHeight(2, 36);
  sheet.setRowHeight(8, 72);
  sheet.setRowHeights(38, 21, 24);
}

function runInspectionPlayground_(runAllInspectors) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateInspectionPlaygroundSheet_(ss);
  renderInspectionPlayground_(sheet);

  const url = String(sheet.getRange('B6').getDisplayValue() || '').trim();
  const selectedInspectorName = String(sheet.getRange('B7').getDisplayValue() || 'Contact Information').trim();
  const optionalText = String(sheet.getRange('B8').getDisplayValue() || '').trim();
  if (!url) {
    SpreadsheetApp.getUi().alert('Enter a Website URL before running the Inspection Playground.');
    return;
  }

  const startedAt = new Date();
  const options = {
    text: optionalText,
    homepageText: optionalText
  };
  const websiteDocument = getInspectionPlaygroundWebsiteDocument_(sheet, url);
  if (websiteDocument) {
    Object.assign(options, buildInspectionPlaygroundOptionsFromWebsiteDocument_(websiteDocument));
    appendInspectionPlaygroundLog_(sheet, 'Using cached WebsiteDocument parsed data for inspector run.');
  }
  if (runAllInspectors) {
    options.enabledInspectors = getInspectionPlaygroundInspectorKeys_();
  } else {
    options.enabledInspectors = [inspectionPlaygroundInspectorNameToKey_(selectedInspectorName)];
  }

  appendInspectionPlaygroundLog_(sheet, 'Started ' + (runAllInspectors ? 'full inspection' : selectedInspectorName) + ' for ' + url);
  const result = runInspection(url, options);
  const completedAt = new Date();
  writeInspectionPlaygroundResult_(sheet, result, startedAt, completedAt);
  appendInspectionPlaygroundLog_(sheet, 'Completed inspection in ' + (completedAt.getTime() - startedAt.getTime()) + ' ms');
  SpreadsheetApp.getUi().alert('Inspection Playground run complete.');
}

function writeInspectionPlaygroundResult_(sheet, result, startedAt, completedAt) {
  const evidenceCount = Array.isArray(result.evidence) ? result.evidence.length : 0;
  const findingCount = Array.isArray(result.findings) ? result.findings.length : 0;

  sheet.getRange('E6').setValue((completedAt.getTime() - startedAt.getTime()) + ' ms');
  sheet.getRange('E7').setValue(result.overallScore);
  sheet.getRange('E8').setValue(result.overallGrade);
  sheet.getRange('E9').setValue(findingCount);
  sheet.getRange('E10').setValue(evidenceCount);
  sheet.getRange('E11').setValue(completedAt).setNumberFormat('yyyy-mm-dd hh:mm:ss');

  writeInspectionPlaygroundCategoryScores_(sheet, result.categoryScores || {});
  writeInspectionPlaygroundPriorityMatrix_(sheet, result.priorityMatrix || {});
  writeInspectionPlaygroundInspectorResults_(sheet, result.inspectorResults || [], result);

  const json = stringifyInspectionPlaygroundResult_(result);
  sheet.getRange('A38:H58').breakApart();
  sheet.getRange('A38:H58').merge().setValue(json).setWrap(true).setVerticalAlignment('top').setFontFamily('Menlo').setFontSize(9);
  PropertiesService.getDocumentProperties().setProperty('INSPECTION_PLAYGROUND_LAST_RESULT', json);
  PropertiesService.getDocumentProperties().setProperty('INSPECTION_PLAYGROUND_LAST_OUTPUT_TYPE', 'InspectionResult');
}

function writeInspectionPlaygroundWebsiteDocument_(sheet, document, startedAt, completedAt) {
  const runtimeMs = completedAt.getTime() - startedAt.getTime();
  sheet.getRange('E6').setValue(runtimeMs + ' ms');
  sheet.getRange('E7').setValue('');
  sheet.getRange('E8').setValue(document.fetchStatus || '');
  sheet.getRange('E9').setValue('');
  sheet.getRange('E10').setValue('');
  sheet.getRange('E11').setValue(completedAt).setNumberFormat('yyyy-mm-dd hh:mm:ss');

  writeInspectionPlaygroundRows_(sheet, 15, 1, 10, 4, [
    ['Final URL', document.finalUrl || '', '', ''],
    ['Status Code', document.statusCode || '', '', ''],
    ['Visible Text Length', document.visibleText ? document.visibleText.length : 0, '', ''],
    ['Links', document.links ? document.links.length : 0, '', ''],
    ['Images', document.images ? document.images.length : 0, '', ''],
    ['Forms', document.forms ? document.forms.length : 0, '', ''],
    ['Phones', document.phoneNumbers ? document.phoneNumbers.length : 0, '', ''],
    ['Emails', document.emails ? document.emails.length : 0, '', '']
  ], 'No WebsiteDocument summary available.');
  writeInspectionPlaygroundRows_(sheet, 15, 6, 10, 3, [
    ['Warnings', (document.warnings || []).length, (document.warnings || []).join(' | ')],
    ['Errors', (document.errors || []).length, (document.errors || []).join(' | ')],
    ['Redirects', document.executionMetadata && document.executionMetadata.redirects ? document.executionMetadata.redirects.length : 0, '']
  ], 'No WebsiteDocument diagnostics available.');
  writeInspectionPlaygroundRows_(sheet, 27, 1, 11, 8, [[
    'WebsiteFetchEngine',
    'WebsiteDocument',
    document.version || '1.0',
    document.fetchStatus || '',
    runtimeMs,
    '',
    '',
    (document.errors || []).join(' | ')
  ]], 'No fetch results available.');

  const json = stringifyInspectionPlaygroundResult_(document);
  sheet.getRange('A38:H58').breakApart();
  sheet.getRange('A38:H58').merge().setValue(json).setWrap(true).setVerticalAlignment('top').setFontFamily('Menlo').setFontSize(9);
  PropertiesService.getDocumentProperties().setProperty('INSPECTION_PLAYGROUND_LAST_RESULT', json);
  PropertiesService.getDocumentProperties().setProperty('INSPECTION_PLAYGROUND_LAST_OUTPUT_TYPE', 'WebsiteDocument');
}

function writeInspectionPlaygroundCategoryScores_(sheet, categoryScores) {
  const rows = Object.keys(categoryScores).map(function(key) {
    const score = categoryScores[key] || {};
    return [
      score.category || key,
      score.score,
      score.findingCount || 0,
      (score.criticalCount || 0) + '/' + (score.highCount || 0)
    ];
  }).slice(0, 10);
  writeInspectionPlaygroundRows_(sheet, 15, 1, 10, 4, rows, 'No category scores available.');
}

function writeInspectionPlaygroundPriorityMatrix_(sheet, priorityMatrix) {
  const rows = Object.keys(priorityMatrix).map(function(key) {
    const item = priorityMatrix[key] || {};
    return [
      key,
      item.description || item.meaning || '',
      item.action || item.recommendedAction || ''
    ];
  }).slice(0, 10);
  writeInspectionPlaygroundRows_(sheet, 15, 6, 10, 3, rows, 'No priority matrix available.');
}

function writeInspectionPlaygroundInspectorResults_(sheet, inspectorResults, result) {
  const evidenceByInspector = countInspectionPlaygroundEvidenceByInspector_(result);
  const rows = (inspectorResults || []).map(function(item) {
    const status = item.status === 'Unavailable' ? 'Not Implemented' : item.status;
    return [
      item.name || '',
      item.category || '',
      item.version || '',
      status,
      item.durationMs || 0,
      item.findingsAdded || 0,
      evidenceByInspector[item.name] || 0,
      item.error || ''
    ];
  }).slice(0, 11);
  writeInspectionPlaygroundRows_(sheet, 27, 1, 11, 8, rows, 'No inspector results available.');
}

function writeInspectionPlaygroundRows_(sheet, startRow, startColumn, maxRows, columnCount, rows, emptyMessage) {
  const range = sheet.getRange(startRow, startColumn, maxRows, columnCount);
  range.clearContent();
  if (!rows.length) {
    range.getCell(1, 1).setValue(emptyMessage).setFontColor('#6B7280');
    return;
  }
  const paddedRows = rows.map(function(row) {
    const output = row.slice(0, columnCount);
    while (output.length < columnCount) {
      output.push('');
    }
    return output;
  });
  sheet.getRange(startRow, startColumn, paddedRows.length, columnCount).setValues(paddedRows);
}

function writeInspectionPlaygroundSection_(sheet, row, column, columnSpan, title) {
  sheet.getRange(row, column, 1, columnSpan)
    .merge()
    .setValue(title)
    .setBackground('#05070A')
    .setFontColor('#C8A15A')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

function getInspectionPlaygroundJson_(sheet) {
  return PropertiesService.getDocumentProperties().getProperty('INSPECTION_PLAYGROUND_LAST_RESULT') ||
    String(sheet.getRange('A38').getDisplayValue() || '').trim();
}

function getInspectionPlaygroundResult_(sheet) {
  const parsed = getInspectionPlaygroundParsedJson_(sheet);
  return parsed && parsed.objectType === 'InspectionResult' ? parsed : null;
}

function getInspectionPlaygroundParsedJson_(sheet) {
  const json = getInspectionPlaygroundJson_(sheet);
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function getInspectionPlaygroundWebsiteDocument_(sheet, url) {
  const parsed = getInspectionPlaygroundParsedJson_(sheet);
  if (!parsed || parsed.objectType !== 'WebsiteDocument') {
    return null;
  }
  const requestedUrl = normalizeWebsiteKey_(url);
  const originalUrl = normalizeWebsiteKey_(parsed.originalUrl);
  const finalUrl = normalizeWebsiteKey_(parsed.finalUrl);
  return requestedUrl && (requestedUrl === originalUrl || requestedUrl === finalUrl) ? parsed : null;
}

function buildInspectionPlaygroundOptionsFromWebsiteDocument_(document) {
  return {
    reportFile: {
      sourceUrl: document.finalUrl,
      html: document.rawHtml,
      pageHtml: document.rawHtml,
      text: document.visibleText,
      pageText: document.visibleText,
      homepageText: document.visibleText,
      links: document.links,
      forms: document.forms,
      headings: document.headings,
      images: document.images,
      buttons: document.buttons,
      evidence: {
        websiteDocument: document
      }
    },
    evidence: {
      websiteDocument: document,
      website: {
        html: document.rawHtml,
        text: document.visibleText,
        homepageText: document.visibleText,
        links: document.links,
        forms: document.forms,
        headings: document.headings,
        images: document.images,
        buttons: document.buttons
      }
    },
    html: document.rawHtml,
    pageHtml: document.rawHtml,
    text: document.visibleText,
    pageText: document.visibleText,
    homepageText: document.visibleText,
    links: document.links || [],
    forms: document.forms || [],
    headings: document.headings || [],
    images: document.images || [],
    buttons: document.buttons || []
  };
}

function stringifyInspectionPlaygroundResult_(result) {
  return JSON.stringify(result, function(key, value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    }
    return value;
  }, 2);
}

function showInspectionPlaygroundObjectModal_(title, value) {
  const json = JSON.stringify(value || {}, null, 2);
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:16px;">' +
      '<h2 style="margin:0 0 12px;color:#111;">' + escapeHtml_(title) + '</h2>' +
      '<pre style="white-space:pre-wrap;background:#F8F6F0;border:1px solid #DDD;padding:12px;max-height:480px;overflow:auto;">' +
        escapeHtml_(json) +
      '</pre>' +
    '</div>'
  ).setWidth(680).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

function appendInspectionPlaygroundLog_(sheet, message) {
  const startRow = 61;
  const maxRows = 12;
  const existing = sheet.getRange(startRow, 1, maxRows, 8).getValues();
  const nextRows = [[new Date(), message, '', '', '', '', '', '']].concat(existing).slice(0, maxRows);
  sheet.getRange(startRow, 1, maxRows, 8).setValues(nextRows).setWrap(true);
  sheet.getRange(startRow, 1, maxRows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function countInspectionPlaygroundEvidenceByInspector_(result) {
  const counts = {};
  (result.findings || []).forEach(function(finding) {
    const inspectorName = finding.metadata && finding.metadata.inspector ? finding.metadata.inspector : '';
    if (!inspectorName) {
      return;
    }
    counts[inspectorName] = (counts[inspectorName] || 0) + (finding.evidence || []).length;
  });
  return counts;
}

function getInspectionPlaygroundInspectorNames_() {
  return [
    'Contact Information',
    'Homepage',
    'Calls To Action',
    'Trust Signals',
    'Local SEO',
    'Google Business',
    'Performance',
    'Accessibility',
    'Security',
    'Lead Capture',
    'Analytics',
    'Brand Consistency',
    'Content Quality'
  ];
}

function getInspectionPlaygroundInspectorKeys_() {
  return getInspectionPlaygroundInspectorNames_().map(function(name) {
    return inspectionPlaygroundInspectorNameToKey_(name);
  });
}

function inspectionPlaygroundInspectorNameToKey_(name) {
  const normalized = normalizeInspectionInspectorKey_(name);
  if (normalized === 'calls-to-action') {
    return 'calls-to-action';
  }
  return normalized;
}

function getInspectionPlaygroundSheetName_() {
  return 'Inspection Playground';
}

function isDeveloperModeEnabled_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSystemSettingsSection_(ss);
  if (!sheet) {
    return false;
  }
  return isDeveloperModeTrueValue_(getDeveloperModeValue_(sheet));
}

function isDeveloperModeEnabledReadOnly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    return false;
  }
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    return false;
  }
  return isDeveloperModeTrueValue_(
    findSystemDeveloperModeValue_(sheet) || findLegacyDeveloperModeValue_(sheet)
  );
}

function ensureSystemSettingsSection_(ss) {
  if (!ss) {
    return null;
  }

  let sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
  }

  const existingDeveloperModeValue = findSystemDeveloperModeValue_(sheet) || findLegacyDeveloperModeValue_(sheet) || 'FALSE';
  removeDuplicateSettingsChromeRows_(sheet);
  let sectionRow = findSystemSettingsSectionRow_(sheet);

  if (!sectionRow) {
    if (sheet.getLastRow() > 0 || sheet.getLastColumn() > 0) {
      sheet.insertRowsBefore(1, 3);
    }
    writeSystemSettingsSection_(sheet, existingDeveloperModeValue, 1);
    sectionRow = 1;
  } else {
    repairSystemSettingsSection_(sheet, sectionRow, existingDeveloperModeValue);
  }

  cleanupDuplicateSystemSettingsSections_(sheet, sectionRow);
  sectionRow = findSystemSettingsSectionRow_(sheet) || 1;
  ensureDropdownListsSection_(sheet);
  formatSystemSettingsSection_(sheet, sectionRow);
  return sheet;
}

function repairSystemSettingsSection_(sheet, sectionRow, developerModeValue) {
  const headerRow = sectionRow + 1;
  const developerRow = findDeveloperModeRowNearSection_(sheet, sectionRow) || sectionRow + 2;

  if (developerRow !== sectionRow + 2) {
    sheet.insertRowBefore(sectionRow + 2);
    sheet.getRange(sectionRow + 2, 1, 1, 2).setValues([[
      'Developer Mode',
      isDeveloperModeTrueValue_(developerModeValue) ? 'TRUE' : 'FALSE'
    ]]);
  }

  sheet.getRange(sectionRow, 1, 1, 2).breakApart();
  sheet.getRange(sectionRow, 1, 1, 2).merge().setValue('System Settings');
  sheet.getRange(headerRow, 1, 1, 2).setValues([['Setting', 'Value']]);

  if (String(sheet.getRange(sectionRow + 2, 1).getDisplayValue()).trim() !== 'Developer Mode') {
    sheet.getRange(sectionRow + 2, 1).setValue('Developer Mode');
  }

  if (!String(sheet.getRange(sectionRow + 2, 2).getDisplayValue()).trim()) {
    sheet.getRange(sectionRow + 2, 2).setValue(isDeveloperModeTrueValue_(developerModeValue) ? 'TRUE' : 'FALSE');
  }
}

function cleanupDuplicateSystemSettingsSections_(sheet, preserveSectionRow) {
  const systemRows = findRowsWithColumnAValue_(sheet, 'System Settings');
  const rowsToDelete = [];

  for (let index = systemRows.length - 1; index >= 0; index -= 1) {
    const row = systemRows[index];
    if (row === preserveSectionRow) {
      continue;
    }
    const blockSize = getSystemSettingsBlockSize_(sheet, row);
    for (let offset = 0; offset < blockSize; offset += 1) {
      rowsToDelete.push(row + offset);
    }
  }

  const developerRows = findRowsWithColumnAValue_(sheet, 'Developer Mode');
  const preserveDeveloperRow = preserveSectionRow + 2;
  developerRows.forEach(function(row) {
    if (row !== preserveDeveloperRow && isDeveloperModeSettingsRow_(sheet, row)) {
      rowsToDelete.push(row);
    }
  });

  deleteSheetRowsSafely_(sheet, rowsToDelete);
}

function removeDuplicateSettingsChromeRows_(sheet) {
  const rows = findRowsWithColumnAValueCaseInsensitive_(sheet, 'SETTINGS');
  deleteSheetRowsSafely_(sheet, rows);
}

function ensureDropdownListsSection_(sheet) {
  const title = 'Dropdown Lists and Helper Values';
  removeDuplicateSettingsChromeRows_(sheet);

  let sectionRow = findSystemSettingsSectionRow_(sheet) || 1;
  if (sectionRow !== 1) {
    sectionRow = 1;
  }

  const dropdownRows = findRowsWithColumnAValue_(sheet, title);
  let targetRow = 4;
  let sourceRow = dropdownRows.length ? dropdownRows[0] : 0;

  if (!sourceRow) {
    sheet.insertRowBefore(targetRow);
    writeDropdownListsSection_(sheet, targetRow);
    trimRowsBetweenSettingsAndDropdownHelpers_(sheet);
    return;
  }

  const duplicateRows = dropdownRows.filter(function(row) {
    return row !== sourceRow;
  });
  deleteSheetRowsSafely_(sheet, duplicateRows);
  sourceRow = findRowsWithColumnAValue_(sheet, title)[0] || sourceRow;

  if (sourceRow > targetRow && areRowsSafeToRemove_(sheet, targetRow, sourceRow - 1)) {
    sheet.deleteRows(targetRow, sourceRow - targetRow);
    sourceRow = targetRow;
  } else if (sourceRow !== targetRow) {
    sheet.insertRowBefore(targetRow);
    writeDropdownListsSection_(sheet, targetRow);
    const oldRows = findRowsWithColumnAValue_(sheet, title).filter(function(row) {
      return row !== targetRow;
    });
    deleteSheetRowsSafely_(sheet, oldRows);
    sourceRow = targetRow;
  }

  writeDropdownListsSection_(sheet, sourceRow);
  trimRowsBetweenSettingsAndDropdownHelpers_(sheet);
}

function trimRowsBetweenSettingsAndDropdownHelpers_(sheet) {
  const titleRow = findRowsWithColumnAValue_(sheet, 'Dropdown Lists and Helper Values')[0] || 4;
  const helperRow = findFirstDropdownHelperTableRow_(sheet, titleRow + 1);
  const endRow = helperRow ? helperRow - 1 : sheet.getLastRow();
  const rowsToDelete = [];

  for (let row = titleRow + 1; row <= endRow; row += 1) {
    if (isSettingsDecorativeOrEmptyRow_(sheet, row)) {
      rowsToDelete.push(row);
    }
  }

  deleteSheetRowsSafely_(sheet, rowsToDelete);
}

function areRowsSafeToRemove_(sheet, startRow, endRow) {
  if (endRow < startRow) {
    return true;
  }
  for (let row = startRow; row <= endRow; row += 1) {
    if (!isSettingsDecorativeOrEmptyRow_(sheet, row)) {
      return false;
    }
  }
  return true;
}

function isSettingsDecorativeOrEmptyRow_(sheet, row) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(row, 1, 1, lastColumn).getDisplayValues()[0];
  const nonBlank = values.map(function(value) {
    return String(value || '').trim();
  }).filter(Boolean);
  if (!nonBlank.length) {
    return true;
  }
  if (isStaleSystemSettingsHeaderRow_(nonBlank)) {
    return true;
  }
  if (nonBlank.length === 1 && /^(settings|dropdown lists and helper values)$/i.test(nonBlank[0])) {
    return true;
  }
  return false;
}

function findFirstDropdownHelperTableRow_(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  for (let row = Math.max(startRow || 1, 1); row <= lastRow; row += 1) {
    const values = sheet.getRange(row, 1, 1, lastColumn).getDisplayValues()[0];
    if (isDropdownHelperTableRow_(values)) {
      return row;
    }
  }
  return 0;
}

function isDropdownHelperTableRow_(rowValues) {
  const requiredHeaders = [
    'Source',
    'Audit Outcome',
    'Priority Tier',
    'Status',
    'Next Action',
    'Offer / Service',
    'Moved to CRM'
  ];
  const normalizedValues = (rowValues || []).map(function(value) {
    return String(value || '').trim().toLowerCase();
  }).filter(Boolean);
  let matches = 0;
  requiredHeaders.forEach(function(header) {
    if (normalizedValues.indexOf(header.toLowerCase()) !== -1) {
      matches += 1;
    }
  });
  return matches >= 2;
}

function isStaleSystemSettingsHeaderRow_(nonBlankValues) {
  if (!nonBlankValues || nonBlankValues.length !== 2) {
    return false;
  }
  return String(nonBlankValues[0] || '').trim().toLowerCase() === 'setting' &&
    String(nonBlankValues[1] || '').trim().toLowerCase() === 'value';
}

function writeDropdownListsSection_(sheet, row) {
  const lastColumn = Math.max(sheet.getLastColumn(), 2);
  sheet.getRange(row, 1, 1, lastColumn).breakApart();
  sheet.getRange(row, 1, 1, Math.min(lastColumn, 8)).merge().setValue('Dropdown Lists and Helper Values');
  formatDropdownListsSection_(sheet, row);
}

function formatDropdownListsSection_(sheet, row) {
  const titleRow = row || (findRowsWithColumnAValue_(sheet, 'Dropdown Lists and Helper Values')[0] || 4);
  const lastColumn = Math.max(sheet.getLastColumn(), 2);
  sheet.getRange(titleRow, 1, 1, Math.min(lastColumn, 8))
    .setBackground('#05070A')
    .setFontColor('#C8A15A')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(titleRow, 30);
}

function getSystemSettingsBlockSize_(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  let size = 1;
  if (startRow + 1 <= lastRow &&
      String(sheet.getRange(startRow + 1, 1).getDisplayValue()).trim() === 'Setting' &&
      String(sheet.getRange(startRow + 1, 2).getDisplayValue()).trim() === 'Value') {
    size = 2;
  }
  if (startRow + 2 <= lastRow &&
      String(sheet.getRange(startRow + 2, 1).getDisplayValue()).trim() === 'Developer Mode') {
    size = 3;
  }
  return size;
}

function isDeveloperModeSettingsRow_(sheet, row) {
  const value = String(sheet.getRange(row, 2).getDisplayValue()).trim();
  return !value || /^(true|false|yes|no|on|off|enabled|disabled)$/i.test(value);
}

function deleteSheetRowsSafely_(sheet, rows) {
  const uniqueRows = {};
  (rows || []).forEach(function(row) {
    if (row > 0 && row <= sheet.getLastRow()) {
      uniqueRows[row] = true;
    }
  });
  Object.keys(uniqueRows).map(Number).sort(function(a, b) {
    return b - a;
  }).forEach(function(row) {
    if (row <= sheet.getLastRow()) {
      sheet.deleteRow(row);
    }
  });
}

function getDeveloperModeValue_(sheet) {
  const sectionRow = findSystemSettingsSectionRow_(sheet);
  if (!sectionRow) {
    return 'FALSE';
  }
  const developerRow = findDeveloperModeRowNearSection_(sheet, sectionRow);
  if (!developerRow) {
    return 'FALSE';
  }
  return sheet.getRange(developerRow, 2).getDisplayValue() || 'FALSE';
}

function findSystemSettingsSectionRow_(sheet) {
  const rows = findRowsWithColumnAValue_(sheet, 'System Settings');
  return rows.length ? rows[0] : 0;
}

function findSystemDeveloperModeValue_(sheet) {
  const sectionRows = findRowsWithColumnAValue_(sheet, 'System Settings');
  for (let index = 0; index < sectionRows.length; index += 1) {
    const developerRow = findDeveloperModeRowNearSection_(sheet, sectionRows[index]);
    if (!developerRow) {
      continue;
    }
    const value = String(sheet.getRange(developerRow, 2).getDisplayValue()).trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function findDeveloperModeRowNearSection_(sheet, sectionRow) {
  const lastRow = sheet.getLastRow();
  const maxRow = Math.min(lastRow, sectionRow + 6);
  for (let row = sectionRow + 1; row <= maxRow; row += 1) {
    if (String(sheet.getRange(row, 1).getDisplayValue()).trim() === 'Developer Mode') {
      return row;
    }
  }
  return 0;
}

function findRowsWithColumnAValue_(sheet, targetValue) {
  const lastRow = sheet.getLastRow();
  if (!lastRow) {
    return [];
  }
  const values = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  const target = String(targetValue || '').trim();
  const rows = [];
  values.forEach(function(rowValues, index) {
    if (String(rowValues[0] || '').trim() === target) {
      rows.push(index + 1);
    }
  });
  return rows;
}

function findRowsWithColumnAValueCaseInsensitive_(sheet, targetValue) {
  const lastRow = sheet.getLastRow();
  if (!lastRow) {
    return [];
  }
  const values = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  const target = String(targetValue || '').trim().toLowerCase();
  const rows = [];
  values.forEach(function(rowValues, index) {
    if (String(rowValues[0] || '').trim().toLowerCase() === target) {
      rows.push(index + 1);
    }
  });
  return rows;
}

function hasSystemSettingsSection_(sheet) {
  return !!findSystemSettingsSectionRow_(sheet);
}

function writeSystemSettingsSection_(sheet, developerModeValue, startRow) {
  const row = startRow || 1;
  sheet.getRange(row, 1, 3, 2).breakApart();
  sheet.getRange(row, 1, 1, 2).merge().setValue('System Settings');
  sheet.getRange(row + 1, 1, 1, 2).setValues([['Setting', 'Value']]);
  sheet.getRange(row + 2, 1, 1, 2).setValues([[
    'Developer Mode',
    isDeveloperModeTrueValue_(developerModeValue) ? 'TRUE' : 'FALSE'
  ]]);
  formatSystemSettingsSection_(sheet, row);
}

function formatSystemSettingsSection_(sheet, startRow) {
  const row = startRow || findSystemSettingsSectionRow_(sheet) || 1;
  sheet.getRange(row, 1, 1, 2)
    .setBackground('#05070A')
    .setFontColor('#C8A15A')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(row + 1, 1, 1, 2)
    .setBackground('#111827')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(row + 2, 1, 1, 2)
    .setBackground('#FFFFFF')
    .setFontColor('#111111')
    .setFontWeight('normal')
    .setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(row + 2, 2)
    .setDataValidation(buildDropdownValidation_(['FALSE', 'TRUE']))
    .setHorizontalAlignment('center');
  sheet.setColumnWidth(1, Math.max(sheet.getColumnWidth(1), 180));
  sheet.setColumnWidth(2, Math.max(sheet.getColumnWidth(2), 120));
}

function findLegacyDeveloperModeValue_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  for (let row = 0; row < values.length; row++) {
    for (let column = 0; column < values[row].length; column++) {
      if (String(values[row][column] || '').trim().toLowerCase() !== 'developer mode') {
        continue;
      }
      return firstNonBlank_([
        values[row][column + 1],
        values[row + 1] ? values[row + 1][column] : ''
      ]);
    }
  }
  return '';
}

function isDeveloperModeTrueValue_(value) {
  return /^(true|yes|on|enabled)$/i.test(String(value || '').trim());
}
