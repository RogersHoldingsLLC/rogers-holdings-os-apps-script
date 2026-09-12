const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'FindingApprovalEngine.gs'), 'utf8');
const menu = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
const PROSPECT = 'PROS-AF21065CD5C8', FINDING = 'FND-24cd3f413759a988', SET = 'FSET-a2ae86fa62d97824', REC = 'REC-f5bed865a14ef641';

function harness(options = {}) {
  function rule(values) { return { getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues: () => [values.slice()], getAllowInvalid: () => false }; }
  const c = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Session: { getActiveUser: () => ({ getEmail: () => 'BrianKeith@RogersHoldingsLLC.com' }) },
    SpreadsheetApp: { flush() {}, DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' } }, LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8'), c, { filename: 'FindingQualityEngine.gs' });
  vm.runInContext(source, c, { filename: 'FindingApprovalEngine.gs' });
  c.FQ_FINDING_DRAFT_CATEGORIES = ['Contact Path / Lead Capture'];
  const finding = { 'Finding ID': FINDING, 'Prospect ID': PROSPECT, 'Finding Set ID': SET, 'Finding Set Version': '1', Category: 'Contact Path / Lead Capture', 'Finding Title': 'Business Snapshot intake adds an email handoff', 'Finding State': options.findingState || 'In Review', Observation: options.altered ? 'Changed observation.' : 'The form prepares an email for the visitor to send.', 'Business Consequence': 'The extra step can make requests less dependable.', 'Evidence Confidence': 0.9, 'Evidence References': 'EVID-1, EVID-2', Limitations: 'No submission was performed.', 'Recommendation ID': options.badLink ? 'REC-OTHER' : REC, 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17', 'Approval Status': options.approval || 'In Review', 'Approved Version': '', 'Validation Codes': '', 'Approval Operation Key': options.approvalKey || '' };
  const recommendation = { 'Recommendation ID': REC, 'Prospect ID': PROSPECT, 'Finding Set ID': SET, 'Finding Set Version': '1', 'Finding ID': FINDING, Title: 'Connect direct submission', 'Recommended Action': 'Connect the form.', 'Implementation Location': 'Business Snapshot form', 'Intended Outcome': 'Create a simpler path.', Dependencies: '', 'Review Status': options.recStatus || 'Reviewed', 'Operation Key': 'FQRECOMMENDATIONDRAFT:seed', Limitations: 'No guarantees. Implementation and testing have not occurred.', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17', 'Review Operation Key': 'FQRECOMMENDATIONREVIEW:key' };
  const set = { 'Finding Set ID': SET, 'Prospect ID': PROSPECT, Version: '1', 'Review Status': 'Draft', 'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible' };
  const records = {};
  function entry(name, columns, rows, missing = []) {
    const state = { headerInstalled: missing.length === 0 };
    const sheet = { records: rows.map(r => Object.assign({}, r)), state, getLastRow() { return this.records.length + 1; }, getMaxRows: () => 200,
      getRange(row, column, rowCount) { return { setValue() { state.headerInstalled = true; }, clearContent() { state.headerInstalled = false; }, getDisplayValues: () => Array.from({ length: rowCount || 1 }, () => ['']), getDataValidations: () => Array.from({ length: rowCount || 1 }, () => [rule(column === columns.indexOf('Finding State') + 1 ? ['Draft', 'In Review', 'Actionable'] : ['Not Reviewed', 'In Review', 'Approved for Client'])]), getValues: () => [columns.map(h => (sheet.records[row - 2] || {})[h] || '')], setValues: values => { sheet.records[row - 2] = Object.fromEntries(columns.map((h, i) => [h, values[0][i]])); } }; }
    };
    records[name] = { sheet, table: { headerRow: 1, headers: Object.fromEntries(columns.map((h, i) => [h, i + 1])), lastColumn: columns.length }, missingApprovalHeaders: missing };
  }
  entry(c.FQ_FINDINGS_SHEET, c.FQ_FINDING_COLUMNS, options.duplicate ? [finding, Object.assign({}, finding)] : [finding, { 'Finding ID': 'FND-SYNTH', 'Prospect ID': 'FQ1-WEBGBP-001' }], options.missingHeader ? ['Approval Operation Key'] : []);
  entry(c.FQ_RECOMMENDATIONS_SHEET, c.FQ_RECOMMENDATION_COLUMNS, [recommendation, { 'Recommendation ID': 'REC-SYNTH', 'Prospect ID': 'FQ1-WEBGBP-001' }]);
  entry(c.FQ_FINDING_SETS_SHEET, c.FQ_FINDING_SET_COLUMNS, [set]); entry(c.FQ_ACTIONS_SHEET, c.FQ_ACTION_COLUMNS, options.action ? [{ 'Prospect ID': PROSPECT }] : []);
  [c.FQ_CONTEXT_SHEET, c.FQ_PRESENCE_SHEET, c.FQ_EVIDENCE_SHEET].forEach(name => entry(name, name === c.FQ_CONTEXT_SHEET ? c.FQ_CONTEXT_COLUMNS : name === c.FQ_PRESENCE_SHEET ? c.FQ_PRESENCE_COLUMNS : c.FQ_EVIDENCE_COLUMNS, []));
  const realSchema = c.getFindingQualityFindingApprovalSchema_;
  c.getFindingQualityFindingApprovalSchema_ = () => records;
  c.readFindingQualityRecordsWithRows_ = e => e.sheet.records.map((r, i) => Object.assign({}, r, { _row: i + 2 }));
  c.readFindingQualityRecords_ = sheet => sheet.records.map(r => Object.assign({}, r));
  c.findFindingQualityRows_ = (sheet, _table, header, value) => sheet.records.filter(r => String(r[header]) === String(value)).map(r => Object.assign({}, r));
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { const clean = Object.assign({}, record); delete clean._row; sheet.records[row - 2] = clean; };
  c.resolveRecommendationDraftAuthority_ = () => ({ context: {}, presence: {}, evidence: [{}, {}], set }); c.normalizeRecommendationDraftCandidate_ = x => x;
  c.buildRecommendationDraftOperationIdentity_ = () => ({ recommendationId: REC, operationKey: options.changedRecommendation ? 'changed' : 'FQRECOMMENDATIONDRAFT:seed' });
  c.validateAssessmentFindingRecord_ = record => options.invalidFinding || record.Observation === 'Changed observation.' ? ['INVALID'] : [];
  c.buildFindingApprovalOperationKey_ = () => 'FQFINDINGAPPROVAL:' + FINDING + ':0123456789abcdef';
  c.findingQualityDateText_ = value => value instanceof Date ? value.toISOString() : String(value || '');
  const selected = { ss: {}, row: 2, record: Object.assign({}, finding) };
  return { c, records, selected, realSchema };
}

test('clean transition approves only Finding lifecycle fields and preserves Recommendation, set, and fixtures', () => {
  const h = harness(); const before = Object.assign({}, h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0]); const recBefore = JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records); const synthBefore = JSON.stringify(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[1]);
  const result = h.c.approveFindingQualityFindingLocked_(h.selected, {}); const after = h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0];
  assert.equal(result.status, 'completed'); assert.equal(after['Finding State'], 'Actionable'); assert.equal(after['Approval Status'], 'Approved for Client'); assert.equal(after['Approved Version'], '1'); assert.match(after['Approval Operation Key'], /^FQFINDINGAPPROVAL:/);
  h.c.FQ_FINDING_COLUMNS.filter(f => !['Finding State', 'Approval Status', 'Approved Version', 'Reviewed By', 'Reviewed At', 'Validation Codes', 'Approval Operation Key'].includes(f)).forEach(f => assert.equal(String(after[f] || ''), String(before[f] || ''), f));
  assert.equal(JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records), recBefore); assert.equal(JSON.stringify(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[1]), synthBefore); assert.equal(h.records[h.c.FQ_ACTIONS_SHEET].sheet.records.length, 0);
});

test('Reviewed Recommendation, unchanged Finding/Recommendation authority, and unique selection are required', () => {
  [{ recStatus: 'Draft' }, { badLink: true }, { altered: true }, { changedRecommendation: true }, { duplicate: true }, { findingState: 'Draft' }, { action: true }].forEach(options => { const h = harness(options); const before = JSON.stringify(h.records); assert.throws(() => h.c.approveFindingQualityFindingLocked_(h.selected, {})); assert.equal(JSON.stringify(h.records), before); });
});

test('strict dropdowns are required and invalid target validation fails closed', () => {
  const h = harness(); h.records[h.c.FQ_FINDINGS_SHEET].sheet.getRange = () => ({ getDataValidations: () => [[null]] }); assert.throws(() => h.c.approveFindingQualityFindingLocked_(h.selected, {}), /strict dropdown/);
});

test('partial failure restores the exact Finding row and trailing header', () => {
  const h = harness({ missingHeader: true }); const before = h.c.FQ_FINDING_COLUMNS.map(field => String(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0][field] || '')); assert.throws(() => h.c.approveFindingQualityFindingLocked_(h.selected, { afterWrite() { throw new Error('injected'); } }), /injected/); const after = h.c.FQ_FINDING_COLUMNS.map(field => String(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0][field] || '')); assert.deepEqual(after, before); assert.equal(h.records[h.c.FQ_FINDINGS_SHEET].sheet.state.headerInstalled, false);
});

test('exact retry is idempotent', () => {
  const h = harness(); h.c.approveFindingQualityFindingLocked_(h.selected, {}); const first = JSON.stringify(h.records); h.selected.record = Object.assign({}, h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0]); const retry = h.c.approveFindingQualityFindingLocked_(h.selected, {}); assert.equal(retry.status, 'already-completed'); assert.equal(JSON.stringify(h.records), first);
});

test('schema resolver supports hidden/reordered exact headers and rejects ambiguity', () => {
  const h = harness(); const reordered = h.c.FQ_FINDING_COLUMNS.filter(x => x !== 'Approval Operation Key').reverse(); const findingSheet = { getLastColumn: () => reordered.length, getRange: () => ({ getDisplayValues: () => [reordered] }) }; const ss = { getSheetByName: name => name === h.c.FQ_FINDINGS_SHEET ? findingSheet : {} }; h.c.getHeaderTable_ = (_s, cols) => ({ headerRow: 1, headers: Object.fromEntries(cols.map((x, i) => [x, i + 1])), lastColumn: cols.length }); const schema = h.realSchema(ss); assert.equal(schema[h.c.FQ_FINDINGS_SHEET].table.headers['Finding ID'], reordered.indexOf('Finding ID') + 1); const duplicate = reordered.concat(['Finding ID']); findingSheet.getLastColumn = () => duplicate.length; findingSheet.getRange = () => ({ getDisplayValues: () => [duplicate] }); assert.throws(() => h.realSchema(ss), /ambiguous header/);
});

test('menu and source enforce the approval-only acceptance boundary', () => {
  assert.match(menu, /Approve Selected Finding for Client', 'approveSelectedFindingForClient/); assert.match(source, /APPROVE FINDING/); assert.match(source, /resolveRecommendationDraftAuthority_/); assert.doesNotMatch(source, /appendFindingQualityRecord_|approveSelectedFindingSet|generateExecutive|buildApprovedFindingSetSnapshot_|Gmail|UrlFetch|1aoOL0|FQ-2/i);
});

test('approval derives immutable Recommendation candidate through the creation canonicalizer', () => {
  assert.match(source, /normalizeRecommendationDraftCandidate_\(\{ title: recommendation\.Title/);
  assert.doesNotMatch(source, /normalizeRecommendationDraftCandidate_\(\{[^}]*Review Status|normalizeRecommendationDraftCandidate_\(\{[^}]*Reviewed By|normalizeRecommendationDraftCandidate_\(\{[^}]*Reviewed At|normalizeRecommendationDraftCandidate_\(\{[^}]*Review Operation Key/);
});
