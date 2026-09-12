var FQ_WITHDRAWN_STATUS = 'Withdrawn';
var FQ_WITHDRAWAL_CONFIRMATION = 'WITHDRAW ORPHAN DRAFT';
var FQ_WITHDRAWAL_REASON = 'Unreferenced Draft artifact copied during successor creation.';

function withdrawSelectedUnreferencedDraftFinding() {
  const selected = getSelectedFindingQualityActionRow_('withdrawDraftFinding');
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Withdraw Unreferenced Draft Finding', 'Type ' + FQ_WITHDRAWAL_CONFIRMATION + ' exactly. History is retained.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== FQ_WITHDRAWAL_CONFIRMATION) throw new Error('Draft finding withdrawal cancelled.');
  const result = withdrawUnreferencedDraftFinding_(selected, {});
  ui.alert('Draft Finding Withdrawal', result.status === 'already-completed' ? 'This Draft finding was already withdrawn. No records changed.' : 'The unreferenced Draft finding was withdrawn. History was retained.', ui.ButtonSet.OK);
  return result;
}

function withdrawUnreferencedDraftFinding_(selected, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return withdrawUnreferencedDraftFindingLocked_(selected, hooks || {}); }
  finally { lock.releaseLock(); }
}

function withdrawUnreferencedDraftFindingLocked_(selected, hooks) {
  const schema = getExistingFindingQualityDraftSuccessorSchema_(selected.ss);
  const findingEntry = schema[FQ_FINDINGS_SHEET];
  const findingId = String(selected.record['Finding ID'] || '').trim();
  const prospectId = String(selected.record['Prospect ID'] || '').trim();
  const setId = String(selected.record['Finding Set ID'] || '').trim();
  const version = String(selected.record['Finding Set Version'] || '').trim();
  const operationKey = ['FQWITHDRAW', prospectId, setId, version, findingId].join(':');
  const exactRows = findFindingQualityRowEntries_(findingEntry, 'Finding ID', findingId);
  if (exactRows.length !== 1 || exactRows[0].row !== selected.row) throw new Error('Selected Draft finding is missing or ambiguous.');
  const finding = exactRows[0].record;
  if (String(finding['Finding State']) === FQ_WITHDRAWN_STATUS && String(finding['Approval Status']) === FQ_WITHDRAWN_STATUS) {
    if (String(finding['Validation Codes'] || '').indexOf('FQ_WITHDRAWAL_OPERATION=' + operationKey) === -1) throw new Error('Withdrawn finding has a conflicting audit record.');
    assertNoActiveFindingQualityFindingReferences_(selected.ss, schema, finding, { allowWithdrawnChildren: true });
    return { ok: true, status: 'already-completed', operationKey: operationKey, findingId: findingId };
  }
  if (String(finding['Finding State']) !== 'Draft' || String(finding['Approval Status']) !== 'Not Reviewed' || String(finding['Reviewed By'] || '').trim() || String(finding['Reviewed At'] || '').trim() || String(finding['Approved Version'] || '').trim()) throw new Error('Only an unreviewed Draft finding can be withdrawn.');

  const references = assertNoActiveFindingQualityFindingReferences_(selected.ss, schema, finding, { allowWithdrawnChildren: false });
  const reviewer = requireHumanReviewer_();
  const withdrawnAt = new Date();
  const writes = [];
  function stage(entry, row, before, after) { writes.push({ entry: entry, row: row, before: before, after: after }); }

  references.actions.forEach(function(item) {
    const after = Object.assign({}, item.record, { 'Review Status': FQ_WITHDRAWN_STATUS, 'Operation Key': appendFindingQualityWithdrawalOperation_(item.record['Operation Key'], operationKey) });
    stage(schema[FQ_ACTIONS_SHEET], item.row, item.record, after);
  });
  references.recommendations.forEach(function(item) {
    const after = Object.assign({}, item.record, { 'Review Status': FQ_WITHDRAWN_STATUS, 'Operation Key': appendFindingQualityWithdrawalOperation_(item.record['Operation Key'], operationKey) });
    stage(schema[FQ_RECOMMENDATIONS_SHEET], item.row, item.record, after);
  });
  const auditCodes = [String(finding['Validation Codes'] || '').trim(), 'FQ_WITHDRAWN_UNREFERENCED_DRAFT', 'FQ_WITHDRAWAL_REASON=' + FQ_WITHDRAWAL_REASON, 'FQ_WITHDRAWAL_OPERATION=' + operationKey].filter(Boolean).join(', ');
  stage(findingEntry, selected.row, finding, Object.assign({}, finding, {
    'Finding State': FQ_WITHDRAWN_STATUS, 'Approval Status': FQ_WITHDRAWN_STATUS,
    'Reviewed By': reviewer, 'Reviewed At': withdrawnAt, 'Validation Codes': auditCodes
  }));

  const completed = [];
  const validationChanges = prepareFindingQualityWithdrawalValidations_(writes);
  try {
    writes.forEach(function(write, index) {
      writeFindingQualityRecord_(write.entry.sheet, write.entry.table, write.row, write.after);
      completed.push(write);
      if (hooks.afterWrite) hooks.afterWrite(index + 1, write.after);
    });
    const persisted = readFindingQualityRecord_(findingEntry.sheet, findingEntry.table, selected.row);
    if (String(persisted['Finding State']) !== FQ_WITHDRAWN_STATUS || String(persisted['Approval Status']) !== FQ_WITHDRAWN_STATUS || String(persisted['Validation Codes']).indexOf('FQ_WITHDRAWAL_OPERATION=' + operationKey) === -1) throw new Error('Draft finding withdrawal did not persist exactly.');
    return { ok: true, status: 'completed', operationKey: operationKey, findingId: findingId, withdrawnAt: findingQualityDateText_(withdrawnAt), withdrawnBy: reviewer, reason: FQ_WITHDRAWAL_REASON };
  } catch (error) {
    for (let index = completed.length - 1; index >= 0; index -= 1) writeFindingQualityRecord_(completed[index].entry.sheet, completed[index].entry.table, completed[index].row, completed[index].before);
    for (let index = validationChanges.length - 1; index >= 0; index -= 1) validationChanges[index].range.setDataValidation(validationChanges[index].before);
    throw error;
  }
}

function prepareFindingQualityWithdrawalValidations_(writes) {
  if (!SpreadsheetApp.newDataValidation) return [];
  const changes = [];
  writes.forEach(function(write) {
    const isFinding = write.entry.sheet.getName && write.entry.sheet.getName() === FQ_FINDINGS_SHEET;
    const specs = isFinding ? [['Finding State', FQ_FINDING_STATES], ['Approval Status', FQ_APPROVAL_STATES]] : [['Review Status', ['Draft', 'In Review', 'Needs Changes', 'Approved for Client', FQ_WITHDRAWN_STATUS]]];
    specs.forEach(function(spec) {
      const column = write.entry.table.headers[spec[0]];
      if (!column) return;
      const range = write.entry.sheet.getRange(write.row, column);
      changes.push({ range: range, before: range.getDataValidation() });
      range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(spec[1], true).setAllowInvalid(false).build());
    });
  });
  return changes;
}

function assertNoActiveFindingQualityFindingReferences_(ss, schema, finding, options) {
  const findingId = String(finding['Finding ID']);
  const prospectId = String(finding['Prospect ID']);
  const setId = String(finding['Finding Set ID']);
  const version = String(finding['Finding Set Version']);
  const findings = readFindingQualityRowEntries_(schema[FQ_FINDINGS_SHEET]);
  if (findings.filter(function(item) { return String(item.record['Finding ID']) === findingId; }).length !== 1) throw new Error('Finding identity is missing or ambiguous.');
  const sets = readFindingQualityRowEntries_(schema[FQ_FINDING_SETS_SHEET]);
  if (sets.some(function(item) { return parseFindingQualityList_(item.record['Finding IDs']).indexOf(findingId) !== -1; })) throw new Error('Referenced findings cannot be withdrawn: ' + findingId + '.');
  sets.forEach(function(item) {
    const snapshotId = String(item.record['Snapshot File ID'] || '').trim();
    if (!snapshotId) return;
    let payload;
    try { payload = JSON.parse(DriveApp.getFileById(snapshotId).getBlob().getDataAsString()); }
    catch (error) { throw new Error('Snapshot reference audit failed closed for ' + snapshotId + '.'); }
    if (findingQualityValueContainsExact_(payload, findingId)) throw new Error('Snapshot-referenced findings cannot be withdrawn: ' + findingId + '.');
  });

  const recommendations = readFindingQualityRowEntries_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(item) { return String(item.record['Finding ID']) === findingId; });
  if (recommendations.length > 1) throw new Error('Finding recommendation children are ambiguous.');
  recommendations.forEach(function(item) {
    if (String(item.record['Prospect ID']) !== prospectId || String(item.record['Finding Set ID']) !== setId || String(item.record['Finding Set Version']) !== version) throw new Error('Finding recommendation child lineage differs.');
    if (String(item.record['Review Status']) !== 'Draft' && !(options.allowWithdrawnChildren && String(item.record['Review Status']) === FQ_WITHDRAWN_STATUS)) throw new Error('Only exclusively owned Draft recommendation children can be withdrawn.');
    if (findings.some(function(other) { return String(other.record['Finding ID']) !== findingId && String(other.record['Recommendation ID']) === String(item.record['Recommendation ID']); })) throw new Error('Shared recommendation children cannot be withdrawn.');
  });
  const recommendationIds = recommendations.map(function(item) { return String(item.record['Recommendation ID']); });
  const actions = readFindingQualityRowEntries_(schema[FQ_ACTIONS_SHEET]).filter(function(item) { return recommendationIds.indexOf(String(item.record['Recommendation ID'])) !== -1; });
  actions.forEach(function(item) {
    if (String(item.record['Prospect ID']) !== prospectId || String(item.record['Finding Set ID']) !== setId || String(item.record['Finding Set Version']) !== version) throw new Error('Finding action child lineage differs.');
    if (String(item.record['Review Status']) !== 'Draft' && !(options.allowWithdrawnChildren && String(item.record['Review Status']) === FQ_WITHDRAWN_STATUS)) throw new Error('Only exclusively owned Draft action children can be withdrawn.');
  });
  const activity = ss.getSheetByName('Activity Feed');
  if (activity && activity.getLastRow() && findingQualityGridContainsExact_(activity.getDataRange().getDisplayValues(), findingId)) throw new Error('Activity-referenced findings cannot be withdrawn: ' + findingId + '.');
  return { recommendations: recommendations, actions: actions };
}

function readFindingQualityRowEntries_(entry) {
  const result = [];
  for (let row = 2; row <= entry.sheet.getLastRow(); row += 1) {
    const record = readFindingQualityRecord_(entry.sheet, entry.table, row);
    if (Object.keys(record).some(function(key) { return String(record[key] || '').trim(); })) result.push({ row: row, record: record });
  }
  return result;
}

function findFindingQualityRowEntries_(entry, header, value) { return readFindingQualityRowEntries_(entry).filter(function(item) { return String(item.record[header]) === String(value); }); }
function findingQualityGridContainsExact_(values, target) { return [].concat(values || []).some(function(row) { return [].concat(row || []).some(function(value) { return String(value) === String(target); }); }); }
function findingQualityValueContainsExact_(value, target) { if (value === null || value === undefined) return false; if (Array.isArray(value)) return value.some(function(item) { return findingQualityValueContainsExact_(item, target); }); if (typeof value === 'object') return Object.keys(value).some(function(key) { return findingQualityValueContainsExact_(value[key], target); }); return String(value) === String(target); }
function appendFindingQualityWithdrawalOperation_(existing, operationKey) { const value = String(existing || '').trim(); const marker = 'withdrawal=' + operationKey; return value ? value + ' | ' + marker : marker; }
