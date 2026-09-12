const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'ClientPackageDraftEngine.gs'), 'utf8');
const MENU = fs.readFileSync(path.join(ROOT, 'Menu.gs'), 'utf8');

function sha(bytes) { return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'); }
function blob(name, bytes) { return { getName: () => name, getBytes: () => bytes.slice() }; }

function load(extra = {}) {
  const context = {
    console,
    Utilities: {
      Charset: { UTF_8: 'UTF_8' }, DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(_a, value) { return [...crypto.createHash('sha256').update(String(value)).digest()].map(n => n > 127 ? n - 256 : n); }
    },
    escapeHtml_: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    hashGoldStandardBlob_: value => sha(value.getBytes()),
    getValueByHeader_: (row, headers, header) => headers[header] ? row[headers[header] - 1] : '',
    setIfHeader_: (row, headers, header, value) => { if (headers[header]) row[headers[header] - 1] = value; },
    literalizeBusinessSnapshotSheetRow_: row => row,
    normalizePipelineStage_: value => String(value || '').trim(),
    validateProspectStageTransition_: (current, target) => ({ allowed: current === 'Lead Found' && target === 'Executive Brief Sent', idempotent: current === target, message: 'invalid transition' }),
    ACTIVITY_FEED_SHEET: 'Activity Feed',
    MimeType: { PDF: 'application/pdf' },
    ...extra
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  return context;
}

function harness(options = {}) {
  const sentAt = new Date('2026-08-19T17:04:07.000Z');
  const headers = { Status: 1, 'Next Action': 2, 'Last Activity': 3, 'Lifecycle Operation Key': 4, 'Lifecycle Operation State': 5, 'Lifecycle Operation Details': 6, 'Lifecycle Confirmed At': 7, Fixture: 8, 'Gmail Draft Created': 9 };
  const row = ['Lead Found', 'Confirm Improvement Plan Sent', 'OLD', '', '', '', '', 'synthetic-preserved', 'Yes'];
  const activityHeaders = { Date: 1, Company: 2, 'Activity Type': 3, 'Activity Notes': 4, 'Prospect ID': 7, 'Operation Key': 8 };
  const activityRows = [new Array(8).fill('fixture-activity-preserved')];
  const tracker = { getRange() { return { getValues: () => [row.slice()], setValues: values => row.splice(0, row.length, ...values[0]) }; } };
  const activity = {
    getLastRow: () => 4 + activityRows.length,
    getRange(r) { return { getValues: () => [activityRows[r - 5].slice()], setValues: values => {
      if (options.failActivityWrite) throw new Error('activity failure');
      activityRows[r - 5] = values[0].slice();
    } }; },
    deleteRow(r) { activityRows.splice(r - 5, 1); }
  };
  const plan = {
    operationKey: 'CLIENTPACKAGESENT:PROS-1:FSET-1:1:HASH:MESSAGEHASH', messageId: 'MSG-1', sentAt,
    subject: 'Your complete business optimization package — Rogers Holdings LLC', draftReceipt: { returnLink: 'https://rogersholdingsllc.com/#contact' },
    authority: { prospect: { prospectId: 'PROS-1', company: 'Rogers Holdings LLC' } }
  };
  const context = load({
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    getRequiredSheet_: () => activity,
    getHeaderTable_: () => ({ headers: activityHeaders, lastColumn: 8, headerRow: 4 }),
    findRowsByExactHeaderValue_: (_s, _t, _h, value) => activityRows.map((r, i) => r[7] === value ? i + 5 : 0).filter(Boolean),
    restoreGoldStandardProspectRow_: (_c, before) => row.splice(0, row.length, ...before)
  });
  context.prepareClientPackageSentReconciliation_ = () => plan;
  const selected = { ss: {}, sheet: tracker, selectedRow: 21, table: { headers, lastColumn: 9 } };
  return { context, selected, row, activityRows, plan };
}

function exactSentMessage(overrides = {}) {
  const url = 'https://rogersholdingsllc.com/#contact';
  const content = {
    subject: 'Your complete business optimization package — Rogers Holdings LLC', returnLink: url,
    plainBody: 'Hi Brian Keith Rogers,\n\nI prepared your complete business optimization package for review.'
  };
  const body = '\r\n\r\nHi Brian Keith Rogers,\r\n\r\nI prepared your complete business optimization package for review. The\r\nattached documents are:\r\n\r\n   - Executive Brief\r\n   - Digital Business Assessment\r\n   - Improvement Plan\r\n\r\n*Return Link:* ' + url + '\r\n\r\nPlease use the Return Link when you are ready to respond or continue the\r\nconversation.\r\n-- \r\n[image: Rogers Holdings LLC]\r\nBrian Keith Rogers\r\nFOUNDER\r\nRogers Holdings LLC\r\n859-404-7300 <+18594047300> · rogersholdingsllc.com\r\n<https://www.rogersholdingsllc.com/>\r\nbriankeith@rogersholdingsllc.com\r\nBetter systems. Clearer decisions. Stronger businesses.\r\n';
  const files = [
    { name: 'Executive Brief.pdf', hash: sha([1]) },
    { name: 'Digital Business Assessment.pdf', hash: sha([2]) },
    { name: 'Improvement Plan.pdf', hash: sha([3]) }
  ];
  const message = {
    getTo: () => overrides.to || 'Brian Keith Rogers <briankeith@rogersholdingsllc.com>',
    getFrom: () => 'Brian Keith Rogers <briankeith@rogersholdingsllc.com>', getSubject: () => content.subject,
    getPlainBody: () => overrides.body || body, getDate: () => new Date('2026-08-19T17:04:07Z'), getId: () => 'MSG-1',
    getAttachments: () => overrides.attachments || [blob('Improvement Plan.pdf', [3]), blob('Executive Brief.pdf', [1]), blob('Digital Business Assessment.pdf', [2])]
  };
  return { content, files, message };
}

test('Lead Found combined package advances only to Executive Brief Sent and preserves send timestamp', () => {
  const h = harness();
  const result = h.context.reconcileManuallySentClientPackageTransactional_(h.selected);
  assert.equal(result.stage, 'Executive Brief Sent');
  assert.equal(result.nextAction, 'Schedule Discovery Meeting');
  assert.equal(h.row[0], 'Executive Brief Sent');
  assert.equal(h.row[1], 'Schedule Discovery Meeting');
  assert.equal(h.row[2].getTime(), h.plan.sentAt.getTime());
  assert.equal(h.row[7], 'synthetic-preserved');
  assert.equal(h.activityRows.length, 2);
  assert.equal(h.activityRows[1][2], 'Complete Client Package Sent');
});

test('exact retry preserves Prospect and Activity timestamps and creates no duplicate', () => {
  const h = harness();
  h.context.reconcileManuallySentClientPackageTransactional_(h.selected);
  const before = h.row.slice();
  const count = h.activityRows.length;
  const retry = h.context.reconcileManuallySentClientPackageTransactional_(h.selected);
  assert.equal(retry.status, 'already-completed');
  assert.deepEqual(h.row, before);
  assert.equal(h.activityRows.length, count);
});

test('exact sent message accepts Gmail display names and reordered canonical attachments', () => {
  const x = exactSentMessage();
  const receipt = load().assertSentClientPackageMessage_(x.message, 'briankeith@rogersholdingsllc.com', x.content, x.files);
  assert.equal(receipt.messageId, 'MSG-1');
});

test('SENT canonicalizer accepts only observed Gmail plain-text normalization', () => {
  const c = load();
  assert.equal(
    c.canonicalizeSentClientPackageText_('\r\n\ufeffA\r\n*Return Link:*\u00a0https://example.test'),
    'A Return Link: https://example.test'
  );
  assert.notEqual(
    c.canonicalizeSentClientPackageText_('A *arbitrary emphasis*'),
    c.canonicalizeSentClientPackageText_('A arbitrary emphasis')
  );
});

test('exact full-body comparison rejects inserted or trailing content', () => {
  for (const insertion of ['UNAPPROVED INSERT ', ' trailing content']) {
    const baseline = exactSentMessage();
    const original = baseline.message.getPlainBody();
    const body = insertion.trimStart() === insertion
      ? original.replace('Please use the Return Link', insertion + 'Please use the Return Link')
      : original + insertion;
    const x = exactSentMessage({ body });
    assert.throws(() => load().assertSentClientPackageMessage_(x.message, 'briankeith@rogersholdingsllc.com', x.content, x.files));
  }
});

test('tampered body, recipient, attachment bytes, and duplicate attachments reject', () => {
  for (const overrides of [
    { body: 'tampered' }, { to: 'other@example.com' },
    { attachments: [blob('Executive Brief.pdf', [9]), blob('Digital Business Assessment.pdf', [2]), blob('Improvement Plan.pdf', [3])] },
    { attachments: [blob('Executive Brief.pdf', [1]), blob('Executive Brief.pdf', [1]), blob('Improvement Plan.pdf', [3])] }
  ]) {
    const x = exactSentMessage(overrides);
    assert.throws(() => load().assertSentClientPackageMessage_(x.message, 'briankeith@rogersholdingsllc.com', x.content, x.files));
  }
});

test('Activity failure restores only operation-owned Prospect and Activity state', () => {
  const h = harness({ failActivityWrite: true });
  const before = h.row.slice();
  assert.throws(() => h.context.reconcileManuallySentClientPackageTransactional_(h.selected), /rolled back/);
  assert.deepEqual(h.row, before);
  assert.equal(h.activityRows.length, 1);
  assert.ok(h.activityRows[0].every(v => v === 'fixture-activity-preserved'));
});

test('menu, confirmation, zero-send boundary, and production exclusion remain explicit', () => {
  assert.match(MENU, /Reconcile Manually Sent Client Package.*reconcileManuallySentClientPackage/);
  assert.match(SOURCE, /CLIENT_PACKAGE_SENT_CONFIRMATION = 'RECONCILE SENT CLIENT PACKAGE'/);
  const boundary = SOURCE.slice(SOURCE.indexOf('function reconcileManuallySentClientPackage()'));
  assert.doesNotMatch(boundary, /createDraft|sendEmail|sendDraft|GmailApp\.send|createFile|generateProposal|generateAuditPackage/);
  assert.doesNotMatch(boundary, /1aoOL0_ff6PARRB53rh8YbvjNBfgV4EpWrqeyiiHKd0ZTbESxgMdumsKo/);
  assert.match(boundary, /validateProspectStageTransition_\(current, 'Executive Brief Sent'\)/);
});
