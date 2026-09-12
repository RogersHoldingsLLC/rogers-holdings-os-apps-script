const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const sources = ['FindingQualityEngine.gs', 'PresenceInventoryEngine.gs', 'EvidenceDraftEngine.gs', 'DraftSuccessorEngine.gs', 'FindingDraftEngine.gs'];
const menuSource = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
const findingSource = fs.readFileSync(path.join(ROOT, 'FindingDraftEngine.gs'), 'utf8');
const ID = 'PROS-AF21065CD5C8';
const candidate = {
  title: 'Business Snapshot intake adds an email handoff',
  observation: 'The Business Snapshot form is not connected to a secure submission endpoint. It prepares an email for the visitor to review and send.',
  consequence: 'The extra step can cause prospective customers to abandon or incompletely send requests and makes lead tracking less dependable.',
  category: 'Contact Path / Lead Capture', confidence: 0.95
};
const limitation = 'Public pages verified reachable and ownership confirmed. The secure submission endpoint is not connected; the Business Snapshot form prepares an email for the customer to review and send. No submission was performed.';

function harness(options = {}) {
  const c = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(v => v > 127 ? v - 256 : v) },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    SpreadsheetApp: { flush() {} }, LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  sources.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }));
  c.MASTER_PROSPECT_SHEET = 'Master Prospect Tracker';

  const records = {};
  const trackerRows = options.duplicateProspect
    ? [[ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com'], [ID, 'Duplicate', 'https://www.rogersholdingsllc.com']]
    : [[ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com']];
  const tracker = { getRange: row => ({ getValues: () => [trackerRows[row - 2].slice()] }) };
  const workbook = { getSheetByName: name => name === c.MASTER_PROSPECT_SHEET ? tracker : null };
  function entry(name, rows = []) {
    const sheet = { records: rows.map(row => Object.assign({}, row)), getParent: () => workbook, getLastRow() { return this.records.length + 1; }, getRange(row) { return { setValues: values => { this.records[row - 2] = Object.fromEntries(Object.keys(this.records[row - 2] || {}).map((key, index) => [key, values[0][index]])); } }; }, deleteRow(row) { this.records.splice(row - 2, 1); } };
    records[name] = { sheet, table: { headerRow: 1, headers: {}, lastColumn: 40 } };
  }
  const context = { 'Context ID': 'CTX-REAL', 'Prospect ID': ID, Version: '1', 'Primary Service': 'Business Snapshot', 'Target Customer': 'Small business owners', 'Service Area': 'Kentucky and online', 'Desired Customer Action': 'Request a Business Snapshot', 'Primary Business Objective': 'Get more customers and build steady revenue as soon as possible.', 'Relevant Conversion Destination': 'https://rogersholdingsllc.com/business-snapshot/', 'Known Constraints': 'No guarantees', 'Industry Context': 'Business optimization', Source: 'Reviewed source', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-16T12:00:00Z' };
  const presence = { 'Presence Record ID': 'PRES-a6fc8b5a99b5f255', 'Prospect ID': ID, 'Inventory ID': 'INV-real', 'Inventory Version': '1', 'Channel Type': 'Website', 'Channel Name': 'Website', 'Presence State': 'Verified Present', 'Verified URL or Identifier': 'https://www.rogersholdingsllc.com', 'Ownership Confidence': 'High', 'Evidence Source': 'Public website and owner confirmation', 'Evidence Location': 'reviewed URLs', 'Captured At': '2026-08-17T11:28:48Z', Applicability: 'Applicable', 'Role in Customer Journey': 'Website and request path', Limitations: limitation, Notes: 'fixture', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17T12:00:00Z' };
  const evidenceBase = { 'Prospect ID': ID, 'Finding Set Candidate ID': '', 'Candidate Version': '', 'Source Type': 'Page Content', 'Page Path': '/', 'Element Type': 'Page', 'Captured At': '2026-08-17T12:48:14Z', 'Capture Method': 'Read-only HTTPS GET', 'Desktop/Mobile Context': 'Not Applicable', 'Evidence Excerpt': '', 'Screenshot Reference': '', 'Test Performed': 'Read-only page availability and HTML content check.', Confidence: 'High', 'Raw Artifact Reference': 'sha256:abc; presence:PRES-a6fc8b5a99b5f255', 'Acquisition Version': 'FQEVIDENCE:PRES-a6fc8b5a99b5f255:1:hash', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17T13:00:00Z' };
  const websiteEvidence = Object.assign({}, evidenceBase, { 'Evidence ID': 'EVID-WEBSITE', 'Source URL': 'https://www.rogersholdingsllc.com', 'Page Title': 'Rogers Holdings LLC', 'Element Label': 'Canonical website', 'Evidence Location': 'https://rogersholdingsllc.com/', 'Observed Value': 'The reviewed canonical website returned a readable HTML page.', 'Test Result': 'The reviewed canonical website returned a readable HTML page.', Limitations: 'Read-only page capture.' });
  const conversionEvidence = Object.assign({}, evidenceBase, { 'Evidence ID': 'EVID-CONVERSION', 'Source URL': 'https://rogersholdingsllc.com/business-snapshot/', 'Page Title': 'Business Snapshot', 'Page Path': '/business-snapshot/', 'Element Label': 'Business Snapshot conversion destination', 'Evidence Location': 'https://rogersholdingsllc.com/business-snapshot/', 'Observed Value': 'The reviewed conversion destination returned a readable HTML page.', 'Test Result': 'The reviewed conversion destination returned a readable HTML page.', Limitations: limitation });
  let evidence = options.evidence || [websiteEvidence, conversionEvidence];
  if (options.ambiguousEvidence) evidence = evidence.concat([Object.assign({}, conversionEvidence, { 'Evidence ID': 'EVID-DUP' })]);
  entry(c.FQ_CONTEXT_SHEET, options.contexts || [context]); entry(c.FQ_PRESENCE_SHEET, options.presences || [presence]); entry(c.FQ_EVIDENCE_SHEET, evidence);
  entry(c.FQ_FINDINGS_SHEET, options.existingDownstream ? [{ 'Finding ID': 'FND-OLD', 'Prospect ID': ID }] : [{ 'Finding ID': 'FND-SYNTH', 'Prospect ID': 'PROS-FQ1', 'Validation Codes': 'fixture' }]);
  entry(c.FQ_FINDING_SETS_SHEET, [{ 'Finding Set ID': 'FSET-SYNTH', 'Prospect ID': 'PROS-FQ1', Notes: 'fixture' }]);
  entry(c.FQ_RECOMMENDATIONS_SHEET, []); entry(c.FQ_ACTIONS_SHEET, []);
  const synthFindingBefore = JSON.stringify(records[c.FQ_FINDINGS_SHEET].sheet.records[0]);
  const synthSetBefore = JSON.stringify(records[c.FQ_FINDING_SETS_SHEET].sheet.records[0]);

  c.getExistingFindingQualityDraftSuccessorSchema_ = () => records;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.appendFindingQualityRecord_ = (sheet, _table, record) => { sheet.records.push(Object.assign({}, record)); return sheet.records.length + 1; };
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { sheet.records[row - 2] = Object.assign({}, record); };
  c.findFindingQualityRows_ = (sheet, _table, header, value) => sheet.records.filter(record => String(record[header]) === String(value)).map(record => Object.assign({}, record));
  c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Prospect ID': 1, Company: 2, Website: 3 }, lastColumn: 3 });
  c.findRowsByExactHeaderValue_ = (_sheet, _table, _header, value) => trackerRows.map((row, i) => row[0] === value ? i + 2 : -1).filter(row => row > 0);
  c.getValueByHeader_ = (row, headers, header) => row[headers[header] - 1];
  c.deleteExactOperationOwnedFindingQualityRow_ = (entryObj, idHeader, value) => { const i = entryObj.sheet.records.findIndex(record => String(record[idHeader]) === String(value)); if (i < 0) throw new Error('missing rollback'); entryObj.sheet.records.splice(i, 1); };
  c.validateAssessmentPresenceRecord_ = () => [];
  const selected = { ss: workbook, sheet: {}, table: { lastColumn: 26, headers: Object.fromEntries(c.FQ_EVIDENCE_COLUMNS.map((h, i) => [h, i + 1])) }, row: 3, record: Object.assign({}, conversionEvidence) };
  selected.sheet.getRange = () => ({ getValues: () => [c.FQ_EVIDENCE_COLUMNS.map(header => conversionEvidence[header] || '')] });
  return { c, records, selected, synthFindingBefore, synthSetBefore };
}

test('clean creation stages one Draft Finding Set and one Draft Finding with exact Evidence lineage', () => {
  const h = harness();
  const result = h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, candidate, {});
  assert.equal(result.status, 'completed');
  const findings = h.records[h.c.FQ_FINDINGS_SHEET].sheet.records.filter(record => record['Prospect ID'] === ID);
  const sets = h.records[h.c.FQ_FINDING_SETS_SHEET].sheet.records.filter(record => record['Prospect ID'] === ID);
  assert.equal(findings.length, 1); assert.equal(sets.length, 1);
  assert.equal(findings[0]['Finding State'], 'Draft'); assert.equal(findings[0]['Approval Status'], 'Not Reviewed');
  assert.equal(sets[0]['Review Status'], 'Draft'); assert.equal(sets[0]['Document Eligibility'], 'Not Eligible');
  assert.equal(findings[0]['Finding Title'], candidate.title); assert.equal(findings[0].Observation, candidate.observation); assert.equal(findings[0]['Business Consequence'], candidate.consequence);
  assert.equal(findings[0]['Evidence References'], 'EVID-WEBSITE, EVID-CONVERSION');
  assert.ok(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records.every(record => record['Finding Set Candidate ID'] === sets[0]['Finding Set ID'] && String(record['Candidate Version']) === '1'));
  assert.equal(JSON.stringify(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0]), h.synthFindingBefore);
  assert.equal(JSON.stringify(h.records[h.c.FQ_FINDING_SETS_SHEET].sheet.records[0]), h.synthSetBefore);
});

test('Reviewed authority, exact selected conversion Evidence, and complete unambiguous chain are required', () => {
  const base = harness();
  const cases = [
    { contexts: [] }, { presences: [] }, { ambiguousEvidence: true }, { duplicateProspect: true }, { existingDownstream: true },
    { evidence: base.records[base.c.FQ_EVIDENCE_SHEET].sheet.records.slice(0, 1) },
    { evidence: base.records[base.c.FQ_EVIDENCE_SHEET].sheet.records.map(record => Object.assign({}, record, { 'Review Status': 'Draft' })) }
  ];
  cases.forEach(options => {
    const h = harness(options); const before = JSON.stringify(h.records);
    assert.throws(() => h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, candidate, {}));
    assert.equal(JSON.stringify(h.records), before);
  });
});

test('unsupported category, confidence, severity, priority, score, financial, and guarantee claims fail closed', () => {
  const bad = [
    Object.assign({}, candidate, { category: 'Technical SEO' }), Object.assign({}, candidate, { confidence: 0.5 }),
    Object.assign({}, candidate, { consequence: 'This is a critical severity and top priority.' }),
    Object.assign({}, candidate, { consequence: 'This causes lost revenue and a lower conversion rate.' }),
    Object.assign({}, candidate, { observation: 'The score is 42 percent.' }), Object.assign({}, candidate, { title: 'Guaranteed improvement' })
  ];
  bad.forEach(value => { const h = harness(); assert.throws(() => h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, value, {}), /unsupported|supported|confidence/i); });
});

test('exact retry is idempotent and creates no duplicate Finding Set or Finding', () => {
  const h = harness();
  const first = h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, candidate, {});
  const counts = [h.records[h.c.FQ_FINDING_SETS_SHEET].sheet.records.length, h.records[h.c.FQ_FINDINGS_SHEET].sheet.records.length];
  const retry = h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, candidate, {});
  assert.equal(first.status, 'completed'); assert.equal(retry.status, 'already-completed');
  assert.deepEqual([h.records[h.c.FQ_FINDING_SETS_SHEET].sheet.records.length, h.records[h.c.FQ_FINDINGS_SHEET].sheet.records.length], counts);
});

test('partial failure rolls back operation-owned rows and restores Reviewed Evidence linkage exactly', () => {
  const h = harness(); const evidenceBefore = JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records);
  assert.throws(() => h.c.seedFindingQualityReviewedEvidenceDraftLocked_(h.selected, candidate, { afterWrite(count) { if (count === 2) throw new Error('injected'); } }), /injected/);
  assert.equal(JSON.stringify(h.records[h.c.FQ_EVIDENCE_SHEET].sheet.records), evidenceBefore);
  assert.equal(h.records[h.c.FQ_FINDING_SETS_SHEET].sheet.records.filter(record => record['Prospect ID'] === ID).length, 0);
  assert.equal(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records.filter(record => record['Prospect ID'] === ID).length, 0);
});

test('selected Evidence resolver supports hidden/reordered exact headers and rejects multi-row selection', () => {
  const h = harness(); const headers = ['Review Status', 'Evidence ID', 'Prospect ID']; const values = ['Reviewed', 'EVID-CONVERSION', ID];
  const sheet = { hiddenColumns: new Set([2]), getName: () => h.c.FQ_EVIDENCE_SHEET, getLastRow: () => 5, getRange: () => ({ getValues: () => [values] }) };
  h.c.FQ_EVIDENCE_COLUMNS = headers; h.c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Review Status': 1, 'Evidence ID': 2, 'Prospect ID': 3 }, lastColumn: 3 });
  h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 1, getRow: () => 5 }) }) };
  assert.equal(h.c.requireSelectedReviewedEvidenceForFinding_().record['Evidence ID'], 'EVID-CONVERSION');
  h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 2, getRow: () => 5 }) }) };
  assert.throws(() => h.c.requireSelectedReviewedEvidenceForFinding_(), /exactly one/);
});

test('menu and source prohibit recommendation, action, generation, production, approval, outreach, and FQ-2 side effects', () => {
  assert.match(menuSource, /Seed Reviewed Evidence Finding Draft', 'seedReviewedEvidenceFindingDraft/);
  assert.match(findingSource, /SEED FINDING DRAFT/); assert.match(findingSource, /'Finding State': 'Draft'/); assert.match(findingSource, /'Document Eligibility': 'Not Eligible'/);
  assert.doesNotMatch(findingSource, /appendFindingQualityRecord_\(schema\[FQ_RECOMMENDATIONS_SHEET|appendFindingQualityRecord_\(schema\[FQ_ACTIONS_SHEET|persistApproved|buildGoldStandard|generateExecutive|Gmail|Activity Feed|Pdf|Preview|1aoOL0|FQ-2/i);
});
