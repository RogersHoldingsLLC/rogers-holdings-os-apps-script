const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'DriveEngine.gs'), 'utf8');

function harness(options = {}) {
  const activityKeys = new Set();
  const calls = [];
  const clientValues = ['CLI-1', 'Rogers Holdings LLC'];
  const context = {
    console,
    CLIENTS_SHEET: 'Clients',
    buildLifecycleOperationKey_: () => 'LIFECYCLE:pros-af21065cd5c8:project-started',
    ensureLifecycleReconciliationColumns_: () => ({}),
    setLifecycleOperationMarker_: (_c, key, state, details) => calls.push(['marker', key, state, details]),
    getOrCreateClientsSheet_: () => ({}),
    ensureClientColumns_: () => ({ headers: {}, lastColumn: 2 }),
    ensureProspectConversionColumns_: () => ({}),
    buildClientProspectFromRow_: () => ({ company: 'Rogers Holdings LLC' }),
    startOfDay_: value => value,
    upsertClientRecordFromProspect_: () => { calls.push(['client-upsert']); return { created: false, updated: true, rowNumber: 8, clientId: 'CLI-1' }; },
    verifyPersistedClientRecord_: () => {
      calls.push(['client-readback']);
      if (options.failClientReadback) throw new Error('Drive access denied for acceptance client folder.');
      return { rowNumber: 8, values: clientValues };
    },
    buildProjectClientModel_: () => ({ clientId: 'CLI-1', company: 'Rogers Holdings LLC', service: 'Business Snapshot' }),
    upsertProjectFromClient_: () => { calls.push(['project-upsert']); return { created: false, updated: true, rowNumber: 5, projectId: 'PRJ-1', status: 'Planning' }; },
    verifyPersistedProjectRecord_: () => ({ rowNumber: 5, values: ['PRJ-1'] }),
    refreshClientWorkspaceForClientRow_: () => calls.push(['workspace']),
    applyConfirmedProspectTransition_: (_c, stage, type, notes, settings) => calls.push(['transition', stage, type, notes, settings.operationKey]),
    lifecycleActivityExists_: (_ss, key) => activityKeys.has(key),
    logPipelineActivity_: (_ss, company, type, notes) => {
      calls.push(['activity', company, type, notes]);
      const match = notes.match(/\[Operation ([^\]]+)\]/);
      if (match) activityKeys.add(match[1]);
    },
    refreshSalesOperatingSystem_: () => calls.push(['refresh']),
    ...options.extra
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  Object.assign(context, {
    buildLifecycleOperationKey_: () => 'LIFECYCLE:pros-af21065cd5c8:project-started',
    ensureLifecycleReconciliationColumns_: () => ({}),
    setLifecycleOperationMarker_: (_c, key, state, details) => calls.push(['marker', key, state, details]),
    getOrCreateClientsSheet_: () => ({}),
    ensureClientColumns_: () => ({ headers: {}, lastColumn: 2 }),
    ensureProspectConversionColumns_: () => ({}),
    buildClientProspectFromRow_: () => ({ company: 'Rogers Holdings LLC' }),
    startOfDay_: value => value,
    upsertClientRecordFromProspect_: () => { calls.push(['client-upsert']); return { created: false, updated: true, rowNumber: 8, clientId: 'CLI-1' }; },
    verifyPersistedClientRecord_: () => {
      calls.push(['client-readback']);
      if (options.failClientReadback) throw new Error('Drive access denied for acceptance client folder.');
      return { rowNumber: 8, values: clientValues };
    },
    buildProjectClientModel_: () => ({ clientId: 'CLI-1', company: 'Rogers Holdings LLC', service: 'Business Snapshot' }),
    upsertProjectFromClient_: () => { calls.push(['project-upsert']); return { created: false, updated: true, rowNumber: 5, projectId: 'PRJ-1', status: 'Planning' }; },
    verifyPersistedProjectRecord_: () => ({ rowNumber: 5, values: ['PRJ-1'] }),
    refreshClientWorkspaceForClientRow_: () => calls.push(['workspace']),
    applyConfirmedProspectTransition_: (_c, stage, type, notes, settings) => calls.push(['transition', stage, type, notes, settings.operationKey]),
    lifecycleActivityExists_: (_ss, key) => activityKeys.has(key),
    logPipelineActivity_: (_ss, company, type, notes) => {
      calls.push(['activity', company, type, notes]);
      const match = notes.match(/\[Operation ([^\]]+)\]/);
      if (match) activityKeys.add(match[1]);
    },
    refreshSalesOperatingSystem_: () => calls.push(['refresh']),
    ...options.extra
  });
  const selected = {
    ss: {}, selectedRow: 21, table: { headers: {}, lastColumn: 47 },
    sheet: { getLastColumn: () => 47, getRange: () => ({ getValues: () => [new Array(47).fill('')] }) }
  };
  return { context, selected, calls, activityKeys };
}

test('partial retry reuses the existing Client, Project, and operation identity then commits lifecycle', () => {
  const h = harness();
  const result = h.context.convertWonProspectToClient_(h.selected, {
    targetStage: 'Project Started', activityType: 'Improvement Plan Accepted', activityNotes: 'accepted', lockHeld: true
  });
  assert.equal(result.created, false);
  assert.equal(h.calls.filter(x => x[0] === 'client-upsert').length, 1);
  assert.equal(h.calls.filter(x => x[0] === 'project-upsert').length, 1);
  assert.deepEqual(h.calls.find(x => x[0] === 'transition').slice(1), [
    'Project Started', 'Improvement Plan Accepted', 'accepted', 'LIFECYCLE:pros-af21065cd5c8:project-started'
  ]);
});

test('Project Started Activity reconciliation is exact-once across retry', () => {
  const h = harness();
  const settings = { targetStage: 'Project Started', activityType: 'Improvement Plan Accepted', activityNotes: 'accepted', lockHeld: true };
  h.context.convertWonProspectToClient_(h.selected, settings);
  h.context.convertWonProspectToClient_(h.selected, settings);
  assert.equal(h.calls.filter(x => x[0] === 'activity' && x[2] === 'Project Started').length, 1);
  assert.ok(h.activityKeys.has('LIFECYCLE:pros-af21065cd5c8:project-started:PROJECT'));
});

test('failure preserves its exact stage and underlying detail', () => {
  const h = harness({ failClientReadback: true });
  assert.throws(
    () => h.context.convertWonProspectToClient_(h.selected, { targetStage: 'Project Started', lockHeld: true }),
    /failed at client-readback: Drive access denied for acceptance client folder/
  );
  assert.equal(h.calls.some(x => x[0] === 'project-upsert'), false);
  assert.equal(h.calls.some(x => x[0] === 'transition'), false);
});

test('public failure alert includes exact error detail and the persisted CRM stage', () => {
  assert.match(SOURCE, /Client\/project operation failed: \$\{failureDetail\}/);
  assert.match(SOURCE, /Current CRM Status: \$\{currentAfterFailure/);
  assert.doesNotMatch(SOURCE, /GmailApp\.send|sendEmail|createDraft/);
});
