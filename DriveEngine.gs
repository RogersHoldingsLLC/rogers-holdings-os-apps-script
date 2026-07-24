/**
 * Business Optimization Platform - DriveEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function convertToClient() {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) return;
  const status = normalizePipelineStage_(getValueByHeader_(context.values, context.table.headers, 'Status')) || 'Lead Found';
  if (status === 'Improvement Plan Sent') {
    return recordImprovementPlanAccepted();
  }
  if (status === 'Project Started' || status === 'Client') {
    return completeClientOnboarding();
  }
  SpreadsheetApp.getUi().alert('Business Optimization Platform', `Cannot convert from ${status}. Confirm the preceding lifecycle events first.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function recordImprovementPlanAccepted() {
  return completeProspectClientOperation_('Project Started', 'Record Improvement Plan Accepted / Start Project', 'Improvement Plan Accepted', 'Operator confirmed acceptance; client record and project were successfully prepared.');
}

function completeClientOnboarding() {
  return completeProspectClientOperation_('Client', 'Complete Client Onboarding', 'Client Onboarding Completed', 'Operator confirmed onboarding completion after client and project records were successfully prepared.');
}

function completeProspectClientOperation_(targetStage, title, activityType, activityNotes) {
  const context = getSelectedProspectContext_(['Company', 'Status']);
  if (!context) return null;
  const current = normalizePipelineStage_(getValueByHeader_(context.values, context.table.headers, 'Status')) || 'Lead Found';
  const validation = validateProspectStageTransition_(current, targetStage);
  const ui = SpreadsheetApp.getUi();
  if (!validation.allowed) {
    ui.alert('Business Optimization Platform', validation.message, ui.ButtonSet.OK);
    return null;
  }
  if (!validation.idempotent && ui.alert(title, `Confirm this completed event for ${context.prospect.company}?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return null;
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    const result = convertWonProspectToClient_(context, { targetStage: targetStage, activityType: activityType, activityNotes: activityNotes, lockHeld: true });
    ui.alert('Business Optimization Platform', validation.idempotent
      ? `${targetStage} was already confirmed. Client, project, Follow-Up, activity, and workspace state were reconciled.\n\nClient ID: ${result.clientId}`
      : `${targetStage} confirmed.\n\nClient ID: ${result.clientId}`, ui.ButtonSet.OK);
    return result;
  } catch (error) {
    console.error('Client/project Drive operation failed', {
      company: context.prospect && context.prospect.company,
      targetStage: targetStage,
      error: error && error.stack ? error.stack : (error && error.message ? error.message : String(error))
    });
    try {
      setLifecycleOperationMarker_(context, buildLifecycleOperationKey_(context, targetStage), 'Reconciliation Required', `Client/project operation failed and requires retry or review: ${error && error.message ? error.message : String(error)}`);
    } catch (markerError) {
      console.error(markerError);
    }
    const currentAfterFailure = normalizePipelineStage_(context.sheet.getRange(context.selectedRow, context.table.headers.Status).getValue()) || String(context.sheet.getRange(context.selectedRow, context.table.headers.Status).getValue() || '').trim();
    ui.alert('Business Optimization Platform', `The Drive operation could not be completed. Current CRM Status: ${currentAfterFailure || '(blank)'}. Confirm Drive access, review Lifecycle Operation State and Details, then retry the same action.`, ui.ButtonSet.OK);
    return null;
  } finally {
    lock.releaseLock();
  }
}

function convertWonProspectToClient() {
  return convertToClient();
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
  const reconciliationResults = [];
  trashLegacyAuditPackageTextFiles_(folder);
  packageFiles.push(reconcileAuditReportFile_(
    folder,
    buildAuditReportPdfBlob_(prospect, reportFile),
    reconciliationResults
  ));

  packageFiles.push(upsertAuditPackageTextFile_(
    folder,
    'Outreach Email Draft.txt',
    buildAuditPackageOutreachText_(drafts),
    MimeType.PLAIN_TEXT,
    reconciliationResults
  ));
  packageFiles.push(upsertAuditPackageBlobFile_(
    folder,
    'Proposal.pdf',
    buildProposalPdfBlob_(prospect, proposal),
    reconciliationResults
  ));

  packageFiles.reconciliationResults = reconciliationResults;
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

function upsertAuditPackageTextFile_(folder, fileName, contents, mimeType, reconciliationResults) {
  const existingFiles = findAllAuditPackageFilesByName_(folder, fileName);
  const existingFile = existingFiles.length ? existingFiles[0] : null;
  if (existingFile) {
    existingFile.setContent(contents);
    existingFile.setDescription(`Updated by Business Optimization Platform on ${new Date().toISOString()}`);
    trashAuditPackageFiles_(existingFiles.slice(1));
    recordAuditPackageReconciliation_(reconciliationResults, fileName, 'updated', existingFiles.length - 1, 0);
    return existingFile;
  }

  const file = folder.createFile(fileName, contents, mimeType);
  file.setDescription(`Created by Business Optimization Platform on ${new Date().toISOString()}`);
  recordAuditPackageReconciliation_(reconciliationResults, fileName, 'created', 0, 0);
  return file;
}

function upsertAuditPackageBlobFile_(folder, fileName, blob, reconciliationResults) {
  const existingFiles = findAllAuditPackageFilesByName_(folder, fileName);
  trashAuditPackageFiles_(existingFiles);

  const file = folder.createFile(blob.setName(fileName));
  file.setDescription(`${existingFiles.length ? 'Replaced' : 'Created'} by Business Optimization Platform on ${new Date().toISOString()}`);
  recordAuditPackageReconciliation_(
    reconciliationResults,
    fileName,
    existingFiles.length ? 'replaced' : 'created',
    Math.max(existingFiles.length - 1, 0),
    existingFiles.length
  );
  return file;
}

function reconcileAuditReportFile_(folder, blob, reconciliationResults) {
  const canonicalFileName = 'AuditReport.pdf';
  const legacyFileName = 'Audit Report.pdf';
  const canonicalFiles = findAllAuditPackageFilesByName_(folder, canonicalFileName);
  const legacyFiles = findAllAuditPackageFilesByName_(folder, legacyFileName);
  trashAuditPackageFiles_(canonicalFiles.concat(legacyFiles));

  const file = folder.createFile(blob.setName(canonicalFileName));
  file.setDescription(`${canonicalFiles.length || legacyFiles.length ? 'Replaced' : 'Created'} by Business Optimization Platform on ${new Date().toISOString()}`);
  if (reconciliationResults) {
    reconciliationResults.push({
      fileName: canonicalFileName,
      action: canonicalFiles.length || legacyFiles.length ? 'replaced' : 'created',
      updated: false,
      replaced: Boolean(canonicalFiles.length || legacyFiles.length),
      removedDuplicates: Math.max(canonicalFiles.length + legacyFiles.length - 1, 0),
      removedPrevious: canonicalFiles.length + legacyFiles.length,
      canonicalCopiesRemoved: canonicalFiles.length,
      legacyCopiesRemoved: legacyFiles.length,
      createdFileName: canonicalFileName
    });
  }
  return file;
}

function findAllAuditPackageFilesByName_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  const matches = [];
  while (files.hasNext()) {
    matches.push(files.next());
  }
  return matches;
}

function trashAuditPackageFiles_(files) {
  files.forEach(function(file) {
    file.setTrashed(true);
  });
}

function recordAuditPackageReconciliation_(results, fileName, action, removedDuplicates, removedPrevious) {
  if (!results) return;
  results.push({
    fileName: fileName,
    action: action,
    updated: action === 'updated',
    replaced: action === 'replaced',
    removedDuplicates: removedDuplicates,
    removedPrevious: removedPrevious
  });
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

function convertWonProspectToClient_(context, options) {
  const settings = options || {};
  const targetStage = settings.targetStage || 'Client';
  const operationKey = buildLifecycleOperationKey_(context, targetStage);
  ensureLifecycleReconciliationColumns_(context);
  setLifecycleOperationMarker_(context, operationKey, 'Preparing Prerequisites', `Preparing Client and Project records for ${targetStage}.`);
  const clientSheet = getOrCreateClientsSheet_(context.ss);
  const clientTable = ensureClientColumns_(clientSheet);
  const prospectHeaders = ensureProspectConversionColumns_(context.sheet, context.table.headers);
  const prospectValues = context.sheet.getRange(context.selectedRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
  const prospect = buildClientProspectFromRow_(prospectValues, prospectHeaders);
  const result = upsertClientRecordFromProspect_(clientSheet, clientTable.headers, prospect, {
    startDate: startOfDay_(new Date()),
    status: targetStage === 'Client' ? 'Active' : 'Onboarding'
  });
  const verifiedClient = verifyPersistedClientRecord_(clientSheet, clientTable, result, prospect, targetStage === 'Client' ? 'Active' : 'Onboarding');
  const clientValues = verifiedClient.values;
  const projectResult = upsertProjectFromClient_(context.ss, buildProjectClientModel_(clientValues, clientTable.headers), {
    status: 'Planning',
    notes: 'Project created from won prospect conversion.'
  });
  const verifiedProject = verifyPersistedProjectRecord_(context.ss, projectResult, buildProjectClientModel_(clientValues, clientTable.headers), projectResult.status || 'Planning');
  if (!result || !result.clientId || !projectResult || !projectResult.projectId || !verifiedClient.verified || !verifiedProject.verified) {
    setLifecycleOperationMarker_(context, operationKey, 'Reconciliation Required', 'Client or Project verification did not return the required identifiers.');
    throw new Error('Client and Project prerequisites could not be verified.');
  }
  if (targetStage === 'Client') {
    syncFollowUpForClient_(context.ss, clientValues, clientTable.headers);
  }
  refreshClientWorkspaceForClientRow_(context.ss, clientSheet, clientTable.headers, result.rowNumber, { logOpen: false });
  context.table.headers = prospectHeaders;
  applyConfirmedProspectTransition_(context, targetStage, settings.activityType || 'Client Converted', settings.activityNotes || 'Client conversion completed successfully.', {
    lockHeld: !!settings.lockHeld,
    operationKey: operationKey,
    extraRowValues: targetStage === 'Client' ? { 'Closed Date': new Date() } : {}
  });
  if (projectResult.created) {
    logPipelineActivity_(context.ss, prospect.company, 'Project Started', 'Project created after Improvement Plan acceptance.');
  }
  refreshSalesOperatingSystem_();

  return result;
}

function verifyPersistedClientRecord_(sheet, table, result, prospect, expectedStatus) {
  if (!result || !result.clientId || !result.rowNumber) throw new Error('Client upsert did not return a verifiable identifier and row.');
  const rowCount = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const rows = rowCount ? sheet.getRange(table.headerRow + 1, 1, rowCount, table.lastColumn).getValues() : [];
  const expected = {
    clientId: String(result.clientId), company: normalizeLookupKey_(prospect.company),
    website: normalizeWebsiteKey_(prospect.website), status: String(expectedStatus || '')
  };
  const matches = rows.map(function(values, index) {
    return { rowNumber: table.headerRow + 1 + index, values: values };
  }).filter(function(item) {
    const id = String(getValueByHeader_(item.values, table.headers, 'Client ID') || '');
    const company = normalizeLookupKey_(getValueByHeader_(item.values, table.headers, 'Company') || getValueByHeader_(item.values, table.headers, 'Client Name'));
    const website = normalizeWebsiteKey_(getValueByHeader_(item.values, table.headers, 'Website'));
    return id === expected.clientId || (expected.company && company === expected.company) || (expected.website && website === expected.website);
  });
  const evaluation = evaluatePersistedClientMatches_(matches.map(function(item) {
    return {
      rowNumber: item.rowNumber,
      clientId: String(getValueByHeader_(item.values, table.headers, 'Client ID') || ''),
      company: normalizeLookupKey_(getValueByHeader_(item.values, table.headers, 'Company') || getValueByHeader_(item.values, table.headers, 'Client Name')),
      website: normalizeWebsiteKey_(getValueByHeader_(item.values, table.headers, 'Website')),
      status: String(getValueByHeader_(item.values, table.headers, 'Status') || ''), values: item.values
    };
  }), expected);
  if (!evaluation.verified) throw new Error(evaluation.message);
  return evaluation.match;
}

function evaluatePersistedClientMatches_(matches, expected) {
  if (!matches || matches.length === 0) return { verified: false, message: 'Client upsert could not be re-read from the persisted sheet.' };
  if (matches.length !== 1) return { verified: false, message: `Client lookup is ambiguous; ${matches.length} persisted rows match the expected identity.` };
  const match = matches[0];
  if (match.clientId !== expected.clientId || match.company !== expected.company || (expected.website && match.website !== expected.website) || match.status !== expected.status) {
    return { verified: false, message: 'Persisted Client record does not match the expected ID, company/website linkage, or status.' };
  }
  return { verified: true, match: match };
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
  setIfHeader_(rowValues, headers, 'Status', settings.status || 'Active');
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
