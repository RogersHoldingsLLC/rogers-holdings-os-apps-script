const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const logged = [];
const context = vm.createContext({
  console: {
    log: (...args) => logged.push(args.join(' ')),
    warn: (...args) => logged.push(args.join(' ')),
    error: (...args) => logged.push(args.join(' '))
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(algorithm, value) {
      return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
        .map((byte) => byte > 127 ? byte - 256 : byte);
    }
  }
});
context.PROSPECT_DROPDOWN_DEFAULTS = {
  'Next Action': [
    'Generate Executive Brief', 'Create Outreach Draft', 'Review Outreach',
    'Confirm Executive Brief Sent', 'Schedule Discovery Meeting',
    'Present Digital Business Assessment', 'Confirm Digital Business Assessment',
    'Generate Improvement Plan', 'Confirm Improvement Plan Sent',
    'Record Improvement Plan Outcome', 'Complete Client Onboarding',
    'Reactivate Nurtured Prospect', 'Follow Up', 'Nurture', 'Archived'
  ]
};
context.PIPELINE_STAGES = [
  'Lead Found', 'Executive Brief Sent', 'Discovery Meeting Scheduled',
  'Digital Business Assessment', 'Improvement Plan Sent',
  'Project Started', 'Client', 'Nurture', 'Lost'
];

vm.runInContext(`
function startOfDay_(value) {
  var date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
`, context);
vm.runInContext(fs.readFileSync(path.join(root, 'HeadquartersSalesFeed.gs'), 'utf8'), context, {
  filename: 'HeadquartersSalesFeed.gs'
});

const now = new Date('2026-08-11T14:00:00.000Z');
const source = {
  prospects: [
    { id: 'PRO-1', status: 'Lead Found', nextAction: 'Follow Up', dueAt: null, lastActivityAt: new Date('2026-08-09T14:00:00.000Z') },
    { id: 'PRO-2', status: 'Discovery Meeting Scheduled', nextAction: 'Present Digital Business Assessment', dueAt: null, lastActivityAt: null },
    { id: 'PRO-3', status: 'Digital Business Assessment', nextAction: 'Generate Improvement Plan', dueAt: null, lastActivityAt: null },
    { id: 'PRO-4', status: 'Improvement Plan Sent', nextAction: 'Record Improvement Plan Outcome', dueAt: null, lastActivityAt: null },
    { id: 'PRO-5', status: 'Digital Business Assessment', nextAction: '', dueAt: null, lastActivityAt: null, planGenerated: true },
    { id: 'PRO-6', status: 'Lost', nextAction: '', dueAt: null, lastActivityAt: null }
  ],
  followUps: [
    { id: 'FU-1', relatedProspectId: 'PRO-1', relatedClientId: '', stage: 'Lead Found', type: 'Call prospect', dueAt: new Date('2026-08-10T15:00:00.000Z'), completed: false },
    { id: 'FU-2', relatedProspectId: 'PRO-2', relatedClientId: '', stage: 'Discovery Meeting Scheduled', type: 'Prepare meeting', dueAt: new Date('2026-08-11T15:00:00.000Z'), completed: false },
    { id: 'FU-3', relatedProspectId: 'PRO-3', relatedClientId: '', stage: 'Digital Business Assessment', type: 'Finished task', dueAt: new Date('2026-08-10T15:00:00.000Z'), completed: true }
  ],
  clients: [
    { id: 'CLI-1', companyPresent: true, status: 'Active' },
    { id: 'CLI-2', companyPresent: true, status: 'Inactive' }
  ],
  projects: [
    { id: 'PRJ-1', status: 'In Progress', dueAt: new Date('2026-08-13T15:00:00.000Z') },
    { id: 'PRJ-2', status: 'Review', dueAt: new Date('2026-08-10T15:00:00.000Z') },
    { id: 'PRJ-3', status: 'Completed', dueAt: new Date('2026-08-10T15:00:00.000Z') },
    { id: 'PRJ-4', status: 'Cancelled', dueAt: null },
    { id: 'PRJ-5', status: 'Maintenance', dueAt: null }
  ]
};

const feed = context.buildHeadquartersSalesFeedV1FromSource_(source, now);
assert.deepStrictEqual(Array.from(Object.keys(feed)), ['version', 'generatedAt', 'expiresAt', 'source', 'status', 'sales', 'actions', 'delivery', 'revenue'], 'exact top-level schema');
assert.deepStrictEqual(Array.from(Object.keys(feed.sales)), ['prospects', 'followUpsDue', 'overdueFollowUps', 'meetingsScheduled', 'assessmentsPresented', 'plansSent', 'clients', 'activeProjects', 'lostOpportunities'], 'exact sales schema');
assert.deepStrictEqual(Array.from(Object.keys(feed.actions[0])), ['id', 'kind', 'stage', 'nextAction', 'dueAt', 'waitingDays', 'needsBrian', 'lastActivityAt'], 'exact action schema');
assert.deepStrictEqual(Array.from(Object.keys(feed.delivery)), ['activeClients', 'activeProjects', 'dueSoon', 'overdue'], 'exact delivery schema');
assert.deepStrictEqual(Array.from(Object.keys(feed.revenue)), ['connected'], 'exact revenue schema');
assert.strictEqual(feed.sales.prospects, 6, 'prospect count');
assert.strictEqual(feed.sales.followUpsDue, 1, 'follow-ups due today');
assert.strictEqual(feed.sales.overdueFollowUps, 1, 'overdue follow-ups');
assert.strictEqual(feed.sales.meetingsScheduled, 1, 'meeting count');
assert.strictEqual(feed.sales.assessmentsPresented, 2, 'assessment count');
assert.strictEqual(feed.sales.plansSent, 1, 'generated-but-unsent plan excluded');
assert.strictEqual(feed.sales.clients, 1, 'active clients');
assert.strictEqual(feed.sales.activeProjects, 2, 'terminal projects excluded');
assert.strictEqual(feed.sales.lostOpportunities, 1, 'lost opportunities');
assert.strictEqual(feed.actions.some((item) => item.nextAction === 'Finished task'), false, 'completed follow-up excluded');
assert(feed.actions.every((item) => /^hq_[0-9a-f]{24}$/.test(item.id)), 'opaque action identifiers');
assert(feed.actions.every((item) => !Object.keys(item).some((key) => /company|client|customer|email|phone|notes|url|drive|calendar|row/i.test(key))), 'no PII fields');
assert.strictEqual(feed.revenue.connected, false, 'revenue disconnected');
assert.strictEqual(Object.keys(feed.revenue).length, 1, 'no revenue fabrication');
assert.strictEqual(feed.generatedAt, now.toISOString(), 'generatedAt');
assert.strictEqual(feed.expiresAt, '2026-08-11T14:05:00.000Z', 'expiresAt');
assert.deepStrictEqual(JSON.parse(JSON.stringify(feed.status)), { healthy: true, partial: false }, 'healthy status');

const originalActionsBuilder = context.buildHeadquartersActionsV1_;
context.buildHeadquartersActionsV1_ = function() { throw new Error('fixture failure'); };
const partialFeed = context.buildHeadquartersSalesFeedV1FromSource_(source, now);
assert.deepStrictEqual(JSON.parse(JSON.stringify(partialFeed.status)), { healthy: true, partial: true }, 'partial status');
assert.deepStrictEqual(Array.from(partialFeed.actions), [], 'unavailable optional section fails closed');
context.buildHeadquartersActionsV1_ = originalActionsBuilder;

let configuredToken = 'test-only-secret';
context.PropertiesService = {
  getScriptProperties() {
    return { getProperty: () => configuredToken };
  }
};
context.ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput(text) {
    return { text, mimeType: '', setMimeType(value) { this.mimeType = value; return this; } };
  }
};
context.buildHeadquartersSalesFeedV1_ = () => feed;
const post = (body) => context.doPost(body === undefined ? {} : { postData: { contents: JSON.stringify(body) } });
assert.deepStrictEqual(JSON.parse(post().text), { error: 'unauthorized' }, 'missing auth rejected');
assert.deepStrictEqual(JSON.parse(post({ version: '1.0', token: 'wrong' }).text), { error: 'unauthorized' }, 'incorrect auth rejected');
assert.strictEqual(JSON.parse(post({ version: '1.0', token: configuredToken }).text).version, '1.0', 'correct auth accepted');
assert.strictEqual(post({ version: '1.0', token: configuredToken }).mimeType, 'application/json', 'JSON content type');
context.buildHeadquartersSalesFeedV1_ = () => { throw new Error('fixture source failure'); };
assert.deepStrictEqual(JSON.parse(post({ version: '1.0', token: configuredToken }).text), {
  version: '1.0', status: { healthy: false, partial: false }, error: 'unavailable'
}, 'untrusted feed reports unhealthy and fails closed');
assert.strictEqual(logged.join('\n').includes(configuredToken), false, 'secret never logged');

const sourceText = fs.readFileSync(path.join(root, 'HeadquartersSalesFeed.gs'), 'utf8');
assert(!/\.(setValue|setValues|clearContent|appendRow|insertRow|insertSheet|deleteRow|deleteSheet)\s*\(/.test(sourceText), 'feed module contains no sheet writes');
assert(!/console\.(log|warn|error)\s*\([^)]*(token|body|request|error)/i.test(sourceText), 'auth material and errors are not logged');
assert.strictEqual(/function\s+doGet\s*\(/.test(sourceText), false, 'doGet remains absent');

console.log('Headquarters Sales Feed v1 deterministic tests passed.');
