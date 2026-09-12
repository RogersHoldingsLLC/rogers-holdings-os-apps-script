const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { renderLocalPdf } = require('../scripts/local-pdf-test-harness');

const root = path.resolve(__dirname, '..');

test('actual Rogers Executive Brief PDF extracts two complete Checked URL rows on one page', async () => {
  // This is a local saved renderer fixture, not a live Rogers prospect.
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/rogers-approved-v1-renderer.json'), 'utf8'));
  const reference = Object.freeze({ findingSetId: 'FSET-LOCAL-PDF', version: '1',
    fingerprint: crypto.createHash('sha256').update(JSON.stringify(fixture)).digest('hex'), approvalStatus: 'Approved for Client' });
  const context = vm.createContext({
    Object, Date,
    Utilities: { formatDate: (date, timeZone, pattern) => new Intl.DateTimeFormat(pattern === 'yyyy-MM-dd' ? 'en-CA' : 'en-US', {
      timeZone, year: 'numeric', month: pattern === 'yyyy-MM-dd' ? '2-digit' : 'long', day: pattern === 'yyyy-MM-dd' ? '2-digit' : 'numeric'
    }).format(date) },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    normalizeClientProspect_: value => value,
    getClientSafeReportFile_: (_prospect, report) => report,
    getRogersContactInfo_: () => ({ company: 'Rogers Holdings LLC', email: 'owner@example.test' }),
    escapeHtml_: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8'), context);
  context.loadApprovedFindingSetForGeneration_ = (_prospect, options) => {
    assert.deepEqual(options.approvedFindingSetReference, reference);
    return { reference, reviewedInput: context.deepFreezeGoldStandard_(fixture) };
  };
  const plan = context.buildGoldStandardDocumentPlan_('executiveBrief', { prospectId: 'PROS-LOCAL-PDF' }, {}, { approvedFindingSetReference: reference });
  const logo = plan.pdfHtml.match(/<img class="executive-brief-logo" src="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]+>/);
  assert.ok(logo, 'Executive Brief embeds the established website logo without an external request');
  const logoBytes = Buffer.from(logo[1], 'base64');
  assert.equal(crypto.createHash('sha256').update(logoBytes).digest('hex'), '242ea2b98cc1a67031840ee37bda6307b9c7c7ab6d357546988d1b31fdf6bef2');
  assert.equal(logoBytes.readUInt32BE(16), 160);
  assert.equal(logoBytes.readUInt32BE(20), 160);
  assert.match(logo[0], /width="44" height="44"/);
  assert.match(plan.pdfHtml, /<div class="eyebrow">Business Snapshot<\/div><h1>Executive Brief<\/h1>/);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bop-eb-rows-'));
  const pdfPath = path.join(out, plan.fileName);
  await renderLocalPdf(root, out, 'Executive Brief', plan.pdfHtml);
  assert.ok(fs.readFileSync(pdfPath).subarray(0, 5).equals(Buffer.from('%PDF-')));
  const text = fs.readFileSync(path.join(out, 'Executive Brief.txt'), 'utf8');
  assert.equal(fs.readFileSync(path.join(out, 'Executive Brief.pages'), 'utf8').trim(), '1');
  assert.equal((text.match(/✓\s*Checked/g) || []).length, 2);
  assert.match(text, /✓\s*Checked\s+https:\/\/rogersholdingsllc\.com\//);
  assert.match(text, /✓\s*Checked\s+https:\/\/rogersholdingsllc\.com\/business-snapshot\//);
});
