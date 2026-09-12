const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const provenance = require('./fixtures/de002-reconciliation-provenance.json');
const files = fs.readdirSync(root).filter(name => name.endsWith('.gs')).sort();
const source = Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));

function load(globals = {}) {
  const context = vm.createContext(globals);
  // Definitions/constant initializers only. No Apps Script handler is invoked.
  for (const name of files) new vm.Script(source[name], { filename: name }).runInContext(context, { timeout: 1000 });
  return context;
}

test('reconciled inventory preserves the exact production runtime and the two reviewed main modules', () => {
  const expected = [...Object.keys(provenance.productionRuntimeSha256), 'HeadquartersIdentityExport.gs'].sort();
  assert.deepEqual([...files, 'appsscript.json'].sort(), expected);
  for (const name of files) {
    const expectedHash = provenance.reviewedMainSha256[name] || provenance.productionRuntimeSha256[name];
    assert.equal(hash(source[name]), expectedHash, name);
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, '.clasp.production.json'), 'utf8'));
  assert.deepEqual(config.scriptExtensions, ['.gs']);
  assert.equal(config.skipSubdirectories, true);
});

test('manifest preserves Advanced Gmail v1 and the reviewed web-app policy without explicit broader scopes', () => {
  assert.deepEqual(manifest, {
    timeZone: 'America/New_York',
    dependencies: { enabledAdvancedServices: [{ userSymbol: 'Gmail', version: 'v1', serviceId: 'gmail' }] },
    exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8',
    webapp: { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' }
  });
});

test('complete Apps Script globals compile/load without services and every literal menu handler resolves', () => {
  const context = load();
  const handlers = [...source['Menu.gs'].matchAll(/\.addItem\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  assert.ok(handlers.length > 0);
  for (const handler of handlers) assert.equal(typeof context[handler], 'function', handler);
  for (const handler of ['generateExecutiveBriefPdfFromPreview', 'generateDigitalBusinessAssessmentPdfFromPreview', 'generateImprovementPlanPdfFromPreview', 'doPost']) {
    assert.equal(typeof context[handler], 'function', handler);
  }
});

// Mock data only. Real services, workflow functions and setters throw and are recorded.
function dispatcherHarness(kind) {
  const forbidden = [], reads = [];
  const blocked = label => { forbidden.push(label); throw new Error('Forbidden test capability: ' + label); };
  const strict = (value, label) => new Proxy(value, {
    get(target, key) { if (key in target) return target[key]; return blocked(label + '.' + String(key)); }
  });
  const tokenProperties = {
    BOP_SPREADSHEET_ID: 'SyntheticWorkbook12345',
    HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE: 'Synthetic Read-only Workbook',
    HEADQUARTERS_IDENTITY_EXPORT_TOKEN: 'synthetic-identity-token',
    HEADQUARTERS_SALES_FEED_TOKEN: 'synthetic-sales-token'
  };
  const tables = {
    'Master Prospect Tracker': [['Prospect ID', 'Status', 'Company', 'Website'], ['PRO-LOCAL-1', 'Lead Found', 'Synthetic Prospect', 'prospect.example']],
    Clients: [['Client ID', 'Status', 'Company', 'Client Name', 'Website'], ['CLI-LOCAL-1', 'Active', 'Synthetic Client', '', 'client.example']],
    'Follow-Ups': [['Follow-Up ID', 'Current Status', 'Follow-Up Type', 'Due Date', 'Completed']],
    Projects: [['Project ID', 'Status', 'Due Date']]
  };
  if (kind === 'sales') for (const name of Object.keys(tables)) tables[name] = [tables[name][0]];
  const sheets = Object.fromEntries(Object.entries(tables).map(([name, table], index) => [name, strict({
    getSheetId: () => index + 1, getName: () => name, getLastColumn: () => table[0].length,
    getLastRow: () => table.length + 3, getMaxRows: () => 100,
    getRange(row, column, rowCount = 1, columnCount = 1) {
      reads.push(name);
      const values = () => Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => (table[row + r - 4] || [])[column + c - 1] || ''));
      return strict({ getDisplayValues: values, getValues: values,
        getFormulas: () => Array.from({ length: rowCount }, () => Array(columnCount).fill('')) }, 'range');
    }
  }, name)]));
  const workbook = strict({ getId: () => tokenProperties.BOP_SPREADSHEET_ID,
    getName: () => tokenProperties.HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE,
    getSheetByName: name => sheets[name] || null }, 'workbook');
  const unavailable = name => strict({}, name);
  const context = load({
    console: { log: () => blocked('console.log'), warn: () => blocked('console.warn'), error: () => blocked('console.error') },
    PropertiesService: strict({ getScriptProperties: () => strict({ getProperty: name => tokenProperties[name] || null }, 'properties') }, 'PropertiesService'),
    SpreadsheetApp: strict({ openById: id => { assert.equal(id, tokenProperties.BOP_SPREADSHEET_ID); assert.equal(kind, 'identity'); return workbook; },
      getActiveSpreadsheet: () => { assert.equal(kind, 'sales'); return workbook; } }, 'SpreadsheetApp'),
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest()).map(byte => byte > 127 ? byte - 256 : byte) },
    Gmail: unavailable('Gmail'), GmailApp: unavailable('GmailApp'), DriveApp: unavailable('DriveApp'),
    Calendar: unavailable('Calendar'), CalendarApp: unavailable('CalendarApp'), UrlFetchApp: unavailable('UrlFetchApp'),
    HtmlService: unavailable('HtmlService'), LockService: unavailable('LockService'), Session: unavailable('Session')
  });
  const allowed = new Set(['HeadquartersIdentityExport.gs', 'HeadquartersSalesFeed.gs'].flatMap(name =>
    [...source[name].matchAll(/^function\s+(\w+)\s*\(/gm)].map(match => match[1])));
  if (kind === 'sales') for (const name of ['getRequiredSheet_', 'getHeaderTable_', 'startOfDay_']) allowed.add(name);
  for (const [name, value] of Object.entries(context)) {
    if (typeof value === 'function' && !allowed.has(name)) context[name] = () => blocked('workflow:' + name);
  }
  return { context, forbidden, reads };
}

for (const kind of ['identity', 'sales']) {
  test('complete-inventory ' + kind + ' dispatcher accepts only its distinct token without invoking business capabilities', () => {
    const { context, forbidden, reads } = dispatcherHarness(kind);
    const version = kind === 'identity' ? 'rh-bop-identity-exclusion-snapshot-v1' : '1.0';
    const request = token => ({ postData: { contents: JSON.stringify({ version, token }) } });
    const wrongToken = kind === 'identity' ? 'synthetic-sales-token' : 'synthetic-identity-token';
    assert.deepEqual(JSON.parse(context.doPost(request(wrongToken)).text), { error: 'unauthorized' });
    assert.deepEqual(reads, []);
    const result = JSON.parse(context.doPost(request('synthetic-' + kind + '-token')).text);
    assert.equal(result.version, version);
    if (kind === 'identity') {
      assert.equal(result.complete, true);
      assert.deepEqual(result.entries.map(entry => entry.lifecycle).sort(), ['client', 'prospect']);
      assert.equal(result.source, 'business-optimization-platform');
    } else {
      assert.equal(result.status.healthy, true);
      assert.equal(result.status.partial, false);
      assert.equal(result.sales.prospects, 0);
    }
    assert.ok(reads.length > 0);
    assert.deepEqual(forbidden, []);
  });
}
