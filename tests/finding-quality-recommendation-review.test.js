const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const sourceFiles = ['FindingQualityEngine.gs', 'RecommendationReviewEngine.gs'];
const menuSource = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
const reviewSource = fs.readFileSync(path.join(ROOT, 'RecommendationReviewEngine.gs'), 'utf8');
const PROSPECT = 'PROS-AF21065CD5C8';
const FINDING = 'FND-24cd3f413759a988';
const SET = 'FSET-a2ae86fa62d97824';
const RECOMMENDATION = 'REC-f5bed865a14ef641';

function harness(options = {}) {
  function rule(values) { return { values: values.slice(), getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues() { return [this.values.slice()]; }, getAllowInvalid: () => false }; }
  const c = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Session: { getActiveUser: () => ({ getEmail: () => options.noReviewer ? '' : 'BrianKeith@RogersHoldingsLLC.com' }) },
    SpreadsheetApp: { flush() {}, DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' }, newDataValidation: () => { const state = { values: [] }; return { requireValueInList(values) { state.values = values.slice(); return this; }, setAllowInvalid() { return this; }, build() { return rule(state.values); } }; } }, LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  sourceFiles.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }));
  const recommendation = { 'Recommendation ID': RECOMMENDATION, 'Prospect ID': PROSPECT, 'Finding Set ID': SET, 'Finding Set Version': '1', 'Finding ID': FINDING, Title: 'Connect the Business Snapshot form to secure direct submission', 'Recommended Action': 'Connect the form to direct submission.', 'Implementation Location': 'Business Snapshot form submission workflow', 'Intended Outcome': 'Create a simpler lead path.', Dependencies: '', 'Review Status': options.status || 'Draft', 'Operation Key': 'FQRECOMMENDATIONDRAFT:seed', Limitations: 'Do not promise revenue, conversion rates, lead volume, or guaranteed results. Implementation and testing have not occurred.', 'Reviewed By': options.reviewedBy || '', 'Reviewed At': options.reviewedAt || '', 'Review Operation Key': options.reviewKey || '' };
  const finding = { 'Finding ID': FINDING, 'Prospect ID': PROSPECT, 'Finding Set ID': SET, 'Finding Set Version': '1', 'Finding State': options.findingState || 'In Review', 'Approval Status': options.findingState && options.findingState !== 'In Review' ? 'Not Reviewed' : 'In Review', 'Recommendation ID': RECOMMENDATION };
  const set = { 'Finding Set ID': SET, 'Prospect ID': PROSPECT, Version: '1', 'Review Status': 'Draft', 'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible' };
  const records = {};
  function entry(name, columns, rows) {
    const legacy = ['Draft', 'In Review', 'Needs Changes', 'Approved for Client', 'Withdrawn'];
    const state = { validationRules: Array.from({ length: 999 }, () => [rule(options.validationValues || legacy)]) };
    const sheet = { records: rows.map(r => Object.assign({}, r)), state, getLastRow() { return this.records.length + 1; }, getMaxRows() { return 1000; },
      getRange(row, column, rowCount) { return { setValue() {}, clearContent() {}, getDisplayValues: () => Array.from({ length: rowCount || 1 }, () => ['']), getValues: () => [columns.map(h => (sheet.records[row - 2] || {})[h] || '')], setValues: values => { sheet.records[row - 2] = Object.fromEntries(columns.map((h, i) => [h, values[0][i]])); } }; }
    };
    const originalGetRange = sheet.getRange;
    sheet.getRange = function(row, column, rowCount) {
      const range = originalGetRange.call(sheet, row, column, rowCount);
      if (column === columns.indexOf('Review Status') + 1 && row === 2) {
        range.getDataValidations = () => state.validationRules.map(r => r.slice());
        range.setDataValidation = validation => { state.validationRules = Array.from({ length: rowCount }, () => [validation]); };
        range.setDataValidations = rules => { state.validationRules = rules.map(r => r.slice()); };
      }
      return range;
    };
    records[name] = { sheet, table: { headerRow: 1, headers: Object.fromEntries(columns.map((h, i) => [h, i + 1])), lastColumn: columns.length }, missingReviewHeaders: options.missingHeaders || [] };
  }
  entry(c.FQ_RECOMMENDATIONS_SHEET, c.FQ_RECOMMENDATION_COLUMNS, options.duplicate ? [recommendation, Object.assign({}, recommendation)] : [recommendation]);
  entry(c.FQ_FINDINGS_SHEET, c.FQ_FINDING_COLUMNS, [finding]); entry(c.FQ_FINDING_SETS_SHEET, c.FQ_FINDING_SET_COLUMNS, [set]); entry(c.FQ_ACTIONS_SHEET, c.FQ_ACTION_COLUMNS, options.action ? [{ 'Prospect ID': PROSPECT }] : []);
  [c.FQ_CONTEXT_SHEET, c.FQ_PRESENCE_SHEET, c.FQ_EVIDENCE_SHEET].forEach(name => entry(name, name === c.FQ_CONTEXT_SHEET ? c.FQ_CONTEXT_COLUMNS : name === c.FQ_PRESENCE_SHEET ? c.FQ_PRESENCE_COLUMNS : c.FQ_EVIDENCE_COLUMNS, []));
  const realSchemaResolver = c.getFindingQualityRecommendationReviewSchema_;
  c.getFindingQualityRecommendationReviewSchema_ = () => records;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(r => Object.assign({}, r));
  c.readFindingQualityRecordsWithRows_ = e => e.sheet.records.map((r, i) => Object.assign({}, r, { _row: i + 2 }));
  c.findFindingQualityRows_ = (sheet, _table, header, value) => sheet.records.filter(r => String(r[header]) === String(value)).map(r => Object.assign({}, r));
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { const clean = Object.assign({}, record); delete clean._row; sheet.records[row - 2] = clean; };
  c.resolveRecommendationDraftAuthority_ = () => ({ context: {}, presence: {}, evidence: [{}, {}], set });
  c.normalizeRecommendationDraftCandidate_ = value => value;
  c.buildRecommendationDraftOperationIdentity_ = () => ({ recommendationId: RECOMMENDATION, operationKey: 'FQRECOMMENDATIONDRAFT:seed' });
  c.fingerprintFindingQualityText_ = () => '1234567890abcdef';
  c.findingQualityDateText_ = value => value instanceof Date ? value.toISOString() : String(value || '');
  const selected = { ss: {}, row: 2, record: Object.assign({}, recommendation) };
  return { c, records, selected, realSchemaResolver, recommendation: records[c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0] };
}

function canonicalState(value) {
  function normalize(item) {
    if (Array.isArray(item)) return item.map(normalize);
    if (!item || typeof item !== 'object') return item;
    return Object.keys(item).sort().reduce((out, key) => {
      const normalized = normalize(item[key]);
      if (normalized !== '') out[key] = normalized;
      return out;
    }, {});
  }
  return JSON.stringify(normalize(value));
}

test('clean review changes only normalized Recommendation lifecycle fields and creates no Action', () => {
  const h = harness(); const before = Object.assign({}, h.recommendation);
  const result = h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {});
  assert.equal(result.status, 'completed'); const after = h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0];
  assert.equal(after['Review Status'], 'Reviewed'); assert.equal(after['Reviewed By'], 'briankeith@rogersholdingsllc.com'); assert.ok(after['Reviewed At']); assert.match(after['Review Operation Key'], /^FQRECOMMENDATIONREVIEW:/);
  h.c.FQ_RECOMMENDATION_COLUMNS.filter(f => !['Review Status', 'Reviewed By', 'Reviewed At', 'Review Operation Key'].includes(f)).forEach(f => assert.equal(String(after[f] || ''), String(before[f] || ''), f));
  assert.equal(h.records[h.c.FQ_ACTIONS_SHEET].sheet.records.length, 0);
  assert.equal(JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.state.validationRules[0][0].values), JSON.stringify(Array.from(h.c.FQ_RECOMMENDATION_REVIEW_STATES)));
});

test('missing reviewer, duplicate Recommendation, changed authority, non-Draft status, and Action fail closed', () => {
  [{ noReviewer: true }, { duplicate: true }, { findingState: 'Draft' }, { status: 'Needs Changes' }, { action: true }].forEach(options => {
    const h = harness(options); const before = canonicalState(h.records);
    assert.throws(() => h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {})); assert.equal(canonicalState(h.records), before);
  });
  const h = harness(); h.c.buildRecommendationDraftOperationIdentity_ = () => ({ recommendationId: RECOMMENDATION, operationKey: 'changed' }); assert.throws(() => h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {}), /changed/);
});

test('K3 legacy validation failure is migrated before the write and rollback restores validation, row, and headers', () => {
  const h = harness({ missingHeaders: ['Reviewed By', 'Reviewed At', 'Review Operation Key'] }); const before = canonicalState(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]);
  const validationBefore = h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.state.validationRules[0][0].values.slice();
  assert.ok(!validationBefore.includes('Reviewed'));
  assert.throws(() => h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, { afterValidationMigration() { throw new Error('injected'); } }), /injected/);
  assert.equal(canonicalState(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]), before);
  assert.deepEqual(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.state.validationRules[0][0].values, validationBefore);
});

test('verified retry is idempotent', () => {
  const h = harness(); h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {}); const first = JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]);
  h.selected.record = Object.assign({}, h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]);
  const retry = h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {}); assert.equal(retry.status, 'already-completed'); assert.equal(JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]), first);
});

test('synthetic Recommendation is preserved and unsupported validation vocabulary fails closed', () => {
  const h = harness(); const synthetic = { 'Recommendation ID': 'REC-SYNTH', 'Prospect ID': 'FQ1-WEBGBP-001', 'Review Status': 'Draft' };
  h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.push(Object.assign({}, synthetic));
  h.c.markFindingQualityRecommendationReviewedLocked_(h.selected, {});
  assert.deepEqual(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[1], synthetic);
  const bad = harness({ validationValues: ['Draft', 'Bogus'] }); const before = canonicalState(bad.records);
  assert.throws(() => bad.c.markFindingQualityRecommendationReviewedLocked_(bad.selected, {}), /unsupported contract/); assert.equal(canonicalState(bad.records), before);
});

test('selected-row and schema logic support exact hidden/reordered headers and reject missing or ambiguous IDs', () => {
  const h = harness();
  const reordered = h.c.FQ_RECOMMENDATION_COLUMNS.filter(x => !h.c.FQ_RECOMMENDATION_REVIEW_FIELDS.includes(x)).reverse();
  const recommendationSheet = { getLastColumn: () => reordered.length, getRange: () => ({ getDisplayValues: () => [reordered] }) };
  const ss = { getSheetByName: name => name === h.c.FQ_RECOMMENDATIONS_SHEET ? recommendationSheet : {} };
  h.c.getHeaderTable_ = (_sheet, columns) => ({ headerRow: 1, headers: Object.fromEntries(columns.map((x, i) => [x, i + 1])), lastColumn: columns.length });
  const schema = h.realSchemaResolver(ss); const table = schema[h.c.FQ_RECOMMENDATIONS_SHEET].table;
  assert.equal(table.headers['Recommendation ID'], reordered.indexOf('Recommendation ID') + 1); assert.equal(schema[h.c.FQ_RECOMMENDATIONS_SHEET].missingReviewHeaders.length, 3);
  const duplicate = reordered.concat(['Recommendation ID']); recommendationSheet.getLastColumn = () => duplicate.length; recommendationSheet.getRange = () => ({ getDisplayValues: () => [duplicate] });
  assert.throws(() => h.realSchemaResolver(ss), /ambiguous header/);
  assert.match(reviewSource, /range\.getNumRows\(\) !== 1/); assert.match(reviewSource, /Recommendation ID.*Prospect ID/);
  assert.match(reviewSource, /resolveRecommendationDraftAuthority_/); assert.match(reviewSource, /buildRecommendationDraftOperationIdentity_/);
});

test('menu exposes review command and implementation has no approval, Action, document, production, or FQ-2 writes', () => {
  assert.match(menuSource, /Mark Selected Recommendation Reviewed', 'markSelectedRecommendationReviewed/);
  assert.match(reviewSource, /REVIEW RECOMMENDATION/);
  assert.doesNotMatch(reviewSource, /appendFindingQualityRecord_|approveFinding|generateExecutive|buildGoldStandard|Gmail|UrlFetch|1aoOL0|FQ-2/i);
});
