const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'FindingQualityEngine.gs'), 'utf8');
const goldSource = fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');

function load(overrides = {}) {
  const context = vm.createContext(Object.assign({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, text) => Array.from(crypto.createHash('sha256').update(text).digest()).map(value => value > 127 ? value - 256 : value),
      getUuid: () => 'fixture-uuid'
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'brian@example.test' }) },
    BUSINESS_OPTIMIZATION_PLATFORM_THEME: { gold: '#b88728', black: '#05070a' }
  }, overrides));
  vm.runInContext(source, context, { filename: 'FindingQualityEngine.gs' });
  return context;
}

function selectedRowHarness(sheetName, record, numRows = 1) {
  const sheet = {
    getName: () => sheetName,
    getLastRow: () => 3
  };
  const range = {
    getSheet: () => sheet,
    getNumRows: () => numRows,
    getRow: () => 2
  };
  const context = load({ SpreadsheetApp: { getActiveSpreadsheet: () => ({ getActiveRange: () => range }) } });
  context.ensureExactFindingQualityTable_ = () => ({ headerRow: 1, headers: {}, lastColumn: 1 });
  context.readFindingQualityRecord_ = () => Object.assign({}, record);
  return context;
}

function evidence(overrides = {}) {
  return Object.assign({
    'Evidence ID': 'EVID-1', 'Prospect ID': 'PROS-1', 'Finding Set Candidate ID': 'FSET-1', 'Candidate Version': '1',
    'Source Type': 'Element Inspection', 'Source URL': 'https://example.test/services', 'Page Title': 'Services', 'Page Path': '/services',
    'Element Type': 'Link', 'Element Label': 'Request service', 'Evidence Location': 'Services page primary navigation',
    'Captured At': '2026-08-13T12:00:00Z', 'Capture Method': 'Human reviewed page inspection', 'Desktop/Mobile Context': 'Both',
    'Evidence Excerpt': 'The primary navigation contains Services and About but no contact or request-service destination.',
    'Observed Value': 'No request-service link in primary navigation', 'Confidence': 0.95, 'Limitations': 'Public page only',
    'Acquisition Version': 'manual-v1', 'Review Status': 'Reviewed', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-13T13:00:00Z'
  }, overrides);
}

function finding(overrides = {}) {
  return Object.assign({
    'Finding ID': 'FND-1', 'Prospect ID': 'PROS-1', 'Finding Set ID': 'FSET-1', 'Finding Set Version': '1',
    'Category': 'Contact Path / Lead Capture', 'Finding Title': 'Primary service navigation lacks a request-service path',
    'Finding State': 'Actionable', 'Channel Type': 'Website', 'Presence State': 'Verified Present', 'Customer Journey Stage': 'Conversion',
    'Business Objective': 'Increase qualified service inquiries', 'Evidence Source': 'Reviewed public website',
    'Evidence Location': 'https://example.test/services — primary navigation', 'Evidence Observed At': '2026-08-13T12:00:00Z',
    'Evidence Excerpt': 'Services and About are present; no contact or request-service destination is shown.',
    'Observation': 'The Services page primary navigation has no button or link leading to the request-service form.',
    'Expected Condition': 'A high-intent visitor can reach the approved request-service destination from the Services page navigation.',
    'Business Consequence': 'A visitor evaluating a service must leave the Services page path and search for a way to request help.',
    'Consequence Basis': 'The reviewed navigation path contains no direct route from service evaluation to the desired inquiry action.',
    'Recommended Action': 'Add a Request Service link targeting the approved inquiry form to the Services page primary navigation.',
    'Implementation Location': 'Services page primary navigation template', 'Intended Outcome': 'Visitors can move from service evaluation to inquiry without searching.',
    'Completion Test': 'Verify on desktop and mobile that the Services page Request Service link reaches the working inquiry form in one click.',
    'Evidence Confidence': 0.95, 'Evidence References': 'EVID-1', 'Limitations': 'Form submission not tested',
    'Recommendation ID': 'REC-1', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-13T13:30:00Z',
    'Approval Status': 'Approved for Client', 'Approved Version': '1'
  }, overrides);
}

function bundle() {
  return {
    company: 'Fictional Service Company LLC',
    set: { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '1', 'Business Context Version': '1', 'Presence Inventory Version': '1', Limitations: '', Notes: '' },
    context: { 'Prospect ID': 'PROS-1', Version: '1', 'Primary Service': 'Residential repair', 'Target Customer': 'Homeowners needing scheduled repairs', 'Service Area': 'Test County', 'Desired Customer Action': 'Submit a service request', 'Primary Business Objective': 'Increase qualified service inquiries', 'Relevant Conversion Destination': 'https://example.test/request', 'Known Constraints': 'No emergency service', 'Industry Context': 'Local service', Source: 'Owner Confirmed', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-13T11:00:00Z' },
    presence: [{ 'Presence Record ID': 'PRES-1', 'Inventory ID': 'INV-1', 'Inventory Version': '1', 'Channel Type': 'Website', 'Channel Name': 'Company website', 'Presence State': 'Verified Present', 'Verified URL or Identifier': 'https://example.test', 'Ownership Confidence': 'High', 'Evidence Source': 'Owner Confirmed plus resolving public website', 'Evidence Location': 'https://example.test', 'Captured At': '2026-08-13T11:15:00Z', Applicability: 'Applicable', 'Role in Customer Journey': 'Service evaluation and inquiry', Limitations: '', 'Reviewed By': 'brian@example.test', 'Reviewed At': '2026-08-13T11:30:00Z' }],
    evidence: [evidence()], findings: [finding()]
  };
}

test('FQ-1 declares normalized sheets and exact core contracts', () => {
  const context = load();
  assert.deepEqual(Array.from(context.FQ_PRESENCE_STATES), ['Verified Present', 'Verified Absent', 'Not Verified', 'Not Applicable']);
  for (const header of ['Primary Business Objective', 'Relevant Conversion Destination', 'Fingerprint']) assert.ok(context.FQ_CONTEXT_COLUMNS.includes(header));
  for (const header of ['Evidence Location', 'Capture Method', 'Raw Artifact Reference']) assert.ok(context.FQ_EVIDENCE_COLUMNS.includes(header));
  for (const header of ['Expected Condition', 'Consequence Basis', 'Completion Test', 'Recommendation ID']) assert.ok(context.FQ_FINDING_COLUMNS.includes(header));
});

test('presence states remain distinct and human-only absence/applicability is enforced', () => {
  const context = load();
  const base = { 'Presence Record ID': 'P1', 'Prospect ID': 'PROS-1', 'Inventory ID': 'INV-1', 'Inventory Version': '1', 'Channel Type': 'Website', 'Channel Name': 'Website', 'Ownership Confidence': 'Low', 'Evidence Source': 'Documented discovery', 'Evidence Location': 'Discovery protocol log', 'Captured At': '2026-08-13', Applicability: 'Needs Review', 'Role in Customer Journey': 'Unknown' };
  assert.doesNotThrow(() => context.validateAssessmentPresenceRecord_(Object.assign({}, base, { 'Presence State': 'Not Verified' }), {}));
  assert.throws(() => context.validateAssessmentPresenceRecord_(Object.assign({}, base, { 'Presence State': 'Verified Absent', Applicability: 'Applicable' }), {}), /human review/i);
  assert.doesNotThrow(() => context.validateAssessmentPresenceRecord_(Object.assign({}, base, { 'Presence State': 'Not Applicable', Applicability: 'Not Applicable', 'Reviewed By': 'brian@example.test' }), { humanApproval: true }));
});

test('Owner Confirmed evidence is explicit and never masquerades as public observation', () => {
  const context = load();
  assert.throws(() => context.validateAssessmentEvidenceRecord_(evidence({ 'Source Type': 'Owner Confirmed', 'Capture Method': 'Manual note', Limitations: '' })), /OWNER_CONFIRMED/);
  assert.doesNotThrow(() => context.validateAssessmentEvidenceRecord_(evidence({ 'Source Type': 'Owner Confirmed', 'Source URL': '', 'Capture Method': 'Owner Confirmed interview', Limitations: 'Supplied by Pat Owner; not independently observed publicly.' })));
});

test('generic, unsupported, duplicative, and low-confidence findings are rejected deterministically', () => {
  const context = load();
  const invalid = finding({
    'Finding Title': 'PRIMARY PRIORITY', 'Observation': 'The business may be losing online opportunities.',
    'Business Consequence': 'This may affect customer clarity, trust, or qualified inquiries.',
    'Recommended Action': 'The business may be losing online opportunities.', 'Completion Test': 'Improve the business.',
    'Evidence Confidence': 0.3, 'Evidence References': ''
  });
  const errors = Array.from(context.validateAssessmentFindingRecord_(invalid, { approvalRequired: true }));
  for (const code of ['FQ_FINDING_GENERIC_OBSERVATION', 'FQ_FINDING_GENERIC_CONSEQUENCE', 'FQ_RECOMMENDATION_REPEATS_OBSERVATION', 'FQ_COMPLETION_NOT_OBJECTIVE', 'FQ_EVIDENCE_REFERENCES_REQUIRED', 'FQ_EVIDENCE_CONFIDENCE_LOW', 'FQ_PLACEHOLDER_TITLE']) assert.ok(errors.includes(code), code);
});

test('named Business Snapshot observations are specific while generic business wording remains blocked', () => {
  const context = load();
  assert.equal(context.isGenericFindingQualityText_('The Business Snapshot form prepares an email for the visitor to review and send.'), false);
  assert.equal(context.isGenericFindingQualityText_('The business may have various opportunities to improve.'), true);
});

test('a specific reviewed finding passes and has exact evidence/recommendation/action lineage', () => {
  const context = load();
  assert.deepEqual(Array.from(context.validateAssessmentFindingRecord_(finding(), { approvalRequired: true, evidenceById: { 'EVID-1': evidence() } })), []);
  const snapshot = context.buildApprovedFindingSetSnapshot_(bundle(), 'brian@example.test', new Date('2026-08-13T14:00:00Z')).payload;
  assert.equal(snapshot.findings.length, 1);
  assert.equal(snapshot.recommendations[0].recommendationId, 'REC-1');
  assert.equal(snapshot.improvementPlanActions[0].recommendationId, 'REC-1');
  assert.equal(snapshot.rendererInput.actions[0].recommendationKey, 'REC-1');
  assert.equal(snapshot.findings[0].expectedCondition, finding()['Expected Condition']);
  assert.equal(snapshot.findings[0].consequenceBasis, finding()['Consequence Basis']);
  const rendered = context.findingQualityRendererFindingFromSnapshot_(snapshot.findings[0]);
  assert.equal(rendered.expectedCondition, finding()['Expected Condition']);
  assert.equal(rendered.consequenceBasis, finding()['Consequence Basis']);
});

test('required finding fields follow record type and optional fields do not create empty client headings', () => {
  const context = load();
  const strength = finding({ 'Finding State': 'Verified Strength', 'Expected Condition': '', 'Consequence Basis': '', 'Implementation Location': '', 'Intended Outcome': '', 'Completion Test': '' });
  assert.deepEqual(Array.from(context.validateAssessmentFindingRecord_(strength, { approvalRequired: true, evidenceById: { 'EVID-1': evidence() } })), []);
  const gap = finding({ 'Finding State': 'Not Verified', 'Expected Condition': '', 'Consequence Basis': '', 'Recommended Action': '', 'Implementation Location': '', 'Intended Outcome': '', 'Completion Test': '', 'Recommendation ID': '' });
  assert.deepEqual(Array.from(context.validateAssessmentFindingRecord_(gap, { approvalRequired: true, evidenceById: { 'EVID-1': evidence() } })), []);
  const actionable = finding({ 'Expected Condition': '', 'Consequence Basis': '' });
  const errors = Array.from(context.validateAssessmentFindingRecord_(actionable, { approvalRequired: true, evidenceById: { 'EVID-1': evidence() } }));
  assert.ok(errors.includes('FQ_FINDING_MISSING_expectedCondition'));
  assert.ok(errors.includes('FQ_FINDING_MISSING_consequenceBasis'));
});

test('finding-set lifecycle rejects shortcuts and approved versions only supersede', () => {
  const context = load();
  assert.doesNotThrow(() => context.assertFindingSetTransition_('Draft', 'In Review'));
  assert.throws(() => context.assertFindingSetTransition_('Draft', 'Approved for Client'), /Illegal/);
  assert.doesNotThrow(() => context.assertFindingSetTransition_('In Review', 'Approved for Client'));
  assert.doesNotThrow(() => context.assertFindingSetTransition_('Approved for Client', 'Superseded'));
  assert.throws(() => context.assertFindingSetTransition_('Approved for Client', 'In Review'), /Illegal/);
});

test('finding lifecycle enforces human review order and immutable approval', () => {
  const context = load();
  assert.doesNotThrow(() => context.assertFindingTransition_('Not Reviewed', 'In Review'));
  assert.doesNotThrow(() => context.assertFindingTransition_('In Review', 'Needs More Evidence'));
  assert.doesNotThrow(() => context.assertFindingTransition_('Needs More Evidence', 'In Review'));
  assert.doesNotThrow(() => context.assertFindingTransition_('In Review', 'Approved for Client'));
  assert.throws(() => context.assertFindingTransition_('Not Reviewed', 'Approved for Client'), /Illegal/);
  assert.throws(() => context.assertFindingTransition_('Approved for Client', 'In Review'), /immutable/);
});

test('operator actions resolve only one valid row on their exact record sheet', () => {
  const cases = [
    ['markContextReviewed', 'Assessment Business Context', 'Context ID', 'CTX-1'],
    ['markPresenceReviewed', 'Assessment Presence', 'Presence Record ID', 'PRES-1'],
    ['markEvidenceReviewed', 'Assessment Evidence', 'Evidence ID', 'EVID-1'],
    ['transitionFinding', 'Assessment Findings', 'Finding ID', 'FND-1'],
    ['approveFinding', 'Assessment Findings', 'Finding ID', 'FND-1'],
    ['transitionFindingSet', 'Assessment Finding Sets', 'Finding Set ID', 'FSET-1'],
    ['approveFindingSet', 'Assessment Finding Sets', 'Finding Set ID', 'FSET-1'],
    ['createSuccessorFindingSet', 'Assessment Finding Sets', 'Finding Set ID', 'FSET-1'],
    ['seedDraftSuccessor', 'Assessment Finding Sets', 'Finding Set ID', 'FSET-1'],
    ['supersedeFindingSet', 'Assessment Finding Sets', 'Finding Set ID', 'FSET-1']
  ];
  for (const [action, sheetName, idHeader, id] of cases) {
    const accepted = selectedRowHarness(sheetName, { [idHeader]: id });
    assert.equal(accepted.getSelectedFindingQualityActionRow_(action).record[idHeader], id, action);
    const rejected = selectedRowHarness('Assessment Business Context', { 'Context ID': 'CTX-1' });
    if (sheetName !== 'Assessment Business Context') assert.throws(() => rejected.getSelectedFindingQualityActionRow_(action), new RegExp(sheetName));
    const multiple = selectedRowHarness(sheetName, { [idHeader]: id }, 2);
    assert.throws(() => multiple.getSelectedFindingQualityActionRow_(action), /Select one data row/);
    const missingId = selectedRowHarness(sheetName, {});
    assert.throws(() => missingId.getSelectedFindingQualityActionRow_(action), /valid data row/);
  }
  assert.throws(
    () => selectedRowHarness('Assessment Presence', { 'Presence Record ID': 'PRES-1' }).getSelectedFindingQualityActionRow_('markContextReviewed'),
    /Assessment Business Context/
  );
  assert.throws(
    () => selectedRowHarness('Assessment Evidence', { 'Evidence ID': 'EVID-1' }).getSelectedFindingQualityActionRow_('markPresenceReviewed'),
    /Assessment Presence/
  );
  assert.throws(
    () => selectedRowHarness('Assessment Findings', { 'Finding ID': 'FND-1' }).getSelectedFindingQualityActionRow_('markEvidenceReviewed'),
    /Assessment Evidence/
  );
  assert.throws(
    () => selectedRowHarness('Assessment Finding Sets', { 'Finding Set ID': 'FSET-1' }).getSelectedFindingQualityActionRow_('transitionFinding'),
    /Assessment Findings/
  );
  assert.throws(
    () => selectedRowHarness('Assessment Findings', { 'Finding ID': 'FND-1' }).getSelectedFindingQualityActionRow_('transitionFindingSet'),
    /Assessment Finding Sets/
  );
});

test('menu labels bind to the exact FQ-1 public handlers', () => {
  const bindings = {
    'Mark Selected Context Reviewed': 'markSelectedBusinessContextReviewed',
    'Mark Selected Presence Reviewed': 'markSelectedPresenceReviewed',
    'Mark Selected Evidence Reviewed': 'markSelectedEvidenceReviewed',
    'Move Selected Finding to Review': 'moveSelectedFindingToReview',
    'Mark Selected Finding Needs Evidence': 'markSelectedFindingNeedsEvidence',
    'Mark Selected Finding Needs Changes': 'markSelectedFindingNeedsChanges',
    'Reject Selected Finding': 'rejectSelectedFinding',
    'Approve Selected Finding for Client': 'approveSelectedFindingForClient',
    'Move Selected Finding Set to Review': 'moveSelectedFindingSetToReview',
    'Mark Selected Finding Set Needs Evidence': 'markSelectedFindingSetNeedsEvidence',
    'Mark Selected Finding Set Needs Changes': 'markSelectedFindingSetNeedsChanges',
    'Approve Selected Finding Set for Client': 'approveSelectedFindingSetForClient',
    'Create Successor Finding Set': 'createSuccessorFindingSet',
    'Seed Selected Plain-Language Draft Successor': 'seedSelectedPlainLanguageDraftSuccessor',
    'Supersede Selected Finding Set': 'supersedeSelectedFindingSet'
  };
  for (const [label, handler] of Object.entries(bindings)) {
    const pattern = new RegExp("addItem\\('" + label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + "', '" + handler + "'\\)");
    assert.match(menuSource, pattern, label);
  }
});

test('stable fingerprints are deterministic and change with reviewed content', () => {
  const context = load();
  const first = context.fingerprintFindingQualityValue_({ b: 2, a: 1 });
  assert.equal(first, context.fingerprintFindingQualityValue_({ a: 1, b: 2 }));
  assert.notEqual(first, context.fingerprintFindingQualityValue_({ a: 1, b: 3 }));
});

test('immutable snapshot persistence reconciles exact retry and rejects conflicting overwrite', () => {
  const context = load();
  function iterator(files) { let index = 0; return { hasNext: () => index < files.length, next: () => files[index++] }; }
  const exact = { getBlob: () => ({ getDataAsString: () => '{"approved":true}' }), getId: () => 'FILE-1' };
  const snapshots = { getFilesByName: () => iterator([exact]), createFile: () => { throw new Error('must not create'); } };
  const folder = { createFolder: () => snapshots };
  context.getOrCreateAuditPackageFolder_ = () => folder;
  context.getExactChildFolderOrThrow_ = () => snapshots;
  context.sanitizeDriveFileName_ = value => String(value);
  assert.equal(context.persistApprovedFindingSetSnapshot_('Fixture', { findingSetId: 'FSET-1', version: '1' }, '{"approved":true}').getId(), 'FILE-1');
  assert.throws(() => context.persistApprovedFindingSetSnapshot_('Fixture', { findingSetId: 'FSET-1', version: '1' }, '{"approved":false}'), /different immutable snapshot/);
});

test('no website and no GBP do not block a valid channel-specific foundation finding', () => {
  const context = load();
  const social = finding({
    'Category': 'Contact / Lead Capture Foundation', 'Finding Title': 'Facebook service posts do not provide the approved booking phone',
    'Channel Type': 'Facebook', 'Presence State': 'Verified Present', 'Evidence Location': 'Verified Facebook business page — three current service posts',
    'Observation': 'The three reviewed Facebook service posts contain service descriptions but no phone link or booking destination.',
    'Expected Condition': 'A visitor reading a current service post can reach the approved booking phone from that post.',
    'Business Consequence': 'A customer who discovers a service through Facebook must leave the post and independently search for the booking phone.',
    'Consequence Basis': 'The reviewed referral journey sends customers to the verified Facebook page, and the scoped posts contain no contact destination.',
    'Recommended Action': 'Add the approved booking phone link to each current Facebook service post and the page action button.',
    'Implementation Location': 'Verified Facebook page action button and current service-post templates',
    'Intended Outcome': 'Facebook visitors can call the approved booking phone directly from the discovery channel.',
    'Completion Test': 'Verify from a logged-out mobile view that each scoped Facebook service post and the page button opens the approved booking phone.',
    'Evidence References': 'EVID-SOCIAL'
  });
  assert.deepEqual(Array.from(context.validateAssessmentFindingRecord_(social, { approvalRequired: true, evidenceById: { 'EVID-SOCIAL': {} } })), []);
});

test('FQ-0 production boundary loads verified snapshot and forbids reviewedInput fallback', () => {
  assert.match(goldSource, /loadApprovedFindingSetForGeneration_\(prospect \|\| \{\}, options \|\| \{\}\)/);
  assert.doesNotMatch(goldSource.slice(0, goldSource.indexOf('function assertApprovedFindingSetReference_')), /options && options\.reviewedInput/);
  assert.match(source, /Snapshot File ID/);
  assert.match(source, /fingerprintFindingQualityText_\(stableStringifyFindingQuality_\(projection\)\)/);
  assert.match(source, /if \(!setSheet\) throw findingQualityGenerationLockError_/);
  assert.match(source, /packagePreparedAt: String\(payload\.approvedAt \|\| ''\)/);
  assert.doesNotMatch(source.slice(source.indexOf('const reviewedInput ='), source.indexOf('function findingQualityRendererFindingFromSnapshot_')), /rendererInput && payload\.rendererInput\.evidence|legacy\.detail|legacy\.label/);
});

test('new deliverables select the unique approved eligible successor-chain head', () => {
  const context = load();
  const base = { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', 'Review Status': 'Approved for Client', 'Approval Status': 'Approved for Client', 'Document Eligibility': 'Eligible' };
  const v1 = Object.assign({}, base, { Version: '1', 'Immutable Hash': 'hash-v1', 'Snapshot File ID': 'snapshot-v1', 'Supersedes Version': '' });
  const v2 = Object.assign({}, base, { Version: '2', 'Immutable Hash': 'hash-v2', 'Snapshot File ID': 'snapshot-v2', 'Supersedes Version': '1' });
  assert.equal(context.resolveApprovedFindingSetHead_([v2, v1], 'PROS-1').Version, '2');
  assert.equal(context.assertApprovedFindingSetReferenceShape_({ findingSetId: 'FSET-1', version: '1', fingerprint: 'hash-v1', approvalStatus: 'Approved for Client' }).version, '1');
});

test('successor-chain resolver rejects forks, cycles, duplicates, broken chains, and invalid heads', () => {
  const context = load();
  const record = (version, parent, overrides = {}) => Object.assign({ 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: String(version), 'Supersedes Version': parent === null ? '' : String(parent), 'Approval Status': 'Approved for Client', 'Document Eligibility': 'Eligible', 'Immutable Hash': 'hash-' + version, 'Snapshot File ID': 'snapshot-' + version }, overrides);
  const lock = /Client deliverable generation is locked/;
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, null), record(2, 1), record(3, 1)], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, 2), record(2, 1)], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, null), record(1, null)], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(2, 1)], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, null, { 'Snapshot File ID': '' })], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, null, { 'Immutable Hash': '' })], 'PROS-1'), lock);
  assert.throws(() => context.resolveApprovedFindingSetHead_([record(1, null), Object.assign(record(1, null), { 'Finding Set ID': 'FSET-2' })], 'PROS-1'), lock);
});

test('verified snapshot loading selects v2 while an explicit recorded v1 authority remains reproducible', () => {
  const context = load();
  context.deepFreezeGoldStandard_ = value => value;
  const makePayload = version => {
    const suffix = version === '2' ? '-V2' : '';
    const clientFinding = context.findingQualitySnapshotFinding_(finding({
      'Finding ID': 'FND-1' + suffix, 'Finding Set Version': version, 'Finding Title': version === '2' ? 'The Services page menu needs a Request Service link' : 'Primary service navigation lacks a request-service path',
      'Recommendation ID': 'REC-1' + suffix, 'Approved Version': version
    }));
    const payload = {
      schemaVersion: 'FQ-1', findingSetId: 'FSET-1', prospectId: 'PROS-1', version,
      approvalStatus: 'Approved for Client', reviewedBy: 'brian@example.test', approvedAt: '2026-08-16T02:59:38.341Z',
      businessContextVersion: version, presenceInventoryVersion: version, businessContext: {}, presence: [], evidence: [], findings: [clientFinding],
      recommendations: [{ recommendationId: 'REC-1' + suffix, findingId: 'FND-1' + suffix, title: clientFinding.findingTitle, recommendedAction: clientFinding.recommendedAction, implementationLocation: clientFinding.implementationLocation, intendedOutcome: clientFinding.intendedOutcome }],
      improvementPlanActions: [{ actionId: 'ACT-REC-1' + suffix, recommendationId: 'REC-1' + suffix, findingId: 'FND-1' + suffix, title: clientFinding.findingTitle, intendedOutcome: clientFinding.intendedOutcome, implementationPath: clientFinding.recommendedAction, dependency: 'Form submission not tested.', completionTest: clientFinding.completionTest }], rendererInput: {}
    };
    payload.fingerprint = context.fingerprintFindingQualityText_(context.stableStringifyFindingQuality_(payload));
    return payload;
  };
  const payloads = { 'SNAP-1': makePayload('1'), 'SNAP-2': makePayload('2') };
  const sets = [
    { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '1', 'Approval Status': 'Approved for Client', 'Document Eligibility': 'Eligible', 'Immutable Hash': payloads['SNAP-1'].fingerprint, 'Snapshot File ID': 'SNAP-1', 'Supersedes Version': '' },
    { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '2', 'Approval Status': 'Approved for Client', 'Document Eligibility': 'Eligible', 'Immutable Hash': payloads['SNAP-2'].fingerprint, 'Snapshot File ID': 'SNAP-2', 'Supersedes Version': '1' }
  ];
  const setSheet = {};
  context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => setSheet }) };
  context.ensureExactFindingQualityTable_ = () => ({});
  context.readFindingQualityRecords_ = () => sets.map(row => Object.assign({}, row));
  context.DriveApp = { getFileById: id => ({ getBlob: () => ({ getDataAsString: () => JSON.stringify(payloads[id]) }) }) };
  const newest = context.loadApprovedFindingSetForGeneration_({ prospectId: 'PROS-1' }, {});
  assert.equal(newest.reference.version, '2');
  assert.equal(newest.reviewedInput.findings[0].category, 'The Services page menu needs a Request Service link');
  const recordedV1 = context.loadApprovedFindingSetForGeneration_({ prospectId: 'PROS-1' }, { approvedFindingSetReference: { findingSetId: 'FSET-1', version: '1', fingerprint: payloads['SNAP-1'].fingerprint, approvalStatus: 'Approved for Client' } });
  assert.equal(recordedV1.reference.version, '1');
  payloads['SNAP-2'].fingerprint = 'changed';
  assert.throws(() => context.loadApprovedFindingSetForGeneration_({ prospectId: 'PROS-1' }, {}), /Client deliverable generation is locked/);
});

test('plain-language approval gate blocks jargon and long sentences before snapshot creation', () => {
  const context = load();
  const plain = { findings: [{
    'Finding Title': 'The Services page menu needs a Request Service link',
    'Observation': 'The Services page menu has no Request Service link.',
    'Expected Condition': 'A customer should reach the request form from the Services page menu.',
    'Business Consequence': 'A customer must search for the request form.',
    'Consequence Basis': 'The Services page menu has no direct link to the request form.',
    'Recommended Action': 'Add a Request Service link to the Services page menu. Point it to the approved request form.',
    'Implementation Location': 'Services page menu template',
    'Intended Outcome': 'Customers can open the request form without searching.',
    'Completion Test': 'Test the link on a phone and a computer. It should open the request form in one click.'
  }] };
  assert.doesNotThrow(() => context.assertPlainLanguageFindingSetForApproval_(plain));
  assert.throws(() => context.assertPlainLanguageFindingSetForApproval_({ findings: [Object.assign({}, plain.findings[0], { 'Observation': 'The diagnostic customer journey methodology describes an implementation objective with many abstract terms that a busy owner should not have to decode on the first reading.' })] }), /FQ_PLAIN_LANGUAGE_/);
  assert.match(source, /assertPlainLanguageFindingSetForApproval_\(bundle\)[\s\S]*buildApprovedFindingSetSnapshot_/);
});

test('operator menu exposes human review actions without automated approval', () => {
  for (const label of ['Mark Selected Evidence Reviewed', 'Approve Selected Finding for Client', 'Approve Selected Finding Set for Client', 'Create Successor Finding Set']) assert.match(menuSource, new RegExp(label));
  assert.doesNotMatch(source, /autoApprove|automaticApproval|Approved for Client.*automation/i);
});

test('approved context, presence, evidence, findings, and sets are edit-guarded', () => {
  assert.match(source, /isFindingQualityRecordFrozen_/);
  for (const name of ['FQ_CONTEXT_SHEET', 'FQ_PRESENCE_SHEET', 'FQ_EVIDENCE_SHEET', 'FQ_FINDINGS_SHEET', 'FQ_FINDING_SETS_SHEET']) assert.match(source, new RegExp(name));
  assert.match(source, /Create a successor finding-set version (?:before editing|and edit the successor records)/);
});

// Connect the real approved-snapshot loader, preview plan, PDF boundary and receipt.
// Only storage, UI, PDF conversion and operational writes are mocked.
test('synthetic approved finding set prepares an Executive Brief with an exact owner-review receipt', () => {
  const context = load();
  for (const name of ['GoldStandardDeliverables.gs', 'DeliverablePreviewEngine.gs', 'DocumentGenerationEngine.gs']) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }
  context.Utilities.formatDate = (date, timeZone, pattern) => new Intl.DateTimeFormat(pattern === 'yyyy-MM-dd' ? 'en-CA' : 'en-US', {
    timeZone, year: 'numeric', month: pattern === 'yyyy-MM-dd' ? '2-digit' : 'long', day: pattern === 'yyyy-MM-dd' ? '2-digit' : 'numeric'
  }).format(date);
  context.Utilities.computeDigest = (_algorithm, value) => Array.from(crypto.createHash('sha256').update(Array.isArray(value) ? Buffer.from(value) : value).digest());
  context.Session.getScriptTimeZone = () => 'America/New_York';
  context.normalizeClientProspect_ = value => value;
  context.normalizeClientBusinessName_ = String;
  context.getClientSafeReportFile_ = (_prospect, report) => report;
  context.getRogersContactInfo_ = () => ({ company: 'Rogers Holdings LLC', email: 'owner@example.test' });
  context.escapeHtml_ = value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const payload = context.buildApprovedFindingSetSnapshot_(bundle(), 'owner@example.test', new Date('2026-08-13T14:00:00Z')).payload;
  payload.fingerprint = context.fingerprintFindingQualityValue_(payload);
  const set = { 'Finding Set ID': 'FSET-1', 'Prospect ID': 'PROS-1', Version: '1', 'Approval Status': 'Approved for Client',
    'Document Eligibility': 'Eligible', 'Immutable Hash': payload.fingerprint, 'Snapshot File ID': 'SNAP-LOCAL', 'Supersedes Version': '' };
  let modal = '';
  context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({}) }),
    getUi: () => ({ showModalDialog: value => { modal = value.html; } }) };
  context.HtmlService = { createHtmlOutput: html => ({ html, setWidth() { return this; }, setHeight() { return this; } }) };
  context.ensureExactFindingQualityTable_ = () => ({});
  context.readFindingQualityRecords_ = () => [Object.assign({}, set)];
  context.DriveApp = { getFileById: id => {
    assert.equal(id, 'SNAP-LOCAL');
    return { getBlob: () => ({ getDataAsString: () => JSON.stringify(payload) }) };
  } };
  const prospect = { prospectId: 'PROS-1', company: bundle().company };
  const plan = context.buildGoldStandardDocumentPlan_('executiveBrief', prospect, {});
  assert.deepEqual(Array.from(plan.semantics.findingIds), ['FND-1']);
  assert.deepEqual(Array.from(plan.semantics.evidenceReferences), ['EVID-1']);
  assert.deepEqual(Array.from(plan.semantics.recommendationIds), ['REC-1']);
  assert.equal(plan.approvedFindingSetReference.fingerprint, payload.fingerprint);
  context.showExecutiveSnapshotPreview_(prospect, plan);
  assert.match(modal, /generateExecutiveBriefPdfFromPreview/);
  assert.ok(modal.includes(payload.fingerprint));
  assert.ok(plan.pdfHtml.includes('August 13, 2026'));
  const calls = [];
  const pdfBytes = Buffer.from('%PDF-1.4\nlocal mock converter output');
  context.LockService = { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) };
  context.htmlToPdfBlob_ = (html, name) => {
    assert.equal(html, plan.pdfHtml); assert.equal(name, 'Executive Brief.pdf');
    calls.push('convert'); return { getBytes: () => Array.from(pdfBytes) };
  };
  context.getOrCreateAuditPackageFolder_ = () => { calls.push('mock-folder'); return { getId: () => 'FOLDER-LOCAL' }; };
  context.stageAndCommitGoldStandardArtifact_ = (_folder, currentPlan) => ({
    file: { getId: () => 'FILE-LOCAL' }, artifactChanged: true,
    artifactHash: context.hashGoldStandardBlob_(context.buildGoldStandardPdfBlobFromPlan_(currentPlan))
  });
  context.commitGoldStandardOperationalState_ = () => { calls.push('mock-record'); return { idempotent: false }; };
  context.refreshExecutiveDashboard = () => {};
  context.console = { error() {}, warn() {} };
  const result = context.executeGoldStandardDocumentGeneration_({}, prospect, 'executiveBrief', plan.approvedFindingSetReference, {});
  const receipt = JSON.parse(context.serializeGoldStandardGenerationClientResult_(result));
  assert.equal(receipt.ok, true);
  assert.equal(receipt.fileId, 'FILE-LOCAL');
  assert.equal(receipt.folderId, 'FOLDER-LOCAL');
  assert.equal(receipt.fileName, 'Executive Brief.pdf');
  assert.equal(receipt.artifactHash, crypto.createHash('sha256').update(pdfBytes).digest('hex'));
  assert.equal(receipt.approvedFindingSetId, 'FSET-1');
  assert.equal(receipt.approvedFindingSetVersion, '1');
  assert.equal(receipt.approvedFindingSetFingerprint, payload.fingerprint);
  assert.equal(receipt.operationKey, 'GOLDDOC:PROS-1:EXECUTIVEBRIEF:FSET-1:1:' + payload.fingerprint);
  assert.deepEqual(calls, ['mock-folder', 'convert', 'mock-record']);
  // Content tampering and wrong-prospect authority fail before any artifact or record operation.
  payload.rendererInput.company = 'Unapproved change';
  for (const candidate of [prospect, { ...prospect, prospectId: 'PROS-OTHER' }]) {
    assert.throws(() => context.executeGoldStandardDocumentGeneration_({}, candidate, 'executiveBrief', plan.approvedFindingSetReference, {}),
      error => error.goldStandardStage === 'snapshot');
  }
  assert.deepEqual(calls, ['mock-folder', 'convert', 'mock-record']);
});
