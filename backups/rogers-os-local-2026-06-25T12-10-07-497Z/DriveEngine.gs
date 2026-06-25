/**
 * Rogers Holdings OS - DriveEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function convertToClient() {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const clientSheet = getOrCreateClientsSheet_(context.ss);
  const clientTable = ensureClientColumns_(clientSheet);
  const prospectHeaders = ensureProspectConversionColumns_(context.sheet, context.table.headers);
  const prospectValues = context.sheet.getRange(context.selectedRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
  const prospect = {
    company: getValueByHeader_(prospectValues, prospectHeaders, 'Company'),
    contact: getValueByHeader_(prospectValues, prospectHeaders, 'Contact'),
    email: getValueByHeader_(prospectValues, prospectHeaders, 'Email'),
    phone: getValueByHeader_(prospectValues, prospectHeaders, 'Phone'),
    website: getValueByHeader_(prospectValues, prospectHeaders, 'Website'),
    industry: getValueByHeader_(prospectValues, prospectHeaders, 'Industry'),
    service: getValueByHeader_(prospectValues, prospectHeaders, 'Offer / Service'),
    priorityTier: getValueByHeader_(prospectValues, prospectHeaders, 'Priority Tier'),
    auditScore: getValueByHeader_(prospectValues, prospectHeaders, 'Audit Score'),
    auditOutcome: getValueByHeader_(prospectValues, prospectHeaders, 'Audit Outcome'),
    notes: getValueByHeader_(prospectValues, prospectHeaders, 'Notes')
  };

  if (clientExists_(clientSheet, clientTable.headers, prospect.company, prospect.website)) {
    ui.alert('Rogers Holdings OS', 'This prospect already exists in the Clients tab.', ui.ButtonSet.OK);
    return;
  }

  const contractPrompt = ui.prompt(
    'Convert Prospect To Client',
    'Enter Contract Value:',
    ui.ButtonSet.OK_CANCEL
  );
  if (contractPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const contractValue = parseCurrencyValue_(contractPrompt.getResponseText());
  if (contractValue === null) {
    ui.alert('Rogers Holdings OS', 'Enter a valid contract value, then run Convert Prospect To Client again.', ui.ButtonSet.OK);
    return;
  }

  const startDate = startOfDay_(new Date());

  const clientFolders = createClientFolderStructure_(prospect.company);
  moveExistingAuditPackageFilesToAuditFolder_(clientFolders.root, clientFolders.audit);
  createClientOnboardingFiles_(clientFolders.root, prospect);
  upsertClientRecordFromProspect_(clientSheet, clientTable.headers, prospect, {
    contractValue: contractValue,
    startDate: startDate,
    activityType: 'Client Converted'
  });
  setProspectStatus_(context.sheet, prospectHeaders, context.selectedRow, 'Won');
  updateSelectedProspectLastActivity_(context.sheet, prospectHeaders, context.selectedRow);
  setSelectedProspectClosedDate_(context.sheet, prospectHeaders, context.selectedRow, new Date());
  logPipelineActivity_(context.ss, prospect.company, 'Client Converted', 'Converted prospect to active client');
  context.sheet.deleteRow(context.selectedRow);
  refreshSalesOperatingSystem_();

  ui.alert('Rogers Holdings OS', 'Prospect converted to active client.', ui.ButtonSet.OK);
}

function convertWonProspectToClient() {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const status = normalizePipelineStage_(getValueByHeader_(context.values, context.table.headers, 'Status'));
  if (status !== 'Won') {
    const response = ui.alert(
      'Rogers Holdings OS',
      'This prospect is not marked Won. Mark as Won and convert to Client?',
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) {
      return;
    }
  }

  const result = convertWonProspectToClient_(context);
  ui.alert(
    'Rogers Holdings OS',
    result.created
      ? `Client created.\n\nClient ID: ${result.clientId}`
      : `Client updated.\n\nClient ID: ${result.clientId}`,
    ui.ButtonSet.OK
  );
}

function createClientFolderStructure_(company) {
  const root = getOrCreateAuditPackageFolder_(company);
  return {
    root: root,
    audit: getOrCreateChildFolder_(root, 'Audit'),
    proposal: getOrCreateChildFolder_(root, 'Proposal'),
    contracts: getOrCreateChildFolder_(root, 'Contracts'),
    invoices: getOrCreateChildFolder_(root, 'Invoices'),
    assets: getOrCreateChildFolder_(root, 'Assets'),
    meetings: getOrCreateChildFolder_(root, 'Meetings')
  };
}

function getOrCreateChildFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(folderName);
}

function moveExistingAuditPackageFilesToAuditFolder_(clientRootFolder, auditFolder) {
  const fileNames = [
    'Outreach Email Draft.txt',
    'Proposal.pdf'
  ];
  const auditReport = findNewestAuditPackageFile_(clientRootFolder, function(fileName) {
    return fileName.indexOf('Audit Report') === 0 || fileName.indexOf('Report') !== -1;
  });

  if (auditReport) {
    moveDriveFileToFolder_(auditReport, auditFolder);
  }

  fileNames.forEach(function(fileName) {
    const file = findAuditPackageFileByName_(clientRootFolder, fileName);
    if (file) {
      moveDriveFileToFolder_(file, auditFolder);
    }
  });
}

function moveDriveFileToFolder_(file, destinationFolder) {
  try {
    file.moveTo(destinationFolder);
  } catch (error) {
    console.warn(
      `Convert Prospect To Client: could not move "${file.getName()}" to "${destinationFolder.getName()}": ` +
      (error && error.message ? error.message : String(error))
    );
  }
}

function createClientOnboardingFiles_(clientRootFolder, prospect) {
  upsertAuditPackageTextFile_(
    clientRootFolder,
    'Client Notes.txt',
    buildClientNotesText_(prospect),
    MimeType.PLAIN_TEXT
  );
  upsertAuditPackageTextFile_(
    clientRootFolder,
    'Project Scope.txt',
    buildProjectScopeText_(prospect),
    MimeType.PLAIN_TEXT
  );
  upsertAuditPackageTextFile_(
    clientRootFolder,
    'Onboarding Checklist.txt',
    buildOnboardingChecklistText_(prospect),
    MimeType.PLAIN_TEXT
  );
}

function buildClientNotesText_(prospect) {
  return [
    'ROGERS HOLDINGS LLC',
    'CLIENT NOTES',
    '',
    `Client: ${prospect.company || ''}`,
    `Contact: ${prospect.contact || ''}`,
    `Email: ${prospect.email || ''}`,
    `Phone: ${prospect.phone || ''}`,
    `Website: ${prospect.website || ''}`,
    `Service: ${prospect.service || ''}`,
    `Priority Tier: ${prospect.priorityTier || ''}`,
    '',
    'Audit Context',
    `Audit Score: ${prospect.auditScore || ''}`,
    `Audit Outcome: ${prospect.auditOutcome || ''}`,
    '',
    'Notes',
    prospect.notes || ''
  ].join('\n');
}

function buildProjectScopeText_(prospect) {
  return [
    'ROGERS HOLDINGS LLC',
    'PROJECT SCOPE',
    '',
    `Client: ${prospect.company || ''}`,
    `Service: ${prospect.service || 'Website and local visibility improvement'}`,
    '',
    'Initial Scope',
    '- Confirm client goals and priority business outcomes.',
    '- Review audit findings and recommended improvements.',
    '- Define deliverables, timeline, and approval process.',
    '- Track next actions through Rogers Holdings OS.',
    '',
    'Source Audit',
    `Website: ${prospect.website || ''}`,
    `Audit Score: ${prospect.auditScore || ''}`,
    `Audit Outcome: ${prospect.auditOutcome || ''}`
  ].join('\n');
}

function buildOnboardingChecklistText_(prospect) {
  return [
    'ROGERS HOLDINGS LLC',
    'ONBOARDING CHECKLIST',
    '',
    `Client: ${prospect.company || ''}`,
    '',
    '[ ] Confirm signed agreement',
    '[ ] Confirm invoice/payment setup',
    '[ ] Confirm primary contact',
    '[ ] Collect website/admin access if needed',
    '[ ] Collect brand assets',
    '[ ] Confirm project scope',
    '[ ] Schedule kickoff/discovery meeting',
    '[ ] Define first milestone',
    '[ ] Update Rogers Holdings OS next action'
  ].join('\n');
}

function getOrCreateAuditPackageFolder_(company) {
  const folderName = sanitizeDriveFileName_(company || 'Audit Package');
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}

function storeAuditPackageFiles_(folder, reportFile, drafts, proposal, prospect) {
  const packageFiles = [];
  trashLegacyAuditPackageTextFiles_(folder);
  packageFiles.push(upsertAuditPackageBlobFile_(
    folder,
    'Audit Report.pdf',
    buildAuditReportPdfBlob_(prospect, reportFile)
  ));

  packageFiles.push(upsertAuditPackageTextFile_(
    folder,
    'Outreach Email Draft.txt',
    buildAuditPackageOutreachText_(drafts),
    MimeType.PLAIN_TEXT
  ));
  packageFiles.push(upsertAuditPackageBlobFile_(
    folder,
    'Proposal.pdf',
    buildProposalPdfBlob_(prospect, proposal)
  ));

  return packageFiles;
}

function trashLegacyAuditPackageTextFiles_(folder) {
  [
    'Audit Report.txt',
    'Proposal Draft.txt'
  ].forEach(function(fileName) {
    const file = findAuditPackageFileByName_(folder, fileName);
    if (file) {
      file.setTrashed(true);
    }
  });
}

function upsertAuditPackageTextFile_(folder, fileName, contents, mimeType) {
  const existingFile = findAuditPackageFileByName_(folder, fileName);
  if (existingFile) {
    existingFile.setContent(contents);
    existingFile.setDescription(`Updated by Rogers Holdings OS on ${new Date().toISOString()}`);
    return existingFile;
  }

  const file = folder.createFile(fileName, contents, mimeType);
  file.setDescription(`Created by Rogers Holdings OS on ${new Date().toISOString()}`);
  return file;
}

function upsertAuditPackageBlobFile_(folder, fileName, blob) {
  const existingFile = findAuditPackageFileByName_(folder, fileName);
  if (existingFile) {
    existingFile.setTrashed(true);
  }

  const file = folder.createFile(blob.setName(fileName));
  file.setDescription(`${existingFile ? 'Updated' : 'Created'} by Rogers Holdings OS on ${new Date().toISOString()}`);
  return file;
}

function findAuditPackageFileByName_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function sanitizeDriveFileName_(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|#{}%~&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'Audit Package';
}

function ensureClientColumns_(sheet) {
  return ensureSheetColumns_(sheet, CLIENT_COLUMNS);
}

function getOrCreateClientsSheet_(ss) {
  let sheet = ss.getSheetByName(CLIENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CLIENTS_SHEET);
  }

  ensureClientColumns_(sheet);
  return sheet;
}

function ensureProspectConversionColumns_(sheet, headers) {
  if (headers['Closed Date']) {
    return headers;
  }

  return ensureSheetColumns_(sheet, ['Closed Date']).headers;
}

function clientExists_(sheet, headers, company, website) {
  return !!findExistingClientRow_(sheet, headers, company, website);
}

function generateClientId_(company) {
  const prefix = String(company || 'CLIENT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'CLIENT';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  return `RH-${prefix}-${stamp}`;
}

function findExistingClientRow_(sheet, headers, company, website) {
  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return null;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  const companyKey = normalizeLookupKey_(company);
  const websiteKey = normalizeWebsiteKey_(website);

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const existingCompany = normalizeLookupKey_(
      getValueByHeader_(row, headers, 'Company') ||
      getValueByHeader_(row, headers, 'Client Name') ||
      getValueByHeader_(row, headers, 'Client')
    );
    const existingWebsite = normalizeWebsiteKey_(getValueByHeader_(row, headers, 'Website'));

    if ((companyKey && existingCompany === companyKey) ||
      (websiteKey && existingWebsite === websiteKey)) {
      return {
        rowNumber: dataStartRow + index,
        values: row
      };
    }
  }

  return null;
}

function convertWonProspectToClient_(context) {
  const clientSheet = getOrCreateClientsSheet_(context.ss);
  const clientTable = ensureClientColumns_(clientSheet);
  const prospectHeaders = ensureProspectConversionColumns_(context.sheet, context.table.headers);
  const prospectValues = context.sheet.getRange(context.selectedRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
  const prospect = buildClientProspectFromRow_(prospectValues, prospectHeaders);
  const result = upsertClientRecordFromProspect_(clientSheet, clientTable.headers, prospect, {
    startDate: startOfDay_(new Date())
  });

  setProspectStatusIfHeader_(context.sheet, prospectHeaders, context.selectedRow, 'Won');
  updateSelectedProspectLastActivity_(context.sheet, prospectHeaders, context.selectedRow);
  setSelectedProspectClosedDate_(context.sheet, prospectHeaders, context.selectedRow, new Date());
  logPipelineActivity_(context.ss, prospect.company, 'Prospect Converted to Client', result.created ? 'Won prospect converted to new client record.' : 'Won prospect updated existing client record.');
  logPipelineActivity_(context.ss, prospect.company, result.created ? 'Client Created' : 'Client Updated', result.created ? 'Client record created from won prospect.' : 'Client record updated from won prospect.');
  syncFollowUpForClient_(context.ss, clientSheet.getRange(result.rowNumber, 1, 1, clientTable.lastColumn).getValues()[0], clientTable.headers);
  refreshClientWorkspaceForClientRow_(context.ss, clientSheet, clientTable.headers, result.rowNumber, {
    logOpen: false
  });
  refreshSalesOperatingSystem_();

  return result;
}

function buildClientProspectFromRow_(rowValues, headers) {
  return {
    company: getValueByHeader_(rowValues, headers, 'Company'),
    contact: getValueByHeader_(rowValues, headers, 'Contact'),
    email: getValueByHeader_(rowValues, headers, 'Email'),
    phone: getValueByHeader_(rowValues, headers, 'Phone'),
    website: getValueByHeader_(rowValues, headers, 'Website'),
    industry: getValueByHeader_(rowValues, headers, 'Industry'),
    service: getValueByHeader_(rowValues, headers, 'Offer / Service') || getValueByHeader_(rowValues, headers, 'Service Package'),
    priorityTier: getValueByHeader_(rowValues, headers, 'Priority Tier'),
    auditScore: getValueByHeader_(rowValues, headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(rowValues, headers, 'Audit Outcome'),
    notes: getValueByHeader_(rowValues, headers, 'Notes') || getValueByHeader_(rowValues, headers, 'Summary')
  };
}

function createClientRecord_(sheet, headers, prospect, contractValue, startDate) {
  const result = upsertClientRecordFromProspect_(sheet, headers, prospect, {
    contractValue: contractValue,
    startDate: startDate
  });
  return result.rowNumber;
}

function upsertClientRecordFromProspect_(sheet, headers, prospect, options) {
  const settings = options || {};
  const existing = findExistingClientRow_(sheet, headers, prospect.company, prospect.website);
  const targetRow = existing
    ? existing.rowNumber
    : Math.max(sheet.getLastRow() + 1, findBestHeaderRow_(sheet) + 1);
  const rowValues = existing
    ? existing.values.concat(new Array(Math.max(sheet.getLastColumn() - existing.values.length, 0)).fill('')).slice(0, sheet.getLastColumn())
    : new Array(sheet.getLastColumn()).fill('');
  const now = new Date();
  const startDate = settings.startDate || startOfDay_(new Date());
  const existingValues = existing ? existing.values : [];
  const clientId = getValueByHeader_(existingValues, headers, 'Client ID') || generateClientId_(prospect.company);

  setIfHeader_(rowValues, headers, 'Client ID', clientId);
  setIfHeader_(rowValues, headers, 'Company', firstNonBlank_([prospect.company, getValueByHeader_(existingValues, headers, 'Company')]));
  setIfHeader_(rowValues, headers, 'Client Name', firstNonBlank_([prospect.company, getValueByHeader_(existingValues, headers, 'Client Name')]));
  setIfHeader_(rowValues, headers, 'Contact', firstNonBlank_([prospect.contact, getValueByHeader_(existingValues, headers, 'Contact')]));
  setIfHeader_(rowValues, headers, 'Email', firstNonBlank_([prospect.email, getValueByHeader_(existingValues, headers, 'Email')]));
  setIfHeader_(rowValues, headers, 'Phone', firstNonBlank_([prospect.phone, getValueByHeader_(existingValues, headers, 'Phone')]));
  setIfHeader_(rowValues, headers, 'Website', firstNonBlank_([prospect.website, getValueByHeader_(existingValues, headers, 'Website')]));
  setIfHeader_(rowValues, headers, 'Industry', firstNonBlank_([prospect.industry, getValueByHeader_(existingValues, headers, 'Industry')]));
  setIfHeader_(rowValues, headers, 'Service Package', firstNonBlank_([prospect.service, getValueByHeader_(existingValues, headers, 'Service Package')]));
  setIfHeader_(rowValues, headers, 'Start Date', startDate);
  setIfHeader_(rowValues, headers, 'Renewal Date', addOneYear_(startDate));
  setIfHeader_(rowValues, headers, 'Assigned To', getRogersContactInfo_().name);
  setIfHeader_(rowValues, headers, 'Current Project', firstNonBlank_([prospect.service, getValueByHeader_(existingValues, headers, 'Current Project'), 'Client Onboarding']));
  setIfHeader_(rowValues, headers, 'Project Status', firstNonBlank_([getValueByHeader_(existingValues, headers, 'Project Status'), 'Active']));
  setIfHeader_(rowValues, headers, 'Due Date', addDaysFromDate_(startDate, 30));
  setIfHeader_(rowValues, headers, 'Service', firstNonBlank_([prospect.service, getValueByHeader_(existingValues, headers, 'Service')]));
  setIfHeader_(rowValues, headers, 'Priority Tier', prospect.priorityTier);
  setIfHeader_(rowValues, headers, 'Contract Value', settings.contractValue || getValueByHeader_(existingValues, headers, 'Contract Value'));
  setIfHeader_(rowValues, headers, 'Client Since', startDate);
  setIfHeader_(rowValues, headers, 'Status', 'Active');
  setIfHeader_(rowValues, headers, 'Last Activity', now);
  setIfHeader_(rowValues, headers, 'Notes', firstNonBlank_([prospect.notes, getValueByHeader_(existingValues, headers, 'Notes')]));
  setIfHeader_(rowValues, headers, 'Client', firstNonBlank_([prospect.company, getValueByHeader_(existingValues, headers, 'Client')]));

  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  if (headers['Contract Value']) {
    sheet.getRange(targetRow, headers['Contract Value']).setNumberFormat('$#,##0.00');
  }
  ['Client Since', 'Start Date', 'Renewal Date', 'Due Date', 'Last Activity'].forEach(function(header) {
    if (headers[header]) {
      sheet.getRange(targetRow, headers[header]).setNumberFormat(header === 'Last Activity' ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd');
    }
  });

  return {
    created: !existing,
    updated: !!existing,
    rowNumber: targetRow,
    clientId: clientId
  };
}

function addOneYear_(date) {
  const value = startOfDay_(date || new Date());
  value.setFullYear(value.getFullYear() + 1);
  return value;
}

function addDaysFromDate_(date, days) {
  const value = startOfDay_(date || new Date());
  value.setDate(value.getDate() + days);
  return value;
}

function setSelectedProspectClosedDate_(sheet, headers, selectedRow, closedDate) {
  if (!headers['Closed Date']) {
    return;
  }

  const date = startOfDay_(closedDate);
  sheet.getRange(selectedRow, headers['Closed Date']).setValue(date).setNumberFormat('yyyy-mm-dd');
}

function parseCurrencyValue_(value) {
  const cleaned = String(value || '').replace(/[$,\s]/g, '');
  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isNaN(number) ? null : number;
}

function parseDateInputOrToday_(value) {
  const text = String(value || '').trim();
  if (!text) {
    return startOfDay_(new Date());
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDay_(date);
}
