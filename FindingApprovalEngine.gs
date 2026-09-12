/** Transactional approval of one reviewed Finding with a reviewed Recommendation. */
var FQ_FINDING_APPROVAL_CONFIRMATION = 'APPROVE FINDING';
var FQ_FINDING_APPROVAL_OPERATION_PREFIX = 'FQFINDINGAPPROVAL';
var FQ_FINDING_APPROVAL_FIELD = 'Approval Operation Key';
var FQ_FINDING_APPROVAL_IMMUTABLE_FIELDS = [
  'Finding ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Category',
  'Finding Title', 'Channel Type', 'Presence State', 'Customer Journey Stage',
  'Business Objective', 'Evidence Source', 'Evidence Location', 'Evidence Observed At',
  'Evidence Excerpt', 'Observation', 'Expected Condition', 'Business Consequence',
  'Consequence Basis', 'Recommended Action', 'Implementation Location', 'Intended Outcome',
  'Completion Test', 'Evidence Confidence', 'Evidence References', 'Limitations',
  'Recommendation ID'
];
var FQ_RECOMMENDATION_APPROVAL_AUTHORITY_FIELDS = [
  'Recommendation ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version',
  'Finding ID', 'Title', 'Recommended Action', 'Implementation Location',
  'Intended Outcome', 'Dependencies', 'Review Status', 'Operation Key', 'Limitations',
  'Reviewed By', 'Reviewed At', 'Review Operation Key'
];

function approveSelectedFindingForClient() {
  const selected = requireSelectedInReviewFindingForApproval_();
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Approve Selected Finding for Client', 'Type ' + FQ_FINDING_APPROVAL_CONFIRMATION + ' exactly. This approves only the selected Finding. It does not approve the Finding Set.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== FQ_FINDING_APPROVAL_CONFIRMATION) throw new Error('Finding approval cancelled.');
  const result = approveFindingQualityFinding_(selected, {});
  ui.alert('Finding Approval', result.status === 'already-completed' ? 'This Finding approval was already completed and verified. No records changed.' : 'The Finding is Approved for Client. The Recommendation remains Reviewed and the Finding Set remains Draft and ineligible.', ui.ButtonSet.OK);
  return result;
}

function requireSelectedInReviewFindingForApproval_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_FINDINGS_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) throw new Error('Select exactly one data row on ' + FQ_FINDINGS_SHEET + '.');
  const schema = getFindingQualityFindingApprovalSchema_(ss);
  const entry = schema[FQ_FINDINGS_SHEET];
  const row = range.getRow();
  if (row > sheet.getLastRow()) throw new Error('Select exactly one data row on ' + FQ_FINDINGS_SHEET + '.');
  const record = findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, entry.table.lastColumn).getValues()[0], entry.table);
  if (!String(record['Finding ID'] || '').trim() || !String(record['Prospect ID'] || '').trim()) throw new Error('The selected Finding requires exact Finding ID and Prospect ID values.');
  return { ss: ss, sheet: sheet, table: entry.table, row: row, record: record };
}

function approveFindingQualityFinding_(selected, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return approveFindingQualityFindingLocked_(selected, hooks || {}); }
  finally { lock.releaseLock(); }
}

function approveFindingQualityFindingLocked_(selected, hooks) {
  const schema = getFindingQualityFindingApprovalSchema_(selected.ss);
  const findingEntry = schema[FQ_FINDINGS_SHEET];
  const matches = readFindingQualityRecordsWithRows_(findingEntry).filter(function(record) { return String(record['Finding ID']) === String(selected.record['Finding ID']); });
  if (matches.length !== 1 || String(matches[0]['Prospect ID']) !== String(selected.record['Prospect ID'])) throw new Error('The selected Finding is missing, ambiguous, or changed.');
  const finding = matches[0];
  const recommendationMatches = readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(record) { return String(record['Recommendation ID']) === String(finding['Recommendation ID']); });
  if (recommendationMatches.length !== 1) throw new Error('The linked Recommendation is missing or ambiguous.');
  const recommendation = recommendationMatches[0];
  if (String(recommendation['Prospect ID']) !== String(finding['Prospect ID']) || String(recommendation['Finding ID']) !== String(finding['Finding ID']) || String(recommendation['Finding Set ID']) !== String(finding['Finding Set ID']) || String(recommendation['Finding Set Version']) !== String(finding['Finding Set Version'])) throw new Error('Recommendation lineage differs from the selected Finding.');
  if (String(recommendation['Review Status']) !== 'Reviewed' || !String(recommendation['Reviewed By'] || '').trim() || !String(recommendation['Reviewed At'] || '').trim() || !String(recommendation['Review Operation Key'] || '').trim()) throw new Error('Finding approval requires one linked Reviewed Recommendation.');
  const authority = resolveRecommendationDraftAuthority_(schema, finding);
  const candidate = normalizeRecommendationDraftCandidate_({ title: recommendation.Title, recommendedAction: recommendation['Recommended Action'], implementationLocation: recommendation['Implementation Location'], intendedOutcome: recommendation['Intended Outcome'], dependencies: recommendation.Dependencies, limitations: recommendation.Limitations });
  if (typeof assertRecommendationSeedIdentity_ === 'function') assertRecommendationSeedIdentity_(schema, finding, recommendation, authority, candidate);
  else {
    const recommendationIdentity = buildRecommendationDraftOperationIdentity_(finding, authority, candidate);
    if (recommendationIdentity.recommendationId !== String(recommendation['Recommendation ID']) || recommendationIdentity.operationKey !== String(recommendation['Operation Key'])) throw new Error('The linked Recommendation wording or authority changed after review.');
  }
  const findingErrors = validateAssessmentFindingRecord_(finding, { approvalRequired: false });
  if (findingErrors.length) throw new Error('Reviewed Finding authority is invalid: ' + findingErrors.join('; '));
  const languageErrors = validatePlainLanguageFindingFields_(finding);
  if (languageErrors.length) throw new Error('Finding approval failed plain-language validation: ' + languageErrors.join('; '));
  if (FQ_FINDING_DRAFT_CATEGORIES.indexOf(String(finding.Category)) === -1 || !String(finding['Finding Title']).trim() || !String(finding.Observation).trim() || !String(finding['Business Consequence']).trim() || !String(finding.Limitations).trim() || !parseFindingQualityList_(finding['Evidence References']).length || !isFinite(Number(finding['Evidence Confidence']))) throw new Error('Reviewed Finding content authority is incomplete.');
  assertFindingApprovalDropdowns_(findingEntry);
  assertFindingApprovalNoSideEffects_(schema, finding, recommendation);
  const operationKey = buildFindingApprovalOperationKey_(finding, recommendation, authority);
  if (String(finding['Approval Status']) === FQ_APPROVED_STATUS) {
    assertCompletedFindingApproval_(schema, finding, recommendation, operationKey);
    return { ok: true, status: 'already-completed', findingId: finding['Finding ID'], operationKey: operationKey };
  }
  if (String(finding['Finding State']) !== 'In Review' || String(finding['Approval Status']) !== 'In Review') throw new Error('Finding approval requires one In Review Finding.');
  if (String(finding[FQ_FINDING_APPROVAL_FIELD] || '').trim()) throw new Error('In Review Finding contains an unexpected approval operation key.');
  const reviewer = String(requireHumanReviewer_()).trim().toLowerCase();
  const before = findingEntry.sheet.getRange(finding._row, 1, 1, findingEntry.table.lastColumn).getValues()[0];
  const installed = [];
  try {
    findingEntry.missingApprovalHeaders.forEach(function(header) { findingEntry.sheet.getRange(1, findingEntry.table.headers[header]).setValue(header); installed.push(header); });
    const updated = Object.assign({}, finding, { 'Finding State': 'Actionable', 'Approval Status': FQ_APPROVED_STATUS, 'Approved Version': finding['Finding Set Version'], 'Reviewed By': reviewer, 'Reviewed At': new Date(), 'Validation Codes': '', 'Approval Operation Key': operationKey });
    delete updated._row;
    writeFindingQualityRecord_(findingEntry.sheet, findingEntry.table, finding._row, updated);
    if (hooks.afterWrite) hooks.afterWrite(updated);
    assertExactFindingApprovalReadback_(schema, finding, recommendation, updated, operationKey);
    return { ok: true, status: 'completed', findingId: finding['Finding ID'], operationKey: operationKey, approvedBy: reviewer };
  } catch (error) {
    try {
      findingEntry.sheet.getRange(finding._row, 1, 1, findingEntry.table.lastColumn).setValues([before]);
      installed.reverse().forEach(function(header) {
        const column = findingEntry.table.headers[header];
        const values = findingEntry.sheet.getRange(2, column, Math.max(findingEntry.sheet.getLastRow() - 1, 1), 1).getDisplayValues();
        if (values.some(function(row) { return String(row[0] || '').trim(); })) throw new Error(header + ' cannot be rolled back because data now exists.');
        findingEntry.sheet.getRange(1, column).clearContent();
      });
      SpreadsheetApp.flush();
    } catch (rollbackError) { throw new Error('Finding approval failed and rollback could not be verified: ' + rollbackError.message); }
    throw error;
  }
}

function buildFindingApprovalOperationKey_(finding, recommendation, authority, contract) {
  const findingProjection = {};
  FQ_FINDING_APPROVAL_IMMUTABLE_FIELDS.forEach(function(field) { findingProjection[field] = findingQualityDateText_(finding[field]); });
  const recommendationProjection = {};
  FQ_RECOMMENDATION_APPROVAL_AUTHORITY_FIELDS.forEach(function(field) { recommendationProjection[field] = findingQualityDateText_(recommendation[field]); });
  const setProjection = findingApprovalSetAuthorityProjection_(authority.set);
  if (contract === FQ_HISTORICAL_APPROVAL_CONTRACT) FQ_FINDING_SET_RETURN_AUDIT_FIELDS.forEach(function(field) { delete setProjection[field]; });
  const fingerprint = fingerprintFindingQualityValue_({ finding: findingProjection, recommendation: recommendationProjection, context: businessContextCanonicalProjection_(authority.context), presence: reviewedPresenceEvidenceProjection_(authority.presence), evidence: authority.evidence.map(findingDraftEvidenceAuthorityProjection_), set: setProjection });
  return [FQ_FINDING_APPROVAL_OPERATION_PREFIX, finding['Finding ID'], fingerprint.slice(0, 16)].join(':');
}

function findingApprovalSetAuthorityProjection_(record) {
  const projection = recommendationDraftSetAuthorityProjection_(record);
  projection['Review Status'] = 'Draft';
  projection['Reviewed By'] = '';
  projection['Reviewed At'] = '';
  projection['Approved At'] = '';
  projection['Approval Status'] = 'Not Reviewed';
  projection['Document Eligibility'] = 'Not Eligible';
  projection['Immutable Hash'] = '';
  projection['Snapshot File ID'] = '';
  return projection;
}

function getFindingQualityFindingApprovalSchema_(ss) {
  const definitions = [[FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS], [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS], [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS], [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS], [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS], [FQ_ACTIONS_SHEET, FQ_ACTION_COLUMNS], [FQ_FINDING_SETS_SHEET, FQ_FINDING_SET_COLUMNS]];
  const schema = {};
  definitions.forEach(function(definition) {
    const sheet = ss.getSheetByName(definition[0]);
    if (!sheet) throw new Error('Finding approval requires normalized sheet "' + definition[0] + '".');
    if (definition[0] !== FQ_FINDINGS_SHEET) { schema[definition[0]] = { sheet: sheet, table: getHeaderTable_(sheet, definition[1]), missingApprovalHeaders: [] }; return; }
    const last = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, last).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
    const map = {}; const missing = [];
    definition[1].forEach(function(header) {
      const positions = headers.map(function(value, index) { return value === header ? index + 1 : 0; }).filter(Boolean);
      if (positions.length > 1) throw new Error('Finding approval schema has an ambiguous header: ' + header + '.');
      if (!positions.length) { if (header !== FQ_FINDING_APPROVAL_FIELD) throw new Error('Finding approval schema is missing required header: ' + header + '.'); missing.push(header); return; }
      map[header] = positions[0];
    });
    missing.forEach(function(header, index) { map[header] = last + index + 1; });
    schema[definition[0]] = { sheet: sheet, table: { headerRow: 1, headers: map, lastColumn: last + missing.length }, missingApprovalHeaders: missing };
  });
  return schema;
}

function assertFindingApprovalDropdowns_(entry) {
  const checks = [['Finding State', 'Actionable'], ['Approval Status', FQ_APPROVED_STATUS]];
  checks.forEach(function(check) {
    const range = entry.sheet.getRange(2, entry.table.headers[check[0]], Math.max(entry.sheet.getMaxRows() - 1, 1), 1);
    range.getDataValidations().forEach(function(row) { row.forEach(function(rule) {
      if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST || rule.getAllowInvalid()) throw new Error(check[0] + ' must use a strict dropdown validation.');
      const values = [].concat(rule.getCriteriaValues()[0] || []).map(String);
      if (values.indexOf(check[1]) === -1) throw new Error(check[0] + ' dropdown does not allow ' + check[1] + '.');
    }); });
  });
}

function assertExactFindingApprovalReadback_(schema, before, recommendation, expected, operationKey) {
  const findings = findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', before['Finding ID']);
  if (findings.length !== 1) throw new Error('Finding approval readback is missing or ambiguous.');
  FQ_FINDING_COLUMNS.forEach(function(field) { if (findingQualityDateText_(findings[0][field]) !== findingQualityDateText_(expected[field])) throw new Error('Finding approval readback differs at ' + field + '.'); });
  if (String(findings[0][FQ_FINDING_APPROVAL_FIELD]) !== operationKey) throw new Error('Finding approval operation key did not persist.');
  assertFindingApprovalNoSideEffects_(schema, findings[0], recommendation);
}

function assertCompletedFindingApproval_(schema, finding, recommendation, operationKey) {
  if (String(finding['Finding State']) !== 'Actionable' || String(finding['Approved Version']) !== String(finding['Finding Set Version']) || String(finding[FQ_FINDING_APPROVAL_FIELD]) !== operationKey || !String(finding['Reviewed By'] || '').trim() || !String(finding['Reviewed At'] || '').trim()) throw new Error('Approved Finding does not match the completed approval operation.');
  assertFindingApprovalNoSideEffects_(schema, finding, recommendation);
}

function assertFindingApprovalNoSideEffects_(schema, finding, recommendation) {
  const recs = findFindingQualityRows_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, 'Recommendation ID', recommendation['Recommendation ID']);
  FQ_RECOMMENDATION_COLUMNS.forEach(function(field) { if (recs.length !== 1 || findingQualityDateText_(recs[0][field]) !== findingQualityDateText_(recommendation[field])) throw new Error('Finding approval changed the Reviewed Recommendation.'); });
  const sets = readFindingQualityRecords_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table).filter(function(record) { return String(record['Finding Set ID']) === String(finding['Finding Set ID']) && String(record.Version) === String(finding['Finding Set Version']); });
  if (sets.length !== 1 || String(sets[0]['Review Status']) !== 'Draft' || String(sets[0]['Approval Status']) !== 'Not Reviewed' || String(sets[0]['Document Eligibility']) !== 'Not Eligible') throw new Error('Finding approval changed Finding Set authority.');
  if (readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table).some(function(record) { return String(record['Prospect ID']) === String(finding['Prospect ID']); })) throw new Error('Finding approval found a prohibited Action side effect.');
}
