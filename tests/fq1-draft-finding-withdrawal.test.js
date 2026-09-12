const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const fqSource = fs.readFileSync(path.join(root, 'FindingQualityEngine.gs'), 'utf8');
const successorSource = fs.readFileSync(path.join(root, 'DraftSuccessorEngine.gs'), 'utf8');
const withdrawalSource = fs.readFileSync(path.join(root, 'DraftFindingWithdrawalEngine.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');

function load(snapshotPayloads = {}) {
  const context = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(v => v > 127 ? v - 256 : v) },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    SpreadsheetApp: { flush() {} }, LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: { getFileById: id => ({ getBlob: () => ({ getDataAsString: () => JSON.stringify(snapshotPayloads[id]) }) }) }
  });
  vm.runInContext(fqSource, context, { filename: 'FindingQualityEngine.gs' });
  vm.runInContext(successorSource, context, { filename: 'DraftSuccessorEngine.gs' });
  vm.runInContext(withdrawalSource, context, { filename: 'DraftFindingWithdrawalEngine.gs' });
  return context;
}

function harness(options = {}) {
  const c = load(options.snapshots || { 'SNAP-V1': { findings: [{ findingId: 'FND-V1' }] } });
  const sheets = {};
  function entry(name, records) {
    const sheet = { name, records, getLastRow: () => records.length + 1, getDataRange: () => ({ getDisplayValues: () => records.map(Object.values) }) };
    const value = { sheet, table: { headers: {}, lastColumn: 1 } };
    sheets[name] = value;
    return value;
  }
  const finding = Object.assign({ 'Finding ID': 'FND-ORPHAN', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '2', 'Finding State': 'Draft', 'Recommendation ID': 'REC-ORPHAN', 'Reviewed By': '', 'Reviewed At': '', 'Approval Status': 'Not Reviewed', 'Approved Version': '', 'Validation Codes': '' }, options.finding || {});
  entry(c.FQ_FINDINGS_SHEET, [
    { 'Finding ID': 'FND-V1', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '1', 'Finding State': 'Actionable', 'Recommendation ID': 'REC-V1', 'Approval Status': 'Approved for Client' },
    finding,
    { 'Finding ID': 'FND-VALID-1-V2', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '2', 'Finding State': 'Draft', 'Recommendation ID': 'REC-V2', 'Approval Status': 'Not Reviewed' }
  ]);
  entry(c.FQ_FINDING_SETS_SHEET, [
    { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '1', 'Finding IDs': 'FND-V1', 'Snapshot File ID': 'SNAP-V1', 'Approval Status': 'Approved for Client' },
    { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '2', 'Finding IDs': options.referenceOrphan ? 'FND-ORPHAN' : 'FND-VALID-1-V2', 'Approval Status': 'Not Reviewed' }
  ]);
  entry(c.FQ_RECOMMENDATIONS_SHEET, options.children ? [{ 'Recommendation ID': 'REC-ORPHAN', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '2', 'Finding ID': 'FND-ORPHAN', 'Review Status': options.childStatus || 'Draft', 'Operation Key': 'seed-key' }] : []);
  entry(c.FQ_ACTIONS_SHEET, options.children ? [{ 'Action ID': 'ACT-ORPHAN', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '2', 'Recommendation ID': 'REC-ORPHAN', 'Review Status': options.childStatus || 'Draft', 'Operation Key': 'seed-key' }] : []);
  entry(c.FQ_CONTEXT_SHEET, []); entry(c.FQ_PRESENCE_SHEET, []); entry(c.FQ_EVIDENCE_SHEET, [{ 'Evidence ID': 'EVID-WEB-1', value: 'unchanged' }]);
  const activity = { name: 'Activity Feed', records: [], getLastRow: () => 1, getDataRange: () => ({ getDisplayValues: () => [] }) };
  const ss = { getSheetByName: name => name === 'Activity Feed' ? activity : sheets[name] && sheets[name].sheet };
  c.getExistingFindingQualityDraftSuccessorSchema_ = () => sheets;
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { sheet.records[row - 2] = Object.assign({}, record); };
  const selected = { ss, sheet: sheets[c.FQ_FINDINGS_SHEET].sheet, table: sheets[c.FQ_FINDINGS_SHEET].table, row: 3, record: Object.assign({}, finding) };
  return { c, sheets, selected };
}

test('safe withdrawal retains history and leaves v1 and evidence unchanged', () => {
  const h = harness();
  const v1 = JSON.stringify(h.sheets[h.c.FQ_FINDINGS_SHEET].sheet.records[0]);
  const evidence = JSON.stringify(h.sheets[h.c.FQ_EVIDENCE_SHEET].sheet.records);
  const result = h.c.withdrawUnreferencedDraftFindingLocked_(h.selected, {});
  assert.equal(result.status, 'completed');
  const withdrawn = h.sheets[h.c.FQ_FINDINGS_SHEET].sheet.records[1];
  assert.equal(withdrawn['Finding State'], 'Withdrawn');
  assert.equal(withdrawn['Approval Status'], 'Withdrawn');
  assert.match(withdrawn['Validation Codes'], /FQ_WITHDRAWAL_OPERATION=FQWITHDRAW:PROS-1:FSET-1:2:FND-ORPHAN/);
  assert.equal(JSON.stringify(h.sheets[h.c.FQ_FINDINGS_SHEET].sheet.records[0]), v1);
  assert.equal(JSON.stringify(h.sheets[h.c.FQ_EVIDENCE_SHEET].sheet.records), evidence);
  assert.equal(h.c.withdrawUnreferencedDraftFindingLocked_(Object.assign({}, h.selected, { record: withdrawn }), {}).status, 'already-completed');
});

test('referenced and protected intended findings fail closed', () => {
  const referenced = harness({ referenceOrphan: true });
  assert.throws(() => referenced.c.withdrawUnreferencedDraftFindingLocked_(referenced.selected, {}), /Referenced findings/);
  const protectedFinding = harness();
  protectedFinding.selected.row = 4;
  protectedFinding.selected.record = Object.assign({}, protectedFinding.sheets[protectedFinding.c.FQ_FINDINGS_SHEET].sheet.records[2]);
  assert.throws(() => protectedFinding.c.withdrawUnreferencedDraftFindingLocked_(protectedFinding.selected, {}), /Referenced findings/);
});

test('reviewed and approved findings cannot be withdrawn', () => {
  for (const finding of [
    { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Reviewed By': 'brian@example.test', 'Reviewed At': new Date() },
    { 'Finding State': 'Actionable', 'Approval Status': 'Approved for Client', 'Reviewed By': 'brian@example.test', 'Reviewed At': new Date(), 'Approved Version': '2' }
  ]) {
    const h = harness({ finding });
    assert.throws(() => h.c.withdrawUnreferencedDraftFindingLocked_(h.selected, {}), /Only an unreviewed Draft/);
  }
});

test('exclusive Draft children withdraw transactionally while shared or reviewed children fail closed', () => {
  const h = harness({ children: true });
  h.c.withdrawUnreferencedDraftFindingLocked_(h.selected, {});
  assert.equal(h.sheets[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]['Review Status'], 'Withdrawn');
  assert.equal(h.sheets[h.c.FQ_ACTIONS_SHEET].sheet.records[0]['Review Status'], 'Withdrawn');
  const reviewed = harness({ children: true, childStatus: 'In Review' });
  assert.throws(() => reviewed.c.withdrawUnreferencedDraftFindingLocked_(reviewed.selected, {}), /exclusively owned Draft/);
  const shared = harness({ children: true });
  shared.sheets[shared.c.FQ_FINDINGS_SHEET].sheet.records.push({ 'Finding ID': 'OTHER', 'Recommendation ID': 'REC-ORPHAN' });
  assert.throws(() => shared.c.withdrawUnreferencedDraftFindingLocked_(shared.selected, {}), /Shared recommendation/);
});

test('partial failure restores every operation-owned row', () => {
  const h = harness({ children: true });
  const before = JSON.stringify({ findings: h.sheets[h.c.FQ_FINDINGS_SHEET].sheet.records, recommendations: h.sheets[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records, actions: h.sheets[h.c.FQ_ACTIONS_SHEET].sheet.records });
  assert.throws(() => h.c.withdrawUnreferencedDraftFindingLocked_(h.selected, { afterWrite: count => { if (count === 2) throw new Error('injected'); } }), /injected/);
  assert.equal(JSON.stringify({ findings: h.sheets[h.c.FQ_FINDINGS_SHEET].sheet.records, recommendations: h.sheets[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records, actions: h.sheets[h.c.FQ_ACTIONS_SHEET].sheet.records }), before);
});

test('withdrawal boundary excludes generation, approval, production, and FQ-2', () => {
  assert.match(menuSource, /Withdraw Selected Unreferenced Draft Finding/);
  assert.match(withdrawalSource, /WITHDRAW ORPHAN DRAFT/);
  assert.doesNotMatch(withdrawalSource, /generate|preview|pdf|approveSelected|FQ-2|clasp|production/i);
  assert.match(fqSource, /Finding Set cannot reference a withdrawn finding/);
  assert.match(fqSource, /\['Rejected', 'Withdrawn'\]/);
});
