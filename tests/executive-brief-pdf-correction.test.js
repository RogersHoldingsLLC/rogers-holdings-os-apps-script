const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'DocumentCorrectionEngine.gs'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');

function harness(options = {}) {
  let description = '';
  let rollbackCount = 0;
  let stageCount = 0;
  const reference = { findingSetId: 'FSET-1', version: '1', fingerprint: 'abc', approvalStatus: 'Approved for Client' };
  const plan = {
    documentType: 'executiveBrief', fileName: 'Executive Brief.pdf', approvedFindingSetReference: reference,
    content: { evidenceReferences: ['https://example.test/', 'https://example.test/form/'] },
    pdfHtml: '<div>Where we looked<p><span class="check-badge">&#10003; Checked</span> https://example.test/</p><p><span class="check-badge">&#10003; Checked</span> https://example.test/form/</p>What we did not test</div>'
  };
  const artifact = {
    file: { getId: () => 'FILE-NEW', setDescription(value) { description = value; return this; } },
    artifactHash: 'new-hash', artifactChanged: options.idempotent ? false : true
  };
  const context = {
    console,
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    assertApprovedFindingSetReference_: value => value,
    escapeHtml_: value => String(value),
    loadApprovedFindingSetForGeneration_: () => ({ reference }),
    buildGoldStandardDocumentPlan_: () => plan,
    getExistingClientArtifactFolder_: () => ({ getId: () => 'FOLDER-1' }),
    stageAndCommitGoldStandardArtifact_: () => { stageCount += 1; return artifact; },
    rollbackGoldStandardArtifactCommit_: () => { rollbackCount += 1; },
    stableStringifyFindingQuality_: JSON.stringify
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'DocumentCorrectionEngine.gs' });
  context.assertExecutiveBriefCorrectionAuthority_ = () => ({
    originalOperationKey: 'GOLDDOC:P1:EXECUTIVEBRIEF:FSET-1:1:abc',
    originalGeneratedAt: '2026-08-18T14:05:10.000Z',
    correctionKey: 'GOLDDOCCORRECTION:P1:EXECUTIVEBRIEF:FSET-1:1:abc:WHEREWELOOKEDROWS-V1'
  });
  context.assertExecutiveBriefCorrectionReadback_ = () => { if (options.failReadback) throw new Error('injected readback failure'); };
  const selected = { ss: {}, selectedRow: 21, table: { lastColumn: 2 }, sheet: { getRange: () => ({ getValues: () => [['unchanged', 'prospect']] }) } };
  return { context, selected, plan, get description() { return description; }, get rollbackCount() { return rollbackCount; }, get stageCount() { return stageCount; } };
}

test('menu exposes the explicit correction command and exact confirmation phrase', () => {
  assert.match(menu, /Replace Current Executive Brief PDF.*replaceCurrentExecutiveBriefPdf/);
  assert.match(source, /REPLACE EXECUTIVE BRIEF PDF/);
});

test('correction identity is deterministic and tied to immutable approved authority', () => {
  const h = harness();
  const prospect = { prospectId: 'P1' };
  const reference = { findingSetId: 'FSET-1', version: '1', fingerprint: 'abc', approvalStatus: 'Approved for Client' };
  assert.equal(h.context.buildExecutiveBriefPdfCorrectionKey_(prospect, reference), 'GOLDDOCCORRECTION:P1:EXECUTIVEBRIEF:FSET-1:1:abc:WHEREWELOOKEDROWS-V1');
  assert.equal(h.context.buildExecutiveBriefPdfCorrectionKey_(prospect, reference), h.context.buildExecutiveBriefPdfCorrectionKey_(prospect, reference));
});

test('correction stages one artifact, preserves operational state, and records no generation Activity', () => {
  const h = harness();
  const result = h.context.replaceCurrentExecutiveBriefPdfTransactional_(h.selected, { prospectId: 'P1', company: 'Fixture' }, {});
  assert.equal(result.status, 'completed');
  assert.equal(h.stageCount, 1);
  assert.equal(h.rollbackCount, 0);
  assert.match(h.description, /Operation GOLDDOCCORRECTION:P1:EXECUTIVEBRIEF:FSET-1:1:abc:WHEREWELOOKEDROWS-V1/);
  assert.match(h.description, /Original generation operation GOLDDOC:P1:EXECUTIVEBRIEF:FSET-1:1:abc/);
  assert.doesNotMatch(source, /appendGoldStandardGenerationActivity_|commitGoldStandardOperationalState_|createOutreach|GmailApp|Assessment Actions/);
  assert.doesNotMatch(source, /getOrCreateAuditPackageFolder_/);
});

test('exact retry reports already-completed without a duplicate transaction record', () => {
  const h = harness({ idempotent: true });
  const result = h.context.replaceCurrentExecutiveBriefPdfTransactional_(h.selected, { prospectId: 'P1', company: 'Fixture' }, {});
  assert.equal(result.status, 'already-completed');
  assert.equal(h.stageCount, 1);
  assert.equal(h.rollbackCount, 0);
});

test('failure after canonical staging restores the prior canonical artifact', () => {
  const h = harness({ failReadback: true });
  assert.throws(() => h.context.replaceCurrentExecutiveBriefPdfTransactional_(h.selected, { prospectId: 'P1', company: 'Fixture' }, {}), /injected readback failure/);
  assert.equal(h.rollbackCount, 1);
});

test('renderer parity validation rejects collapsed badges and missing URLs before Drive mutation', () => {
  const h = harness();
  const collapsed = Object.assign({}, h.plan, { pdfHtml: '<div>Where we looked <span class="check-badge">&#10003; Checked</span> https://example.test/, https://example.test/form/ What we did not test</div>' });
  assert.throws(() => h.context.assertExecutiveBriefCheckedRows_(collapsed), /parity/);
  assert.equal(h.stageCount, 0);
});
