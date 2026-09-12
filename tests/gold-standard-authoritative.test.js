const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8');
const pdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');
const driveSource = fs.readFileSync(path.join(root, 'DriveEngine.gs'), 'utf8');
const auditSource = fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8');
const revenueSource = fs.readFileSync(path.join(root, 'ProspectRevenueWorkflow.gs'), 'utf8');

function load() {
  const context = vm.createContext({
    Object,
    Utilities: { formatDate: () => 'August 12, 2026' },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    normalizeClientProspect_: value => value || {},
    getClientSafeReportFile_: (_prospect, report) => report || {},
    getAuditEvidenceObject_: (_prospect, report) => (report && report.evidence) || {},
    getAuditReportTextFromReportFile_: report => String((report && report.text) || ''),
    filterClientEligibleEvidence_: values => values.filter(Boolean),
    getSmartFindings_: prospect => prospect.smartFindings || [],
    getRogersContactInfo_: () => ({ company: 'Rogers Holdings LLC', email: 'owner@example.test' }),
    escapeHtml_: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'FindingQualityEngine.gs'), 'utf8'), context);
  vm.runInContext(source, context);
  // Renderer unit tests mock the verified-storage boundary, never reviewedInput.
  // The real loader and snapshot integrity are exercised by the foundation suite.
  const approvedSnapshots = new Map();
  context.seedApprovedSnapshot = input => {
    const stored = JSON.parse(JSON.stringify(Object.assign({ packagePreparedAt: '2026-08-12T16:00:00Z' }, input)));
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(stored)).digest('hex');
    approvedSnapshots.set(fingerprint, context.deepFreezeGoldStandard_(stored));
    return { findingSetId: 'FSET-TEST-001', version: '1', fingerprint, approvalStatus: 'Approved for Client' };
  };
  context.loadApprovedFindingSetForGeneration_ = (_prospect, options = {}) => {
    const reference = context.assertApprovedFindingSetReferenceShape_(options.approvedFindingSetReference);
    if (reference.findingSetId !== 'FSET-TEST-001' || reference.version !== '1' || !approvedSnapshots.has(reference.fingerprint)) {
      throw context.findingQualityGenerationLockError_();
    }
    return { reference, reviewedInput: approvedSnapshots.get(reference.fingerprint) };
  };
  return context;
}

function reviewed() {
  return {
    company: 'Professional Advisory LLC', website: 'https://advisory.example', preparedDate: 'August 12, 2026',
    evidence: [{ key: 'site', label: 'Reviewed website', detail: 'Service path observed.', state: 'Actionable' }, { key: 'ops', label: 'Operations', detail: 'Not observable.', state: 'Not Verified' }],
    findings: [
      { key: 'clarity', category: 'Service Clarity', state: 'Actionable', expectedCondition: 'The service page explains the advisory scope and next contact step.', consequenceBasis: 'The reviewed service page does not explain the advisory path before the contact decision.', completionTest: 'Verify the service page describes the approved scope and links to the contact form.', observation: 'The advisory service path needs clearer explanation.', businessImpact: 'Qualified buyers may not identify fit quickly.', recommendation: 'Clarify the advisory service path.', priority: 'Priority Improvement', evidenceKeys: ['site'] },
      { key: 'response', category: 'Response Time', state: 'Not Verified', evidenceGap: 'Response time was not observable.', whyVerificationMatters: 'Expectations require operational proof.', verificationNeeded: 'Confirm the supported response standard.', priority: 'Not Verified', evidenceKeys: ['ops'] }
    ],
    recommendations: [{ key: 'clarify', findingKey: 'clarity', title: 'Clarify service path', change: 'Clarify the advisory service path.', why: 'Qualified buyers identify fit.', dependency: 'Owner approval.' }],
    actions: [{ key: 'publish', recommendationKey: 'clarify', sequence: 1, title: 'Publish approved service path', outcome: 'Buyers identify fit.', implementationPath: 'Owner or approved implementation support updates the relevant templates.', dependency: 'Approved copy.', completionTest: 'Owner verifies the path.' }],
    primaryConclusion: 'Clarify the advisory service path'
  };
}

function approvedSnapshotOptions(context, input) {
  return { approvedFindingSetReference: context.seedApprovedSnapshot(input) };
}

function northPointLegacy() {
  return {
    company: 'North Point Fitness',
    website: 'https://northpointfitness.example',
    auditScore: 15,
    auditOutcome: 'HIGH OPPORTUNITY',
    summary: 'North Point Fitness scored 15/100 with an audit outcome of HIGH OPPORTUNITY. Recommended service: Website conversion optimization.',
    notes: 'The business may be losing online opportunities that could turn into calls or customer inquiries.\nA few small visibility improvements could make the business easier to find in local search.\nClearer messaging could help more visitors understand why they should contact the business.'
  };
}

test('shared input is deterministic, deeply immutable, and preserves lineage', () => {
  const context = load();
  const first = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, reviewed()));
  const second = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, reviewed()));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.findings), true);
  assert.equal(first.recommendations[0].findingKey, first.findings[0].key);
  assert.equal(first.actions[0].recommendationKey, first.recommendations[0].key);
  assert.equal(first.findings[1].recommendation, '');
});

test('FQ-0 rejects generation without an exact durable approved finding-set reference', () => {
  const context = load();
  const invalid = [
    undefined,
    {},
    { findingSetId: 'FSET-1', version: '1', fingerprint: 'hash' },
    { findingSetId: 'FSET-1', version: '1', fingerprint: 'hash', approvalStatus: 'In Review' }
  ];
  invalid.forEach(reference => assert.throws(
    () => context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: reviewed(), approvedFindingSetReference: reference }),
    /Reviewed client findings must be approved as a durable finding set/
  ));
});

test('FQ-0 validates the approval lock before any legacy evidence fallback is read', () => {
  const context = load();
  let fallbackRead = false;
  context.normalizeClientProspect_ = () => { fallbackRead = true; return {}; };
  context.getSmartFindings_ = () => { fallbackRead = true; return ['generic fallback']; };
  assert.throws(() => context.buildGoldStandardDeliverableInput_({
    auditScore: 99,
    auditOutcome: 'Strong Fit',
    priorityTier: 'A - Hot',
    notes: 'Generic notes',
    summary: 'Generic summary',
    reviewNotes: 'Generic review notes',
    websiteScreenshotUrl: 'https://example.test/screenshot.png'
  }, {}), /Reviewed client findings must be approved as a durable finding set/);
  assert.equal(fallbackRead, false);
});

test('authoritative HTML is client-safe and cross-industry neutral', () => {
  const context = load();
  const input = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, reviewed()));
  const html = [context.buildGoldStandardExecutiveBriefHtml_(input), context.buildGoldStandardAssessmentHtml_(input), context.buildGoldStandardImprovementPlanHtml_(input)].join('\n');
  assert.doesNotMatch(html, /findingKey|recommendationKey|evidenceKeys|\bclarity\b.*\bsite\b/i);
  assert.doesNotMatch(html, /electrical|residential|commercial|local seo/i);
  assert.doesNotMatch(html, /pricing|payment terms|signature|acceptance language/i);
  assert.match(html, /What We Saw/i);
  const unverified = html.match(/Response Time[\s\S]*?<\/article>/)[0];
  assert.match(unverified, /What is missing[\s\S]*What to check next:/);
  assert.doesNotMatch(unverified, /Recommendation|Business Impact/);
  assert.equal(input.findings[1].state, 'Not Verified');
  assert.equal(input.findings[1].recommendation, '');
  assert.equal(input.recommendations.some(item => item.findingKey === input.findings[1].key), false);
});

test('production wrappers use one authoritative renderer and canonical filenames', () => {
  assert.match(pdfSource, /buildAuditReportPdfBlob_[\s\S]*buildGoldStandardAssessmentPdfBlob_\(buildGoldStandardDeliverableInput_/);
  assert.match(pdfSource, /buildProposalPdfBlob_[\s\S]*buildGoldStandardImprovementPlanPdfBlob_\(buildGoldStandardDeliverableInput_/);
  assert.match(pdfSource, /buildExecutiveSnapshotPdfBlob_[\s\S]*buildGoldStandardExecutiveBriefPdfBlob_\(buildGoldStandardDeliverableInput_/);
  assert.match(source, /htmlToPdfBlob_\(buildGoldStandardExecutiveBriefHtml_\(input\), 'Executive Brief\.pdf'\)/);
  assert.match(source, /htmlToPdfBlob_\(buildGoldStandardAssessmentHtml_\(input\), 'Digital Business Assessment\.pdf'\)/);
  assert.match(source, /htmlToPdfBlob_\(buildGoldStandardImprovementPlanHtml_\(input\), 'Improvement Plan\.pdf'\)/);
});

test('Generate Improvement Plan creates the Drive PDF without sent or accepted effects', () => {
  const context = load();
  const options = approvedSnapshotOptions(context, reviewed());
  const approvedLoader = context.loadApprovedFindingSetForGeneration_;
  context.loadApprovedFindingSetForGeneration_ = (prospect, supplied = {}) => approvedLoader(prospect, {
    ...supplied, approvedFindingSetReference: supplied.approvedFindingSetReference || options.approvedFindingSetReference
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'DocumentGenerationEngine.gs'), 'utf8'), context);
  const callbacks = pdfSource.slice(pdfSource.indexOf('function generateProposal()'), pdfSource.indexOf('function buildProposal_'));
  vm.runInContext(callbacks, context);
  const prospect = { prospectId: 'PROS-LOCAL-PLAN', company: reviewed().company };
  const selected = { selectedRow: 7 };
  const effects = [];
  let previewPlan;
  const forbidden = () => { throw new Error('Unexpected business action'); };
  Object.assign(context, {
    console: { error() {}, warn() {} },
    getSelectedProspectContext_: () => selected,
    buildSelectedProspectForAuditPackage_: value => { assert.equal(value, selected); return prospect; },
    showImprovementPlanPreview_: (value, plan) => { assert.equal(value, prospect); previewPlan = plan; },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    GmailApp: { createDraft: forbidden, sendEmail: forbidden },
    CalendarApp: { createEvent: forbidden },
    createClient: forbidden, createProject: forbidden, recordImprovementPlanAccepted: forbidden,
    getOrCreateAuditPackageFolder_: company => {
      assert.equal(company, prospect.company); effects.push('folder'); return { getId: () => 'FOLDER-LOCAL' };
    },
    htmlToPdfBlob_: (html, name) => {
      assert.equal(html, previewPlan.pdfHtml); assert.equal(name, 'Improvement Plan.pdf');
      effects.push('pdf'); return { getBytes: () => Array.from(Buffer.from('%PDF-1.4\nlocal test converter')) };
    },
    stageAndCommitGoldStandardArtifact_: (_folder, plan, operationKey) => {
      assert.equal(plan.fileName, 'Improvement Plan.pdf');
      assert.equal(operationKey, 'GOLDDOC:PROS-LOCAL-PLAN:IMPROVEMENTPLAN:FSET-TEST-001:1:' + options.approvedFindingSetReference.fingerprint);
      const artifactHash = context.hashGoldStandardBlob_(context.buildGoldStandardPdfBlobFromPlan_(plan));
      return { file: { getId: () => 'PDF-LOCAL' }, artifactHash, artifactChanged: true };
    },
    commitGoldStandardOperationalState_: (value, current, plan, _operationKey, fields) => {
      assert.equal(value, selected); assert.equal(current, prospect);
      assert.equal(context.GOLD_STANDARD_GENERATION_ACTIVITY_TYPES[plan.documentType], 'Improvement Plan Generated');
      assert.deepEqual(JSON.parse(JSON.stringify(fields)), { 'Next Action': 'Confirm Improvement Plan Sent' });
      effects.push('generation-record'); return { idempotent: false };
    },
    refreshExecutiveDashboard: () => effects.push('dashboard')
  });
  context.Utilities.DigestAlgorithm = { SHA_256: 'SHA_256' };
  context.Utilities.computeDigest = (_algorithm, bytes) => Array.from(crypto.createHash('sha256').update(Buffer.from(bytes)).digest());
  context.generateProposal();
  assert.equal(previewPlan.fileName, 'Improvement Plan.pdf');
  assert.deepEqual(effects, [], 'preview performs no artifact or business mutation');
  const receipt = JSON.parse(context.generateImprovementPlanPdfFromPreview(options.approvedFindingSetReference));
  assert.equal(receipt.ok, true);
  assert.equal(receipt.fileName, 'Improvement Plan.pdf');
  assert.equal(receipt.fileId, 'PDF-LOCAL');
  assert.equal(receipt.approvedFindingSetFingerprint, options.approvedFindingSetReference.fingerprint);
  assert.deepEqual(effects, ['folder', 'pdf', 'generation-record', 'dashboard']);
  assert.doesNotMatch(callbacks, /GmailApp|CalendarApp|createClient|createProject|recordImprovementPlanAccepted|setIfHeaderCell_/);
  assert.throws(() => context.generateImprovementPlanPdfFromPreview({ ...options.approvedFindingSetReference, fingerprint: 'unknown' }),
    error => error.goldStandardStage === 'snapshot');
  assert.deepEqual(effects, ['folder', 'pdf', 'generation-record', 'dashboard'], 'invalid authority stops before every mutation surface');
});

test('current Drive reconciliation and legacy discovery boundaries remain narrow', () => {
  assert.match(driveSource, /const canonicalFileName = 'Digital Business Assessment\.pdf'/);
  assert.match(driveSource, /const legacyFileName = 'Audit Report\.pdf'/);
  assert.match(driveSource, /'AuditReport\.pdf'/);
  assert.match(driveSource, /'Proposal\.pdf'/);
  assert.doesNotMatch(source, /DriveApp|GmailApp|CalendarApp|SpreadsheetApp/);
});

test('North Point legacy evidence fails closed without fabricated client content', () => {
  const context = load();
  const prospect = northPointLegacy();
  prospect.smartFindings = prospect.notes.split('\n');
  assert.throws(
    () => context.buildGoldStandardDeliverableInput_(prospect, { text: prospect.summary }),
    /Reviewed client findings must be approved as a durable finding set/
  );
  assert.equal(context.sanitizeGoldStandardClientText_(prospect.summary).includes('15/100'), false);
  assert.equal(context.sanitizeGoldStandardClientText_(prospect.summary).includes('HIGH OPPORTUNITY'), false);
});

test('score suppression is final-boundary and recursive across rendered model strings', () => {
  const context = load();
  const fixture = reviewed();
  fixture.evidence[0].detail = 'Legacy audit score 15/100. Reviewed website service path observed.';
  fixture.opening = 'The internal audit was HIGH OPPORTUNITY; the reviewed service path needs attention.';
  const input = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, fixture));
  const serialized = JSON.stringify(input);
  assert.doesNotMatch(serialized, /15\s*\/\s*100|HIGH OPPORTUNITY/i);
});

test('observation duplication, placeholder titles, and missing evidence cannot become recommendations', () => {
  const context = load();
  const fixture = reviewed();
  fixture.findings[0].category = 'SUPPORTING PRIORITY 2';
  fixture.findings[0].recommendation = fixture.findings[0].observation;
  fixture.findings[0].evidenceKeys = [];
  assert.throws(() => context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, fixture)), /insufficient reviewed evidence/);
});

test('variable priority counts are evidence-driven and omit unsupported strength sections', () => {
  const context = load();
  const fixture = reviewed();
  fixture.findings = [fixture.findings[0]];
  fixture.recommendations = [fixture.recommendations[0]];
  fixture.actions = [fixture.actions[0]];
  fixture.limitations = [];
  const input = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, fixture));
  assert.equal(input.findings.filter(item => item.state === 'Actionable').length, 1);
  assert.equal(input.recommendations.filter(item => item.kind === 'improvement').length, 1);
  assert.equal(input.actions.length, 1);
  assert.equal(input.preserveWhatWorks, '');
  const assessment = context.buildGoldStandardAssessmentHtml_(input);
  const plan = context.buildGoldStandardImprovementPlanHtml_(input);
  assert.doesNotMatch(assessment, /Preserve What Works|What works well/);
  assert.equal((assessment.match(/class="diagnostic"/g) || []).length, 1);
  assert.equal((assessment.match(/<h3>What to change<\/h3>/g) || []).length, 1);
  assert.equal((plan.match(/class="action execution-action"/g) || []).length, 1);
});

test('every plan action retains exact recommendation lineage and distinct mechanics', () => {
  const context = load();
  const fixture = reviewed();
  const secondFinding = {
    key: 'proof', category: 'Proof Placement', state: 'Actionable',
    expectedCondition: 'Verified credentials appear beside each advisory decision point.',
    consequenceBasis: 'The reviewed advisory decision path separates the credentials from the contact decision.',
    completionTest: 'Verify every advisory decision point displays the approved credentials.',
    observation: 'Verified credentials are separated from the main advisory service decision path.',
    businessImpact: 'Qualified buyers may reach a decision point without seeing the relevant proof.', recommendation: 'Place the verified credentials beside the advisory decision path.', priority: 'Priority Improvement', evidenceKeys: ['site']
  };
  fixture.findings.splice(1, 0, secondFinding);
  fixture.recommendations.push({ key: 'proof-rec', findingKey: 'proof', title: 'Align proof with decision points', change: secondFinding.recommendation, why: secondFinding.businessImpact, dependency: 'Approve the credential set.' });
  fixture.actions.push({ key: 'proof-action', recommendationKey: 'proof-rec', sequence: 2, title: 'Align verified proof', outcome: 'Buyers see relevant proof at the decision point.', implementationPath: 'Owner or approved implementation support places approved credentials beside the advisory path.', dependency: 'Approved credential set.', completionTest: 'Verify every advisory decision point displays the approved credentials.' });
  const input = context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, fixture));
  assert.equal(new Set(input.actions.map(item => item.recommendationKey)).size, input.actions.length);
  assert.equal(new Set(input.actions.map(item => item.completionTest)).size, input.actions.length);
});

test('authoritative print styles preserve solid black/gold CTA treatment', () => {
  const context = load();
  const html = context.buildGoldStandardExecutiveBriefHtml_(context.buildGoldStandardDeliverableInput_({}, {}, approvedSnapshotOptions(context, reviewed())));
  assert.match(html, /print-color-adjust:exact/);
  assert.match(html, /\.score p,.brief \.cta p,.decision p\{color:#fff!important;opacity:1\}/);
});

test('all direct document actions preflight before external mutation', () => {
  for (const [body, entry, type, preview] of [
    [auditSource, 'generateExecutiveSnapshot', 'executiveBrief', 'showExecutiveSnapshotPreview_'],
    [auditSource, 'generateAuditPackage', 'assessment', 'showDigitalBusinessAssessmentPreview_'],
    [pdfSource, 'generateProposal', 'improvementPlan', 'showImprovementPlanPreview_']
  ]) {
    const start = body.indexOf(`function ${entry}()`);
    const fn = body.slice(start, body.indexOf('\n}', start) + 2);
    assert.ok(fn.includes(`buildGoldStandardDocumentPlan_('${type}'`));
    assert.ok(fn.indexOf('buildGoldStandardDocumentPlan_') < fn.indexOf(preview));
    assert.doesNotMatch(fn, /getOrCreateAuditPackageFolder_|upsertAuditPackageBlobFile_|applySmartFindingsToProspect_|runWebsiteAuditToolWorkflow_|applyWebsiteAuditToolResults_|GmailApp/);
  }
  const transaction = fs.readFileSync(path.join(root, 'DocumentGenerationEngine.gs'), 'utf8');
  const start = transaction.indexOf('function executeGoldStandardDocumentGenerationLocked_');
  const fn = transaction.slice(start);
  assert.ok(fn.indexOf('buildGoldStandardDocumentPlan_') < fn.indexOf('getOrCreateAuditPackageFolder_'));
  assert.ok(fn.indexOf('buildGoldStandardDocumentPlan_') < fn.indexOf('stageAndCommitGoldStandardArtifact_'));
});

// Caller-supplied content cannot replace an independently seeded approved snapshot.
test('renderer authority rejects unknown fingerprints and ignores caller reviewedInput', () => {
  const context = load();
  const options = approvedSnapshotOptions(context, reviewed());
  options.reviewedInput = { company: 'UNAPPROVED REPLACEMENT', findings: [] };
  const input = context.buildGoldStandardDeliverableInput_({}, {}, options);
  assert.equal(input.company, reviewed().company);
  assert.throws(() => context.buildGoldStandardDeliverableInput_({}, {}, {
    approvedFindingSetReference: { ...options.approvedFindingSetReference, fingerprint: 'unknown' }
  }), /Client deliverable generation is locked/);
});

test('Prospect-to-Revenue insufficient evidence exits before every mutation surface', () => {
  const calls = [];
  const context = vm.createContext({
    SpreadsheetApp: { getUi: () => ({ ButtonSet: { OK: 'OK' }, alert: (...args) => calls.push(['alert', ...args]) }) },
    getSelectedProspectContext_: () => ({ values: [], table: { headers: {} } }),
    buildSelectedProspectForAuditPackage_: () => ({ company: 'North Point Fitness' }),
    getValueByHeader_: () => '',
    buildLocalAuditReportInput_: () => ({}),
    buildGoldStandardDeliverableInput_: () => { throw new Error('Gold Standard generation blocked: insufficient reviewed evidence.'); },
    validateProspectRevenueContext_: () => { calls.push(['validation-mutation']); return { ready: true, prospectId: 'PROS-1' }; },
    setProspectRevenueWorkflowState_: () => calls.push(['workflow-mutation']),
    logProspectRevenueActivity_: () => calls.push(['activity']),
    getOrCreateAuditPackageFolder_: () => calls.push(['drive-folder']),
    upsertAuditPackageBlobFile_: () => calls.push(['drive-file']),
    setIfHeaderCell_: () => calls.push(['cell-write']),
    updateSelectedProspectLastActivity_: () => calls.push(['last-activity']),
    refreshSalesOperatingSystem_: () => calls.push(['dashboard']),
    reconcileExactGmailDraft_: () => calls.push(['gmail']),
    runWebsiteAuditToolWorkflow_: () => calls.push(['inspection'])
  });
  vm.runInContext(revenueSource, context);
  const result = context.runProspectRevenuePreparation_(false);
  assert.equal(result.failedStep, 'Gold Standard evidence preflight');
  assert.deepEqual(calls.map(item => item[0]), ['alert']);
});

test('Prospect-to-Revenue rich evidence completes preflight before validation begins', () => {
  const calls = [];
  const context = vm.createContext({
    SpreadsheetApp: { getUi: () => ({ ButtonSet: { OK: 'OK' }, alert: (...args) => calls.push(['alert', ...args]) }) },
    getSelectedProspectContext_: () => ({ values: [], table: { headers: {} } }),
    buildSelectedProspectForAuditPackage_: () => ({ company: 'Harbor Light Electrical LLC' }),
    getValueByHeader_: () => '',
    buildLocalAuditReportInput_: () => ({ evidence: 'reviewed' }),
    buildGoldStandardDeliverableInput_: () => { calls.push(['preflight']); return { company: 'Harbor Light Electrical LLC' }; },
    buildGoldStandardExecutiveBriefHtml_: () => calls.push(['brief-plan']),
    buildGoldStandardAssessmentHtml_: () => calls.push(['assessment-plan']),
    buildGoldStandardImprovementPlanHtml_: () => calls.push(['plan-plan']),
    validateProspectRevenueContext_: () => { calls.push(['validation']); return { ready: false, details: 'Fixture stop after preflight.' }; }
  });
  vm.runInContext(revenueSource, context);
  context.validateProspectRevenueContext_ = () => { calls.push(['validation']); return { ready: false, details: 'Fixture stop after preflight.' }; };
  context.runProspectRevenuePreparation_(false);
  assert.deepEqual(calls.map(item => item[0]), ['preflight', 'brief-plan', 'assessment-plan', 'plan-plan', 'validation', 'alert']);
});
