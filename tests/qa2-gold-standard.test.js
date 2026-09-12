const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { before, test } = require('node:test');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const names = ['Executive Brief', 'Digital Business Assessment', 'Improvement Plan'];
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bop-qa2-package-'));
const text = name => fs.readFileSync(path.join(out, name + '.txt'), 'utf8').replace(/\s+/g, ' ');
const html = name => fs.readFileSync(path.join(out, name + '.html'), 'utf8');

before(() => {
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-qa2-gold-standard.js')], {
    cwd: root,
    env: { ...process.env, GOLD_STANDARD_FIXTURE: 'fq1-plain-v2', GOLD_STANDARD_OUTPUT: out },
    timeout: 300000, stdio: 'pipe'
  });
});

test('QA-2 approved fixture package preserves PDF pagination and saved authority', () => {
  for (const name of names) {
    assert.ok(fs.readFileSync(path.join(out, name + '.pdf')).subarray(0, 5).equals(Buffer.from('%PDF-')));
    assert.ok(text(name).length > 100);
    assert.match(html(name), /break-inside:avoid-page/);
  }
  // The current approved plain-language fixture has a one-page brief,
  // three-page assessment, and two-page plan (also checked by the PDF text suite).
  assert.deepEqual(names.map(name => Number(fs.readFileSync(path.join(out, name + '.pages'), 'utf8'))), [1, 3, 2]);
  const input = JSON.parse(fs.readFileSync(path.join(out, 'authoritative-input.json'), 'utf8'));
  assert.deepEqual(input.findings.map(finding => finding.key), ['FND-VALID-1-V2']);
  assert.deepEqual(input.recommendations.map(recommendation => recommendation.key), ['REC-VALID-1-V2']);
  assert.deepEqual(input.actions.map(action => action.key), ['ACT-REC-VALID-1-V2']);
  assert.equal(input.approvedFindingSetReference.approvalStatus, 'Approved for Client');
  assert.match(input.approvedFindingSetReference.fingerprint, /^[a-f0-9]{64}$/);
  for (const name of names) assert.match(text(name), /August 15, 2026/i);
  assert.doesNotMatch(names.map(html).join('\n'), /CUSTOMER-FACING SUMMARY|What deserves attention first|\|\s*\||\|\s*<\/footer>|No action is recommended unless/i);
});

test('assessment separates observed evidence, limitations, and the supported correction', () => {
  const assessment = text('Digital Business Assessment');
  assert.match(assessment, /No direct route to inquiry form/);
  assert.match(assessment, /Fictional public-page evidence \(a fictional public test page\)/);
  assert.match(assessment, /We only checked that the listing exists\. We did not review it in depth\./);
  assert.match(assessment, /Form submission not tested\./);
  assert.match(assessment, /Add a Request Service link to the Services page menu\./);
  assert.doesNotMatch(assessment, /Improve Google|Optimize Google|Response-Time Performance|Critical Issue/i);
  assert.equal((assessment.match(/What we found 1/gi) || []).length, 1);
  assert.doesNotMatch(assessment, /lost customers|guaranteed results|conversion rate|financial value/i);
});

test('Improvement Plan preserves exact action lineage and the repetition boundary', () => {
  const plan = text('Improvement Plan');
  assert.equal((plan.match(/Add the Request Service link/g) || []).length, 1);
  assert.equal((plan.match(/Test the link on a phone and a computer\./g) || []).length, 1);
  assert.equal((plan.match(/Form submission not tested\./g) || []).length, 1);
  assert.match(plan, /Services page menu template/);
  assert.match(plan, /Confirmed web address for the request form/);
  assert.match(plan, /Write down the test result/);
  assert.doesNotMatch(plan, /Complete Action 01|implementation specialist/i);
});

test('current owner copy preserves one help CTA and separate implementation approval', () => {
  const brief = text('Executive Brief');
  const assessment = text('Digital Business Assessment');
  const plan = text('Improvement Plan');
  assert.equal((brief.match(/WANT HELP WITH THIS FIX\?/g) || []).length, 1);
  assert.match(brief, /Reply to this report\. We can walk through the next steps with you\./);
  assert.match(plan, /Outside help needs separate approval\./);
  assert.match(plan, /Choose who will make the change/);
  assert.doesNotMatch(assessment + plan, /\$\d|pricing|payment terms|signature|commercial commitment|automatic proposal/i);
});
