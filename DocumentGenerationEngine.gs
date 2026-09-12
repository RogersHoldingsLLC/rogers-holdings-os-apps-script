/**
 * Transactional Gold Standard document generation.
 * Preview construction is read-only; final generation reaches this boundary only
 * after the exact approved Finding Quality snapshot has been revalidated.
 */

var GOLD_STANDARD_GENERATION_ACTIVITY_TYPES = {
  executiveBrief: 'Executive Brief Generated',
  assessment: 'Digital Business Assessment Generated',
  improvementPlan: 'Improvement Plan Generated'
};

var GOLD_STANDARD_GENERATION_OPERATION_TYPES = {
  executiveBrief: 'EXECUTIVEBRIEF',
  assessment: 'DIGITALBUSINESSASSESSMENT',
  improvementPlan: 'IMPROVEMENTPLAN'
};

function buildGoldStandardGenerationOperationKey_(prospect, plan) {
  const reference = assertApprovedFindingSetReference_(plan && plan.approvedFindingSetReference);
  const prospectId = String(prospect && (prospect.prospectId || prospect['Prospect ID']) || '').trim();
  if (!prospectId) throw goldStandardGenerationError_('snapshot', 'The selected prospect no longer has a valid Prospect ID. No document was generated.');
  return [
    'GOLDDOC',
    prospectId,
    GOLD_STANDARD_GENERATION_OPERATION_TYPES[plan.documentType] || String(plan.documentType || '').toUpperCase(),
    reference.findingSetId,
    reference.version,
    reference.fingerprint
  ].join(':');
}

function goldStandardGenerationError_(stage, message) {
  const error = new Error(message);
  error.goldStandardStage = stage;
  return error;
}

function goldStandardGenerationSafeMessage_(stage) {
  const messages = {
    snapshot: 'The approved finding snapshot is invalid, stale, or no longer eligible. No document or operational record was changed.',
    drive: 'The approved client Drive destination could not be resolved safely. No operational generation record was committed.',
    rendering: 'The approved document could not be rendered. No operational generation record was committed.',
    persistence: 'The document could not be verified and committed in Drive. Prior canonical content was restored where applicable, and no operational generation record was committed.',
    operations: 'The document generation record could not be verified. The operation-created artifact, Prospect fields, and generation Activity were restored where possible. Reconciliation is required before another attempt.'
  };
  return messages[stage] || 'Document generation could not be completed safely. No retry should be attempted until the operation is reconciled.';
}

function throwGoldStandardGenerationStage_(stage, cause) {
  const error = goldStandardGenerationError_(stage, goldStandardGenerationSafeMessage_(stage));
  if (cause) console.error('Gold Standard generation ' + stage + ' failure: ' + (cause.message || String(cause)));
  throw error;
}

function hashGoldStandardBlob_(blob) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes()).map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function sanitizeGoldStandardOperationFileToken_(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(-48) || Utilities.getUuid().replace(/-/g, '');
}

function verifyGoldStandardDriveFile_(file, expectedName, expectedHash) {
  if (!file || file.getName() !== expectedName || file.getSize() <= 0 || hashGoldStandardBlob_(file.getBlob()) !== expectedHash) {
    throw new Error('Drive artifact verification failed.');
  }
  return true;
}

function safelyTrashGoldStandardFile_(file) {
  if (!file) return;
  try { file.setTrashed(true); } catch (error) { console.warn('Could not trash staged Gold Standard file: ' + (error.message || String(error))); }
}

function stageAndCommitGoldStandardArtifact_(folder, plan, operationKey) {
  let blob;
  try {
    blob = buildGoldStandardPdfBlobFromPlan_(plan);
  } catch (error) {
    throwGoldStandardGenerationStage_('rendering', error);
  }
  const expectedHash = hashGoldStandardBlob_(blob);
  const token = sanitizeGoldStandardOperationFileToken_(operationKey);
  const stagingName = '.bop-staging-' + token + '-' + plan.fileName;
  const backupName = '.bop-backup-' + token + '-' + plan.fileName;
  let staged = null;
  let prior = null;
  try {
    findAllAuditPackageFilesByName_(folder, stagingName).forEach(safelyTrashGoldStandardFile_);
    staged = folder.createFile(blob.setName(stagingName));
    verifyGoldStandardDriveFile_(staged, stagingName, expectedHash);

    const canonicals = findAllAuditPackageFilesByName_(folder, plan.fileName);
    if (canonicals.length > 1) throw new Error('Multiple canonical artifacts require reconciliation.');
    if (canonicals.length === 1 && hashGoldStandardBlob_(canonicals[0].getBlob()) === expectedHash &&
        String(canonicals[0].getDescription() || '').indexOf('Operation ' + operationKey) !== -1) {
      safelyTrashGoldStandardFile_(staged);
      return { file: canonicals[0], artifactHash: expectedHash, artifactChanged: false, priorFile: null, priorHash: '' };
    }

    prior = canonicals[0] || null;
    const priorHash = prior ? hashGoldStandardBlob_(prior.getBlob()) : '';
    if (prior) prior.setName(backupName);
    staged.setName(plan.fileName);
    staged.setDescription('Generated by Business Optimization Platform. Operation ' + operationKey + '. Artifact SHA-256 ' + expectedHash + '.');
    verifyGoldStandardDriveFile_(staged, plan.fileName, expectedHash);
    if (prior) prior.setTrashed(true);
    return { file: staged, artifactHash: expectedHash, artifactChanged: true, priorFile: prior, priorHash: priorHash };
  } catch (error) {
    try {
      if (staged && staged.getName() === plan.fileName) staged.setName(stagingName);
      safelyTrashGoldStandardFile_(staged);
      if (prior && prior.isTrashed()) prior.setTrashed(false);
      if (prior) prior.setName(plan.fileName);
      if (prior) verifyGoldStandardDriveFile_(prior, plan.fileName, hashGoldStandardBlob_(prior.getBlob()));
    } catch (restoreError) {
      console.error('Gold Standard artifact restoration failure: ' + (restoreError.message || String(restoreError)));
    }
    throwGoldStandardGenerationStage_('persistence', error);
  }
}

function rollbackGoldStandardArtifactCommit_(folder, plan, artifact, operationKey) {
  if (!artifact || !artifact.artifactChanged) return true;
  const created = artifact.file;
  const prior = artifact.priorFile || null;
  const token = sanitizeGoldStandardOperationFileToken_(operationKey);
  const rollbackName = '.bop-rollback-' + token + '-' + plan.fileName;
  if (created && !created.isTrashed()) {
    if (created.getName() === plan.fileName) created.setName(rollbackName);
    safelyTrashGoldStandardFile_(created);
  }
  if (prior) {
    if (prior.isTrashed()) prior.setTrashed(false);
    prior.setName(plan.fileName);
    verifyGoldStandardDriveFile_(prior, plan.fileName, artifact.priorHash);
  }
  const canonicals = findAllAuditPackageFilesByName_(folder, plan.fileName);
  if (prior && (canonicals.length !== 1 || canonicals[0].getId() !== prior.getId())) throw new Error('Prior canonical artifact restoration could not be verified.');
  if (!prior && canonicals.length) throw new Error('Operation-created artifact cleanup could not be verified.');
  return true;
}

function findGoldStandardGenerationActivity_(ss, operationKey) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Prospect ID', 'Operation Key']);
  return { sheet: sheet, table: table, rows: findRowsByExactHeaderValue_(sheet, table, 'Operation Key', operationKey) };
}

function assertGoldStandardGenerationActivity_(activity, prospect, plan, operationKey) {
  if (!activity || activity.rows.length !== 1) throw new Error('Exactly one generation Activity is required for reconciliation.');
  const row = activity.sheet.getRange(activity.rows[0], 1, 1, activity.table.lastColumn).getValues()[0];
  const expected = {
    'Company': prospect.company,
    'Activity Type': GOLD_STANDARD_GENERATION_ACTIVITY_TYPES[plan.documentType],
    'Activity Notes': 'Generated ' + plan.fileName + ' from approved Finding Quality snapshot ' + plan.approvedFindingSetReference.findingSetId + ' v' + plan.approvedFindingSetReference.version + '.',
    'Prospect ID': prospect.prospectId,
    'Operation Key': operationKey
  };
  Object.keys(expected).forEach(function(header) {
    const column = activity.table.headers[header];
    if (!column || String(row[column - 1]) !== String(expected[header])) throw new Error('Generation Activity authority mismatch: ' + header);
  });
  const dateColumn = activity.table.headers['Date'];
  if (!dateColumn || !row[dateColumn - 1]) throw new Error('Generation Activity timestamp is missing.');
  return { row: row, date: row[dateColumn - 1] };
}

function assertGoldStandardCompletedProspectState_(context, fieldValues, activityReceipt) {
  const row = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  Object.keys(fieldValues || {}).forEach(function(header) {
    const column = context.table.headers[header];
    if (!column) throw new Error('Required Prospect field is missing: ' + header);
    const expected = fieldValues[header];
    if (Object.prototype.toString.call(expected) === '[object Date]') {
      if (!row[column - 1]) throw new Error('Prospect generation timestamp is missing: ' + header);
    } else if (String(row[column - 1]) !== String(expected)) {
      throw new Error('Prospect generation state mismatch: ' + header);
    }
  });
  const lastActivityColumn = context.table.headers['Last Activity'];
  if (!lastActivityColumn || !row[lastActivityColumn - 1]) throw new Error('Prospect Last Activity is missing.');
  const prospectTime = new Date(row[lastActivityColumn - 1]).getTime();
  const activityTime = new Date(activityReceipt.date).getTime();
  if (!isFinite(prospectTime) || !isFinite(activityTime) || Math.abs(prospectTime - activityTime) > 300000) {
    throw new Error('Prospect and generation Activity timestamps do not reconcile.');
  }
  return true;
}

function appendGoldStandardGenerationActivity_(context, prospect, plan, operationKey) {
  const existing = findGoldStandardGenerationActivity_(context.ss, operationKey);
  if (existing.rows.length > 1) throw new Error('Duplicate generation Activity operation.');
  if (existing.rows.length === 1) return { row: existing.rows[0], appended: false };
  const rowValues = new Array(existing.table.lastColumn).fill('');
  setIfHeader_(rowValues, existing.table.headers, 'Date', new Date());
  setIfHeader_(rowValues, existing.table.headers, 'Company', prospect.company);
  setIfHeader_(rowValues, existing.table.headers, 'Activity Type', GOLD_STANDARD_GENERATION_ACTIVITY_TYPES[plan.documentType]);
  setIfHeader_(rowValues, existing.table.headers, 'Activity Notes', 'Generated ' + plan.fileName + ' from approved Finding Quality snapshot ' + plan.approvedFindingSetReference.findingSetId + ' v' + plan.approvedFindingSetReference.version + '.');
  setIfHeader_(rowValues, existing.table.headers, 'Prospect ID', prospect.prospectId);
  setIfHeader_(rowValues, existing.table.headers, 'Operation Key', operationKey);
  const row = Math.max(existing.sheet.getLastRow() + 1, existing.table.headerRow + 1);
  existing.sheet.getRange(row, 1, 1, existing.table.lastColumn).setValues([literalizeBusinessSnapshotSheetRow_(rowValues)]);
  const verified = findGoldStandardGenerationActivity_(context.ss, operationKey);
  if (verified.rows.length !== 1) throw new Error('Generation Activity verification failed.');
  return { row: verified.rows[0], appended: true };
}

function restoreGoldStandardProspectRow_(context, before) {
  context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).setValues([before]);
  const restored = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  if (stableStringifyFindingQuality_(restored) !== stableStringifyFindingQuality_(before)) throw new Error('Prospect restoration could not be verified.');
}

function deleteGoldStandardOperationActivity_(activity, operationKey) {
  const current = findRowsByExactHeaderValue_(activity.sheet, activity.table, 'Operation Key', operationKey);
  if (current.length > 1) throw new Error('Duplicate operation Activities require reconciliation.');
  if (current.length === 1) activity.sheet.deleteRow(current[0]);
  if (findRowsByExactHeaderValue_(activity.sheet, activity.table, 'Operation Key', operationKey).length) throw new Error('Generation Activity restoration could not be verified.');
}

function commitGoldStandardOperationalState_(context, prospect, plan, operationKey, fieldValues) {
  const existing = findGoldStandardGenerationActivity_(context.ss, operationKey);
  if (existing.rows.length > 1) throwGoldStandardGenerationStage_('operations', new Error('Duplicate operation Activities.'));
  if (existing.rows.length === 1) {
    try {
      const activityReceipt = assertGoldStandardGenerationActivity_(existing, prospect, plan, operationKey);
      assertGoldStandardCompletedProspectState_(context, fieldValues, activityReceipt);
      return { idempotent: true };
    } catch (error) {
      throwGoldStandardGenerationStage_('operations', error);
    }
  }
  const before = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  const after = before.slice();
  Object.keys(fieldValues || {}).forEach(function(header) {
    if (!context.table.headers[header]) throw new Error('Required Prospect field is missing: ' + header);
    setIfHeader_(after, context.table.headers, header, fieldValues[header]);
  });
  setIfHeader_(after, context.table.headers, 'Last Activity', new Date());
  let activity = null;
  try {
    context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).setValues([after]);
    const verified = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
    Object.keys(fieldValues || {}).concat(['Last Activity']).forEach(function(header) {
      const column = context.table.headers[header];
      if (column && String(verified[column - 1]) !== String(after[column - 1])) throw new Error('Prospect operational-field verification failed: ' + header);
    });
    activity = appendGoldStandardGenerationActivity_(context, prospect, plan, operationKey);
    return { idempotent: false };
  } catch (error) {
    let restored = false;
    try {
      if (activity && activity.appended) deleteGoldStandardOperationActivity_(existing, operationKey);
      else {
        const possible = findGoldStandardGenerationActivity_(context.ss, operationKey);
        if (possible.rows.length === 1) deleteGoldStandardOperationActivity_(possible, operationKey);
      }
      restoreGoldStandardProspectRow_(context, before);
      restored = true;
    } catch (restoreError) {
      console.error('Gold Standard operational restoration failure: ' + (restoreError.message || String(restoreError)));
    }
    throwGoldStandardGenerationStage_('operations', restored ? error : new Error('Operational restoration was not verified.'));
  }
}

function executeGoldStandardDocumentGeneration_(context, prospect, documentType, approvedFindingSetReference, fieldValues) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return executeGoldStandardDocumentGenerationLocked_(context, prospect, documentType, approvedFindingSetReference, fieldValues);
  } finally {
    lock.releaseLock();
  }
}

function buildGoldStandardGenerationClientResult_(documentType, plan, artifact, folder, operationKey, operational, dashboardWarning) {
  const reference = assertApprovedFindingSetReference_(plan && plan.approvedFindingSetReference);
  // google.script.run must receive only a fresh, JSON-safe result. In particular,
  // do not return the frozen authority object held by the immutable document plan.
  return {
    ok: true,
    documentType: String(documentType || ''),
    fileName: String(plan && plan.fileName || ''),
    fileId: String(artifact && artifact.file && artifact.file.getId() || ''),
    folderId: String(folder && folder.getId() || ''),
    operationKey: String(operationKey || ''),
    artifactHash: String(artifact && artifact.artifactHash || ''),
    idempotent: Boolean(artifact && !artifact.artifactChanged && operational && operational.idempotent),
    warning: String(dashboardWarning || ''),
    approvedFindingSetId: reference.findingSetId,
    approvedFindingSetVersion: reference.version,
    approvedFindingSetFingerprint: reference.fingerprint
  };
}

function serializeGoldStandardGenerationClientResult_(result) {
  if (!result || result.ok !== true) throw new Error('Document generation receipt is invalid.');
  // The public google.script.run boundary returns one string primitive. This
  // avoids a post-commit transport failure caused by Apps Script attempting to
  // marshal even an otherwise JSON-safe server object after Drive/workbook
  // state has already committed.
  return JSON.stringify({
    ok: true,
    documentType: String(result.documentType || ''),
    fileName: String(result.fileName || ''),
    fileId: String(result.fileId || ''),
    folderId: String(result.folderId || ''),
    operationKey: String(result.operationKey || ''),
    artifactHash: String(result.artifactHash || ''),
    idempotent: Boolean(result.idempotent),
    warning: String(result.warning || ''),
    approvedFindingSetId: String(result.approvedFindingSetId || ''),
    approvedFindingSetVersion: String(result.approvedFindingSetVersion || ''),
    approvedFindingSetFingerprint: String(result.approvedFindingSetFingerprint || '')
  });
}

function executeGoldStandardDocumentGenerationLocked_(context, prospect, documentType, approvedFindingSetReference, fieldValues) {
  let plan;
  try {
    plan = buildGoldStandardDocumentPlan_(documentType, prospect, {}, { approvedFindingSetReference: approvedFindingSetReference });
  } catch (error) {
    throwGoldStandardGenerationStage_('snapshot', error);
  }
  const operationKey = buildGoldStandardGenerationOperationKey_(prospect, plan);
  let folder;
  try {
    folder = getOrCreateAuditPackageFolder_(prospect.company);
  } catch (error) {
    throwGoldStandardGenerationStage_('drive', error);
  }
  const artifact = stageAndCommitGoldStandardArtifact_(folder, plan, operationKey);
  let operational;
  try {
    operational = commitGoldStandardOperationalState_(context, prospect, plan, operationKey, fieldValues || {});
  } catch (error) {
    try {
      rollbackGoldStandardArtifactCommit_(folder, plan, artifact, operationKey);
    } catch (restoreError) {
      console.error('Gold Standard Drive rollback failure: ' + (restoreError.message || String(restoreError)));
      throwGoldStandardGenerationStage_('operations', new Error('Operational and Drive restoration could not be verified.'));
    }
    throw error;
  }
  let dashboardWarning = '';
  try { refreshExecutiveDashboard(); } catch (error) {
    dashboardWarning = 'The document and generation record were committed, but the dashboard refresh needs review.';
    console.warn(dashboardWarning + ' ' + (error.message || String(error)));
  }
  return buildGoldStandardGenerationClientResult_(documentType, plan, artifact, folder, operationKey, operational, dashboardWarning);
}
