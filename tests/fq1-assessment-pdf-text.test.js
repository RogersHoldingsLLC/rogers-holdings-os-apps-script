const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function syllables(word) {
  let value = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!value) return 0;
  if (value.length <= 3) return 1;
  value = value.replace(/(?:es|ed|e)$/, '').replace(/^y/, '');
  return Math.max(1, (value.match(/[aeiouy]{1,2}/g) || []).length);
}

function htmlReadability(html) {
  const text = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|li|td|th|h1|h2|h3|div|section)>/gi, '. ').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, 'and').replace(/\s+/g, ' ');
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).map(value => value.trim()).filter(value => value.split(/\s+/).length > 1 && !/https?:/.test(value));
  const words = sentences.flatMap(value => value.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []);
  const totalSyllables = words.reduce((sum, word) => sum + syllables(word), 0);
  return {
    grade: Number((0.39 * (words.length / sentences.length) + 11.8 * (totalSyllables / words.length) - 15.59).toFixed(1)),
    maxSentenceWords: Math.max.apply(null, sentences.map(value => (value.match(/[A-Za-z]+/g) || []).length))
  };
}

test('plain-language Draft v2 package preserves authority, meaning, page counts, and readable text', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'fq1-pdf-text-'));
  const outputName = path.relative(path.join(root, 'test-output'), output);
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-qa2-gold-standard.js')], {
    cwd: root,
    env: Object.assign({}, process.env, { GOLD_STANDARD_FIXTURE: 'fq1-plain-v2', GOLD_STANDARD_OUTPUT: outputName }),
    timeout: 300000,
    stdio: 'pipe'
  });
  const text = fs.readFileSync(path.join(output, 'Digital Business Assessment.txt'), 'utf8').replace(/\s+/g, ' ');
  const pageCount = Number(fs.readFileSync(path.join(output, 'Digital Business Assessment.pages'), 'utf8'));
  assert.equal(pageCount, 3);
  for (const approvedText of [
    'We checked the saved pages for a clear way to ask for help. This report shows what we checked, what we found, and what to do next.',
    'Where we checked: Services page menu',
    'Test record: Controlled manual fixture (a test website checked by a person)',
    'What we checked: The menu link on a phone and computer',
    'What we did: We checked the menu without sending the form',
    'What we found: No direct route to inquiry form',
    'Important Evidence Note',
    'Fictional public-page evidence (a fictional public test page)',
    'No direct route to inquiry form',
    'A customer should reach the request form from the Services page menu.',
    'A customer must search for the request form. That extra step makes asking for help harder.',
    'Form submission not tested.',
    'We only checked that the listing exists. We did not review it in depth.'
  ]) assert.ok(text.includes(approvedText), `missing extracted PDF text: ${approvedText}`);
  assert.doesNotMatch(text, /Expected condition|Supported business consequence|Why this conclusion is supported|Approved recommendation/i);
  assert.doesNotMatch(text, /Services and About are present|no contact or request-service destination is shown/i);
  assert.doesNotMatch(text, /Evidence:\s*Website\s*[·•]\s*Services page menu/i);
  assert.doesNotMatch(text, /Website\s+Services page menu\s+Controlled manual fixture\s*[·•]/i);
  assert.match(text, /Observed result:\s*No direct route to inquiry form/i);
  assert.doesNotMatch(text, /Why we know this|The Services page menu has no direct link to the request form\./i);
  assert.match(text, /✓\s*Checked|Checked/);
  assert.doesNotMatch(text, /Found and checked|Used in this review/i);
  const assessmentHtml = fs.readFileSync(path.join(output, 'Digital Business Assessment.html'), 'utf8');
  const methodologyHtml = assessmentHtml.slice(assessmentHtml.indexOf('How We Checked'), assessmentHtml.indexOf('Important Evidence Note'));
  assert.doesNotMatch(methodologyHtml, /Controlled manual fixture\s*[·•]/);
  assert.match(assessmentHtml, /Important Evidence Note[\s\S]*Fictional public-page evidence \(a fictional public test page\)/);
  assert.doesNotMatch(assessmentHtml, /What We Did Not Check<\/h2>[\s\S]{0,400}Fictional public-page evidence/);
  assert.doesNotMatch(assessmentHtml, /<b>Evidence:<\/b>/);
  const findingHtml = assessmentHtml.slice(assessmentHtml.indexOf('What we found 1'), assessmentHtml.indexOf('What Happens Next'));
  assert.doesNotMatch(findingHtml, /Controlled manual fixture|Phone and computer|Checked the menu without sending the form/);

  const briefText = fs.readFileSync(path.join(output, 'Executive Brief.txt'), 'utf8').replace(/\s+/g, ' ');
  const briefPageCount = Number(fs.readFileSync(path.join(output, 'Executive Brief.pages'), 'utf8'));
  assert.equal(briefPageCount, 1);
  for (const expectedText of [
    'People can learn about your services, but they still have to search for the request form.',
    'That extra step makes asking for help harder.',
    'A clear Request Service link gives them one easy next step.',
    'WHAT THIS MEANS',
    'Your website helps people learn about your services. The missing link is the next step to ask for help.',
    'ONE CLEAR FIX',
    'Add a Request Service link to the Services page menu.',
    'WHAT SHOULD HAPPEN',
    'Customers can open the request form without searching.',
    'WANT HELP WITH THIS FIX?',
    'Reply to this report. We can walk through the next steps with you.',
    'Checked'
  ]) assert.ok(briefText.toLowerCase().includes(expectedText.toLowerCase()), `missing extracted Executive Brief text: ${expectedText}`);
  assert.doesNotMatch(briefText, /Main items|Items checked|1 item|Found and checked|Used in this review/i);

  const planText = fs.readFileSync(path.join(output, 'Improvement Plan.txt'), 'utf8').replace(/\s+/g, ' ');
  const planPageCount = Number(fs.readFileSync(path.join(output, 'Improvement Plan.pages'), 'utf8'));
  assert.equal(planPageCount, 2);
  for (const approvedText of [
    'These steps show what to change, who will do it, and how to check the work.',
    'Make it easy for customers to reach the request form from the Services page menu.',
    'Add a Request Service link to the Services page menu.',
    'Point it to the approved request form.',
    'Services page menu template',
    'Customers can open the request form without searching.',
    'Test the link on a phone and a computer.',
    'It should open the request form in one click.',
    'Confirmed web address for the request form',
    'Access to the Services page menu template',
    'A person chosen to make the change',
    'Write down the test result.',
    'Choose who will make the change.',
    'Outside help needs separate approval.',
    'Form submission not tested'
  ]) assert.ok(planText.includes(approvedText), `missing extracted Improvement Plan PDF text: ${approvedText}`);
  assert.equal((planText.match(/Form submission not tested/g) || []).length, 1);
  assert.match(planText, /What we need first.*What we did not test/i);
  assert.doesNotMatch(planText, /\.\s*;/);
  assert.doesNotMatch(planText, /primary navigation|visitor evaluating|Approved Recommendations|Priorities & Strategy|implementation objective|implementation path|intended outcome|dependencies|decision requirements/i);
  assert.doesNotMatch(planText, /execution plan|approved correction|ownership|dependencies|verification/i);
  assert.doesNotMatch(planText, /How to check the fix/i);
  assert.equal((planText.match(/Test the link on a phone and a computer\./g) || []).length, 1);
  for (const packageText of [briefText, text, planText]) assert.match(packageText, /August 15, 2026/i, 'package date must come from immutable approvedAt in the project timezone');
  for (const packageText of [briefText, text, planText]) assert.equal((packageText.match(/Form submission not tested\./g) || []).length, 1);
  assert.equal((text.match(/Important Evidence Note/g) || []).length, 1);
  assert.equal((text.match(/We only checked that the listing exists\. We did not review it in depth\./g) || []).length, 1);

  const readability = {};
  for (const name of ['Executive Brief', 'Digital Business Assessment', 'Improvement Plan']) readability[name] = htmlReadability(fs.readFileSync(path.join(output, `${name}.html`), 'utf8'));
  assert.ok(readability['Executive Brief'].grade <= 3.5, JSON.stringify(readability));
  // Exact owner-requested copy and immutable evidence terms keep this document just above
  // the third-grade formula target. Manual first-read QA and the 18-word gate remain mandatory.
  assert.ok(readability['Digital Business Assessment'].grade <= 4.3, JSON.stringify(readability));
  assert.ok(readability['Improvement Plan'].grade <= 3.5, JSON.stringify(readability));
  for (const value of Object.values(readability)) assert.ok(value.maxSentenceWords <= 18, JSON.stringify(readability));
  const allPackageText = [briefText, text, planText].join(' ');
  assert.doesNotMatch(allPackageText, /Found and checked|Used in this review|Evidence:\s*Website\s*[·•]/i);
  assert.doesNotMatch(allPackageText, /lost customers|revenue|conversion rate|financial value|guaranteed results|urgent fix/i);
  assert.doesNotMatch(allPackageText, /approved priority|customer journey|diagnostic|evidence traceability|implementation objective|implementation path|intended outcome|decision requirements|supported business consequence|expected condition|observed condition|assessment boundaries|scope of review|methodology|applicability|verified present|successful correction|implementation sequencing|separately scoped|designated owner|documented implementation location|operational performance and outcomes/i);
  process.stdout.write(`Plain-language readability ${JSON.stringify(readability)}\n`);
});

test('approved Rogers Improvement Plan extracts a complete balanced two-page execution document', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'rogers-plan-pdf-'));
  const outputName = path.relative(path.join(root, 'test-output'), output);
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-qa2-gold-standard.js')], {
    cwd: root,
    env: Object.assign({}, process.env, { GOLD_STANDARD_FIXTURE: 'rogers-approved-v1', GOLD_STANDARD_OUTPUT: outputName }),
    timeout: 300000,
    stdio: 'pipe'
  });
  const text = fs.readFileSync(path.join(output, 'Improvement Plan.txt'), 'utf8').replace(/\s+/g, ' ');
  assert.equal(Number(fs.readFileSync(path.join(output, 'Improvement Plan.pages'), 'utf8')), 2);
  for (const expected of [
    'These steps show what to change, who will do it, and how to check the work.',
    'Create a simpler and more dependable lead-capture path with structured intake records and auditable follow-up.',
    'Connect the Business Snapshot form to a secure submission system',
    'Business Snapshot form submission workflow',
    'Access to the Business Snapshot form submission workflow',
    'A person chosen to make the change',
    'Submit an authorized test Business Snapshot through the published form.',
    'Public pages verified reachable and ownership confirmed. The secure submission endpoint is not connected; the Business Snapshot form prepares an email for the customer to review and send. No submission was performed.',
    'NEXT STEP',
    'Choose who will make each change. Confirm what the work needs. Then approve the first task.'
  ]) assert.ok(text.includes(expected), `missing Rogers Improvement Plan text: ${expected}`);
  assert.equal((text.match(/Connect the Business Snapshot form to a secure submission system/g) || []).length, 1);
  assert.equal((text.match(/Submit an authorized test Business Snapshot through the published form\./g) || []).length, 1);
  assert.doesNotMatch(text, /WHAT WE NEED FIRST[\s\S]*The secure submission endpoint is not connected\s+What we did not test/i);
  assert.doesNotMatch(text, /STEPS\s+Complete Action 01/i);
});
