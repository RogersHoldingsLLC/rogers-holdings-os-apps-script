/**
 * Rogers Holdings OS - HealthCheck.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function runSystemHealthCheck() {
  const report = buildSystemHealthReport_();
  const html = HtmlService
    .createHtmlOutput(buildSystemHealthCheckHtml_(report))
    .setWidth(820)
    .setHeight(720);

  SpreadsheetApp.getUi().showModalDialog(html, 'System Health Check');
}

function buildSystemHealthReport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    MASTER_PROSPECT_SHEET,
    ACTIVITY_FEED_SHEET,
    DASHBOARD_METRICS_SHEET,
    CLIENTS_SHEET,
    CLIENT_WORKSPACE_SHEET,
    FOLLOW_UPS_SHEET,
    PROJECTS_SHEET,
    'Executive Dashboard'
  ];
  const requiredHeaders = {};
  requiredHeaders[MASTER_PROSPECT_SHEET] = [
    'Company',
    'Status',
    'Source',
    'Website',
    'City',
    'State',
    'Industry',
    'Audit Score',
    'Audit Outcome',
    'Priority Tier',
    'Last Activity',
    'Follow-Up Date',
    'Next Action'
  ];
  requiredHeaders[ACTIVITY_FEED_SHEET] = [
    'Date',
    'Company',
    'Activity Type',
    'Activity Notes'
  ];
  requiredHeaders[CLIENTS_SHEET] = [
    'Client ID',
    'Company',
    'Client Name',
    'Contact',
    'Email',
    'Phone',
    'Website',
    'Industry',
    'Service Package',
    'Start Date',
    'Renewal Date',
    'Contract Value',
    'Client Since',
    'Status',
    'Assigned To',
    'Current Project',
    'Project Status',
    'Due Date',
    'Last Activity',
    'Notes'
  ];
  requiredHeaders[FOLLOW_UPS_SHEET] = FOLLOW_UP_COLUMNS;
  requiredHeaders[PROJECTS_SHEET] = PROJECT_COLUMNS;
  const report = {
    generatedAt: new Date(),
    status: 'Pass',
    summary: {
      pass: 0,
      warning: 0,
      fail: 0,
      totalIssues: 0
    },
    items: []
  };
  const sheetInfo = {};

  requiredSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    sheetInfo[sheetName] = {
      sheet: sheet,
      table: sheet ? getHealthHeaderTable_(sheet) : null
    };

    if (!sheet) {
      addHealthItem_(report, 'Fail', 'Missing required sheet', sheetName, `Create or restore the "${sheetName}" sheet.`);
    } else {
      addHealthItem_(report, 'Pass', 'Required sheet exists', sheetName, 'No action needed.');
    }
  });

  Object.keys(requiredHeaders).forEach(function(sheetName) {
    const info = sheetInfo[sheetName];
    if (!info || !info.sheet) {
      return;
    }

    const missing = requiredHeaders[sheetName].filter(function(header) {
      return !info.table.headers[header];
    });

    if (missing.length) {
      addHealthItem_(
        report,
        'Fail',
        'Missing required headers',
        `${sheetName}: ${missing.join(', ')}`,
        'Restore the missing headers exactly as listed before running daily workflows.'
      );
    } else {
      addHealthItem_(report, 'Pass', 'Required headers exist', sheetName, 'No action needed.');
    }
  });

  addProspectDataHealthChecks_(report, sheetInfo);
  addClientDataHealthChecks_(report, sheetInfo);
  addClientWorkflowHealthChecks_(report, sheetInfo);
  addFollowUpWorkflowHealthChecks_(report, sheetInfo);
  addProjectWorkflowHealthChecks_(report, sheetInfo);
  addRuntimeDependencyHealthChecks_(report);
  finalizeSystemHealthReport_(report);
  storeSystemHealthStatus_(report);
  Logger.log('Rogers Holdings OS System Health Check: ' + JSON.stringify(report));

  return report;
}

function storeSystemHealthStatus_(report) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('ROGERS_OS_LAST_HEALTH_CHECK_AT', new Date().toISOString());
  properties.setProperty('ROGERS_OS_LAST_HEALTH_CHECK_RESULT', report.status || 'Unknown');
  properties.setProperty('ROGERS_OS_LAST_GMAIL_STATUS', getHealthCheckStatusByCheck_(report, 'Gmail permissions available', 'Gmail permissions unavailable'));
  properties.setProperty('ROGERS_OS_LAST_DRIVE_STATUS', getHealthCheckStatusByCheck_(report, 'Drive permissions available', 'Drive permissions unavailable'));
  properties.setProperty('ROGERS_OS_LAST_PDF_STATUS', getHealthCheckStatusByCheck_(report, 'Audit Report.pdf generation dependencies available', 'Audit Report.pdf dependency check failed'));
}

function getHealthCheckStatusByCheck_(report, passCheck, failCheck) {
  const items = report && report.items ? report.items : [];
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].check === passCheck || items[index].check === failCheck) {
      return items[index].status || 'Unknown';
    }
  }
  return 'Unknown';
}

function addRuntimeDependencyHealthChecks_(report) {
  addScriptPropertyHealthChecks_(report);
  addBrandAssetFolderHealthCheck_(report);
  addDrivePermissionHealthCheck_(report);
  addGmailPermissionHealthCheck_(report);
  addPdfGenerationDependencyHealthCheck_(report);
}

function addScriptPropertyHealthChecks_(report) {
  const properties = PropertiesService.getScriptProperties();
  const auditEndpoint = String(
    properties.getProperty('WEBSITE_AUDIT_TOOL_URL') ||
    properties.getProperty('WEBSITE_AUDIT_TOOL_ENDPOINT') ||
    ''
  ).trim();
  const brandFolderId = String(
    properties.getProperty('BRAND_ASSET_FOLDER_ID') ||
    properties.getProperty('ROGERS_BRAND_ASSET_FOLDER_ID') ||
    ''
  ).trim();

  if (auditEndpoint) {
    addHealthItem_(report, 'Pass', 'Audit endpoint script property configured', 'WEBSITE_AUDIT_TOOL_URL or WEBSITE_AUDIT_TOOL_ENDPOINT is available.', 'No action needed.');
  } else {
    addHealthItem_(report, 'Fail', 'Missing audit endpoint script property', 'WEBSITE_AUDIT_TOOL_URL / WEBSITE_AUDIT_TOOL_ENDPOINT', 'Set the Website Audit Tool endpoint before running real audits or audit packages.');
  }

  if (brandFolderId) {
    addHealthItem_(report, 'Pass', 'Brand asset folder script property configured', 'BRAND_ASSET_FOLDER_ID or ROGERS_BRAND_ASSET_FOLDER_ID is available.', 'No action needed.');
  } else {
    addHealthItem_(report, 'Warning', 'Brand asset folder script property not configured', 'Brand folder will be discovered by Drive folder name if possible.', 'Set BRAND_ASSET_FOLDER_ID for more reliable PDF branding.');
  }
}

function addBrandAssetFolderHealthCheck_(report) {
  try {
    const folder = getBrandAssetPackageFolder_();
    if (folder) {
      addHealthItem_(report, 'Pass', 'Brand Asset Folder reachable', folder.getName(), 'No action needed.');
    } else {
      addHealthItem_(report, 'Fail', 'Brand Asset Folder not reachable', 'No configured or discoverable brand folder found.', 'Set BRAND_ASSET_FOLDER_ID or restore the Brand Asset Package folder.');
    }
  } catch (error) {
    addHealthItem_(report, 'Fail', 'Brand Asset Folder check failed', error && error.message ? error.message : String(error), 'Verify Drive permissions and brand folder access.');
  }
}

function addDrivePermissionHealthCheck_(report) {
  try {
    DriveApp.getRootFolder().getName();
    addHealthItem_(report, 'Pass', 'Drive permissions available', 'DriveApp can access Drive.', 'No action needed.');
  } catch (error) {
    addHealthItem_(report, 'Fail', 'Drive permissions unavailable', error && error.message ? error.message : String(error), 'Authorize Drive access for Rogers Holdings OS.');
  }
}

function addGmailPermissionHealthCheck_(report) {
  let draft = null;
  try {
    const recipient = Session.getActiveUser().getEmail() || getRogersContactInfo_().email;
    draft = GmailApp.createDraft(recipient, 'Rogers Holdings OS Permission Check', 'Temporary draft created by System Health Check.');
    trashTemporaryGmailDraft_(draft);
    addHealthItem_(report, 'Pass', 'Gmail permissions available', 'GmailApp can create and remove a temporary draft.', 'No action needed.');
  } catch (error) {
    if (draft) {
      try {
        trashTemporaryGmailDraft_(draft);
      } catch (trashError) {
        console.warn('Temporary Gmail permission draft could not be trashed: ' + (trashError && trashError.message ? trashError.message : String(trashError)));
      }
    }
    addHealthItem_(report, 'Fail', 'Gmail permissions unavailable', error && error.message ? error.message : String(error), 'Authorize Gmail access before creating Gmail drafts.');
  }
}

function trashTemporaryGmailDraft_(draft) {
  if (!draft) {
    return;
  }

  if (!draft.getMessage() || !draft.getMessage().getThread()) {
    return;
  }

  draft.getMessage().getThread().moveToTrash();
}

function addPdfGenerationDependencyHealthCheck_(report) {
  try {
    const dependencies = [
      ['HtmlService', typeof HtmlService !== 'undefined'],
      ['Utilities', typeof Utilities !== 'undefined'],
      ['DriveApp', typeof DriveApp !== 'undefined'],
      ['getRogersBrandPdfAssets_', typeof getRogersBrandPdfAssets_ === 'function'],
      ['htmlToPdfBlob_', typeof htmlToPdfBlob_ === 'function']
    ];
    const missing = dependencies.filter(function(item) {
      return !item[1];
    }).map(function(item) {
      return item[0];
    });

    if (missing.length) {
      addHealthItem_(report, 'Fail', 'Audit Report.pdf dependencies missing', missing.join(', '), 'Restore missing PDF engine helpers before generating audit packages.');
      return;
    }

    HtmlService.createHtmlOutput('<p>PDF dependency check</p>');
    Utilities.newBlob('PDF dependency check', 'text/html', 'health-check.html');
    addHealthItem_(report, 'Pass', 'Audit Report.pdf generation dependencies available', 'HTML, blob, Drive, and PDF helper dependencies are present.', 'No action needed.');
  } catch (error) {
    addHealthItem_(report, 'Fail', 'Audit Report.pdf dependency check failed', error && error.message ? error.message : String(error), 'Verify Apps Script services and PDF helper functions.');
  }
}

function addProspectDataHealthChecks_(report, sheetInfo) {
  const info = sheetInfo[MASTER_PROSPECT_SHEET];
  if (!info || !info.sheet || !info.table.headers.Company) {
    return;
  }

  const sheet = info.sheet;
  const table = info.table;
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  const companyDuplicates = {};
  const websiteDuplicates = {};
  const blankCompanyRows = [];
  const overdueRows = [];
  const today = startOfDay_(new Date());

  if (rowCount <= 0) {
    addHealthItem_(report, 'Warning', 'No prospect records found', MASTER_PROSPECT_SHEET, 'Add or import prospects before using the sales workflow.');
    return;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row, index) {
    const rowNumber = dataStartRow + index;
    const company = getValueByHeader_(row, table.headers, 'Company');
    const website = getValueByHeader_(row, table.headers, 'Website');
    const companyKey = normalizeLookupKey_(company);
    const websiteKey = normalizeWebsiteKey_(website);

    if (!String(company || '').trim()) {
      blankCompanyRows.push(rowNumber);
    }

    if (companyKey) {
      companyDuplicates[companyKey] = companyDuplicates[companyKey] || [];
      companyDuplicates[companyKey].push(rowNumber);
    }

    if (websiteKey) {
      websiteDuplicates[websiteKey] = websiteDuplicates[websiteKey] || [];
      websiteDuplicates[websiteKey].push(rowNumber);
    }

    if (table.headers['Follow-Up Date']) {
      const followUpDate = dateValueOrNull_(getValueByHeader_(row, table.headers, 'Follow-Up Date'));
      if (followUpDate && startOfDay_(followUpDate).getTime() < today.getTime()) {
        overdueRows.push(`${String(company || 'Row ' + rowNumber).trim()} (row ${rowNumber})`);
      }
    }
  });

  addDuplicateHealthItems_(report, 'Company', companyDuplicates);
  addDuplicateHealthItems_(report, 'Website', websiteDuplicates);

  if (blankCompanyRows.length) {
    addHealthItem_(
      report,
      'Warning',
      'Blank Company values found',
      `Rows: ${blankCompanyRows.join(', ')}`,
      'Add company names or remove incomplete prospect rows.'
    );
  } else {
    addHealthItem_(report, 'Pass', 'No blank Company rows found', MASTER_PROSPECT_SHEET, 'No action needed.');
  }

  if (overdueRows.length) {
    addHealthItem_(
      report,
      'Warning',
      'Overdue follow-ups found',
      overdueRows.join('; '),
      'Review the Follow-Up Queue and complete or reschedule overdue follow-ups.'
    );
  } else {
    addHealthItem_(report, 'Pass', 'No overdue follow-ups found', MASTER_PROSPECT_SHEET, 'No action needed.');
  }
}

function addClientDataHealthChecks_(report, sheetInfo) {
  const prospectInfo = sheetInfo[MASTER_PROSPECT_SHEET];
  const clientInfo = sheetInfo[CLIENTS_SHEET];

  if (!prospectInfo || !clientInfo || !prospectInfo.sheet || !clientInfo.sheet) {
    return;
  }

  const prospectHeaders = prospectInfo.table.headers;
  const clientHeaders = clientInfo.table.headers;
  if (!prospectHeaders.Company || !prospectHeaders.Status || !clientHeaders['Client Name']) {
    return;
  }

  const clientKeys = getClientHealthKeys_(clientInfo.sheet, clientInfo.table);
  const dataStartRow = prospectInfo.table.headerRow + 1;
  const rowCount = Math.max(prospectInfo.sheet.getLastRow() - dataStartRow + 1, 0);
  const missingClients = [];

  if (rowCount > 0) {
    const values = prospectInfo.sheet.getRange(dataStartRow, 1, rowCount, prospectInfo.table.lastColumn).getValues();
    values.forEach(function(row, index) {
      const status = String(getValueByHeader_(row, prospectHeaders, 'Status') || '').trim();
      if (status !== 'Won') {
        return;
      }

      const company = getValueByHeader_(row, prospectHeaders, 'Company');
      const website = getValueByHeader_(row, prospectHeaders, 'Website');
      const companyKey = normalizeLookupKey_(company);
      const websiteKey = normalizeWebsiteKey_(website);
      const clientExists = (companyKey && clientKeys.companies[companyKey]) ||
        (websiteKey && clientKeys.websites[websiteKey]);

      if (!clientExists) {
        missingClients.push(`${String(company || 'Unnamed won prospect').trim()} (row ${dataStartRow + index})`);
      }
    });
  }

  if (missingClients.length) {
    addHealthItem_(
      report,
      'Warning',
      'Won prospects missing from Clients tab',
      missingClients.join('; '),
      'Run Convert To Client for each won prospect or verify the Clients record exists.'
    );
  } else {
    addHealthItem_(report, 'Pass', 'Won prospects are represented in Clients', CLIENTS_SHEET, 'No action needed.');
  }
}

function addClientWorkflowHealthChecks_(report, sheetInfo) {
  const clientWorkspaceInfo = sheetInfo[CLIENT_WORKSPACE_SHEET];
  const workflowChecks = [
    ['Client conversion workflow available', typeof convertWonProspectToClient === 'function' && typeof convertWonProspectToClient_ === 'function'],
    ['Client duplicate prevention available', typeof findExistingClientRow_ === 'function' && typeof upsertClientRecordFromProspect_ === 'function'],
    ['Client Workspace renderer available', typeof openClientWorkspace === 'function' && typeof refreshClientWorkspaceForClientRow_ === 'function'],
    ['Client Dashboard integration available', typeof refreshExecutiveDashboard === 'function' && typeof getClientRevenueMetrics_ === 'function'],
    ['Client Activity logging available', typeof logPipelineActivity_ === 'function']
  ];

  workflowChecks.forEach(function(item) {
    if (item[1]) {
      addHealthItem_(report, 'Pass', item[0], 'Required Client Workspace function is available.', 'No action needed.');
    } else {
      addHealthItem_(report, 'Fail', item[0], 'One or more required Client Workspace functions are missing.', 'Restore the Client Workspace module before using client workflows.');
    }
  });

  if (clientWorkspaceInfo && clientWorkspaceInfo.sheet) {
    addHealthItem_(report, 'Pass', 'Client Workspace sheet available', CLIENT_WORKSPACE_SHEET, 'No action needed.');
  } else {
    addHealthItem_(report, 'Fail', 'Client Workspace sheet missing', CLIENT_WORKSPACE_SHEET, 'Run Refresh Executive Dashboard or Open Client Workspace to create the sheet.');
  }
}

function addFollowUpWorkflowHealthChecks_(report, sheetInfo) {
  const followUpInfo = sheetInfo[FOLLOW_UPS_SHEET];
  const workflowChecks = [
    ['Follow-Ups sheet available', !!(followUpInfo && followUpInfo.sheet)],
    ['Follow-Up creation available', typeof createFollowUp === 'function' && typeof upsertOpenFollowUp_ === 'function'],
    ['Follow-Up completion available', typeof completeFollowUp === 'function' && typeof completeOpenFollowUpsForCompany_ === 'function'],
    ['Follow-Up dashboard integration available', typeof getFollowUpMetrics_ === 'function' && typeof updateDashboardKPIs_ === 'function'],
    ['Follow-Up Next Action integration available', typeof syncFollowUpForProspectRow_ === 'function' && typeof runNextAction === 'function'],
    ['Follow-Up Client Workspace integration available', typeof getFollowUpsForCompany_ === 'function' && typeof buildClientWorkspaceModel_ === 'function']
  ];

  workflowChecks.forEach(function(item) {
    if (item[1]) {
      addHealthItem_(report, 'Pass', item[0], 'Required Follow-Up Engine function is available.', 'No action needed.');
    } else {
      addHealthItem_(report, 'Fail', item[0], 'One or more required Follow-Up Engine functions are missing.', 'Restore the Follow-Up Engine before daily use.');
    }
  });
}

function addProjectWorkflowHealthChecks_(report, sheetInfo) {
  const projectInfo = sheetInfo[PROJECTS_SHEET];
  const workflowChecks = [
    ['Projects sheet available', !!(projectInfo && projectInfo.sheet)],
    ['Project creation available', typeof createProject === 'function' && typeof upsertProjectFromClient_ === 'function'],
    ['Project duplicate prevention available', typeof findExistingProject_ === 'function'],
    ['Project dashboard integration available', typeof getProjectMetrics_ === 'function' && typeof updateDashboardKPIs_ === 'function'],
    ['Project Client Workspace integration available', typeof getProjectsForClient_ === 'function' && typeof buildClientWorkspaceModel_ === 'function'],
    ['Project Activity Feed integration available', typeof logPipelineActivity_ === 'function']
  ];

  workflowChecks.forEach(function(item) {
    if (item[1]) {
      addHealthItem_(report, 'Pass', item[0], 'Required Project Delivery Engine function is available.', 'No action needed.');
    } else {
      addHealthItem_(report, 'Fail', item[0], 'One or more required Project Delivery Engine functions are missing.', 'Restore the Project Delivery Engine before client delivery work.');
    }
  });
}

function getClientHealthKeys_(sheet, table) {
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  const keys = {
    companies: {},
    websites: {}
  };

  if (rowCount <= 0) {
    return keys;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  values.forEach(function(row) {
    const companyKey = normalizeLookupKey_(
      getValueByHeader_(row, table.headers, 'Company') ||
      getValueByHeader_(row, table.headers, 'Client Name')
    );
    const websiteKey = normalizeWebsiteKey_(getValueByHeader_(row, table.headers, 'Website'));

    if (companyKey) {
      keys.companies[companyKey] = true;
    }

    if (websiteKey) {
      keys.websites[websiteKey] = true;
    }
  });

  return keys;
}

function addDuplicateHealthItems_(report, fieldName, lookup) {
  const duplicates = Object.keys(lookup).filter(function(key) {
    return lookup[key].length > 1;
  });

  if (!duplicates.length) {
    addHealthItem_(report, 'Pass', `No duplicate prospects by ${fieldName}`, MASTER_PROSPECT_SHEET, 'No action needed.');
    return;
  }

  duplicates.forEach(function(key) {
    addHealthItem_(
      report,
      'Warning',
      `Duplicate prospects by ${fieldName}`,
      `${fieldName} key "${key}" appears on rows ${lookup[key].join(', ')}`,
      'Merge or remove duplicate prospect records before outreach.'
    );
  });
}

function getHealthHeaderTable_(sheet) {
  const headerRow = findBestHeaderRow_(sheet);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(headerRow, 1, 1, lastColumn).getDisplayValues()[0];
  const headers = {};

  values.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (header && !headers[header]) {
      headers[header] = index + 1;
    }
  });

  return {
    headerRow: headerRow,
    headers: headers,
    lastColumn: lastColumn
  };
}

function addHealthItem_(report, status, check, detail, suggestedFix) {
  report.items.push({
    status: status,
    check: check,
    detail: detail,
    suggestedFix: suggestedFix
  });
}

function finalizeSystemHealthReport_(report) {
  report.items.forEach(function(item) {
    const key = String(item.status || '').toLowerCase();
    if (report.summary[key] !== undefined) {
      report.summary[key] += 1;
    }
  });

  report.summary.totalIssues = report.summary.warning + report.summary.fail;
  if (report.summary.fail > 0) {
    report.status = 'Fail';
  } else if (report.summary.warning > 0) {
    report.status = 'Warning';
  } else {
    report.status = 'Pass';
  }
}

function buildSystemHealthCheckHtml_(report) {
  const statusClass = String(report.status || '').toLowerCase();
  const issueRows = report.items.map(function(item) {
    const rowClass = String(item.status || '').toLowerCase();
    return `
      <tr>
        <td><span class="pill ${rowClass}">${escapeHtml_(item.status)}</span></td>
        <td>${escapeHtml_(item.check)}</td>
        <td>${escapeHtml_(item.detail)}</td>
        <td>${escapeHtml_(item.suggestedFix)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            box-sizing: border-box;
            margin: 0;
            padding: 24px;
            background: #111111;
            color: #f7f3ea;
            font-family: Arial, Helvetica, sans-serif;
          }
          .header {
            border-bottom: 2px solid #b88728;
            margin-bottom: 18px;
            padding-bottom: 14px;
          }
          .eyebrow {
            color: #d8ad4d;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.8px;
            text-transform: uppercase;
          }
          h1 {
            margin: 6px 0 8px;
            color: #ffffff;
            font-size: 28px;
            line-height: 1.15;
          }
          .timestamp {
            color: #cfc6b6;
            font-size: 12px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin: 18px 0;
          }
          .metric {
            border: 1px solid rgba(184, 135, 40, .42);
            background: #181818;
            padding: 12px;
          }
          .metric span {
            display: block;
            color: #cfc6b6;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .metric strong {
            display: block;
            margin-top: 6px;
            color: #ffffff;
            font-size: 22px;
          }
          .overall {
            border-color: #d8ad4d;
          }
          .overall strong.pass {
            color: #7ecf8a;
          }
          .overall strong.warning {
            color: #ffd966;
          }
          .overall strong.fail {
            color: #ff8a80;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #181818;
            border: 1px solid rgba(184, 135, 40, .42);
          }
          th,
          td {
            border-bottom: 1px solid rgba(255, 255, 255, .08);
            padding: 10px;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
            line-height: 1.4;
          }
          th {
            color: #d8ad4d;
            font-size: 11px;
            letter-spacing: .7px;
            text-transform: uppercase;
          }
          .pill {
            display: inline-block;
            min-width: 62px;
            padding: 4px 8px;
            border-radius: 999px;
            color: #111111;
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
          }
          .pill.pass {
            background: #7ecf8a;
          }
          .pill.warning {
            background: #ffd966;
          }
          .pill.fail {
            background: #ff8a80;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="eyebrow">Rogers Holdings OS</div>
          <h1>System Health Check</h1>
          <div class="timestamp">Generated: ${escapeHtml_(formatDisplayDate_(report.generatedAt))}</div>
        </div>

        <div class="summary">
          <div class="metric overall">
            <span>Status</span>
            <strong class="${statusClass}">${escapeHtml_(report.status)}</strong>
          </div>
          <div class="metric">
            <span>Pass</span>
            <strong>${report.summary.pass}</strong>
          </div>
          <div class="metric">
            <span>Warnings</span>
            <strong>${report.summary.warning}</strong>
          </div>
          <div class="metric">
            <span>Fails</span>
            <strong>${report.summary.fail}</strong>
          </div>
          <div class="metric">
            <span>Issues</span>
            <strong>${report.summary.totalIssues}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Check</th>
              <th>Issues Found</th>
              <th>Suggested Fix</th>
            </tr>
          </thead>
          <tbody>${issueRows}</tbody>
        </table>
      </body>
    </html>
  `;
}
