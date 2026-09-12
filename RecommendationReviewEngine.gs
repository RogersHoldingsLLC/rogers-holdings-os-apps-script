/** Transactional human review of one selected Draft Recommendation. */
var FQ_RECOMMENDATION_REVIEW_CONFIRMATION = 'REVIEW RECOMMENDATION';
var FQ_RECOMMENDATION_REVIEW_OPERATION_PREFIX = 'FQRECOMMENDATIONREVIEW';
var FQ_RECOMMENDATION_REVIEW_FIELDS = ['Reviewed By', 'Reviewed At', 'Review Operation Key'];

function markSelectedRecommendationReviewed() {
  const selected = requireSelectedDraftRecommendation_();
  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.prompt('Mark Selected Recommendation Reviewed', 'Type ' + FQ_RECOMMENDATION_REVIEW_CONFIRMATION + ' exactly. Only the Recommendation review fields will change.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== FQ_RECOMMENDATION_REVIEW_CONFIRMATION) throw new Error('Recommendation review cancelled.');
  const result = markFindingQualityRecommendationReviewed_(selected, {});
  ui.alert('Recommendation Review', result.status === 'already-completed' ? 'This Recommendation was already reviewed by this verified operation. No records changed.' : 'The selected Recommendation is now Reviewed. The Finding and Finding Set were not changed.', ui.ButtonSet.OK);
  return result;
}

function requireSelectedDraftRecommendation_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_RECOMMENDATIONS_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) throw new Error('Select exactly one data row on ' + FQ_RECOMMENDATIONS_SHEET + '.');
  const schema = getFindingQualityRecommendationReviewSchema_(ss);
  const entry = schema[FQ_RECOMMENDATIONS_SHEET];
  const row = range.getRow();
  if (row > sheet.getLastRow()) throw new Error('Select exactly one data row on ' + FQ_RECOMMENDATIONS_SHEET + '.');
  const record = findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, entry.table.lastColumn).getValues()[0], entry.table);
  if (!String(record['Recommendation ID'] || '').trim() || !String(record['Prospect ID'] || '').trim()) throw new Error('The selected Recommendation requires exact Recommendation ID and Prospect ID values.');
  return { ss: ss, sheet: sheet, table: entry.table, row: row, record: record };
}

function markFindingQualityRecommendationReviewed_(selected, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return markFindingQualityRecommendationReviewedLocked_(selected, hooks || {}); }
  finally { lock.releaseLock(); }
}

function markFindingQualityRecommendationReviewedLocked_(selected, hooks) {
  const schema = getFindingQualityRecommendationReviewSchema_(selected.ss);
  const entry = schema[FQ_RECOMMENDATIONS_SHEET];
  const matches = readFindingQualityRecordsWithRows_(entry).filter(function(record) { return String(record['Recommendation ID']) === String(selected.record['Recommendation ID']); });
  if (matches.length !== 1 || String(matches[0]['Prospect ID']) !== String(selected.record['Prospect ID'])) throw new Error('The selected Recommendation is missing, ambiguous, or changed.');
  const recommendation = matches[0];
  const findings = readFindingQualityRecordsWithRows_(schema[FQ_FINDINGS_SHEET]).filter(function(record) { return String(record['Finding ID']) === String(recommendation['Finding ID']); });
  if (findings.length !== 1) throw new Error('The linked Finding is missing or ambiguous.');
  const finding = findings[0];
  if (String(finding['Recommendation ID']) !== String(recommendation['Recommendation ID'])) throw new Error('The Finding does not link to the selected Recommendation.');
  const authority = resolveRecommendationDraftAuthority_(schema, finding);
  const candidate = normalizeRecommendationDraftCandidate_({ title: recommendation.Title, recommendedAction: recommendation['Recommended Action'], implementationLocation: recommendation['Implementation Location'], intendedOutcome: recommendation['Intended Outcome'], dependencies: recommendation.Dependencies, limitations: recommendation.Limitations });
  if (typeof assertRecommendationSeedIdentity_ === 'function') assertRecommendationSeedIdentity_(schema, finding, recommendation, authority, candidate);
  else {
    const identity = buildRecommendationDraftOperationIdentity_(finding, authority, candidate);
    if (identity.recommendationId !== String(recommendation['Recommendation ID']) || identity.operationKey !== String(recommendation['Operation Key'])) throw new Error('Recommendation content or operation authority changed after Draft creation.');
  }
  const reviewOperationKey = [FQ_RECOMMENDATION_REVIEW_OPERATION_PREFIX, recommendation['Recommendation ID'], fingerprintFindingQualityText_(recommendation['Operation Key']).slice(0, 16)].join(':');
  if (String(recommendation['Review Status']) === 'Reviewed') {
    assertCompletedRecommendationReview_(schema, recommendation, reviewOperationKey);
    return { ok: true, status: 'already-completed', recommendationId: recommendation['Recommendation ID'], operationKey: reviewOperationKey };
  }
  if (String(recommendation['Review Status']) !== 'Draft') throw new Error('Recommendation review requires a Draft Recommendation.');
  if (FQ_RECOMMENDATION_REVIEW_FIELDS.some(function(field) { return String(recommendation[field] || '').trim(); })) throw new Error('Draft Recommendation contains unexpected review lifecycle values.');
  const reviewer = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!reviewer) throw new Error('Authenticated reviewer identity is required.');
  const before = entry.sheet.getRange(recommendation._row, 1, 1, entry.table.lastColumn).getValues()[0];
  const validationRange = entry.sheet.getRange(2, entry.table.headers['Review Status'], Math.max(entry.sheet.getMaxRows() - 1, 1), 1);
  const priorValidationRules = validationRange.getDataValidations();
  const reviewedValidation = buildRecommendationReviewValidationRule_();
  assertRecommendationReviewValidationRule_(reviewedValidation, FQ_RECOMMENDATION_REVIEW_STATES);
  const installed = [];
  try {
    assertRecommendationReviewValidationMigrationIsSafe_(priorValidationRules);
    validationRange.setDataValidation(reviewedValidation);
    assertRecommendationReviewValidationRange_(validationRange, FQ_RECOMMENDATION_REVIEW_STATES);
    if (hooks.afterValidationMigration) hooks.afterValidationMigration();
    entry.missingReviewHeaders.forEach(function(header) { entry.sheet.getRange(1, entry.table.headers[header]).setValue(header); installed.push(header); });
    const updated = Object.assign({}, recommendation, { 'Review Status': 'Reviewed', 'Reviewed By': reviewer, 'Reviewed At': new Date(), 'Review Operation Key': reviewOperationKey });
    delete updated._row;
    writeFindingQualityRecord_(entry.sheet, entry.table, recommendation._row, updated);
    if (hooks.afterWrite) hooks.afterWrite(updated);
    assertExactRecommendationReviewReadback_(schema, recommendation, updated, reviewOperationKey);
    return { ok: true, status: 'completed', recommendationId: recommendation['Recommendation ID'], operationKey: reviewOperationKey, reviewedBy: reviewer };
  } catch (error) {
    try {
      entry.sheet.getRange(recommendation._row, 1, 1, entry.table.lastColumn).setValues([before]);
      validationRange.setDataValidations(priorValidationRules);
      installed.reverse().forEach(function(header) {
        const column = entry.table.headers[header];
        const values = entry.sheet.getRange(2, column, Math.max(entry.sheet.getLastRow() - 1, 1), 1).getDisplayValues();
        if (values.some(function(row) { return String(row[0] || '').trim(); })) throw new Error(header + ' cannot be rolled back because data now exists.');
        entry.sheet.getRange(1, column).clearContent();
      });
      SpreadsheetApp.flush();
    } catch (rollbackError) { throw new Error('Recommendation review failed and rollback could not be verified: ' + rollbackError.message); }
    throw error;
  }
}

function getFindingQualityRecommendationReviewSchema_(ss) {
  const definitions = [[FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS], [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS], [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS], [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS], [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS], [FQ_ACTIONS_SHEET, FQ_ACTION_COLUMNS], [FQ_FINDING_SETS_SHEET, FQ_FINDING_SET_COLUMNS]];
  const schema = {};
  definitions.forEach(function(definition) {
    const sheet = ss.getSheetByName(definition[0]);
    if (!sheet) throw new Error('Recommendation review requires normalized sheet "' + definition[0] + '".');
    if (definition[0] !== FQ_RECOMMENDATIONS_SHEET) {
      schema[definition[0]] = { sheet: sheet, table: getHeaderTable_(sheet, definition[1]), missingReviewHeaders: [] };
      return;
    }
    const existingLastColumn = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, existingLastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
    const missingReviewHeaders = [];
    const headerMap = {};
    definition[1].forEach(function(header) {
      const positions = headers.map(function(value, index) { return value === header ? index + 1 : 0; }).filter(Boolean);
      if (positions.length > 1) throw new Error('Recommendation review schema has an ambiguous header: ' + header + '.');
      if (!positions.length) {
        if (FQ_RECOMMENDATION_REVIEW_FIELDS.indexOf(header) === -1) throw new Error('Recommendation review schema is missing required header: ' + header + '.');
        missingReviewHeaders.push(header);
        return;
      }
      headerMap[header] = positions[0];
    });
    missingReviewHeaders.forEach(function(header, index) { headerMap[header] = existingLastColumn + index + 1; });
    schema[definition[0]] = { sheet: sheet, table: { headerRow: 1, headers: headerMap, lastColumn: existingLastColumn + missingReviewHeaders.length }, missingReviewHeaders: missingReviewHeaders };
  });
  return schema;
}

function assertExactRecommendationReviewReadback_(schema, before, expected, operationKey) {
  const matches = findFindingQualityRows_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, 'Recommendation ID', before['Recommendation ID']);
  if (matches.length !== 1) throw new Error('Recommendation review exact readback is missing or ambiguous.');
  const actual = matches[0];
  FQ_RECOMMENDATION_COLUMNS.forEach(function(field) {
    const expectedValue = expected[field];
    if (findingQualityDateText_(actual[field]) !== findingQualityDateText_(expectedValue)) throw new Error('Recommendation review readback differs at ' + field + '.');
  });
  if (String(actual['Review Operation Key']) !== operationKey) throw new Error('Recommendation review operation key did not persist.');
  const entry = schema[FQ_RECOMMENDATIONS_SHEET];
  assertRecommendationReviewValidationRange_(entry.sheet.getRange(2, entry.table.headers['Review Status'], Math.max(entry.sheet.getMaxRows() - 1, 1), 1), FQ_RECOMMENDATION_REVIEW_STATES);
  assertRecommendationReviewHasNoSideEffects_(schema, before);
}

function assertCompletedRecommendationReview_(schema, recommendation, operationKey) {
  if (String(recommendation['Review Operation Key']) !== operationKey || !String(recommendation['Reviewed By'] || '').trim() || !String(recommendation['Reviewed At'] || '').trim()) throw new Error('Reviewed Recommendation does not match the completed review operation.');
  const entry = schema[FQ_RECOMMENDATIONS_SHEET];
  assertRecommendationReviewValidationRange_(entry.sheet.getRange(2, entry.table.headers['Review Status'], Math.max(entry.sheet.getMaxRows() - 1, 1), 1), FQ_RECOMMENDATION_REVIEW_STATES);
  assertRecommendationReviewHasNoSideEffects_(schema, recommendation);
}

function buildRecommendationReviewValidationRule_() {
  return SpreadsheetApp.newDataValidation().requireValueInList(FQ_RECOMMENDATION_REVIEW_STATES, true).setAllowInvalid(false).build();
}

function recommendationReviewValidationValues_(rule) {
  if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST || rule.getAllowInvalid()) throw new Error('Recommendation Review Status validation must be a strict dropdown list.');
  const values = rule.getCriteriaValues();
  return [].concat(values && values[0] || []).map(function(value) { return String(value); });
}

function assertRecommendationReviewValidationRule_(rule, expected) {
  if (stableStringifyFindingQuality_(recommendationReviewValidationValues_(rule)) !== stableStringifyFindingQuality_(expected)) throw new Error('Recommendation Review Status validation differs from the authoritative lifecycle vocabulary.');
}

function assertRecommendationReviewValidationMigrationIsSafe_(rules) {
  const legacy = FQ_RECOMMENDATION_REVIEW_STATES.filter(function(value) { return value !== 'Reviewed'; });
  rules.forEach(function(row) { row.forEach(function(rule) {
    const values = recommendationReviewValidationValues_(rule);
    const signature = stableStringifyFindingQuality_(values);
    if (signature !== stableStringifyFindingQuality_(legacy) && signature !== stableStringifyFindingQuality_(FQ_RECOMMENDATION_REVIEW_STATES)) throw new Error('Recommendation Review Status validation contains an unsupported contract.');
  }); });
}

function assertRecommendationReviewValidationRange_(range, expected) {
  const rules = range.getDataValidations();
  rules.forEach(function(row) { row.forEach(function(rule) { assertRecommendationReviewValidationRule_(rule, expected); }); });
}

function assertRecommendationReviewHasNoSideEffects_(schema, recommendation) {
  if (readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table).some(function(record) { return String(record['Prospect ID']) === String(recommendation['Prospect ID']); })) throw new Error('Recommendation review found a prohibited Action side effect.');
  const findings = readFindingQualityRecords_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table).filter(function(record) { return String(record['Finding ID']) === String(recommendation['Finding ID']); });
  if (findings.length !== 1 || String(findings[0]['Finding State']) !== 'In Review' || String(findings[0]['Approval Status']) !== 'In Review') throw new Error('Recommendation review changed Finding lifecycle authority.');
  const sets = readFindingQualityRecords_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table).filter(function(record) { return String(record['Finding Set ID']) === String(recommendation['Finding Set ID']) && String(record.Version) === String(recommendation['Finding Set Version']); });
  if (sets.length !== 1 || String(sets[0]['Review Status']) !== 'Draft' || String(sets[0]['Approval Status']) !== 'Not Reviewed' || String(sets[0]['Document Eligibility']) !== 'Not Eligible') throw new Error('Recommendation review changed Finding Set lifecycle authority.');
}
