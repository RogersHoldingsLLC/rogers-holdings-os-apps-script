const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8');
const pdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');
const driveSource = fs.readFileSync(path.join(root, 'DriveEngine.gs'), 'utf8');

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
  vm.runInContext(source, context);
  return context;
}

function reviewed() {
  return {
    company: 'Professional Advisory LLC', website: 'https://advisory.example', preparedDate: 'August 12, 2026',
    evidence: [{ key: 'site', label: 'Reviewed website', detail: 'Service path observed.', state: 'Actionable' }, { key: 'ops', label: 'Operations', detail: 'Not observable.', state: 'Not Verified' }],
    findings: [
      { key: 'clarity', category: 'Service Clarity', state: 'Actionable', observation: 'The advisory service path needs clearer explanation.', businessImpact: 'Qualified buyers may not identify fit quickly.', recommendation: 'Clarify the advisory service path.', priority: 'Priority Improvement', evidenceKeys: ['site'] },
      { key: 'response', category: 'Response Time', state: 'Not Verified', evidenceGap: 'Response time was not observable.', whyVerificationMatters: 'Expectations require operational proof.', verificationNeeded: 'Confirm the supported response standard.', priority: 'Not Verified', evidenceKeys: ['ops'] }
    ],
    recommendations: [{ key: 'clarify', findingKey: 'clarity', title: 'Clarify service path', change: 'Clarify the advisory service path.', why: 'Qualified buyers identify fit.', dependency: 'Owner approval.' }],
    actions: [{ key: 'publish', recommendationKey: 'clarify', sequence: 1, title: 'Publish approved service path', outcome: 'Buyers identify fit.', implementationPath: 'Owner or approved implementation support updates the relevant templates.', dependency: 'Approved copy.', completionTest: 'Owner verifies the path.' }],
    primaryConclusion: 'Clarify the advisory service path'
  };
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
  const first = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: reviewed() });
  const second = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: reviewed() });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.findings), true);
  assert.equal(first.recommendations[0].findingKey, first.findings[0].key);
  assert.equal(first.actions[0].recommendationKey, first.recommendations[0].key);
  assert.equal(first.findings[1].recommendation, '');
});

test('authoritative HTML is client-safe and cross-industry neutral', () => {
  const context = load();
  const input = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: reviewed() });
  const html = [context.buildGoldStandardExecutiveBriefHtml_(input), context.buildGoldStandardAssessmentHtml_(input), context.buildGoldStandardImprovementPlanHtml_(input)].join('\n');
  assert.doesNotMatch(html, /findingKey|recommendationKey|evidenceKeys|\bclarity\b.*\bsite\b/i);
  assert.doesNotMatch(html, /electrical|residential|commercial|local seo/i);
  assert.doesNotMatch(html, /pricing|payment terms|signature|acceptance language/i);
  assert.match(html, /Focused Priorities/);
  assert.match(html, /Evidence Gap[\s\S]*Verification Needed/);
  assert.doesNotMatch(html.match(/Response Time[\s\S]*?<\/article>/)[0], /Recommendation|Business Impact/);
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
  const fn = pdfSource.slice(pdfSource.indexOf('function generateProposal()'), pdfSource.indexOf('function buildProposal_'));
  assert.match(fn, /upsertAuditPackageBlobFile_[\s\S]*'Improvement Plan\.pdf'[\s\S]*buildGoldStandardImprovementPlanPdfBlob_/);
  assert.match(fn, /Improvement Plan Generated|logProposalGenerated_/);
  assert.doesNotMatch(fn, /GmailApp|CalendarApp|createClient|createProject|Status|Follow-Ups|Completed/);
  assert.doesNotMatch(fn, /setIfHeaderCell_\([^)]*'Status'|recordImprovementPlanAccepted|createClient|createProject/);
  assert.ok(fn.indexOf('buildGoldStandardDeliverableInput_') < fn.indexOf('applySmartFindingsToProspect_'));
  assert.ok(fn.indexOf('buildGoldStandardDeliverableInput_') < fn.indexOf('getOrCreateAuditPackageFolder_'));
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
    /Gold Standard generation blocked: insufficient reviewed evidence/
  );
  assert.equal(context.sanitizeGoldStandardClientText_(prospect.summary).includes('15/100'), false);
  assert.equal(context.sanitizeGoldStandardClientText_(prospect.summary).includes('HIGH OPPORTUNITY'), false);
});

test('score suppression is final-boundary and recursive across rendered model strings', () => {
  const context = load();
  const fixture = reviewed();
  fixture.evidence[0].detail = 'Legacy audit score 15/100. Reviewed website service path observed.';
  fixture.opening = 'The internal audit was HIGH OPPORTUNITY; the reviewed service path needs attention.';
  const input = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: fixture });
  const serialized = JSON.stringify(input);
  assert.doesNotMatch(serialized, /15\s*\/\s*100|HIGH OPPORTUNITY/i);
});

test('observation duplication, placeholder titles, and missing evidence cannot become recommendations', () => {
  const context = load();
  const fixture = reviewed();
  fixture.findings[0].category = 'SUPPORTING PRIORITY 2';
  fixture.findings[0].recommendation = fixture.findings[0].observation;
  fixture.findings[0].evidenceKeys = [];
  assert.throws(() => context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: fixture }), /insufficient reviewed evidence/);
});

test('variable priority counts are evidence-driven and omit unsupported strength sections', () => {
  const context = load();
  const fixture = reviewed();
  fixture.findings = [fixture.findings[0]];
  fixture.recommendations = [fixture.recommendations[0]];
  fixture.actions = [fixture.actions[0]];
  fixture.limitations = [];
  const input = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: fixture });
  assert.equal(input.findings.filter(item => item.state === 'Actionable').length, 1);
  assert.equal(input.recommendations.filter(item => item.kind === 'improvement').length, 1);
  assert.equal(input.actions.length, 1);
  assert.equal(input.preserveWhatWorks, '');
  const assessment = context.buildGoldStandardAssessmentHtml_(input);
  const plan = context.buildGoldStandardImprovementPlanHtml_(input);
  assert.doesNotMatch(assessment, /Preserve What Works/);
  assert.equal((assessment.match(/What should change:/g) || []).length, 1);
  assert.equal((plan.match(/class="action"/g) || []).length, 1);
});

test('every plan action retains exact recommendation lineage and distinct mechanics', () => {
  const context = load();
  const fixture = reviewed();
  const secondFinding = {
    key: 'proof', category: 'Proof Placement', state: 'Actionable', observation: 'Verified credentials are separated from the main advisory service decision path.',
    businessImpact: 'Qualified buyers may reach a decision point without seeing the relevant proof.', recommendation: 'Place the verified credentials beside the advisory decision path.', priority: 'Priority Improvement', evidenceKeys: ['site']
  };
  fixture.findings.splice(1, 0, secondFinding);
  fixture.recommendations.push({ key: 'proof-rec', findingKey: 'proof', title: 'Align proof with decision points', change: secondFinding.recommendation, why: secondFinding.businessImpact, dependency: 'Approve the credential set.' });
  fixture.actions.push({ key: 'proof-action', recommendationKey: 'proof-rec', sequence: 2, title: 'Align verified proof', outcome: 'Buyers see relevant proof at the decision point.', implementationPath: 'Owner or approved implementation support places approved credentials beside the advisory path.', dependency: 'Approved credential set.', completionTest: 'Verify every advisory decision point displays the approved credentials.' });
  const input = context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: fixture });
  assert.equal(new Set(input.actions.map(item => item.recommendationKey)).size, input.actions.length);
  assert.equal(new Set(input.actions.map(item => item.completionTest)).size, input.actions.length);
});

test('authoritative print styles preserve solid black/gold CTA treatment', () => {
  const context = load();
  const html = context.buildGoldStandardExecutiveBriefHtml_(context.buildGoldStandardDeliverableInput_({}, {}, { reviewedInput: reviewed() }));
  assert.match(html, /print-color-adjust:exact/);
  assert.match(html, /\.score p,.brief \.cta p,.decision p\{color:#fff!important;opacity:1\}/);
});
