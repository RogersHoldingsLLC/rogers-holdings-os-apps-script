const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }
  getRow() { return this.row; }
  getNumRows() { return this.rowCount; }
  getNumColumns() { return this.columnCount; }
  getValues() {
    return Array.from({ length: this.rowCount }, (_, r) =>
      Array.from({ length: this.columnCount }, (_, c) => this.sheet.valueAt(this.row + r, this.column + c))
    );
  }
  getDisplayValues() { return this.getValues().map(row => row.map(value => value == null ? '' : String(value))); }
  getValue() { return this.sheet.valueAt(this.row, this.column); }
  setValue(value) { this.sheet.setValueAt(this.row, this.column, value); return this; }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => this.sheet.setValueAt(this.row + r, this.column + c, value)));
    return this;
  }
}

class MockSheet {
  constructor(name, headers, rows = []) {
    this.name = name;
    this.rows = [headers.slice(), ...rows.map(row => row.slice())];
    this.activeRange = new MockRange(this, 2, 1);
    this.writeLog = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0].length; }
  getMaxRows() { return 1000; }
  getMaxColumns() { return this.getLastColumn(); }
  getRange(row, column, rowCount, columnCount) { return new MockRange(this, row, column, rowCount, columnCount); }
  getActiveRange() { return this.activeRange; }
  setActiveRange(range) { this.activeRange = range; return range; }
  valueAt(row, column) { return (this.rows[row - 1] || [])[column - 1] ?? ''; }
  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push(new Array(this.getLastColumn()).fill(''));
    while (this.rows[row - 1].length < this.getLastColumn()) this.rows[row - 1].push('');
    this.rows[row - 1][column - 1] = value;
    this.writeLog.push({ row, column, value });
  }
  getParent() { return this.parent || null; }
}

class MockSpreadsheet {
  constructor(sheets, activeName = 'Follow-Ups') {
    this.sheets = Object.fromEntries(sheets.map(sheet => [sheet.getName(), sheet]));
    sheets.forEach(sheet => { sheet.parent = this; });
    this.activeSheet = this.sheets[activeName];
  }
  getActiveSheet() { return this.activeSheet; }
  getSheetByName(name) { return this.sheets[name] || null; }
  setActiveSheet(sheet) { this.activeSheet = sheet; return sheet; }
}

const FOLLOW_HEADERS = [
  'Follow-Up ID', 'Company', 'Contact', 'Email', 'Related Prospect ID', 'Related Client ID',
  'Current Status', 'Follow-Up Type', 'Due Date', 'Days Until Due', 'Priority', 'Assigned To',
  'Notes', 'Completed', 'Completed Date'
];
const PROSPECT_HEADERS = ['Company', 'Prospect ID', 'Status', 'Next Action', 'Follow-Up Date', 'Offer / Service'];
const CLIENT_HEADERS = ['Company', 'Client Name', 'Client ID', 'Status'];
const ACTIVITY_HEADERS = ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Next Action', 'Follow-Up Date', 'Prospect ID', 'Operation Key'];

function row(headers, values) { return headers.map(header => values[header] ?? ''); }

function makeHarness(options = {}) {
  const followRows = options.followRows || [
    row(FOLLOW_HEADERS, {
      'Follow-Up ID': 'FU-1', Company: 'Acme', Contact: 'Alex', Email: 'alex@acme.example',
      'Related Prospect ID': 'PROS-1', 'Current Status': 'Lead Found', 'Follow-Up Type': 'Executive Brief',
      'Due Date': new Date('2026-08-09T12:00:00Z'), Priority: 'A - Hot', 'Assigned To': 'Brian',
      Notes: 'Generate Executive Brief.', Completed: false
    }),
    row(FOLLOW_HEADERS, {
      'Follow-Up ID': 'FU-2', Company: 'Acme', 'Related Prospect ID': 'PROS-1',
      'Follow-Up Type': 'Discovery Meeting', Completed: false
    })
  ];
  const prospects = new MockSheet('Master Prospect Tracker', PROSPECT_HEADERS, options.prospectRows || [
    row(PROSPECT_HEADERS, { Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Generate Executive Brief' })
  ]);
  const clients = new MockSheet('Clients', CLIENT_HEADERS, options.clientRows || [
    row(CLIENT_HEADERS, { Company: 'Beta', 'Client Name': 'Beta', 'Client ID': 'CLI-1', Status: 'Active' })
  ]);
  const activities = new MockSheet('Activity Feed', ACTIVITY_HEADERS, options.activityRows || []);
  const followUps = new MockSheet('Follow-Ups', FOLLOW_HEADERS, followRows);
  const sheets = [followUps, prospects, clients, activities];
  if (options.workspaceClientId !== undefined) {
    const workspace = new MockSheet('Client Workspace', ['Label', 'Value'], [
      ['', ''],
      ['', ''],
      ['Client ID', options.workspaceClientId]
    ]);
    sheets.push(workspace);
  }
  const spreadsheet = new MockSpreadsheet(sheets, options.activeName || 'Follow-Ups');
  followUps.activeRange = new MockRange(followUps, options.selectedRow || 2, 1);
  prospects.activeRange = new MockRange(prospects, options.prospectSelectedRow || 2, 1);

  const calls = { prospectWorkspace: 0, clientWorkspace: 0, dashboard: 0, gmail: 0, calendar: 0, drive: 0, dialogs: 0 };
  const ui = {
    Button: { YES: 'YES', NO: 'NO', OK: 'OK' },
    ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' },
    alert(title, message, buttonSet) {
      if (title === 'Sync Prospect Next Action' && buttonSet === 'YES_NO') {
        if (typeof options.afterSyncPreview === 'function') options.afterSyncPreview({ followUps, prospects, activities });
        return options.confirmSynchronization ? 'YES' : 'NO';
      }
      return options.openAfterCompletion ? 'YES' : 'NO';
    },
    showModalDialog() { calls.dialogs += 1; }
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ui },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
    Utilities: { formatDate: date => new Date(date).toISOString().slice(0, 10) },
    Session: { getScriptTimeZone: () => 'America/New_York' }
  });
  ['Config.gs', 'BusinessSnapshotIntake.gs', 'SheetHelpers.gs'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  context.openProspectWorkspace = () => { calls.prospectWorkspace += 1; };
  context.openClientWorkspace = () => { calls.clientWorkspace += 1; };
  context.refreshExecutiveDashboard = () => { calls.dashboard += 1; };
  context.createOutreachGmailDraft = () => { calls.gmail += 1; };
  context.createDiscoveryCall = () => { calls.calendar += 1; };
  context.generateAuditPackage = () => { calls.drive += 1; };
  return { context, calls, spreadsheet, followUps, prospects, clients, activities };
}

test('prospect-linked Follow-Up opens the exact prospect', () => {
  const h = makeHarness();
  const related = h.context.openSelectedFollowUpRelatedRecord();
  assert.equal(related.type, 'Prospect');
  assert.equal(related.rowNumber, 2);
  assert.equal(h.spreadsheet.getActiveSheet().getName(), 'Master Prospect Tracker');
  assert.equal(h.calls.prospectWorkspace, 1);
});

test('client-linked Follow-Up selects the exact client and opens an already-correlated Client Workspace without refresh', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, {
    'Follow-Up ID': 'FU-C', Company: 'Beta', 'Related Client ID': 'CLI-1', 'Follow-Up Type': 'Client Welcome Task', Completed: false
  })], workspaceClientId: 'CLI-1' });
  const related = h.context.openSelectedFollowUpRelatedRecord();
  assert.equal(related.type, 'Client');
  assert.equal(related.rowNumber, 2);
  assert.equal(h.clients.getActiveRange().getRow(), 2);
  assert.equal(h.spreadsheet.getActiveSheet().getName(), 'Client Workspace');
  assert.equal(h.calls.clientWorkspace, 0);
});

test('client-linked Follow-Up leaves the exact client selected when Client Workspace is stale', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, {
    'Follow-Up ID': 'FU-C', Company: 'Beta', 'Related Client ID': 'CLI-1', Completed: false
  })], workspaceClientId: 'CLI-OTHER' });
  const related = h.context.openSelectedFollowUpRelatedRecord();
  assert.equal(related.type, 'Client');
  assert.equal(h.spreadsheet.getActiveSheet().getName(), 'Clients');
  assert.equal(h.clients.getActiveRange().getRow(), 2);
  assert.equal(h.calls.clientWorkspace, 0);
});

test('legacy unique-company fallback works', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-L', Company: 'Acme', Completed: false })] });
  const related = h.context.openSelectedFollowUpRelatedRecord();
  assert.equal(related.type, 'Prospect');
  assert.equal(related.rowNumber, 2);
});

test('missing linkage fails closed', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-X', Company: 'Missing', Completed: false })] });
  assert.equal(h.context.openSelectedFollowUpRelatedRecord(), null);
  assert.equal(h.spreadsheet.getActiveSheet().getName(), 'Follow-Ups');
});

test('duplicate legacy company fallback fails closed', () => {
  const h = makeHarness({
    followRows: [row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-L', Company: 'Acme', Completed: false })],
    clientRows: [row(CLIENT_HEADERS, { Company: 'Acme', 'Client Name': 'Acme', Status: 'Active' })]
  });
  assert.equal(h.context.openSelectedFollowUpRelatedRecord(), null);
  assert.equal(h.spreadsheet.getActiveSheet().getName(), 'Follow-Ups');
});

test('missing Follow-Up ID fails closed', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, { Company: 'Acme', 'Related Prospect ID': 'PROS-1' })] });
  assert.throws(() => h.context.getSelectedFollowUpContext_(), /missing Follow-Up ID/);
});

test('duplicate Follow-Up ID fails closed', () => {
  const duplicate = row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-1', Company: 'Acme', 'Related Prospect ID': 'PROS-1' });
  const h = makeHarness({ followRows: [duplicate, duplicate] });
  assert.throws(() => h.context.getSelectedFollowUpContext_(), /duplicated/);
});

test('ambiguous prospect and client linkage fails closed', () => {
  const h = makeHarness({ followRows: [row(FOLLOW_HEADERS, {
    'Follow-Up ID': 'FU-A', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Related Client ID': 'CLI-1'
  })] });
  assert.throws(() => h.context.getSelectedFollowUpContext_(), /ambiguous linkage/);
});

test('controlled completion changes only completion fields and appends one correlated Activity', () => {
  const h = makeHarness();
  const beforeSibling = h.followUps.rows[2].slice();
  const beforeProspect = h.prospects.rows[1].slice();
  const result = h.context.completeSelectedFollowUpControlled();
  assert.equal(result.completed, true);
  assert.equal(result.activityAppended, true);
  assert.equal(result.operationKey, 'FOLLOWUP:FU-1:COMPLETE');
  assert.equal(h.followUps.valueAt(2, 14), true);
  assert.ok(Number.isFinite(new Date(h.followUps.valueAt(2, 15)).getTime()));
  assert.deepEqual(h.followUps.rows[2], beforeSibling, 'sibling task unchanged and recoverable');
  assert.deepEqual(h.prospects.rows[1], beforeProspect, 'Status and Next Action unchanged');
  const changedColumns = h.followUps.writeLog.filter(write => write.row === 2).map(write => write.column);
  assert.deepEqual(changedColumns, [14, 15]);
  assert.equal(h.activities.getLastRow(), 2);
  assert.equal(h.activities.valueAt(2, 7), 'PROS-1');
  assert.equal(h.activities.valueAt(2, 8), 'FOLLOWUP:FU-1:COMPLETE');
});

test('completion retry is idempotent and does not duplicate Activity', () => {
  const h = makeHarness();
  const first = h.context.completeSelectedFollowUpControlled();
  const writesAfterFirst = h.followUps.writeLog.length;
  const second = h.context.completeSelectedFollowUpControlled();
  assert.equal(first.activityAppended, true);
  assert.equal(second.idempotent, true);
  assert.equal(second.activityAppended, false);
  assert.equal(h.activities.getLastRow(), 2);
  assert.equal(h.followUps.writeLog.length, writesAfterFirst);
});

test('recent Activity context returns newest five exact-Prospect records', () => {
  const activityRows = [];
  for (let index = 1; index <= 7; index += 1) {
    activityRows.push(row(ACTIVITY_HEADERS, {
      Date: new Date(`2026-08-${String(index).padStart(2, '0')}T12:00:00Z`), Company: 'Acme',
      'Activity Type': `Event ${index}`, 'Prospect ID': 'PROS-1', 'Operation Key': `OP-${index}`
    }));
  }
  activityRows.push(row(ACTIVITY_HEADERS, {
    Date: new Date('2026-08-09T12:00:00Z'), Company: 'Acme', 'Activity Type': 'Wrong prospect', 'Prospect ID': 'PROS-OTHER'
  }));
  const h = makeHarness({ activityRows });
  const selected = h.context.getSelectedFollowUpContext_();
  const recent = h.context.getRecentCorrelatedFollowUpActivity_(selected, 5);
  assert.deepEqual(Array.from(recent, item => item.activityType), ['Event 7', 'Event 6', 'Event 5', 'Event 4', 'Event 3']);
});

test('context review is read-only and invokes no external or generated-surface actions', () => {
  const h = makeHarness();
  const followBefore = h.followUps.rows.map(row => row.slice());
  const prospectBefore = h.prospects.rows.map(row => row.slice());
  const result = h.context.showSelectedFollowUpContext();
  assert.equal(result.prospect.status, 'Lead Found');
  assert.equal(result.prospect.nextAction, 'Generate Executive Brief');
  assert.deepEqual(h.followUps.rows, followBefore);
  assert.deepEqual(h.prospects.rows, prospectBefore);
  assert.deepEqual(h.calls, { prospectWorkspace: 0, clientWorkspace: 0, dashboard: 0, gmail: 0, calendar: 0, drive: 0, dialogs: 1 });
});

test('Phase 2A source has no Gmail, Calendar, Drive, Dashboard, Client Workspace, or intake calls', () => {
  const source = fs.readFileSync(path.join(ROOT, 'SheetHelpers.gs'), 'utf8');
  const start = source.indexOf('function getSelectedFollowUpContext_()');
  const end = source.indexOf('\nfunction completeFollowUp()', start);
  const phase2a = source.slice(start, end);
  assert.doesNotMatch(phase2a, /createOutreachGmailDraft|GmailApp|MailApp/);
  assert.doesNotMatch(phase2a, /createDiscoveryCall|CalendarApp/);
  assert.doesNotMatch(phase2a, /generateAuditPackage|DriveApp/);
  assert.doesNotMatch(phase2a, /refreshExecutiveDashboard|updatePipelineDashboardMetrics_/);
  assert.doesNotMatch(phase2a, /openClientWorkspace\s*\(|refreshClientWorkspace\s*\(/);
  assert.doesNotMatch(phase2a, /submitBusinessSnapshot|appendBusinessSnapshotFollowUp_/);
});

test('Phase 2B mapping targets exist in the canonical Next Action vocabulary', () => {
  const h = makeHarness();
  assert.doesNotThrow(() => h.context.assertFollowUpNextActionVocabulary_());
  assert.deepEqual(
    Array.from(new Set(Object.values(h.context.FOLLOW_UP_NEXT_ACTION_MAP))).sort(),
    ['Follow Up', 'Generate Executive Brief', 'Generate Improvement Plan', 'Schedule Discovery Meeting'].sort()
  );
});

test('synchronization resolves an exact Prospect ID from Master Prospect Tracker', () => {
  const h = makeHarness({ activeName: 'Master Prospect Tracker', confirmSynchronization: true });
  const result = h.context.syncProspectNextActionFromOpenFollowUps();
  assert.equal(result.changed, true);
  assert.equal(h.prospects.valueAt(2, 4), 'Generate Executive Brief');
  assert.equal(h.context.synchronizationDateKey_(h.prospects.valueAt(2, 5)), '2026-08-09');
});

test('missing Prospect ID fails closed', () => {
  const h = makeHarness({
    activeName: 'Master Prospect Tracker', confirmSynchronization: true,
    prospectRows: [row(PROSPECT_HEADERS, { Company: 'Acme', Status: 'Lead Found' })]
  });
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(h.prospects.writeLog.length, 0);
  assert.equal(h.activities.getLastRow(), 1);
});

test('duplicate Prospect ID fails closed', () => {
  const duplicated = row(PROSPECT_HEADERS, { Company: 'Acme 2', 'Prospect ID': 'PROS-1', Status: 'Lead Found' });
  const h = makeHarness({ activeName: 'Master Prospect Tracker', confirmSynchronization: true,
    prospectRows: [row(PROSPECT_HEADERS, { Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found' }), duplicated] });
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(h.prospects.writeLog.length, 0);
});

test('missing and duplicate eligible Follow-Up IDs fail closed', () => {
  const base = { Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Follow-Up', Completed: false };
  for (const followRows of [
    [row(FOLLOW_HEADERS, base)],
    [row(FOLLOW_HEADERS, { ...base, 'Follow-Up ID': 'FU-X' }), row(FOLLOW_HEADERS, { ...base, 'Follow-Up ID': 'FU-X' })]
  ]) {
    const h = makeHarness({ followRows, confirmSynchronization: true });
    assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
    assert.equal(h.prospects.writeLog.length, 0);
  }
});

test('eligible Follow-Up ID must be globally unique even when the duplicate belongs to another record', () => {
  const h = makeHarness({ confirmSynchronization: true, followRows: [
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-GLOBAL', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Follow-Up', Completed: false }),
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-GLOBAL', Company: 'Other', 'Related Prospect ID': 'PROS-OTHER', 'Follow-Up Type': 'Follow-Up', Completed: true })
  ] });
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(h.prospects.writeLog.length, 0);
});

test('completed, client-only, and legacy company-only Follow-Ups are ineligible', () => {
  const completed = row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-DONE', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Follow-Up', Completed: true });
  const h = makeHarness({ followRows: [completed], confirmSynchronization: true });
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  for (const values of [
    { 'Follow-Up ID': 'FU-C', Company: 'Beta', 'Related Client ID': 'CLI-1', 'Follow-Up Type': 'Client Welcome Task', Completed: false },
    { 'Follow-Up ID': 'FU-L', Company: 'Acme', 'Follow-Up Type': 'Follow-Up', Completed: false }
  ]) {
    const x = makeHarness({ followRows: [row(FOLLOW_HEADERS, values)], confirmSynchronization: true });
    assert.equal(x.context.syncProspectNextActionFromOpenFollowUps(), null);
    assert.equal(x.prospects.writeLog.length, 0);
  }
});

test('primary selection uses earliest date, lexical ID tie-break, then undated rows', () => {
  const followRows = [
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-Z', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Final Follow-Up', 'Due Date': new Date('2026-08-12T12:00:00Z'), Completed: false }),
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-B', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Discovery Meeting', 'Due Date': new Date('2026-08-10T12:00:00Z'), Completed: false }),
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-A', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Improvement Plan', 'Due Date': new Date('2026-08-10T12:00:00Z'), Completed: false }),
    row(FOLLOW_HEADERS, { 'Follow-Up ID': 'FU-0', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Follow-Up', Completed: false })
  ];
  const h = makeHarness({ followRows });
  const resolved = h.context.resolvePrimaryOpenFollowUpForProspect_(h.spreadsheet, 'PROS-1');
  assert.equal(resolved.primary.followUpId, 'FU-A');
  assert.deepEqual(Array.from(resolved.eligible, item => item.followUpId), ['FU-A', 'FU-B', 'FU-Z', 'FU-0']);
});

test('one open Follow-Up maps canonically and unsupported type fails closed', () => {
  const supported = makeHarness({ followRows: [row(FOLLOW_HEADERS, {
    'Follow-Up ID': 'FU-I', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Improvement Plan', Completed: false
  })] });
  assert.equal(supported.context.buildFollowUpSynchronizationState_(supported.spreadsheet, 'PROS-1').proposedNextAction, 'Generate Improvement Plan');
  const unsupported = makeHarness({ confirmSynchronization: true, followRows: [row(FOLLOW_HEADERS, {
    'Follow-Up ID': 'FU-U', Company: 'Acme', 'Related Prospect ID': 'PROS-1', 'Follow-Up Type': 'Call Somebody', Completed: false
  })] });
  assert.equal(unsupported.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(unsupported.prospects.writeLog.length, 0);
});

test('preview cancellation causes no mutation or Activity', () => {
  const h = makeHarness({ confirmSynchronization: false });
  const before = h.prospects.rows.map(values => values.slice());
  const result = h.context.syncProspectNextActionFromOpenFollowUps();
  assert.equal(result.cancelled, true);
  assert.deepEqual(h.prospects.rows, before);
  assert.equal(h.activities.getLastRow(), 1);
});

test('stale state after confirmation fails closed', () => {
  const h = makeHarness({ confirmSynchronization: true, afterSyncPreview: ({ followUps }) => {
    followUps.setValueAt(2, 9, new Date('2026-08-11T12:00:00Z'));
  } });
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(h.prospects.writeLog.length, 0);
  assert.equal(h.activities.getLastRow(), 1);
});

test('synchronization writes only Next Action and Follow-Up Date and preserves all task and lifecycle state', () => {
  const h = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Follow Up',
    'Follow-Up Date': new Date('2026-08-15T12:00:00Z'), 'Offer / Service': 'Business Snapshot'
  })] });
  const followBefore = h.followUps.rows.map(values => values.slice());
  const result = h.context.syncProspectNextActionFromOpenFollowUps();
  assert.equal(result.changed, true);
  assert.deepEqual(h.prospects.writeLog.map(write => write.column), [4, 5]);
  assert.equal(h.prospects.valueAt(2, 3), 'Lead Found');
  assert.equal(h.prospects.valueAt(2, 6), 'Business Snapshot');
  assert.deepEqual(h.followUps.rows, followBefore);
  assert.deepEqual(h.calls, { prospectWorkspace: 0, clientWorkspace: 0, dashboard: 0, gmail: 0, calendar: 0, drive: 0, dialogs: 0 });
});

test('material synchronization creates one deterministic correlated Activity and immediate retry is a no-op', () => {
  const h = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Follow Up'
  })] });
  const first = h.context.syncProspectNextActionFromOpenFollowUps();
  const second = h.context.syncProspectNextActionFromOpenFollowUps();
  assert.match(first.operationKey, /^FOLLOWUPSYNC:PROS-1:FU-1:[0-9A-F]{8}$/);
  assert.equal(second.changed, false);
  assert.equal(h.activities.getLastRow(), 2);
  assert.equal(h.activities.valueAt(2, 7), 'PROS-1');
  assert.equal(h.activities.valueAt(2, 8), first.operationKey);
  assert.match(h.activities.valueAt(2, 4), /FU-1.*Assigned To: Brian/);
});

test('one existing operation key reconciles and duplicate operation keys fail closed', () => {
  const h = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Follow Up'
  })] });
  const state = h.context.buildFollowUpSynchronizationState_(h.spreadsheet, 'PROS-1');
  const key = h.context.buildFollowUpSynchronizationOperationKey_(state);
  h.activities.rows.push(row(ACTIVITY_HEADERS, { 'Prospect ID': 'PROS-1', 'Operation Key': key }));
  const reconciled = h.context.syncProspectNextActionFromOpenFollowUps();
  assert.equal(reconciled.idempotent, true);
  assert.equal(h.activities.getLastRow(), 2);

  const d = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Follow Up'
  })] });
  const dState = d.context.buildFollowUpSynchronizationState_(d.spreadsheet, 'PROS-1');
  const dKey = d.context.buildFollowUpSynchronizationOperationKey_(dState);
  d.activities.rows.push(row(ACTIVITY_HEADERS, { 'Operation Key': dKey }), row(ACTIVITY_HEADERS, { 'Operation Key': dKey }));
  assert.equal(d.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(d.prospects.writeLog.length, 0);
});

test('Activity persistence failure restores prior Prospect fields', () => {
  const h = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Follow Up',
    'Follow-Up Date': new Date('2026-08-15T12:00:00Z')
  })] });
  const originalSet = h.activities.setValueAt.bind(h.activities);
  h.activities.setValueAt = function() { throw new Error('synthetic Activity failure'); };
  assert.equal(h.context.syncProspectNextActionFromOpenFollowUps(), null);
  assert.equal(h.prospects.valueAt(2, 4), 'Follow Up');
  assert.equal(h.context.synchronizationDateKey_(h.prospects.valueAt(2, 5)), '2026-08-15');
  h.activities.setValueAt = originalSet;
});

test('Business Snapshot boundary remains Lead Found and never infers Executive Brief Sent', () => {
  const h = makeHarness({ confirmSynchronization: true, prospectRows: [row(PROSPECT_HEADERS, {
    Company: 'Acme', 'Prospect ID': 'PROS-1', Status: 'Lead Found', 'Next Action': 'Generate Executive Brief', 'Offer / Service': 'Business Snapshot'
  })] });
  h.context.syncProspectNextActionFromOpenFollowUps();
  assert.equal(h.prospects.valueAt(2, 3), 'Lead Found');
  assert.equal(h.prospects.valueAt(2, 4), 'Generate Executive Brief');
  assert.equal(h.prospects.valueAt(2, 6), 'Business Snapshot');
});

test('Phase 2B source contains no prohibited service, refresh, lifecycle, intake, or Follow-Up writes', () => {
  const source = fs.readFileSync(path.join(ROOT, 'SheetHelpers.gs'), 'utf8');
  const start = source.indexOf('var FOLLOW_UP_NEXT_ACTION_MAP');
  const end = source.indexOf('\nfunction completeFollowUp()', start);
  const phase2b = source.slice(start, end);
  assert.doesNotMatch(phase2b, /GmailApp|MailApp|createOutreachGmailDraft/);
  assert.doesNotMatch(phase2b, /CalendarApp|createDiscoveryCall/);
  assert.doesNotMatch(phase2b, /DriveApp|generateAuditPackage/);
  assert.doesNotMatch(phase2b, /refreshExecutiveDashboard|updatePipelineDashboardMetrics_|refreshClientWorkspace/);
  assert.doesNotMatch(phase2b, /setProspectStatus|applyConfirmedProspectTransition|submitBusinessSnapshot|appendBusinessSnapshotFollowUp_/);
  assert.doesNotMatch(phase2b, /markFollowUpRowCompleted_|upsertOpenFollowUp_/);
});

test('Follow-Ups menu retains Phase 2A actions and adds Phase 2B synchronization', () => {
  const source = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
  for (const label of ['Review Selected Follow-Up', 'Open Related Record', 'Complete Selected Follow-Up', 'Sync Prospect Next Action from Open Follow-Ups']) {
    assert.match(source, new RegExp(label));
  }
});
