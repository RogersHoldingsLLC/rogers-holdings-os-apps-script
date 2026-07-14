const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console,
  firstNonBlank_(values) {
    return values.find((value) => String(value || '').trim()) || '';
  },
  PropertiesService: {
    getScriptProperties() {
      return { getProperty() { return ''; } };
    }
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'Config.gs'), 'utf8'), context, { filename: 'Config.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8'), context, { filename: 'AuditEngine.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'GmailEngine.gs'), 'utf8'), context, { filename: 'GmailEngine.gs' });

const verified = {
  company: 'Acceptance Test Co',
  website: 'https://example.test',
  auditScore: 82,
  auditOutcome: 'Good Fit',
  priorityTier: 'A - Hot',
  auditSource: 'Website Audit Tool',
  summary: 'Verified assessment summary.',
  notes: 'Verified finding.',
  websiteScreenshotBase64: 'desktop-evidence',
  websiteScreenshotMimeType: 'image/png',
  mobileScreenshotUrl: 'https://example.test/mobile.png'
};

assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(verified), true, 'complete verified audit is locally renderable');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: '' })), false, 'blank legacy audit provenance remains unverified');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: 'D - Nurture' })), false, 'Priority Tier value is not audit provenance');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: 'Arbitrary Text' })), false, 'arbitrary audit provenance is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: 'Authoritative Import' })), false, 'unimplemented import provenance is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: ' Website Audit Tool ' })), false, 'verified provenance must match exactly');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: '', source: 'Website Audit Tool' })), false, 'general Source column never supplies audit provenance');
const local = context.buildLocalAuditReportInput_(verified);
assert.strictEqual(local.text, verified.summary, 'local assessment uses existing report narrative');
assert.strictEqual(local.websiteScreenshotBase64, 'desktop-evidence', 'desktop evidence is preserved');
assert.strictEqual(local.mobileScreenshotUrl, verified.mobileScreenshotUrl, 'mobile evidence is preserved');
assert.strictEqual(local.metadata.renderingSource, 'Local prospect audit data');

assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditScore: '' })), false, 'missing audit data blocks local rendering');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditSource: 'Quick Internal Audit' })), false, 'placeholder audit is not verified');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditScore: -1 })), false, 'negative audit score is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditScore: 101 })), false, 'audit score above 100 is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditScore: 'not numeric' })), false, 'nonnumeric audit score is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditOutcome: 'Not Audited' })), false, 'nonproduction audit outcome is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { priorityTier: 'D - Nurture' })), false, 'nonproduction priority tier is rejected');
assert.strictEqual(context.isVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { summary: '', notes: '' })), false, 'missing PDF narrative is rejected');
assert.throws(() => context.assertVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { priorityTier: '' })), /Priority Tier/);
assert.throws(
  () => context.assertVerifiedAuditDataForLocalRendering_(Object.assign({}, verified, { auditScore: 101, auditOutcome: 'Not Audited' })),
  /Invalid: Audit Score.*Audit Outcome/,
  'operator message lists invalid readiness fields'
);
assert.match(context.buildVerifiedAuditRequiredMessage_(Object.assign({}, verified, { auditSource: '' })), /Missing: Audit Source/);
assert.strictEqual(context.getWebsiteAuditToolEndpoint_(), '', 'explicit real audit has no endpoint in the test fixture');
assert.throws(() => context.runWebsiteAuditToolWorkflow_(verified), /Fresh website audit acquisition requires/);

let endpointReportRequests = 0;
context.requestWebsiteAuditPackageReport_ = () => { endpointReportRequests += 1; throw new Error('endpoint must not be called'); };
context.buildOutreachDrafts_ = () => ({ subject: 'Assessment', initialEmail: 'Body' });
context.buildProposal_ = () => ({});
context.getOrCreateAuditPackageFolder_ = () => ({ getName: () => 'Acceptance Test Co' });
context.storeAuditPackageFiles_ = () => [{ getName: () => 'AuditReport.pdf' }];
context.ensureSheetColumns_ = () => ({ headers: {} });
context.setIfHeaderCell_ = () => {};
context.updateSelectedProspectLastActivity_ = () => {};
const packageActivities = [];
context.logPipelineActivity_ = (ss, company, type, notes) => packageActivities.push({ company, type, notes });
let unexpectedGmailDraftCalls = 0;
context.GmailApp = {
  createDraft() { unexpectedGmailDraftCalls += 1; }
};
const packageResult = context.generateAuditPackageForContext_({ sheet: {}, ss: {}, selectedRow: 2 }, verified);
assert.strictEqual(endpointReportRequests, 0, 'local assessment rendering does not request the endpoint report');
assert.strictEqual(packageResult.reportFile.websiteScreenshotBase64, verified.websiteScreenshotBase64);
const outreachFileActivity = packageActivities.find((activity) => activity.type === 'Outreach Draft File Created');
assert.ok(outreachFileActivity, 'assessment generation logs the Drive text draft truthfully');
assert.match(outreachFileActivity.notes, /Outreach Email Draft\.txt/);
assert.strictEqual(packageActivities.some((activity) => /Gmail Draft Created/.test(activity.type)), false, 'assessment generation does not claim a Gmail draft');
assert.strictEqual(unexpectedGmailDraftCalls, 0, 'assessment generation does not call Gmail');

function makeDraft(to, subject, body, options) {
  return {
    to, subject, body, options: options || {}, updateCount: 0,
    getMessage() { return { getTo: () => this.to, getSubject: () => this.subject }; },
    update(nextTo, nextSubject, nextBody, nextOptions) {
      this.to = nextTo; this.subject = nextSubject; this.body = nextBody;
      this.options = nextOptions || {}; this.updateCount += 1; return this;
    }
  };
}

let gmailDrafts = [];
let createCount = 0;
let createBehavior = null;
context.GmailApp = {
  getDrafts: () => gmailDrafts.slice(),
  createDraft(to, subject, body, options) {
    createCount += 1;
    if (createBehavior) return createBehavior(to, subject, body, options);
    const draft = makeDraft(to, subject, body, options);
    gmailDrafts.push(draft);
    return draft;
  }
};

let result = context.reconcileExactGmailDraft_('OUTREACH@example.test', ' Website review ', 'First body');
assert.strictEqual(result.created, true, 'first outreach draft run creates one draft');
assert.strictEqual(gmailDrafts.length, 1);
result = context.reconcileExactGmailDraft_('outreach@example.test', 'Website review', 'Refreshed body');
assert.strictEqual(result.created, false, 'second outreach draft run reuses the same draft');
assert.strictEqual(result.updated, true);
assert.strictEqual(gmailDrafts.length, 1);
assert.strictEqual(gmailDrafts[0].body, 'Refreshed body');

gmailDrafts = [];
createCount = 0;
result = context.createOrReconcileAssessmentGmailDraft_('audit@example.test', 'Assessment', 'Attached body', ['audit', 'proposal'], 'Folder body');
assert.strictEqual(result.created, true, 'first assessment draft run creates one draft');
assert.strictEqual(result.withAttachments, true);
assert.strictEqual(gmailDrafts.length, 1);
result = context.createOrReconcileAssessmentGmailDraft_('AUDIT@example.test', 'Assessment', 'Updated attached body', ['new-audit', 'new-proposal'], 'Folder body');
assert.strictEqual(result.created, false, 'second assessment draft run reuses the same draft');
assert.strictEqual(result.updated, true);
assert.strictEqual(gmailDrafts.length, 1);
assert.deepStrictEqual(gmailDrafts[0].options.attachments, ['new-audit', 'new-proposal']);

gmailDrafts = [];
createCount = 0;
result = context.createOrReuseFullPackageGmailDraft_('package@example.test', 'Package', 'Body');
assert.strictEqual(result.created, true, 'first full package run creates one draft');
result = context.createOrReuseFullPackageGmailDraft_('PACKAGE@example.test', 'Package', 'Updated body');
assert.strictEqual(result.created, false, 'full package retry still reuses one draft');
assert.strictEqual(gmailDrafts.length, 1);

gmailDrafts = [];
createCount = 0;
createBehavior = (to, subject, body, options) => {
  const persisted = makeDraft(to, subject, body, options);
  gmailDrafts.push(persisted);
  createBehavior = null;
  throw new Error('ambiguous Gmail create result');
};
result = context.createOrReconcileAssessmentGmailDraft_('audit@example.test', 'Persisted', 'Attached body', ['files'], 'Folder body');
assert.strictEqual(result.retainedAfterError, true, 'persisted matching draft is retained after ambiguous attachment error');
assert.strictEqual(result.withAttachments, null, 'ambiguous attachment result does not claim attachment verification');
assert.strictEqual(gmailDrafts.length, 1, 'persisted attachment draft does not cause a fallback duplicate');
assert.strictEqual(createCount, 1);

gmailDrafts = [];
createCount = 0;
let failedOnce = false;
createBehavior = (to, subject, body, options) => {
  if (!failedOnce) { failedOnce = true; throw new Error('attachment create failed before persistence'); }
  const fallback = makeDraft(to, subject, body, options);
  gmailDrafts.push(fallback);
  return fallback;
};
result = context.createOrReconcileAssessmentGmailDraft_('audit@example.test', 'Fallback', 'Attached body', ['files'], 'Folder body');
assert.strictEqual(result.created, true, 'no persisted attachment draft creates one fallback draft');
assert.strictEqual(result.withAttachments, false);
assert.strictEqual(gmailDrafts.length, 1, 'attachment fallback leaves exactly one active draft');
assert.strictEqual(gmailDrafts[0].body, 'Folder body');

createBehavior = null;
gmailDrafts = [makeDraft('dupe@example.test', 'Duplicate', 'One'), makeDraft('DUPE@example.test', 'Duplicate', 'Two')];
createCount = 0;
assert.throws(
  () => context.reconcileExactGmailDraft_('dupe@example.test', 'Duplicate', 'Three'),
  /Multiple Gmail drafts match/,
  'multiple exact draft matches fail safely'
);
assert.strictEqual(createCount, 0, 'ambiguity never creates another draft');
assert.strictEqual(gmailDrafts.every((draft) => draft.updateCount === 0), true, 'ambiguity never updates an arbitrary draft');

const driveContext = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'DriveEngine.gs'), 'utf8'), driveContext, { filename: 'DriveEngine.gs' });
const files = [
  { name: 'AuditReport.pdf', trashed: false, setTrashed(value) { this.trashed = value; } },
  { name: 'Audit Report.pdf', trashed: false, setTrashed(value) { this.trashed = value; } },
  { name: 'Proposal.pdf', trashed: false, setTrashed(value) { this.trashed = value; } },
  { name: 'Proposal.pdf', trashed: false, setTrashed(value) { this.trashed = value; } },
  { name: 'Outreach Email Draft.txt', contents: 'old', trashed: false, setContent(value) { this.contents = value; }, setDescription() { return this; }, setTrashed(value) { this.trashed = value; } },
  { name: 'Outreach Email Draft.txt', contents: 'duplicate', trashed: false, setContent(value) { this.contents = value; }, setDescription() { return this; }, setTrashed(value) { this.trashed = value; } }
];
const folder = {
  getFilesByName(name) {
    const matches = files.filter((file) => file.name === name && !file.trashed);
    let index = 0;
    return { hasNext: () => index < matches.length, next: () => matches[index++] };
  },
  createFile(blob) {
    const file = { name: blob.name, trashed: false, setDescription() { return this; }, setTrashed(value) { this.trashed = value; } };
    files.push(file);
    return file;
  }
};
const blob = { name: '', setName(name) { this.name = name; return this; } };
const reconciliation = [];
driveContext.reconcileAuditReportFile_(folder, blob, reconciliation);
driveContext.upsertAuditPackageBlobFile_(folder, 'Proposal.pdf', blob, reconciliation);
driveContext.upsertAuditPackageTextFile_(folder, 'Outreach Email Draft.txt', 'updated body', 'text/plain', reconciliation);
assert.strictEqual(files.filter((file) => file.name === 'AuditReport.pdf' && !file.trashed).length, 1, 'repeated package generation leaves one active AuditReport.pdf');
assert.strictEqual(files.filter((file) => file.name === 'Audit Report.pdf' && !file.trashed).length, 0, 'audit reconciliation removes the legacy spaced filename');
assert.strictEqual(files.filter((file) => file.name === 'Proposal.pdf' && !file.trashed).length, 1, 'repeated package generation leaves one active Proposal.pdf');
assert.strictEqual(files.filter((file) => file.name === 'Outreach Email Draft.txt' && !file.trashed).length, 1, 'repeated package generation leaves one active Outreach Email Draft.txt');
assert.strictEqual(files.find((file) => file.name === 'Outreach Email Draft.txt' && !file.trashed).contents, 'updated body', 'text artifact updates in place');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(reconciliation.map((result) => ({ fileName: result.fileName, action: result.action, removedDuplicates: result.removedDuplicates, removedPrevious: result.removedPrevious })))),
  [
    { fileName: 'AuditReport.pdf', action: 'replaced', removedDuplicates: 1, removedPrevious: 2 },
    { fileName: 'Proposal.pdf', action: 'replaced', removedDuplicates: 1, removedPrevious: 2 },
    { fileName: 'Outreach Email Draft.txt', action: 'updated', removedDuplicates: 1, removedPrevious: 0 }
  ],
  'PDF reconciliation explicitly reports replacement and duplicate removal'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(reconciliation[0])),
  {
    fileName: 'AuditReport.pdf',
    action: 'replaced',
    updated: false,
    replaced: true,
    removedDuplicates: 1,
    removedPrevious: 2,
    canonicalCopiesRemoved: 1,
    legacyCopiesRemoved: 1,
    createdFileName: 'AuditReport.pdf'
  },
  'audit reconciliation reports canonical and legacy removals plus the created canonical filename'
);

driveContext.reconcileAuditReportFile_(folder, blob, reconciliation);
assert.strictEqual(files.filter((file) => file.name === 'AuditReport.pdf' && !file.trashed).length, 1, 'another audit generation still leaves one active canonical report');
assert.strictEqual(files.filter((file) => file.name === 'Audit Report.pdf' && !file.trashed).length, 0, 'another audit generation leaves zero active legacy reports');
assert.strictEqual(files.filter((file) => file.name === 'Proposal.pdf' && !file.trashed).length, 1, 'audit retry does not change Proposal.pdf reconciliation');
assert.strictEqual(files.filter((file) => file.name === 'Outreach Email Draft.txt' && !file.trashed).length, 1, 'audit retry does not change Outreach Email Draft.txt reconciliation');

const healthContext = vm.createContext({
  console,
  PropertiesService: context.PropertiesService,
  addHealthItem_(report, status, check, detail, suggestedFix) {
    report.items.push({ status, check, detail, suggestedFix });
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'HealthCheck.gs'), 'utf8'), healthContext, { filename: 'HealthCheck.gs' });
const report = { items: [] };
healthContext.addScriptPropertyHealthChecks_(report);
assert.strictEqual(report.items[0].status, 'Warning', 'missing acquisition endpoint is a warning');
assert.match(report.items[0].detail, /Local package rendering remains available/);

const VALUE_IN_LIST = 'VALUE_IN_LIST';

function createValidationRule(values, allowInvalid) {
  return {
    values: values.slice(),
    allowInvalid: Boolean(allowInvalid),
    getCriteriaType() { return VALUE_IN_LIST; },
    getCriteriaValues() { return [this.values.slice(), true]; },
    getAllowInvalid() { return this.allowInvalid; }
  };
}

function createSheet(headers, rows, validationsByHeader) {
  const values = [headers.slice()].concat((rows || []).map((row) => row.slice()));
  const validations = values.map(() => headers.map(() => null));
  Object.keys(validationsByHeader || {}).forEach((header) => {
    const column = headers.indexOf(header);
    for (let row = 1; row < validations.length; row += 1) {
      validations[row][column] = validationsByHeader[header];
    }
  });
  return {
    values,
    validations,
    getLastColumn() { return this.values[0].length; },
    getMaxRows() { return Math.max(this.values.length, 1); },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      const sheet = this;
      return {
        getDisplayValues() {
          return Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, columnOffset) =>
              String((sheet.values[row - 1 + rowOffset] || [])[column - 1 + columnOffset] || '')
            )
          );
        },
        setValue(value) {
          while (sheet.values.length < row) sheet.values.push([]);
          while (sheet.values[row - 1].length < column) sheet.values[row - 1].push('');
          sheet.values[row - 1][column - 1] = value;
          return this;
        },
        getDataValidations() {
          return Array.from({ length: rowCount }, (_, rowOffset) => {
            return Array.from({ length: columnCount }, (_, columnOffset) => {
              return (sheet.validations[row - 1 + rowOffset] || [])[column - 1 + columnOffset] || null;
            });
          });
        },
        setDataValidation(rule) {
          for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
            const targetRow = row - 1 + rowOffset;
            while (sheet.validations.length <= targetRow) sheet.validations.push([]);
            for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
              sheet.validations[targetRow][column - 1 + columnOffset] = rule;
            }
          }
          return this;
        }
      };
    },
    insertColumnAfter(column) {
      this.values.forEach((row) => row.splice(column, 0, ''));
      this.validations.forEach((row) => row.splice(column, 0, row[column - 1] || null));
    }
  };
}

let activeSheet;
const schemaContext = vm.createContext({
  console,
  MASTER_PROSPECT_SHEET: 'Master Prospect Tracker',
  AUDIT_SOURCE_VALUES: ['Website Audit Tool', 'Quick Internal Audit'],
  getHealthHeaderTable_(sheet) {
    const headers = {};
    sheet.values[0].forEach((header, index) => {
      if (header && !headers[header]) headers[header] = index + 1;
    });
    return { headerRow: 1, headers, lastColumn: sheet.getLastColumn() };
  },
  SpreadsheetApp: {
    DataValidationCriteria: { VALUE_IN_LIST },
    newDataValidation() {
      const state = { values: [], allowInvalid: true };
      return {
        requireValueInList(values) { state.values = values.slice(); return this; },
        setAllowInvalid(value) { state.allowInvalid = value; return this; },
        build() { return createValidationRule(state.values, state.allowInvalid); }
      };
    },
    getActiveSpreadsheet() {
      return { getSheetByName: () => activeSheet };
    }
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'SheetHelpers.gs'), 'utf8'), schemaContext, { filename: 'SheetHelpers.gs' });

activeSheet = createSheet(
  ['Company', 'Audit Score', 'Audit Outcome', 'Priority Tier', 'Status'],
  [['Legacy Co', 75, 'Good Fit', 'B - Good', 'Lead Found']],
  { 'Priority Tier': createValidationRule(['A - Hot', 'B - Good', 'C - Later', 'D - Nurture'], false) }
);
let repair = schemaContext.ensureMasterProspectAuditSourceColumn_();
assert.strictEqual(repair.changed, true, 'missing Audit Source header is repaired');
assert.strictEqual(repair.validationRepaired, true, 'inherited validation is repaired during insertion');
assert.deepStrictEqual(activeSheet.values[0], ['Company', 'Audit Score', 'Audit Outcome', 'Priority Tier', 'Audit Source', 'Status'], 'Audit Source is inserted after Priority Tier');
assert.deepStrictEqual(activeSheet.values[1], ['Legacy Co', 75, 'Good Fit', 'B - Good', '', 'Lead Found'], 'legacy Audit Source remains blank and existing row data shifts intact');
let auditSourceRule = activeSheet.validations[1][4];
assert.deepStrictEqual(auditSourceRule.getCriteriaValues()[0], ['Website Audit Tool', 'Quick Internal Audit'], 'inserted Audit Source receives its own approved validation');
assert.strictEqual(auditSourceRule.getCriteriaValues()[0].includes('D - Nurture'), false, 'inherited Priority Tier validation is removed');
repair = schemaContext.ensureMasterProspectAuditSourceColumn_();
assert.strictEqual(repair.changed, false, 'repeated Audit Source repair is idempotent');
assert.strictEqual(repair.validationRepaired, false, 'approved validation is not replaced on repeated repair');
assert.strictEqual(activeSheet.values[0].filter((header) => header === 'Audit Source').length, 1, 'repeated repair does not create a duplicate');

activeSheet = createSheet(
  ['Company', 'Audit Source', 'Audit Score', 'Priority Tier'],
  [['Existing Co', 'Authoritative Import', 91, 'A - Hot']],
  { 'Audit Source': createValidationRule(['A - Hot', 'B - Good', 'C - Later', 'D - Nurture'], false) }
);
repair = schemaContext.ensureMasterProspectAuditSourceColumn_();
assert.strictEqual(repair.changed, false, 'existing Audit Source is preserved in place');
assert.strictEqual(repair.validationRepaired, true, 'existing incorrect Audit Source validation is repaired');
assert.deepStrictEqual(activeSheet.values[0], ['Company', 'Audit Source', 'Audit Score', 'Priority Tier']);
assert.strictEqual(activeSheet.values[1][1], 'Authoritative Import', 'existing Audit Source cell is preserved exactly');
auditSourceRule = activeSheet.validations[1][1];
assert.deepStrictEqual(auditSourceRule.getCriteriaValues()[0], ['Website Audit Tool', 'Quick Internal Audit'], 'existing Audit Source receives approved validation');
repair = schemaContext.ensureMasterProspectAuditSourceColumn_();
assert.strictEqual(repair.validationRepaired, false, 'existing repaired validation remains idempotent');
assert.strictEqual(activeSheet.values[1][1], 'Authoritative Import', 'repeated validation repair never infers or replaces provenance');

activeSheet = createSheet(['Company', 'Audit Score'], [['Fallback Co', 68]]);
repair = schemaContext.ensureMasterProspectAuditSourceColumn_();
assert.strictEqual(repair.appended, true, 'Audit Source uses append fallback when Priority Tier is absent');
assert.deepStrictEqual(activeSheet.values[0], ['Company', 'Audit Score', 'Audit Source']);
assert.deepStrictEqual(activeSheet.values[1], ['Fallback Co', 68], 'fallback append does not populate legacy provenance');

const demoHeaders = Array.from(schemaContext.getDemoProspectHeaders_());
assert.strictEqual(demoHeaders[demoHeaders.indexOf('Priority Tier') + 1], 'Audit Source', 'canonical demo schema places Audit Source after Priority Tier');
const healthSource = fs.readFileSync(path.join(root, 'HealthCheck.gs'), 'utf8');
assert.match(healthSource, /'Priority Tier',\s*'Audit Source',\s*'Last Activity'/, 'Health Check requires Audit Source');
const auditEngineSource = fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8');
const gmailEngineSource = fs.readFileSync(path.join(root, 'GmailEngine.gs'), 'utf8');
assert.match(auditEngineSource, /'Outreach Draft File Created'/, 'assessment generation uses Drive-file activity wording');
assert.match(auditEngineSource, /'Outreach Gmail Draft Created'/, 'full package retains Gmail-specific success wording');
assert.match(gmailEngineSource, /`Outreach Gmail Draft \$\{action\}`/, 'explicit outreach workflow distinguishes created and updated Gmail activity');
assert.match(gmailEngineSource, /'Digital Business Assessment Gmail Draft Created'/, 'assessment send workflow retains Gmail-specific success wording');
assert.match(gmailEngineSource, /'Digital Business Assessment Gmail Draft Updated'/, 'assessment retry uses updated Gmail-specific wording');
assert.ok(
  gmailEngineSource.indexOf('const gmailDraftResult = createOrReconcileAssessmentGmailDraft_') < gmailEngineSource.indexOf('logPipelineActivity_('),
  'assessment Gmail success activity occurs only after draft reconciliation returns successfully'
);
assert.ok(
  gmailEngineSource.indexOf('gmailDraftResult = reconcileExactGmailDraft_') < gmailEngineSource.indexOf('logOutreachGmailDraftReconciled_'),
  'outreach Gmail success activity occurs only after draft reconciliation returns successfully'
);

console.log('Audit acquisition and local rendering deterministic tests passed.');
