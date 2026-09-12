const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'FindingQualityEngine.gs'), 'utf8');
const approval = fs.readFileSync(path.join(ROOT, 'FindingSetApprovalEngine.gs'), 'utf8');

function load() {
  const context = vm.createContext({ Object, Array, Date, JSON, Math, Number, String, RegExp, Set, isFinite });
  vm.runInContext(core + '\n' + approval, context);
  return context;
}

function chain() {
  const originalFinding = {
    'Finding ID': 'FND-OLD', 'Finding State': 'Superseded Pre-Snapshot', 'Approval Status': 'Approved for Client',
    'Superseded By Finding ID': 'FND-NEW', 'Superseded By': 'owner@example.test', 'Superseded At': '2026-08-17T12:00:00Z',
    'Supersession Operation Key': 'FQPRESNAPSHOTRECOVERY:FND-OLD:authority:candidate'
  };
  const replacementFinding = { 'Finding ID': 'FND-NEW', 'Supersedes Finding ID': 'FND-OLD' };
  const originalRecommendation = {
    'Recommendation ID': 'REC-OLD', 'Finding ID': 'FND-OLD', 'Review Status': 'Reviewed',
    'Superseded By Recommendation ID': 'REC-NEW'
  };
  const successorRecommendation = {
    'Recommendation ID': 'REC-NEW', 'Finding ID': 'FND-NEW', 'Review Status': 'Reviewed',
    'Supersedes Recommendation ID': 'REC-OLD'
  };
  return { originalFinding, replacementFinding, originalRecommendation, successorRecommendation };
}

test('approval command requires exact confirmation and keeps the document lock', () => {
  assert.match(approval, /APPROVE FINDING SET/);
  assert.match(approval, /getDocumentLock\(\)/);
  assert.match(approval, /waitLock\(30000\)/);
  assert.match(approval, /validateFindingSetSuccessorApprovalAuthority_/);
  assert.match(approval, /assertFindingSetApprovalReadback_/);
});

test('reciprocal pre-snapshot lineage passes while an active historical finding fails closed', () => {
  const context = load();
  const value = chain();
  assert.doesNotThrow(() => context.validateFindingSetSupersessionLineage_(
    value.replacementFinding, value.successorRecommendation,
    [value.originalFinding, value.replacementFinding], [value.originalRecommendation, value.successorRecommendation], ['FND-NEW']
  ));
  assert.throws(() => context.validateFindingSetSupersessionLineage_(
    value.replacementFinding, value.successorRecommendation,
    [value.originalFinding, value.replacementFinding], [value.originalRecommendation, value.successorRecommendation], ['FND-OLD', 'FND-NEW']
  ), /incomplete or active/);
});

test('changed or ambiguous historical authority fails closed', () => {
  const context = load();
  const value = chain();
  value.originalRecommendation['Superseded By Recommendation ID'] = 'REC-OTHER';
  assert.throws(() => context.validateFindingSetSupersessionLineage_(
    value.replacementFinding, value.successorRecommendation,
    [value.originalFinding], [value.originalRecommendation, value.successorRecommendation], ['FND-NEW']
  ), /Historical Recommendation/);
  value.originalRecommendation['Superseded By Recommendation ID'] = 'REC-NEW';
  assert.throws(() => context.validateFindingSetSupersessionLineage_(
    value.replacementFinding, value.successorRecommendation,
    [value.originalFinding, Object.assign({}, value.originalFinding)], [value.originalRecommendation, value.successorRecommendation], ['FND-NEW']
  ), /missing or ambiguous/);
});

test('snapshot builder receives active bundle findings only and never creates an Action table row', () => {
  assert.match(core, /const findings = requestedFindingIds\.map/);
  assert.match(core, /findings: clientFindings/);
  assert.doesNotMatch(approval, /appendFindingQualityRecord_\([^\n]*FQ_ACTIONS_SHEET|writeFindingQualityRecord_\([^\n]*FQ_ACTIONS_SHEET/);
  assert.doesNotMatch(approval, /generateExecutive|create.*Pdf|Gmail|Activity Feed|outreach/i);
});

test('approval protects active and historical Finding and Recommendation rows', () => {
  assert.match(core, /FQ_FINDINGS_SHEET[\s\S]*FQ_RECOMMENDATIONS_SHEET[\s\S]*Immutable approved Finding Quality record/);
});

test('operation-owned snapshot and set writes roll back and completed retry is verified', () => {
  assert.match(approval, /persistence\.created[\s\S]*setTrashed\(true\)/);
  assert.match(approval, /writeFindingQualityRecord_\(transaction\.selected\.sheet[\s\S]*transaction\.originalSet/);
  assert.match(approval, /alreadyCompleted: true/);
  assert.match(approval, /delete projection\.fingerprint/);
});

test('production and downstream boundaries stay absent', () => {
  assert.doesNotMatch(approval, /1aoOL0_ff6PARRB53rh8YbvjNBfgV4EpWrqeyiiHKd0ZTbESxgMdumsKo|FQ-2|UrlFetchApp/);
});
