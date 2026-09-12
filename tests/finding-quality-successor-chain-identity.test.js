const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['FindingQualityEngine.gs', 'EvidenceDraftEngine.gs', 'FindingDraftEngine.gs', 'RecommendationDraftEngine.gs', 'FindingApprovalEngine.gs', 'PreSnapshotRecoveryEngine.gs', 'RecommendationReviewEngine.gs', 'FindingSetApprovalEngine.gs'];

function context() {
  const c = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite, console,
    Session: { getActiveUser: () => ({ getEmail: () => '' }) },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { flush() {}, DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' } },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest(_algorithm, text) { return Array.from(crypto.createHash('sha256').update(String(text), 'utf8').digest()).map(value => value > 127 ? value - 256 : value); } }
  });
  FILES.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }));
  return c;
}

function fixture() {
  const c = context();
  const prospect = 'PROS-CHAIN'; const setId = 'FSET-CHAIN';
  const set = Object.fromEntries(c.FQ_FINDING_SET_COLUMNS.map(field => [field, '']));
  Object.assign(set, { 'Finding Set ID': setId, 'Prospect ID': prospect, Version: '1', 'Review Status': 'Draft', 'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible', 'Business Context Version': '1', 'Presence Inventory Version': '1', 'Evidence References': 'EVID-1', 'Finding IDs': 'FND-ROOT' });
  const contextRecord = { 'Prospect ID': prospect, Version: '1', 'Review Status': 'Reviewed' };
  const presence = { 'Prospect ID': prospect, 'Inventory Version': '1', 'Channel Type': 'Website', 'Review Status': 'Reviewed' };
  const evidence = [{ 'Evidence ID': 'EVID-1', 'Prospect ID': prospect }];
  const authority = { context: contextRecord, presence, evidence, set };
  const recommendationCandidate = c.normalizeRecommendationDraftCandidate_({ title: 'Connect the form', recommendedAction: 'Connect the form to direct submission.', implementationLocation: 'Website form', intendedOutcome: 'Visitors submit the form directly.', dependencies: '', limitations: 'Do not promise revenue, conversion rates, lead volume, or guaranteed results. Implementation and testing have not occurred.' });
  const finding = Object.fromEntries(c.FQ_FINDING_COLUMNS.map(field => [field, '']));
  Object.assign(finding, { 'Finding ID': 'FND-ROOT', 'Prospect ID': prospect, 'Finding Set ID': setId, 'Finding Set Version': '1', Category: 'Contact Path / Lead Capture', 'Finding Title': 'Form adds an email handoff', 'Finding State': 'In Review', 'Channel Type': 'Website', 'Presence State': 'Verified Present', Observation: 'The form prepares an email.', 'Expected Condition': 'Visitors submit on the website.', 'Business Consequence': 'The extra step can cause incomplete requests.', 'Consequence Basis': 'The page says the form prepares an email.', 'Recommended Action': recommendationCandidate.recommendedAction, 'Implementation Location': recommendationCandidate.implementationLocation, 'Intended Outcome': recommendationCandidate.intendedOutcome, 'Completion Test': 'Submit a test form.', 'Evidence Confidence': 0.9, 'Evidence References': 'EVID-1', Limitations: 'No submission was performed.', 'Approval Status': 'In Review' });
  const seed = c.buildRecommendationDraftOperationIdentity_(finding, authority, recommendationCandidate);
  const recommendation = c.buildDraftRecommendationRecord_(finding, recommendationCandidate, seed.recommendationId, seed.operationKey);
  Object.assign(recommendation, { 'Review Status': 'Reviewed', 'Reviewed By': 'reviewer@example.com', 'Reviewed At': '2026-08-17T12:00:00.000Z', 'Review Operation Key': 'FQRECOMMENDATIONREVIEW:' + seed.recommendationId + ':seed' });
  finding['Recommendation ID'] = recommendation['Recommendation ID'];
  Object.assign(finding, { 'Finding State': 'Actionable', 'Approval Status': c.FQ_APPROVED_STATUS, 'Approved Version': '1', 'Reviewed By': 'approver@example.com', 'Reviewed At': '2026-08-17T12:01:00.000Z' });
  finding['Approval Operation Key'] = c.buildFindingApprovalOperationKey_(finding, recommendation, authority, c.FQ_HISTORICAL_APPROVAL_CONTRACT);
  return { c, authority, finding, recommendation, recommendationCandidate };
}

function addGeneration(state, correction) {
  const { c, authority } = state;
  const generation = (state.generation || 0) + 1; state.generation = generation;
  const minute = generation * 10;
  const timestamp = offset => '2026-08-17T12:' + String(minute + offset).padStart(2, '0') + ':00.000Z';
  authority.set['Finding IDs'] = state.finding['Finding ID'];
  const identity = generation === 1 ? c.buildCanonicalPreSnapshotRecoveryIdentity_(state.finding, state.recommendation, authority, correction, c.FQ_HISTORICAL_APPROVAL_CONTRACT) : c.buildPreSnapshotRecoveryIdentity_(state.finding, state.recommendation, authority, correction);
  const creationFinding = c.preSnapshotCreationFindingAuthority_(state.finding);
  const creationRecommendation = c.preSnapshotCreationRecommendationAuthority_(state.recommendation);
  const creationSet = c.preSnapshotCreationSetAuthority_(authority.set, state.finding, generation === 1 ? c.FQ_HISTORICAL_APPROVAL_CONTRACT : c.FQ_CURRENT_RECOVERY_CONTRACT);
  state._recoveryAuthorities = state._recoveryAuthorities || {};
  state._recoveryAuthorities[generation] = { finding: c.recommendationDraftFindingAuthorityProjection_(creationFinding), recommendation: c.FQ_RECOMMENDATION_COLUMNS.reduce((out, field) => { out[field] = c.findingQualityDateText_(creationRecommendation[field]); return out; }, {}), set: c.recommendationDraftSetAuthorityProjection_(creationSet, generation === 1 ? c.FQ_HISTORICAL_APPROVAL_CONTRACT : c.FQ_CURRENT_RECOVERY_CONTRACT), context: c.businessContextCanonicalProjection_(authority.context), presence: c.reviewedPresenceEvidenceProjection_(authority.presence), evidence: authority.evidence.map(c.findingDraftEvidenceAuthorityProjection_) };
  const staged = c.buildPreSnapshotRecords_(state.finding, state.recommendation, correction, identity);
  Object.assign(state.finding, { 'Finding State': 'Superseded Pre-Snapshot', 'Superseded By Finding ID': identity.findingId, 'Superseded By': 'operator@example.com', 'Superseded At': timestamp(0), 'Supersession Operation Key': identity.operationKey });
  state.recommendation['Superseded By Recommendation ID'] = identity.recommendationId;
  Object.assign(staged.recommendation, { 'Review Status': 'Reviewed', 'Reviewed By': 'reviewer@example.com', 'Reviewed At': timestamp(1), 'Review Operation Key': 'FQRECOMMENDATIONREVIEW:' + identity.recommendationId + ':seed' });
  authority.set['Finding IDs'] = identity.findingId;
  staged.finding['Recommendation ID'] = identity.recommendationId;
  Object.assign(staged.finding, { 'Finding State': 'Actionable', 'Approval Status': c.FQ_APPROVED_STATUS, 'Approved Version': '1', 'Reviewed By': 'approver@example.com', 'Reviewed At': timestamp(2) });
  state._approvalSets = state._approvalSets || {}; state._approvalSets[identity.findingId] = Object.assign({}, authority.set);
  staged.finding['Approval Operation Key'] = c.buildFindingApprovalOperationKey_(staged.finding, staged.recommendation, authority, generation === 1 ? c.FQ_HISTORICAL_APPROVAL_CONTRACT : undefined);
  state.findings.push(staged.finding); state.recommendations.push(staged.recommendation);
  state.finding = staged.finding; state.recommendation = staged.recommendation;
  return identity;
}

function recoveryCandidate(index) {
  return { expectedCondition: 'Visitors submit on the website.', consequenceBasis: 'The page says the form prepares an email.', businessConsequence: 'The extra step can cause incomplete requests.', recommendedAction: 'Connect the form to direct submission ' + index + '.', completionTest: 'Submit a test form.' };
}

test('second- and third-generation successor identities survive predecessor supersession state changes', () => {
  const base = fixture();
  const state = Object.assign(base, { findings: [base.finding], recommendations: [base.recommendation] });
  addGeneration(state, recoveryCandidate(1));
  Object.assign(base.authority.set, { 'Previous Review Submitted By': 'reviewer@example.com', 'Previous Review Submitted At': '2026-08-17T12:14:00.000Z', 'Returned By': 'reviewer@example.com', 'Returned At': '2026-08-17T12:15:00.000Z', 'Return Reason': 'Plain-language correction required.', 'Return Operation Key': 'FQSETRETURN:FSET-CHAIN:1:receipt' });
  addGeneration(state, recoveryCandidate(2));
  const activeFinding = Object.assign({}, state.finding, { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Approved Version': '', 'Approval Operation Key': '' });
  const activeRecommendation = Object.assign({}, state.recommendation, { 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '' });
  state.findings[state.findings.length - 1] = activeFinding; state.recommendations[state.recommendations.length - 1] = activeRecommendation;
  const schema = {}; schema[base.c.FQ_FINDINGS_SHEET] = {}; schema[base.c.FQ_RECOMMENDATIONS_SHEET] = {};
  base.c.readFindingQualityRecordsWithRows_ = entry => (entry === schema[base.c.FQ_FINDINGS_SHEET] ? state.findings : state.recommendations).map(record => Object.assign({}, record));
  assert.doesNotThrow(() => base.c.assertRecommendationSeedIdentity_(schema, activeFinding, activeRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(activeRecommendation)));
  state.findings[state.findings.length - 1] = state.finding; state.recommendations[state.recommendations.length - 1] = state.recommendation;
  addGeneration(state, recoveryCandidate(3));
  const thirdFinding = Object.assign({}, state.finding, { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Approved Version': '', 'Approval Operation Key': '' });
  const thirdRecommendation = Object.assign({}, state.recommendation, { 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '' });
  state.findings[state.findings.length - 1] = thirdFinding; state.recommendations[state.recommendations.length - 1] = thirdRecommendation;
  assert.doesNotThrow(() => base.c.assertRecommendationSeedIdentity_(schema, thirdFinding, thirdRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(thirdRecommendation)));
});

test('legacy incomplete approval remains verifiable only through its exact receipt and supersession authority', () => {
  const base = fixture();
  ['Expected Condition', 'Consequence Basis', 'Recommended Action', 'Implementation Location', 'Intended Outcome', 'Completion Test'].forEach(field => { base.finding[field] = ''; });
  base.finding['Approval Operation Key'] = base.c.buildFindingApprovalOperationKey_(base.finding, base.recommendation, base.authority, base.c.FQ_HISTORICAL_APPROVAL_CONTRACT);
  const state = Object.assign(base, { findings: [base.finding], recommendations: [base.recommendation] });
  addGeneration(state, recoveryCandidate(1));
  const activeFinding = Object.assign({}, state.finding, { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Approved Version': '', 'Approval Operation Key': '' });
  const activeRecommendation = Object.assign({}, state.recommendation, { 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '' });
  state.findings[state.findings.length - 1] = activeFinding; state.recommendations[state.recommendations.length - 1] = activeRecommendation;
  const schema = {}; schema[base.c.FQ_FINDINGS_SHEET] = {}; schema[base.c.FQ_RECOMMENDATIONS_SHEET] = {};
  base.c.readFindingQualityRecordsWithRows_ = entry => (entry === schema[base.c.FQ_FINDINGS_SHEET] ? state.findings : state.recommendations).map(record => Object.assign({}, record));
  assert.doesNotThrow(() => base.c.assertRecommendationSeedIdentity_(schema, activeFinding, activeRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(activeRecommendation)));
  const receipt = state.findings[0]['Approval Operation Key']; state.findings[0]['Approval Operation Key'] = 'FQFINDINGAPPROVAL:FND-ROOT:fabricated';
  assert.throws(() => base.c.assertRecommendationSeedIdentity_(schema, activeFinding, activeRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(activeRecommendation)), /approval identity changed/);
  state.findings[0]['Approval Operation Key'] = receipt;
  base.authority.set['Finding IDs'] = 'FND-ROOT, ' + activeFinding['Finding ID'];
  assert.throws(() => base.c.assertRecommendationSeedIdentity_(schema, activeFinding, activeRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(activeRecommendation)), /incorrectly included/);
});

test('the real second-generation candidate hash uses all five correction fields', () => {
  const c = context();
  const finding = { 'Expected Condition': 'Visitors submit the Business Snapshot directly on the website and receive confirmation without opening or sending an email.', 'Consequence Basis': 'The page states that its secure submission endpoint is not connected. The form instead prepares an email that the visitor must send. This added handoff prevents the website from recording a completed structured submission directly.', 'Business Consequence': 'The extra step can cause abandoned or incomplete requests. It also makes lead tracking less dependable.', 'Recommended Action': 'Connect the Business Snapshot form to a secure submission system so customers can submit directly from the website. Each valid submission should create the appropriate linked intake records and preserve explicit consent. Rogers Holdings should receive a notification, and the visitor should receive clear confirmation. No manually sent email should be required.', 'Completion Test': 'Submit an authorized test Business Snapshot through the published form. Verify that no email client is required. Confirm one complete linked intake record contains the submitted fields and consent. Confirm Rogers Holdings receives the configured notification. Confirm the visitor receives a clear confirmation. Verify invalid submissions create no incomplete records.' };
  const variants = c.preSnapshotRecoveryCandidateVariantsFromFinding_(finding);
  assert.equal(c.fingerprintFindingQualityValue_(variants[0]).slice(0, 16), '585b07ecece3f2e9');
  assert.equal(c.fingerprintFindingQualityValue_(variants[1]).slice(0, 16), '2cd10310b706e49d');
});

test('the exact acceptance predecessor excludes return-audit keys absent from its approval schema era', () => {
  const c = context();
  const finding = { 'Finding ID': 'FND-f515e6fe15e03e72', 'Reviewed At': new Date('2026-08-17T14:36:08.124Z'), 'Superseded At': new Date('2026-08-17T15:53:38.750Z') };
  const set = { 'Finding IDs': 'FND-0aff56a349dd3d12', 'Previous Review Submitted By': 'briankeith@rogersholdingsllc.com', 'Previous Review Submitted At': new Date('2026-08-17T14:37:27.085Z'), 'Returned By': 'briankeith@rogersholdingsllc.com', 'Returned At': new Date('2026-08-17T15:49:30.934Z'), 'Return Reason': 'Plain-language correction required before immutable Finding Set approval.', 'Return Operation Key': 'FQSETRETURN:FSET-a2ae86fa62d97824:1:f9289e7b70f5b9b8' };
  const asOfApproval = c.historicalFindingApprovalSetAuthority_(set, finding);
  const historicalProjection = c.recommendationDraftSetAuthorityProjection_(asOfApproval, c.FQ_HISTORICAL_APPROVAL_CONTRACT);
  assert.equal(asOfApproval['Finding IDs'], 'FND-f515e6fe15e03e72');
  c.FQ_FINDING_SET_RETURN_AUDIT_FIELDS.forEach(field => assert.equal(Object.prototype.hasOwnProperty.call(historicalProjection, field), false, field));
  assert.equal('FQFINDINGAPPROVAL:FND-f515e6fe15e03e72:fbf30ffde17d6f9e'.split(':').pop(), 'fbf30ffde17d6f9e');
});

test('the live menu locked-handler path validates the complete returned-set chain before any write', () => {
  const base = fixture(); const state = Object.assign(base, { findings: [base.finding], recommendations: [base.recommendation] });
  addGeneration(state, recoveryCandidate(1));
  Object.assign(base.authority.set, { 'Previous Review Submitted By': 'reviewer@example.com', 'Previous Review Submitted At': '2026-08-17T12:14:00.000Z', 'Returned By': 'reviewer@example.com', 'Returned At': '2026-08-17T12:15:00.000Z', 'Return Reason': 'Plain-language correction required.', 'Return Operation Key': 'FQSETRETURN:FSET-CHAIN:1:receipt' });
  addGeneration(state, recoveryCandidate(2));
  const activeFinding = Object.assign({}, state.finding, { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Approved Version': '', 'Approval Operation Key': '' });
  const activeRecommendation = Object.assign({}, state.recommendation, { 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '' });
  state.findings[state.findings.length - 1] = activeFinding; state.recommendations[state.recommendations.length - 1] = activeRecommendation;
  const entry = rows => ({ sheet: { records: rows }, table: { lastColumn: 1, headers: {} }, missingReviewHeaders: [] });
  const schema = {}; schema[base.c.FQ_FINDINGS_SHEET] = entry(state.findings); schema[base.c.FQ_RECOMMENDATIONS_SHEET] = entry(state.recommendations); schema[base.c.FQ_FINDING_SETS_SHEET] = entry([base.authority.set]); schema[base.c.FQ_ACTIONS_SHEET] = entry([]); schema[base.c.FQ_CONTEXT_SHEET] = entry([base.authority.context]); schema[base.c.FQ_PRESENCE_SHEET] = entry([base.authority.presence]); schema[base.c.FQ_EVIDENCE_SHEET] = entry(base.authority.evidence);
  base.c.getFindingQualityRecommendationReviewSchema_ = () => schema;
  base.c.readFindingQualityRecordsWithRows_ = e => e.sheet.records.map((record, index) => Object.assign({}, record, { _row: index + 2 }));
  base.c.resolveRecommendationDraftAuthority_ = () => base.authority;
  const before = JSON.stringify({ findings: state.findings, recommendations: state.recommendations, set: base.authority.set });
  assert.throws(() => base.c.markFindingQualityRecommendationReviewedLocked_({ ss: {}, record: activeRecommendation }, {}), /Authenticated reviewer identity is required/);
  assert.equal(JSON.stringify({ findings: state.findings, recommendations: state.recommendations, set: base.authority.set }), before);
});

test('the exact Finding Set review handler accepts an approved final successor without projecting its staged review cycle backward', () => {
  const base = fixture(); const state = Object.assign(base, { findings: [base.finding], recommendations: [base.recommendation] });
  base.authority.context['Review Status'] = 'Reviewed'; base.authority.presence['Review Status'] = 'Reviewed';
  addGeneration(state, recoveryCandidate(1));
  Object.assign(base.authority.set, {
    'Previous Review Submitted By': 'briankeith@rogersholdingsllc.com',
    'Previous Review Submitted At': new Date('2026-08-17T12:14:00.000Z'),
    'Returned By': 'briankeith@rogersholdingsllc.com',
    'Returned At': new Date('2026-08-17T12:15:00.000Z'),
    'Return Reason': 'Plain-language correction required before immutable Finding Set approval.',
    'Return Operation Key': 'FQSETRETURN:FSET-CHAIN:1:receipt'
  });
  addGeneration(state, recoveryCandidate(2));
  Object.assign(state.finding, { 'Finding ID': state.finding['Finding ID'], 'Finding State': 'Actionable', 'Approval Status': base.c.FQ_APPROVED_STATUS, 'Approved Version': '1' });
  Object.assign(state.recommendation, { 'Review Status': 'Reviewed' });
  const predecessor = state.findings[state.findings.length - 2];
  const creationSet = state._approvalSets[predecessor['Finding ID']];
  const historicalSet = base.c.historicalFindingApprovalSetAuthority_(base.authority.set, predecessor);
  const differences = base.c.FQ_FINDING_SET_COLUMNS.filter(field => base.c.findingQualityDateText_(creationSet[field]) !== base.c.findingQualityDateText_(historicalSet[field])).map(field => [field, base.c.findingQualityDateText_(creationSet[field]), base.c.findingQualityDateText_(historicalSet[field])]);
  assert.equal(differences.length, 0, JSON.stringify(differences));
  assert.doesNotThrow(() => base.c.assertPreservedPreSnapshotApprovedIdentity_(predecessor, state.recommendations[state.recommendations.length - 2], base.authority));
  const liveCandidate = base.c.preSnapshotRecoveryCandidateVariantsFromFinding_(state.finding)[0];
  const liveIdentity = base.c.buildCanonicalPreSnapshotRecoveryIdentity_(predecessor, state.recommendations[state.recommendations.length - 2], base.authority, liveCandidate, base.c.FQ_CURRENT_RECOVERY_CONTRACT);
  const recomputedFinding = base.c.preSnapshotCreationFindingAuthority_(predecessor);
  const recomputedRecommendation = base.c.preSnapshotCreationRecommendationAuthority_(state.recommendations[state.recommendations.length - 2]);
  const recomputedSet = base.c.preSnapshotCreationSetAuthority_(base.authority.set, predecessor, base.c.FQ_CURRENT_RECOVERY_CONTRACT);
  const recomputedAuthority = { finding: base.c.recommendationDraftFindingAuthorityProjection_(recomputedFinding), recommendation: base.c.FQ_RECOMMENDATION_COLUMNS.reduce((out, field) => { out[field] = base.c.findingQualityDateText_(recomputedRecommendation[field]); return out; }, {}), set: base.c.recommendationDraftSetAuthorityProjection_(recomputedSet, base.c.FQ_CURRENT_RECOVERY_CONTRACT), context: base.c.businessContextCanonicalProjection_(base.authority.context), presence: base.c.reviewedPresenceEvidenceProjection_(base.authority.presence), evidence: base.authority.evidence.map(base.c.findingDraftEvidenceAuthorityProjection_) };
  const changed = [];
  Object.keys(state._recoveryAuthorities[2]).forEach(group => Object.keys(state._recoveryAuthorities[2][group] || {}).forEach(field => { if (JSON.stringify(state._recoveryAuthorities[2][group][field]) !== JSON.stringify(recomputedAuthority[group][field])) changed.push([group, field, state._recoveryAuthorities[2][group][field], recomputedAuthority[group][field]]); }));
  assert.equal(changed.length, 0, JSON.stringify(changed));

  function entry(records, columns) {
    const table = { headerRow: 1, headers: Object.fromEntries(columns.map((field, index) => [field, index + 1])), lastColumn: columns.length };
    const sheet = { records: records.map(record => Object.assign({}, record)), table, getLastRow() { return this.records.length + 1; }, getMaxRows: () => 200,
      getRange(row) { return { getValues: () => [columns.map(field => (sheet.records[row - 2] || {})[field] || '')], setValues: values => { sheet.records[row - 2] = Object.fromEntries(columns.map((field, index) => [field, values[0][index]])); } }; }
    };
    return { sheet, table };
  }
  const schema = {};
  schema[base.c.FQ_FINDINGS_SHEET] = entry(state.findings, base.c.FQ_FINDING_COLUMNS);
  schema[base.c.FQ_RECOMMENDATIONS_SHEET] = entry(state.recommendations, base.c.FQ_RECOMMENDATION_COLUMNS);
  schema[base.c.FQ_FINDING_SETS_SHEET] = entry([base.authority.set], base.c.FQ_FINDING_SET_COLUMNS);
  schema[base.c.FQ_ACTIONS_SHEET] = entry([], base.c.FQ_ACTION_COLUMNS);
  schema[base.c.FQ_CONTEXT_SHEET] = entry([base.authority.context], base.c.FQ_CONTEXT_COLUMNS);
  schema[base.c.FQ_PRESENCE_SHEET] = entry([base.authority.presence], base.c.FQ_PRESENCE_COLUMNS);
  schema[base.c.FQ_EVIDENCE_SHEET] = entry(base.authority.evidence, base.c.FQ_EVIDENCE_COLUMNS);
  const ss = { getSheetByName: name => schema[name].sheet };
  base.c.getHeaderTable_ = sheet => sheet.table;
  base.c.ensureExactFindingQualityTable_ = sheet => sheet.table;
  base.c.readFindingQualityRecordsWithRows_ = item => item.sheet.records.map((record, index) => Object.assign({}, record, { _row: index + 2 }));
  base.c.readFindingQualityRecords_ = sheet => sheet.records.map(record => Object.assign({}, record));
  base.c.readFindingQualityRecord_ = (sheet, _table, row) => Object.assign({}, sheet.records[row - 2]);
  base.c.writeFindingQualityRecord_ = (sheet, _table, row, record) => { const clean = Object.assign({}, record); delete clean._row; sheet.records[row - 2] = clean; };
  base.c.resolveFindingQualityEvidenceReferences_ = records => records;
  base.c.loadFindingQualityApprovalBundle_ = () => ({ findings: [state.finding] });
  base.c.validateAssessmentFindingRecord_ = () => [];
  base.c.assertPlainLanguageFindingSetForApproval_ = () => {};
  base.c.assertFindingSetReviewEntryDropdowns_ = () => {};
  base.c.assertReturnedFindingSet_ = () => {};
  base.c.requireHumanReviewer_ = () => 'briankeith@rogersholdingsllc.com';
  const selected = { ss, sheet: schema[base.c.FQ_FINDING_SETS_SHEET].sheet, table: schema[base.c.FQ_FINDING_SETS_SHEET].table, row: 2, record: Object.assign({}, base.authority.set) };
  const result = base.c.transitionSelectedFindingSetToReviewLocked_(selected, {});
  assert.equal(result.status, 'completed');
  assert.equal(schema[base.c.FQ_FINDING_SETS_SHEET].sheet.records[0]['Review Status'], 'In Review');
  assert.equal(state.recommendation['Review Status'], 'Reviewed');
});

test('content, approval, reciprocal-link, and operation-key tampering remain closed', () => {
  const base = fixture(); const state = Object.assign(base, { findings: [base.finding], recommendations: [base.recommendation] });
  addGeneration(state, recoveryCandidate(1));
  const activeFinding = Object.assign({}, state.finding, { 'Finding State': 'In Review', 'Approval Status': 'In Review', 'Approved Version': '', 'Approval Operation Key': '' });
  const activeRecommendation = Object.assign({}, state.recommendation, { 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '' });
  state.findings[state.findings.length - 1] = activeFinding; state.recommendations[state.recommendations.length - 1] = activeRecommendation;
  const schema = {}; schema[base.c.FQ_FINDINGS_SHEET] = {}; schema[base.c.FQ_RECOMMENDATIONS_SHEET] = {};
  base.c.readFindingQualityRecordsWithRows_ = entry => (entry === schema[base.c.FQ_FINDINGS_SHEET] ? state.findings : state.recommendations).map(record => Object.assign({}, record));
  const verify = () => base.c.assertRecommendationSeedIdentity_(schema, activeFinding, activeRecommendation, base.authority, base.c.recommendationDraftCandidateFromRecord_(activeRecommendation));
  const predecessor = state.findings[0], predecessorRecommendation = state.recommendations[0];
  const cases = [
    [predecessor, 'Approval Operation Key', 'changed'],
    [predecessor, 'Superseded By Finding ID', 'changed'],
    [predecessorRecommendation, 'Superseded By Recommendation ID', 'changed'],
    [activeRecommendation, 'Operation Key', activeRecommendation['Operation Key'].replace(/.$/, '0')],
    [activeRecommendation, 'Limitations', activeRecommendation.Limitations + ' Changed.']
  ];
  cases.forEach(([record, field, value]) => { const before = record[field]; record[field] = value; assert.throws(verify); record[field] = before; });
});
