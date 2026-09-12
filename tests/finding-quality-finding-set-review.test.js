const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8');
const menu = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');

function harness() {
  const c = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite,
    SpreadsheetApp: { flush() {}, DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' } }
  });
  vm.runInContext(source, c, { filename: 'FindingQualityEngine.gs' });
  const set = {
    'Finding Set ID': 'FSET-a2ae86fa62d97824', 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1',
    'Review Status': 'Draft', 'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible',
    'Finding IDs': 'FND-0aff56a349dd3d12', 'Return Operation Key': 'FQSETRETURN:key',
    'Return Reason': 'Plain-language correction required before immutable Finding Set approval.',
    'Previous Review Submitted By': 'brian', 'Previous Review Submitted At': 'before',
    'Returned By': 'brian', 'Returned At': 'after'
  };
  const rows = [Object.assign({}, set)];
  const table = { headerRow: 1, headers: Object.fromEntries(c.FQ_FINDING_SET_COLUMNS.map((field, index) => [field, index + 1])), lastColumn: c.FQ_FINDING_SET_COLUMNS.length };
  const sheet = {
    getMaxRows: () => 200,
    getRange(row) { return {
      getValues: () => [c.FQ_FINDING_SET_COLUMNS.map(field => rows[row - 2][field] || '')],
      setValues: values => { rows[row - 2] = Object.fromEntries(c.FQ_FINDING_SET_COLUMNS.map((field, index) => [field, values[0][index]])); }
    }; }
  };
  const actionSheet = {};
  const ss = { getSheetByName: name => name === c.FQ_ACTIONS_SHEET ? actionSheet : null };
  c.getHeaderTable_ = target => target === sheet ? table : { headers: {}, lastColumn: c.FQ_ACTION_COLUMNS.length };
  c.readFindingQualityRecordsWithRows_ = () => rows.map((row, index) => Object.assign({}, row, { _row: index + 2 }));
  c.readFindingQualityRecords_ = () => [];
  c.readFindingQualityRecord_ = (_sheet, _table, row) => Object.assign({}, rows[row - 2]);
  c.writeFindingQualityRecord_ = (_sheet, _table, row, record) => { const clean = Object.assign({}, record); delete clean._row; rows[row - 2] = clean; };
  c.requireHumanReviewer_ = () => 'Brian@Example.test';
  c.assertReturnedFindingSet_ = () => {};
  c.assertFindingSetTransition_ = () => {};
  c.loadFindingQualityApprovalBundle_ = () => ({ findings: [{}] });
  c.validateFindingSetSuccessorApprovalAuthority_ = () => ({ recommendations: [{}], actions: [] });
  c.assertPlainLanguageFindingSetForApproval_ = () => {};
  c.assertFindingSetReviewEntryDropdowns_ = () => {};
  c.findingQualityDateText_ = value => value instanceof Date ? value.toISOString() : String(value || '');
  return { c, rows, selected: { ss, sheet, table, row: 2, record: Object.assign({}, set) } };
}

test('review entry changes only current Finding Set review-cycle fields', () => {
  const h = harness(), before = Object.assign({}, h.rows[0]);
  const result = h.c.transitionSelectedFindingSetToReviewLocked_(h.selected, {}), after = h.rows[0];
  assert.equal(result.status, 'completed');
  assert.equal(after['Review Status'], 'In Review');
  assert.equal(after['Approval Status'], 'In Review');
  assert.equal(after['Reviewed By'], 'brian@example.test');
  assert.ok(after['Reviewed At'] instanceof Date);
  assert.equal(after['Document Eligibility'], 'Not Eligible');
  h.c.FQ_FINDING_SET_COLUMNS.filter(field => !['Review Status', 'Approval Status', 'Reviewed By', 'Reviewed At'].includes(field)).forEach(field => assert.equal(String(after[field] || ''), String(before[field] || ''), field));
});

test('review entry exact retry is verified and writes nothing', () => {
  const h = harness(); h.c.transitionSelectedFindingSetToReviewLocked_(h.selected, {});
  const before = JSON.stringify(h.rows), result = h.c.transitionSelectedFindingSetToReviewLocked_(h.selected, {});
  assert.equal(result.status, 'already-completed');
  assert.equal(JSON.stringify(h.rows), before);
});

test('review entry rolls back its exact row after a partial failure', () => {
  const h = harness(), before = Object.assign({}, h.rows[0]);
  assert.throws(() => h.c.transitionSelectedFindingSetToReviewLocked_(h.selected, { afterWrite() { throw new Error('injected'); } }), /injected/);
  h.c.FQ_FINDING_SET_COLUMNS.forEach(field => assert.equal(String(h.rows[0][field] || ''), String(before[field] || ''), field));
});

test('menu path is locked, authority-complete, side-effect free, and production isolated', () => {
  assert.match(menu, /Move Selected Finding Set to Review', 'moveSelectedFindingSetToReview/);
  assert.match(source, /transitionSelectedFindingSetToReviewTransactional_[\s\S]*getDocumentLock\(\)[\s\S]*transitionSelectedFindingSetToReviewLocked_/);
  assert.match(source, /validateFindingSetSuccessorApprovalAuthority_[\s\S]*assertPlainLanguageFindingSetForApproval_/);
  assert.match(source, /assertExactFindingSetReviewEntryReadback_/);
  assert.doesNotMatch(source.slice(source.indexOf('function transitionSelectedFindingSetToReviewTransactional_'), source.indexOf('function assertFindingSetRecommendationSeedAuthority_')), /createFile|appendFindingQualityRecord_|Gmail|UrlFetch|generate.*Pdf|Activity Feed|1aoOL0|FQ-2/i);
});
