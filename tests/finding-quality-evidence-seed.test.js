const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const fqSource = fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8');
const presenceSource = fs.readFileSync(path.join(ROOT, 'PresenceInventoryEngine.gs'), 'utf8');
const evidenceSource = fs.readFileSync(path.join(ROOT, 'EvidenceDraftEngine.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
const PROSPECT_ID = 'PROS-AF21065CD5C8';
const LIMITATION = 'Public pages verified reachable and ownership confirmed. The secure submission endpoint is not connected; the Business Snapshot form prepares an email for the customer to review and send. No submission was performed.';

function response(url, options = {}) {
  const body = options.body || '<html><title>' + (url.includes('business-snapshot') ? 'Business Snapshot' : 'Rogers Holdings LLC') + '</title></html>';
  return {
    getResponseCode: () => options.code || 200,
    getAllHeaders: () => options.headers || { 'Content-Type': 'text/html; charset=utf-8' },
    getBlob: () => ({ getBytes: () => Array.from(Buffer.from(body)) }),
    getContentText: () => body
  };
}

function harness(options = {}) {
  const c = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(value => value > 127 ? value - 256 : value)
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    SpreadsheetApp: { flush() {} }, LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: { fetch: (url, request) => response(url, { request }) }
  });
  vm.runInContext(fqSource, c, { filename: 'FindingQualityEngine.gs' });
  vm.runInContext(presenceSource, c, { filename: 'PresenceInventoryEngine.gs' });
  vm.runInContext(evidenceSource, c, { filename: 'EvidenceDraftEngine.gs' });

  const records = {};
  const workbook = { getSheetByName: name => name === 'Master Prospect Tracker' ? tracker : null };
  function entry(name, values = []) {
    const sheet = {
      records: values.map(value => Object.assign({}, value)),
      getParent: () => workbook, getLastRow() { return this.records.length + 1; },
      appendRow(values) { this.records.push(Object.assign({}, values)); },
      deleteRow(row) { this.records.splice(row - 2, 1); }
    };
    records[name] = { sheet, table: { headerRow: 1, headers: {}, lastColumn: c[name === c.FQ_CONTEXT_SHEET ? 'FQ_CONTEXT_COLUMNS' : name === c.FQ_PRESENCE_SHEET ? 'FQ_PRESENCE_COLUMNS' : name === c.FQ_EVIDENCE_SHEET ? 'FQ_EVIDENCE_COLUMNS' : name === c.FQ_FINDINGS_SHEET ? 'FQ_FINDING_COLUMNS' : name === c.FQ_FINDING_SETS_SHEET ? 'FQ_FINDING_SET_COLUMNS' : name === c.FQ_RECOMMENDATIONS_SHEET ? 'FQ_RECOMMENDATION_COLUMNS' : 'FQ_ACTION_COLUMNS'].length } };
  }
  const context = {
    'Context ID': 'CTX-REAL', 'Prospect ID': PROSPECT_ID, Version: '1', 'Primary Service': 'Business Snapshot',
    'Target Customer': 'Small business owners', 'Service Area': 'Kentucky and online', 'Desired Customer Action': 'Request a Business Snapshot',
    'Primary Business Objective': 'Get more customers', 'Relevant Conversion Destination': 'https://rogersholdingsllc.com/business-snapshot/',
    'Known Constraints': 'No guarantees', 'Industry Context': 'Consulting', Source: 'Reviewed source',
    'Review Status': 'Reviewed', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-16T12:00:00Z'
  };
  const presence = {
    'Presence Record ID': 'PRES-a6fc8b5a99b5f255', 'Prospect ID': PROSPECT_ID, 'Inventory ID': 'INV-real', 'Inventory Version': '1',
    'Channel Type': 'Website', 'Channel Name': 'Website', 'Presence State': 'Verified Present',
    'Verified URL or Identifier': options.website || 'https://www.rogersholdingsllc.com', 'Ownership Confidence': 'High',
    'Evidence Source': 'Public website and owner confirmation', 'Evidence Location': 'reviewed URLs', 'Captured At': '2026-08-17T11:28:48Z',
    Applicability: 'Applicable', 'Role in Customer Journey': 'Website and request path', Limitations: LIMITATION, Notes: 'fixture',
    'Review Status': options.presenceStatus || 'Reviewed', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-17T12:00:00Z'
  };
  const synthetic = { 'Evidence ID': 'EVID-SYNTHETIC', 'Prospect ID': 'PROS-FQ1', 'Acquisition Version': 'fixture', value: 'unchanged' };
  entry(c.FQ_CONTEXT_SHEET, options.contexts || [context]); entry(c.FQ_PRESENCE_SHEET, options.presences || [presence]);
  entry(c.FQ_EVIDENCE_SHEET, options.existingProspectEvidence ? [synthetic, { 'Evidence ID': 'EVID-OLD', 'Prospect ID': PROSPECT_ID, 'Acquisition Version': 'other' }] : options.withSynthetic === false ? [] : [synthetic]);
  entry(c.FQ_FINDINGS_SHEET, options.downstream ? [{ 'Prospect ID': PROSPECT_ID }] : []);
  entry(c.FQ_FINDING_SETS_SHEET, []); entry(c.FQ_RECOMMENDATIONS_SHEET, []); entry(c.FQ_ACTIONS_SHEET, []);

  const trackerRows = options.duplicateProspect ? [[PROSPECT_ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com'], [PROSPECT_ID, 'Duplicate', 'https://www.rogersholdingsllc.com']] : [[PROSPECT_ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com']];
  const tracker = { getRange: row => ({ getValues: () => [trackerRows[row - 2]] }) };
  c.MASTER_PROSPECT_SHEET = 'Master Prospect Tracker';
  c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Prospect ID': 1, Company: 2, Website: 3 }, lastColumn: 3 });
  c.findRowsByExactHeaderValue_ = (_sheet, _table, _header, value) => trackerRows.map((row, i) => row[0] === value ? i + 2 : -1).filter(row => row > 0);
  c.getValueByHeader_ = (row, headers, header) => row[headers[header] - 1];
  c.getExistingFindingQualityDraftSuccessorSchema_ = () => records;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  c.appendFindingQualityRecord_ = (sheet, _table, record) => { sheet.records.push(Object.assign({}, record)); return sheet.records.length + 1; };
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.validateAssessmentPresenceRecord_ = record => { if (!record['Presence Record ID']) throw new Error('invalid Presence'); };

  const selected = { ss: workbook, sheet: {}, table: { lastColumn: 19 }, row: 10, record: Object.assign({}, presence) };
  selected.sheet.getRange = () => ({ getValues: () => [c.FQ_PRESENCE_COLUMNS.map(header => presence[header] || '')] });
  selected.table.headers = Object.fromEntries(c.FQ_PRESENCE_COLUMNS.map((header, index) => [header, index + 1]));
  return { c, records, selected, presence, syntheticBefore: JSON.stringify(records[c.FQ_EVIDENCE_SHEET].sheet.records[0] || null) };
}

test('clean seeding creates two factual Draft Evidence records and preserves synthetic fixtures', () => {
  const h = harness();
  const result = h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch: url => response(url) });
  assert.equal(result.status, 'completed');
  assert.equal(JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records[0]), h.syntheticBefore);
  const seeded = h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.slice(1);
  assert.equal(seeded.length, 2);
  assert.deepEqual(Array.from(seeded, record => record['Source URL']), ['https://www.rogersholdingsllc.com', 'https://rogersholdingsllc.com/business-snapshot/']);
  assert.ok(seeded.every(record => record['Review Status'] === 'Draft' && !record['Reviewed By']));
  assert.match(seeded[1].Limitations, /secure submission endpoint is not connected/);
  assert.match(seeded[0]['Raw Artifact Reference'], /^sha256:/);
});

test('Reviewed current context and exact Reviewed applicable Website Presence are required', () => {
  for (const options of [
    { presenceStatus: 'Draft' },
    { contexts: [] },
    { contexts: [{ 'Prospect ID': PROSPECT_ID, Version: '2', 'Review Status': 'Draft' }] },
    { presences: [Object.assign({}, harness().presence), Object.assign({}, harness().presence)] },
    { duplicateProspect: true },
    { downstream: true }
  ]) {
    const h = harness(options);
    assert.throws(() => h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch: url => response(url) }));
    assert.equal(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.length, 1);
  }
});

test('pre-existing unowned Evidence blocks duplicate seeding without writes', () => {
  const h = harness({ existingProspectEvidence: true });
  const before = JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records);
  assert.throws(() => h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch: url => response(url) }), /Evidence already exists/);
  assert.equal(JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records), before);
});

test('URL restrictions reject unsupported domains, authentication, content, size, and off-domain redirects', () => {
  const h = harness();
  assert.throws(() => h.c.captureApprovedEvidencePage_('https://evil.example/', ['https://rogersholdingsllc.com/'], url => response(url)), /Off-domain/);
  assert.throws(() => h.c.captureApprovedEvidencePage_('https://rogersholdingsllc.com/', ['https://rogersholdingsllc.com/'], url => response(url, { code: 302, headers: { Location: 'https://evil.example/' } })), /Off-domain/);
  assert.throws(() => h.c.captureApprovedEvidencePage_('https://rogersholdingsllc.com/', ['https://rogersholdingsllc.com/'], url => response(url, { code: 401 })), /Authenticated/);
  assert.throws(() => h.c.captureApprovedEvidencePage_('https://rogersholdingsllc.com/', ['https://rogersholdingsllc.com/'], url => response(url, { headers: { 'Content-Type': 'application/json' } })), /content type/);
  assert.throws(() => h.c.captureApprovedEvidencePage_('https://rogersholdingsllc.com/', ['https://rogersholdingsllc.com/'], url => response(url, { body: 'x'.repeat(h.c.FQ_EVIDENCE_MAX_BYTES + 1) })), /safe capture limit/);
});

test('same approved-domain redirects are allowed and no cookies, forms, or state-changing request are sent', () => {
  const h = harness();
  const requests = [];
  const capture = h.c.captureApprovedEvidencePage_('https://www.rogersholdingsllc.com/', ['https://www.rogersholdingsllc.com/', 'https://rogersholdingsllc.com/business-snapshot/'], (url, request) => {
    requests.push({ url, request });
    return requests.length === 1 ? response(url, { code: 301, headers: { Location: 'https://rogersholdingsllc.com/' } }) : response(url);
  });
  assert.equal(capture.finalUrl, 'https://rogersholdingsllc.com/');
  assert.ok(requests.every(item => item.request.method === 'get' && !item.request.payload && !item.request.headers.Cookie));
});

test('exact retry is idempotent and performs no second live capture', () => {
  const h = harness();
  h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch: url => response(url) });
  const count = h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.length;
  const retry = h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch() { throw new Error('must not fetch'); } });
  assert.equal(retry.status, 'already-completed');
  assert.equal(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.length, count);
});

test('partial failure rolls back only operation-owned Evidence and preserves synthetic records', () => {
  const h = harness();
  assert.throws(() => h.c.seedFindingQualityEvidenceDraftsLocked_(h.selected, {}, { fetch: url => response(url), afterWrite(count) { if (count === 2) throw new Error('injected'); } }), /injected/);
  assert.equal(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.length, 1);
  assert.equal(JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records[0]), h.syntheticBefore);
});

test('selected Presence header resolution is exact, hidden/reordered-column safe, and rejects multi-row selection', () => {
  const h = harness();
  const headers = ['Review Status', 'Presence Record ID', 'Prospect ID'];
  const values = ['Reviewed', 'PRES-a6fc8b5a99b5f255', PROSPECT_ID];
  const sheet = { hiddenColumns: new Set([2]), getName: () => h.c.FQ_PRESENCE_SHEET, getLastRow: () => 10, getRange: () => ({ getValues: () => [values] }) };
  h.c.FQ_PRESENCE_COLUMNS = headers;
  h.c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Review Status': 1, 'Presence Record ID': 2, 'Prospect ID': 3 }, lastColumn: 3 });
  h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 1, getRow: () => 10 }) }) };
  assert.equal(h.c.requireSelectedReviewedPresenceForEvidence_().record['Presence Record ID'], 'PRES-a6fc8b5a99b5f255');
  h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 2, getRow: () => 10 }) }) };
  assert.throws(() => h.c.requireSelectedReviewedPresenceForEvidence_(), /exactly one/);
});

test('menu/source enforce Evidence-only acceptance boundary and preserve old Prospect fixtures', () => {
  assert.match(menuSource, /Seed Selected Presence Evidence Drafts', 'seedSelectedPresenceEvidenceDrafts/);
  assert.doesNotMatch(evidenceSource, /approveSelected|persistApprovedFindingSetSnapshot_|buildGoldStandard|generateExecutive|Pdf|Preview|1aoOL0|FQ-2/i);
  assert.match(evidenceSource, /'Review Status': 'Draft'/);
  assert.match(evidenceSource, /method: 'get'/);
  assert.match(evidenceSource, /secure submission endpoint is not connected|presence\.Limitations/);
});
