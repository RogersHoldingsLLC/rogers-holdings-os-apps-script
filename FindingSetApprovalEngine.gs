/** Transactional approval boundary for one reviewed Finding Set. */
var FQ_FINDING_SET_APPROVAL_CONFIRMATION = 'APPROVE FINDING SET';

function approveSelectedFindingSetForClient() {
  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.prompt(
    'Approve Selected Finding Set for Client',
    'Type ' + FQ_FINDING_SET_APPROVAL_CONFIRMATION + ' exactly. This freezes one immutable client authority snapshot.',
    ui.ButtonSet.OK_CANCEL
  );
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== FQ_FINDING_SET_APPROVAL_CONFIRMATION) throw new Error('Finding Set approval cancelled.');
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const selected = getSelectedFindingQualityActionRow_('approveFindingSet');
    const reviewer = requireHumanReviewer_();
    const setRecord = selected.record;
    if (String(setRecord['Approval Status'] || '') === FQ_APPROVED_STATUS) return reconcileCompletedFindingSetApproval_(selected, setRecord);
    assertFindingSetTransition_(String(setRecord['Review Status'] || 'Draft'), FQ_APPROVED_STATUS);
    const bundle = loadFindingQualityApprovalBundle_(selected.ss, setRecord);
    const authority = validateFindingSetSuccessorApprovalAuthority_(selected.ss, setRecord, bundle);
    assertPlainLanguageFindingSetForApproval_(bundle);
    const transaction = stageFindingSetApproval_(selected, bundle, authority, reviewer);
    return commitFindingSetApproval_(transaction);
  } finally {
    lock.releaseLock();
  }
}

function validateFindingSetSuccessorApprovalAuthority_(ss, setRecord, bundle) {
  if (String(setRecord['Review Status']) !== 'In Review' || String(setRecord['Approval Status']) !== 'In Review' || String(setRecord['Document Eligibility']) !== 'Not Eligible') throw new Error('Finding Set approval requires In Review / In Review / Not Eligible authority.');
  if (String(setRecord['Immutable Hash'] || '') || String(setRecord['Snapshot File ID'] || '') || String(setRecord['Approved At'] || '')) throw new Error('Finding Set already has immutable approval authority.');
  assertFindingSetRecommendationSeedAuthority_(ss, setRecord);
  const findingIds = parseFindingQualityList_(setRecord['Finding IDs']);
  if (bundle.findings.length !== findingIds.length) throw new Error('Active Finding membership changed during approval preflight.');
  const findingSheet = ss.getSheetByName(FQ_FINDINGS_SHEET);
  const recommendationSheet = ss.getSheetByName(FQ_RECOMMENDATIONS_SHEET);
  const actionSheet = ss.getSheetByName(FQ_ACTIONS_SHEET);
  const findings = readFindingQualityRecords_(findingSheet, ensureExactFindingQualityTable_(findingSheet, FQ_FINDING_COLUMNS));
  const recommendations = readFindingQualityRecords_(recommendationSheet, ensureExactFindingQualityTable_(recommendationSheet, FQ_RECOMMENDATION_COLUMNS));
  const actions = readFindingQualityRecords_(actionSheet, ensureExactFindingQualityTable_(actionSheet, FQ_ACTION_COLUMNS)).filter(function(record) {
    return String(record['Prospect ID']) === String(setRecord['Prospect ID']) && String(record['Finding Set ID']) === String(setRecord['Finding Set ID']) && String(record['Finding Set Version']) === String(setRecord.Version);
  });
  const activeRecommendations = [];
  bundle.findings.forEach(function(finding) {
    if (String(finding['Finding State']) === 'Superseded Pre-Snapshot') throw new Error('A superseded Finding cannot be active Finding Set authority.');
    const errors = validateAssessmentFindingRecord_(finding, { approvalRequired: true });
    if (errors.length) throw new Error('Active Finding is incomplete: ' + errors.join('; '));
    const matches = recommendations.filter(function(record) { return String(record['Recommendation ID']) === String(finding['Recommendation ID']); });
    if (matches.length !== 1 || String(matches[0]['Review Status']) !== 'Reviewed') throw new Error('Active Finding requires one Reviewed successor Recommendation.');
    const recommendation = matches[0];
    ['Prospect ID','Finding Set ID','Finding Set Version','Finding ID'].forEach(function(field) {
      const expected = field === 'Finding ID' ? finding['Finding ID'] : field === 'Finding Set Version' ? setRecord.Version : setRecord[field];
      if (String(recommendation[field]) !== String(expected)) throw new Error('Active Recommendation authority mismatch: ' + field + '.');
    });
    const pairs = [['Recommended Action','Recommended Action'],['Implementation Location','Implementation Location'],['Intended Outcome','Intended Outcome']];
    pairs.forEach(function(pair) { if (canonicalFindingSetApprovalText_(recommendation[pair[0]]) !== canonicalFindingSetApprovalText_(finding[pair[1]])) throw new Error('Active Recommendation wording mismatch: ' + pair[0] + '.'); });
    validateFindingSetSupersessionLineage_(finding, recommendation, findings, recommendations, findingIds);
    activeRecommendations.push(recommendation);
  });
  return { recommendations: activeRecommendations, actions: actions };
}

function validateFindingSetSupersessionLineage_(finding, recommendation, findings, recommendations, activeIds) {
  const priorFindingId = String(finding['Supersedes Finding ID'] || '');
  const priorRecommendationId = String(recommendation['Supersedes Recommendation ID'] || '');
  if (!priorFindingId && !priorRecommendationId) return;
  if (!priorFindingId || !priorRecommendationId || activeIds.indexOf(priorFindingId) !== -1) throw new Error('Pre-snapshot supersession lineage is incomplete or active.');
  const priorFindings = findings.filter(function(record) { return String(record['Finding ID']) === priorFindingId; });
  const priorRecommendations = recommendations.filter(function(record) { return String(record['Recommendation ID']) === priorRecommendationId; });
  if (priorFindings.length !== 1 || priorRecommendations.length !== 1) throw new Error('Pre-snapshot historical authority is missing or ambiguous.');
  const priorFinding = priorFindings[0], priorRecommendation = priorRecommendations[0];
  if (String(priorFinding['Finding State']) !== 'Superseded Pre-Snapshot' || String(priorFinding['Approval Status']) !== FQ_APPROVED_STATUS || String(priorFinding['Superseded By Finding ID']) !== String(finding['Finding ID'])) throw new Error('Historical Finding supersession authority changed.');
  if (!String(priorFinding['Superseded By'] || '') || !String(priorFinding['Superseded At'] || '') || !String(priorFinding['Supersession Operation Key'] || '')) throw new Error('Historical Finding supersession audit is incomplete.');
  if (String(priorRecommendation['Review Status']) !== 'Reviewed' || String(priorRecommendation['Superseded By Recommendation ID']) !== String(recommendation['Recommendation ID'])) throw new Error('Historical Recommendation supersession authority changed.');
  if (String(priorRecommendation['Finding ID']) !== priorFindingId || String(recommendation['Finding ID']) !== String(finding['Finding ID'])) throw new Error('Recommendation supersession lineage is inconsistent.');
}

function canonicalFindingSetApprovalText_(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function stageFindingSetApproval_(selected, bundle, authority, reviewer) {
  const approvedAt = new Date();
  bundle.recommendations = authority.recommendations;
  const snapshot = buildApprovedFindingSetSnapshot_(bundle, reviewer, approvedAt);
  snapshot.payload.fingerprint = fingerprintFindingQualityText_(stableStringifyFindingQuality_(snapshot.payload));
  const serialized = stableStringifyFindingQuality_(snapshot.payload);
  return { selected: selected, bundle: bundle, authority: authority, reviewer: reviewer, payload: snapshot.payload, serialized: serialized, originalSet: Object.assign({}, selected.record) };
}

function commitFindingSetApproval_(transaction) {
  let persistence = null;
  try {
    persistence = persistFindingSetApprovalSnapshot_(transaction.bundle.company, transaction.payload, transaction.serialized);
    const setRecord = Object.assign({}, transaction.originalSet);
    setRecord['Review Status'] = FQ_APPROVED_STATUS;
    setRecord['Approval Status'] = FQ_APPROVED_STATUS;
    setRecord['Reviewed By'] = transaction.reviewer;
    setRecord['Reviewed At'] = transaction.payload.approvedAt;
    setRecord['Approved At'] = transaction.payload.approvedAt;
    setRecord['Document Eligibility'] = 'Eligible';
    setRecord['Immutable Hash'] = transaction.payload.fingerprint;
    setRecord['Snapshot File ID'] = persistence.file.getId();
    setRecord['Evidence References'] = transaction.payload.evidence.map(function(item) { return item.evidenceId; }).join(', ');
    setRecord['Finding IDs'] = transaction.payload.findings.map(function(item) { return item.findingId; }).join(', ');
    writeFindingQualityRecord_(transaction.selected.sheet, transaction.selected.table, transaction.selected.row, setRecord);
    const actual = readFindingQualityRecord_(transaction.selected.sheet, transaction.selected.table, transaction.selected.row);
    assertFindingSetApprovalReadback_(actual, setRecord);
    protectApprovedFindingQualityRows_(transaction.bundle, transaction.selected);
    SpreadsheetApp.getUi().alert('Finding Set Approved', 'Approved version ' + setRecord.Version + ' is frozen. Fingerprint: ' + transaction.payload.fingerprint, SpreadsheetApp.getUi().ButtonSet.OK);
    return { findingSetId: setRecord['Finding Set ID'], version: String(setRecord.Version), fingerprint: transaction.payload.fingerprint, approvalStatus: FQ_APPROVED_STATUS };
  } catch (error) {
    try { writeFindingQualityRecord_(transaction.selected.sheet, transaction.selected.table, transaction.selected.row, transaction.originalSet); } catch (rollbackError) { error.message += ' Set rollback failed: ' + rollbackError.message; }
    if (persistence && persistence.created) try { persistence.file.setTrashed(true); } catch (fileError) { error.message += ' Snapshot rollback requires reconciliation: ' + fileError.message; }
    throw error;
  }
}

function persistFindingSetApprovalSnapshot_(company, payload, serialized) {
  const folder = getOrCreateAuditPackageFolder_(company);
  const snapshots = getExactChildFolderOrThrow_(folder, 'Finding Quality Snapshots') || folder.createFolder('Finding Quality Snapshots');
  const name = 'Finding Set ' + sanitizeDriveFileName_(payload.findingSetId) + ' v' + sanitizeDriveFileName_(payload.version) + '.json';
  const existing = snapshots.getFilesByName(name);
  if (existing.hasNext()) {
    const file = existing.next();
    if (existing.hasNext()) throw new Error('Multiple immutable snapshots exist for this finding-set version. Reconciliation is required.');
    if (file.getBlob().getDataAsString() !== serialized) throw new Error('A different immutable snapshot already exists for this finding-set version. Reconciliation is required.');
    return { file: file, created: false };
  }
  return { file: snapshots.createFile(Utilities.newBlob(serialized, 'application/json', name)), created: true };
}

function assertFindingSetApprovalReadback_(actual, expected) {
  ['Finding Set ID','Prospect ID','Version','Review Status','Approval Status','Reviewed By','Reviewed At','Approved At','Document Eligibility','Immutable Hash','Snapshot File ID','Evidence References','Finding IDs'].forEach(function(field) {
    if (findingQualityDateText_(actual[field]) !== findingQualityDateText_(expected[field])) throw new Error('Finding Set approval readback mismatch: ' + field + '.');
  });
}

function reconcileCompletedFindingSetApproval_(selected, setRecord) {
  if (String(setRecord['Review Status']) !== FQ_APPROVED_STATUS || String(setRecord['Document Eligibility']) !== 'Eligible' || !String(setRecord['Immutable Hash'] || '') || !String(setRecord['Snapshot File ID'] || '')) throw new Error('Finding Set approval is partially committed and requires reconciliation.');
  const file = DriveApp.getFileById(String(setRecord['Snapshot File ID']));
  const serialized = file.getBlob().getDataAsString();
  const payload = JSON.parse(serialized);
  const projection = Object.assign({}, payload);
  const assertedFingerprint = String(projection.fingerprint || '');
  delete projection.fingerprint;
  if (assertedFingerprint !== String(setRecord['Immutable Hash']) || fingerprintFindingQualityText_(stableStringifyFindingQuality_(projection)) !== assertedFingerprint) throw new Error('Completed Finding Set approval snapshot is invalid.');
  return { findingSetId: String(setRecord['Finding Set ID']), version: String(setRecord.Version), fingerprint: String(setRecord['Immutable Hash']), approvalStatus: FQ_APPROVED_STATUS, alreadyCompleted: true };
}
