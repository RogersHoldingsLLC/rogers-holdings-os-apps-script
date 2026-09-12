const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const fqSource = fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8');
const presenceSource = fs.readFileSync(path.join(ROOT, 'PresenceInventoryEngine.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');

function harness(options = {}) {
  const c = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(value => value > 127 ? value - 256 : value)
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    SpreadsheetApp: { flush() {} },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  vm.runInContext(fqSource, c, { filename: 'FindingQualityEngine.gs' });
  vm.runInContext(presenceSource, c, { filename: 'PresenceInventoryEngine.gs' });

  const records = {};
  function entry(name, values = []) {
    const sheet = {
      records: values.map(value => Object.assign({}, value)),
      getLastRow() { return this.records.length + 1; },
      deleteRow(row) { this.records.splice(row - 2, 1); }
    };
    records[name] = { sheet, table: { headerRow: 1, headers: {}, lastColumn: 6 } };
  }
  const contextRecords = options.contexts || [{
    'Context ID': 'CTX-REAL-1', 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1',
    'Primary Service': 'Business Snapshot', 'Target Customer': 'Small business owners',
    'Service Area': 'Kentucky and online', 'Desired Customer Action': 'Request a Business Snapshot',
    'Primary Business Objective': 'Get more customers',
    'Relevant Conversion Destination': 'https://rogersholdingsllc.com/business-snapshot/',
    'Known Constraints': 'Do not promise results', 'Industry Context': 'Business optimization', Source: 'Reviewed source',
    'Review Status': 'Reviewed', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-16T12:00:00Z'
  }];
  entry(c.FQ_CONTEXT_SHEET, contextRecords);
  const synthetic = { 'Presence Record ID': 'PRES-SYNTHETIC', 'Prospect ID': 'PROS-FQ1', 'Inventory ID': 'INV-SYNTHETIC', 'Inventory Version': '2', 'Channel Type': 'Website', Notes: 'fixture unchanged' };
  entry(c.FQ_PRESENCE_SHEET, options.withSynthetic === false ? [] : [synthetic]);
  entry(c.FQ_EVIDENCE_SHEET, options.downstream ? [{ 'Evidence ID': 'EVID-REAL', 'Prospect ID': 'PROS-AF21065CD5C8' }] : []);
  entry(c.FQ_FINDINGS_SHEET, []); entry(c.FQ_FINDING_SETS_SHEET, []);
  entry(c.FQ_RECOMMENDATIONS_SHEET, []); entry(c.FQ_ACTIONS_SHEET, []);

  const trackerRows = [
    ['Rogers Holdings LLC', 'https://www.rogersholdingsllc.com', 'PROS-AF21065CD5C8']
  ];
  if (options.duplicateProspect) trackerRows.push(['Duplicate', 'https://duplicate.example', 'PROS-AF21065CD5C8']);
  const tracker = {
    getLastRow: () => trackerRows.length + 1,
    getRange(row) { return { getValues: () => [trackerRows[row - 2].slice()] }; }
  };
  const selected = {
    ss: {}, sheet: tracker, selectedRow: 2,
    table: { headerRow: 1, headers: { Company: 1, Website: 2, 'Prospect ID': 3 }, lastColumn: 3 },
    prospectId: options.missingId ? '' : 'PROS-AF21065CD5C8',
    prospect: { company: 'Rogers Holdings LLC', website: 'https://www.rogersholdingsllc.com', prospectId: 'PROS-AF21065CD5C8' }
  };

  c.getExistingFindingQualityDraftSuccessorSchema_ = () => records;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  c.appendFindingQualityRecord_ = (sheet, _table, record) => { sheet.records.push(Object.assign({}, record)); return sheet.records.length + 1; };
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.getValueByHeader_ = (row, headers, header) => row[headers[header] - 1];
  c.findRowsByExactHeaderValue_ = (_sheet, _table, _header, value) => trackerRows.map((row, index) => row[2] === value ? index + 2 : -1).filter(row => row > 0);
  c.normalizeWebsiteKey_ = value => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  return { c, records, selected, syntheticBefore: JSON.stringify(records[c.FQ_PRESENCE_SHEET].sheet.records[0] || null) };
}

test('clean Website Draft seeding is deterministic, not verified, and preserves synthetic fixtures', () => {
  const h = harness();
  const result = h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, { additionalChannels: [] }, {});
  assert.equal(result.status, 'completed');
  const all = h.records[h.c.FQ_PRESENCE_SHEET].sheet.records;
  assert.equal(JSON.stringify(all[0]), h.syntheticBefore);
  const seeded = all[1];
  assert.equal(seeded['Prospect ID'], 'PROS-AF21065CD5C8');
  assert.equal(seeded['Channel Type'], 'Website');
  assert.equal(seeded['Presence State'], 'Not Verified');
  assert.equal(seeded['Review Status'], 'Draft');
  assert.equal(seeded['Reviewed By'], '');
  assert.match(seeded.Notes, /FQPRESENCE:PROS-AF21065CD5C8:1/);
  assert.match(seeded['Evidence Location'], /business-snapshot/);
});

test('exact retry is idempotent and creates no duplicate Presence records', () => {
  const h = harness();
  const first = h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, {}, {});
  const count = h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length;
  const retry = h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, {}, {});
  assert.equal(first.status, 'completed');
  assert.equal(retry.status, 'already-completed');
  assert.equal(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length, count);
});

test('Reviewed current Business Context is required and stale or duplicate context fails closed', () => {
  for (const contexts of [
    [],
    [{ 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1', 'Review Status': 'Draft' }],
    [
      { 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': 'date' },
      { 'Prospect ID': 'PROS-AF21065CD5C8', Version: '2', 'Review Status': 'Draft' }
    ],
    [
      { 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': 'date' },
      { 'Prospect ID': 'PROS-AF21065CD5C8', Version: '1', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': 'date' }
    ]
  ]) {
    const h = harness({ contexts });
    assert.throws(() => h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, {}, {}), /Reviewed Business Context|required|stale|ambiguous/i);
    assert.equal(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length, 1);
  }
});

test('missing or ambiguous Prospect ID and downstream state fail closed without writes', () => {
  for (const options of [{ missingId: true }, { duplicateProspect: true }, { downstream: true }]) {
    const h = harness(options);
    assert.throws(() => h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, {}, {}));
    assert.equal(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length, 1);
  }
});

test('unsupported additional channels require explicit facts and provenance', () => {
  const h = harness();
  assert.throws(() => h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, { additionalChannels: [{ channelType: 'Google Business Profile' }] }, {}), /explicit operator-provided facts/);
  assert.equal(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length, 1);
});

test('partial failure rolls back only the operation-owned Presence row', () => {
  const h = harness();
  assert.throws(() => h.c.seedFindingQualityPresenceInventoryLocked_(h.selected, {}, { afterWrite() { throw new Error('injected'); } }), /injected/);
  assert.equal(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records.length, 1);
  assert.equal(JSON.stringify(h.records[h.c.FQ_PRESENCE_SHEET].sheet.records[0]), h.syntheticBefore);
});

test('menu and source exclude review, downstream generation, production, and FQ-2 actions', () => {
  assert.match(menuSource, /Seed Selected Prospect Presence Inventory', 'seedSelectedProspectPresenceInventory/);
  assert.match(presenceSource, /requireSelectedFindingQualityProspect_\(\)/);
  assert.doesNotMatch(presenceSource, /approveSelected|persistApprovedFindingSetSnapshot_|buildGoldStandard|generateExecutive|Pdf|Preview|1aoOL0|FQ-2/i);
  assert.match(presenceSource, /'Presence State': 'Not Verified'/);
  assert.match(presenceSource, /'Review Status': 'Draft'/);
});
