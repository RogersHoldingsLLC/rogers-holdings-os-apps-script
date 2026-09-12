const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const fqSource = fs.readFileSync(path.join(root, 'FindingQualityEngine.gs'), 'utf8');
const successorSource = fs.readFileSync(path.join(root, 'DraftSuccessorEngine.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');

function load() {
  const context = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite,
    console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(value => value > 127 ? value - 256 : value),
      getUuid: () => 'unused'
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    SpreadsheetApp: { flush() {} }
  });
  vm.runInContext(fqSource, context, { filename: 'FindingQualityEngine.gs' });
  vm.runInContext(successorSource, context, { filename: 'DraftSuccessorEngine.gs' });
  return context;
}

function evidence(overrides = {}) {
  return Object.assign({
    'Evidence ID': 'EVID-WEB-1', 'Prospect ID': 'PROS-FQ1', 'Finding Set Candidate ID': 'FSET-WEBGBP-1', 'Candidate Version': '1',
    'Source Type': 'Element Inspection', 'Source URL': 'https://fixture-web-gbp.example/services', 'Page Title': 'Services', 'Page Path': '/services',
    'Element Type': 'Primary navigation', 'Element Label': 'Services page navigation', 'Evidence Location': 'Services page primary navigation',
    'Captured At': '2026-08-13T18:00:00Z', 'Capture Method': 'Element inspection', 'Desktop/Mobile Context': 'Both',
    'Evidence Excerpt': 'Services and About are present; no contact or request-service destination is shown.', 'Observed Value': '',
    'Test Performed': 'Non-submitting navigation review', 'Test Result': 'No direct route to inquiry form', Confidence: 0.95,
    Limitations: 'Fictional public-page evidence', 'Acquisition Version': 'manual-fixture-v1', 'Review Status': 'Reviewed',
    'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-13T19:00:00Z'
  }, overrides);
}

function harness() {
  const c = load();
  const fingerprint = '5f5ed13f329fe13878b4546fc16ab0bc88ef83e6787af510315dfd5f3fd28645';
  const sheets = {};
  function entry(name, records) {
    const sheet = { name, records, getLastRow: () => records.length + 1, deleteRow: row => records.splice(row - 2, 1) };
    const value = { sheet, table: { headers: {}, lastColumn: 1 } };
    sheets[name] = value;
    return value;
  }
  const sets = entry(c.FQ_FINDING_SETS_SHEET, [
    { 'Finding Set ID': 'FSET-WEBGBP-1', 'Prospect ID': 'PROS-FQ1', Version: '1', 'Review Status': 'Approved for Client', 'Approval Status': 'Approved for Client', 'Document Eligibility': 'Eligible', 'Immutable Hash': fingerprint, 'Snapshot File ID': 'SNAP-1', 'Approved At': '2026-08-14T02:11:31.325Z', 'Finding IDs': 'FND-VALID-1', 'Evidence References': 'EVID-WEB-1', 'Business Context Version': '1', 'Presence Inventory Version': '1' },
    { 'Finding Set ID': 'FSET-WEBGBP-1', 'Prospect ID': 'PROS-FQ1', Version: '2', 'Review Status': 'Draft', 'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible', 'Supersedes Version': '1', 'Business Context Version': '1', 'Presence Inventory Version': '1', 'Evidence References': 'EVID-WEB-1', 'Finding IDs': 'COPIED-FINDING', Notes: '' }
  ]);
  entry(c.FQ_CONTEXT_SHEET, [{ 'Context ID': 'CTX-V1', 'Prospect ID': 'PROS-FQ1', Version: '1', 'Primary Service': 'Old service', 'Target Customer': 'Old customer', 'Service Area': 'Acceptance County', 'Desired Customer Action': 'Old action', 'Primary Business Objective': 'Old goal', 'Relevant Conversion Destination': 'https://fixture-web-gbp.example/request', 'Known Constraints': 'Old constraint', 'Industry Context': 'Local service', Source: 'Owner confirmed', 'Review Status': 'Reviewed' }]);
  entry(c.FQ_PRESENCE_SHEET, [
    { 'Presence Record ID': 'PRES-WEB-1', 'Prospect ID': 'PROS-FQ1', 'Inventory ID': 'INV-1', 'Inventory Version': '1', 'Channel Type': 'Website', 'Channel Name': 'Website', 'Presence State': 'Verified Present', 'Verified URL or Identifier': 'https://fixture-web-gbp.example', 'Ownership Confidence': 'High', 'Evidence Source': 'Reviewed public source', 'Evidence Location': 'Website', 'Captured At': '2026-08-13', Applicability: 'Applicable', 'Role in Customer Journey': 'Old role', Limitations: '', 'Review Status': 'Reviewed' },
    { 'Presence Record ID': 'PRES-GBP-1', 'Prospect ID': 'PROS-FQ1', 'Inventory ID': 'INV-1', 'Inventory Version': '1', 'Channel Type': 'Google Business Profile', 'Channel Name': 'Google Business Profile', 'Presence State': 'Verified Present', 'Verified URL or Identifier': 'GBP-FIXTURE', 'Ownership Confidence': 'High', 'Evidence Source': 'Reviewed public source', 'Evidence Location': 'Google listing', 'Captured At': '2026-08-13', Applicability: 'Applicable', 'Role in Customer Journey': 'Old role', Limitations: 'Basic presence only; no deep GBP audit.', 'Review Status': 'Reviewed' }
  ]);
  entry(c.FQ_EVIDENCE_SHEET, [evidence()]);
  entry(c.FQ_FINDINGS_SHEET, [{ 'Finding ID': 'COPIED-FINDING', 'Prospect ID': 'PROS-FQ1', 'Finding Set ID': 'FSET-WEBGBP-1', 'Finding Set Version': '2', 'Finding State': 'Draft', 'Approval Status': 'Not Reviewed' }]);
  entry(c.FQ_RECOMMENDATIONS_SHEET, []);
  entry(c.FQ_ACTIONS_SHEET, []);

  c.getExistingFindingQualityDraftSuccessorSchema_ = () => sheets;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  c.findFindingQualityRows_ = (sheet, _table, header, value) => sheet.records.filter(record => String(record[header]) === String(value)).map(record => Object.assign({}, record));
  c.appendFindingQualityRecord_ = (sheet, _table, record) => { sheet.records.push(Object.assign({}, record)); return sheet.records.length + 1; };
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { sheet.records[row - 2] = Object.assign({}, record); };
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.deleteExactOperationOwnedFindingQualityRow_ = (ent, header, id) => { const indexes = ent.sheet.records.map((record, index) => String(record[header]) === String(id) ? index : -1).filter(index => index >= 0); if (indexes.length !== 1) throw new Error('ambiguous rollback'); ent.sheet.records.splice(indexes[0], 1); };
  c.loadApprovedFindingSetForGeneration_ = () => ({ reviewedInput: { evidence: [Object.assign({ key: 'EVID-WEB-1' }, c.findingQualitySnapshotEvidence_(evidence()))] } });
  const selectedSheet = sets.sheet;
  selectedSheet.getRange = row => ({
    getValues: () => [[Object.assign({}, selectedSheet.records[row - 2])]],
    setValues: values => { const record = Array.isArray(values[0]) ? values[0][0] : values[0]; selectedSheet.records[row - 2] = Object.assign({}, record); }
  });
  const selected = { ss: {}, sheet: selectedSheet, table: sets.table, row: 3, record: Object.assign({}, selectedSheet.records[1]) };
  return { c, sheets, selected, request: c.fq1PlainLanguageDraftSuccessorRequest_() };
}

test('stable evidence IDs resolve across versions without Candidate Version equality', () => {
  const c = load();
  const reused = c.resolveFindingQualityEvidenceReferences_([evidence()], ['EVID-WEB-1'], 'PROS-FQ1', 'FSET-WEBGBP-1');
  assert.equal(reused.length, 1);
  assert.equal(reused[0]['Candidate Version'], '1');
  assert.throws(() => c.resolveFindingQualityEvidenceReferences_([evidence({ 'Prospect ID': 'OTHER' })], ['EVID-WEB-1'], 'PROS-FQ1', 'FSET-WEBGBP-1'), /different prospect/);
  assert.throws(() => c.resolveFindingQualityEvidenceReferences_([evidence(), evidence()], ['EVID-WEB-1'], 'PROS-FQ1', 'FSET-WEBGBP-1'), /ambiguous/);
  assert.throws(() => c.resolveFindingQualityEvidenceReferences_([evidence()], ['EVID-WEB-1', 'EVID-WEB-1'], 'PROS-FQ1', 'FSET-WEBGBP-1'), /unique/);
});

test('actual acceptance evidence representation canonicalizes to the approved snapshot without weakening facts', () => {
  const c = load();
  const record = evidence();
  const workbookProjection = c.findingQualitySnapshotEvidence_(record);
  const snapshotProjection = Object.assign({}, workbookProjection, {
    candidateVersion: '1', screenshotReference: '', rawArtifactReference: '',
    limitations: ['Fictional public-page evidence'], reviewedAt: '2026-08-14T01:59:05.571Z'
  });
  workbookProjection.reviewedAt = new Date('2026-08-14T01:59:05.571Z');
  assert.doesNotThrow(() => c.assertFindingQualityEvidenceMatchesApprovedSnapshot_([Object.assign({}, record, { 'Reviewed At': new Date('2026-08-14T01:59:05.571Z') })], [snapshotProjection]));
  for (const changed of [
    Object.assign({}, snapshotProjection, { testResult: 'No direct route to inquiry form.' }),
    Object.assign({}, snapshotProjection, { sourceUrl: '' }),
    Object.assign({}, snapshotProjection, { rawArtifactReference: 'unexpected-value' })
  ]) assert.throws(() => c.assertFindingQualityEvidenceMatchesApprovedSnapshot_([Object.assign({}, record, { 'Reviewed At': new Date('2026-08-14T01:59:05.571Z') })], [changed]), /no longer matches/);
  assert.equal(record['Test Result'], 'No direct route to inquiry form');
  assert.equal(record.Limitations, 'Fictional public-page evidence');
});

test('Draft successor completes atomically, preserves v1 and evidence, and retry is idempotent', () => {
  const h = harness();
  const v1Before = JSON.stringify(h.sheets[h.c.FQ_FINDING_SETS_SHEET].sheet.records[0]);
  const evidenceBefore = JSON.stringify(h.sheets[h.c.FQ_EVIDENCE_SHEET].sheet.records);
  const first = h.c.seedFindingQualityDraftSuccessorLocked_(h.selected, h.request, {});
  assert.equal(first.status, 'completed');
  assert.equal(JSON.stringify(h.sheets[h.c.FQ_FINDING_SETS_SHEET].sheet.records[0]), v1Before);
  assert.equal(JSON.stringify(h.sheets[h.c.FQ_EVIDENCE_SHEET].sheet.records), evidenceBefore);
  assert.equal(h.sheets[h.c.FQ_CONTEXT_SHEET].sheet.records.filter(r => String(r.Version) === '2').length, 1);
  assert.equal(h.sheets[h.c.FQ_PRESENCE_SHEET].sheet.records.filter(r => String(r['Inventory Version']) === '2').length, 2);
  assert.equal(h.sheets[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.length, 1);
  assert.equal(h.sheets[h.c.FQ_ACTIONS_SHEET].sheet.records.length, 1);
  const current = h.sheets[h.c.FQ_FINDING_SETS_SHEET].sheet.records[1];
  h.selected.record = Object.assign({}, current);
  const second = h.c.seedFindingQualityDraftSuccessorLocked_(h.selected, h.request, {});
  assert.equal(second.status, 'already-completed');
  assert.equal(h.sheets[h.c.FQ_CONTEXT_SHEET].sheet.records.filter(r => String(r.Version) === '2').length, 1);
  assert.equal(current['Review Status'], 'Draft');
  assert.equal(current['Approval Status'], 'Not Reviewed');
  assert.equal(current['Snapshot File ID'] || '', '');
});

test('partial failure rolls back only operation-owned writes and restores the Draft set', () => {
  const h = harness();
  const before = {};
  for (const [name, entry] of Object.entries(h.sheets)) before[name] = JSON.stringify(entry.sheet.records);
  assert.throws(() => h.c.seedFindingQualityDraftSuccessorLocked_(h.selected, h.request, { afterChildWrites() { throw new Error('injected failure'); } }), /injected failure/);
  for (const [name, entry] of Object.entries(h.sheets)) assert.equal(JSON.stringify(entry.sheet.records), before[name], name);
});

test('boundary excludes review, approval, snapshots, previews, PDFs, production, and FQ-2', () => {
  assert.match(menuSource, /Seed Selected Plain-Language Draft Successor', 'seedSelectedPlainLanguageDraftSuccessor/);
  assert.doesNotMatch(successorSource, /approveSelected|persistApprovedFindingSetSnapshot_|buildGoldStandard|Pdf|Preview|production|FQ-2/);
  assert.match(successorSource, /Review Status': 'Draft'/);
  assert.match(successorSource, /Approval Status': 'Not Reviewed'/);
});

test('legacy Recommendation schema may omit only the new trailing Limitations header before first transactional migration', () => {
  assert.match(successorSource, /FQ_RECOMMENDATIONS_SHEET && header === 'Limitations' && !headers\[index\]/);
});
