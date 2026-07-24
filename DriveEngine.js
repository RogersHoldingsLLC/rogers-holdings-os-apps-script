/**
 * Business Optimization Platform - DriveEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function convertToClient() {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const clientSheet = getRequiredSheet_(context.ss, CLIENTS_SHEET);
  const clientTable = ensureClientColumns_(clientSheet);
  const prospectHeaders = ensureProspectConversionColumns_(context.sheet, context.table.headers);
  const prospectValues = context.sheet.getRange(context.selectedRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
  const prospect = {
    company: getValueByHeader_(prospectValues, prospectHeaders, 'Company'),
    contact: getValueByHeader_(prospectValues, prospectHeaders, 'Contact'),
    email: getValueByHeader_(prospectValues, prospectHeaders, 'Email'),
    phone: getValueByHeader_(prospectValues, prospectHeaders, 'Phone'),
    website: getValueByHeader_(prospectValues, prospectHeaders, 'Website'),
    service: getValueByHeader_(prospectValues, prospectHeaders, 'Offer / Service'),
    priorityTier: getValueByHeader_(prospectValues, prospectHeaders, 'Priority Tier'),
    auditScore: getValueByHeader_(prospectValues, prospectHeaders, 'Audit Score'),
    auditOutcome: getValueByHeader_(prospectValues, prospectHeaders, 'Audit Outcome'),
    notes: getValueByHeader_(prospectValues, prospectHeaders, 'Notes')
  };

  if (clientExists_(clientSheet, clientTable.headers, prospect.company, prospect.website)) {
    ui.alert('Business Optimization Platform', 'This prospect already exists in the Clients tab.', ui.ButtonSet.OK);
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
    ui.alert('Business Optimization Platform', 'Enter a valid contract value, then run Convert Prospect To Client again.', ui.ButtonSet.OK);
    return;
  }

  const startDate = startOfDay_(new Date());

  const clientFolders = createClientFolderStructure_(prospect.company);
  moveExistingAuditPackageFilesToAuditFolder_(clientFolders.root, clientFolders.audit);
  createClientOnboardingFiles_(clientFolders.root, prospect);
  createClientRecord_(clientSheet, clientTable.headers, prospect, contractValue, startDate);
  setProspectStatus_(context.sheet, prospectHeaders, context.selectedRow, 'Won');
  updateSelectedProspectLastActivity_(context.sheet, prospectHeaders, context.selectedRow);
  setSelectedProspectClosedDate_(context.sheet, prospectHeaders, context.selectedRow, new Date());
  logPipelineActivity_(context.ss, prospect.company, 'Client Converted', 'Converted prospect to active client');
  context.sheet.deleteRow(context.selectedRow);
  refreshSalesOperatingSystem_();

  ui.alert('Business Optimization Platform', 'Prospect converted to active client.', ui.ButtonSet.OK);
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
    '- Track next actions through Business Optimization Platform.',
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
    '[ ] Update Business Optimization Platform next action'
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
    existingFile.setDescription(`Updated by Business Optimization Platform on ${new Date().toISOString()}`);
    return existingFile;
  }

  const file = folder.createFile(fileName, contents, mimeType);
  file.setDescription(`Created by Business Optimization Platform on ${new Date().toISOString()}`);
  return file;
}

function upsertAuditPackageBlobFile_(folder, fileName, blob) {
  const existingFile = findAuditPackageFileByName_(folder, fileName);
  if (existingFile) {
    existingFile.setTrashed(true);
  }

  const file = folder.createFile(blob.setName(fileName));
  file.setDescription(`${existingFile ? 'Updated' : 'Created'} by Business Optimization Platform on ${new Date().toISOString()}`);
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

function ensureProspectConversionColumns_(sheet, headers) {
  if (headers['Closed Date']) {
    return headers;
  }

  return ensureSheetColumns_(sheet, ['Closed Date']).headers;
}

function clientExists_(sheet, headers, company, website) {
  const dataStartRow = findBestHeaderRow_(sheet) + 1;
  const rowCount = Math.max(sheet.getLastRow() - dataStartRow + 1, 0);
  if (rowCount <= 0) {
    return false;
  }

  const values = sheet.getRange(dataStartRow, 1, rowCount, sheet.getLastColumn()).getValues();
  const companyKey = normalizeLookupKey_(company);
  const websiteKey = normalizeWebsiteKey_(website);

  return values.some(function(row) {
    const existingCompany = normalizeLookupKey_(row[headers['Client Name'] - 1] || (headers.Client ? row[headers.Client - 1] : ''));
    const existingWebsite = normalizeWebsiteKey_(row[headers.Website - 1]);

    return (companyKey && existingCompany === companyKey) ||
      (websiteKey && existingWebsite === websiteKey);
  });
}

function createClientRecord_(sheet, headers, prospect, contractValue, startDate) {
  const rowValues = new Array(sheet.getLastColumn()).fill('');
  const now = new Date();

  setIfHeader_(rowValues, headers, 'Client Name', prospect.company);
  setIfHeader_(rowValues, headers, 'Contact', prospect.contact);
  setIfHeader_(rowValues, headers, 'Email', prospect.email);
  setIfHeader_(rowValues, headers, 'Phone', prospect.phone);
  setIfHeader_(rowValues, headers, 'Website', prospect.website);
  setIfHeader_(rowValues, headers, 'Service', prospect.service);
  setIfHeader_(rowValues, headers, 'Priority Tier', prospect.priorityTier);
  setIfHeader_(rowValues, headers, 'Contract Value', contractValue);
  setIfHeader_(rowValues, headers, 'Client Since', startDate);
  setIfHeader_(rowValues, headers, 'Status', 'Active');
  setIfHeader_(rowValues, headers, 'Last Activity', now);
  setIfHeader_(rowValues, headers, 'Client', prospect.company);

  const targetRow = Math.max(sheet.getLastRow() + 1, findBestHeaderRow_(sheet) + 1);
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  sheet.getRange(targetRow, headers['Contract Value']).setNumberFormat('$#,##0.00');
  sheet.getRange(targetRow, headers['Client Since']).setNumberFormat('yyyy-mm-dd');
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
