#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { renderLocalPdf } = require('./local-pdf-test-harness');

const root = path.resolve(__dirname, '..');
const fixtureFiles = {
  'fq1-plain-v2': 'fq1-plain-draft-v2.json',
  'rogers-approved-v1': 'rogers-approved-v1-renderer.json'
};

// These saved renderer fixtures exercise production rendering without contacting
// Apps Script, Drive, Gmail, a workbook, or any public website.
function buildLocalFixturePlans(fixtureName) {
  const file = fixtureFiles[fixtureName];
  assert.ok(file, 'Unknown local Gold Standard fixture: ' + fixtureName);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures', file), 'utf8'));
  const storedText = JSON.stringify(fixture);
  const reference = Object.freeze({
    findingSetId: 'FSET-LOCAL-' + fixtureName.toUpperCase(), version: '1',
    fingerprint: crypto.createHash('sha256').update(storedText).digest('hex'),
    approvalStatus: 'Approved for Client'
  });
  const context = vm.createContext({
    Object, Date,
    Utilities: { formatDate: (date, timeZone, pattern) => new Intl.DateTimeFormat(
      pattern === 'yyyy-MM-dd' ? 'en-CA' : 'en-US',
      { timeZone, year: 'numeric', month: pattern === 'yyyy-MM-dd' ? '2-digit' : 'long',
        day: pattern === 'yyyy-MM-dd' ? '2-digit' : 'numeric' }).format(date) },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    normalizeClientProspect_: value => value,
    getClientSafeReportFile_: (_prospect, report) => report,
    getRogersContactInfo_: () => ({ company: 'Rogers Holdings LLC', email: 'owner@example.test' }),
    escapeHtml_: value => String(value == null ? '' : value).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  });
  ['FindingQualityEngine.gs', 'GoldStandardDeliverables.gs'].forEach(fileName => {
    vm.runInContext(fs.readFileSync(path.join(root, fileName), 'utf8'), context, { filename: fileName });
  });
  const storedFixture = context.deepFreezeGoldStandard_(fixture);
  // Mock only the verified storage boundary. Foundation tests cover the actual
  // production storage loader; no reviewedInput override bypasses its contract.
  context.loadApprovedFindingSetForGeneration_ = (prospect, options = {}) => {
    const requested = context.assertApprovedFindingSetReferenceShape_(options.approvedFindingSetReference);
    assert.equal(prospect.prospectId, 'PROS-LOCAL-RENDERER');
    assert.equal(JSON.stringify(requested), JSON.stringify(reference), 'The exact fixture snapshot reference is required.');
    assert.equal(JSON.stringify(storedFixture), storedText, 'Saved snapshot authority must remain unchanged.');
    return { reference, reviewedInput: storedFixture };
  };
  const prospect = { prospectId: 'PROS-LOCAL-RENDERER' };
  assert.throws(() => context.buildGoldStandardDeliverableInput_(prospect, {}, { reviewedInput: fixture }),
    /durable finding set/, 'Raw reviewedInput cannot replace approved snapshot authority.');
  assert.throws(() => context.buildGoldStandardDeliverableInput_(prospect, {}, {
    approvedFindingSetReference: { ...reference, fingerprint: 'changed' }
  }), /exact fixture snapshot reference/, 'A changed snapshot reference must fail.');
  const plans = ['executiveBrief', 'assessment', 'improvementPlan'].map(documentType =>
    context.buildGoldStandardDocumentPlan_(documentType, prospect, {}, { approvedFindingSetReference: reference }));
  assert.equal(JSON.stringify(storedFixture), storedText);
  return { plans, reference };
}

async function main() {
  assert.equal(process.env.BOP_LOCAL_NETWORK_SANDBOX, '1',
    'Run local PDF generation inside the documented network-denied sandbox.');
  const fixtureName = process.env.GOLD_STANDARD_FIXTURE || 'fq1-plain-v2';
  const { plans, reference } = buildLocalFixturePlans(fixtureName);
  const out = process.env.GOLD_STANDARD_OUTPUT
    ? path.resolve(root, 'test-output', process.env.GOLD_STANDARD_OUTPUT)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'bop-gold-standard-'));
  fs.mkdirSync(out, { recursive: true });
  const pageCounts = [];
  for (const plan of plans) {
    pageCounts.push(await renderLocalPdf(root, out, plan.title, plan.pdfHtml));
  }
  fs.writeFileSync(path.join(out, 'authoritative-input.json'), JSON.stringify(plans[0].input, null, 2));
  fs.writeFileSync(path.join(out, 'ACCEPTANCE_EVIDENCE.md'),
    '# Local Gold Standard renderer validation\n\nSaved fixture: ' + fixtureName +
    '\n\nMock snapshot fingerprint: ' + reference.fingerprint +
    '\n\nObserved PDF page counts: ' + pageCounts.join(' / ') +
    '\n\nLocal renderer test only; no production acceptance or business action occurred.\n');
  console.log(out);
}

if (require.main === module) {
  main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
}
module.exports = { buildLocalFixturePlans };
