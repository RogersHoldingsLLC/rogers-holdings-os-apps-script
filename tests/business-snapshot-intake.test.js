const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

class MockRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount || 1;
    this.columnCount = columnCount || 1;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset)
      )
    );
  }

  getDisplayValues() {
    return this.getValues().map(row => row.map(value => value == null ? '' : String(value)));
  }

  getFormulas() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.formulaAt(this.row + rowOffset, this.column + columnOffset)
      )
    );
  }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        this.sheet.setInputAt(this.row + rowOffset, this.column + columnOffset, value);
      });
    });
    return this;
  }

  setValue(value) {
    this.sheet.setInputAt(this.row, this.column, value);
    return this;
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.column);
  }

  setBackground() { return this; }
  setFontColor() { return this; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}

class MockSheet {
  constructor(name, headers) {
    this.name = name;
    this.headers = headers.slice();
    this.rows = [headers.slice()];
    this.formulas = [new Array(headers.length).fill('')];
    this.failWrites = false;
    this.writeCount = 0;
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    let last = this.rows.length;
    while (last > 1 && !(this.rows[last - 1] || []).some(value => value !== '')) last -= 1;
    return last;
  }

  getLastColumn() {
    return this.headers.length;
  }

  getMaxColumns() {
    return this.headers.length;
  }

  getMaxRows() {
    return Math.max(this.rows.length, 100);
  }

  insertColumnsAfter(after, count) {
    for (let index = 0; index < count; index += 1) this.headers.push('');
    this.rows.forEach(row => {
      while (row.length < this.headers.length) row.push('');
    });
    this.formulas.forEach(row => {
      while (row.length < this.headers.length) row.push('');
    });
  }

  setFrozenRows() {}
  setTabColor() {}

  getRange(row, column, rowCount, columnCount) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }

  deleteRow(row) {
    this.rows.splice(row - 1, 1);
    this.formulas.splice(row - 1, 1);
  }

  valueAt(row, column) {
    return (this.rows[row - 1] || [])[column - 1] ?? '';
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push(new Array(this.headers.length).fill(''));
    while (this.formulas.length < row) this.formulas.push(new Array(this.headers.length).fill(''));
    while (this.rows[row - 1].length < this.headers.length) this.rows[row - 1].push('');
    while (this.formulas[row - 1].length < this.headers.length) this.formulas[row - 1].push('');
    this.rows[row - 1][column - 1] = value;
    this.formulas[row - 1][column - 1] = '';
  }

  setInputAt(row, column, value) {
    this.writeCount += 1;
    if (this.failWrites) throw new Error(`simulated ${this.name} write failure`);
    if (typeof value === 'string' && value.startsWith("'")) {
      this.setValueAt(row, column, value.slice(1));
      return;
    }
    if (typeof value === 'string' && value.startsWith('=')) {
      this.setValueAt(row, column, '#FORMULA!');
      this.formulas[row - 1][column - 1] = value;
      return;
    }
    this.setValueAt(row, column, value);
  }

  formulaAt(row, column) {
    return (this.formulas[row - 1] || [])[column - 1] ?? '';
  }
}

function headerTable(sheet, requiredHeaders) {
  const headers = Object.fromEntries(sheet.headers.map((header, index) => [header, index + 1]));
  const missing = (requiredHeaders || []).filter(header => !headers[header]);
  if (missing.length) throw new Error(`Missing headers: ${missing.join(', ')}`);
  return { headerRow: 1, headers, lastColumn: sheet.headers.length };
}

function validPayload(overrides = {}) {
  return {
    schemaVersion: 'business-snapshot.v1',
    requestId: '123e4567-e89b-42d3-a456-426614174000',
    fullName: 'Taylor Morgan',
    businessName: 'Morgan Services',
    email: 'Taylor@Example.com',
    phone: '859-555-0100',
    website: 'https://example.com',
    primaryChallenge: 'Lead follow-up needs a clear and consistent owner.',
    consent: 'business-snapshot-contact-consent-v1',
    acceptedAt: new Date().toISOString(),
    ...overrides
  };
}

function datePartsInTimeZone(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );
}

function formatDateKeyInTimeZone(date, timeZone) {
  const parts = datePartsInTimeZone(date, timeZone);
  return [parts.year, parts.month, parts.day]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
}

function parseDateKeyInTimeZone(dateKey, timeZone, DateConstructor) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetWallClockMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instantMs = targetWallClockMs;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = datePartsInTimeZone(new Date(instantMs), timeZone);
    const representedWallClockMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const nextInstantMs = instantMs + targetWallClockMs - representedWallClockMs;
    if (nextInstantMs === instantMs) break;
    instantMs = nextInstantMs;
  }
  return new DateConstructor(instantMs);
}

function createHarness(options = {}) {
  let currentTimeMs = options.nowMs === undefined ? Date.now() : options.nowMs;
  class HarnessDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [currentTimeMs]));
    }

    static now() {
      return currentTimeMs;
    }
  }
  const trackerHeaders = [
    'Company', 'Contact', 'Email', 'Phone', 'Website', 'Source', 'Audit Outcome',
    'Priority Tier', 'Audit Source', 'Status', 'Next Action', 'Last Activity',
    'Offer / Service', 'Moved to CRM', 'Notes', 'Prospect ID'
  ];
  const activityHeaders = [
    'Date', 'Company', 'Activity Type', 'Activity Notes', 'Next Action',
    'Follow-Up Date', 'Prospect ID', 'Operation Key'
  ];
  const followUpHeaders = [
    'Follow-Up ID', 'Company', 'Contact', 'Email', 'Related Prospect ID',
    'Related Client ID', 'Current Status', 'Follow-Up Type', 'Due Date',
    'Days Until Due', 'Priority', 'Assigned To', 'Notes', 'Completed', 'Completed Date'
  ];
  const sheets = {
    'Master Prospect Tracker': new MockSheet('Master Prospect Tracker', trackerHeaders),
    'Activity Feed': new MockSheet('Activity Feed', activityHeaders),
    'Follow-Ups': new MockSheet('Follow-Ups', followUpHeaders)
  };
  if (options.failTrackerWrite) sheets['Master Prospect Tracker'].failWrites = true;
  const spreadsheetTimeZone = options.spreadsheetTimeZone || 'America/Los_Angeles';
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    getSpreadsheetTimeZone: () => spreadsheetTimeZone
  };
  let released = false;
  let openByIdCalls = 0;
  let activeSpreadsheetCalls = 0;
  let lockTimeout;
  const formatDateCalls = [];
  const spreadsheetId = options.spreadsheetProperty === undefined
    ? '1AbCdEfGhIjKlMnOpQrStUvWxYz_123456789'
    : options.spreadsheetProperty;
  const context = {
    console,
    Date: HarnessDate,
    Math,
    isNaN,
    MASTER_PROSPECT_SHEET: 'Master Prospect Tracker',
    ACTIVITY_FEED_SHEET: 'Activity Feed',
    FOLLOW_UPS_SHEET: 'Follow-Ups',
    Utilities: {
      getUuid: () => {
        if (options.uuidValues && options.uuidValues.length) return options.uuidValues.shift();
        return 'abcdef12-3456-4789-abcd-ef1234567890';
      },
      formatDate: (date, timeZone, pattern) => {
        formatDateCalls.push({ timeZone, pattern });
        if (pattern === 'yyyy-MM-dd') return formatDateKeyInTimeZone(date, timeZone);
        if (pattern === 'yyyyMMddHHmmss') return '20260728183000';
        throw new Error(`unsupported test date pattern: ${pattern}`);
      },
      parseDate: (dateKey, timeZone, pattern) => {
        if (options.parseDateFailure) throw new Error('date parsing unavailable');
        assert.equal(pattern, 'yyyy-MM-dd');
        return parseDateKeyInTimeZone(dateKey, timeZone, HarnessDate);
      }
    },
    Session: { getScriptTimeZone: () => options.scriptTimeZone || 'America/New_York' },
    LockService: {
      getScriptLock: () => ({
        tryLock: timeout => {
          lockTimeout = timeout;
          if (options.lockThrows) throw new Error('lock service unavailable');
          return options.lockAcquired !== false;
        },
        releaseLock: () => {
          if (options.releaseThrows) throw new Error('unexpected release');
          released = true;
        }
      })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        activeSpreadsheetCalls += 1;
        throw new Error('active spreadsheet must not be used');
      },
      openById: id => {
        openByIdCalls += 1;
        if (options.openFailure) throw new Error('spreadsheet unavailable');
        assert.equal(id, spreadsheetId);
        return spreadsheet;
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => {
          if (options.propertyReadFailure) throw new Error('properties unavailable');
          if (key.startsWith('ROGERS_CONTACT_')) return 'Rogers Holdings';
          assert.equal(key, 'BOP_SPREADSHEET_ID');
          return spreadsheetId;
        }
      })
    },
    getRogersContactInfo_: () => ({ name: 'Rogers Holdings' })
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'SheetHelpers.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'ProspectRevenueWorkflow.js'), 'utf8'), context);
  context.ensureProspectRevenueWorkflowSchema_ = ss => ({
    prospectSheet: sheets['Master Prospect Tracker'],
    prospectTable: headerTable(sheets['Master Prospect Tracker']),
    activitySheet: sheets['Activity Feed'],
    activityTable: headerTable(sheets['Activity Feed'])
  });
  if (options.requiredSheetFailure) {
    context.getRequiredSheet_ = () => { throw new Error('simulated required sheet failure'); };
  }
  if (options.failFollowUp || options.failAfterFollowUp) {
    const realAppendFollowUp = context.appendBusinessSnapshotFollowUp_;
    context.appendBusinessSnapshotFollowUp_ = (...args) => {
      if (options.failFollowUp) throw new Error('simulated follow-up failure');
      const result = realAppendFollowUp(...args);
      if (options.failAfterFollowUp) throw new Error('simulated post-follow-up failure');
      return result;
    };
  }
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'BusinessSnapshotIntake.js'), 'utf8'),
    context,
    { filename: 'BusinessSnapshotIntake.js' }
  );
  return {
    context,
    sheets,
    spreadsheet,
    released: () => released,
    openByIdCalls: () => openByIdCalls,
    activeSpreadsheetCalls: () => activeSpreadsheetCalls,
    lockTimeout: () => lockTimeout,
    formatDateCalls: () => formatDateCalls.slice(),
    setNow: value => { currentTimeMs = value; }
  };
}

function errorCode(error) {
  return error && error.code;
}

function appendRow(sheet, valuesByHeader) {
  const table = headerTable(sheet);
  const row = new Array(table.lastColumn).fill('');
  Object.entries(valuesByHeader).forEach(([header, value]) => {
    row[table.headers[header] - 1] = value;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, table.lastColumn).setValues([row]);
}

test('creates canonical tracker, activity, and follow-up records', () => {
  const harness = createHarness();
  const result = harness.context.ingestBusinessSnapshot(validPayload());
  const trackerTable = headerTable(harness.sheets['Master Prospect Tracker']);
  assert.equal(result.submissionId, 'PROS-ABCDEF123456');
  assert.equal(result.retry, false);
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 8), 'D - Nurture');
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, trackerTable.headers['Audit Source']), 'Website Audit Tool API');
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 15), validPayload().primaryChallenge);
  assert.equal(harness.sheets['Activity Feed'].valueAt(2, 8), 'INTAKE:123e4567-e89b-42d3-a456-426614174000');
  assert.equal(harness.sheets['Follow-Ups'].valueAt(2, 8), 'Executive Brief');
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 11), 'Generate Executive Brief');
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 13), 'Business Snapshot');
  assert.equal(harness.released(), true);
  assert.equal(harness.activeSpreadsheetCalls(), 0);
  assert.equal(harness.openByIdCalls(), 1);
  assert.equal(harness.lockTimeout(), 30000);
});

test('normalizes the Business Snapshot transaction to the New York business date', () => {
  const now = Date.parse('2026-07-28T04:30:00.000Z');
  const harness = createHarness({
    nowMs: now,
    spreadsheetTimeZone: 'America/Los_Angeles',
    scriptTimeZone: 'Pacific/Honolulu'
  });
  harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt: new Date(now).toISOString() }));

  const tracker = harness.sheets['Master Prospect Tracker'];
  const activity = harness.sheets['Activity Feed'];
  const followUp = harness.sheets['Follow-Ups'];
  const trackerTable = headerTable(tracker);
  const activityTable = headerTable(activity);
  const followUpTable = headerTable(followUp);
  const dueDate = followUp.valueAt(2, followUpTable.headers['Due Date']);

  assert.equal(formatDateKeyInTimeZone(dueDate, 'America/Los_Angeles'), '2026-07-28');
  assert.equal(followUp.valueAt(2, followUpTable.headers['Days Until Due']), 0);
  assert.equal(tracker.valueAt(2, trackerTable.headers['Last Activity']).getTime(), now);
  assert.equal(activity.valueAt(2, activityTable.headers.Date).getTime(), now);
  assert.equal(activity.valueAt(3, activityTable.headers.Date).getTime(), now);
  assert.equal(tracker.getLastRow(), 2);
  assert.equal(activity.getLastRow(), 3);
  assert.equal(followUp.getLastRow(), 2);
});

test('Business Snapshot due date is independent of workbook and Apps Script project time zones', () => {
  const now = Date.parse('2026-07-28T04:30:00.000Z');
  for (const [spreadsheetTimeZone, scriptTimeZone] of [
    ['America/Los_Angeles', 'America/New_York'],
    ['UTC', 'Pacific/Honolulu'],
    ['Asia/Tokyo', 'Europe/London']
  ]) {
    const harness = createHarness({ nowMs: now, spreadsheetTimeZone, scriptTimeZone });
    harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt: new Date(now).toISOString() }));
    const followUp = harness.sheets['Follow-Ups'];
    const table = headerTable(followUp);
    const dueDate = followUp.valueAt(2, table.headers['Due Date']);
    assert.equal(formatDateKeyInTimeZone(dueDate, spreadsheetTimeZone), '2026-07-28');
    assert.equal(followUp.valueAt(2, table.headers['Days Until Due']), 0);
    assert.deepEqual(
      harness.formatDateCalls().map(call => call.timeZone),
      ['America/New_York', 'America/New_York']
    );
  }
});

test('Business Snapshot date boundary changes exactly at New York midnight', () => {
  for (const [instant, expectedDate] of [
    ['2026-07-28T03:59:59.999Z', '2026-07-27'],
    ['2026-07-28T04:00:00.000Z', '2026-07-28']
  ]) {
    const now = Date.parse(instant);
    const harness = createHarness({
      nowMs: now,
      spreadsheetTimeZone: 'America/Los_Angeles',
      scriptTimeZone: 'Asia/Tokyo'
    });
    harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt: instant }));
    const followUp = harness.sheets['Follow-Ups'];
    const table = headerTable(followUp);
    assert.equal(
      formatDateKeyInTimeZone(followUp.valueAt(2, table.headers['Due Date']), 'America/Los_Angeles'),
      expectedDate
    );
  }
});

test('Business Snapshot New York date normalization remains correct across DST transitions', () => {
  for (const [instant, expectedDate] of [
    ['2026-03-08T04:59:59.999Z', '2026-03-07'],
    ['2026-03-08T05:00:00.000Z', '2026-03-08'],
    ['2026-11-01T03:59:59.999Z', '2026-10-31'],
    ['2026-11-01T04:00:00.000Z', '2026-11-01']
  ]) {
    const now = Date.parse(instant);
    const harness = createHarness({
      nowMs: now,
      spreadsheetTimeZone: 'America/Los_Angeles',
      scriptTimeZone: 'UTC'
    });
    harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt: instant }));
    const followUp = harness.sheets['Follow-Ups'];
    const table = headerTable(followUp);
    assert.equal(
      formatDateKeyInTimeZone(followUp.valueAt(2, table.headers['Due Date']), 'America/Los_Angeles'),
      expectedDate
    );
  }
});

test('Business Snapshot Days Until Due uses calendar-date keys without elapsed-hour assumptions', () => {
  const harness = createHarness();
  const difference = harness.context.businessSnapshotCalendarDayDifference_;

  assert.equal(difference('2026-03-07', '2026-03-09'), 2);
  assert.equal(difference('2026-03-09', '2026-03-07'), -2);
  assert.equal(difference('2026-10-31', '2026-11-02'), 2);
  assert.equal(difference('2028-02-28', '2028-03-01'), 2);
  assert.equal(difference('2026-07-28', '2026-07-28'), 0);
  assert.throws(() => difference('2026-02-30', '2026-03-01'), /date key is invalid/);
});

test('timezone normalization changes only the newly appended Business Snapshot Follow-Up', () => {
  const now = Date.parse('2026-07-28T04:30:00.000Z');
  const harness = createHarness({ nowMs: now, spreadsheetTimeZone: 'America/Los_Angeles' });
  const existingDueDate = new Date('2026-01-15T08:00:00.000Z');
  appendRow(harness.sheets['Follow-Ups'], {
    'Follow-Up ID': 'FU-EXISTING-20260115000000-99999999',
    Company: 'Existing Company',
    'Related Prospect ID': 'PROS-EXISTING001',
    'Current Status': 'Lead Found',
    'Follow-Up Type': 'Executive Snapshot',
    'Due Date': existingDueDate,
    'Days Until Due': 194,
    Completed: false
  });
  const before = harness.sheets['Follow-Ups'].rows[1].slice();

  harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt: new Date(now).toISOString() }));

  assert.deepEqual(harness.sheets['Follow-Ups'].rows[1], before);
  assert.equal(harness.sheets['Follow-Ups'].valueAt(2, 9).getTime(), existingDueDate.getTime());
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 3);
});

test('invalid Business Snapshot date configuration fails before any transaction write', () => {
  for (const options of [
    { spreadsheetTimeZone: 'UTC', parseDateFailure: true },
    { spreadsheetTimeZone: ' ' }
  ]) {
    const harness = createHarness(options);
    if (options.spreadsheetTimeZone === ' ') {
      harness.spreadsheet.getSpreadsheetTimeZone = () => '';
    }
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload()),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_CONFIGURATION'
    );
    assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 1);
    assert.equal(harness.sheets['Activity Feed'].getLastRow(), 1);
    assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 1);
    assert.equal(
      Object.values(harness.sheets).reduce((total, sheet) => total + sheet.writeCount, 0),
      0
    );
  }
});

test('returns the existing Prospect ID for an idempotent retry', () => {
  const harness = createHarness();
  const first = harness.context.ingestBusinessSnapshot(validPayload());
  const second = harness.context.ingestBusinessSnapshot(validPayload());
  assert.equal(second.retry, true);
  assert.equal(second.submissionId, first.submissionId);
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 2);
  assert.equal(harness.sheets['Activity Feed'].getLastRow(), 3);
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 2);
});

test('retry requires the exact Prospect-ID Follow-Up to exist', () => {
  const harness = createHarness();
  harness.context.ingestBusinessSnapshot(validPayload());
  harness.sheets['Follow-Ups'].deleteRow(2);
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.matchCount === 0
  );
});

test('retry rejects a Follow-Up linked to a different Prospect ID', () => {
  const harness = createHarness();
  harness.context.ingestBusinessSnapshot(validPayload());
  const followUp = harness.sheets['Follow-Ups'];
  followUp.setValueAt(
    2,
    headerTable(followUp).headers['Related Prospect ID'],
    'PROS-DIFFERENT01'
  );
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.matchCount === 0
  );
});

test('retry rejects duplicate exact-Prospect-ID Follow-Ups', () => {
  const harness = createHarness();
  const first = harness.context.ingestBusinessSnapshot(validPayload());
  appendRow(harness.sheets['Follow-Ups'], {
    'Follow-Up ID': 'FU-DUPLICA-20260728183000-55555555',
    Company: 'Morgan Services',
    'Related Prospect ID': first.prospectId,
    'Current Status': 'Lead Found',
    'Follow-Up Type': 'Executive Snapshot',
    Completed: false
  });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.matchCount === 2
  );
});

test('returns the original Prospect ID for a retry older than seven days without new rows', () => {
  const initialNow = Date.parse('2026-07-28T18:30:00.000Z');
  const harness = createHarness({ nowMs: initialNow });
  const payload = validPayload({ acceptedAt: new Date(initialNow).toISOString() });
  const first = harness.context.ingestBusinessSnapshot(payload);
  const before = {
    tracker: harness.sheets['Master Prospect Tracker'].getLastRow(),
    activity: harness.sheets['Activity Feed'].getLastRow(),
    followUp: harness.sheets['Follow-Ups'].getLastRow()
  };

  harness.setNow(initialNow + 8 * 24 * 60 * 60 * 1000);
  const retry = harness.context.ingestBusinessSnapshot(payload);

  assert.equal(retry.retry, true);
  assert.equal(retry.prospectId, first.prospectId);
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), before.tracker);
  assert.equal(harness.sheets['Activity Feed'].getLastRow(), before.activity);
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), before.followUp);
});

test('rolls back tracker and intake activity when follow-up synchronization fails', () => {
  const harness = createHarness({ failFollowUp: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      error.diagnostics.phase === 'prospect creation' &&
      error.cause && /simulated follow-up failure/.test(error.cause.message)
  );
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 1);
  assert.equal(harness.sheets['Activity Feed'].getLastRow(), 1);
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 1);
  assert.equal(harness.released(), true);
});

test('compensates tracker, activity, and follow-up rows after a partial follow-up failure', () => {
  const harness = createHarness({ failAfterFollowUp: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      error.cause && /simulated post-follow-up failure/.test(error.cause.message)
  );
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 1);
  assert.equal(harness.sheets['Activity Feed'].getLastRow(), 1);
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 1);
});

test('rejects malformed request IDs before any write', () => {
  const harness = createHarness();
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload({ requestId: 'not-a-uuid' })),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_VALIDATION' && /UUID v4/.test(error.message)
  );
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 1);
});

test('runs as a standalone library without any active spreadsheet', () => {
  const harness = createHarness();
  assert.doesNotThrow(() => harness.context.ingestBusinessSnapshot(validPayload()));
  assert.equal(harness.activeSpreadsheetCalls(), 0);
  assert.equal(harness.openByIdCalls(), 1);
});

for (const spreadsheetProperty of [null, '', '   ']) {
  test(`rejects missing or blank spreadsheet property: ${JSON.stringify(spreadsheetProperty)}`, () => {
    const harness = createHarness({ spreadsheetProperty });
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload()),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_CONFIGURATION'
    );
    assert.equal(harness.openByIdCalls(), 0);
    assert.equal(harness.released(), true);
  });
}

test('rejects an invalid spreadsheet ID as configuration', () => {
  const harness = createHarness({ spreadsheetProperty: 'not an id' });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_CONFIGURATION'
  );
});

test('classifies workbook open failures as temporary and preserves the cause', () => {
  const harness = createHarness({ openFailure: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      error.cause && /spreadsheet unavailable/.test(error.cause.message) &&
      /Caused by:/.test(error.stack)
  );
  assert.equal(harness.released(), true);
});

test('classifies Script Properties read failures as configuration errors', () => {
  const harness = createHarness({ propertyReadFailure: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_CONFIGURATION'
  );
});

test('returns typed lock timeout and never releases an unacquired lock', () => {
  const harness = createHarness({ lockAcquired: false, releaseThrows: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_LOCK_TIMEOUT'
  );
  assert.equal(harness.released(), false);
  assert.equal(harness.openByIdCalls(), 0);
});

test('classifies lock service failures as lock timeout errors', () => {
  const harness = createHarness({ lockThrows: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_LOCK_TIMEOUT' && !!error.cause
  );
  assert.equal(harness.released(), false);
});

test('classifies a releaseLock exception as a typed temporary failure after committed writes', () => {
  const harness = createHarness({ releaseThrows: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      error.diagnostics.phase === 'lock release' &&
      error.cause && /unexpected release/.test(error.cause.message)
  );
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 2);
  assert.equal(harness.sheets['Activity Feed'].getLastRow(), 3);
  assert.equal(harness.sheets['Follow-Ups'].getLastRow(), 2);
});

test('classifies unexpected reachable helper failures as typed temporary failures', () => {
  const harness = createHarness({ requiredSheetFailure: true });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      error.diagnostics.phase === 'idempotency lookup' &&
      error.cause && /required sheet failure/.test(error.cause.message)
  );
  assert.equal(harness.released(), true);
});

test('rejects duplicate company and duplicate email with a typed entity error', () => {
  for (const duplicate of [
    { Company: '  MORGAN   SERVICES ' },
    { Company: 'Different Company', Email: 'TAYLOR@example.com' }
  ]) {
    const harness = createHarness();
    appendRow(harness.sheets['Master Prospect Tracker'], duplicate);
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload()),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_DUPLICATE_ENTITY'
    );
  }
});

test('requires exactly one tracker row for an idempotent retry Prospect ID', () => {
  for (const matchCount of [0, 2]) {
    const harness = createHarness();
    appendRow(harness.sheets['Activity Feed'], {
      'Operation Key': 'INTAKE:' + validPayload().requestId,
      'Prospect ID': 'PROS-DUPLICATE'
    });
    for (let index = 0; index < matchCount; index += 1) {
      appendRow(harness.sheets['Master Prospect Tracker'], {
        Company: `Existing ${index}`,
        'Prospect ID': 'PROS-DUPLICATE'
      });
    }
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload()),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
        error.diagnostics.matchCount === matchCount
    );
  }
});

test('requires a Prospect ID on an idempotent retry activity', () => {
  const harness = createHarness();
  appendRow(harness.sheets['Activity Feed'], {
    'Operation Key': 'INTAKE:' + validPayload().requestId
  });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED'
  );
});

test('rejects oversized normalized fields instead of truncating them', () => {
  const cases = {
    fullName: 'x'.repeat(121),
    businessName: 'x'.repeat(141),
    email: `${'x'.repeat(243)}@example.com`,
    phone: '1'.repeat(31),
    website: 'https://' + 'x'.repeat(2041),
    primaryChallenge: 'x'.repeat(2001)
  };
  Object.entries(cases).forEach(([field, value]) => {
    const harness = createHarness();
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload({ [field]: value })),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_VALIDATION' &&
        error.diagnostics.field === field
    );
  });
});

test('accepts configured field length boundaries after whitespace normalization', () => {
  const harness = createHarness();
  const payload = validPayload({
    fullName: 'x'.repeat(120),
    businessName: 'x'.repeat(140),
    email: `${'x'.repeat(242)}@example.com`,
    phone: '1'.repeat(30),
    website: 'https://' + 'x'.repeat(2036) + '.com',
    primaryChallenge: 'x'.repeat(2000)
  });
  assert.equal(payload.email.length, 254);
  assert.equal(payload.website.length, 2048);
  assert.doesNotThrow(() => harness.context.ingestBusinessSnapshot(payload));
});

test('enforces minimum normalized field lengths', () => {
  for (const [field, value] of [
    ['fullName', ' \t '],
    ['businessName', ''],
    ['email', 'x'],
    ['primaryChallenge', 'x'.repeat(19)]
  ]) {
    const harness = createHarness();
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload({ [field]: value })),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_VALIDATION' &&
        error.diagnostics.field === field
    );
  }
});

test('validates exact acceptedAt age and future boundaries against a frozen clock', () => {
  const now = Date.parse('2026-07-28T18:30:00.000Z');
  const maximumAge = 7 * 24 * 60 * 60 * 1000;
  const futureTolerance = 5 * 60 * 1000;
  for (const acceptedAt of [
    'not-a-date',
    new Date(now - maximumAge - 1).toISOString(),
    new Date(now + futureTolerance + 1).toISOString()
  ]) {
    const harness = createHarness({ nowMs: now });
    assert.throws(
      () => harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt })),
      error => errorCode(error) === 'BUSINESS_SNAPSHOT_VALIDATION' &&
        error.diagnostics.field === 'acceptedAt'
    );
  }
  for (const acceptedAt of [
    new Date(now - maximumAge).toISOString(),
    new Date(now + futureTolerance).toISOString()
  ]) {
    const harness = createHarness({ nowMs: now });
    assert.doesNotThrow(
      () => harness.context.ingestBusinessSnapshot(validPayload({ acceptedAt }))
    );
  }
});

test('returns typed reconciliation details when rollback cannot complete', () => {
  const harness = createHarness({ failFollowUp: true });
  harness.sheets['Master Prospect Tracker'].deleteRow = () => {
    throw new Error('delete denied');
  };
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.cleanupErrors.some(detail => /prospect cleanup failed/i.test(detail)) &&
      error.cause && /simulated follow-up failure/.test(error.cause.message)
  );
});

test('writes public intake fields as literal text without changing visible values', () => {
  const fixedNow = Date.parse('2026-07-28T18:30:00.000Z');
  const harness = createHarness({ nowMs: fixedNow });
  const payload = validPayload({
    fullName: '=FULLNAME()',
    businessName: '=BUSINESS()',
    email: '=literal@example.com',
    phone: '+1-859-555-0100',
    website: 'https://example.com',
    primaryChallenge: '=This text must remain literal and never execute.',
    acceptedAt: new Date(fixedNow).toISOString()
  });

  harness.context.ingestBusinessSnapshot(payload);

  const tracker = harness.sheets['Master Prospect Tracker'];
  const trackerTable = headerTable(tracker);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Contact), payload.fullName);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Company), payload.businessName);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Email), payload.email);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Phone), payload.phone);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Website), payload.website);
  assert.equal(tracker.valueAt(2, trackerTable.headers.Notes), payload.primaryChallenge);

  for (const sheet of Object.values(harness.sheets)) {
    const formulas = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getFormulas();
    assert.deepEqual(
      formulas.flat().filter(Boolean),
      [],
      `${sheet.getName()} must contain no formula from intake text`
    );
  }
  assert.equal(
    harness.sheets['Activity Feed'].valueAt(2, headerTable(harness.sheets['Activity Feed']).headers.Company),
    payload.businessName
  );
  assert.equal(
    harness.sheets['Follow-Ups'].valueAt(2, headerTable(harness.sheets['Follow-Ups']).headers.Company),
    payload.businessName
  );
});

test('central literal-text boundary preserves plus, minus, and at-sign prefixes', () => {
  const harness = createHarness();
  const values = ['=SUM(1,1)', '+1-859-555-0100', '-literal', '@literal', 'ordinary'];
  const protectedValues = Array.from(
    harness.context.literalizeBusinessSnapshotSheetRow_(values)
  );
  const sheet = new MockSheet('Literal Test', values.map((_, index) => `C${index + 1}`));
  sheet.getRange(2, 1, 1, values.length).setValues([protectedValues]);

  assert.deepEqual(sheet.getRange(2, 1, 1, values.length).getValues()[0], values);
  assert.deepEqual(sheet.getRange(2, 1, 1, values.length).getFormulas()[0], ['', '', '', '', '']);
});

test('BusinessSnapshotError retains Error inheritance, code, cause, diagnostics, and stack', () => {
  const harness = createHarness({ requiredSheetFailure: true });
  let caught;
  try {
    harness.context.ingestBusinessSnapshot(validPayload());
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.equal(caught instanceof harness.context.BusinessSnapshotError, true);
  assert.equal(errorCode(caught), 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE');
  assert.equal(caught.diagnostics.phase, 'idempotency lookup');
  assert.match(caught.cause.message, /required sheet failure/);
  assert.match(caught.stack, /Caused by:/);
});

test('Priority Tier normalization preserves D - Nurture without making it verified', () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'DemoData.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'SheetHelpers.js'), 'utf8'), context);
  assert.equal(
    context.normalizePriorityTier_('D - Nurture', context.PROSPECT_DROPDOWN_DEFAULTS['Priority Tier']),
    'D - Nurture'
  );
  assert.equal(context.VERIFIED_CLIENT_FACING_PRIORITY_TIERS.includes('D - Nurture'), false);
});

test('Follow-Up IDs retain their format and avoid same-second collisions', () => {
  let uuidCounter = 0;
  const context = {
    console,
    Utilities: {
      getUuid: () => uuidCounter++ === 0
        ? 'aaaaaaaa-0000-0000-0000-000000000000'
        : 'bbbbbbbb-0000-0000-0000-000000000000',
      formatDate: () => '20260728183000'
    },
    Session: { getScriptTimeZone: () => 'America/New_York' }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'SheetHelpers.js'), 'utf8'), context);
  const first = context.generateFollowUpId_('Morgan Services');
  const second = context.generateFollowUpId_('Morgan Services');
  assert.match(first, /^FU-MORGANSE-20260728183000-[A-F0-9]{8}$/);
  assert.notEqual(first, second);
});

for (const existingProspectId of ['', 'PROS-DIFFERENT01']) {
  test(`Business Snapshot ignores same-company Follow-Up linked to ${existingProspectId || 'no Prospect ID'}`, () => {
    const harness = createHarness();
    appendRow(harness.sheets['Follow-Ups'], {
      'Follow-Up ID': 'FU-EXISTING-20260728183000-11111111',
      Company: 'Morgan Services',
      'Related Prospect ID': existingProspectId,
      'Current Status': 'Lead Found',
      'Follow-Up Type': 'Executive Snapshot',
      Completed: false
    });
    const existing = harness.sheets['Follow-Ups'].rows[1].slice();

    const result = harness.context.ingestBusinessSnapshot(validPayload());
    const followUp = harness.sheets['Follow-Ups'];
    const table = headerTable(followUp);

    assert.deepEqual(followUp.rows[1], existing);
    assert.equal(followUp.getLastRow(), 3);
    assert.equal(followUp.valueAt(3, table.headers['Related Prospect ID']), result.prospectId);
    assert.notEqual(followUp.valueAt(3, table.headers['Follow-Up ID']), followUp.valueAt(2, table.headers['Follow-Up ID']));
  });
}

test('intake leaves all existing open Follow-Ups unchanged', () => {
  const harness = createHarness();
  appendRow(harness.sheets['Follow-Ups'], {
    'Follow-Up ID': 'FU-OTHER-20260728183000-22222222',
    Company: 'Other Company',
    'Related Prospect ID': 'PROS-OTHER000001',
    'Follow-Up Type': 'Discovery Meeting',
    Priority: 'B - Good',
    Notes: 'Existing task',
    Completed: false
  });
  const before = harness.sheets['Follow-Ups'].rows[1].slice();
  harness.context.ingestBusinessSnapshot(validPayload());
  assert.deepEqual(harness.sheets['Follow-Ups'].rows[1], before);
});

test('later intake failure removes intake rows without altering pre-existing Follow-Ups', () => {
  const harness = createHarness({ failAfterFollowUp: true });
  appendRow(harness.sheets['Follow-Ups'], {
    'Follow-Up ID': 'FU-OTHER-20260728183000-33333333',
    Company: 'Morgan Services',
    'Related Prospect ID': 'PROS-OTHER000002',
    'Follow-Up Type': 'Discovery Meeting',
    Notes: 'Must remain unchanged',
    Completed: false
  });
  const before = harness.sheets['Follow-Ups'].rows.map(row => row.slice());
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE'
  );
  assert.deepEqual(harness.sheets['Follow-Ups'].rows, before);
});

test('unexpected pre-existing Follow-Up mutation requires reconciliation', () => {
  const harness = createHarness();
  appendRow(harness.sheets['Follow-Ups'], {
    'Follow-Up ID': 'FU-EXISTING-20260728183000-44444444',
    Company: 'Other Company',
    Notes: 'Original state',
    Completed: false
  });
  const realAppend = harness.context.appendBusinessSnapshotFollowUp_;
  harness.context.appendBusinessSnapshotFollowUp_ = (...args) => {
    const result = realAppend(...args);
    harness.sheets['Follow-Ups'].setValueAt(2, headerTable(harness.sheets['Follow-Ups']).headers.Notes, 'Unexpected mutation');
    throw new Error('simulated later failure');
  };
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.cleanupErrors.some(detail => /pre-existing Follow-Up state/.test(detail))
  );
});

test('duplicate Activity Feed operation keys require reconciliation', () => {
  const harness = createHarness();
  for (let index = 0; index < 2; index += 1) {
    appendRow(harness.sheets['Activity Feed'], {
      'Operation Key': 'INTAKE:' + validPayload().requestId,
      'Prospect ID': 'PROS-DUPLICATE'
    });
  }
  appendRow(harness.sheets['Master Prospect Tracker'], {
    Company: 'Existing',
    'Prospect ID': 'PROS-DUPLICATE'
  });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED' &&
      error.diagnostics.matchCount === 2
  );
});

test('real Prospect ID generation retries a collision before writing', () => {
  const collisionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const uniqueUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const followUpUuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const harness = createHarness({ uuidValues: [collisionUuid, uniqueUuid, followUpUuid] });
  appendRow(harness.sheets['Master Prospect Tracker'], {
    Company: 'Existing Company',
    Email: 'existing@example.com',
    'Prospect ID': 'PROS-AAAAAAAAAAAA'
  });
  const result = harness.context.ingestBusinessSnapshot(validPayload());
  assert.equal(result.prospectId, 'PROS-BBBBBBBBBBBB');
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 16), 'PROS-AAAAAAAAAAAA');
});

test('real Prospect ID generation fails safely after five collisions', () => {
  const collisionUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const harness = createHarness({
    uuidValues: new Array(5).fill(collisionUuid)
  });
  appendRow(harness.sheets['Master Prospect Tracker'], {
    Company: 'Existing Company',
    Email: 'existing@example.com',
    'Prospect ID': 'PROS-AAAAAAAAAAAA'
  });
  assert.throws(
    () => harness.context.ingestBusinessSnapshot(validPayload()),
    error => errorCode(error) === 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE' &&
      /unique Prospect ID/.test(error.cause.message)
  );
  assert.equal(harness.sheets['Master Prospect Tracker'].getLastRow(), 2);
  assert.equal(harness.sheets['Master Prospect Tracker'].valueAt(2, 16), 'PROS-AAAAAAAAAAAA');
});

test('public Business Snapshot success contains only allowlisted fields', () => {
  const harness = createHarness();
  const response = harness.context.ingestBusinessSnapshotPublic(validPayload(), 'production');
  assert.deepEqual(
    Object.keys(response).sort(),
    ['environment', 'ok', 'prospectId', 'requestId', 'retry'].sort()
  );
  assert.equal(response.ok, true);
  assert.equal(response.environment, 'production');
  assert.equal(response.requestId, validPayload().requestId);
  assert.match(response.prospectId, /^PROS-/);
});

test('public serialization allowlists all six typed error codes and no internal data', () => {
  const codes = [
    'BUSINESS_SNAPSHOT_VALIDATION',
    'BUSINESS_SNAPSHOT_DUPLICATE_ENTITY',
    'BUSINESS_SNAPSHOT_LOCK_TIMEOUT',
    'BUSINESS_SNAPSHOT_CONFIGURATION',
    'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE',
    'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED'
  ];
  for (const code of codes) {
    const harness = createHarness();
    harness.context.ingestBusinessSnapshot = () => {
      const cause = new Error('raw platform failure PRIVATE_WORKBOOK_IDENTIFIER');
      cause.stack = 'PRIVATE_STACK';
      throw new harness.context.BusinessSnapshotError(
        code,
        'Taylor Morgan at Taylor@example.com',
        {
          operationKey: 'INTAKE:' + validPayload().requestId,
          rowNumber: 99,
          workbookId: 'PRIVATE_WORKBOOK_IDENTIFIER'
        },
        cause
      );
    };
    const response = harness.context.ingestBusinessSnapshotPublic(validPayload(), 'production');
    assert.deepEqual(
      Object.keys(response).sort(),
      ['code', 'environment', 'ok', 'requestId'].sort()
    );
    assert.equal(response.code, code);
    const serialized = JSON.stringify(response);
    for (const forbidden of [
      'Taylor Morgan', 'Taylor@example.com', 'INTAKE:', 'rowNumber',
      'PRIVATE_WORKBOOK_IDENTIFIER', 'diagnostics', 'cause', 'stack', 'PRIVATE_STACK'
    ]) {
      assert.equal(serialized.includes(forbidden), false, `public response leaked ${forbidden}`);
    }
  }
});

test('public serialization maps unexpected errors to a safe temporary failure', () => {
  const harness = createHarness();
  harness.context.ingestBusinessSnapshot = () => {
    throw new Error('secret raw platform message');
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      harness.context.ingestBusinessSnapshotPublic(validPayload(), 'not-an-environment')
    )),
    {
      ok: false,
      environment: 'staging',
      requestId: validPayload().requestId,
      code: 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE'
    }
  );
});

test('public serialization maps an unknown BusinessSnapshotError code to temporary failure', () => {
  const harness = createHarness();
  harness.context.ingestBusinessSnapshot = () => {
    throw new harness.context.BusinessSnapshotError(
      'BUSINESS_SNAPSHOT_UNKNOWN_INTERNAL_CODE',
      'private internal message',
      { private: true },
      new Error('private cause')
    );
  };
  const response = harness.context.ingestBusinessSnapshotPublic(validPayload(), 'production');
  assert.equal(response.code, 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE');
  assert.deepEqual(Object.keys(response).sort(), ['code', 'environment', 'ok', 'requestId'].sort());
});

test('public boundary catches an exception while reading requestId', () => {
  const harness = createHarness();
  const input = {};
  Object.defineProperty(input, 'requestId', {
    get() {
      throw new Error('private accessor failure');
    }
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.context.ingestBusinessSnapshotPublic(input, 'production'))),
    {
      ok: false,
      environment: 'staging',
      requestId: '',
      code: 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE'
    }
  );
});

test('public boundary catches an exception while converting requestId', () => {
  const harness = createHarness();
  const input = {
    requestId: {
      toString() {
        throw new Error('private conversion failure');
      }
    }
  };
  assert.equal(
    harness.context.ingestBusinessSnapshotPublic(input, 'production').code,
    'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE'
  );
});

test('public boundary catches an exception while normalizing environment', () => {
  const harness = createHarness();
  const environment = {
    toString() {
      throw new Error('private environment failure');
    }
  };
  const response = harness.context.ingestBusinessSnapshotPublic(validPayload(), environment);
  assert.deepEqual(
    JSON.parse(JSON.stringify(response)),
    {
      ok: false,
      environment: 'staging',
      requestId: validPayload().requestId,
      code: 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE'
    }
  );
});
