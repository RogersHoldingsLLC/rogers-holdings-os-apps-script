#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, 'ProspectRevenueWorkflow.gs'), 'utf8');
const config = fs.readFileSync(path.join(root, 'Config.gs'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'Menu.gs'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'SheetHelpers.gs'), 'utf8');

[
  'Prospect ID',
  'Validation Status',
  'Inspection Status',
  'Workflow Status',
  'Workflow Operation Key',
  'Review Status'
].forEach((field) => assert.ok(config.includes(`'${field}'`), `workflow field ${field}`));

[
  'validateSelectedProspectForRevenue',
  'prepareProspectForOutreach',
  'resumeProspectRevenueWorkflow',
  'approveProspectForManualOutreach',
  'requestProspectRevenueChanges'
].forEach((entrypoint) => {
  assert.match(workflow, new RegExp(`function ${entrypoint}\\(`), `entrypoint ${entrypoint}`);
  assert.ok(menu.includes(`'${entrypoint}'`), `menu target ${entrypoint}`);
});

assert.match(workflow, /reconcileExactGmailDraft_\(/, 'uses established Gmail draft reconciliation');
assert.doesNotMatch(workflow, /GmailApp\.(sendEmail|send)|MailApp\.sendEmail|\.send\(\)/, 'workflow cannot send email');
assert.doesNotMatch(workflow, /applyConfirmedProspectTransition_|setProspectStatus_/, 'preparation cannot advance CRM Status');
assert.match(workflow, /Review Status', 'Needs Brian Review'/, 'preparation requires Brian review');
assert.match(workflow, /Review Notes', ''/, 'a resumed review clears stale approval notes');
assert.match(workflow, /No email was sent and CRM Status was not advanced/, 'operator boundary is explicit');
assert.match(workflow, /PTR:' \+ validation\.prospectId \+ ':V1'/, 'stable operation key is prospect-bound');
assert.match(workspace, /Prospect-to-Revenue Readiness/, 'workspace exposes readiness state');
assert.match(workspace, /Validation Details/, 'workspace exposes blocking details');
assert.match(menu, /ensureProspectRevenueWorkflowSchema_/, 'onOpen ensures the idempotent schema');
assert.match(workflow, /ensureProspectRevenueNextActionValidation_/, 'workflow repairs legacy Next Action validation');
assert.match(workflow, /requireValueInList\(approved, true\)/, 'workflow installs the canonical Next Action choices');

console.log('Prospect-to-Revenue Workflow deterministic tests passed.');
