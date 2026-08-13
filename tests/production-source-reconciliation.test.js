const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const headquartersSource = fs.readFileSync(path.join(root, 'HeadquartersSalesFeed.gs'), 'utf8');
const driveSource = fs.readFileSync(path.join(root, 'DriveEngine.gs'), 'utf8');
const sheetSource = fs.readFileSync(path.join(root, 'SheetHelpers.gs'), 'utf8');
const auditSource = fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8');

test('Headquarters Sales Feed source and privacy-minimized v1 contract remain present', () => {
  const context = vm.createContext({
    console: { warn: () => {} },
    PROSPECT_DROPDOWN_DEFAULTS: { 'Next Action': ['Generate Executive Brief'] },
    PIPELINE_STAGES: ['Lead Found', 'Discovery Meeting Scheduled', 'Digital Business Assessment', 'Improvement Plan Sent', 'Client', 'Lost', 'Nurture'],
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map(value => value > 127 ? value - 256 : value)
    },
    startOfDay_: value => { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
  });
  vm.runInContext(headquartersSource, context);
  const feed = context.buildHeadquartersSalesFeedV1FromSource_({
    prospects: [{ id: 'PROS-1', status: 'Lead Found', nextAction: 'Generate Executive Brief', dueAt: null, lastActivityAt: null }],
    followUps: [], clients: [], projects: []
  }, new Date('2026-08-13T12:00:00Z'));
  assert.equal(feed.version, '1.0');
  assert.equal(feed.sales.prospects, 1);
  assert.equal(feed.revenue.connected, false);
  assert.doesNotMatch(JSON.stringify(feed), /company|contact|email|phone|website/i);
});

test('configured Drive root and duplicate company folder protections match production behavior', () => {
  assert.match(driveSource, /BOP_CLIENT_DRIVE_ROOT_PROPERTY = 'BOP_CLIENT_DRIVE_ROOT_ID'/);
  assert.match(driveSource, /function getConfiguredClientDriveRootFolder_/);
  assert.match(driveSource, /function getExactChildFolderOrThrow_/);
  assert.match(driveSource, /Multiple client folders named/);
  assert.match(driveSource, /existing \|\| configuredRoot\.createFolder\(folderName\)/);
  assert.match(sheetSource, /getClientProjectFolderUrl_[\s\S]*getExistingClientArtifactFolder_\(company\)/);
  assert.match(sheetSource, /getClientWorkspaceFolderInfo_[\s\S]*getExistingClientArtifactFolder_\(company\)/);
  assert.match(auditSource, /getAuditPackageFolder_[\s\S]*getExistingClientArtifactFolder_\(company\)/);
});
