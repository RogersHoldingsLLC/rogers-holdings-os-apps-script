var ORPHAN_PROSPECT_RECONCILIATION_CONFIRMATION = 'RECONCILE ORPHAN ACTIVITY';
var ORPHAN_PROSPECT_RECONCILIATION_TYPE = 'Orphan Prospect Activity Reconciled';
var ORPHAN_PROSPECT_RECONCILIATION_REASON = 'The source prospect row was deleted before the validation activity was reconciled.';
var REAL_PROSPECT_CREATION_CONFIRMATION = 'CREATE REAL PROSPECT';
var REAL_PROSPECT_WEBSITE_COLLISION_CONFIRMATION = 'ALLOW SYNTHETIC WEBSITE COLLISION';
var REAL_PROSPECT_PENDING_PROPERTY_PREFIX = 'REAL_PROSPECT_PENDING:';
var REAL_PROSPECT_PROTECTED_ORPHAN_ID = 'PROS-D790451BBB29';
var REAL_PROSPECT_ACCEPTANCE_WORKBOOK_ID = '1RLyIsWWalpA_rA6a-rCj3JbOFQMf8Su3MrJV4rKZ7-g';

function reconcileOrphanProspectActivity() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Reconcile Orphan Prospect Activity',
    'Type ' + ORPHAN_PROSPECT_RECONCILIATION_CONFIRMATION + ' exactly. The historical activity will be retained.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== ORPHAN_PROSPECT_RECONCILIATION_CONFIRMATION) {
    throw new Error('Orphan prospect activity reconciliation cancelled.');
  }
  const result = reconcileOrphanProspectActivityTransactional_(SpreadsheetApp.getActiveSpreadsheet(), {
    company: 'Rogers Holdings LLC',
    activityType: 'Prospect Validation Ready',
    prospectId: REAL_PROSPECT_PROTECTED_ORPHAN_ID,
    operationKey: ''
  }, {});
  ui.alert(
    'Orphan Prospect Activity Reconciliation',
    result.status === 'already-completed'
      ? 'The orphan activity was already reconciled. No records changed.'
      : 'The orphan activity was reconciled. Its historical row was retained.',
    ui.ButtonSet.OK
  );
  return result;
}

function reconcileOrphanProspectActivityTransactional_(ss, target, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return reconcileOrphanProspectActivityLocked_(ss, target, hooks || {});
  } finally {
    lock.releaseLock();
  }
}

function reconcileOrphanProspectActivityLocked_(ss, target, hooks) {
  const activitySheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(activitySheet, ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Prospect ID', 'Operation Key']);
  const expected = {
    company: String(target.company || '').trim(),
    activityType: String(target.activityType || '').trim(),
    prospectId: String(target.prospectId || '').trim(),
    operationKey: String(target.operationKey || '')
  };
  if (!expected.company || !expected.activityType || !expected.prospectId || expected.operationKey !== '') {
    throw new Error('An exact orphan activity identity with a blank operation key is required.');
  }
  const operationKey = 'ORPHANRECON:' + expected.prospectId + ':' + normalizeRealProspectOperationToken_(expected.activityType);
  const originalMatches = findExactOrphanProspectActivityRows_(activitySheet, table, expected);
  if (originalMatches.length !== 1) throw new Error('The orphan prospect activity is missing or ambiguous.');
  const original = originalMatches[0];
  const reconciliations = findExactActivityOperationRows_(activitySheet, table, operationKey);
  if (reconciliations.length > 1) throw new Error('The orphan reconciliation operation is ambiguous.');
  assertOrphanProspectActivityUnreferenced_(ss, expected, original.row, reconciliations.map(function(item) { return item.row; }));
  if (reconciliations.length === 1) {
    assertOrphanProspectReconciliationRecord_(reconciliations[0].values, table.headers, expected, operationKey);
    return { ok: true, status: 'already-completed', operationKey: operationKey, prospectId: expected.prospectId, originalRow: original.row, reconciliationRow: reconciliations[0].row };
  }

  const operator = requireRealProspectOperator_();
  const reconciledAt = new Date();
  const rowValues = new Array(table.lastColumn).fill('');
  setIfHeader_(rowValues, table.headers, 'Date', reconciledAt);
  setIfHeader_(rowValues, table.headers, 'Company', expected.company);
  setIfHeader_(rowValues, table.headers, 'Activity Type', ORPHAN_PROSPECT_RECONCILIATION_TYPE);
  setIfHeader_(rowValues, table.headers, 'Activity Notes', [
    'State: Reconciled; original historical activity retained and excluded from active prospect authority.',
    'Reason: ' + ORPHAN_PROSPECT_RECONCILIATION_REASON,
    'Reconciled by: ' + operator + '.'
  ].join(' '));
  setIfHeader_(rowValues, table.headers, 'Prospect ID', expected.prospectId);
  setIfHeader_(rowValues, table.headers, 'Operation Key', operationKey);
  const beforeLastRow = activitySheet.getLastRow();
  const reconciliationRow = Math.max(beforeLastRow + 1, table.headerRow + 1);
  const originalSnapshot = original.values.slice();
  let appended = false;
  try {
    activitySheet.getRange(reconciliationRow, 1, 1, table.lastColumn).setValues([literalizeBusinessSnapshotSheetRow_(rowValues)]);
    appended = true;
    if (hooks.afterAppend) hooks.afterAppend(reconciliationRow, rowValues.slice());
    const persistedOriginal = activitySheet.getRange(original.row, 1, 1, table.lastColumn).getValues()[0];
    if (!businessSnapshotRowsEqual_([originalSnapshot], [persistedOriginal])) throw new Error('The original orphan activity changed during reconciliation.');
    const persisted = findExactActivityOperationRows_(activitySheet, table, operationKey);
    if (persisted.length !== 1 || persisted[0].row !== reconciliationRow) throw new Error('The orphan reconciliation record did not persist exactly.');
    assertOrphanProspectReconciliationRecord_(persisted[0].values, table.headers, expected, operationKey);
    return { ok: true, status: 'completed', operationKey: operationKey, prospectId: expected.prospectId, originalRow: original.row, reconciliationRow: reconciliationRow, reconciledBy: operator, reconciledAt: reconciledAt.toISOString(), reason: ORPHAN_PROSPECT_RECONCILIATION_REASON };
  } catch (error) {
    if (appended) rollbackExactAppendedActivity_(activitySheet, table, reconciliationRow, operationKey, beforeLastRow);
    throw error;
  }
}

function findExactOrphanProspectActivityRows_(sheet, table, expected) {
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  if (!count) return [];
  return sheet.getRange(start, 1, count, table.lastColumn).getValues().reduce(function(result, values, index) {
    if (String(getValueByHeader_(values, table.headers, 'Company') || '').trim() === expected.company &&
        String(getValueByHeader_(values, table.headers, 'Activity Type') || '').trim() === expected.activityType &&
        String(getValueByHeader_(values, table.headers, 'Prospect ID') || '').trim() === expected.prospectId &&
        String(getValueByHeader_(values, table.headers, 'Operation Key') || '') === expected.operationKey) {
      result.push({ row: start + index, values: values });
    }
    return result;
  }, []);
}

function findExactActivityOperationRows_(sheet, table, operationKey) {
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  if (!count) return [];
  return sheet.getRange(start, 1, count, table.lastColumn).getValues().reduce(function(result, values, index) {
    if (String(getValueByHeader_(values, table.headers, 'Operation Key') || '') === operationKey) result.push({ row: start + index, values: values });
    return result;
  }, []);
}

function assertOrphanProspectActivityUnreferenced_(ss, expected, originalRow, reconciliationRows) {
  const allowedReconciliationRows = reconciliationRows || [];
  const sheetNames = [
    MASTER_PROSPECT_SHEET, FOLLOW_UPS_SHEET, CLIENTS_SHEET, PROJECTS_SHEET, 'Client Workspace',
    FQ_CONTEXT_SHEET, FQ_PRESENCE_SHEET, FQ_EVIDENCE_SHEET, FQ_FINDINGS_SHEET,
    FQ_FINDING_SETS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET
  ];
  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet || !sheet.getLastRow() || !sheet.getLastColumn()) return;
    if (realProspectGridContainsExact_(sheet.getDataRange().getDisplayValues(), expected.prospectId)) {
      throw new Error('The orphan Prospect ID is referenced in ' + name + '.');
    }
  });
  const activitySheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(activitySheet, ['Prospect ID']);
  const start = table.headerRow + 1;
  const count = Math.max(activitySheet.getLastRow() - table.headerRow, 0);
  if (!count) return;
  activitySheet.getRange(start, 1, count, table.lastColumn).getDisplayValues().forEach(function(values, index) {
    const row = start + index;
    if (row === originalRow || allowedReconciliationRows.indexOf(row) !== -1) return;
    if (realProspectGridContainsExact_([values], expected.prospectId)) throw new Error('The orphan Prospect ID has another Activity reference.');
  });
}

function assertOrphanProspectReconciliationRecord_(values, headers, expected, operationKey) {
  if (String(getValueByHeader_(values, headers, 'Company') || '').trim() !== expected.company ||
      String(getValueByHeader_(values, headers, 'Activity Type') || '').trim() !== ORPHAN_PROSPECT_RECONCILIATION_TYPE ||
      String(getValueByHeader_(values, headers, 'Prospect ID') || '').trim() !== expected.prospectId ||
      String(getValueByHeader_(values, headers, 'Operation Key') || '') !== operationKey ||
      String(getValueByHeader_(values, headers, 'Activity Notes') || '').indexOf('State: Reconciled') === -1 ||
      String(getValueByHeader_(values, headers, 'Activity Notes') || '').indexOf('Reason: ' + ORPHAN_PROSPECT_RECONCILIATION_REASON) === -1 ||
      String(getValueByHeader_(values, headers, 'Activity Notes') || '').indexOf('Reconciled by: ') === -1) {
    throw new Error('The persisted orphan reconciliation record differs from the approved audit contract.');
  }
}

function rollbackExactAppendedActivity_(sheet, table, row, operationKey, originalLastRow) {
  if (row <= originalLastRow || sheet.getLastRow() !== row) throw new Error('Orphan reconciliation rollback could not prove the operation-owned row.');
  const values = sheet.getRange(row, 1, 1, table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(values, table.headers, 'Operation Key') || '') !== operationKey) throw new Error('Orphan reconciliation rollback found a conflicting row.');
  sheet.deleteRow(row);
  if (findExactActivityOperationRows_(sheet, table, operationKey).length) throw new Error('Orphan reconciliation rollback could not prove removal.');
}

function createRealProspect() {
  const ui = SpreadsheetApp.getUi();
  const verifiedSpreadsheet = getVerifiedRealProspectAcceptanceSpreadsheet_();
  const input = collectRealProspectInput_(ui);
  const collisionDecision = reviewRealProspectWebsiteCollision_(verifiedSpreadsheet, input.website, ui);
  const confirmation = ui.prompt('Create Real Prospect', 'Type ' + REAL_PROSPECT_CREATION_CONFIRMATION + ' exactly to create the prospect.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== REAL_PROSPECT_CREATION_CONFIRMATION) throw new Error('Real prospect creation cancelled.');
  const result = createRealProspectTransactional_(input, collisionDecision, { verifiedSpreadsheet: verifiedSpreadsheet });
  ui.alert('Create Real Prospect', result.status === 'already-completed' ? 'This exact prospect operation was already complete. No duplicate records were created.' : 'The prospect, intake activity, and Executive Brief Follow-Up were created and verified.', ui.ButtonSet.OK);
  return result;
}

function collectRealProspectInput_(ui) {
  function ask(title, prompt, required) {
    const response = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) throw new Error('Real prospect creation cancelled.');
    const value = String(response.getResponseText() || '').trim();
    if (required && !value) throw new Error(title + ' is required.');
    return value;
  }
  return {
    fullName: ask('Primary Contact', 'Enter the confirmed primary contact name.', true),
    businessName: ask('Business Name', 'Enter the confirmed business name.', true),
    email: ask('Contact Email', 'Enter the confirmed contact email.', true),
    phone: ask('Contact Phone', 'Enter the confirmed phone number, or leave blank.', false),
    website: ask('Website', 'Enter the confirmed absolute website URL, or leave blank.', false),
    primaryChallenge: ask('Primary Challenge', 'Enter the owner-confirmed primary challenge in 20 to 2,000 characters.', true),
    consent: ask('Contact Consent', 'Type business-snapshot-contact-consent-v1 exactly to record contact consent.', true)
  };
}

function reviewRealProspectWebsiteCollision_(ss, website, ui) {
  const websiteKey = normalizeWebsiteKey_(website);
  if (!websiteKey) return null;
  const sheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const table = getHeaderTable_(sheet, ['Company', 'Contact', 'Email', 'Website', 'Notes', 'Prospect ID']);
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const matches = count ? sheet.getRange(start, 1, count, table.lastColumn).getValues().filter(function(row) {
    return normalizeWebsiteKey_(getValueByHeader_(row, table.headers, 'Website')) === websiteKey;
  }) : [];
  if (!matches.length) return null;
  if (matches.length !== 1 || !isRecognizedBusinessSnapshotSyntheticQaRow_(matches[0], table.headers)) throw new Error('The website is already used by a real or ambiguous prospect record.');
  const syntheticProspectId = String(getValueByHeader_(matches[0], table.headers, 'Prospect ID') || '').trim();
  const response = ui.prompt('Review Synthetic Website Collision', 'The website is used by recognized synthetic QA prospect ' + syntheticProspectId + '. Type ' + REAL_PROSPECT_WEBSITE_COLLISION_CONFIRMATION + ' exactly to preserve that row and continue.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== REAL_PROSPECT_WEBSITE_COLLISION_CONFIRMATION) throw new Error('Synthetic website collision was not approved.');
  return { websiteKey: websiteKey, syntheticProspectId: syntheticProspectId, reviewedBy: requireRealProspectOperator_() };
}

function createRealProspectTransactional_(input, collisionDecision, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return createRealProspectLocked_(input, collisionDecision, hooks || {});
  } finally {
    lock.releaseLock();
  }
}

function createRealProspectLocked_(input, collisionDecision, hooks) {
  const verifiedSpreadsheet = requireVerifiedRealProspectSpreadsheet_(hooks.verifiedSpreadsheet);
  const normalized = normalizeRealProspectMenuInput_(input);
  const pending = getOrCreateRealProspectPendingSubmission_(normalized, collisionDecision);
  if (hooks.afterPendingPersisted) hooks.afterPendingPersisted(pending);
  const result = ingestBusinessSnapshotWithOptions_(pending.submission, {
    realProspect: true,
    reviewedWebsiteCollision: pending.collisionDecision,
    verifiedSpreadsheet: verifiedSpreadsheet,
    requiredSpreadsheetId: REAL_PROSPECT_ACCEPTANCE_WORKBOOK_ID
  });
  if (String(result.prospectId || '') === REAL_PROSPECT_PROTECTED_ORPHAN_ID) throw new Error('The protected orphan Prospect ID cannot be reused.');
  assertRealProspectCreationReadback_(verifiedSpreadsheet, pending.submission, result, pending.collisionDecision);
  markRealProspectPendingCompleted_(pending.propertyKey, pending, result);
  return { ok: true, status: result.retry ? 'already-completed' : 'completed', requestId: pending.submission.requestId, operationKey: BUSINESS_SNAPSHOT_OPERATION_PREFIX + pending.submission.requestId, prospectId: result.prospectId };
}

function getVerifiedRealProspectAcceptanceSpreadsheet_() {
  return requireVerifiedRealProspectSpreadsheet_(SpreadsheetApp.getActiveSpreadsheet());
}

function requireVerifiedRealProspectSpreadsheet_(spreadsheet) {
  if (!spreadsheet || typeof spreadsheet.getId !== 'function') throw new Error('The bound acceptance workbook is required.');
  const actualId = String(spreadsheet.getId() || '').trim();
  if (actualId !== REAL_PROSPECT_ACCEPTANCE_WORKBOOK_ID) throw new Error('Create Real Prospect is not available from this workbook.');
  return spreadsheet;
}

function normalizeRealProspectMenuInput_(input) {
  const source = input || {};
  return {
    fullName: normalizeBusinessSnapshotSingleLine_(source.fullName),
    businessName: normalizeBusinessSnapshotSingleLine_(source.businessName),
    email: normalizeBusinessSnapshotSingleLine_(source.email).toLowerCase(),
    phone: normalizeBusinessSnapshotSingleLine_(source.phone),
    website: normalizeBusinessSnapshotSingleLine_(source.website),
    primaryChallenge: normalizeBusinessSnapshotMultiline_(source.primaryChallenge),
    consent: String(source.consent || '').trim()
  };
}

function getOrCreateRealProspectPendingSubmission_(normalized, collisionDecision) {
  const identity = [normalizeLookupKey_(normalized.businessName), normalized.email].join('|');
  if (!identity.replace(/\|/g, '')) throw new Error('A stable real prospect identity is required.');
  const propertyKey = REAL_PROSPECT_PENDING_PROPERTY_PREFIX + realProspectSha256_(identity).slice(0, 32);
  const properties = PropertiesService.getDocumentProperties();
  const existingText = String(properties.getProperty(propertyKey) || '');
  if (existingText) {
    let existing;
    try { existing = JSON.parse(existingText); } catch (error) { throw new Error('The pending real prospect operation is unreadable.'); }
    const expectedCore = JSON.stringify(normalized);
    const existingCore = JSON.stringify(normalizeRealProspectMenuInput_(existing.submission || {}));
    if (expectedCore !== existingCore) throw new Error('A pending real prospect operation exists with different input.');
    assertRealProspectCollisionDecisionStable_(existing.collisionDecision, collisionDecision);
    existing.propertyKey = propertyKey;
    return existing;
  }
  const requestId = String(Utilities.getUuid() || '').trim().toLowerCase();
  const submission = Object.assign({}, normalized, {
    schemaVersion: BUSINESS_SNAPSHOT_SCHEMA_VERSION,
    requestId: requestId,
    acceptedAt: new Date().toISOString()
  });
  validateBusinessSnapshotInput_(normalizeBusinessSnapshotInput_(submission));
  const pending = { status: 'pending', submission: submission, collisionDecision: collisionDecision || null, propertyKey: propertyKey };
  const persistedText = JSON.stringify({ status: pending.status, submission: pending.submission, collisionDecision: pending.collisionDecision });
  properties.setProperty(propertyKey, persistedText);
  if (String(properties.getProperty(propertyKey) || '') !== persistedText) throw new Error('The real prospect request ID did not persist exactly before workbook creation.');
  return pending;
}

function markRealProspectPendingCompleted_(propertyKey, pending, result) {
  const properties = PropertiesService.getDocumentProperties();
  const completed = { status: 'completed', submission: pending.submission, collisionDecision: pending.collisionDecision || null, prospectId: String(result.prospectId || '') };
  const text = JSON.stringify(completed);
  properties.setProperty(propertyKey, text);
  if (String(properties.getProperty(propertyKey) || '') !== text) throw new Error('The completed real prospect operation marker did not persist exactly.');
}

function assertRealProspectCollisionDecisionStable_(existing, supplied) {
  const left = existing || null;
  const right = supplied || null;
  if (JSON.stringify(left && { websiteKey: left.websiteKey, syntheticProspectId: left.syntheticProspectId }) !== JSON.stringify(right && { websiteKey: right.websiteKey, syntheticProspectId: right.syntheticProspectId })) {
    throw new Error('The reviewed website collision decision differs from the pending operation.');
  }
}

function assertRealProspectCreationReadback_(ss, submission, result, collisionDecision) {
  const prospectId = String(result.prospectId || '').trim();
  if (!prospectId || prospectId === REAL_PROSPECT_PROTECTED_ORPHAN_ID) throw new Error('The created Prospect ID is missing or protected.');
  const prospectSheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const prospectTable = getHeaderTable_(prospectSheet, ['Company', 'Email', 'Website', 'Prospect ID']);
  const prospectRows = findRowsByExactHeaderValue_(prospectSheet, prospectTable, 'Prospect ID', prospectId);
  if (prospectRows.length !== 1) throw new Error('Real prospect readback is missing or ambiguous.');
  const prospect = prospectSheet.getRange(prospectRows[0], 1, 1, prospectTable.lastColumn).getValues()[0];
  if (String(getValueByHeader_(prospect, prospectTable.headers, 'Company') || '').trim() !== submission.businessName ||
      String(getValueByHeader_(prospect, prospectTable.headers, 'Email') || '').trim().toLowerCase() !== submission.email.toLowerCase() ||
      normalizeWebsiteKey_(getValueByHeader_(prospect, prospectTable.headers, 'Website')) !== normalizeWebsiteKey_(submission.website)) {
    throw new Error('Real prospect readback differs from the confirmed submission.');
  }
  const operationKey = BUSINESS_SNAPSHOT_OPERATION_PREFIX + submission.requestId;
  const activitySheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const activityTable = getHeaderTable_(activitySheet, ['Activity Type', 'Prospect ID', 'Operation Key']);
  const activityRows = findExactActivityOperationRows_(activitySheet, activityTable, operationKey);
  if (activityRows.length !== 1 || String(getValueByHeader_(activityRows[0].values, activityTable.headers, 'Prospect ID')) !== prospectId || String(getValueByHeader_(activityRows[0].values, activityTable.headers, 'Activity Type')) !== 'Business Snapshot Intake') throw new Error('Real prospect intake Activity readback differs.');
  assertBusinessSnapshotRetryFollowUpExists_(ss, prospectId);
  if (collisionDecision) {
    const syntheticRows = findRowsByExactHeaderValue_(prospectSheet, prospectTable, 'Prospect ID', collisionDecision.syntheticProspectId);
    if (syntheticRows.length !== 1) throw new Error('The reviewed synthetic QA prospect changed during real prospect creation.');
  }
  [FQ_CONTEXT_SHEET, FQ_PRESENCE_SHEET, FQ_EVIDENCE_SHEET, FQ_FINDINGS_SHEET, FQ_FINDING_SETS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() && sheet.getLastColumn() && realProspectGridContainsExact_(sheet.getDataRange().getDisplayValues(), prospectId)) throw new Error('Real prospect creation unexpectedly created Finding Quality state in ' + name + '.');
  });
}

function requireRealProspectOperator_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim();
  if (!email) throw new Error('An authenticated operator is required.');
  return email;
}

function realProspectGridContainsExact_(values, target) {
  return [].concat(values || []).some(function(row) { return [].concat(row || []).some(function(value) { return String(value) === String(target); }); });
}

function normalizeRealProspectOperationToken_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function realProspectSha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}
