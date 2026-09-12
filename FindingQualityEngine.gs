/**
 * Finding Quality v1 data foundation.
 * Sheets are the operator workspace. Approved JSON snapshots are the sole
 * authority for client-document generation.
 */

var FQ_CONTEXT_SHEET = 'Assessment Business Context';
var FQ_PRESENCE_SHEET = 'Assessment Presence';
var FQ_EVIDENCE_SHEET = 'Assessment Evidence';
var FQ_FINDINGS_SHEET = 'Assessment Findings';
var FQ_RECOMMENDATIONS_SHEET = 'Assessment Recommendations';
var FQ_ACTIONS_SHEET = 'Assessment Actions';
var FQ_FINDING_SETS_SHEET = 'Assessment Finding Sets';
var FQ_APPROVED_STATUS = 'Approved for Client';

var FQ_CONTEXT_COLUMNS = [
  'Context ID', 'Prospect ID', 'Version', 'Primary Service', 'Target Customer',
  'Service Area', 'Desired Customer Action', 'Primary Business Objective',
  'Relevant Conversion Destination', 'Known Constraints', 'Industry Context',
  'Source', 'Review Status', 'Reviewed By', 'Reviewed At', 'Fingerprint'
];

var FQ_PRESENCE_COLUMNS = [
  'Presence Record ID', 'Prospect ID', 'Inventory ID', 'Inventory Version',
  'Channel Type', 'Channel Name', 'Presence State', 'Verified URL or Identifier',
  'Ownership Confidence', 'Evidence Source', 'Evidence Location', 'Captured At',
  'Applicability', 'Role in Customer Journey', 'Limitations', 'Notes',
  'Review Status', 'Reviewed By', 'Reviewed At'
];

var FQ_EVIDENCE_COLUMNS = [
  'Evidence ID', 'Prospect ID', 'Finding Set Candidate ID', 'Candidate Version',
  'Source Type', 'Source URL', 'Page Title', 'Page Path', 'Element Type',
  'Element Label', 'Evidence Location', 'Captured At', 'Capture Method',
  'Desktop/Mobile Context', 'Evidence Excerpt', 'Observed Value',
  'Screenshot Reference', 'Test Performed', 'Test Result', 'Confidence',
  'Limitations', 'Raw Artifact Reference', 'Acquisition Version',
  'Review Status', 'Reviewed By', 'Reviewed At'
];

var FQ_FINDING_COLUMNS = [
  'Finding ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Category',
  'Finding Title', 'Finding State', 'Channel Type', 'Presence State',
  'Customer Journey Stage', 'Business Objective', 'Evidence Source',
  'Evidence Location', 'Evidence Observed At', 'Evidence Excerpt', 'Observation',
  'Expected Condition', 'Business Consequence', 'Consequence Basis',
  'Recommended Action', 'Implementation Location', 'Intended Outcome',
  'Completion Test', 'Evidence Confidence', 'Evidence References', 'Limitations',
  'Recommendation ID', 'Reviewed By', 'Reviewed At', 'Approval Status',
  'Approved Version', 'Validation Codes', 'Approval Operation Key',
  'Superseded By Finding ID', 'Superseded By', 'Superseded At',
  'Supersession Operation Key', 'Supersedes Finding ID'
];

var FQ_FINDING_SET_COLUMNS = [
  'Finding Set ID', 'Prospect ID', 'Version', 'Created At', 'Created By',
  'Review Status', 'Reviewed By', 'Reviewed At', 'Approved At', 'Approval Status',
  'Business Context Version', 'Presence Inventory Version', 'Evidence References',
  'Finding IDs', 'Document Eligibility', 'Supersedes Version', 'Immutable Hash',
  'Snapshot File ID', 'Limitations', 'Notes', 'Previous Review Submitted By',
  'Previous Review Submitted At', 'Returned By', 'Returned At', 'Return Reason', 'Return Operation Key'
];

var FQ_RECOMMENDATION_COLUMNS = [
  'Recommendation ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version',
  'Finding ID', 'Title', 'Recommended Action', 'Implementation Location',
  'Intended Outcome', 'Dependencies', 'Review Status', 'Operation Key', 'Limitations',
  'Reviewed By', 'Reviewed At', 'Review Operation Key',
  'Superseded By Recommendation ID', 'Supersedes Recommendation ID'
];

var FQ_ACTION_COLUMNS = [
  'Action ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version',
  'Recommendation ID', 'Sequence', 'Title', 'Implementation Path', 'Ownership',
  'Dependencies', 'Completion Test', 'Review Status', 'Operation Key'
];

var FQ_PRESENCE_STATES = ['Verified Present', 'Verified Absent', 'Not Verified', 'Not Applicable'];
var FQ_APPLICABILITY_STATES = ['Applicable', 'Potentially Applicable', 'Not Applicable', 'Needs Review'];
var FQ_FINDING_STATES = ['Draft', 'In Review', 'Needs More Evidence', 'Needs Changes', 'Actionable', 'Verified Strength', 'Not Verified', 'Rejected', 'Withdrawn', 'Superseded Pre-Snapshot', 'Superseded'];
var FQ_APPROVAL_STATES = ['Not Reviewed', 'In Review', 'Needs Changes', 'Needs More Evidence', 'Approved for Client', 'Rejected', 'Withdrawn', 'Superseded'];
var FQ_RECOMMENDATION_REVIEW_STATES = ['Draft', 'In Review', 'Needs Changes', 'Approved for Client', 'Withdrawn', 'Reviewed'];
var FQ_OPERATOR_ACTIONS = {
  markContextReviewed: { sheetName: FQ_CONTEXT_SHEET, columns: FQ_CONTEXT_COLUMNS, idHeader: 'Context ID' },
  markPresenceReviewed: { sheetName: FQ_PRESENCE_SHEET, columns: FQ_PRESENCE_COLUMNS, idHeader: 'Presence Record ID' },
  markEvidenceReviewed: { sheetName: FQ_EVIDENCE_SHEET, columns: FQ_EVIDENCE_COLUMNS, idHeader: 'Evidence ID' },
  markRecommendationReviewed: { sheetName: FQ_RECOMMENDATIONS_SHEET, columns: FQ_RECOMMENDATION_COLUMNS, idHeader: 'Recommendation ID' },
  transitionFinding: { sheetName: FQ_FINDINGS_SHEET, columns: FQ_FINDING_COLUMNS, idHeader: 'Finding ID' },
  approveFinding: { sheetName: FQ_FINDINGS_SHEET, columns: FQ_FINDING_COLUMNS, idHeader: 'Finding ID' },
  transitionFindingSet: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' },
  returnFindingSetToDraft: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' },
  approveFindingSet: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' },
  createSuccessorFindingSet: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' },
  seedDraftSuccessor: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' },
  withdrawDraftFinding: { sheetName: FQ_FINDINGS_SHEET, columns: FQ_FINDING_COLUMNS, idHeader: 'Finding ID' },
  createPreSnapshotCorrection: { sheetName: FQ_FINDINGS_SHEET, columns: FQ_FINDING_COLUMNS, idHeader: 'Finding ID' },
  supersedeFindingSet: { sheetName: FQ_FINDING_SETS_SHEET, columns: FQ_FINDING_SET_COLUMNS, idHeader: 'Finding Set ID' }
};
var FQ_SET_TRANSITIONS = {
  'Draft': ['In Review'],
  'In Review': ['Needs Changes', 'Needs More Evidence', 'Approved for Client'],
  'Needs Changes': ['In Review'],
  'Needs More Evidence': ['Draft', 'In Review'],
  'Approved for Client': ['Superseded'],
  'Superseded': []
};

function setupFindingQualityFoundation() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Set Up Finding Quality Foundation',
    'Create the five normalized Finding Quality operator sheets in this workbook? Existing sheets and data will not be changed.',
    ui.ButtonSet.YES_NO
  );
  if (result !== ui.Button.YES) return;
  ensureFindingQualitySchema_(SpreadsheetApp.getActiveSpreadsheet());
  ui.alert('Finding Quality Foundation', 'The normalized Finding Quality sheets are ready. Client documents remain locked until a human-approved immutable finding-set snapshot exists.', ui.ButtonSet.OK);
}

function ensureFindingQualitySchema_(ss) {
  const definitions = [
    [FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS],
    [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS],
    [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS],
    [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS],
    [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS],
    [FQ_ACTIONS_SHEET, FQ_ACTION_COLUMNS],
    [FQ_FINDING_SETS_SHEET, FQ_FINDING_SET_COLUMNS]
  ];
  const result = {};
  definitions.forEach(function(definition) {
    const name = definition[0];
    const columns = definition[1];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const table = ensureExactFindingQualityTable_(sheet, columns);
    formatFindingQualitySheet_(sheet, table, name);
    result[name] = { sheet: sheet, table: table };
  });
  applyFindingQualityValidations_(result);
  return result;
}

function ensureExactFindingQualityTable_(sheet, columns) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
  const nonblank = existing.filter(Boolean);
  if (nonblank.length && (nonblank.length !== columns.length || columns.some(function(header, index) { return existing[index] !== header; }))) {
    throw new Error('Finding Quality schema collision on sheet "' + sheet.getName() + '". Existing headers do not match the approved contract.');
  }
  if (sheet.getMaxColumns() < columns.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns.length - sheet.getMaxColumns());
  if (!nonblank.length) sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
  const headers = {};
  columns.forEach(function(header, index) { headers[header] = index + 1; });
  return { headerRow: 1, headers: headers, lastColumn: columns.length };
}

function formatFindingQualitySheet_(sheet, table, title) {
  sheet.setFrozenRows(1);
  sheet.setTabColor(BUSINESS_OPTIMIZATION_PLATFORM_THEME.gold);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, table.lastColumn)
    .setBackground(BUSINESS_OPTIMIZATION_PLATFORM_THEME.black)
    .setFontColor(BUSINESS_OPTIMIZATION_PLATFORM_THEME.gold)
    .setFontWeight('bold')
    .setWrap(true);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), table.lastColumn)
    .setVerticalAlignment('top')
    .setWrap(true);
  sheet.autoResizeColumns(1, Math.min(table.lastColumn, 12));
  sheet.setColumnWidths(1, table.lastColumn, 150);
  ['Evidence Excerpt', 'Observed Value', 'Observation', 'Expected Condition', 'Business Consequence', 'Consequence Basis', 'Recommended Action', 'Completion Test', 'Limitations', 'Notes'].forEach(function(header) {
    if (table.headers[header]) sheet.setColumnWidth(table.headers[header], 300);
  });
}

function applyFindingQualityValidations_(schema) {
  setFindingQualityValidation_(schema[FQ_CONTEXT_SHEET], 'Review Status', ['Draft', 'Reviewed']);
  setFindingQualityValidation_(schema[FQ_PRESENCE_SHEET], 'Presence State', FQ_PRESENCE_STATES);
  setFindingQualityValidation_(schema[FQ_PRESENCE_SHEET], 'Applicability', FQ_APPLICABILITY_STATES);
  setFindingQualityValidation_(schema[FQ_PRESENCE_SHEET], 'Review Status', ['Draft', 'Reviewed']);
  setFindingQualityValidation_(schema[FQ_EVIDENCE_SHEET], 'Review Status', ['Draft', 'Reviewed', 'Needs Verification']);
  setFindingQualityValidation_(schema[FQ_EVIDENCE_SHEET], 'Desktop/Mobile Context', ['Desktop', 'Mobile', 'Both', 'Not Applicable']);
  setFindingQualityValidation_(schema[FQ_FINDINGS_SHEET], 'Finding State', FQ_FINDING_STATES);
  setFindingQualityValidation_(schema[FQ_FINDINGS_SHEET], 'Approval Status', FQ_APPROVAL_STATES);
  setFindingQualityValidation_(schema[FQ_RECOMMENDATIONS_SHEET], 'Review Status', FQ_RECOMMENDATION_REVIEW_STATES);
  setFindingQualityValidation_(schema[FQ_ACTIONS_SHEET], 'Review Status', ['Draft', 'In Review', 'Needs Changes', 'Approved for Client', 'Withdrawn']);
  setFindingQualityValidation_(schema[FQ_FINDING_SETS_SHEET], 'Review Status', ['Draft', 'In Review', 'Needs Changes', 'Needs More Evidence', 'Approved for Client', 'Superseded']);
  setFindingQualityValidation_(schema[FQ_FINDING_SETS_SHEET], 'Approval Status', ['Not Reviewed', 'In Review', 'Needs Changes', 'Needs More Evidence', 'Approved for Client', 'Superseded']);
}

function setFindingQualityValidation_(entry, header, values) {
  if (!entry || !entry.table.headers[header]) return;
  const range = entry.sheet.getRange(2, entry.table.headers[header], Math.max(entry.sheet.getMaxRows() - 1, 1), 1);
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
}

function seedSelectedProspectBusinessContext() {
  const prospect = requireSelectedFindingQualityProspect_();
  const prospectId = getFindingQualityProspectId_(prospect);
  const ss = prospect.ss || SpreadsheetApp.getActiveSpreadsheet();
  const schema = ensureFindingQualitySchema_(ss);
  const sheet = schema[FQ_CONTEXT_SHEET].sheet;
  const table = schema[FQ_CONTEXT_SHEET].table;
  if (findFindingQualityRows_(sheet, table, 'Prospect ID', prospectId).length) throw new Error('A Business Context draft already exists for this prospect. Create a successor version instead of duplicating it.');
  const source = prospect.prospect || prospect;
  appendFindingQualityRecord_(sheet, table, {
    'Context ID': createFindingQualityId_('CTX'), 'Prospect ID': prospectId, 'Version': 1,
    'Primary Service': source.offer || source.service || '', 'Service Area': [source.city, source.state].filter(Boolean).join(', '),
    'Industry Context': source.industry || '', 'Source': 'Draft seeded from Master Prospect Tracker', 'Review Status': 'Draft'
  });
  sheet.activate();
  SpreadsheetApp.getUi().alert('Business Context Draft', 'Existing prospect data was copied only as a draft. Review every value and use Mark Selected Context Reviewed before it can support a finding set.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function requireSelectedFindingQualityProspect_() {
  const context = getSelectedProspectContext_(['Company', 'Prospect ID']);
  if (!context) throw new Error('Select exactly one Master Prospect Tracker data row before seeding Business Context.');
  const prospectId = String(getValueByHeader_(context.values, context.table.headers, 'Prospect ID') || '').trim();
  if (!prospectId) throw new Error('The selected prospect must have an exact Prospect ID before Business Context can be drafted.');
  const matches = findRowsByExactHeaderValue_(context.sheet, context.table, 'Prospect ID', prospectId);
  if (matches.length !== 1 || matches[0] !== context.selectedRow) {
    throw new Error('The selected Prospect ID is missing or ambiguous. Business Context seeding was blocked.');
  }
  context.prospectId = prospectId;
  context.prospect.prospectId = prospectId;
  return context;
}

function markSelectedBusinessContextReviewed() {
  const context = getSelectedFindingQualityActionRow_('markContextReviewed');
  assertDraftReviewTransition_(context.record, 'Business Context');
  requireHumanReviewer_();
  const record = context.record;
  validateBusinessContextRecord_(record);
  record['Review Status'] = 'Reviewed';
  record['Reviewed By'] = requireHumanReviewer_();
  record['Reviewed At'] = new Date();
  record.Fingerprint = fingerprintFindingQualityValue_(businessContextCanonicalProjection_(record));
  writeFindingQualityRecord_(context.sheet, context.table, context.row, record);
}

function markSelectedPresenceReviewed() {
  const context = getSelectedFindingQualityActionRow_('markPresenceReviewed');
  assertDraftReviewTransition_(context.record, 'Presence');
  const reviewer = requireHumanReviewer_();
  validateAssessmentPresenceRecord_(context.record, { humanApproval: true });
  context.record['Review Status'] = 'Reviewed';
  context.record['Reviewed By'] = reviewer;
  context.record['Reviewed At'] = new Date();
  writeFindingQualityRecord_(context.sheet, context.table, context.row, context.record);
}

function markSelectedEvidenceReviewed() {
  const context = getSelectedFindingQualityActionRow_('markEvidenceReviewed');
  assertDraftReviewTransition_(context.record, 'Evidence');
  const reviewer = requireHumanReviewer_();
  validateAssessmentEvidenceRecord_(context.record);
  context.record['Review Status'] = 'Reviewed';
  context.record['Reviewed By'] = reviewer;
  context.record['Reviewed At'] = new Date();
  writeFindingQualityRecord_(context.sheet, context.table, context.row, context.record);
}

function moveSelectedFindingToReview() { transitionSelectedFinding_('In Review', 'In Review'); }
function markSelectedFindingNeedsEvidence() { transitionSelectedFinding_('Needs More Evidence', 'Needs More Evidence'); }
function markSelectedFindingNeedsChanges() { transitionSelectedFinding_('Needs Changes', 'Needs Changes'); }
function rejectSelectedFinding() { transitionSelectedFinding_('Rejected', 'Rejected'); }
function moveSelectedFindingSetToReview() { return transitionSelectedFindingSet_('In Review', 'In Review'); }
function markSelectedFindingSetNeedsEvidence() { transitionSelectedFindingSet_('Needs More Evidence', 'Needs More Evidence'); }
function markSelectedFindingSetNeedsChanges() { transitionSelectedFindingSet_('Needs Changes', 'Needs Changes'); }

function transitionSelectedFindingSet_(reviewStatus, approvalStatus) {
  if (reviewStatus === 'In Review' && approvalStatus === 'In Review') return transitionSelectedFindingSetToReviewTransactional_();
  const selected = getSelectedFindingQualityActionRow_('transitionFindingSet');
  const reviewer = requireHumanReviewer_();
  assertFindingSetTransition_(String(selected.record['Review Status'] || 'Draft'), reviewStatus);
  if (reviewStatus === 'In Review') {
    if (typeof assertFindingSetRecommendationSeedAuthority_ === 'function') assertFindingSetRecommendationSeedAuthority_(selected.ss, selected.record);
    assertPlainLanguageFindingSetForApproval_(loadFindingQualityApprovalBundle_(selected.ss, selected.record));
  }
  selected.record['Review Status'] = reviewStatus;
  selected.record['Approval Status'] = approvalStatus;
  selected.record['Reviewed By'] = reviewer;
  selected.record['Reviewed At'] = new Date();
  writeFindingQualityRecord_(selected.sheet, selected.table, selected.row, selected.record);
}

/** Locked review-entry boundary for one complete, approved Finding Set authority chain. */
function transitionSelectedFindingSetToReviewTransactional_(hooks) {
  const selected = getSelectedFindingQualityActionRow_('transitionFindingSet');
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return transitionSelectedFindingSetToReviewLocked_(selected, hooks || {}); }
  finally { lock.releaseLock(); }
}

function transitionSelectedFindingSetToReviewLocked_(selected, hooks) {
  const table = getHeaderTable_(selected.sheet, FQ_FINDING_SET_COLUMNS);
  const selectedId = String(selected.record['Finding Set ID'] || '');
  const selectedVersion = String(selected.record.Version || '');
  const matches = readFindingQualityRecordsWithRows_({ sheet: selected.sheet, table: table }).filter(function(record) {
    return String(record['Finding Set ID']) === selectedId && String(record.Version) === selectedVersion;
  });
  if (matches.length !== 1 || !selectedId || !selectedVersion) throw new Error('The selected Finding Set is missing, ambiguous, or changed.');
  const setRecord = matches[0];
  const reviewer = String(requireHumanReviewer_()).trim().toLowerCase();
  if (!reviewer) throw new Error('Finding Set review requires an authenticated reviewer.');
  if (String(setRecord['Review Status']) === 'In Review' && String(setRecord['Approval Status']) === 'In Review') {
    assertCompletedFindingSetReviewEntry_(selected.ss, setRecord);
    return { status: 'already-completed', findingSetId: selectedId, version: selectedVersion };
  }
  if (String(setRecord['Review Status']) !== 'Draft' || String(setRecord['Approval Status']) !== 'Not Reviewed' || String(setRecord['Document Eligibility']) !== 'Not Eligible') throw new Error('Finding Set review entry requires Draft / Not Reviewed / Not Eligible authority.');
  if (String(setRecord['Approved At'] || '').trim() || String(setRecord['Immutable Hash'] || '').trim() || String(setRecord['Snapshot File ID'] || '').trim()) throw new Error('Finding Set review entry rejects approved or snapshotted authority.');
  if (String(setRecord['Return Operation Key'] || '').trim()) assertReturnedFindingSet_(setRecord, String(setRecord['Return Operation Key']));
  assertFindingSetTransition_('Draft', 'In Review');
  const staged = Object.assign({}, setRecord, {
    'Review Status': 'In Review', 'Approval Status': 'In Review',
    'Reviewed By': reviewer, 'Reviewed At': new Date(), 'Document Eligibility': 'Not Eligible'
  });
  delete staged._row;
  const bundle = loadFindingQualityApprovalBundle_(selected.ss, setRecord);
  validateFindingSetSuccessorApprovalAuthority_(selected.ss, staged, bundle);
  assertPlainLanguageFindingSetForApproval_(bundle);
  assertFindingSetReviewEntryDropdowns_(selected.sheet, table);
  const actionSheet = selected.ss.getSheetByName(FQ_ACTIONS_SHEET);
  const actionTable = getHeaderTable_(actionSheet, FQ_ACTION_COLUMNS);
  const actionCount = readFindingQualityRecords_(actionSheet, actionTable).filter(function(record) { return String(record['Prospect ID']) === String(setRecord['Prospect ID']); }).length;
  const before = selected.sheet.getRange(setRecord._row, 1, 1, table.lastColumn).getValues()[0];
  try {
    writeFindingQualityRecord_(selected.sheet, table, setRecord._row, staged);
    if (hooks.afterWrite) hooks.afterWrite(staged);
    SpreadsheetApp.flush();
    assertExactFindingSetReviewEntryReadback_(selected.ss, selected.sheet, table, setRecord._row, staged, actionCount);
    return { status: 'completed', findingSetId: selectedId, version: selectedVersion, reviewedBy: reviewer };
  } catch (error) {
    try {
      selected.sheet.getRange(setRecord._row, 1, 1, table.lastColumn).setValues([before]);
      SpreadsheetApp.flush();
      const restored = readFindingQualityRecord_(selected.sheet, table, setRecord._row);
      FQ_FINDING_SET_COLUMNS.forEach(function(field) { if (findingQualityDateText_(restored[field]) !== findingQualityDateText_(setRecord[field])) throw new Error('rollback differs at ' + field); });
    } catch (rollbackError) { throw new Error('Finding Set review entry failed and rollback could not be verified: ' + rollbackError.message); }
    throw error;
  }
}

function assertFindingSetReviewEntryDropdowns_(sheet, table) {
  [['Review Status', 'In Review'], ['Approval Status', 'In Review']].forEach(function(check) {
    const rules = sheet.getRange(2, table.headers[check[0]], Math.max(sheet.getMaxRows() - 1, 1), 1).getDataValidations();
    rules.forEach(function(row) { row.forEach(function(rule) {
      if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST || rule.getAllowInvalid()) throw new Error(check[0] + ' must use a strict dropdown validation.');
      if ([].concat(rule.getCriteriaValues()[0] || []).map(String).indexOf(check[1]) === -1) throw new Error(check[0] + ' dropdown does not allow ' + check[1] + '.');
    }); });
  });
}

function assertExactFindingSetReviewEntryReadback_(ss, sheet, table, row, expected, expectedActionCount) {
  const actual = readFindingQualityRecord_(sheet, table, row);
  FQ_FINDING_SET_COLUMNS.forEach(function(field) { if (findingQualityDateText_(actual[field]) !== findingQualityDateText_(expected[field])) throw new Error('Finding Set review-entry readback differs at ' + field + '.'); });
  const actionSheet = ss.getSheetByName(FQ_ACTIONS_SHEET), actionTable = getHeaderTable_(actionSheet, FQ_ACTION_COLUMNS);
  const actionCount = readFindingQualityRecords_(actionSheet, actionTable).filter(function(record) { return String(record['Prospect ID']) === String(expected['Prospect ID']); }).length;
  if (actionCount !== expectedActionCount) throw new Error('Finding Set review entry changed Assessment Actions.');
}

function assertCompletedFindingSetReviewEntry_(ss, setRecord) {
  if (!String(setRecord['Reviewed By'] || '').trim() || !String(setRecord['Reviewed At'] || '').trim() || String(setRecord['Document Eligibility']) !== 'Not Eligible' || String(setRecord['Approved At'] || setRecord['Immutable Hash'] || setRecord['Snapshot File ID'] || '').trim()) throw new Error('Completed Finding Set review entry is invalid.');
  const bundle = loadFindingQualityApprovalBundle_(ss, setRecord);
  validateFindingSetSuccessorApprovalAuthority_(ss, setRecord, bundle);
  assertPlainLanguageFindingSetForApproval_(bundle);
}

function assertFindingSetRecommendationSeedAuthority_(ss, setRecord) {
  const requiredSheets = [FQ_CONTEXT_SHEET, FQ_PRESENCE_SHEET, FQ_EVIDENCE_SHEET, FQ_FINDINGS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET, FQ_FINDING_SETS_SHEET];
  const columnsBySheet = {}; columnsBySheet[FQ_CONTEXT_SHEET]=FQ_CONTEXT_COLUMNS; columnsBySheet[FQ_PRESENCE_SHEET]=FQ_PRESENCE_COLUMNS; columnsBySheet[FQ_EVIDENCE_SHEET]=FQ_EVIDENCE_COLUMNS; columnsBySheet[FQ_FINDINGS_SHEET]=FQ_FINDING_COLUMNS; columnsBySheet[FQ_RECOMMENDATIONS_SHEET]=FQ_RECOMMENDATION_COLUMNS; columnsBySheet[FQ_ACTIONS_SHEET]=FQ_ACTION_COLUMNS; columnsBySheet[FQ_FINDING_SETS_SHEET]=FQ_FINDING_SET_COLUMNS;
  const schema = {};
  requiredSheets.forEach(function(name) { const sheet=ss.getSheetByName(name); if(!sheet)throw new Error('Finding Set review requires '+name+'.'); schema[name]={sheet:sheet,table:ensureExactFindingQualityTable_(sheet,columnsBySheet[name])}; });
  const prospectId=String(setRecord['Prospect ID']);
  const contexts=readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet,schema[FQ_CONTEXT_SHEET].table).filter(function(record){return String(record['Prospect ID'])===prospectId&&String(record.Version)===String(setRecord['Business Context Version']);});
  const presence=readFindingQualityRecords_(schema[FQ_PRESENCE_SHEET].sheet,schema[FQ_PRESENCE_SHEET].table).filter(function(record){return String(record['Prospect ID'])===prospectId&&String(record['Inventory Version'])===String(setRecord['Presence Inventory Version'])&&String(record['Review Status'])==='Reviewed';});
  const evidence=resolveFindingQualityEvidenceReferences_(readFindingQualityRecords_(schema[FQ_EVIDENCE_SHEET].sheet,schema[FQ_EVIDENCE_SHEET].table),parseFindingQualityList_(setRecord['Evidence References']),prospectId,String(setRecord['Finding Set ID']));
  const findings=readFindingQualityRecordsWithRows_(schema[FQ_FINDINGS_SHEET]).filter(function(record){return parseFindingQualityList_(setRecord['Finding IDs']).indexOf(String(record['Finding ID']))!==-1;});
  const recommendations=readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]);
  findings.forEach(function(finding){
    const matches=recommendations.filter(function(record){return String(record['Recommendation ID'])===String(finding['Recommendation ID']);});
    if(matches.length!==1||String(matches[0]['Review Status'])!=='Reviewed')throw new Error('Finding Set review requires one linked Reviewed Recommendation.');
    const recommendation=matches[0];
    if(!/^FQRECOMMENDATIONDRAFT:|^FQPRESNAPSHOTRECOVERY:/.test(String(recommendation['Operation Key'])))return;
    const channelPresence=presence.filter(function(record){return String(record['Channel Type'])===String(finding['Channel Type']);});
    if(contexts.length!==1||channelPresence.length!==1)throw new Error('Finding Set Recommendation authority is missing or ambiguous.');
    const refs=parseFindingQualityList_(finding['Evidence References']);
    const authority={context:contexts[0],presence:channelPresence[0],evidence:evidence.filter(function(record){return refs.indexOf(String(record['Evidence ID']))!==-1;}),set:setRecord};
    const candidate=normalizeRecommendationDraftCandidate_({title:recommendation.Title,recommendedAction:recommendation['Recommended Action'],implementationLocation:recommendation['Implementation Location'],intendedOutcome:recommendation['Intended Outcome'],dependencies:recommendation.Dependencies,limitations:recommendation.Limitations});
    assertRecommendationSeedIdentity_(schema,finding,recommendation,authority,candidate);
  });
}

function transitionSelectedFinding_(findingState, approvalStatus) {
  const context = getSelectedFindingQualityActionRow_('transitionFinding');
  const reviewer = requireHumanReviewer_();
  assertFindingTransition_(String(context.record['Approval Status'] || 'Not Reviewed'), approvalStatus);
  context.record['Finding State'] = findingState;
  context.record['Approval Status'] = approvalStatus;
  context.record['Reviewed By'] = reviewer;
  context.record['Reviewed At'] = new Date();
  context.record['Validation Codes'] = validateAssessmentFindingRecord_(context.record, { approvalRequired: false }).join(', ');
  writeFindingQualityRecord_(context.sheet, context.table, context.row, context.record);
}

function approveSelectedFindingForClientLegacy_() {
  const context = getSelectedFindingQualityActionRow_('approveFinding');
  const reviewer = requireHumanReviewer_();
  if (['Rejected', 'Withdrawn'].indexOf(String(context.record['Finding State'] || '')) !== -1) throw new Error('A rejected or withdrawn finding cannot be approved.');
  assertFindingTransition_(String(context.record['Approval Status'] || 'Not Reviewed'), FQ_APPROVED_STATUS);
  context.record['Reviewed By'] = reviewer;
  context.record['Reviewed At'] = new Date();
  if (String(context.record['Finding State'] || '') !== 'Verified Strength') context.record['Finding State'] = 'Actionable';
  context.record['Approval Status'] = FQ_APPROVED_STATUS;
  context.record['Approved Version'] = context.record['Finding Set Version'];
  const errors = validateAssessmentFindingRecord_(context.record, { approvalRequired: true });
  if (errors.length) throw new Error('Finding approval failed: ' + errors.join('; '));
  context.record['Validation Codes'] = '';
  writeFindingQualityRecord_(context.sheet, context.table, context.row, context.record);
}

function approveSelectedFindingSetForClientLegacy_() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const selected = getSelectedFindingQualityActionRow_('approveFindingSet');
    const reviewer = requireHumanReviewer_();
    const setRecord = selected.record;
    if (String(setRecord['Approval Status'] || '') === FQ_APPROVED_STATUS) throw new Error('This finding-set version is already approved and immutable.');
    assertFindingSetTransition_(String(setRecord['Review Status'] || 'Draft'), FQ_APPROVED_STATUS);
    const bundle = loadFindingQualityApprovalBundle_(selected.ss, setRecord);
    assertPlainLanguageFindingSetForApproval_(bundle);
    const snapshot = buildApprovedFindingSetSnapshot_(bundle, reviewer, new Date());
    const serialized = stableStringifyFindingQuality_(snapshot.payload);
    snapshot.payload.fingerprint = fingerprintFindingQualityText_(serialized);
    const finalSerialized = stableStringifyFindingQuality_(snapshot.payload);
    const file = persistApprovedFindingSetSnapshot_(bundle.company, snapshot.payload, finalSerialized);
    setRecord['Review Status'] = FQ_APPROVED_STATUS;
    setRecord['Approval Status'] = FQ_APPROVED_STATUS;
    setRecord['Reviewed By'] = reviewer;
    setRecord['Reviewed At'] = snapshot.payload.approvedAt;
    setRecord['Approved At'] = snapshot.payload.approvedAt;
    setRecord['Document Eligibility'] = 'Eligible';
    setRecord['Immutable Hash'] = snapshot.payload.fingerprint;
    setRecord['Snapshot File ID'] = file.getId();
    setRecord['Evidence References'] = snapshot.payload.evidence.map(function(item) { return item.evidenceId; }).join(', ');
    setRecord['Finding IDs'] = snapshot.payload.findings.map(function(item) { return item.findingId; }).join(', ');
    writeFindingQualityRecord_(selected.sheet, selected.table, selected.row, setRecord);
    protectApprovedFindingQualityRows_(bundle, selected);
    SpreadsheetApp.getUi().alert('Finding Set Approved', 'Approved version ' + setRecord.Version + ' is frozen. Fingerprint: ' + snapshot.payload.fingerprint, SpreadsheetApp.getUi().ButtonSet.OK);
    return { findingSetId: setRecord['Finding Set ID'], version: String(setRecord.Version), fingerprint: snapshot.payload.fingerprint, approvalStatus: FQ_APPROVED_STATUS };
  } finally {
    lock.releaseLock();
  }
}

function assertPlainLanguageFindingSetForApproval_(bundle) {
  const errors = [];
  [].concat(bundle.findings || []).forEach(function(record) { errors.push.apply(errors, validatePlainLanguageFindingFields_(record)); });
  if (errors.length) throw new Error('Finding set plain-language review failed: ' + Array.from(new Set(errors)).join('; '));
}

function validatePlainLanguageFindingFields_(record) {
  const fields = ['Finding Title', 'Observation', 'Expected Condition', 'Business Consequence', 'Consequence Basis', 'Recommended Action', 'Implementation Location', 'Intended Outcome', 'Completion Test'];
  const jargon = /\b(?:approved priority|customer journey|diagnostic|evidence traceability|implementation objective|implementation path|intended outcome|decision requirements|supported business consequence|expected condition|observed condition|assessment boundaries|scope of review|methodology|applicability|verified present|successful correction|implementation sequencing|separately scoped|designated owner|documented implementation location|operational performance and outcomes)\b/i;
  const errors = [];
  fields.forEach(function(field) {
      const value = String(record[field] || '').trim();
      if (!value) return;
      if (jargon.test(value)) errors.push('FQ_PLAIN_LANGUAGE_JARGON_' + machineFindingQuality_(field).toUpperCase());
      value.split(/[.!?]+/).map(function(sentence) { return sentence.trim(); }).filter(Boolean).forEach(function(sentence) {
        const words = sentence.split(/\s+/).filter(Boolean).length;
        if (words > 18) errors.push('FQ_PLAIN_LANGUAGE_LONG_SENTENCE_' + machineFindingQuality_(field).toUpperCase());
      });
  });
  return Array.from(new Set(errors));
}

function supersedeSelectedFindingSet() {
  const selected = getSelectedFindingQualityActionRow_('supersedeFindingSet');
  const reviewer = requireHumanReviewer_();
  assertFindingSetTransition_(String(selected.record['Review Status'] || ''), 'Superseded');
  selected.record['Review Status'] = 'Superseded';
  selected.record['Approval Status'] = 'Superseded';
  selected.record['Reviewed By'] = reviewer;
  selected.record['Reviewed At'] = new Date();
  selected.record['Document Eligibility'] = 'Superseded';
  writeFindingQualityRecord_(selected.sheet, selected.table, selected.row, selected.record);
}

function createSuccessorFindingSet() {
  const selected = getSelectedFindingQualityActionRow_('createSuccessorFindingSet');
  if (String(selected.record['Approval Status'] || '') !== FQ_APPROVED_STATUS) throw new Error('Only an approved finding set can create a successor version.');
  const version = Number(selected.record.Version || 0) + 1;
  const record = Object.assign({}, selected.record, {
    Version: version, 'Created At': new Date(), 'Created By': requireHumanReviewer_(),
    'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Approved At': '',
    'Approval Status': 'Not Reviewed', 'Document Eligibility': 'Not Eligible',
    'Supersedes Version': selected.record.Version, 'Immutable Hash': '', 'Snapshot File ID': ''
  });
  appendFindingQualityRecord_(selected.sheet, selected.table, record);
  copyFindingQualityRowsForSuccessor_(selected.ss, selected.record, version);
}

function copyFindingQualityRowsForSuccessor_(ss, priorSet, newVersion) {
  const sheet = ss.getSheetByName(FQ_FINDINGS_SHEET);
  const table = ensureExactFindingQualityTable_(sheet, FQ_FINDING_COLUMNS);
  const rows = readFindingQualityRecords_(sheet, table).filter(function(record) {
    return String(record['Finding Set ID']) === String(priorSet['Finding Set ID']) && String(record['Finding Set Version']) === String(priorSet.Version);
  });
  rows.filter(function(record) { return String(record['Finding State']) !== 'Withdrawn' && String(record['Approval Status']) !== 'Withdrawn'; }).forEach(function(record) {
    const copy = Object.assign({}, record, {
      'Finding ID': createFindingQualityId_('FND'), 'Finding Set Version': newVersion,
      'Finding State': 'Draft', 'Reviewed By': '', 'Reviewed At': '',
      'Approval Status': 'Not Reviewed', 'Approved Version': '', 'Validation Codes': ''
    });
    appendFindingQualityRecord_(sheet, table, copy);
  });
}

function loadApprovedFindingSetForGeneration_(prospect, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setSheet = ss.getSheetByName(FQ_FINDING_SETS_SHEET);
  if (!setSheet) throw findingQualityGenerationLockError_();
  const table = ensureExactFindingQualityTable_(setSheet, FQ_FINDING_SET_COLUMNS);
  const prospectId = getFindingQualityProspectId_(prospect);
  if (!prospectId) throw findingQualityGenerationLockError_();
  let reference = options && options.approvedFindingSetReference;
  if (!reference) {
    const head = resolveApprovedFindingSetHead_(readFindingQualityRecords_(setSheet, table), prospectId);
    reference = { findingSetId: head['Finding Set ID'], version: head.Version, fingerprint: head['Immutable Hash'], approvalStatus: head['Approval Status'] };
  }
  const asserted = assertApprovedFindingSetReferenceShape_(reference);
  const matches = readFindingQualityRecords_(setSheet, table).filter(function(record) {
    return String(record['Finding Set ID']) === asserted.findingSetId && String(record.Version) === asserted.version;
  });
  if (matches.length !== 1) throw findingQualityGenerationLockError_();
  const setRecord = matches[0];
  if (!prospectId || String(setRecord['Prospect ID']) !== prospectId || String(setRecord['Approval Status']) !== FQ_APPROVED_STATUS || String(setRecord['Document Eligibility']) !== 'Eligible' || String(setRecord['Immutable Hash']) !== asserted.fingerprint || !setRecord['Snapshot File ID']) throw findingQualityGenerationLockError_();
  const file = DriveApp.getFileById(String(setRecord['Snapshot File ID']));
  const payload = JSON.parse(file.getBlob().getDataAsString());
  const fingerprint = String(payload.fingerprint || '');
  const projection = Object.assign({}, payload);
  delete projection.fingerprint;
  if (fingerprint !== asserted.fingerprint || fingerprintFindingQualityText_(stableStringifyFindingQuality_(projection)) !== fingerprint) throw findingQualityGenerationLockError_();
  validateApprovedSnapshotForGeneration_(payload, setRecord);
  const reviewedInput = Object.assign({}, payload.rendererInput || {}, {
    packagePreparedAt: String(payload.approvedAt || ''),
    businessContext: payload.businessContext || {},
    businessContextVersion: String(payload.businessContextVersion || ''),
    presence: [].concat(payload.presence || []),
    presenceInventoryVersion: String(payload.presenceInventoryVersion || ''),
    evidence: [].concat(payload.evidence || []).map(function(item) {
      return Object.assign({}, item, {
        key: String(item.evidenceId || ''),
        label: [String(item.sourceType || ''), String(item.evidenceLocation || '')].filter(Boolean).join(' — '),
        detail: String(item.observedValue || ''),
        state: 'Actionable'
      });
    }),
    findings: [].concat(payload.findings || []).map(findingQualityRendererFindingFromSnapshot_),
    recommendations: [].concat(payload.recommendations || []).map(function(item) {
      return {
        key: String(item.recommendationId || ''), findingKey: String(item.findingId || ''), title: String(item.title || ''),
        change: String(item.recommendedAction || ''), why: String(item.intendedOutcome || ''),
        dependency: String(item.dependency || '')
      };
    }),
    actions: [].concat(payload.improvementPlanActions || []).map(function(item, index) {
      return {
        key: String(item.actionId || ''), recommendationKey: String(item.recommendationId || ''), sequence: index + 1,
        title: String(item.title || ''), outcome: String(item.intendedOutcome || ''), implementationPath: String(item.implementationPath || ''),
        dependency: String(item.dependency || ''), completionTest: String(item.completionTest || '')
      };
    })
  });
  return { reference: asserted, reviewedInput: deepFreezeGoldStandard_(reviewedInput) };
}

function resolveApprovedFindingSetHead_(records, prospectId) {
  const scoped = [].concat(records || []).filter(function(record) { return String(record['Prospect ID']) === String(prospectId); });
  const byIdentity = {};
  scoped.forEach(function(record) {
    const setId = String(record['Finding Set ID'] || '').trim();
    const version = String(record.Version || '').trim();
    if (!setId || !version) throw findingQualityGenerationLockError_();
    const key = setId + ':' + version;
    if (byIdentity[key]) throw findingQualityGenerationLockError_();
    byIdentity[key] = record;
  });
  const eligible = scoped.filter(function(record) {
    return String(record['Approval Status']) === FQ_APPROVED_STATUS && String(record['Document Eligibility']) === 'Eligible';
  });
  if (!eligible.length) throw findingQualityGenerationLockError_();

  const childCounts = {};
  eligible.forEach(function(record) {
    if (!String(record['Immutable Hash'] || '').trim() || !String(record['Snapshot File ID'] || '').trim()) throw findingQualityGenerationLockError_();
    const parentVersion = String(record['Supersedes Version'] || '').trim();
    if (!parentVersion) return;
    const parentKey = String(record['Finding Set ID']) + ':' + parentVersion;
    if (!byIdentity[parentKey]) throw findingQualityGenerationLockError_();
    childCounts[parentKey] = (childCounts[parentKey] || 0) + 1;
    if (childCounts[parentKey] > 1) throw findingQualityGenerationLockError_();
  });

  eligible.forEach(function(record) {
    const seen = {};
    let current = record;
    while (current) {
      const key = String(current['Finding Set ID']) + ':' + String(current.Version);
      if (seen[key]) throw findingQualityGenerationLockError_();
      seen[key] = true;
      const parentVersion = String(current['Supersedes Version'] || '').trim();
      if (!parentVersion) break;
      current = byIdentity[String(current['Finding Set ID']) + ':' + parentVersion];
      if (!current) throw findingQualityGenerationLockError_();
    }
  });

  const supersededEligible = {};
  eligible.forEach(function(record) {
    const parentVersion = String(record['Supersedes Version'] || '').trim();
    if (parentVersion) supersededEligible[String(record['Finding Set ID']) + ':' + parentVersion] = true;
  });
  const heads = eligible.filter(function(record) { return !supersededEligible[String(record['Finding Set ID']) + ':' + String(record.Version)]; });
  if (heads.length !== 1) throw findingQualityGenerationLockError_();
  return heads[0];
}

function findingQualityRendererFindingFromSnapshot_(item) {
  return {
    key: String(item.findingId || ''), category: String(item.findingTitle || ''), state: String(item.findingState || ''),
    channelType: String(item.channelType || ''), presenceState: String(item.presenceState || ''), customerJourneyStage: String(item.customerJourneyStage || ''),
    businessObjective: String(item.businessObjective || ''), evidenceSource: String(item.evidenceSource || ''), evidenceLocation: String(item.evidenceLocation || ''),
    evidenceObservedAt: String(item.evidenceObservedAt || ''), evidenceExcerpt: String(item.evidenceExcerpt || ''), observation: String(item.observation || ''),
    expectedCondition: String(item.expectedCondition || ''), businessImpact: String(item.businessConsequence || ''), consequenceBasis: String(item.consequenceBasis || ''),
    recommendation: String(item.recommendedAction || ''), implementationLocation: String(item.implementationLocation || ''), intendedOutcome: String(item.intendedOutcome || ''),
    completionTest: String(item.completionTest || ''), evidenceConfidence: Number(item.evidenceConfidence || 0),
    verificationNeeded: String(item.verificationNeeded || ''), priority: String(item.findingState || '') === 'Verified Strength' ? 'Verified Strength' : 'Priority Improvement',
    evidenceKeys: [].concat(item.evidenceReferences || []).map(String), limitations: [].concat(item.limitations || []).map(String)
  };
}

function assertApprovedFindingSetReferenceShape_(reference) {
  const value = reference && typeof reference === 'object' ? reference : {};
  const result = {
    findingSetId: String(value.findingSetId || '').trim(), version: String(value.version || '').trim(),
    fingerprint: String(value.fingerprint || value.immutableHash || '').trim(), approvalStatus: String(value.approvalStatus || '').trim()
  };
  if (!result.findingSetId || !result.version || !result.fingerprint || result.approvalStatus !== FQ_APPROVED_STATUS) throw findingQualityGenerationLockError_();
  return Object.freeze(result);
}

function findingQualityGenerationLockError_() {
  return new Error('Client deliverable generation is locked. Reviewed client findings must be approved as a durable finding set before the Executive Brief, Digital Business Assessment, Improvement Plan, or Prospect-to-Revenue artifacts can be generated.');
}

function validateApprovedSnapshotForGeneration_(payload, setRecord) {
  if (!payload || payload.approvalStatus !== FQ_APPROVED_STATUS || String(payload.findingSetId) !== String(setRecord['Finding Set ID']) || String(payload.version) !== String(setRecord.Version) || !payload.reviewedBy || !payload.approvedAt) throw findingQualityGenerationLockError_();
  const findings = [].concat(payload.findings || []);
  if (!findings.length || findings.some(function(record) { return validateAssessmentFindingRecord_(record, { approvalRequired: true, snapshotShape: true }).length; })) throw findingQualityGenerationLockError_();
  const recommendationIds = findings.map(function(item) { return String(item.recommendationId || item['Recommendation ID'] || ''); }).filter(Boolean);
  const actions = [].concat(payload.improvementPlanActions || []);
  if (actions.length !== recommendationIds.length || actions.some(function(action) { return recommendationIds.indexOf(String(action.recommendationId || '')) === -1; })) throw findingQualityGenerationLockError_();
}

function buildApprovedFindingSetSnapshot_(bundle, reviewer, approvedAt) {
  const findings = bundle.findings.filter(function(record) { return String(record['Approval Status']) === FQ_APPROVED_STATUS && ['Rejected', 'Withdrawn'].indexOf(String(record['Finding State'])) === -1; });
  const evidenceById = {};
  bundle.evidence.forEach(function(record) { evidenceById[String(record['Evidence ID'])] = record; });
  const errors = [];
  findings.forEach(function(record) { errors.push.apply(errors, validateAssessmentFindingRecord_(record, { approvalRequired: true, evidenceById: evidenceById })); });
  ['Observation', 'Business Consequence', 'Recommended Action', 'Completion Test'].forEach(function(field) {
    findings.forEach(function(record, index) {
      findings.slice(index + 1).forEach(function(other) {
        if (String(record.Category) !== String(other.Category) && findingQualitySimilarity_(record[field], other[field]) >= 0.82) errors.push('FQ_SET_REPEATED_GENERIC_' + machineFindingQuality_(field).toUpperCase());
      });
    });
  });
  if (!findings.length) errors.push('FQ_SET_NO_APPROVED_FINDINGS');
  if (errors.length) throw new Error('Finding set approval failed: ' + Array.from(new Set(errors)).join('; '));
  const evidenceIds = Array.from(new Set(findings.reduce(function(all, record) { return all.concat(parseFindingQualityList_(record['Evidence References'])); }, [])));
  const evidence = evidenceIds.map(function(id) { return evidenceById[id]; }).filter(Boolean);
  const clientFindings = findings.map(findingQualitySnapshotFinding_);
  const recommendations = clientFindings.filter(function(item) { return item.findingState === 'Actionable' || item.findingState === 'Verified Strength'; }).map(function(item) {
    const authority = [].concat(bundle.recommendations || []).filter(function(record) { return String(record['Recommendation ID']) === item.recommendationId; })[0];
    return {
      recommendationId: item.recommendationId, findingId: item.findingId,
      title: authority ? String(authority.Title) : item.findingTitle,
      recommendedAction: item.recommendedAction, implementationLocation: item.implementationLocation, intendedOutcome: item.intendedOutcome,
      dependencies: authority ? parseFindingQualityList_(authority.Dependencies) : [],
      limitations: authority ? parseFindingQualityList_(authority.Limitations) : item.limitations
    };
  });
  const actions = recommendations.map(function(item) {
    const finding = clientFindings.filter(function(candidate) { return candidate.findingId === item.findingId; })[0];
    return { actionId: 'ACT-' + item.recommendationId, recommendationId: item.recommendationId, findingId: item.findingId, title: item.title, intendedOutcome: item.intendedOutcome, implementationPath: item.recommendedAction + ' at ' + item.implementationLocation, dependency: finding.limitations.length ? finding.limitations.join('; ') : 'Owner approval of the documented scope.', completionTest: finding.completionTest };
  });
  const payload = {
    schemaVersion: 'FQ-1', findingSetId: String(bundle.set['Finding Set ID']), prospectId: String(bundle.set['Prospect ID']), version: String(bundle.set.Version),
    approvalStatus: FQ_APPROVED_STATUS, reviewedBy: reviewer, approvedAt: approvedAt.toISOString(),
    businessContextVersion: String(bundle.set['Business Context Version']), presenceInventoryVersion: String(bundle.set['Presence Inventory Version']),
    businessContext: businessContextCanonicalProjection_(bundle.context), presence: bundle.presence.map(findingQualitySnapshotPresence_),
    evidence: evidence.map(findingQualitySnapshotEvidence_), findings: clientFindings, recommendations: recommendations,
    improvementPlanActions: actions, limitations: parseFindingQualityList_(bundle.set.Limitations),
    rendererInput: buildFindingQualityRendererInput_(bundle, evidence, clientFindings, recommendations, actions)
  };
  return { payload: payload };
}

function buildFindingQualityRendererInput_(bundle, evidence, findings, recommendations, actions) {
  return {
    company: bundle.company, website: String(bundle.context['Relevant Conversion Destination'] || ''),
    businessContext: businessContextCanonicalProjection_(bundle.context), businessContextVersion: String(bundle.set['Business Context Version']),
    presence: bundle.presence.map(findingQualitySnapshotPresence_), presenceInventoryVersion: String(bundle.set['Presence Inventory Version']),
    evidence: evidence.map(function(item) { return Object.assign(findingQualitySnapshotEvidence_(item), { key: String(item['Evidence ID']), label: String(item['Source Type']) + ' — ' + String(item['Evidence Location']), detail: String(item['Evidence Excerpt'] || item['Observed Value']), state: 'Actionable' }); }),
    findings: findings.map(function(item) { return { key: item.findingId, category: item.findingTitle, state: item.findingState, channelType: item.channelType, presenceState: item.presenceState, customerJourneyStage: item.customerJourneyStage, businessObjective: item.businessObjective, evidenceSource: item.evidenceSource, evidenceLocation: item.evidenceLocation, evidenceObservedAt: item.evidenceObservedAt, evidenceExcerpt: item.evidenceExcerpt, observation: item.observation, expectedCondition: item.expectedCondition, businessImpact: item.businessConsequence, consequenceBasis: item.consequenceBasis, recommendation: item.recommendedAction, implementationLocation: item.implementationLocation, intendedOutcome: item.intendedOutcome, completionTest: item.completionTest, evidenceConfidence: item.evidenceConfidence, priority: item.findingState === 'Verified Strength' ? 'Verified Strength' : 'Priority Improvement', evidenceKeys: item.evidenceReferences, limitations: item.limitations }; }),
    recommendations: recommendations.map(function(item) { const finding = findings.filter(function(candidate) { return candidate.findingId === item.findingId; })[0]; return { key: item.recommendationId, findingKey: item.findingId, title: item.title, change: item.recommendedAction, why: item.intendedOutcome, dependency: finding.limitations.length ? finding.limitations.join('; ') : 'Owner approval of the documented scope.' }; }),
    actions: actions.map(function(item, index) { return { key: item.actionId, recommendationKey: item.recommendationId, sequence: index + 1, title: item.title, outcome: item.intendedOutcome, implementationPath: item.implementationPath, dependency: item.dependency, completionTest: item.completionTest }; }),
    limitations: parseFindingQualityList_(bundle.set.Limitations), primaryConclusion: findings[0] ? findings[0].findingTitle : '', primaryConclusionDetail: findings[0] ? findings[0].observation : '', businessImplication: findings[0] ? findings[0].businessConsequence : '', firstStep: findings[0] ? findings[0].recommendedAction : ''
  };
}

function loadFindingQualityApprovalBundle_(ss, setRecord) {
  const prospectId = String(setRecord['Prospect ID'] || '').trim();
  const version = String(setRecord.Version || '').trim();
  const contextSheet = ss.getSheetByName(FQ_CONTEXT_SHEET);
  const presenceSheet = ss.getSheetByName(FQ_PRESENCE_SHEET);
  const evidenceSheet = ss.getSheetByName(FQ_EVIDENCE_SHEET);
  const findingsSheet = ss.getSheetByName(FQ_FINDINGS_SHEET);
  if (!contextSheet || !presenceSheet || !evidenceSheet || !findingsSheet) throw new Error('Finding Quality schema is incomplete.');
  const contexts = readFindingQualityRecords_(contextSheet, ensureExactFindingQualityTable_(contextSheet, FQ_CONTEXT_COLUMNS)).filter(function(record) { return String(record['Prospect ID']) === prospectId && String(record.Version) === String(setRecord['Business Context Version']); });
  if (contexts.length !== 1 || String(contexts[0]['Review Status']) !== 'Reviewed') throw new Error('Exactly one reviewed Business Context version is required.');
  validateBusinessContextRecord_(contexts[0]);
  const presence = readFindingQualityRecords_(presenceSheet, ensureExactFindingQualityTable_(presenceSheet, FQ_PRESENCE_COLUMNS)).filter(function(record) { return String(record['Prospect ID']) === prospectId && String(record['Inventory Version']) === String(setRecord['Presence Inventory Version']); });
  if (!presence.length || presence.some(function(record) { try { validateAssessmentPresenceRecord_(record, { humanApproval: true }); return String(record['Review Status']) !== 'Reviewed'; } catch (error) { return true; } })) throw new Error('The reviewed Digital Presence Inventory is incomplete or invalid.');
  const evidence = resolveFindingQualityEvidenceReferences_(
    readFindingQualityRecords_(evidenceSheet, ensureExactFindingQualityTable_(evidenceSheet, FQ_EVIDENCE_COLUMNS)),
    parseFindingQualityList_(setRecord['Evidence References']),
    prospectId,
    String(setRecord['Finding Set ID'])
  );
  const requestedFindingIds = parseFindingQualityList_(setRecord['Finding IDs']);
  if (!requestedFindingIds.length || new Set(requestedFindingIds).size !== requestedFindingIds.length) throw new Error('Finding Set must reference unique active Finding IDs.');
  const allFindings = readFindingQualityRecords_(findingsSheet, ensureExactFindingQualityTable_(findingsSheet, FQ_FINDING_COLUMNS));
  const findings = requestedFindingIds.map(function(id) {
    const matches = allFindings.filter(function(record) { return String(record['Finding ID']) === id && String(record['Prospect ID']) === prospectId && String(record['Finding Set ID']) === String(setRecord['Finding Set ID']) && String(record['Finding Set Version']) === version; });
    if (matches.length !== 1) throw new Error('Finding Set reference is missing or ambiguous: ' + id + '.');
    if (String(matches[0]['Finding State']) === 'Withdrawn' || String(matches[0]['Approval Status']) === 'Withdrawn') throw new Error('Finding Set cannot reference a withdrawn finding: ' + id + '.');
    return matches[0];
  });
  return { set: setRecord, context: contexts[0], presence: presence, evidence: evidence, findings: findings, company: getFindingQualityCompany_(ss, prospectId) };
}

function findingQualityEvidenceImmutableProjection_(record) {
  const result = {};
  FQ_EVIDENCE_COLUMNS.filter(function(field) { return ['Review Status', 'Reviewed By', 'Reviewed At'].indexOf(field) === -1; }).forEach(function(field) {
    result[field] = findingQualityDateText_(record[field]);
  });
  return result;
}

function resolveFindingQualityEvidenceReferences_(records, referenceIds, prospectId, findingSetId) {
  const ids = [].concat(referenceIds || []).map(String).map(function(value) { return value.trim(); }).filter(Boolean);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Evidence references must contain unique stable Evidence IDs.');
  return ids.map(function(id) {
    const matches = records.filter(function(record) { return String(record['Evidence ID']) === id; });
    if (matches.length !== 1) throw new Error('Evidence reference is missing or ambiguous: ' + id + '.');
    const record = matches[0];
    if (String(record['Prospect ID']) !== String(prospectId)) throw new Error('Evidence reference belongs to a different prospect: ' + id + '.');
    if (String(record['Finding Set Candidate ID']) !== String(findingSetId)) throw new Error('Evidence reference is outside the approved finding-set scope: ' + id + '.');
    validateAssessmentEvidenceRecord_(record);
    return record;
  });
}

function validateBusinessContextRecord_(record) {
  ['Prospect ID', 'Version', 'Primary Service', 'Target Customer', 'Service Area', 'Desired Customer Action', 'Primary Business Objective', 'Industry Context', 'Source'].forEach(function(field) { if (!String(record[field] || '').trim()) throw new Error('Business Context requires ' + field + '.'); });
}

function validateAssessmentPresenceRecord_(record, options) {
  ['Presence Record ID', 'Prospect ID', 'Inventory ID', 'Inventory Version', 'Channel Type', 'Channel Name', 'Presence State', 'Ownership Confidence', 'Evidence Source', 'Evidence Location', 'Captured At', 'Applicability', 'Role in Customer Journey'].forEach(function(field) { if (!String(record[field] || '').trim()) throw new Error('Assessment Presence requires ' + field + '.'); });
  if (FQ_PRESENCE_STATES.indexOf(String(record['Presence State'])) === -1) throw new Error('Invalid Presence State.');
  if (FQ_APPLICABILITY_STATES.indexOf(String(record.Applicability)) === -1) throw new Error('Invalid Applicability.');
  if (record['Presence State'] === 'Verified Present' && !String(record['Verified URL or Identifier'] || '').trim()) throw new Error('Verified Present requires an exact URL or identifier.');
  if ((record['Presence State'] === 'Verified Absent' || record['Presence State'] === 'Not Applicable') && (!options || !options.humanApproval || !String(record['Reviewed By'] || requireHumanReviewer_()).trim())) throw new Error('Verified Absent and Not Applicable require explicit human review.');
  if (record['Presence State'] === 'Not Verified' && record.Applicability === 'Applicable' && /absent|missing/i.test(String(record.Notes || ''))) throw new Error('Not Verified cannot be represented as verified absence.');
}

function validateAssessmentEvidenceRecord_(record) {
  const errors = [];
  ['Evidence ID', 'Prospect ID', 'Source Type', 'Evidence Location', 'Captured At', 'Capture Method', 'Confidence', 'Acquisition Version'].forEach(function(field) { if (!String(record[field] || '').trim()) errors.push('FQ_EVIDENCE_MISSING_' + machineFindingQuality_(field)); });
  if (!String(record['Evidence Excerpt'] || record['Observed Value'] || record['Test Result'] || '').trim()) errors.push('FQ_EVIDENCE_NO_OBSERVED_VALUE');
  const sourceType = String(record['Source Type'] || '');
  if (/Page Content|Element Inspection|Screenshot|Navigation|Form|Metadata/i.test(sourceType) && !String(record['Source URL'] || '').trim()) errors.push('FQ_EVIDENCE_URL_REQUIRED');
  if (/Owner Confirmed/i.test(sourceType) && (!/Owner Confirmed/i.test(String(record['Capture Method'] || '')) || !String(record.Limitations || '').trim())) errors.push('FQ_OWNER_CONFIRMED_CLASSIFICATION_REQUIRED');
  if (errors.length) throw new Error(errors.join('; '));
  return [];
}

function validateAssessmentFindingRecord_(record, options) {
  const get = function(sheetName, snapshotName) { return String(record[sheetName] != null ? record[sheetName] : record[snapshotName] || '').trim(); };
  const errors = [];
  const state = get('Finding State','findingState');
  const required = [['Finding ID','findingId'],['Prospect ID','prospectId'],['Finding Set ID','findingSetId'],['Finding Set Version','findingSetVersion'],['Category','category'],['Finding Title','findingTitle'],['Finding State','findingState'],['Business Objective','businessObjective'],['Evidence Location','evidenceLocation'],['Observation','observation'],['Business Consequence','businessConsequence'],['Evidence Confidence','evidenceConfidence'],['Evidence References','evidenceReferences']];
  if (state === 'Actionable') required.push(['Expected Condition','expectedCondition'],['Consequence Basis','consequenceBasis'],['Recommended Action','recommendedAction'],['Implementation Location','implementationLocation'],['Intended Outcome','intendedOutcome'],['Completion Test','completionTest'],['Recommendation ID','recommendationId']);
  if (state === 'Verified Strength') required.push(['Recommended Action','recommendedAction'],['Recommendation ID','recommendationId']);
  required.forEach(function(pair) { if (!get(pair[0], pair[1])) errors.push('FQ_FINDING_MISSING_' + machineFindingQuality_(pair[0])); });
  const observation = get('Observation','observation');
  const recommendation = get('Recommended Action','recommendedAction');
  const consequence = get('Business Consequence','businessConsequence');
  const completion = get('Completion Test','completionTest');
  const title = get('Finding Title','findingTitle');
  const evidenceLocation = get('Evidence Location','evidenceLocation');
  const refsValue = record['Evidence References'] != null ? record['Evidence References'] : record.evidenceReferences;
  const refs = Array.isArray(refsValue) ? refsValue.map(String) : parseFindingQualityList_(refsValue);
  if (isGenericFindingQualityText_(observation) || !hasSpecificFindingQualitySubject_(observation)) errors.push('FQ_FINDING_GENERIC_OBSERVATION');
  if (isGenericFindingQualityText_(consequence)) errors.push('FQ_FINDING_GENERIC_CONSEQUENCE');
  if ((state === 'Actionable' || state === 'Verified Strength') && findingQualitySimilarity_(observation, recommendation) >= 0.72) errors.push('FQ_RECOMMENDATION_REPEATS_OBSERVATION');
  if (state === 'Actionable' && (!hasFindingQualityAction_(recommendation) || !get('Implementation Location','implementationLocation'))) errors.push('FQ_RECOMMENDATION_NOT_EXECUTABLE');
  if (state === 'Actionable' && (!hasPassFailFindingQualityTest_(completion) || findingQualitySimilarity_(observation, completion) >= 0.72)) errors.push('FQ_COMPLETION_NOT_OBJECTIVE');
  if (!evidenceLocation || /score|tier|category|summary|notes/i.test(evidenceLocation) && !/url|page|profile|document|interview|call|system/i.test(evidenceLocation)) errors.push('FQ_EVIDENCE_LOCATION_INSUFFICIENT');
  if (!refs.length) errors.push('FQ_EVIDENCE_REFERENCES_REQUIRED');
  if (options && options.evidenceById && refs.some(function(id) { return !options.evidenceById[id]; })) errors.push('FQ_EVIDENCE_REFERENCE_UNRESOLVED');
  const confidence = Number(get('Evidence Confidence','evidenceConfidence'));
  if (!isFinite(confidence) || confidence < 0.6) errors.push('FQ_EVIDENCE_CONFIDENCE_LOW');
  if (/^(primary priority|supporting priority|business finding|priority improvement)$/i.test(title)) errors.push('FQ_PLACEHOLDER_TITLE');
  if (options && options.approvalRequired) {
    if (get('Approval Status','approvalStatus') !== FQ_APPROVED_STATUS || !get('Reviewed By','reviewedBy') || !get('Reviewed At','reviewedAt')) errors.push('FQ_HUMAN_APPROVAL_REQUIRED');
    const approvedVersion = get('Approved Version','approvedVersion');
    if (approvedVersion && approvedVersion !== get('Finding Set Version','findingSetVersion')) errors.push('FQ_APPROVED_VERSION_MISMATCH');
  }
  return Array.from(new Set(errors));
}

function assertFindingSetTransition_(from, to) {
  const allowed = FQ_SET_TRANSITIONS[from] || [];
  if (allowed.indexOf(to) === -1) throw new Error('Illegal finding-set transition: ' + from + ' -> ' + to + '.');
}

function assertDraftReviewTransition_(record, label) {
  if (String(record['Review Status'] || 'Draft') !== 'Draft') throw new Error(label + ' can be marked Reviewed only from Draft.');
}

function assertFindingTransition_(from, to) {
  const transitions = {
    'Not Reviewed': ['In Review'],
    'In Review': ['Needs Changes', 'Needs More Evidence', 'Rejected', FQ_APPROVED_STATUS],
    'Needs Changes': ['In Review', 'Rejected'],
    'Needs More Evidence': ['In Review', 'Rejected'],
    'Rejected': [],
    'Withdrawn': [],
    'Approved for Client': [],
    'Superseded': []
  };
  if (!transitions[from] || transitions[from].indexOf(to) === -1) {
    if (from === FQ_APPROVED_STATUS) throw new Error('Approved findings are immutable. Create a successor finding-set version.');
    throw new Error('Illegal finding transition from ' + from + ' to ' + to + '.');
  }
}

function persistApprovedFindingSetSnapshot_(company, payload, serialized) {
  const folder = getOrCreateAuditPackageFolder_(company);
  const snapshots = getExactChildFolderOrThrow_(folder, 'Finding Quality Snapshots') || folder.createFolder('Finding Quality Snapshots');
  const name = 'Finding Set ' + sanitizeDriveFileName_(payload.findingSetId) + ' v' + sanitizeDriveFileName_(payload.version) + '.json';
  const existing = snapshots.getFilesByName(name);
  if (existing.hasNext()) {
    const file = existing.next();
    if (existing.hasNext()) throw new Error('Multiple immutable snapshots exist for this finding-set version. Reconciliation is required.');
    if (file.getBlob().getDataAsString() !== serialized) throw new Error('A different immutable snapshot already exists for this finding-set version. Create a successor version.');
    return file;
  }
  return snapshots.createFile(Utilities.newBlob(serialized, 'application/json', name));
}

function findingQualitySnapshotFinding_(record) {
  return {
    findingId: String(record['Finding ID']), prospectId: String(record['Prospect ID']), findingSetId: String(record['Finding Set ID']), findingSetVersion: String(record['Finding Set Version']), category: String(record.Category), findingTitle: String(record['Finding Title']), findingState: String(record['Finding State']), channelType: String(record['Channel Type'] || ''), presenceState: String(record['Presence State'] || ''), customerJourneyStage: String(record['Customer Journey Stage'] || ''), businessObjective: String(record['Business Objective']), evidenceSource: String(record['Evidence Source']), evidenceLocation: String(record['Evidence Location']), evidenceObservedAt: findingQualityDateText_(record['Evidence Observed At']), evidenceExcerpt: String(record['Evidence Excerpt']), observation: String(record.Observation), expectedCondition: String(record['Expected Condition']), businessConsequence: String(record['Business Consequence']), consequenceBasis: String(record['Consequence Basis']), recommendedAction: String(record['Recommended Action']), implementationLocation: String(record['Implementation Location']), intendedOutcome: String(record['Intended Outcome']), completionTest: String(record['Completion Test']), evidenceConfidence: Number(record['Evidence Confidence']), evidenceReferences: parseFindingQualityList_(record['Evidence References']), limitations: parseFindingQualityList_(record.Limitations), recommendationId: String(record['Recommendation ID']), reviewedBy: String(record['Reviewed By']), reviewedAt: findingQualityDateText_(record['Reviewed At']), approvalStatus: String(record['Approval Status']), approvedVersion: String(record['Approved Version'])
  };
}

function findingQualitySnapshotPresence_(record) {
  return { presenceRecordId: String(record['Presence Record ID']), inventoryId: String(record['Inventory ID']), inventoryVersion: String(record['Inventory Version']), channelType: String(record['Channel Type']), channelName: String(record['Channel Name']), presenceState: String(record['Presence State']), verifiedUrlOrIdentifier: String(record['Verified URL or Identifier'] || ''), ownershipConfidence: String(record['Ownership Confidence']), evidenceSource: String(record['Evidence Source']), evidenceLocation: String(record['Evidence Location']), capturedAt: findingQualityDateText_(record['Captured At']), applicability: String(record.Applicability), roleInCustomerJourney: String(record['Role in Customer Journey']), limitations: parseFindingQualityList_(record.Limitations), reviewedBy: String(record['Reviewed By']), reviewedAt: findingQualityDateText_(record['Reviewed At']) };
}

function findingQualitySnapshotEvidence_(record) {
  return {
    evidenceId: String(record['Evidence ID']), prospectId: String(record['Prospect ID']),
    findingSetCandidateId: String(record['Finding Set Candidate ID'] || ''), candidateVersion: String(record['Candidate Version'] || ''),
    sourceType: String(record['Source Type']), sourceUrl: String(record['Source URL'] || ''), pageTitle: String(record['Page Title'] || ''), pagePath: String(record['Page Path'] || ''),
    elementType: String(record['Element Type'] || ''), elementLabel: String(record['Element Label'] || ''), evidenceLocation: String(record['Evidence Location']),
    capturedAt: findingQualityDateText_(record['Captured At']), captureMethod: String(record['Capture Method']), desktopMobileContext: String(record['Desktop/Mobile Context'] || ''),
    evidenceExcerpt: String(record['Evidence Excerpt'] || ''), observedValue: String(record['Observed Value'] || ''), screenshotReference: String(record['Screenshot Reference'] || ''),
    testPerformed: String(record['Test Performed'] || ''), testResult: String(record['Test Result'] || ''), confidence: Number(record.Confidence),
    limitations: parseFindingQualityList_(record.Limitations), rawArtifactReference: String(record['Raw Artifact Reference'] || ''), acquisitionVersion: String(record['Acquisition Version']),
    reviewStatus: String(record['Review Status']), reviewedBy: String(record['Reviewed By']), reviewedAt: findingQualityDateText_(record['Reviewed At'])
  };
}

function businessContextCanonicalProjection_(record) {
  return { prospectId: String(record['Prospect ID']), version: String(record.Version), primaryService: String(record['Primary Service']), targetCustomer: String(record['Target Customer']), serviceArea: String(record['Service Area']), desiredCustomerAction: String(record['Desired Customer Action']), primaryBusinessObjective: String(record['Primary Business Objective']), relevantConversionDestination: String(record['Relevant Conversion Destination'] || ''), knownConstraints: String(record['Known Constraints'] || ''), industryContext: String(record['Industry Context']), source: String(record.Source), reviewedBy: String(record['Reviewed By']), reviewedAt: findingQualityDateText_(record['Reviewed At']) };
}

function getSelectedFindingQualityActionRow_(actionName) {
  const action = FQ_OPERATOR_ACTIONS[actionName];
  if (!action) throw new Error('Unknown Finding Quality operator action.');
  return getSelectedFindingQualityRow_(action.sheetName, action.columns, action.idHeader);
}

function getSelectedFindingQualityRow_(sheetName, columns, idHeader) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== sheetName) throw new Error('Select one data row on ' + sheetName + '.');
  if (range.getNumRows() !== 1) throw new Error('Select one data row on ' + sheetName + '.');
  const row = range.getRow();
  if (row <= 1 || row > sheet.getLastRow()) throw new Error('Select one data row on ' + sheetName + '.');
  const table = ensureExactFindingQualityTable_(sheet, columns);
  const record = readFindingQualityRecord_(sheet, table, row);
  if (idHeader && !String(record[idHeader] || '').trim()) throw new Error('Select one valid data row on ' + sheetName + '.');
  return { ss: ss, sheet: sheet, table: table, row: row, record: record };
}

function readFindingQualityRecords_(sheet, table) {
  if (sheet.getLastRow() <= table.headerRow) return [];
  return sheet.getRange(table.headerRow + 1, 1, sheet.getLastRow() - table.headerRow, table.lastColumn).getValues().map(function(values) { return findingQualityRecordFromValues_(values, table); }).filter(function(record) { return Object.keys(record).some(function(key) { return String(record[key] || '').trim(); }); });
}

function readFindingQualityRecord_(sheet, table, row) { return findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, table.lastColumn).getValues()[0], table); }
function findingQualityRecordFromValues_(values, table) { const record = {}; Object.keys(table.headers).forEach(function(header) { record[header] = values[table.headers[header] - 1]; }); return record; }
function appendFindingQualityRecord_(sheet, table, record) { const values = new Array(table.lastColumn).fill(''); Object.keys(table.headers).forEach(function(header) { if (record[header] !== undefined) values[table.headers[header] - 1] = record[header]; }); sheet.appendRow(values); return sheet.getLastRow(); }
function writeFindingQualityRecord_(sheet, table, row, record) { const values = new Array(table.lastColumn).fill(''); Object.keys(table.headers).forEach(function(header) { values[table.headers[header] - 1] = record[header] === undefined ? '' : record[header]; }); sheet.getRange(row, 1, 1, table.lastColumn).setValues([values]); SpreadsheetApp.flush(); }
function findFindingQualityRows_(sheet, table, header, value) { return readFindingQualityRecords_(sheet, table).filter(function(record) { return String(record[header]) === String(value); }); }

function requireHumanReviewer_() {
  const reviewer = String(Session.getActiveUser().getEmail() || '').trim();
  if (!reviewer) throw new Error('Human approval requires an authenticated operator identity.');
  return reviewer;
}

function getFindingQualityProspectId_(prospect) { const value = prospect && (prospect.prospectId || prospect.id || prospect['Prospect ID'] || (prospect.prospect && (prospect.prospect.prospectId || prospect.prospect['Prospect ID']))); return String(value || '').trim(); }
function getFindingQualityCompany_(ss, prospectId) { const sheet = ss.getSheetByName(MASTER_PROSPECT_SHEET); if (!sheet) return 'Assessment'; const table = getHeaderTable_(sheet, ['Prospect ID', 'Company']); const records = sheet.getRange(table.headerRow + 1, 1, Math.max(sheet.getLastRow() - table.headerRow, 0), table.lastColumn).getValues(); const match = records.filter(function(values) { return String(getValueByHeader_(values, table.headers, 'Prospect ID')) === prospectId; }); if (match.length !== 1) throw new Error('Finding set must resolve one exact prospect.'); return String(getValueByHeader_(match[0], table.headers, 'Company') || 'Assessment'); }
function createFindingQualityId_(prefix) { return prefix + '-' + Utilities.getUuid(); }
function parseFindingQualityList_(value) { if (Array.isArray(value)) return value.map(String).map(function(item) { return item.trim(); }).filter(Boolean); return String(value || '').split(/[\n,;]+/).map(function(item) { return item.trim(); }).filter(Boolean); }
function findingQualityDateText_(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }
function machineFindingQuality_(value) { return String(value || '').trim().replace(/[^A-Za-z0-9]+(.)?/g, function(_match, next) { return next ? next.toUpperCase() : ''; }).replace(/^./, function(first) { return first.toLowerCase(); }); }
function stableStringifyFindingQuality_(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(stableStringifyFindingQuality_).join(',') + ']'; return '{' + Object.keys(value).sort().map(function(key) { return JSON.stringify(key) + ':' + stableStringifyFindingQuality_(value[key]); }).join(',') + '}'; }
function fingerprintFindingQualityValue_(value) { return fingerprintFindingQualityText_(stableStringifyFindingQuality_(value)); }
function fingerprintFindingQualityText_(text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join(''); }
function findingQualityWords_(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function(word) { return word.length > 2; }); }
function findingQualitySimilarity_(left, right) { const a = Array.from(new Set(findingQualityWords_(left))); const b = Array.from(new Set(findingQualityWords_(right))); if (!a.length || !b.length) return 0; const intersection = a.filter(function(word) { return b.indexOf(word) !== -1; }).length; return intersection / Math.max(a.length, b.length); }
function isGenericFindingQualityText_(value) { const text = String(value || '').trim(); if (text.length < 28) return true; return /^(the business(?! snapshot\b)|the company|this (?:verified )?finding|this may affect|visibility improvements|clearer messaging|improve online presence|may affect customer clarity|may be losing online opportunities)/i.test(text) || /\b(some|various|a few|could help|may improve|opportunities)\b/i.test(text) && findingQualityWords_(text).length < 14; }
function hasSpecificFindingQualitySubject_(value) { return /\b(page|profile|form|button|link|phone|email|address|hours|service|offer|navigation|hero|heading|field|process|workflow|referral|booking|marketplace|location|destination|document|record)\b/i.test(String(value || '')); }
function hasFindingQualityAction_(value) { return /\b(add|remove|replace|publish|update|configure|connect|route|display|standardize|clarify|verify|test|document|reconcile|create|correct|move|repeat|link|assign)\b/i.test(String(value || '')); }
function hasPassFailFindingQualityTest_(value) { return /\b(verify|confirm|test|must|can|matches|resolves|displays|reaches|returns|contains|working|consistent|one click|pass|fail)\b/i.test(String(value || '')) && /\b(page|profile|form|button|link|phone|email|address|destination|record|channel|desktop|mobile|customer|visitor|field|path)\b/i.test(String(value || '')); }

function handleFindingQualityEdit_(e) {
  if (!e || !e.range) return false;
  const sheet = e.range.getSheet();
  const protectedSheets = [FQ_CONTEXT_SHEET, FQ_PRESENCE_SHEET, FQ_EVIDENCE_SHEET, FQ_FINDINGS_SHEET, FQ_FINDING_SETS_SHEET];
  if (protectedSheets.indexOf(sheet.getName()) === -1 || e.range.getRow() <= 1) return false;
  const definitions = {};
  definitions[FQ_CONTEXT_SHEET] = FQ_CONTEXT_COLUMNS;
  definitions[FQ_PRESENCE_SHEET] = FQ_PRESENCE_COLUMNS;
  definitions[FQ_EVIDENCE_SHEET] = FQ_EVIDENCE_COLUMNS;
  definitions[FQ_FINDINGS_SHEET] = FQ_FINDING_COLUMNS;
  definitions[FQ_FINDING_SETS_SHEET] = FQ_FINDING_SET_COLUMNS;
  const table = ensureExactFindingQualityTable_(sheet, definitions[sheet.getName()]);
  const record = readFindingQualityRecord_(sheet, table, e.range.getRow());
  if (isFindingQualityRecordFrozen_(e.source || SpreadsheetApp.getActiveSpreadsheet(), sheet.getName(), record)) {
    if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1 && e.oldValue !== undefined) {
      e.range.setValue(e.oldValue);
      SpreadsheetApp.flush();
    }
    SpreadsheetApp.getUi().alert('Approved Analysis Is Immutable', 'This record supports an approved finding-set snapshot. Its edit was rejected. Create a successor finding-set version and edit the successor records.', SpreadsheetApp.getUi().ButtonSet.OK);
    return true;
  }
  return true;
}

function isFindingQualityRecordFrozen_(ss, sheetName, record) {
  const setSheet = ss.getSheetByName(FQ_FINDING_SETS_SHEET);
  if (!setSheet) return false;
  const sets = readFindingQualityRecords_(setSheet, ensureExactFindingQualityTable_(setSheet, FQ_FINDING_SET_COLUMNS)).filter(function(set) { return String(set['Approval Status']) === FQ_APPROVED_STATUS; });
  if (sheetName === FQ_FINDING_SETS_SHEET) return String(record['Approval Status']) === FQ_APPROVED_STATUS;
  if (sheetName === FQ_FINDINGS_SHEET) return sets.some(function(set) { return String(set['Finding Set ID']) === String(record['Finding Set ID']) && String(set.Version) === String(record['Finding Set Version']); });
  if (sheetName === FQ_CONTEXT_SHEET) return sets.some(function(set) { return String(set['Prospect ID']) === String(record['Prospect ID']) && String(set['Business Context Version']) === String(record.Version); });
  if (sheetName === FQ_PRESENCE_SHEET) return sets.some(function(set) { return String(set['Prospect ID']) === String(record['Prospect ID']) && String(set['Presence Inventory Version']) === String(record['Inventory Version']); });
  if (sheetName === FQ_EVIDENCE_SHEET) return sets.some(function(set) { return String(set['Finding Set ID']) === String(record['Finding Set Candidate ID']) && String(set.Version) === String(record['Candidate Version']) && parseFindingQualityList_(set['Evidence References']).indexOf(String(record['Evidence ID'])) !== -1; });
  return false;
}

function protectApprovedFindingQualityRows_(bundle, selectedSet) {
  const ss = selectedSet.ss;
  const targets = [
    [FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS, function(record) { return String(record['Prospect ID']) === String(bundle.set['Prospect ID']) && String(record.Version) === String(bundle.set['Business Context Version']); }],
    [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS, function(record) { return String(record['Prospect ID']) === String(bundle.set['Prospect ID']) && String(record['Inventory Version']) === String(bundle.set['Presence Inventory Version']); }],
    [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS, function(record) { return bundle.evidence.some(function(item) { return String(item['Evidence ID']) === String(record['Evidence ID']); }); }],
    [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS, function(record) { return String(record['Finding Set ID']) === String(bundle.set['Finding Set ID']) && String(record['Finding Set Version']) === String(bundle.set.Version); }],
    [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS, function(record) { return String(record['Finding Set ID']) === String(bundle.set['Finding Set ID']) && String(record['Finding Set Version']) === String(bundle.set.Version); }]
  ];
  targets.forEach(function(target) {
    const sheet = ss.getSheetByName(target[0]);
    const table = ensureExactFindingQualityTable_(sheet, target[1]);
    for (let row = 2; row <= sheet.getLastRow(); row += 1) {
      if (target[2](readFindingQualityRecord_(sheet, table, row))) sheet.getRange(row, 1, 1, table.lastColumn).protect().setDescription('Immutable approved Finding Quality record').setWarningOnly(true);
    }
  });
  selectedSet.sheet.getRange(selectedSet.row, 1, 1, selectedSet.table.lastColumn).protect().setDescription('Immutable approved Finding Quality set').setWarningOnly(true);
}
