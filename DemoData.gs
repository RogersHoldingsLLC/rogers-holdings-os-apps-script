/**
 * Rogers Holdings OS - DemoData.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function resetDemoData() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Rogers Holdings OS',
    'This will clear demo/test data from Master Prospect Tracker, Activity Feed, Clients, and generated demo folders. Continue?',
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const activitySheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const clientsSheet = getRequiredSheet_(ss, CLIENTS_SHEET);
  let demoProspects = buildDemoProspectRecords_();
  const summary = {
    prospectsCreated: 0,
    clientsCreated: 0,
    activityEntriesCreated: 0,
    foldersCreated: 0,
    filesCreated: 0
  };

  clearAllRowsBelowHeaderPreservingFormulas_(masterSheet, ['Company']);
  clearDemoRowsFromSheet_(activitySheet, ['Company']);
  clearDemoRowsFromSheet_(clientsSheet, ['Client Name', 'Client']);
  clearDemoDriveFolders_(DEMO_COMPANY_NAMES);

  const masterTable = ensureSheetColumns_(masterSheet, getDemoProspectHeaders_());
  demoProspects = normalizeDemoProspectRecordsForDropdowns_(masterSheet, masterTable, demoProspects);
  const demoClients = buildDemoClientRecords_(demoProspects);
  demoProspects.forEach(function(prospect) {
    writeDemoRecordToSheet_(masterSheet, masterTable, prospect, 'Company');
    summary.prospectsCreated += 1;
  });

  const clientsTable = ensureClientColumns_(clientsSheet);
  demoClients.forEach(function(client) {
    writeDemoRecordToSheet_(clientsSheet, clientsTable, client, 'Client Name');
    summary.clientsCreated += 1;
  });

  const activityTable = getHeaderTable_(activitySheet, ['Date', 'Company', 'Activity Type', 'Activity Notes']);
  const activityEntries = buildDemoActivityEntries_();
  activityEntries.forEach(function(entry) {
    writeDemoRecordToSheet_(activitySheet, activityTable, entry, 'Company');
    summary.activityEntriesCreated += 1;
  });

  DEMO_COMPANY_NAMES.forEach(function(companyName) {
    const prospect = demoProspects.filter(function(record) {
      return record.Company === companyName;
    })[0];
    const driveResult = createDemoCompanyDriveAssets_(companyName, prospect);
    summary.foldersCreated += driveResult.foldersCreated;
    summary.filesCreated += driveResult.filesCreated;
  });

  refreshSalesOperatingSystem_();

  ui.alert(
    'Rogers Holdings OS',
    [
      'Reset Demo Data complete.',
      '',
      `Prospects created: ${summary.prospectsCreated}`,
      `Clients created: ${summary.clientsCreated}`,
      `Activity entries created: ${summary.activityEntriesCreated}`,
      `Folders created: ${summary.foldersCreated}`,
      `Files created: ${summary.filesCreated}`
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

function buildDemoProspectRecords_() {
  const today = startOfDay_(new Date());
  return [
    {
      Company: 'Bluegrass Roofing Co',
      Contact: 'Evan Miller',
      Email: 'evan@bluegrassroofing.example',
      Phone: '(859) 555-0142',
      Website: 'https://bluegrassroofing.example',
      City: 'Lexington',
      State: 'KY',
      Industry: 'Roofing',
      Source: 'Manual Import',
      'Audit Score': 84,
      'Audit Outcome': 'Strong Fit',
      'Priority Tier': 'A - Hot',
      Status: 'Digital Business Assessment Presented',
      'Next Action': 'Generate Improvement Plan',
      'Follow-Up Date': addDays_(today, 3),
      'Offer / Service': 'Local SEO',
      Notes: 'Customers can find the business, but calls-to-action and service pages can be clearer.',
      Summary: 'Strong local presence with conversion opportunities. High-value roofing prospect converted to client after audit package review.',
      'Audit Package Generated': 'Yes',
      'Audit Package Date': addDays_(today, -5),
      'Last Activity': new Date()
    },
    {
      Company: 'Commonwealth Plumbing',
      Contact: 'Megan Harper',
      Email: 'megan@commonwealthplumbing.example',
      Phone: '(859) 555-0188',
      Website: 'https://commonwealthplumbing.example',
      City: 'Winchester',
      State: 'KY',
      Industry: 'Plumbing',
      Source: 'Manual Import',
      'Audit Score': 58,
      'Audit Outcome': 'Not Audited',
      'Priority Tier': 'A - Hot',
      Status: 'Lead Found',
      'Next Action': 'Generate Executive Snapshot',
      'Follow-Up Date': addDays_(today, 2),
      'Offer / Service': 'Website Audit',
      Notes: 'Search visibility may be limited. Visitors may not know the next step to take.',
      Summary: 'High opportunity to improve local search visibility. Plumbing company needs clearer service information and stronger local search signals.',
      'Audit Package Generated': '',
      'Audit Package Date': '',
      'Last Activity': addDays_(today, -1)
    },
    {
      Company: 'Summit HVAC Services',
      Contact: 'Daniel Brooks',
      Email: 'daniel@summithvac.example',
      Phone: '(859) 555-0163',
      Website: 'https://summithvac.example',
      City: 'Richmond',
      State: 'KY',
      Industry: 'HVAC',
      Source: 'Manual Import',
      'Audit Score': 63,
      'Audit Outcome': 'Good Fit',
      'Priority Tier': 'B - Good',
      Status: 'Digital Business Assessment Presented',
      'Next Action': 'Follow Up',
      'Follow-Up Date': addDays_(today, 1),
      'Offer / Service': 'Client Website',
      Notes: 'Potential customers may not have an easy way to request service quickly.',
      Summary: 'Solid foundation with missed lead capture opportunities. Audit package sent with recommendations for service calls and maintenance plan leads.',
      'Audit Package Generated': 'Yes',
      'Audit Package Date': addDays_(today, -2),
      'Last Activity': addDays_(today, -2)
    },
    {
      Company: 'Copper Door Cafe',
      Contact: 'Rachel Kim',
      Email: 'rachel@copperdoorcafe.example',
      Phone: '(859) 555-0194',
      Website: 'https://copperdoorcafe.example',
      City: 'Georgetown',
      State: 'KY',
      Industry: 'Restaurant',
      Source: 'Manual Import',
      'Audit Score': 79,
      'Audit Outcome': 'Good Fit',
      'Priority Tier': 'B - Good',
      Status: 'Client',
      'Next Action': 'Follow Up',
      'Follow-Up Date': addDays_(today, 4),
      'Offer / Service': 'Google Business Optimization',
      Notes: 'A few visibility improvements could make the cafe easier to find in local search.',
      Summary: 'Good brand presence with local discovery improvements available. Cafe converted after reviewing local search and menu visibility recommendations.',
      'Audit Package Generated': 'Yes',
      'Audit Package Date': addDays_(today, -6),
      'Last Activity': new Date()
    },
    {
      Company: 'North Point Fitness',
      Contact: 'Jordan Ellis',
      Email: 'jordan@northpointfitness.example',
      Phone: '(859) 555-0177',
      Website: 'https://northpointfitness.example',
      City: 'Nicholasville',
      State: 'KY',
      Industry: 'Fitness',
      Source: 'Manual Import',
      'Audit Score': 51,
      'Audit Outcome': 'Needs Nurture',
      'Priority Tier': 'A - Hot',
      Status: 'Discovery Meeting Scheduled',
      'Next Action': 'Present Digital Business Assessment',
      'Follow-Up Date': addDays_(today, 0),
      'Offer / Service': 'Client Website',
      Notes: 'Visitors may not know the next step to take. Clearer messaging could improve inquiries.',
      Summary: 'Needs clearer membership path and stronger trust signals. Discovery call scheduled to review membership conversion opportunities.',
      'Audit Package Generated': 'Yes',
      'Audit Package Date': addDays_(today, -3),
      'Last Activity': addDays_(today, -1)
    },
    {
      Company: 'Sterling Family Dental',
      Contact: 'Dr. Laura Benton',
      Email: 'office@sterlingfamilydental.example',
      Phone: '(859) 555-0155',
      Website: 'https://sterlingfamilydental.example',
      City: 'Lexington',
      State: 'KY',
      Industry: 'Dental',
      Source: 'Manual Import',
      'Audit Score': 72,
      'Audit Outcome': 'Strong Fit',
      'Priority Tier': 'B - Good',
      Status: 'Improvement Plan Sent',
      'Next Action': 'Follow Up',
      'Follow-Up Date': addDays_(today, 2),
      'Offer / Service': 'Local SEO',
      Notes: 'The online presence could do more to build trust before a patient reaches out.',
      Summary: 'Professional site with room to improve appointment conversion. Proposal sent for appointment-focused conversion improvements.',
      'Audit Package Generated': 'Yes',
      'Audit Package Date': addDays_(today, -4),
      'Last Activity': addDays_(today, -1)
    },
    {
      Company: 'Main Street Auto Repair',
      Contact: 'Chris Wallace',
      Email: 'chris@mainstreetautorepair.example',
      Phone: '(859) 555-0119',
      Website: 'https://mainstreetauto.example',
      City: 'Paris',
      State: 'KY',
      Industry: 'Auto Repair',
      Source: 'Manual Import',
      'Audit Score': 46,
      'Audit Outcome': 'Needs Nurture',
      'Priority Tier': 'A - Hot',
      Status: 'Nurture',
      'Next Action': 'Follow Up',
      'Follow-Up Date': addDays_(today, -1),
      'Offer / Service': 'Business Systems',
      Notes: 'Customers may not immediately understand the services offered.',
      Summary: 'High opportunity to improve trust and service clarity. Follow-up due after initial audit outreach.',
      'Audit Package Generated': '',
      'Audit Package Date': '',
      'Last Activity': addDays_(today, -8)
    },
    {
      Company: 'Heritage Lawn Care',
      Contact: 'Tyler Vaughn',
      Email: 'tyler@heritagelawncare.example',
      Phone: '(859) 555-0138',
      Website: 'https://heritagelawncare.example',
      City: 'Versailles',
      State: 'KY',
      Industry: 'Lawn Care',
      Source: 'Manual Import',
      'Audit Score': 39,
      'Audit Outcome': 'Poor Fit',
      'Priority Tier': 'C - Later',
      Status: 'Nurture',
      'Next Action': 'Generate Executive Snapshot',
      'Follow-Up Date': addDays_(today, 7),
      'Offer / Service': 'Consulting',
      Notes: 'Customers may have difficulty finding the business online.',
      Summary: 'Early-stage lead needing education and nurture. Nurture lead with lower urgency but clear local visibility opportunity.',
      'Audit Package Generated': '',
      'Audit Package Date': '',
      'Last Activity': addDays_(today, -3)
    }
  ];
}

function buildDemoClientRecords_(demoProspects) {
  const today = startOfDay_(new Date());
  const clientConfig = {
    'Bluegrass Roofing Co': {
      contractValue: 4800,
      clientSince: addDays_(today, -14)
    },
    'Copper Door Cafe': {
      contractValue: 3200,
      clientSince: addDays_(today, -9)
    }
  };

  return demoProspects.filter(function(prospect) {
    return !!clientConfig[prospect.Company];
  }).map(function(prospect) {
    const config = clientConfig[prospect.Company];
    return {
      'Client Name': prospect.Company,
      Contact: prospect.Contact,
      Email: prospect.Email,
      Phone: prospect.Phone,
      Website: prospect.Website,
      Service: prospect['Offer / Service'],
      'Priority Tier': prospect['Priority Tier'],
      'Contract Value': config.contractValue,
      'Client Since': config.clientSince,
      Status: 'Active',
      'Last Activity': new Date()
    };
  });
}

function normalizeDemoProspectRecordsForDropdowns_(sheet, table, demoProspects) {
  const dropdowns = {
    source: getDropdownAllowedValuesForHeader_(sheet, table, 'Source'),
    priorityTier: getDropdownAllowedValuesForHeader_(sheet, table, 'Priority Tier'),
    nextAction: getDropdownAllowedValuesForHeader_(sheet, table, 'Next Action'),
    offerService: getDropdownAllowedValuesForHeader_(sheet, table, 'Offer / Service')
  };
  const offerServiceValues = [
    'Website Audit',
    'Google Business Optimization',
    'Local SEO',
    'AI Automation',
    'Business Systems',
    'Client Website',
    'Monthly Support',
    'One-Time Project',
    'Consulting'
  ];

  return demoProspects.map(function(prospect) {
    const normalized = Object.assign({}, prospect);
    normalized.Source = chooseAllowedValue_(dropdowns.source, ['Manual Import', 'Website Audit Tool'], 'Manual Import');
    normalized['Priority Tier'] = chooseAllowedValue_(
      dropdowns.priorityTier,
      [normalized['Priority Tier'], mapDemoPriorityTier_(normalized['Priority Tier'])],
      mapDemoPriorityTier_(normalized['Priority Tier'])
    );
    normalized['Next Action'] = normalizeDemoNextAction_(normalized['Next Action'], dropdowns.nextAction);
    normalized['Offer / Service'] = chooseAllowedValue_(
      dropdowns.offerService.length ? dropdowns.offerService : offerServiceValues,
      [normalized['Offer / Service']].concat(offerServiceValues),
      normalized['Offer / Service']
    );
    return normalized;
  });
}

function normalizeDemoNextAction_(nextAction, allowedValues) {
  const mappings = {
    'Generate audit package': ['Present Digital Business Assessment', 'Generate Improvement Plan', 'Follow Up'],
    'Run website audit': ['Generate Executive Snapshot', 'Create Outreach Draft', 'Follow Up'],
    'Follow Up': ['Follow Up', 'Create Outreach Draft'],
    'Schedule kickoff': ['Start Project', 'Follow Up'],
    'Conduct Discovery Call': ['Present Digital Business Assessment', 'Follow Up'],
    'Follow up on proposal': ['Follow Up', 'Generate Improvement Plan'],
    'Send follow-up email': ['Follow Up', 'Create Outreach Draft'],
    'Send helpful local visibility note': ['Create Outreach Draft', 'Follow Up']
  };
  const candidates = mappings[nextAction] || [nextAction, 'Follow Up', 'Create Outreach Draft', 'Generate Executive Snapshot', 'Generate Improvement Plan'];
  return chooseAllowedValue_(allowedValues, candidates, candidates[0]);
}

function mapDemoPriorityTier_(priorityTier) {
  const value = String(priorityTier || '').trim();
  const mappings = {
    A: 'A - Hot',
    B: 'B - Good',
    C: 'C - Later',
    'A - Hot': 'A - Hot',
    'B - Good': 'B - Good',
    'C - Later': 'C - Later'
  };
  return mappings[value] || value;
}

function chooseAllowedValue_(allowedValues, candidates, fallback) {
  if (!allowedValues || !allowedValues.length) {
    return fallback;
  }

  const normalizedAllowed = allowedValues.reduce(function(result, value) {
    result[normalizeDropdownValue_(value)] = value;
    return result;
  }, {});

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const key = normalizeDropdownValue_(candidate);
    if (normalizedAllowed[key]) {
      return normalizedAllowed[key];
    }
  }

  return allowedValues[0] || fallback;
}

function getDropdownAllowedValuesForHeader_(sheet, table, header) {
  if (!table.headers[header]) {
    return [];
  }

  const dataStartRow = table.headerRow + 1;
  const validation = findColumnDataValidation_(sheet, table.headers[header], dataStartRow);
  if (!validation) {
    return [];
  }

  const criteria = validation.getCriteriaType();
  const values = validation.getCriteriaValues();
  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return uniqueNonBlankValues_(values[0] || []);
  }

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && values[0]) {
    return uniqueNonBlankValues_(flattenRangeDisplayValues_(values[0]));
  }

  return [];
}

function findColumnDataValidation_(sheet, column, dataStartRow) {
  const rowsToScan = Math.min(Math.max(sheet.getMaxRows() - dataStartRow + 1, 1), 25);
  const validations = sheet.getRange(dataStartRow, column, rowsToScan, 1).getDataValidations();
  for (let rowIndex = 0; rowIndex < validations.length; rowIndex += 1) {
    if (validations[rowIndex][0]) {
      return validations[rowIndex][0];
    }
  }

  return null;
}

function flattenRangeDisplayValues_(range) {
  return range.getDisplayValues().reduce(function(result, row) {
    return result.concat(row);
  }, []);
}

function uniqueNonBlankValues_(values) {
  const seen = {};
  const result = [];
  values.forEach(function(value) {
    const text = String(value || '').trim();
    const key = normalizeDropdownValue_(text);
    if (text && !seen[key]) {
      seen[key] = true;
      result.push(text);
    }
  });
  return result;
}

function buildDemoActivityEntries_() {
  const today = startOfDay_(new Date());
  const entries = [];
  buildDemoProspectRecords_().forEach(function(prospect, index) {
    entries.push({
      Date: addDays_(today, -8 + index),
      Company: prospect.Company,
      'Activity Type': 'Prospect Imported',
      'Activity Notes': 'Demo prospect added through Reset Demo Data.'
    });
    entries.push({
      Date: addDays_(today, -6 + index),
      Company: prospect.Company,
      'Activity Type': prospect.Status === 'Lead Found' || prospect.Status === 'Nurture' ? 'Lead Reviewed' : 'Digital Business Assessment Generated',
      'Activity Notes': prospect.Summary
    });
  });

  entries.push({
    Date: addDays_(today, -5),
    Company: 'Bluegrass Roofing Co',
    'Activity Type': 'Client Converted',
    'Activity Notes': 'Converted demo prospect to active client.'
  });
  entries.push({
    Date: addDays_(today, -4),
    Company: 'Copper Door Cafe',
    'Activity Type': 'Client Converted',
    'Activity Notes': 'Converted demo prospect to active client.'
  });
  entries.push({
    Date: addDays_(today, -2),
    Company: 'Summit HVAC Services',
    'Activity Type': 'Digital Business Assessment Sent',
    'Activity Notes': 'Digital Business Assessment sent for review.'
  });
  entries.push({
    Date: addDays_(today, -1),
    Company: 'Sterling Family Dental',
    'Activity Type': 'Improvement Plan Generated',
    'Activity Notes': 'Improvement Plan generated for appointment conversion package.'
  });

  return entries;
}

function clearAllRowsBelowHeaderPreservingFormulas_(sheet, requiredHeaders) {
  const table = getHeaderTable_(sheet, requiredHeaders || []);
  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return 0;
  }

  const range = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn);
  const formulas = range.getFormulas();
  range.clearContent();
  restoreFormulas_(range, formulas);
  return rowCount;
}

function restoreFormulas_(range, formulas) {
  const hasFormulas = formulas.some(function(row) {
    return row.some(function(formula) {
      return String(formula || '').trim() !== '';
    });
  });

  if (hasFormulas) {
    range.setFormulas(formulas);
  }
}

function clearDemoRowsFromSheet_(sheet, companyHeaders) {
  const table = getHeaderTable_(sheet, []);
  const availableHeaders = companyHeaders.filter(function(header) {
    return !!table.headers[header];
  });
  if (!availableHeaders.length) {
    return 0;
  }

  const dataStartRow = table.headerRow + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return 0;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, table.lastColumn).getValues();
  let clearedCount = 0;
  values.forEach(function(row, index) {
    const label = firstNonBlank_(availableHeaders.map(function(header) {
      return getValueByHeader_(row, table.headers, header);
    }));

    if (isDemoOrTestRecord_(label)) {
      sheet.getRange(dataStartRow + index, 1, 1, table.lastColumn).clearContent();
      clearedCount += 1;
    }
  });

  return clearedCount;
}

function writeDemoRecordToSheet_(sheet, table, record, keyHeader) {
  const targetRow = findFirstBlankDataRow_(sheet, table, keyHeader);
  const rowValues = new Array(table.lastColumn).fill('');
  Object.keys(record).forEach(function(header) {
    setIfHeader_(rowValues, table.headers, header, record[header]);
  });
  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
  applyDemoRecordNumberFormats_(sheet, table.headers, targetRow);
}

function findFirstBlankDataRow_(sheet, table, keyHeader) {
  const dataStartRow = table.headerRow + 1;
  const keyColumn = table.headers[keyHeader];
  const lastRow = Math.max(sheet.getLastRow(), dataStartRow);
  const rowCount = Math.max(lastRow - dataStartRow + 1, 1);
  const values = sheet.getRange(dataStartRow, keyColumn, rowCount, 1).getValues();

  for (let index = 0; index < values.length; index += 1) {
    if (!String(values[index][0] || '').trim()) {
      return dataStartRow + index;
    }
  }

  return lastRow + 1;
}

function applyDemoRecordNumberFormats_(sheet, headers, row) {
  ['Follow-Up Date', 'Audit Package Date', 'Client Since', 'Last Activity', 'Date'].forEach(function(header) {
    if (headers[header]) {
      sheet.getRange(row, headers[header]).setNumberFormat(header === 'Last Activity' ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd');
    }
  });

  if (headers['Contract Value']) {
    sheet.getRange(row, headers['Contract Value']).setNumberFormat('$#,##0.00');
  }
}

function clearDemoDriveFolders_(companyNames) {
  companyNames.forEach(function(companyName) {
    const folders = DriveApp.getFoldersByName(companyName);
    while (folders.hasNext()) {
      folders.next().setTrashed(true);
    }
  });
}

function createDemoCompanyDriveAssets_(companyName, prospect) {
  const folder = getOrCreateAuditPackageFolder_(companyName);
  let foldersCreated = 1;
  let filesCreated = 0;
  const internalProspect = demoProspectToInternalProspect_(prospect);
  const proposal = buildProposal_(internalProspect);
  trashLegacyAuditPackageTextFiles_(folder);
  upsertAuditPackageBlobFile_(folder, 'Audit Report.pdf', buildAuditReportPdfBlob_(internalProspect, { text: buildDemoAuditReportText_(prospect) }));
  upsertAuditPackageTextFile_(folder, 'Outreach Email Draft.txt', buildAuditPackageOutreachText_(buildOutreachDrafts_(internalProspect)), MimeType.PLAIN_TEXT);
  upsertAuditPackageBlobFile_(folder, 'Proposal.pdf', buildProposalPdfBlob_(internalProspect, proposal));
  filesCreated += 3;

  if (companyName === 'Bluegrass Roofing Co' || companyName === 'Copper Door Cafe') {
    createClientFolderStructure_(companyName);
    createClientOnboardingFiles_(folder, internalProspect);
    foldersCreated += 6;
    filesCreated += 3;
  }

  return {
    foldersCreated: foldersCreated,
    filesCreated: filesCreated
  };
}

function buildDemoAuditReportText_(prospect) {
  return [
    'ROGERS HOLDINGS LLC',
    'DEMO WEBSITE AUDIT REPORT',
    '',
    `Company: ${prospect.Company}`,
    `Website: ${prospect.Website}`,
    `Audit Score: ${prospect['Audit Score']}/100`,
    `Audit Outcome: ${prospect['Audit Outcome']}`,
    '',
    'Summary',
    prospect.Summary,
    '',
    'Findings',
    prospect.Notes
  ].join('\n');
}

function demoProspectToInternalProspect_(prospect) {
  return {
    company: prospect.Company,
    contact: prospect.Contact,
    email: prospect.Email,
    phone: prospect.Phone,
    website: prospect.Website,
    city: prospect.City,
    state: prospect.State,
    industry: prospect.Industry,
    auditScore: prospect['Audit Score'],
    auditOutcome: prospect['Audit Outcome'],
    priorityTier: prospect['Priority Tier'],
    offerService: prospect['Offer / Service'],
    service: prospect['Offer / Service'],
    notes: prospect.Notes,
    summary: prospect.Summary
  };
}

function isDemoOrTestRecord_(value) {
  const normalized = normalizeLookupKey_(value);
  if (!normalized) {
    return false;
  }

  const demoNames = DEMO_COMPANY_NAMES.reduce(function(result, companyName) {
    result[normalizeLookupKey_(companyName)] = true;
    return result;
  }, {});

  return demoNames[normalized] === true ||
    normalized.indexOf('demo') !== -1 ||
    normalized.indexOf('test') !== -1;
}

function addDays_(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}
