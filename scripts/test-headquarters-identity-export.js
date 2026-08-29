const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const logged = [];
const calls = { openById: 0, writes: 0 };
const sourceSpreadsheetId = 'BOPProductionWorkbook12345';
const token = 'identity-export-test-secret';
const productionWorkbookTitle = 'Rogers Holdings BOP — CRM & Delivery System';
const disposableWorkbookTitle = 'NON-PRODUCTION — Rogers Holdings BOP — Workbook Optimization Acceptance';
const expectedWorkbookTitleProperty = 'HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE';
const prospectHeaders = ['Prospect ID', 'Status', 'Company', 'Website', 'Notes'];
const clientHeaders = ['Client ID', 'Status', 'Company', 'Client Name', 'Website', 'Notes'];
let properties = {
  BOP_SPREADSHEET_ID: sourceSpreadsheetId,
  HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE: productionWorkbookTitle,
  HEADQUARTERS_IDENTITY_EXPORT_TOKEN: token,
  HEADQUARTERS_SALES_FEED_TOKEN: 'sales-feed-test-secret'
};
let activeSpreadsheet;
let responseConstructionHook;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withPropertyOverrides(overrides, callback) {
  const previous = properties;
  properties = Object.assign({}, properties, overrides);
  Object.keys(overrides).forEach((name) => {
    if (overrides[name] === undefined) delete properties[name];
  });
  try {
    return callback();
  } finally {
    properties = previous;
  }
}

function createSheet(name, sheetId, headers, rows, options, state) {
  const sheetState = {
    name,
    sheetId,
    headers: headers.slice(),
    headerFormulas: (options.headerFormulas || headers.map(() => '')).slice(),
    rows: clone(rows),
    formulas: clone(options.formulas || rows.map((row) => row.map(() => ''))),
    maxRows: options.maxRows || 1000,
    reads: 0
  };
  state[name] = sheetState;
  function lastRow() {
    for (let index = sheetState.rows.length - 1; index >= 0; index -= 1) {
      if (sheetState.rows[index].some((value) => String(value || '') !== '') ||
          (sheetState.formulas[index] || []).some((value) => String(value || '') !== '')) {
        return 5 + index;
      }
    }
    return 4;
  }
  return {
    getSheetId: () => sheetState.sheetId,
    getName: () => sheetState.name,
    getLastColumn: () => sheetState.headers.length,
    getLastRow: () => lastRow(),
    getMaxRows: () => sheetState.maxRows,
    getRange(row, column, rowCount, columnCount) {
      assert.strictEqual(row, 4, 'export reads from exact header row 4');
      const rangeState = {};
      return {
        getDisplayValues() {
          sheetState.reads += 1;
          if (typeof options.onBeforeRead === 'function') {
            options.onBeforeRead({ sheetName: name, readNumber: sheetState.reads, state });
          }
          const grid = [sheetState.headers].concat(sheetState.rows);
          rangeState.display = Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, columnOffset) =>
              String((grid[rowOffset] || [])[column - 1 + columnOffset] || '')
            )
          );
          const formulaGrid = [sheetState.headerFormulas].concat(sheetState.formulas);
          rangeState.formulas = Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, columnOffset) =>
              String((formulaGrid[rowOffset] || [])[column - 1 + columnOffset] || '')
            )
          );
          if (typeof options.onRead === 'function') {
            options.onRead({ sheetName: name, readNumber: sheetState.reads, state });
          }
          return clone(rangeState.display);
        },
        getFormulas() {
          return clone(rangeState.formulas || Array.from({ length: rowCount }, () => Array(columnCount).fill('')));
        },
        setValue() { calls.writes += 1; throw new Error('write attempted'); },
        setValues() { calls.writes += 1; throw new Error('write attempted'); },
        clearContent() { calls.writes += 1; throw new Error('write attempted'); }
      };
    }
  };
}

function createSpreadsheet(options = {}) {
  const state = {};
  const prospectRows = options.prospectRows || [
    ['PRO-2', 'Lead Found', 'Second Company', '', ''],
    ['', '', '', '', ''],
    ['PRO-1', 'Nurture', 'Example Company', 'HTTPS://WWW.Example.COM/path?q=1#part', '']
  ];
  const clientRows = options.clientRows || [
    ['CLI-1', 'Active', '', 'Legacy Client Name', 'client.example.com/about', '']
  ];
  const sheets = {};
  if (!options.missingProspects) {
    sheets['Master Prospect Tracker'] = createSheet(
      'Master Prospect Tracker', 101,
      options.prospectHeaders || prospectHeaders,
      prospectRows,
      {
        formulas: options.prospectFormulas,
        headerFormulas: options.prospectHeaderFormulas,
        onBeforeRead: options.onBeforeRead,
        onRead: options.onRead
      },
      state
    );
  }
  if (!options.missingClients) {
    sheets.Clients = createSheet(
      'Clients', 202,
      options.clientHeaders || clientHeaders,
      clientRows,
      {
        formulas: options.clientFormulas,
        headerFormulas: options.clientHeaderFormulas,
        onBeforeRead: options.onBeforeRead,
        onRead: options.onRead
      },
      state
    );
  }
  let identityChecks = 0;
  return {
    state,
    getId() {
      identityChecks += 1;
      if (typeof options.onIdentityCheck === 'function') {
        options.onIdentityCheck({ checkNumber: identityChecks, state });
      }
      return options.id || sourceSpreadsheetId;
    },
    getName: () => options.name === undefined ? productionWorkbookTitle : options.name,
    getSheetByName: (name) => sheets[name] || null
  };
}

function installSpreadsheet(options) {
  activeSpreadsheet = createSpreadsheet(options);
  calls.openById = 0;
  calls.writes = 0;
  logged.length = 0;
  return activeSpreadsheet;
}

const context = vm.createContext({
  console: {
    log: (...args) => logged.push(args.join(' ')),
    warn: (...args) => logged.push(args.join(' ')),
    error: (...args) => logged.push(args.join(' '))
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(algorithm, value) {
      return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
        .map((byte) => byte > 127 ? byte - 256 : byte);
    }
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (name) => properties[name] || '',
        setProperty() { calls.writes += 1; throw new Error('property write attempted'); }
      };
    }
  },
  SpreadsheetApp: {
    openById(id) {
      calls.openById += 1;
      assert.strictEqual(id, sourceSpreadsheetId, 'only configured workbook ID opened');
      return activeSpreadsheet;
    },
    getActiveSpreadsheet() {
      throw new Error('active spreadsheet must not be used');
    }
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput(text) {
      if (typeof responseConstructionHook === 'function') responseConstructionHook();
      return { text, mimeType: '', setMimeType(value) { this.mimeType = value; return this; } };
    }
  },
  MASTER_PROSPECT_SHEET: 'Master Prospect Tracker',
  CLIENTS_SHEET: 'Clients'
});

vm.runInContext(fs.readFileSync(path.join(root, 'HeadquartersIdentityExport.gs'), 'utf8'), context, {
  filename: 'HeadquartersIdentityExport.gs'
});
vm.runInContext(fs.readFileSync(path.join(root, 'HeadquartersSalesFeed.gs'), 'utf8'), context, {
  filename: 'HeadquartersSalesFeed.gs'
});

function readSource(options) {
  installSpreadsheet(options);
  return context.readHeadquartersIdentityExportSourceV1_();
}

function buildSnapshot(options, at = '2026-08-27T16:00:00.000Z') {
  const source = readSource(options);
  return context.buildHeadquartersIdentityExportV1FromSource_(source, new Date(at));
}

function expectSourceFailure(options, expectedCode) {
  installSpreadsheet(options);
  assert.throws(
    () => context.readHeadquartersIdentityExportSourceV1_(),
    (error) => error && error.code === expectedCode &&
      error.message === 'Identity exclusion snapshot is unavailable.'
  );
  assert.strictEqual(calls.writes, 0, 'failure path remains read-only');
}

function expectBuildFailure(source, expectedCode) {
  assert.throws(
    () => context.buildHeadquartersIdentityExportV1FromSource_(source, new Date('2026-08-27T16:00:00.000Z')),
    (error) => error && error.code === expectedCode
  );
}

function post(body) {
  return context.doPost({ postData: { contents: JSON.stringify(body) } });
}

function expectMutationUnavailable(factory) {
  installSpreadsheet(factory());
  const response = JSON.parse(post({
    version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION,
    token
  }).text);
  assert.deepStrictEqual(response, {
    version: 'rh-bop-identity-exclusion-snapshot-v1',
    complete: false,
    error: 'unavailable'
  });
  assert.notStrictEqual(response.complete, true, 'source mutation cannot produce complete true');
  assert.strictEqual(calls.writes, 0, 'mutation failure remains read-only');
}

// Complete valid export, exact contract, freshness, blank website, and URL normalization.
const snapshot = buildSnapshot();
assert.deepStrictEqual(Array.from(Object.keys(snapshot)), [
  'version', 'source', 'complete', 'generatedAt', 'expiresAt', 'entries'
], 'exact Headquarters top-level contract with no counts');
assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot, 'counts'), false, 'counts field absent');
assert.strictEqual(snapshot.version, 'rh-bop-identity-exclusion-snapshot-v1');
assert.strictEqual(snapshot.source, 'business-optimization-platform');
assert.strictEqual(snapshot.complete, true);
assert.strictEqual(snapshot.generatedAt, '2026-08-27T16:00:00.000Z');
assert.strictEqual(snapshot.expiresAt, '2026-08-27T16:05:00.000Z');
assert.strictEqual(snapshot.entries.length, 3);
assert(snapshot.entries.every((entry) =>
  JSON.stringify(Object.keys(entry)) === JSON.stringify(['recordId', 'lifecycle', 'businessName', 'domains'])
), 'exact entry contract');
assert.deepStrictEqual(Array.from(snapshot.entries.find((entry) => entry.recordId === 'PRO-2').domains), []);
assert.deepStrictEqual(Array.from(snapshot.entries.find((entry) => entry.recordId === 'PRO-1').domains), ['example.com']);
assert.deepStrictEqual(Array.from(snapshot.entries.find((entry) => entry.recordId === 'CLI-1').domains), ['client.example.com']);
assert.strictEqual(calls.openById, 1, 'configured workbook opened once');
assert.strictEqual(calls.writes, 0, 'successful export performs no write');
assert.strictEqual(context.getHeadquartersIdentityUtf8ByteLengthV1_(JSON.stringify(snapshot)), Buffer.byteLength(JSON.stringify(snapshot), 'utf8'));

// Company precedes Client Name and repeated www is canonicalized fully.
const precedence = buildSnapshot({ clientRows: [['CLI-1', 'Active', 'Canonical Company', 'Legacy Name', '', '']] });
assert.strictEqual(precedence.entries.find((entry) => entry.recordId === 'CLI-1').businessName, 'Canonical Company');
const repeatedWww = buildSnapshot({ prospectRows: [['PRO-1', 'Lead Found', 'Example Company', 'https://www.www.example.com/path', '']] });
assert.deepStrictEqual(Array.from(repeatedWww.entries.find((entry) => entry.recordId === 'PRO-1').domains), ['example.com']);

// Malformed websites fail closed.
[
  'bad..example.com',
  'https://user:secret@example.com',
  'https://example.com:8443/path',
  'ftp://example.com/file'
].forEach((website) => {
  expectSourceFailure({ prospectRows: [['PRO-1', 'Lead Found', 'Example Company', website, '']] }, 'WEBSITE_INVALID');
});

// Missing, malformed, overlength, and duplicate identifiers fail closed.
expectSourceFailure({ prospectRows: [['', 'Lead Found', 'Company', '', '']] }, 'RECORD_ID_INVALID');
expectSourceFailure({ clientRows: [['', 'Active', 'Company', '', '', '']] }, 'RECORD_ID_INVALID');
expectSourceFailure({ prospectRows: [['BAD ID/1', 'Lead Found', 'Company', '', '']] }, 'RECORD_ID_INVALID');
expectSourceFailure({ prospectRows: [['P'.repeat(161), 'Lead Found', 'Company', '', '']] }, 'RECORD_ID_INVALID');
expectSourceFailure({
  prospectRows: [['PRO-1', 'Lead Found', 'One', '', ''], ['pro-1', 'Nurture', 'Two', '', '']]
}, 'DUPLICATE_RECORD_ID');
expectSourceFailure({
  clientRows: [['CLI-1', 'Active', 'One', '', '', ''], ['cli-1', 'Paused', 'Two', '', '', '']]
}, 'DUPLICATE_RECORD_ID');
const crossLifecycle = readSource({
  prospectRows: [['SAME-1', 'Lead Found', 'Prospect', '', '']],
  clientRows: [['same-1', 'Active', 'Client', '', '', '']]
});
expectBuildFailure(crossLifecycle, 'DUPLICATE_RECORD_ID');

// Required headers, sheets, formulas, and business names fail closed.
expectSourceFailure({
  prospectHeaders: ['Prospect ID', 'Status', 'Company', 'Notes'],
  prospectRows: [['PRO-1', 'Lead Found', 'Company', '']]
}, 'REQUIRED_HEADER_MISSING');
expectSourceFailure({ missingClients: true }, 'REQUIRED_SHEET_MISSING');
expectSourceFailure({ missingProspects: true }, 'REQUIRED_SHEET_MISSING');
expectSourceFailure({ prospectRows: [['PRO-1', 'Lead Found', '', '', '']] }, 'BUSINESS_NAME_INVALID');
expectSourceFailure({ clientRows: [['CLI-1', 'Active', '', '', '', '']] }, 'BUSINESS_NAME_INVALID');
expectSourceFailure({ prospectRows: [['PRO-1', 'Lead Found', '---', '', '']] }, 'BUSINESS_NAME_INVALID');
expectSourceFailure({ prospectRows: [['PRO-1', 'Lead Found', 'N'.repeat(301), '', '']] }, 'BUSINESS_NAME_INVALID');
expectSourceFailure({
  clientHeaders: ['Client ID', 'Status', 'Company', 'Company', 'Website', 'Notes'],
  clientRows: [['CLI-1', 'Active', 'One', 'Two', '', '']]
}, 'AMBIGUOUS_REQUIRED_HEADER');
expectSourceFailure({
  prospectRows: [['PRO-1', 'Lead Found', 'Company', '', '']],
  prospectFormulas: [['', '', '=A1', '', '']]
}, 'UNTRUSTED_SOURCE_FORMULA');
expectSourceFailure({
  prospectHeaderFormulas: ['', '', '=A1', '', '']
}, 'UNTRUSTED_HEADER_FORMULA');

// Explicit workbook binding requires exact configured ID and title in every environment.
const productionBinding = buildSnapshot({ name: productionWorkbookTitle });
assert.strictEqual(productionBinding.complete, true, 'exact production ID and explicitly configured title succeed');
expectSourceFailure({ name: 'Wrong Workbook Title' }, 'SOURCE_IDENTITY_MISMATCH');
expectSourceFailure({ id: 'DifferentWorkbookIdentity12345', name: productionWorkbookTitle }, 'SOURCE_IDENTITY_MISMATCH');
expectSourceFailure({ name: productionWorkbookTitle + ' ' }, 'SOURCE_IDENTITY_MISMATCH');

withPropertyOverrides({
  [expectedWorkbookTitleProperty]: disposableWorkbookTitle
}, () => {
  const disposableBinding = buildSnapshot({ name: disposableWorkbookTitle });
  assert.strictEqual(disposableBinding.complete, true, 'exact disposable ID and explicitly configured title succeed');
});

withPropertyOverrides({
  [expectedWorkbookTitleProperty]: disposableWorkbookTitle
}, () => {
  expectSourceFailure({ name: productionWorkbookTitle }, 'SOURCE_IDENTITY_MISMATCH');
});

[undefined, '', '   ', ` ${productionWorkbookTitle}`, `${productionWorkbookTitle}\n`].forEach((configuredTitle) => {
  withPropertyOverrides({
    [expectedWorkbookTitleProperty]: configuredTitle
  }, () => {
    expectSourceFailure({ name: productionWorkbookTitle }, 'SOURCE_CONFIGURATION_INVALID');
    assert.strictEqual(calls.openById, 0, 'invalid title configuration fails before workbook access');
  });
});

withPropertyOverrides({
  [expectedWorkbookTitleProperty]: undefined
}, () => {
  installSpreadsheet({ name: productionWorkbookTitle });
  assert.deepStrictEqual(JSON.parse(post({
    version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION,
    token
  }).text), {
    version: 'rh-bop-identity-exclusion-snapshot-v1',
    complete: false,
    error: 'unavailable'
  }, 'missing expected title returns the generic unavailable response');
  assert.strictEqual(calls.openById, 0, 'production title is never an implicit fallback');
});

withPropertyOverrides({
  [expectedWorkbookTitleProperty]: productionWorkbookTitle
}, () => {
  expectMutationUnavailable(() => ({
    onRead({ sheetName, readNumber }) {
      if (sheetName === 'Clients' && readNumber === 2) {
        properties[expectedWorkbookTitleProperty] = disposableWorkbookTitle;
      }
    }
  }));
});

// Entry and canonical serialized-payload limits fail before complete true can be returned.
const tooMany = Array.from({ length: 100001 }, (_, index) => ({
  recordId: `P-${index}`,
  lifecycle: 'prospect',
  businessName: `Business ${index}`,
  domains: []
}));
expectBuildFailure({ prospects: tooMany, clients: [] }, 'SNAPSHOT_ENTRY_LIMIT_EXCEEDED');
const tooLarge = Array.from({ length: 5000 }, (_, index) => ({
  recordId: `P-${index}`,
  lifecycle: 'prospect',
  businessName: `Business ${index} ${'N'.repeat(270)}`,
  domains: []
}));
expectBuildFailure({ prospects: tooLarge, clients: [] }, 'SNAPSHOT_SIZE_LIMIT_EXCEEDED');

// Entry arrays must be dense; no hole, null, or undefined may bypass validation.
const oneHole = [{
  recordId: 'P-1', lifecycle: 'prospect', businessName: 'Valid Business', domains: []
}, , {
  recordId: 'P-3', lifecycle: 'prospect', businessName: 'Another Business', domains: []
}];
expectBuildFailure({ prospects: oneHole, clients: [] }, 'SNAPSHOT_ENTRY_INVALID');
expectBuildFailure({ prospects: new Array(100000), clients: [] }, 'SNAPSHOT_ENTRY_INVALID');
expectBuildFailure({ prospects: [null], clients: [] }, 'SNAPSHOT_ENTRY_INVALID');
expectBuildFailure({ prospects: [undefined], clients: [] }, 'SNAPSHOT_ENTRY_INVALID');
const sparseDomains = [];
sparseDomains.length = 1;
expectBuildFailure({
  prospects: [{
    recordId: 'P-SPARSE-DOMAIN',
    lifecycle: 'prospect',
    businessName: 'Sparse Domain Business',
    domains: sparseDomains
  }],
  clients: []
}, 'SNAPSHOT_ENTRY_INVALID');
const denseEntries = Array.from({ length: 3 }, (_, index) => ({
  recordId: `DENSE-${index + 1}`,
  lifecycle: 'prospect',
  businessName: `Dense Business ${index + 1}`,
  domains: []
}));
const denseSnapshot = context.buildHeadquartersIdentityExportV1FromSource_(
  { prospects: denseEntries, clients: [] },
  new Date('2026-08-27T16:00:00.000Z')
);
assert.strictEqual(denseSnapshot.complete, true);
assert.strictEqual(denseSnapshot.entries.length, denseEntries.length);
assert(denseSnapshot.entries.every((entry, index) =>
  Object.prototype.hasOwnProperty.call(denseSnapshot.entries, index) && entry
));

// Two-pass acquisition detects mutation in either sheet and all required source surfaces.
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].rows.push(['PRO-NEW', 'Lead Found', 'Appended Prospect', '', '']);
      state['Master Prospect Tracker'].formulas.push(['', '', '', '', '']);
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) state.Clients.rows[0][0] = 'CLI-CHANGED';
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].rows[0][2] = 'Changed Business Name';
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Master Prospect Tracker' && readNumber === 2) {
      state.Clients.rows.push(['CLI-NEW', 'Active', 'Appended Client', '', '', '']);
      state.Clients.formulas.push(['', '', '', '', '', '']);
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].formulas[0][2] = '=A1';
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].maxRows += 1;
    }
  }
}));

// The reproduced post-fingerprint mutation is caught by the final complete acquisition.
expectMutationUnavailable(() => ({
  onIdentityCheck({ checkNumber, state }) {
    if (checkNumber === 2) {
      state['Master Prospect Tracker'].rows[0][2] = 'Late Concurrent Edit';
    }
  }
}));

// A mutation at the start of the final acquisition is also covered by its fingerprint.
expectMutationUnavailable(() => ({
  onBeforeRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Master Prospect Tracker' && readNumber === 3) {
      state['Master Prospect Tracker'].rows[0][0] = 'PRO-FINAL-CHANGED';
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].rows.pop();
      state['Master Prospect Tracker'].formulas.pop();
    }
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) state['Master Prospect Tracker'].rows[0][0] = 'PRO-CHANGED';
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) state['Master Prospect Tracker'].rows[0][3] = 'changed.example.com';
  }
}));
expectMutationUnavailable(() => ({
  onRead({ sheetName, readNumber, state }) {
    if (sheetName === 'Clients' && readNumber === 1) {
      state['Master Prospect Tracker'].headers[0] = 'Changed Prospect ID';
      state['Master Prospect Tracker'].headerFormulas[2] = '=A1';
    }
  }
}));

// Module contains and invokes no BOP write-capable or external boundary.
const identitySourceText = fs.readFileSync(path.join(root, 'HeadquartersIdentityExport.gs'), 'utf8');
assert(!/\.(setValue|setValues|clearContent|appendRow|insertRow|insertSheet|deleteRow|deleteSheet|setProperty|createFile)\s*\(/.test(identitySourceText));
assert(!/(getOrCreate|ensure[A-Z]|logPipelineActivity_|DriveApp|GmailApp|CalendarApp|UrlFetchApp|LockService|getActiveSpreadsheet)\b/.test(identitySourceText));
assert.strictEqual(identitySourceText.includes(productionWorkbookTitle), false, 'no production-title fallback is embedded');
assert.strictEqual(identitySourceText.includes(disposableWorkbookTitle), false, 'no disposable-title fallback is embedded');
assert.strictEqual(calls.writes, 0);

// Authentication and failures disclose neither tokens nor fixture identity values.
installSpreadsheet({ prospectRows: [['LEAK-ID', 'Lead Found', 'Sensitive Company', 'bad..secret.example', '']] });
assert.deepStrictEqual(JSON.parse(post({ version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION, token: 'wrong' }).text), { error: 'unauthorized' });
const unavailable = post({ version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION, token }).text;
assert.deepStrictEqual(JSON.parse(unavailable), {
  version: 'rh-bop-identity-exclusion-snapshot-v1',
  complete: false,
  error: 'unavailable'
});
const observable = unavailable + '\n' + logged.join('\n');
[token, 'LEAK-ID', 'Sensitive Company', 'bad..secret.example', sourceSpreadsheetId].forEach((secret) => {
  assert.strictEqual(observable.includes(secret), false);
});

// Authenticated success dispatches independently and returns canonical JSON bytes.
installSpreadsheet();
const successfulPost = post({ version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION, token });
const successfulPayload = JSON.parse(successfulPost.text);
assert.strictEqual(successfulPost.text, JSON.stringify(successfulPayload), 'direct payload is canonical JSON');
assert.deepStrictEqual(Object.keys(successfulPayload), ['version', 'source', 'complete', 'generatedAt', 'expiresAt', 'entries']);
assert.strictEqual(successfulPayload.complete, true);
assert.strictEqual(calls.writes, 0);

// Once final verification and JSON serialization are complete, a later source
// edit cannot change the already-fixed point-in-time response.
installSpreadsheet();
responseConstructionHook = function() {
  activeSpreadsheet.state['Master Prospect Tracker'].rows[0][2] = 'Changed After Fixed Payload';
};
const fixedResponse = post({ version: context.HEADQUARTERS_IDENTITY_EXPORT_VERSION, token });
responseConstructionHook = null;
const fixedPayload = JSON.parse(fixedResponse.text);
assert.strictEqual(fixedPayload.complete, true);
assert.strictEqual(
  fixedPayload.entries.find((entry) => entry.recordId === 'PRO-2').businessName,
  'Second Company'
);
assert.strictEqual(
  activeSpreadsheet.state['Master Prospect Tracker'].rows[0][2],
  'Changed After Fixed Payload'
);
assert.strictEqual(fixedResponse.text, JSON.stringify(fixedPayload));
assert.strictEqual(calls.writes, 0);

console.log('Headquarters Identity Exclusion Snapshot v1 contract, stability, and fail-closed tests passed.');
