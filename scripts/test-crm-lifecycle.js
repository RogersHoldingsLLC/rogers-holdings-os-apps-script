const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
['Config.gs', 'DemoData.gs', 'SheetHelpers.gs', 'CalendarEngine.gs', 'DriveEngine.gs', 'Menu.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
});

const validate = context.validateProspectStageTransition_;
const stages = Array.from(context.PIPELINE_STAGES);
const allowed = {
  'Lead Found': ['Executive Snapshot Sent', 'Nurture', 'Lost'],
  'Executive Snapshot Sent': ['Discovery Meeting Scheduled', 'Nurture', 'Lost'],
  'Discovery Meeting Scheduled': ['Digital Business Assessment Presented', 'Nurture', 'Lost'],
  'Digital Business Assessment Presented': ['Improvement Plan Sent', 'Nurture', 'Lost'],
  'Improvement Plan Sent': ['Project Started', 'Nurture', 'Lost'],
  'Project Started': ['Client'],
  'Client': [],
  'Nurture': [],
  'Lost': []
};

stages.forEach((from) => {
  stages.forEach((to) => {
    const result = validate(from, to);
    assert.strictEqual(result.allowed, from === to || allowed[from].includes(to), `${from} -> ${to}`);
    assert.strictEqual(result.idempotent, from === to, `idempotency ${from} -> ${to}`);
  });
});
assert.strictEqual(validate('Nurture', 'Lead Found').allowed, false);
assert.strictEqual(validate('Nurture', 'Lead Found', { allowNurtureReentry: true }).allowed, true);
assert.strictEqual(validate('Project Started', 'Nurture').allowed, false);
assert.strictEqual(validate('Project Started', 'Lost').allowed, false);

const artifactLabels = ['Draft Created', 'Gmail Draft Created', 'Executive Snapshot Generated', 'Audit Complete', 'Audit Package Sent', 'Proposal Sent', 'Won', 'Active'];
artifactLabels.forEach((label) => {
  assert.strictEqual(context.normalizePipelineStage_(label), '', `pipeline alias ${label}`);
  assert.strictEqual(context.normalizeProspectStatus_(label, stages), label, `status normalization ${label}`);
});

const nextActions = Array.from(context.PROSPECT_DROPDOWN_DEFAULTS['Next Action']);
assert.strictEqual(context.normalizeNextAction_('Convert to Client', nextActions), 'Record Improvement Plan Outcome');
assert.strictEqual(context.normalizeNextAction_('Start Project', nextActions), 'Record Improvement Plan Outcome');

const decide = context.getDiscoverySchedulingDecision_;
assert.strictEqual(decide({}, 'op-1', false), 'create');
assert.strictEqual(decide({ key: 'op-1', state: 'Event Verified', eventId: 'event-1' }, 'op-1', true), 'use-existing');
assert.strictEqual(decide({ key: 'op-1', state: 'Ambiguous; Reconciliation Required', eventId: '' }, 'op-1', false), 'block-ambiguous');
assert.strictEqual(decide({ key: 'op-1', state: 'Event Verified', eventId: 'event-1' }, 'op-2', false), 'block-different-operation');
assert.strictEqual(decide({ key: 'op-1', state: 'Ambiguous; Reconciliation Required', eventId: '' }, 'op-2', false), 'block-different-operation');
assert.strictEqual(decide({ key: 'op-1', state: 'Event Verified', eventId: 'event-1' }, 'op-2', true), 'block-different-operation');

function fakeCell(initialValue, failVerification) {
  let value = initialValue;
  return {
    setValue(next) { value = failVerification ? 'wrong' : next; return this; },
    clearContent() { value = failVerification ? 'wrong' : ''; return this; },
    getValue() { return value; }
  };
}

const missingPriorCell = fakeCell('Client');
assert.strictEqual(context.restoreManualStatusCell_(missingPriorCell, ''), '');
assert.strictEqual(missingPriorCell.getValue(), '');
const snapshotCell = fakeCell('Client');
assert.strictEqual(context.restoreManualStatusCell_(snapshotCell, 'Executive Snapshot Sent'), 'Executive Snapshot Sent');
assert.strictEqual(snapshotCell.getValue(), 'Executive Snapshot Sent');
assert.throws(() => context.restoreManualStatusCell_(fakeCell('Client', true), 'Lead Found'), /verification failed/);
['Lead Found', 'Nurture'].forEach((prior) => {
  const pastedCell = fakeCell('Client');
  context.restoreManualStatusCell_(pastedCell, prior);
  assert.strictEqual(pastedCell.getValue(), prior, 'multi-row Status paste restoration');
});
const adjacentValue = { value: 'DO NOT CHANGE' };
context.restoreManualStatusCell_(fakeCell('Client'), 'Lead Found');
assert.strictEqual(adjacentValue.value, 'DO NOT CHANGE', 'adjacent paste value');

const start = new Date('2026-08-01T14:00:00.000Z');
const end = new Date('2026-08-01T14:30:00.000Z');
const operationKey = 'DISCOVERY:prospect-1:2026-08-01T14:00:00.000Z:2026-08-01T14:30:00.000Z:primary';
const exactEvent = {
  status: 'confirmed', description: `Lifecycle Operation: ${operationKey}`,
  start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
  extendedProperties: { private: { rogersLifecycleOperation: operationKey } }
};
assert.strictEqual(context.calendarEventMatchesOperation_(exactEvent, start, end, operationKey), true, 'exact-time Calendar retry reuse');
assert.strictEqual(context.calendarEventMatchesOperation_(exactEvent, new Date(start.getTime() + 60000), end, operationKey), false, 'stored event mismatched start');
assert.strictEqual(context.calendarEventMatchesOperation_(exactEvent, start, new Date(end.getTime() + 60000), operationKey), false, 'operation key mismatched end');
assert.strictEqual(context.calendarEventMatchesOperation_(exactEvent, start, end, operationKey + '-conflict'), false, 'conflicting prospect operation');

const expectedClient = { clientId: 'CLI-1', company: 'acme', website: 'https://acme.example', status: 'Onboarding' };
const validClient = { rowNumber: 2, clientId: 'CLI-1', company: 'acme', website: 'https://acme.example', status: 'Onboarding', values: [] };
assert.strictEqual(context.evaluatePersistedClientMatches_([], expectedClient).verified, false, 'Client write failed re-read');
assert.strictEqual(context.evaluatePersistedClientMatches_([validClient, validClient], expectedClient).verified, false, 'ambiguous Client lookup');
assert.strictEqual(context.evaluatePersistedClientMatches_([validClient], expectedClient).verified, true, 'verified Client record');

const expectedProject = { projectId: 'PRJ-1', clientId: 'CLI-1', company: 'acme', service: 'seo', status: 'Planning' };
const validProject = { rowNumber: 2, projectId: 'PRJ-1', clientId: 'CLI-1', company: 'acme', service: 'seo', status: 'Planning', values: [] };
assert.strictEqual(context.evaluatePersistedProjectMatches_([], expectedProject).verified, false, 'Project write failed re-read');
assert.strictEqual(context.evaluatePersistedProjectMatches_([validProject, validProject], expectedProject).verified, false, 'ambiguous Project lookup');
assert.strictEqual(context.evaluatePersistedProjectMatches_([validProject], expectedProject).verified, true, 'verified Project record');
const partialProject = Object.assign({}, validProject, { status: '' });
assert.strictEqual(context.evaluatePersistedProjectMatches_([partialProject], expectedProject).verified, false, 'partial Project requires repair');
assert.strictEqual(context.evaluatePersistedProjectMatches_([validProject], expectedProject).verified, true, 'same-stage retry repaired partial Project');

console.log('CRM lifecycle deterministic tests passed.');
