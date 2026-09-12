const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const sourceFiles = ['FindingQualityEngine.gs', 'PresenceInventoryEngine.gs', 'EvidenceDraftEngine.gs', 'DraftSuccessorEngine.gs', 'FindingDraftEngine.gs', 'RecommendationDraftEngine.gs'];
const menuSource = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');
const recommendationSource = fs.readFileSync(path.join(ROOT, 'RecommendationDraftEngine.gs'), 'utf8');
const ID = 'PROS-AF21065CD5C8';
const candidate = {
  title: 'Connect the Business Snapshot form to secure direct submission',
  recommendedAction: 'Connect the Business Snapshot form to a secure submission system so customers can submit directly from the website. Each valid submission should create the appropriate linked intake records, preserve explicit consent, notify Rogers Holdings, and show the customer a clear confirmation without requiring them to send an email manually.',
  implementationLocation: 'Business Snapshot form submission workflow',
  intendedOutcome: 'Create a simpler and more dependable lead-capture path with structured intake records and auditable follow-up.',
  dependencies: '',
  limitations: 'Do not promise increased revenue, conversion rates, lead volume, or guaranteed results. Implementation and end-to-end submission testing have not yet occurred.'
};

function harness(options = {}) {
  const c = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(v => v > 127 ? v - 256 : v) },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) }, SpreadsheetApp: { flush() {} },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  sourceFiles.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }));
  c.MASTER_PROSPECT_SHEET = 'Master Prospect Tracker';
  const records = {};
  const trackerRows = options.duplicateProspect ? [[ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com'], [ID, 'Duplicate', 'https://www.rogersholdingsllc.com']] : [[ID, 'Rogers Holdings LLC', 'https://www.rogersholdingsllc.com']];
  const tracker = { getRange: row => ({ getValues: () => [trackerRows[row - 2].slice()] }) };
  const workbook = { getSheetByName: name => name === c.MASTER_PROSPECT_SHEET ? tracker : null };
  function entry(name, columns, rows = [], needsLimitationsHeader = false) {
    const state = { headerInstalled: !needsLimitationsHeader };
    const sheet = {
      records: rows.map(row => Object.assign({}, row)), getParent: () => workbook, getLastRow() { return this.records.length + 1; },
      deleteRow(row) { this.records.splice(row - 2, 1); },
      getRange(row, column, rowCount, columnCount) {
        return {
          setValue: value => { if (row === 1 && column === columns.indexOf('Limitations') + 1 && value === 'Limitations') state.headerInstalled = true; },
          clearContent: () => { if (row === 1 && column === columns.indexOf('Limitations') + 1) state.headerInstalled = false; },
          getDisplayValues: () => {
            if (row === 1) return [columns.map(header => header === 'Limitations' && !state.headerInstalled ? '' : header)];
            if (column === columns.indexOf('Limitations') + 1) return Array.from({ length: rowCount || 1 }, (_, i) => [String((sheet.records[row - 2 + i] || {}).Limitations || '')]);
            return [[]];
          },
          getValues: () => [columns.map(header => (sheet.records[row - 2] || {})[header] || '')],
          setValues: values => { sheet.records[row - 2] = Object.fromEntries(columns.map((header, i) => [header, values[0][i]])); }
        };
      }
    };
    records[name] = { sheet, table: { headerRow: 1, headers: Object.fromEntries(columns.map((header, i) => [header, i + 1])), lastColumn: columns.length }, needsLimitationsHeader, state };
  }
  const context = { 'Context ID': 'CTX-REAL', 'Prospect ID': ID, Version: '1', 'Primary Service': 'Business Snapshot', 'Target Customer': 'Small business owners', 'Service Area': 'Kentucky and online', 'Desired Customer Action': 'Request a Business Snapshot', 'Primary Business Objective': 'Get more customers', 'Relevant Conversion Destination': 'https://rogersholdingsllc.com/business-snapshot/', 'Known Constraints': 'No guarantees', 'Industry Context': 'Consulting', Source: 'Reviewed', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-16T12:00:00Z' };
  const presence = { 'Presence Record ID': 'PRES-REAL', 'Prospect ID': ID, 'Inventory ID': 'INV-REAL', 'Inventory Version': '1', 'Channel Type': 'Website', 'Channel Name': 'Website', 'Presence State': 'Verified Present', 'Verified URL or Identifier': 'https://www.rogersholdingsllc.com', 'Ownership Confidence': 'High', 'Evidence Source': 'Reviewed', 'Evidence Location': 'URLs', 'Captured At': '2026-08-17', Applicability: 'Applicable', 'Role in Customer Journey': 'Request path', Limitations: 'Email fallback', Notes: '', 'Review Status': 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17' };
  const evidence = ['EVID-WEBSITE', 'EVID-CONVERSION'].map((evidenceId, index) => ({ 'Evidence ID': evidenceId, 'Prospect ID': ID, 'Finding Set Candidate ID': 'FSET-a2ae86fa62d97824', 'Candidate Version': '1', 'Source Type': 'Page Content', 'Source URL': index ? 'https://rogersholdingsllc.com/business-snapshot/' : 'https://www.rogersholdingsllc.com', 'Page Title': index ? 'Business Snapshot' : 'Website', 'Page Path': index ? '/business-snapshot/' : '/', 'Element Type': 'Page', 'Element Label': index ? 'Business Snapshot conversion destination' : 'Canonical website', 'Evidence Location': 'URL', 'Captured At': '2026-08-17', 'Capture Method': 'Read-only GET', 'Desktop/Mobile Context': 'Not Applicable', 'Observed Value': 'Readable HTML page.', 'Test Performed': 'Page check', 'Test Result': 'Readable HTML page.', Confidence: 'High', Limitations: 'Email fallback', 'Raw Artifact Reference': 'sha256:x; presence:PRES-REAL', 'Acquisition Version': 'FQEVIDENCE:REAL', 'Review Status': options.evidenceDraft ? 'Draft' : 'Reviewed', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17' }));
  const finding = { 'Finding ID': 'FND-24cd3f413759a988', 'Prospect ID': ID, 'Finding Set ID': 'FSET-a2ae86fa62d97824', 'Finding Set Version': '1', Category: 'Contact Path / Lead Capture', 'Finding Title': 'Business Snapshot intake adds an email handoff', 'Finding State': options.findingState || 'In Review', 'Channel Type': 'Website', 'Presence State': 'Verified Present', 'Customer Journey Stage': 'Request a Business Snapshot', 'Business Objective': 'Get more customers', 'Evidence Source': 'Page Content', 'Evidence Location': 'https://rogersholdingsllc.com/business-snapshot/', 'Evidence Observed At': '2026-08-17', 'Evidence Excerpt': 'Readable page', Observation: 'The Business Snapshot form is not connected to a secure submission endpoint. It prepares an email for the visitor to review and send.', 'Expected Condition': '', 'Business Consequence': 'The extra step can cause prospective customers to abandon or incompletely send requests and makes lead tracking less dependable.', 'Consequence Basis': '', 'Recommended Action': '', 'Implementation Location': '', 'Intended Outcome': '', 'Completion Test': '', 'Evidence Confidence': 0.9, 'Evidence References': 'EVID-WEBSITE, EVID-CONVERSION', Limitations: 'Email fallback', 'Recommendation ID': '', 'Reviewed By': 'brian', 'Reviewed At': '2026-08-17', 'Approval Status': options.findingState === 'Draft' ? 'Not Reviewed' : 'In Review', 'Approved Version': '', 'Validation Codes': '' };
  const set = { 'Finding Set ID': 'FSET-a2ae86fa62d97824', 'Prospect ID': ID, Version: '1', 'Created At': '2026-08-17', 'Created By': 'brian', 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Approved At': '', 'Approval Status': 'Not Reviewed', 'Business Context Version': '1', 'Presence Inventory Version': '1', 'Evidence References': 'EVID-WEBSITE, EVID-CONVERSION', 'Finding IDs': finding['Finding ID'], 'Document Eligibility': 'Not Eligible', 'Supersedes Version': '', 'Immutable Hash': '', 'Snapshot File ID': '', Limitations: 'Email fallback', Notes: 'Operation fixture' };
  const syntheticRec = { 'Recommendation ID': 'REC-SYNTH', 'Prospect ID': 'PROS-FQ1', Title: 'fixture' };
  entry(c.FQ_CONTEXT_SHEET, c.FQ_CONTEXT_COLUMNS, options.contexts || [context]); entry(c.FQ_PRESENCE_SHEET, c.FQ_PRESENCE_COLUMNS, options.presences || [presence]); entry(c.FQ_EVIDENCE_SHEET, c.FQ_EVIDENCE_COLUMNS, options.evidence || evidence); entry(c.FQ_FINDINGS_SHEET, c.FQ_FINDING_COLUMNS, options.duplicateFinding ? [finding, Object.assign({}, finding)] : [finding]); entry(c.FQ_FINDING_SETS_SHEET, c.FQ_FINDING_SET_COLUMNS, options.sets || [set]); entry(c.FQ_RECOMMENDATIONS_SHEET, c.FQ_RECOMMENDATION_COLUMNS, options.existingRecommendation ? [syntheticRec, { 'Recommendation ID': 'REC-OLD', 'Prospect ID': ID, 'Finding ID': finding['Finding ID'] }] : [syntheticRec], true); entry(c.FQ_ACTIONS_SHEET, c.FQ_ACTION_COLUMNS, options.existingAction ? [{ 'Action ID': 'ACT-OLD', 'Prospect ID': ID }] : []);
  const syntheticBefore = JSON.stringify(records[c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]);
  c.getFindingQualityRecommendationDraftSchema_ = () => records;
  c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  c.readFindingQualityRecordsWithRows_ = entryObj => entryObj.sheet.records.map((record, index) => Object.assign({}, record, { _row: index + 2 }));
  c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  c.appendFindingQualityRecord_ = (sheet, _table, record) => { sheet.records.push(Object.assign({}, record)); return sheet.records.length + 1; };
  c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { const clean = Object.assign({}, record); delete clean._row; sheet.records[row - 2] = clean; };
  c.findFindingQualityRows_ = (sheet, _table, header, value) => sheet.records.filter(record => String(record[header]) === String(value)).map(record => Object.assign({}, record));
  c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Prospect ID': 1, Company: 2, Website: 3 }, lastColumn: 3 }); c.findRowsByExactHeaderValue_ = (_s, _t, _h, value) => trackerRows.map((row, i) => row[0] === value ? i + 2 : -1).filter(row => row > 0); c.getValueByHeader_ = (row, headers, header) => row[headers[header] - 1]; c.validateAssessmentPresenceRecord_ = () => [];
  const selected = { ss: workbook, sheet: {}, table: { lastColumn: c.FQ_FINDING_COLUMNS.length, headers: Object.fromEntries(c.FQ_FINDING_COLUMNS.map((h, i) => [h, i + 1])) }, row: 2, record: Object.assign({}, finding) };
  selected.sheet.getRange = () => ({ getValues: () => [c.FQ_FINDING_COLUMNS.map(header => finding[header] || '')] });
  return { c, records, selected, finding, set, syntheticBefore };
}

test('clean creation writes one Draft Recommendation, installs Limitations, and links only Recommendation ID', () => {
  const h = harness(); const findingBefore = Object.assign({}, h.finding);
  const result = h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, candidate, {});
  assert.equal(result.status, 'completed');
  const recommendations = h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.filter(record => record['Prospect ID'] === ID);
  assert.equal(recommendations.length, 1); assert.equal(recommendations[0]['Review Status'], 'Draft'); assert.equal(recommendations[0].Limitations, candidate.limitations);
  const persistedFinding = h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0];
  assert.equal(persistedFinding['Recommendation ID'], recommendations[0]['Recommendation ID']);
  h.c.FQ_FINDING_COLUMNS.filter(field => field !== 'Recommendation ID').forEach(field => assert.equal(String(persistedFinding[field] || ''), String(findingBefore[field] || ''), field));
  assert.equal(h.records[h.c.FQ_ACTIONS_SHEET].sheet.records.length, 0); assert.equal(JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]), h.syntheticBefore);
});

test('In Review Finding, Draft set, Reviewed Context/Presence/Evidence, and unique identity are required', () => {
  const cases = [{ findingState: 'Draft' }, { contexts: [] }, { presences: [] }, { evidenceDraft: true }, { sets: [] }, { duplicateFinding: true }, { duplicateProspect: true }, { existingRecommendation: true }, { existingAction: true }];
  cases.forEach(options => { const h = harness(options); const before = JSON.stringify(h.records); assert.throws(() => h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, candidate, {})); assert.equal(JSON.stringify(h.records), before); });
});

test('unsupported claims and missing required recommendation fields fail closed', () => {
  const bad = [Object.assign({}, candidate, { title: 'Top priority fix' }), Object.assign({}, candidate, { intendedOutcome: 'Increase revenue by 20 percent.' }), Object.assign({}, candidate, { recommendedAction: 'Guarantee a higher conversion rate.' }), Object.assign({}, candidate, { implementationLocation: '' }), Object.assign({}, candidate, { limitations: 'No limits.' })];
  bad.forEach(value => { const h = harness(); assert.throws(() => h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, value, {}), /unsupported|requires|limitations/i); });
});

test('exact retry is idempotent and creates no duplicate Recommendation or Action', () => {
  const h = harness(); h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, candidate, {}); const count = h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.length;
  const retry = h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, candidate, {});
  assert.equal(retry.status, 'already-completed'); assert.equal(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.length, count); assert.equal(h.records[h.c.FQ_ACTIONS_SHEET].sheet.records.length, 0);
});

test('persisted real Recommendation identity ignores later Finding audit columns but rejects immutable changes', () => {
  const h = harness();
  const normalized = h.c.normalizeRecommendationDraftCandidate_(candidate);
  const authority = h.c.resolveRecommendationDraftAuthority_(h.records, h.finding);
  const original = h.c.buildRecommendationDraftOperationIdentity_(h.finding, authority, normalized);
  const withLaterAuditColumns = Object.assign({}, h.finding, {
    'Approval Operation Key': '',
    'Future Approval Audit Column': ''
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(h.c.buildRecommendationDraftOperationIdentity_(withLaterAuditColumns, authority, normalized))),
    JSON.parse(JSON.stringify(original))
  );
  assert.equal(Object.prototype.hasOwnProperty.call(h.c.recommendationDraftFindingAuthorityProjection_(withLaterAuditColumns), 'Approval Operation Key'), false);
  assert.notEqual(h.c.buildRecommendationDraftOperationIdentity_(Object.assign({}, h.finding, { Limitations: h.finding.Limitations + ' Changed.' }), authority, normalized).operationKey, original.operationKey);
  assert.notEqual(h.c.buildRecommendationDraftOperationIdentity_(Object.assign({}, h.finding, { 'Prospect ID': 'PROS-CROSS' }), authority, normalized).operationKey, original.operationKey);
  assert.notEqual(h.c.buildRecommendationDraftOperationIdentity_(h.finding, authority, Object.assign({}, normalized, { limitations: normalized.limitations + ' Changed.' })).operationKey, original.operationKey);
});

test('Recommendation candidate identity uses immutable content only and normalizes display representation', () => {
  const h = harness();
  const record = {
    Title: '  ' + candidate.title + '  ',
    'Recommended Action': candidate.recommendedAction.replace(/ /g, '  '),
    'Implementation Location': candidate.implementationLocation,
    'Intended Outcome': candidate.intendedOutcome,
    Dependencies: null,
    Limitations: candidate.limitations,
    'Review Status': 'Reviewed',
    'Reviewed By': 'briankeith@rogersholdingsllc.com',
    'Reviewed At': new Date('2026-08-17T18:14:43.761Z'),
    'Review Operation Key': 'FQRECOMMENDATIONREVIEW:REC-f5bed865a14ef641:f5bed865a14ef641'
  };
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.recommendationDraftCandidateFromRecord_(record))), candidate);
  record['Reviewed At'] = new Date('2027-01-01T00:00:00Z');
  record['Review Operation Key'] = 'later-review-audit';
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.recommendationDraftCandidateFromRecord_(record))), candidate);
});

test('partial failure removes operation Recommendation, restores Finding and schema header, and preserves synthetic fixture', () => {
  const h = harness(); const findingBefore = h.c.FQ_FINDING_COLUMNS.map(field => String(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0][field] || ''));
  assert.throws(() => h.c.seedFindingQualityRecommendationDraftLocked_(h.selected, candidate, { afterFindingLink() { throw new Error('injected'); } }), /injected/);
  assert.deepEqual(h.c.FQ_FINDING_COLUMNS.map(field => String(h.records[h.c.FQ_FINDINGS_SHEET].sheet.records[0][field] || '')), findingBefore); assert.equal(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records.length, 1); assert.equal(JSON.stringify(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].sheet.records[0]), h.syntheticBefore); assert.equal(h.records[h.c.FQ_RECOMMENDATIONS_SHEET].state.headerInstalled, false);
});

test('selected Finding resolver supports hidden/reordered exact headers and rejects multi-row selection', () => {
  const h = harness(); const headers = ['Approval Status', 'Finding ID', 'Prospect ID']; const values = ['In Review', h.finding['Finding ID'], ID]; const sheet = { hiddenColumns: new Set([2]), getName: () => h.c.FQ_FINDINGS_SHEET, getLastRow: () => 8, getRange: () => ({ getValues: () => [values] }) };
  h.c.FQ_FINDING_COLUMNS = headers; h.c.getHeaderTable_ = () => ({ headerRow: 1, headers: { 'Approval Status': 1, 'Finding ID': 2, 'Prospect ID': 3 }, lastColumn: 3 }); h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 1, getRow: () => 8 }) }) };
  assert.equal(h.c.requireSelectedInReviewFindingForRecommendation_().record['Finding ID'], h.finding['Finding ID']); h.c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveRange: () => ({ getSheet: () => sheet, getNumRows: () => 2, getRow: () => 8 }) }) }; assert.throws(() => h.c.requireSelectedInReviewFindingForRecommendation_(), /exactly one/);
});

test('menu/source prohibit Action, approval, document, production, outreach, website, and FQ-2 side effects', () => {
  assert.match(menuSource, /Seed Selected Finding Recommendation Draft', 'seedSelectedFindingRecommendationDraft/); assert.match(recommendationSource, /SEED RECOMMENDATION DRAFT/); assert.match(recommendationSource, /'Review Status': 'Draft'/);
  assert.doesNotMatch(recommendationSource, /appendFindingQualityRecord_\(schema\[FQ_ACTIONS_SHEET|persistApproved|buildGoldStandard|generateExecutive|Gmail|Activity Feed|UrlFetch|Pdf|Preview|1aoOL0|FQ-2/i);
});
