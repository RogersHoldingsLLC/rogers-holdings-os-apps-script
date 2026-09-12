/**
 * Transactional Draft Recommendation creation from one In Review Finding.
 * Creates no Action and changes only the Finding's Recommendation ID linkage.
 */

var FQ_RECOMMENDATION_DRAFT_CONFIRMATION = 'SEED RECOMMENDATION DRAFT';
var FQ_RECOMMENDATION_DRAFT_OPERATION_PREFIX = 'FQRECOMMENDATIONDRAFT';

// Compatibility contract for Recommendation Draft identities already persisted in
// the workbook. Keep this list explicit: later Finding lifecycle/audit columns
// must never change the identity of an earlier reviewed Recommendation.
var FQ_RECOMMENDATION_DRAFT_FINDING_AUTHORITY_FIELDS = [
  'Finding ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Category',
  'Finding Title', 'Finding State', 'Channel Type', 'Presence State',
  'Customer Journey Stage', 'Business Objective', 'Evidence Source',
  'Evidence Location', 'Evidence Observed At', 'Evidence Excerpt', 'Observation',
  'Expected Condition', 'Business Consequence', 'Consequence Basis',
  'Recommended Action', 'Implementation Location', 'Intended Outcome',
  'Completion Test', 'Evidence Confidence', 'Evidence References', 'Limitations',
  'Reviewed By', 'Reviewed At', 'Approval Status', 'Approved Version',
  'Validation Codes'
];

function seedSelectedFindingRecommendationDraft() {
  const selected = requireSelectedInReviewFindingForRecommendation_();
  const ui = SpreadsheetApp.getUi();
  const title = promptRequiredFindingDraftValue_(ui, 'Recommendation title', 'Enter the recommendation title.');
  const recommendedAction = promptRequiredFindingDraftValue_(ui, 'Recommended change', 'Enter the exact supported change.');
  const implementationLocation = promptRequiredFindingDraftValue_(ui, 'Implementation location', 'Enter the exact system, page, component, or workflow that must change.');
  const intendedOutcome = promptRequiredFindingDraftValue_(ui, 'Intended outcome', 'Enter the supported intended outcome.');
  const limitations = promptRequiredFindingDraftValue_(ui, 'Limitations', 'Enter the recommendation limitations.');
  const confirmation = ui.prompt('Seed Selected Finding Recommendation Draft', 'Type ' + FQ_RECOMMENDATION_DRAFT_CONFIRMATION + ' exactly. This creates one Draft Recommendation and links it to the selected Finding.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== FQ_RECOMMENDATION_DRAFT_CONFIRMATION) throw new Error('Recommendation Draft seeding cancelled.');
  const result = seedFindingQualityRecommendationDraft_(selected, { title: title, recommendedAction: recommendedAction, implementationLocation: implementationLocation, intendedOutcome: intendedOutcome, limitations: limitations, dependencies: '' }, {});
  ui.alert('Recommendation Draft', result.status === 'already-completed' ? 'This Recommendation Draft was already seeded. No records changed.' : 'One Draft Recommendation was seeded and linked to the In Review Finding. No Action was created.', ui.ButtonSet.OK);
  return result;
}

function requireSelectedInReviewFindingForRecommendation_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_FINDINGS_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) throw new Error('Select exactly one data row on ' + FQ_FINDINGS_SHEET + '.');
  const table = getHeaderTable_(sheet, FQ_FINDING_COLUMNS);
  const row = range.getRow();
  if (row > sheet.getLastRow()) throw new Error('Select exactly one data row on ' + FQ_FINDINGS_SHEET + '.');
  const record = findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, table.lastColumn).getValues()[0], table);
  if (!String(record['Finding ID'] || '').trim()) throw new Error('The selected Finding row has no exact Finding ID.');
  return { ss: ss, sheet: sheet, table: table, row: row, record: record };
}

function seedFindingQualityRecommendationDraft_(selected, candidate, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return seedFindingQualityRecommendationDraftLocked_(selected, candidate || {}, hooks || {}); }
  finally { lock.releaseLock(); }
}

function seedFindingQualityRecommendationDraftLocked_(selected, candidate, hooks) {
  const schema = getFindingQualityRecommendationDraftSchema_(selected.ss);
  const finding = assertSelectedInReviewFindingStillExact_(selected, schema);
  const authority = resolveRecommendationDraftAuthority_(schema, finding);
  const normalized = normalizeRecommendationDraftCandidate_(candidate);
  const identity = buildRecommendationDraftOperationIdentity_(finding, authority, normalized);
  const operationKey = identity.operationKey;
  const recommendationId = identity.recommendationId;
  const recommendationEntry = schema[FQ_RECOMMENDATIONS_SHEET];
  const allRecommendations = readFindingQualityRecords_(recommendationEntry.sheet, recommendationEntry.table);
  const operationRecords = allRecommendations.filter(function(record) { return String(record['Operation Key']) === operationKey; });
  if (operationRecords.length) {
    assertCompletedRecommendationDraft_(schema, finding, normalized, operationKey, recommendationId);
    return { ok: true, status: 'already-completed', operationKey: operationKey, recommendationId: recommendationId, findingId: finding['Finding ID'] };
  }
  if (String(finding['Recommendation ID'] || '').trim()) throw new Error('The selected Finding already references a Recommendation. Reconciliation is required.');
  if (allRecommendations.some(function(record) { return String(record['Prospect ID']) === String(finding['Prospect ID']) || String(record['Finding ID']) === String(finding['Finding ID']); })) throw new Error('A Recommendation already exists for this prospect or Finding without the completed operation.');
  if (allRecommendations.some(function(record) { return String(record['Recommendation ID']) === recommendationId; })) throw new Error('Deterministic Recommendation ID collision detected.');
  if (readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table).some(function(record) { return String(record['Prospect ID']) === String(finding['Prospect ID']); })) throw new Error('Recommendation Draft seeding requires no existing Action for this prospect.');

  const recommendation = buildDraftRecommendationRecord_(finding, normalized, recommendationId, operationKey);
  validateStandaloneDraftRecommendation_(recommendation, finding);
  const findingBefore = FQ_FINDING_COLUMNS.map(function(header) { return finding[header] === undefined ? '' : finding[header]; });
  let headerInstalled = false;
  let recommendationRow = 0;
  try {
    if (recommendationEntry.needsLimitationsHeader) {
      recommendationEntry.sheet.getRange(1, recommendationEntry.table.headers.Limitations).setValue('Limitations');
      headerInstalled = true;
    }
    recommendationRow = appendFindingQualityRecord_(recommendationEntry.sheet, recommendationEntry.table, recommendation);
    if (hooks.afterWrite) hooks.afterWrite(1, recommendation);
    const linkedFinding = Object.assign({}, finding, { 'Recommendation ID': recommendationId });
    writeFindingQualityRecord_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, finding._row, linkedFinding);
    if (hooks.afterFindingLink) hooks.afterFindingLink(linkedFinding);
    assertExactRecommendationDraftReadback_(schema, finding, recommendation, operationKey);
    assertNoRecommendationDraftSideEffects_(schema, String(finding['Prospect ID']));
    return { ok: true, status: 'completed', operationKey: operationKey, recommendationId: recommendationId, findingId: finding['Finding ID'] };
  } catch (error) {
    try {
      if (recommendationRow) deleteExactRecommendationDraftRow_(recommendationEntry, recommendationRow, recommendationId, operationKey);
      schema[FQ_FINDINGS_SHEET].sheet.getRange(finding._row, 1, 1, schema[FQ_FINDINGS_SHEET].table.lastColumn).setValues([findingBefore]);
      if (headerInstalled) {
        const limitationValues = recommendationEntry.sheet.getRange(2, recommendationEntry.table.headers.Limitations, Math.max(recommendationEntry.sheet.getLastRow() - 1, 1), 1).getDisplayValues();
        if (limitationValues.some(function(row) { return String(row[0] || '').trim(); })) throw new Error('Recommendation Limitations header cannot be rolled back because data now exists.');
        recommendationEntry.sheet.getRange(1, recommendationEntry.table.headers.Limitations).clearContent();
      }
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      throw new Error('Recommendation Draft seeding failed and rollback could not be verified: ' + rollbackError.message);
    }
    throw error;
  }
}

function getFindingQualityRecommendationDraftSchema_(ss) {
  const definitions = [[FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS], [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS], [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS], [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS], [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS], [FQ_ACTIONS_SHEET, FQ_ACTION_COLUMNS], [FQ_FINDING_SETS_SHEET, FQ_FINDING_SET_COLUMNS]];
  const schema = {};
  definitions.forEach(function(definition) {
    const sheet = ss.getSheetByName(definition[0]);
    if (!sheet) throw new Error('Recommendation Draft seeding requires normalized sheet "' + definition[0] + '".');
    const lastColumn = Math.max(sheet.getLastColumn(), definition[1].length);
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
    let needsLimitationsHeader = false;
    definition[1].forEach(function(header, index) {
      const actual = headers[index] || '';
      if (definition[0] === FQ_RECOMMENDATIONS_SHEET && header === 'Limitations' && !actual) { needsLimitationsHeader = true; return; }
      if (definition[0] === FQ_RECOMMENDATIONS_SHEET && ['Reviewed By', 'Reviewed At', 'Review Operation Key'].indexOf(header) !== -1 && !actual) return;
      if (actual !== header) throw new Error('Recommendation Draft schema differs from the approved contract on "' + definition[0] + '" at ' + header + '.');
    });
    const headerMap = {};
    definition[1].forEach(function(header, index) { headerMap[header] = index + 1; });
    schema[definition[0]] = { sheet: sheet, table: { headerRow: 1, headers: headerMap, lastColumn: definition[1].length }, needsLimitationsHeader: needsLimitationsHeader };
  });
  return schema;
}

function assertSelectedInReviewFindingStillExact_(selected, schema) {
  if (!selected || !selected.sheet || !selected.table || !selected.row) throw new Error('One selected Finding is required.');
  const current = findingQualityRecordFromValues_(selected.sheet.getRange(selected.row, 1, 1, selected.table.lastColumn).getValues()[0], selected.table);
  if (String(current['Finding ID']) !== String(selected.record['Finding ID'])) throw new Error('The selected Finding identity changed before Recommendation seeding.');
  const matches = readFindingQualityRecordsWithRows_(schema[FQ_FINDINGS_SHEET]).filter(function(record) { return String(record['Finding ID']) === String(current['Finding ID']); });
  if (matches.length !== 1) throw new Error('The selected Finding is missing or ambiguous.');
  const finding = matches[0];
  if (String(finding['Finding State']) !== 'In Review' || String(finding['Approval Status']) !== 'In Review' || !String(finding['Reviewed By'] || '').trim() || !String(finding['Reviewed At'] || '').trim()) throw new Error('Recommendation seeding requires exactly one In Review Finding with reviewer authority.');
  const errors = validateAssessmentFindingRecord_(finding, { approvalRequired: false });
  if (errors.length) throw new Error('The selected In Review Finding is invalid: ' + errors.join('; '));
  return finding;
}

function resolveRecommendationDraftAuthority_(schema, finding) {
  const prospectId = String(finding['Prospect ID']);
  const contexts = readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  const context = resolveCurrentReviewedPresenceContext_(contexts);
  const presence = readFindingQualityRecords_(schema[FQ_PRESENCE_SHEET].sheet, schema[FQ_PRESENCE_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  if (presence.length !== 1) throw new Error('Recommendation seeding requires one unique Website Presence.');
  validateAssessmentPresenceRecord_(presence[0], { humanApproval: true });
  if (String(presence[0]['Review Status']) !== 'Reviewed' || String(presence[0].Applicability) !== 'Applicable' || String(presence[0]['Presence State']) !== 'Verified Present') throw new Error('Recommendation seeding requires one Reviewed applicable Website Presence.');
  const sets = readFindingQualityRecords_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table).filter(function(record) { return String(record['Finding Set ID']) === String(finding['Finding Set ID']) && String(record.Version) === String(finding['Finding Set Version']) && String(record['Prospect ID']) === prospectId; });
  if (sets.length !== 1) throw new Error('Recommendation seeding requires one matching Finding Set.');
  const set = sets[0];
  if (String(set['Review Status']) !== 'Draft' || String(set['Approval Status']) !== 'Not Reviewed' || String(set['Document Eligibility']) !== 'Not Eligible' || String(set['Finding IDs']) !== String(finding['Finding ID'])) throw new Error('The matching Finding Set must remain Draft, Not Reviewed, and Not Eligible.');
  if (String(set['Business Context Version']) !== String(context.Version) || String(set['Presence Inventory Version']) !== String(presence[0]['Inventory Version'])) throw new Error('Recommendation authority versions are stale or mismatched.');
  const references = parseFindingQualityList_(finding['Evidence References']);
  const setReferences = parseFindingQualityList_(set['Evidence References']);
  if (stableStringifyFindingQuality_(references) !== stableStringifyFindingQuality_(setReferences)) throw new Error('Finding and Finding Set Evidence references differ.');
  const evidence = readFindingQualityRecords_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table).filter(function(record) { return references.indexOf(String(record['Evidence ID'])) !== -1; });
  if (evidence.length !== references.length || evidence.length !== 2) throw new Error('Recommendation seeding requires the complete Reviewed Evidence chain.');
  references.forEach(function(id) { if (evidence.filter(function(record) { return String(record['Evidence ID']) === id; }).length !== 1) throw new Error('Evidence reference is missing or ambiguous: ' + id + '.'); });
  evidence.forEach(function(record) {
    validateAssessmentEvidenceRecord_(record);
    if (String(record['Prospect ID']) !== prospectId || String(record['Review Status']) !== 'Reviewed' || String(record['Finding Set Candidate ID']) !== String(set['Finding Set ID']) || String(record['Candidate Version']) !== String(set.Version)) throw new Error('Reviewed Evidence authority is stale or mismatched.');
  });
  assertRecommendationDraftProspectIdentity_(schema, prospectId, presence[0]);
  return { context: context, presence: presence[0], evidence: evidence, set: set };
}

function assertRecommendationDraftProspectIdentity_(schema, prospectId, presence) {
  const tracker = schema[FQ_CONTEXT_SHEET].sheet.getParent().getSheetByName(MASTER_PROSPECT_SHEET);
  if (!tracker) throw new Error('Master Prospect Tracker is missing.');
  const table = getHeaderTable_(tracker, ['Prospect ID', 'Company', 'Website']);
  const matches = findRowsByExactHeaderValue_(tracker, table, 'Prospect ID', prospectId);
  if (matches.length !== 1) throw new Error('Recommendation seeding requires one unique prospect.');
  const values = tracker.getRange(matches[0], 1, 1, table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(values, table.headers, 'Website') || '').trim() !== String(presence['Verified URL or Identifier'])) throw new Error('Prospect and Presence website authority differ.');
}

function normalizeRecommendationDraftCandidate_(candidate) {
  const normalize = function(value) { return String(value || '').trim().replace(/\s+/g, ' '); };
  const result = { title: normalize(candidate.title), recommendedAction: normalize(candidate.recommendedAction), implementationLocation: normalize(candidate.implementationLocation), intendedOutcome: normalize(candidate.intendedOutcome), dependencies: normalize(candidate.dependencies), limitations: normalize(candidate.limitations) };
  ['title', 'recommendedAction', 'implementationLocation', 'intendedOutcome', 'limitations'].forEach(function(field) { if (!result[field]) throw new Error('Recommendation Draft requires ' + field + '.'); });
  const unsupported = /\b(?:severity|priority|urgent|urgency|score|rating|lost revenue|revenue loss|financial impact|guaranteed results|guaranteed increase|conversion rate|lead volume increase|percent|percentage)\b/i;
  [result.title, result.recommendedAction, result.implementationLocation, result.intendedOutcome, result.dependencies].forEach(function(value) { if (unsupported.test(value)) throw new Error('Recommendation candidate contains an unsupported claim or classification.'); });
  if (!/\b(?:do not|does not|no)\b/i.test(result.limitations) || !/\b(?:revenue|conversion rates?|lead volume|guaranteed results?)\b/i.test(result.limitations)) throw new Error('Recommendation limitations must state the prohibited outcome claims explicitly.');
  if (!/\bimplementation\b/i.test(result.limitations) || !/\btesting\b/i.test(result.limitations)) throw new Error('Recommendation limitations must state the uncompleted implementation and testing boundary.');
  return result;
}

function recommendationDraftCandidateFromRecord_(record) {
  return normalizeRecommendationDraftCandidate_({
    title: record.Title,
    recommendedAction: record['Recommended Action'],
    implementationLocation: record['Implementation Location'],
    intendedOutcome: record['Intended Outcome'],
    dependencies: record.Dependencies,
    limitations: record.Limitations
  });
}

function recommendationDraftFindingAuthorityProjection_(record) {
  const projection = {};
  FQ_RECOMMENDATION_DRAFT_FINDING_AUTHORITY_FIELDS.forEach(function(field) {
    projection[field] = findingQualityDateText_(record[field]);
  });
  return projection;
}

function recommendationDraftSetAuthorityProjection_(record, contract) {
  const projection = {};
  FQ_FINDING_SET_COLUMNS.forEach(function(field) { projection[field] = findingQualityDateText_(record[field]); });
  if (contract === FQ_HISTORICAL_APPROVAL_CONTRACT) FQ_FINDING_SET_RETURN_AUDIT_FIELDS.forEach(function(field) { delete projection[field]; });
  return projection;
}

function buildRecommendationDraftOperationIdentity_(finding, authority, candidate) {
  const authorityHash = fingerprintFindingQualityValue_({
    finding: recommendationDraftFindingAuthorityProjection_(finding),
    set: recommendationDraftSetAuthorityProjection_(authority.set),
    context: businessContextCanonicalProjection_(authority.context),
    presence: reviewedPresenceEvidenceProjection_(authority.presence),
    evidence: authority.evidence.map(findingDraftEvidenceAuthorityProjection_)
  });
  const candidateHash = fingerprintFindingQualityValue_(candidate);
  const operationKey = [FQ_RECOMMENDATION_DRAFT_OPERATION_PREFIX, finding['Finding ID'], authorityHash.slice(0, 16), candidateHash.slice(0, 16)].join(':');
  return { operationKey: operationKey, recommendationId: 'REC-' + fingerprintFindingQualityText_(operationKey).slice(0, 16) };
}

function parseRecommendationSeedOperationIdentity_(recommendation, candidate) {
  const operationKey = String(recommendation['Operation Key'] || '');
  const parts = operationKey.split(':');
  if (parts.length !== 4 || parts[0] !== FQ_RECOMMENDATION_DRAFT_OPERATION_PREFIX) throw new Error('Recommendation seed Operation Key is invalid.');
  if (parts[1] !== String(recommendation['Finding ID'])) throw new Error('Recommendation seed Finding ID lineage changed.');
  const candidateHash = fingerprintFindingQualityValue_(candidate).slice(0, 16);
  if (parts[3] !== candidateHash) throw new Error('Recommendation immutable content changed after Draft creation.');
  const recommendationId = 'REC-' + fingerprintFindingQualityText_(operationKey).slice(0, 16);
  if (recommendationId !== String(recommendation['Recommendation ID'])) throw new Error('Recommendation ID differs from its original seed operation.');
  return { operationKey: operationKey, recommendationId: recommendationId, authorityHash: parts[2], candidateHash: candidateHash };
}

function assertRecommendationSeedIdentity_(schema, finding, recommendation, authority, candidate) {
  const supersedesRecommendationId = String(recommendation['Supersedes Recommendation ID'] || '').trim();
  if (!supersedesRecommendationId) {
    const stored = parseRecommendationSeedOperationIdentity_(recommendation, candidate);
    ['Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Finding ID'].forEach(function(field) {
      if (String(recommendation[field]) !== String(field === 'Finding ID' ? finding['Finding ID'] : finding[field])) throw new Error('Recommendation authority lineage changed at ' + field + '.');
    });
    if (String(finding['Finding State']) === 'Actionable' && String(finding['Approval Status']) === FQ_APPROVED_STATUS) {
      if (typeof buildFindingApprovalOperationKey_ !== 'function' || !String(finding['Approval Operation Key'] || '').trim()) throw new Error('Approved Finding operation authority is missing.');
      const approvalOperationKey = buildFindingApprovalOperationKey_(finding, recommendation, authority);
      if (approvalOperationKey !== String(finding['Approval Operation Key'])) throw new Error('Approved Finding content or authority changed after approval.');
      return stored;
    }
    const recomputed = buildRecommendationDraftOperationIdentity_(finding, authority, candidate);
    if (recomputed.recommendationId !== stored.recommendationId || recomputed.operationKey !== stored.operationKey) throw new Error('Recommendation content or operation authority changed after Draft creation.');
    return recomputed;
  }
  const supersedesFindingId = String(finding['Supersedes Finding ID'] || '').trim();
  if (!supersedesFindingId) throw new Error('Successor Recommendation is missing its Finding supersession authority.');
  const originalRecommendations = readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(record) { return String(record['Recommendation ID']) === supersedesRecommendationId; });
  const originalFindings = readFindingQualityRecordsWithRows_(schema[FQ_FINDINGS_SHEET]).filter(function(record) { return String(record['Finding ID']) === supersedesFindingId; });
  if (originalRecommendations.length !== 1 || originalFindings.length !== 1) throw new Error('Successor Recommendation history is missing or ambiguous.');
  const originalRecommendation = originalRecommendations[0];
  const originalFinding = originalFindings[0];
  return assertPreSnapshotSuccessorRecommendationIdentity_(schema, finding, recommendation, authority, candidate, originalFinding, originalRecommendation, {});
}

function preSnapshotRecoveryCandidateVariantsFromFinding_(finding) {
  const normalize = function(value) { return String(value || '').trim().replace(/\s+/g, ' '); };
  const legacy = {
    expectedCondition: normalize(finding['Expected Condition']),
    consequenceBasis: normalize(finding['Consequence Basis']),
    completionTest: normalize(finding['Completion Test'])
  };
  const current = {
    expectedCondition: legacy.expectedCondition,
    consequenceBasis: legacy.consequenceBasis,
    businessConsequence: normalize(finding['Business Consequence']),
    recommendedAction: normalize(finding['Recommended Action']),
    completionTest: legacy.completionTest
  };
  return [current, legacy];
}

var FQ_HISTORICAL_APPROVAL_CONTRACT = 'HISTORICAL_APPROVAL_RECEIPT_V1';
var FQ_CURRENT_ACTIONABLE_APPROVAL_CONTRACT = 'COMPLETE_ACTIONABLE_PLAIN_LANGUAGE_V2';
var FQ_FINDING_SET_RETURN_AUDIT_FIELDS = ['Previous Review Submitted By', 'Previous Review Submitted At', 'Returned By', 'Returned At', 'Return Reason', 'Return Operation Key'];

function findingQualityAuthorityTime_(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || ''));
  return isFinite(parsed) ? parsed : NaN;
}

function findingSetAuthorityAsOf_(setRecord, authorityTime) {
  const set = Object.assign({}, setRecord);
  const returnedAt = findingQualityAuthorityTime_(set['Returned At']);
  if (!isFinite(authorityTime)) throw new Error('Historical authority timestamp is invalid.');
  if (String(set['Return Operation Key'] || '').trim() && !isFinite(returnedAt)) throw new Error('Finding Set return audit timestamp is invalid.');
  if (!isFinite(returnedAt) || returnedAt > authorityTime) {
    FQ_FINDING_SET_RETURN_AUDIT_FIELDS.forEach(function(field) { set[field] = ''; });
  }
  return set;
}

function preSnapshotCreationSetAuthority_(setRecord, predecessorFinding, contract) {
  const supersededAt = findingQualityAuthorityTime_(predecessorFinding['Superseded At']);
  let set;
  if (!isFinite(supersededAt)) {
    set = Object.assign({}, setRecord);
    if (contract === FQ_HISTORICAL_APPROVAL_CONTRACT) FQ_FINDING_SET_RETURN_AUDIT_FIELDS.forEach(function(field) { set[field] = ''; });
  } else set = findingSetAuthorityAsOf_(setRecord, supersededAt);
  return preSnapshotDraftSetLifecycleAuthority_(set, predecessorFinding['Finding ID']);
}

function preSnapshotDraftSetLifecycleAuthority_(set, findingId) {
  set = Object.assign({}, set);
  set['Finding IDs'] = String(findingId);
  // Recovery receipts are created while the set is an unsnapshotted Draft.
  // Never project a later review cycle backward into that frozen identity.
  set['Review Status'] = 'Draft';
  set['Reviewed By'] = '';
  set['Reviewed At'] = '';
  set['Approved At'] = '';
  set['Approval Status'] = 'Not Reviewed';
  set['Document Eligibility'] = 'Not Eligible';
  set['Immutable Hash'] = '';
  set['Snapshot File ID'] = '';
  return set;
}

function historicalFindingApprovalSetAuthority_(setRecord, predecessorFinding) {
  const set = findingSetAuthorityAsOf_(setRecord, findingQualityAuthorityTime_(predecessorFinding['Reviewed At']));
  return preSnapshotDraftSetLifecycleAuthority_(set, predecessorFinding['Finding ID']);
}

function preSnapshotCreationFindingAuthority_(finding) {
  const record = Object.assign({}, finding, { 'Finding State': 'Actionable' });
  ['Superseded By Finding ID', 'Superseded By', 'Superseded At', 'Supersession Operation Key'].forEach(function(field) { record[field] = ''; });
  return record;
}

function preSnapshotCreationRecommendationAuthority_(recommendation) {
  const record = Object.assign({}, recommendation);
  record['Superseded By Recommendation ID'] = '';
  return record;
}

function buildCanonicalPreSnapshotRecoveryIdentity_(finding, recommendation, authority, candidate, contract) {
  const creationFinding = preSnapshotCreationFindingAuthority_(finding);
  const creationRecommendation = preSnapshotCreationRecommendationAuthority_(recommendation);
  const creationAuthority = Object.assign({}, authority, { set: preSnapshotCreationSetAuthority_(authority.set, finding, contract) });
  const authorityHash = fingerprintFindingQualityValue_({ finding: recommendationDraftFindingAuthorityProjection_(creationFinding), recommendation: FQ_RECOMMENDATION_COLUMNS.reduce(function(out, field) { out[field] = findingQualityDateText_(creationRecommendation[field]); return out; }, {}), set: recommendationDraftSetAuthorityProjection_(creationAuthority.set, contract), context: businessContextCanonicalProjection_(creationAuthority.context), presence: reviewedPresenceEvidenceProjection_(creationAuthority.presence), evidence: creationAuthority.evidence.map(findingDraftEvidenceAuthorityProjection_) });
  const candidateHash = fingerprintFindingQualityValue_(candidate);
  const operationKey = [FQ_PRE_SNAPSHOT_PREFIX, creationFinding['Finding ID'], authorityHash.slice(0, 16), candidateHash.slice(0, 16)].join(':');
  return { operationKey: operationKey, findingId: 'FND-' + fingerprintFindingQualityText_(operationKey + ':FINDING').slice(0, 16), recommendationId: 'REC-' + fingerprintFindingQualityText_(operationKey + ':RECOMMENDATION').slice(0, 16) };
}

function assertPreservedPreSnapshotApprovedIdentity_(finding, recommendation, authority) {
  if (String(finding['Approval Status']) !== FQ_APPROVED_STATUS || String(finding['Approved Version']) !== String(finding['Finding Set Version']) || !String(finding['Approval Operation Key'] || '').trim()) throw new Error('Historical predecessor Finding approval authority is incomplete.');
  if (String(recommendation['Review Status']) !== 'Reviewed' || !String(recommendation['Reviewed By'] || '').trim() || !String(recommendation['Reviewed At'] || '').trim() || !String(recommendation['Review Operation Key'] || '').trim()) throw new Error('Historical predecessor Recommendation review authority is incomplete.');
  const approvalAuthority = Object.assign({}, authority, { set: historicalFindingApprovalSetAuthority_(authority.set, finding) });
  const stored = String(finding['Approval Operation Key']);
  const currentKey = buildFindingApprovalOperationKey_(finding, recommendation, approvalAuthority);
  const historicalKey = buildFindingApprovalOperationKey_(finding, recommendation, approvalAuthority, FQ_HISTORICAL_APPROVAL_CONTRACT);
  if (stored === currentKey) return { contract: FQ_CURRENT_ACTIONABLE_APPROVAL_CONTRACT, operationKey: currentKey };
  if (stored === historicalKey) return { contract: FQ_HISTORICAL_APPROVAL_CONTRACT, operationKey: historicalKey };
  throw new Error('Historical predecessor approval identity changed for ' + String(finding['Finding ID']) + '; stored=' + stored.split(':').pop() + '; current=' + currentKey.split(':').pop() + '; historical=' + historicalKey.split(':').pop() + '.');
}

function assertPreSnapshotSuccessorRecommendationIdentity_(schema, finding, recommendation, authority, candidate, originalFinding, originalRecommendation, visited, rootActiveFindingId) {
  rootActiveFindingId = rootActiveFindingId || String(finding['Finding ID']);
  const visitKey = String(finding['Finding ID']) + '|' + String(recommendation['Recommendation ID']);
  if (visited[visitKey]) throw new Error('Successor Recommendation history contains a cycle.');
  visited[visitKey] = true;
  const supersedesFindingId = String(finding['Supersedes Finding ID'] || '').trim();
  const supersedesRecommendationId = String(recommendation['Supersedes Recommendation ID'] || '').trim();
  const operationKey = String(recommendation['Operation Key'] || '');
  const suffix = ':RECOMMENDATION';
  if (operationKey.slice(-suffix.length) !== suffix) throw new Error('Successor Recommendation operation authority is invalid.');
  const recoveryKey = operationKey.slice(0, -suffix.length);
  const parts = recoveryKey.split(':');
  if (parts.length !== 4 || parts[0] !== 'FQPRESNAPSHOTRECOVERY' || parts[1] !== supersedesFindingId) throw new Error('Successor Recommendation recovery identity is invalid.');
  const candidateVariants = preSnapshotRecoveryCandidateVariantsFromFinding_(finding);
  const matchingCandidates = candidateVariants.filter(function(item) { return fingerprintFindingQualityValue_(item).slice(0, 16) === parts[3]; });
  if (matchingCandidates.length !== 1) throw new Error('Successor Recommendation recovery candidate identity is invalid.');
  if (String(originalFinding['Finding State']) !== 'Superseded Pre-Snapshot' || String(originalFinding['Supersession Operation Key']) !== recoveryKey || String(originalFinding['Superseded By Finding ID']) !== String(finding['Finding ID'])) throw new Error('Successor Finding history differs from its recovery authority.');
  if (String(originalFinding['Finding ID']) !== supersedesFindingId || String(originalRecommendation['Recommendation ID']) !== supersedesRecommendationId || String(originalRecommendation['Superseded By Recommendation ID']) !== String(recommendation['Recommendation ID'])) throw new Error('Successor Recommendation reciprocal history differs from its recovery authority.');
  ['Prospect ID', 'Finding Set ID', 'Finding Set Version'].forEach(function(field) { if (String(originalRecommendation[field]) !== String(recommendation[field])) throw new Error('Successor Recommendation lineage changed at ' + field + '.'); });
  ['Title', 'Implementation Location', 'Intended Outcome', 'Dependencies', 'Limitations'].forEach(function(field) { if (findingQualityDateText_(originalRecommendation[field]) !== findingQualityDateText_(recommendation[field])) throw new Error('Successor Recommendation content changed at ' + field + '.'); });
  if (findingQualityDateText_(recommendation['Recommended Action']) !== findingQualityDateText_(finding['Recommended Action'])) throw new Error('Successor Recommendation content changed at Recommended Action.');
  const activeFindingIds = parseFindingQualityList_(authority.set['Finding IDs']);
  if (activeFindingIds.indexOf(String(originalFinding['Finding ID'])) !== -1) throw new Error('Historical predecessor Finding is incorrectly included in active Finding Set authority.');
  if (activeFindingIds.filter(function(id) { return id === rootActiveFindingId; }).length !== 1) throw new Error('Current successor Finding is missing or ambiguous in active Finding Set authority.');
  assertPreservedPreSnapshotApprovedIdentity_(originalFinding, originalRecommendation, authority);
  const recoveryVariants = [buildCanonicalPreSnapshotRecoveryIdentity_(originalFinding, originalRecommendation, authority, matchingCandidates[0]), buildCanonicalPreSnapshotRecoveryIdentity_(originalFinding, originalRecommendation, authority, matchingCandidates[0], FQ_HISTORICAL_APPROVAL_CONTRACT)];
  if (!recoveryVariants.some(function(item) { return item.operationKey === recoveryKey; })) throw new Error('Successor Recommendation recovery authority fingerprint is invalid for predecessor ' + String(originalFinding['Finding ID']) + '; stored=' + parts[2] + '; current=' + recoveryVariants[0].operationKey.split(':')[2] + '; historical=' + recoveryVariants[1].operationKey.split(':')[2] + '.');
  if (String(recommendation['Recommendation ID']) !== 'REC-' + fingerprintFindingQualityText_(recoveryKey + ':RECOMMENDATION').slice(0, 16) || String(finding['Finding ID']) !== 'FND-' + fingerprintFindingQualityText_(recoveryKey + ':FINDING').slice(0, 16)) throw new Error('Successor record identity differs from its recovery operation.');
  if (String(originalFinding['Supersedes Finding ID'] || '').trim() || String(originalRecommendation['Supersedes Recommendation ID'] || '').trim()) {
    const priorFindingId = String(originalFinding['Supersedes Finding ID'] || '').trim();
    const priorRecommendationId = String(originalRecommendation['Supersedes Recommendation ID'] || '').trim();
    if (!priorFindingId || !priorRecommendationId) throw new Error('Historical predecessor supersession lineage is incomplete.');
    const priorFindings = readFindingQualityRecordsWithRows_(schema[FQ_FINDINGS_SHEET]).filter(function(record) { return String(record['Finding ID']) === priorFindingId; });
    const priorRecommendations = readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(record) { return String(record['Recommendation ID']) === priorRecommendationId; });
    if (priorFindings.length !== 1 || priorRecommendations.length !== 1) throw new Error('Historical predecessor chain is missing or ambiguous.');
    const priorCandidate = recommendationDraftCandidateFromRecord_(originalRecommendation);
    assertPreSnapshotSuccessorRecommendationIdentity_(schema, originalFinding, originalRecommendation, authority, priorCandidate, priorFindings[0], priorRecommendations[0], visited, rootActiveFindingId);
  }
  return { recommendationId: recommendation['Recommendation ID'], operationKey: recommendation['Operation Key'] };
}

function buildDraftRecommendationRecord_(finding, candidate, recommendationId, operationKey) {
  return {
    'Recommendation ID': recommendationId, 'Prospect ID': finding['Prospect ID'], 'Finding Set ID': finding['Finding Set ID'],
    'Finding Set Version': finding['Finding Set Version'], 'Finding ID': finding['Finding ID'], Title: candidate.title,
    'Recommended Action': candidate.recommendedAction, 'Implementation Location': candidate.implementationLocation,
    'Intended Outcome': candidate.intendedOutcome, Dependencies: candidate.dependencies, 'Review Status': 'Draft',
    'Operation Key': operationKey, Limitations: candidate.limitations,
    'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': ''
  };
}

function validateStandaloneDraftRecommendation_(recommendation, finding) {
  ['Recommendation ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Finding ID', 'Title', 'Recommended Action', 'Implementation Location', 'Intended Outcome', 'Review Status', 'Operation Key', 'Limitations'].forEach(function(field) { if (!String(recommendation[field] || '').trim()) throw new Error('Draft Recommendation requires ' + field + '.'); });
  if (String(recommendation['Review Status']) !== 'Draft' || String(recommendation['Prospect ID']) !== String(finding['Prospect ID']) || String(recommendation['Finding Set ID']) !== String(finding['Finding Set ID']) || String(recommendation['Finding Set Version']) !== String(finding['Finding Set Version']) || String(recommendation['Finding ID']) !== String(finding['Finding ID'])) throw new Error('Draft Recommendation lineage is invalid.');
}

function assertCompletedRecommendationDraft_(schema, finding, candidate, operationKey, recommendationId) {
  const recommendations = findFindingQualityRows_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, 'Recommendation ID', recommendationId);
  const findings = findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', finding['Finding ID']);
  if (recommendations.length !== 1 || findings.length !== 1) throw new Error('Recommendation Draft operation is missing or ambiguous.');
  const expected = buildDraftRecommendationRecord_(finding, candidate, recommendationId, operationKey);
  FQ_RECOMMENDATION_COLUMNS.forEach(function(field) { if (String(recommendations[0][field] || '') !== String(expected[field] || '')) throw new Error('Recommendation Draft retry differs at ' + field + '.'); });
  if (String(findings[0]['Recommendation ID']) !== recommendationId) throw new Error('Recommendation Draft Finding linkage is incomplete.');
  FQ_FINDING_COLUMNS.filter(function(field) { return field !== 'Recommendation ID'; }).forEach(function(field) { if (findingQualityDateText_(findings[0][field]) !== findingQualityDateText_(finding[field])) throw new Error('Recommendation retry changed Finding authority at ' + field + '.'); });
  assertNoRecommendationDraftSideEffects_(schema, String(finding['Prospect ID']));
}

function assertExactRecommendationDraftReadback_(schema, originalFinding, expected, operationKey) {
  const recommendations = findFindingQualityRows_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, 'Recommendation ID', expected['Recommendation ID']);
  const findings = findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', originalFinding['Finding ID']);
  if (recommendations.length !== 1 || findings.length !== 1 || String(recommendations[0]['Operation Key']) !== operationKey) throw new Error('Recommendation Draft exact readback failed.');
  FQ_RECOMMENDATION_COLUMNS.forEach(function(field) { if (String(recommendations[0][field] || '') !== String(expected[field] || '')) throw new Error('Recommendation readback differs at ' + field + '.'); });
  if (String(findings[0]['Recommendation ID']) !== String(expected['Recommendation ID'])) throw new Error('Finding Recommendation linkage did not persist.');
  FQ_FINDING_COLUMNS.filter(function(field) { return field !== 'Recommendation ID'; }).forEach(function(field) { if (findingQualityDateText_(findings[0][field]) !== findingQualityDateText_(originalFinding[field])) throw new Error('Finding authority changed at ' + field + '.'); });
}

function assertNoRecommendationDraftSideEffects_(schema, prospectId) {
  if (readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table).some(function(record) { return String(record['Prospect ID']) === prospectId; })) throw new Error('Recommendation Draft seeding created a prohibited Action.');
  const sets = readFindingQualityRecords_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  if (sets.length !== 1 || String(sets[0]['Document Eligibility']) !== 'Not Eligible' || String(sets[0]['Review Status']) !== 'Draft' || String(sets[0]['Approval Status']) !== 'Not Reviewed') throw new Error('Recommendation Draft seeding changed Finding Set lifecycle authority.');
}

function deleteExactRecommendationDraftRow_(entry, row, recommendationId, operationKey) {
  if (row <= entry.table.headerRow || row > entry.sheet.getLastRow()) throw new Error('Recommendation rollback row is outside the operation boundary.');
  const record = readFindingQualityRecord_(entry.sheet, entry.table, row);
  if (String(record['Recommendation ID']) !== String(recommendationId) || String(record['Operation Key']) !== operationKey) throw new Error('Recommendation rollback target is not operation-owned.');
  entry.sheet.deleteRow(row);
}
