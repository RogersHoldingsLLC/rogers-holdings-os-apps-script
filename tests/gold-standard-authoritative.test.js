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
});

test('current Drive reconciliation and legacy discovery boundaries remain narrow', () => {
  assert.match(driveSource, /const canonicalFileName = 'Digital Business Assessment\.pdf'/);
  assert.match(driveSource, /const legacyFileName = 'Audit Report\.pdf'/);
  assert.match(driveSource, /'AuditReport\.pdf'/);
  assert.match(driveSource, /'Proposal\.pdf'/);
  assert.doesNotMatch(source, /DriveApp|GmailApp|CalendarApp|SpreadsheetApp/);
});
