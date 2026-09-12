const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

class Range {
  constructor(sheet, row, column, rows = 1, columns = 1) { Object.assign(this, { sheet, row, column, rows, columns }); }
  getRow() { return this.row; }
  getNumRows() { return this.rows; }
  getValues() { return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => this.sheet.valueAt(this.row + r, this.column + c))); }
  getDisplayValues() { return this.getValues().map(row => row.map(value => value == null ? '' : String(value))); }
}

class Sheet {
  constructor(headers, records) {
    this.name = 'Master Prospect Tracker';
    this.rows = [[], [], [], headers.slice(), ...records.map(record => headers.map(header => record[header] || ''))];
    this.activeRange = new Range(this, 5, 1);
    this.hiddenColumns = new Set();
  }
  getName() { return this.name; }
  getMaxRows() { return 999; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(...this.rows.map(row => row.length)); }
  getRange(row, column, rows, columns) { return new Range(this, row, column, rows, columns); }
  getActiveRange() { return this.activeRange; }
  valueAt(row, column) { return (this.rows[row - 1] || [])[column - 1] ?? ''; }
}

function harness(headers, records) {
  const sheet = new Sheet(headers, records);
  const ui = { ButtonSet: { OK: 'OK' }, alert() {} };
  const spreadsheet = { getActiveSheet: () => sheet, getSheetByName: name => name === sheet.name ? sheet : null };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ui },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }), getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
    Utilities: { formatDate: () => '2026-08-17', getUuid: () => 'fixture' },
    Session: { getScriptTimeZone: () => 'America/New_York', getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    BUSINESS_OPTIMIZATION_PLATFORM_THEME: { gold: '#b88728', black: '#05070a' }
  });
  for (const file of ['Config.gs', 'BusinessSnapshotIntake.gs', 'SheetHelpers.gs', 'FindingQualityEngine.gs']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  return { context, sheet };
}

const ID = 'PROS-AF21065CD5C8';

test('selected Finding Quality prospect resolves an exact ID through reordered and hidden columns', () => {
  const h = harness(['Status', 'Prospect ID', 'Company', 'Website'], [{ Company: 'Rogers Holdings LLC', 'Prospect ID': ID, Status: 'Lead Found' }]);
  h.sheet.hiddenColumns.add(2);
  const selected = h.context.requireSelectedFindingQualityProspect_();
  assert.equal(selected.selectedRow, 5);
  assert.equal(selected.prospectId, ID);
  assert.equal(selected.prospect.prospectId, ID);
  assert.equal(selected.table.headers['Prospect ID'], 2);
});

test('Prospect ID header matching is exact and duplicate required headers are rejected', () => {
  const near = harness(['Company', 'Prospect Id'], [{ Company: 'Rogers Holdings LLC', 'Prospect Id': ID }]);
  assert.throws(() => near.context.requireSelectedFindingQualityProspect_(), /Required headers not found/);
  const duplicate = harness(['Company', 'Prospect ID', 'Prospect ID'], [{ Company: 'Rogers Holdings LLC', 'Prospect ID': ID }]);
  assert.throws(() => duplicate.context.requireSelectedFindingQualityProspect_(), /headers are ambiguous/);
});

test('missing, duplicated, and multi-row Prospect selections fail closed before seeding', () => {
  const missing = harness(['Company', 'Prospect ID'], [{ Company: 'Rogers Holdings LLC', 'Prospect ID': '' }]);
  assert.throws(() => missing.context.requireSelectedFindingQualityProspect_(), /exact Prospect ID/);

  const duplicated = harness(['Company', 'Prospect ID'], [
    { Company: 'Rogers Holdings LLC', 'Prospect ID': ID },
    { Company: 'Duplicate', 'Prospect ID': ID }
  ]);
  assert.throws(() => duplicated.context.requireSelectedFindingQualityProspect_(), /missing or ambiguous/);

  const multi = harness(['Company', 'Prospect ID'], [{ Company: 'Rogers Holdings LLC', 'Prospect ID': ID }]);
  multi.sheet.activeRange = new Range(multi.sheet, 5, 1, 2, 1);
  assert.throws(() => multi.context.requireSelectedFindingQualityProspect_(), /Select exactly one/);
});

test('Business Context seeding performs selected Prospect ID preflight before schema mutation', () => {
  const source = fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8');
  const start = source.indexOf('function seedSelectedProspectBusinessContext()');
  const end = source.indexOf('\nfunction requireSelectedFindingQualityProspect_()', start);
  const body = source.slice(start, end);
  assert.ok(body.indexOf('requireSelectedFindingQualityProspect_()') < body.indexOf('ensureFindingQualitySchema_'));
});
