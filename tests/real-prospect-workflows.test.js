const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'RealProspectWorkflowEngine.gs'), 'utf8');
const intakeSource = fs.readFileSync(path.join(root, 'BusinessSnapshotIntake.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');

class Range {
  constructor(sheet, row, column, rows = 1, columns = 1) { Object.assign(this, { sheet, row, column, rows, columns }); }
  getValues() { return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => this.sheet.valueAt(this.row + r, this.column + c))); }
  getDisplayValues() { return this.getValues().map(row => row.map(value => value == null ? '' : String(value))); }
  setValues(values) { values.forEach((row, r) => row.forEach((value, c) => this.sheet.setAt(this.row + r, this.column + c, value))); return this; }
}

class Sheet {
  constructor(name, headers, records = []) { this.name = name; this.headers = headers.slice(); this.rows = [headers.slice(), ...records.map(record => headers.map(header => record[header] || ''))]; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.headers.length; }
  getRange(row, column, rows, columns) { return new Range(this, row, column, rows, columns); }
  getDataRange() { return new Range(this, 1, 1, this.rows.length, this.headers.length); }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  valueAt(row, column) { return (this.rows[row - 1] || [])[column - 1] ?? ''; }
  setAt(row, column, value) { while (this.rows.length < row) this.rows.push(new Array(this.headers.length).fill('')); this.rows[row - 1][column - 1] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value; }
}

function table(sheet, required = []) {
  const headers = Object.fromEntries(sheet.headers.map((header, index) => [header, index + 1]));
  for (const header of required) if (!headers[header]) throw new Error(`Missing ${header}`);
  return { headerRow: 1, headers, lastColumn: sheet.headers.length };
}

function orphanHarness(options = {}) {
  const headers = ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Next Action', 'Follow-Up Date', 'Prospect ID', 'Operation Key'];
  const orphan = { Date: '2026-08-16', Company: 'Rogers Holdings LLC', 'Activity Type': 'Prospect Validation Ready', 'Activity Notes': 'Required prospect information is ready.', 'Prospect ID': 'PROS-D790451BBB29', 'Operation Key': '' };
  const records = [orphan];
  if (options.duplicate) records.push(orphan);
  const activity = new Sheet('Activity Feed', headers, records);
  const referenced = options.referenced ? new Sheet('Master Prospect Tracker', ['Company', 'Prospect ID'], [{ Company: 'Rogers Holdings LLC', 'Prospect ID': 'PROS-D790451BBB29' }]) : null;
  const ss = { getSheetByName: name => name === 'Activity Feed' ? activity : name === 'Master Prospect Tracker' ? referenced : null };
  const context = vm.createContext({
    console, Date, JSON, Math, String, Array, Object,
    ACTIVITY_FEED_SHEET: 'Activity Feed', MASTER_PROSPECT_SHEET: 'Master Prospect Tracker', FOLLOW_UPS_SHEET: 'Follow-Ups', CLIENTS_SHEET: 'Clients', PROJECTS_SHEET: 'Projects',
    FQ_CONTEXT_SHEET: 'Assessment Business Context', FQ_PRESENCE_SHEET: 'Assessment Presence', FQ_EVIDENCE_SHEET: 'Assessment Evidence', FQ_FINDINGS_SHEET: 'Assessment Findings', FQ_FINDING_SETS_SHEET: 'Assessment Finding Sets', FQ_RECOMMENDATIONS_SHEET: 'Assessment Recommendations', FQ_ACTIONS_SHEET: 'Assessment Actions',
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    getRequiredSheet_: (_ss, name) => { const sheet = _ss.getSheetByName(name); if (!sheet) throw new Error(`Missing ${name}`); return sheet; },
    getHeaderTable_: table,
    getValueByHeader_: (values, headersMap, header) => values[headersMap[header] - 1],
    setIfHeader_: (values, headersMap, header, value) => { if (headersMap[header]) values[headersMap[header] - 1] = value; },
    literalizeBusinessSnapshotSheetRow_: values => values.slice(),
    businessSnapshotRowsEqual_: (left, right) => JSON.stringify(left) === JSON.stringify(right)
  });
  vm.runInContext(source, context, { filename: 'RealProspectWorkflowEngine.gs' });
  return { context, ss, activity, target: { company: 'Rogers Holdings LLC', activityType: 'Prospect Validation Ready', prospectId: 'PROS-D790451BBB29', operationKey: '' } };
}

test('unreferenced orphan is reconciled without changing history and retry is idempotent', () => {
  const h = orphanHarness();
  const before = JSON.stringify(h.activity.rows[1]);
  const first = h.context.reconcileOrphanProspectActivityLocked_(h.ss, h.target, {});
  assert.equal(first.status, 'completed');
  assert.equal(JSON.stringify(h.activity.rows[1]), before);
  assert.equal(h.activity.rows.length, 3);
  assert.match(String(h.activity.rows[2][7]), /^ORPHANRECON:PROS-D790451BBB29:/);
  assert.match(String(h.activity.rows[2][3]), /State: Reconciled/);
  assert.match(String(h.activity.rows[2][3]), /Reconciled by: brian@example\.test/);
  const retry = h.context.reconcileOrphanProspectActivityLocked_(h.ss, h.target, {});
  assert.equal(retry.status, 'already-completed');
  assert.equal(h.activity.rows.length, 3);
});

test('missing, duplicate, and referenced orphan records fail closed', () => {
  const missing = orphanHarness();
  missing.activity.rows.splice(1, 1);
  assert.throws(() => missing.context.reconcileOrphanProspectActivityLocked_(missing.ss, missing.target, {}), /missing or ambiguous/);
  const duplicate = orphanHarness({ duplicate: true });
  assert.throws(() => duplicate.context.reconcileOrphanProspectActivityLocked_(duplicate.ss, duplicate.target, {}), /missing or ambiguous/);
  const referenced = orphanHarness({ referenced: true });
  assert.throws(() => referenced.context.reconcileOrphanProspectActivityLocked_(referenced.ss, referenced.target, {}), /referenced in Master Prospect Tracker/);
});

test('orphan partial failure rolls back only the appended reconciliation row', () => {
  const h = orphanHarness();
  const before = JSON.stringify(h.activity.rows);
  assert.throws(() => h.context.reconcileOrphanProspectActivityLocked_(h.ss, h.target, { afterAppend() { throw new Error('injected'); } }), /injected/);
  assert.equal(JSON.stringify(h.activity.rows), before);
});

function creationHarness(options = {}) {
  const properties = new Map();
  let uuidCalls = 0;
  let ingestCalls = 0;
  const created = [];
  const spreadsheet = { getId: () => '1RLyIsWWalpA_rA6a-rCj3JbOFQMf8Su3MrJV4rKZ7-g' };
  const context = vm.createContext({
    console, Date, JSON, Math, String, Array, Object,
    BUSINESS_SNAPSHOT_SCHEMA_VERSION: 'business-snapshot.v1', BUSINESS_SNAPSHOT_OPERATION_PREFIX: 'INTAKE:',
    REAL_PROSPECT_PROTECTED_ORPHAN_ID: 'PROS-D790451BBB29',
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getDocumentProperties: () => ({ getProperty: key => properties.get(key) || '', setProperty: (key, value) => properties.set(key, value) }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map(value => value > 127 ? value - 256 : value),
      getUuid: () => { uuidCalls += 1; return '123e4567-e89b-42d3-a456-426614174000'; }
    },
    normalizeLookupKey_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    normalizeWebsiteKey_: value => String(value || '').toLowerCase().replace(/\/$/, ''),
    normalizeBusinessSnapshotSingleLine_: value => String(value || '').trim().replace(/\s+/g, ' '),
    normalizeBusinessSnapshotMultiline_: value => String(value || '').trim(),
    normalizeBusinessSnapshotInput_: value => Object.assign({}, value, { acceptedAt: new Date(value.acceptedAt) }),
    validateBusinessSnapshotInput_: value => { if (!value.fullName || !value.businessName || !value.email || value.primaryChallenge.length < 20 || value.consent !== 'business-snapshot-contact-consent-v1') throw new Error('invalid'); },
    ingestBusinessSnapshotWithOptions_: (submission, ingestOptions) => {
      ingestCalls += 1;
      if (options.partialFailure) { created.push('operation-owned'); created.pop(); throw new Error('simulated intake rollback'); }
      assert.equal(ingestOptions.realProspect, true);
      assert.equal(ingestOptions.verifiedSpreadsheet, spreadsheet);
      assert.equal(ingestOptions.requiredSpreadsheetId, spreadsheet.getId());
      return { retry: ingestCalls > 1, prospectId: options.protectedId ? 'PROS-D790451BBB29' : 'PROS-NEWREAL0001' };
    },
    getBusinessSnapshotSpreadsheet_: () => spreadsheet
  });
  vm.runInContext(source, context, { filename: 'RealProspectWorkflowEngine.gs' });
  context.assertRealProspectCreationReadback_ = (_ss, submission, result) => {
    assert.equal(submission.requestId, '123e4567-e89b-42d3-a456-426614174000');
    assert.ok(result.prospectId);
  };
  return { context, properties, created, spreadsheet, uuidCalls: () => uuidCalls, ingestCalls: () => ingestCalls };
}

const realInput = { fullName: 'Brian Keith Rogers', businessName: 'Rogers Holdings LLC', email: 'brian@rogersholdingsllc.com', phone: '', website: 'https://rogersholdingsllc.com/', primaryChallenge: 'Create a safe real-company pilot record.', consent: 'business-snapshot-contact-consent-v1' };
const collision = { websiteKey: 'https://rogersholdingsllc.com', syntheticProspectId: 'PROS-4E90F8669936', reviewedBy: 'brian@example.test' };

test('real prospect wrapper persists one request ID, delegates to intake, and reconciles exact retry', () => {
  const h = creationHarness();
  const first = h.context.createRealProspectTransactional_(realInput, collision, { verifiedSpreadsheet: h.spreadsheet });
  assert.equal(first.status, 'completed');
  assert.equal(first.operationKey, 'INTAKE:123e4567-e89b-42d3-a456-426614174000');
  const retry = h.context.createRealProspectTransactional_(realInput, collision, { verifiedSpreadsheet: h.spreadsheet });
  assert.equal(retry.status, 'already-completed');
  assert.equal(h.uuidCalls(), 1);
  assert.equal(h.ingestCalls(), 2);
  assert.equal(h.properties.size, 1);
});

test('real prospect partial intake failure leaves no operation-owned records and keeps retry identity', () => {
  const h = creationHarness({ partialFailure: true });
  assert.throws(() => h.context.createRealProspectTransactional_(realInput, collision, { verifiedSpreadsheet: h.spreadsheet }), /simulated intake rollback/);
  assert.deepEqual(h.created, []);
  assert.equal(h.uuidCalls(), 1);
  assert.equal(JSON.parse(Array.from(h.properties.values())[0]).status, 'pending');
});

test('protected orphan Prospect ID cannot be reused', () => {
  const h = creationHarness({ protectedId: true });
  assert.throws(() => h.context.createRealProspectTransactional_(realInput, collision, { verifiedSpreadsheet: h.spreadsheet }), /protected orphan Prospect ID/);
});

test('real prospect creation rejects a missing or mismatched bound workbook before intake', () => {
  const missing = creationHarness();
  assert.throws(() => missing.context.createRealProspectTransactional_(realInput, collision, {}), /bound acceptance workbook/);
  assert.equal(missing.ingestCalls(), 0);
  assert.equal(missing.properties.size, 0);
  const mismatch = creationHarness();
  assert.throws(() => mismatch.context.createRealProspectTransactional_(realInput, collision, { verifiedSpreadsheet: { getId: () => '1WRONG_ACCEPTANCE_WORKBOOK_ID_000' } }), /not available from this workbook/);
  assert.equal(mismatch.ingestCalls(), 0);
  assert.equal(mismatch.properties.size, 0);
});

test('menu, confirmation, synthetic collision, and isolation boundaries are explicit', () => {
  assert.match(menuSource, /Pipeline[\s\S]*Reconcile Orphan Prospect Activity[\s\S]*Create Real Prospect/);
  assert.match(source, /RECONCILE ORPHAN ACTIVITY/);
  assert.match(source, /CREATE REAL PROSPECT/);
  assert.match(source, /ALLOW SYNTHETIC WEBSITE COLLISION/);
  assert.match(intakeSource, /isRecognizedBusinessSnapshotSyntheticQaRow_/);
  assert.match(source, /ingestBusinessSnapshotWithOptions_/);
  assert.doesNotMatch(source, /generateExecutive|generateAudit|generateProposal|createSuccessor|approveSelected|clasp|1aoOL0|FQ-2/i);
});
