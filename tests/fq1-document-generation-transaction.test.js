const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'DocumentGenerationEngine.gs'), 'utf8');
const auditSource = fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8');
const pdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');
const previewSource = fs.readFileSync(path.join(root, 'DeliverablePreviewEngine.gs'), 'utf8');

function load(overrides = {}) {
  const context = {
    console: { error() {}, warn() {} },
    LockService: { getDocumentLock() { return { waitLock() {}, releaseLock() {} }; } },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest() { return [1, 2, 3]; },
      getUuid() { return 'uuid'; }
    },
    assertApprovedFindingSetReference_(value) { return value; },
    stableStringifyFindingQuality_: JSON.stringify,
    setIfHeader_(row, headers, header, value) { if (headers[header]) row[headers[header] - 1] = value; },
    literalizeBusinessSnapshotSheetRow_(row) { return row; }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  Object.assign(context, overrides);
  return context;
}

function reference(version = '1', fingerprint = 'abc') {
  return { findingSetId: 'FSET-1', version, fingerprint, approvalStatus: 'Approved for Client' };
}

test('all final callbacks delegate to the transactional coordinator and never return Drive objects', () => {
  for (const [body, name] of [[auditSource, 'generateExecutiveBriefPdfFromPreview'], [auditSource, 'generateDigitalBusinessAssessmentPdfFromPreview'], [pdfSource, 'generateImprovementPlanPdfFromPreview']]) {
    const start = body.indexOf(`function ${name}`);
    assert.notEqual(start, -1);
    const slice = body.slice(start, body.indexOf('\n}', start) + 2);
    assert.match(slice, /executeGoldStandardDocumentGeneration_/);
    assert.doesNotMatch(slice, /upsertAuditPackageBlobFile_|logPipelineActivity_|refreshSalesOperatingSystem_|return\s*\{\s*folder|file:\s*file/);
  }
  assert.match(previewSource, /result\.warning/);
  assert.doesNotMatch(previewSource, /Please try again/);
  assert.match(source, /function executeGoldStandardDocumentGeneration_[\s\S]*getDocumentLock\(\)[\s\S]*executeGoldStandardDocumentGenerationLocked_[\s\S]*releaseLock\(\)/);
});

test('the live Executive Brief callback uses the exact immutable operation identity and only its approved operational fields', () => {
  const callbackStart = auditSource.indexOf('function generateExecutiveBriefPdfFromPreview');
  const callbackEnd = auditSource.indexOf('\n}', callbackStart) + 2;
  const callback = auditSource.slice(callbackStart, callbackEnd);
  assert.match(callback, /executeGoldStandardDocumentGeneration_\(context, prospect, 'executiveBrief', approvedFindingSetReference/);
  assert.match(callback, /'Next Action': 'Create Outreach Draft'/);
  assert.doesNotMatch(callback, /Audit Package Generated|Audit Package Date|Gmail|Proposal|Assessment Action|createOutreach/);
  const context = load();
  const key = context.buildGoldStandardGenerationOperationKey_({ prospectId: 'PROS-AF21065CD5C8' }, {
    documentType: 'executiveBrief',
    approvedFindingSetReference: {
      findingSetId: 'FSET-a2ae86fa62d97824', version: '1',
      fingerprint: '70a20a6d7ef2427430699251188a8358a31bbcfda8b02f2e15a1431f9a7c0629',
      approvalStatus: 'Approved for Client'
    }
  });
  assert.equal(key, 'GOLDDOC:PROS-AF21065CD5C8:EXECUTIVEBRIEF:FSET-a2ae86fa62d97824:1:70a20a6d7ef2427430699251188a8358a31bbcfda8b02f2e15a1431f9a7c0629');
});

test('the Assessment uses its canonical DIGITALBUSINESSASSESSMENT operation identity', () => {
  const context = load();
  const key = context.buildGoldStandardGenerationOperationKey_({ prospectId: 'PROS-AF21065CD5C8' }, {
    documentType: 'assessment',
    approvedFindingSetReference: {
      findingSetId: 'FSET-a2ae86fa62d97824', version: '1',
      fingerprint: '70a20a6d7ef2427430699251188a8358a31bbcfda8b02f2e15a1431f9a7c0629',
      approvalStatus: 'Approved for Client'
    }
  });
  assert.equal(key, 'GOLDDOC:PROS-AF21065CD5C8:DIGITALBUSINESSASSESSMENT:FSET-a2ae86fa62d97824:1:70a20a6d7ef2427430699251188a8358a31bbcfda8b02f2e15a1431f9a7c0629');
});

test('snapshot, Drive, rendering, and persistence failures stop before operational commit', () => {
  const stages = [
    ['snapshot', { buildPlan: true }],
    ['drive', { drive: true }],
    ['rendering', { artifact: 'rendering' }],
    ['persistence', { artifact: 'persistence' }]
  ];
  stages.forEach(([expected, failure]) => {
    const calls = [];
    const context = load({
      buildGoldStandardDocumentPlan_() {
        calls.push('plan');
        if (failure.buildPlan) throw new Error('injected');
        return { documentType: 'executiveBrief', fileName: 'Executive Brief.pdf', approvedFindingSetReference: reference() };
      },
      getOrCreateAuditPackageFolder_() { calls.push('drive'); if (failure.drive) throw new Error('injected'); return { getId() { return 'folder'; } }; },
      stageAndCommitGoldStandardArtifact_() {
        calls.push('artifact');
        if (failure.artifact) throw context.goldStandardGenerationError_(failure.artifact, 'injected');
        return { file: { getId() { return 'file'; } }, artifactHash: 'hash', artifactChanged: true };
      },
      commitGoldStandardOperationalState_() { calls.push('operations'); return { idempotent: false }; },
      refreshSalesOperatingSystem_() { calls.push('dashboard'); }
    });
    assert.throws(() => context.executeGoldStandardDocumentGeneration_({ ss: {} }, { prospectId: 'P1', company: 'Fixture' }, 'executiveBrief', reference(), {}), error => {
      assert.equal(error.goldStandardStage, expected);
      return true;
    });
    assert.equal(calls.includes('operations'), false);
    assert.equal(calls.includes('dashboard'), false);
  });
});

test('replacement failure restores the prior canonical artifact and removes the staged file', () => {
  function fakeBlob() { return { setName() { return this; }, getBytes() { return [1, 2, 3]; } }; }
  function fakeFile(name, options = {}) {
    return {
      name, trashed: false,
      getName() { return this.name; },
      setName(value) { this.name = value; return this; },
      getSize() { return 3; },
      getBlob() { return fakeBlob(); },
      getDescription() { return ''; },
      setDescription() { if (options.failDescription) throw new Error('injected replacement failure'); return this; },
      setTrashed(value) { this.trashed = value; return this; },
      isTrashed() { return this.trashed; }
    };
  }
  const prior = fakeFile('Executive Brief.pdf');
  const staged = fakeFile('', { failDescription: true });
  const context = load({
    buildGoldStandardPdfBlobFromPlan_() { return fakeBlob(); },
    findAllAuditPackageFilesByName_(folder, name) {
      if (name === 'Executive Brief.pdf' && prior.name === name && !prior.trashed) return [prior];
      return [];
    }
  });
  const folder = { createFile() { return staged; } };
  assert.throws(() => context.stageAndCommitGoldStandardArtifact_(folder, { fileName: 'Executive Brief.pdf' }, 'OP1'), error => error.goldStandardStage === 'persistence');
  assert.equal(prior.name, 'Executive Brief.pdf');
  assert.equal(prior.trashed, false);
  assert.equal(staged.trashed, true);
  assert.notEqual(staged.name, 'Executive Brief.pdf');
});

test('Activity failure restores Prospect row and removes a partial operation Activity', () => {
  let row = ['Before Action', 'Before Activity'];
  let operationRows = [];
  const range = {
    getValues() { return [row.slice()]; },
    setValues(values) { row = values[0].slice(); return this; }
  };
  const context = load({
    findGoldStandardGenerationActivity_() { return { sheet: {}, table: {}, rows: operationRows.slice() }; },
    appendGoldStandardGenerationActivity_() { operationRows = [9]; throw new Error('injected Activity persistence failure'); },
    deleteGoldStandardOperationActivity_() { operationRows = []; },
    restoreGoldStandardProspectRow_(ctx, before) { row = before.slice(); }
  });
  const selected = { ss: {}, selectedRow: 2, table: { lastColumn: 2, headers: { 'Next Action': 1, 'Last Activity': 2 } }, sheet: { getRange() { return range; } } };
  assert.throws(() => context.commitGoldStandardOperationalState_(selected, { prospectId: 'P1', company: 'Fixture' }, { documentType: 'executiveBrief', fileName: 'Executive Brief.pdf', approvedFindingSetReference: reference() }, 'OP1', { 'Next Action': 'After' }), /document generation record could not be verified/i);
  assert.deepEqual(row, ['Before Action', 'Before Activity']);
  assert.deepEqual(operationRows, []);
});

test('Prospect persistence failure restores original fields without Activity', () => {
  let row = ['Before Action', 'Before Activity'];
  let writes = 0;
  const range = {
    getValues() { return [row.slice()]; },
    setValues(values) { row = values[0].slice(); writes += 1; if (writes === 1) throw new Error('injected Prospect write failure'); return this; }
  };
  const context = load({
    findGoldStandardGenerationActivity_() { return { sheet: {}, table: {}, rows: [] }; },
    appendGoldStandardGenerationActivity_() { throw new Error('must not append'); },
    restoreGoldStandardProspectRow_(ctx, before) { row = before.slice(); }
  });
  const selected = { ss: {}, selectedRow: 2, table: { lastColumn: 2, headers: { 'Next Action': 1, 'Last Activity': 2 } }, sheet: { getRange() { return range; } } };
  assert.throws(() => context.commitGoldStandardOperationalState_(selected, { prospectId: 'P1', company: 'Fixture' }, { documentType: 'executiveBrief', fileName: 'Executive Brief.pdf', approvedFindingSetReference: reference() }, 'OP1', { 'Next Action': 'After' }));
  assert.deepEqual(row, ['Before Action', 'Before Activity']);
});

test('operational failure removes the operation-created PDF and restores the prior canonical PDF', () => {
  function fakeBlob(bytes = [1, 2, 3]) { return { bytes, setName() { return this; }, getBytes() { return this.bytes; } }; }
  let nextId = 1;
  function fakeFile(name, bytes) {
    return {
      id: `FILE-${nextId++}`, name, bytes, trashed: false, description: '',
      getId() { return this.id; }, getName() { return this.name; }, setName(value) { this.name = value; return this; },
      getSize() { return this.bytes.length; }, getBlob() { return fakeBlob(this.bytes); },
      getDescription() { return this.description; }, setDescription(value) { this.description = value; return this; },
      setTrashed(value) { this.trashed = value; return this; }, isTrashed() { return this.trashed; }
    };
  }
  const prior = fakeFile('Executive Brief.pdf', [9, 9, 9]);
  const files = [prior];
  const folder = {
    createFile(blob) { const file = fakeFile(blob.name || '', blob.getBytes()); files.push(file); return file; },
    getId() { return 'FOLDER-1'; }
  };
  const context = load({
    buildGoldStandardDocumentPlan_(type, prospect, report, options) { return { documentType: type, fileName: 'Executive Brief.pdf', approvedFindingSetReference: options.approvedFindingSetReference }; },
    buildGoldStandardPdfBlobFromPlan_() { const blob = fakeBlob([1, 2, 3]); blob.setName = function(name) { this.name = name; return this; }; return blob; },
    findAllAuditPackageFilesByName_(ignored, name) { return files.filter(file => !file.trashed && file.name === name); },
    getOrCreateAuditPackageFolder_() { return folder; },
    commitGoldStandardOperationalState_() { throw context.goldStandardGenerationError_('operations', 'injected operational failure'); },
    refreshExecutiveDashboard() { throw new Error('must not refresh'); }
  });
  assert.throws(() => context.executeGoldStandardDocumentGeneration_({ ss: {} }, { prospectId: 'P1', company: 'Fixture' }, 'executiveBrief', reference(), { 'Next Action': 'After' }), error => error.goldStandardStage === 'operations');
  assert.equal(files.filter(file => !file.trashed && file.name === 'Executive Brief.pdf').length, 1);
  assert.equal(files.filter(file => !file.trashed && file.name === 'Executive Brief.pdf')[0].id, prior.id);
  assert.equal(prior.trashed, false);
  assert.equal(files.filter(file => file.id !== prior.id && !file.trashed).length, 0);
});

test('success commits once, immediate retry is idempotent, and a new approved version gets a distinct operation', () => {
  const operations = new Set();
  const artifactKeys = new Set();
  const context = load({
    buildGoldStandardDocumentPlan_(type, prospect, report, options) { return { documentType: type, fileName: 'Executive Brief.pdf', approvedFindingSetReference: options.approvedFindingSetReference }; },
    getOrCreateAuditPackageFolder_() { return { getId() { return 'folder'; } }; },
    stageAndCommitGoldStandardArtifact_(folder, plan, key) {
      const changed = !artifactKeys.has(key); artifactKeys.add(key);
      return { file: { getId() { return 'file'; } }, artifactHash: 'hash', artifactChanged: changed };
    },
    commitGoldStandardOperationalState_(selected, prospect, plan, key) {
      const idempotent = operations.has(key); operations.add(key); return { idempotent };
    },
    refreshSalesOperatingSystem_() {}
  });
  const selected = { ss: {} };
  const prospect = { prospectId: 'P1', company: 'Fixture' };
  const first = context.executeGoldStandardDocumentGeneration_(selected, prospect, 'executiveBrief', reference('1', 'abc'), {});
  const retry = context.executeGoldStandardDocumentGeneration_(selected, prospect, 'executiveBrief', reference('1', 'abc'), {});
  const successor = context.executeGoldStandardDocumentGeneration_(selected, prospect, 'executiveBrief', reference('2', 'def'), {});
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(successor.idempotent, false);
  assert.notEqual(first.operationKey, successor.operationKey);
  assert.deepEqual(Object.keys(first).sort(), ['approvedFindingSetFingerprint','approvedFindingSetId','approvedFindingSetVersion','artifactHash','documentType','fileId','fileName','folderId','idempotent','ok','operationKey','warning'].sort());
});

test('completed generation returns a fresh google.script.run-safe receipt instead of the frozen plan authority object', () => {
  const context = load();
  const frozenReference = Object.freeze(reference('1', 'abc'));
  const result = context.buildGoldStandardGenerationClientResult_(
    'executiveBrief',
    { fileName: 'Executive Brief.pdf', approvedFindingSetReference: frozenReference },
    { file: { getId() { return 'FILE-1'; } }, artifactHash: 'pdf-hash', artifactChanged: true },
    { getId() { return 'FOLDER-1'; } },
    'GOLDDOC:P1:EXECUTIVEBRIEF:FSET-1:1:abc',
    { idempotent: false },
    ''
  );
  const transported = JSON.parse(JSON.stringify(result));
  assert.equal(transported.ok, true);
  assert.equal(transported.fileId, 'FILE-1');
  assert.equal(transported.approvedFindingSetId, 'FSET-1');
  assert.equal(transported.approvedFindingSetVersion, '1');
  assert.equal(transported.approvedFindingSetFingerprint, 'abc');
  assert.equal(Object.prototype.hasOwnProperty.call(transported, 'approvedFindingSetReference'), false);
  assert.notEqual(result, frozenReference);
});

test('public PDF callbacks return one primitive JSON transport receipt and preview validates it', () => {
  for (const [body, name] of [[auditSource, 'generateExecutiveBriefPdfFromPreview'], [auditSource, 'generateDigitalBusinessAssessmentPdfFromPreview'], [pdfSource, 'generateImprovementPlanPdfFromPreview']]) {
    const start = body.indexOf(`function ${name}`);
    const slice = body.slice(start, body.indexOf('\n}', start) + 2);
    assert.match(slice, /serializeGoldStandardGenerationClientResult_\(executeGoldStandardDocumentGeneration_/);
  }
  assert.match(previewSource, /function parsePreviewServerReceipt_/);
  assert.match(previewSource, /typeof value!=="string"/);
  assert.match(previewSource, /result\.ok!==true\|\|!result\.operationKey/);

  const context = load();
  const serialized = context.serializeGoldStandardGenerationClientResult_({
    ok: true,
    documentType: 'assessment',
    fileName: 'Digital Business Assessment.pdf',
    fileId: 'FILE-1',
    folderId: 'FOLDER-1',
    operationKey: 'GOLDDOC:P1:DIGITALBUSINESSASSESSMENT:FSET-1:1:abc',
    artifactHash: 'pdf-hash',
    idempotent: false,
    warning: '',
    approvedFindingSetId: 'FSET-1',
    approvedFindingSetVersion: '1',
    approvedFindingSetFingerprint: 'abc'
  });
  assert.equal(typeof serialized, 'string');
  assert.deepEqual(JSON.parse(serialized), {
    ok: true,
    documentType: 'assessment',
    fileName: 'Digital Business Assessment.pdf',
    fileId: 'FILE-1',
    folderId: 'FOLDER-1',
    operationKey: 'GOLDDOC:P1:DIGITALBUSINESSASSESSMENT:FSET-1:1:abc',
    artifactHash: 'pdf-hash',
    idempotent: false,
    warning: '',
    approvedFindingSetId: 'FSET-1',
    approvedFindingSetVersion: '1',
    approvedFindingSetFingerprint: 'abc'
  });
});

test('completed retry verifies the exact Activity and Prospect state before reporting idempotent success', () => {
  const activityDate = new Date('2026-08-18T14:05:16.000Z');
  const activityRow = [activityDate, 'Fixture', 'Digital Business Assessment Generated', 'Generated Digital Business Assessment.pdf from approved Finding Quality snapshot FSET-1 v1.', 'P1', 'OP1'];
  const prospectRow = ['Yes', activityDate, 'Present Digital Business Assessment', activityDate];
  const activity = {
    rows: [8],
    table: { lastColumn: 6, headers: { Date: 1, Company: 2, 'Activity Type': 3, 'Activity Notes': 4, 'Prospect ID': 5, 'Operation Key': 6 } },
    sheet: { getRange() { return { getValues() { return [activityRow.slice()]; } }; } }
  };
  const selected = {
    selectedRow: 21,
    table: { lastColumn: 4, headers: { 'Audit Package Generated': 1, 'Audit Package Date': 2, 'Next Action': 3, 'Last Activity': 4 } },
    sheet: { getRange() { return { getValues() { return [prospectRow.slice()]; } }; } }
  };
  const context = load({ findGoldStandardGenerationActivity_() { return activity; } });
  const result = context.commitGoldStandardOperationalState_(selected, { prospectId: 'P1', company: 'Fixture' }, {
    documentType: 'assessment', fileName: 'Digital Business Assessment.pdf', approvedFindingSetReference: reference()
  }, 'OP1', { 'Audit Package Generated': 'Yes', 'Audit Package Date': new Date(), 'Next Action': 'Present Digital Business Assessment' });
  assert.equal(result.idempotent, true);
  assert.equal(prospectRow[1].getTime(), activityDate.getTime());
});

test('completed retry fails closed for a malformed Activity or partial Prospect state', () => {
  const activityDate = new Date('2026-08-18T14:05:16.000Z');
  const activityRow = [activityDate, 'Fixture', 'Digital Business Assessment Generated', 'wrong notes', 'P1', 'OP1'];
  const activity = {
    rows: [8],
    table: { lastColumn: 6, headers: { Date: 1, Company: 2, 'Activity Type': 3, 'Activity Notes': 4, 'Prospect ID': 5, 'Operation Key': 6 } },
    sheet: { getRange() { return { getValues() { return [activityRow.slice()]; } }; } }
  };
  const selected = {
    selectedRow: 21,
    table: { lastColumn: 4, headers: { 'Audit Package Generated': 1, 'Audit Package Date': 2, 'Next Action': 3, 'Last Activity': 4 } },
    sheet: { getRange() { return { getValues() { return [['', '', '', '']]; } }; } }
  };
  const context = load({ findGoldStandardGenerationActivity_() { return activity; } });
  assert.throws(() => context.commitGoldStandardOperationalState_(selected, { prospectId: 'P1', company: 'Fixture' }, {
    documentType: 'assessment', fileName: 'Digital Business Assessment.pdf', approvedFindingSetReference: reference()
  }, 'OP1', { 'Audit Package Generated': 'Yes', 'Audit Package Date': new Date(), 'Next Action': 'Present Digital Business Assessment' }), error => error.goldStandardStage === 'operations');
});

test('preview source remains mutation-free', () => {
  for (const fn of ['showExecutiveSnapshotPreview_', 'showDigitalBusinessAssessmentPreview_', 'showImprovementPlanPreview_']) {
    const start = previewSource.indexOf(`function ${fn}`);
    const next = previewSource.indexOf('\nfunction ', start + 10);
    const body = previewSource.slice(start, next === -1 ? undefined : next);
    assert.doesNotMatch(body, /DriveApp|createFile|setValue|setValues|appendRow|logPipelineActivity_|refreshSalesOperatingSystem_/);
  }
});
