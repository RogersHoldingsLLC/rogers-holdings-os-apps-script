/** Transactional replacement of an incomplete approved Finding before set review/snapshot. */
var FQ_PRE_SNAPSHOT_CONFIRMATION = 'CREATE PRE-SNAPSHOT CORRECTION';
var FQ_PRE_SNAPSHOT_PREFIX = 'FQPRESNAPSHOTRECOVERY';
var FQ_PRE_SNAPSHOT_STATE = 'Superseded Pre-Snapshot';
var FQ_PRE_SNAPSHOT_FINDING_FIELDS = ['Superseded By Finding ID', 'Superseded By', 'Superseded At', 'Supersession Operation Key', 'Supersedes Finding ID'];
var FQ_PRE_SNAPSHOT_RECOMMENDATION_FIELDS = ['Superseded By Recommendation ID', 'Supersedes Recommendation ID'];

function createPreSnapshotCorrectionDraft() {
  const selected = requireSelectedPreSnapshotFinding_();
  const ui = SpreadsheetApp.getUi();
  const expectedCondition = promptRequiredFindingDraftValue_(ui, 'Expected condition', 'Enter the approved expected condition.');
  const consequenceBasis = promptRequiredFindingDraftValue_(ui, 'Consequence basis', 'Enter the approved evidence-based consequence explanation.');
  const businessConsequence = promptRequiredFindingDraftValue_(ui, 'Business consequence', 'Enter the approved plain-language business consequence.');
  const recommendedAction = promptRequiredFindingDraftValue_(ui, 'Recommended action', 'Enter the approved recommended action.');
  const completionTest = promptRequiredFindingDraftValue_(ui, 'Completion test', 'Enter the approved objective completion test.');
  const confirmation = ui.prompt('Create Pre-Snapshot Correction Draft', 'Type ' + FQ_PRE_SNAPSHOT_CONFIRMATION + ' exactly. The approved Finding and Reviewed Recommendation remain historical records.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== FQ_PRE_SNAPSHOT_CONFIRMATION) throw new Error('Pre-snapshot correction cancelled.');
  const result = createPreSnapshotCorrectionDraft_(selected, { expectedCondition: expectedCondition, consequenceBasis: consequenceBasis, businessConsequence: businessConsequence, recommendedAction: recommendedAction, completionTest: completionTest }, {});
  ui.alert('Pre-Snapshot Correction', result.status === 'already-completed' ? 'This correction Draft already exists and was verified. No records changed.' : 'The replacement Finding and successor Recommendation are Draft. The Finding Set remains Draft and ineligible.', ui.ButtonSet.OK);
  return result;
}

function requireSelectedPreSnapshotFinding_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_FINDINGS_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) throw new Error('Select exactly one approved Finding data row on ' + FQ_FINDINGS_SHEET + '.');
  const required = FQ_FINDING_COLUMNS.filter(function(header) { return FQ_PRE_SNAPSHOT_FINDING_FIELDS.indexOf(header) === -1; });
  const table = getHeaderTable_(sheet, required);
  const record = findingQualityRecordFromValues_(sheet.getRange(range.getRow(), 1, 1, table.lastColumn).getValues()[0], table);
  if (!String(record['Finding ID'] || '').trim() || !String(record['Prospect ID'] || '').trim()) throw new Error('The selected row requires exact Finding ID and Prospect ID values.');
  return { ss: ss, sheet: sheet, table: table, row: range.getRow(), record: record };
}

function createPreSnapshotCorrectionDraft_(selected, candidate, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return createPreSnapshotCorrectionDraftLocked_(selected, candidate || {}, hooks || {}); }
  finally { lock.releaseLock(); }
}

function createPreSnapshotCorrectionDraftLocked_(selected, candidate, hooks) {
  const schema = getPreSnapshotRecoverySchema_(selected.ss);
  const findingEntry = schema[FQ_FINDINGS_SHEET];
  const matches = readFindingQualityRecordsWithRows_(findingEntry).filter(function(record) { return String(record['Finding ID']) === String(selected.record['Finding ID']); });
  if (matches.length !== 1 || String(matches[0]['Prospect ID']) !== String(selected.record['Prospect ID'])) throw new Error('The selected approved Finding is missing, ambiguous, or changed.');
  const originalFinding = matches[0];
  const set = requirePreSnapshotDraftSet_(schema, originalFinding);
  const originalRecommendation = requirePreSnapshotReviewedRecommendation_(schema, originalFinding);
  const authority = resolveRecommendationDraftAuthority_(schema, originalFinding);
  assertPreSnapshotAuthority_(schema, originalFinding, originalRecommendation, authority, set);
  const approved = normalizePreSnapshotCandidate_(candidate);
  const identity = buildPreSnapshotRecoveryIdentity_(originalFinding, originalRecommendation, authority, approved);
  const existingReplacement = readFindingQualityRecordsWithRows_(findingEntry).filter(function(record) { return String(record['Finding ID']) === identity.findingId; });
  const existingSuccessor = readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(record) { return String(record['Recommendation ID']) === identity.recommendationId; });
  if (String(originalFinding['Supersession Operation Key'] || '') === identity.operationKey || existingReplacement.length || existingSuccessor.length) {
    assertCompletedPreSnapshotRecovery_(schema, originalFinding, originalRecommendation, set, approved, identity);
    return { ok: true, status: 'already-completed', operationKey: identity.operationKey, findingId: identity.findingId, recommendationId: identity.recommendationId };
  }
  if (String(originalFinding['Finding State']) !== 'Actionable' || String(originalFinding['Approval Status']) !== FQ_APPROVED_STATUS || String(originalFinding['Approved Version']) !== String(originalFinding['Finding Set Version'])) throw new Error('Pre-snapshot recovery requires the selected incomplete Approved for Client Finding.');
  if (['Superseded By Finding ID','Superseded By','Superseded At','Supersession Operation Key'].some(function(field){return String(originalFinding[field]||'').trim();})||String(originalRecommendation['Superseded By Recommendation ID']||'').trim())throw new Error('Selected authority already contains unresolved forward supersession metadata.');
  const staged = buildPreSnapshotRecords_(originalFinding, originalRecommendation, approved, identity);
  validatePreSnapshotStagedRecords_(staged, originalFinding, originalRecommendation, authority);
  const findingSetIds = parseFindingQualityList_(set['Finding IDs']);
  if (findingSetIds.filter(function(id) { return id === String(originalFinding['Finding ID']); }).length !== 1) throw new Error('Finding Set must reference the selected Finding exactly once.');
  const updatedSet = Object.assign({}, set, { 'Finding IDs': findingSetIds.map(function(id) { return id === String(originalFinding['Finding ID']) ? identity.findingId : id; }).join(', ') });
  const operator = String(requireHumanReviewer_()).trim().toLowerCase();
  const now = new Date();
  const updatedOriginalFinding = Object.assign({}, originalFinding, { 'Finding State': FQ_PRE_SNAPSHOT_STATE, 'Superseded By Finding ID': identity.findingId, 'Superseded By': operator, 'Superseded At': now, 'Supersession Operation Key': identity.operationKey });
  const updatedOriginalRecommendation = Object.assign({}, originalRecommendation, { 'Superseded By Recommendation ID': identity.recommendationId });
  [updatedOriginalFinding, updatedOriginalRecommendation, staged.finding, staged.recommendation, updatedSet].forEach(function(record) { delete record._row; });
  const snapshots = snapshotPreSnapshotTransaction_(schema, originalFinding, originalRecommendation, set);
  const created = [];
  try {
    ensurePreSnapshotSheetCapacity_(schema, snapshots);
    completePreSnapshotTransactionSnapshot_(schema, snapshots);
    if (hooks.afterCapacityExpansion) hooks.afterCapacityExpansion();
    migratePreSnapshotSchema_(schema);
    if (hooks.afterHeaderInstallation) hooks.afterHeaderInstallation();
    writeFindingQualityRecord_(findingEntry.sheet, findingEntry.table, originalFinding._row, updatedOriginalFinding);
    if (hooks.afterOriginalFinding) hooks.afterOriginalFinding();
    writeFindingQualityRecord_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, originalRecommendation._row, updatedOriginalRecommendation);
    const findingRow = appendFindingQualityRecord_(findingEntry.sheet, findingEntry.table, staged.finding); created.push([findingEntry, findingRow, 'Finding ID', identity.findingId]);
    if (hooks.afterReplacementFinding) hooks.afterReplacementFinding();
    const recommendationRow = appendFindingQualityRecord_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, staged.recommendation); created.push([schema[FQ_RECOMMENDATIONS_SHEET], recommendationRow, 'Recommendation ID', identity.recommendationId]);
    writeFindingQualityRecord_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table, set._row, updatedSet);
    if (hooks.afterFindingSet) hooks.afterFindingSet();
    SpreadsheetApp.flush();
    assertCompletedPreSnapshotRecovery_(schema, updatedOriginalFinding, updatedOriginalRecommendation, updatedSet, approved, identity);
    return { ok: true, status: 'completed', operationKey: identity.operationKey, findingId: identity.findingId, recommendationId: identity.recommendationId };
  } catch (error) {
    const limitations = rollbackPreSnapshotRecovery_(schema, snapshots, created);
    if (limitations.length) throw new Error(error.message + ' Rollback preserved allocated columns because ownership was ambiguous: ' + limitations.join('; '));
    throw error;
  }
}

function normalizePreSnapshotCandidate_(candidate) {
  const normalize = function(value) { return String(value || '').trim().replace(/\s+/g, ' '); };
  const result = { expectedCondition: normalize(candidate.expectedCondition), consequenceBasis: normalize(candidate.consequenceBasis), businessConsequence: normalize(candidate.businessConsequence), recommendedAction: normalize(candidate.recommendedAction), completionTest: normalize(candidate.completionTest) };
  Object.keys(result).forEach(function(field) { if (!result[field]) throw new Error('Pre-snapshot correction requires approved ' + field + '.'); });
  return result;
}

function buildPreSnapshotRecoveryIdentity_(finding, recommendation, authority, candidate) {
  return buildCanonicalPreSnapshotRecoveryIdentity_(finding, recommendation, authority, candidate);
}

function buildPreSnapshotRecords_(finding, recommendation, candidate, identity) {
  const replacement = {};
  FQ_FINDING_COLUMNS.forEach(function(field) { replacement[field] = finding[field] === undefined ? '' : finding[field]; });
  Object.assign(replacement, { 'Finding ID': identity.findingId, 'Finding State': 'Draft', 'Expected Condition': candidate.expectedCondition, 'Business Consequence': candidate.businessConsequence, 'Consequence Basis': candidate.consequenceBasis, 'Recommended Action': candidate.recommendedAction, 'Implementation Location': recommendation['Implementation Location'], 'Intended Outcome': recommendation['Intended Outcome'], 'Completion Test': candidate.completionTest, 'Recommendation ID': identity.recommendationId, 'Reviewed By': '', 'Reviewed At': '', 'Approval Status': 'Not Reviewed', 'Approved Version': '', 'Validation Codes': '', 'Approval Operation Key': '', 'Superseded By Finding ID': '', 'Superseded By': '', 'Superseded At': '', 'Supersession Operation Key': '', 'Supersedes Finding ID': finding['Finding ID'] });
  const successor = {};
  FQ_RECOMMENDATION_COLUMNS.forEach(function(field) { successor[field] = recommendation[field] === undefined ? '' : recommendation[field]; });
  Object.assign(successor, { 'Recommendation ID': identity.recommendationId, 'Finding ID': identity.findingId, 'Recommended Action': candidate.recommendedAction, 'Review Status': 'Draft', 'Operation Key': identity.operationKey + ':RECOMMENDATION', 'Reviewed By': '', 'Reviewed At': '', 'Review Operation Key': '', 'Superseded By Recommendation ID': '', 'Supersedes Recommendation ID': recommendation['Recommendation ID'] });
  return { finding: replacement, recommendation: successor };
}

function validatePreSnapshotStagedRecords_(staged, originalFinding, originalRecommendation, authority) {
  const actionable = Object.assign({}, staged.finding, { 'Finding State': 'Actionable', 'Approval Status': FQ_APPROVED_STATUS, 'Approved Version': staged.finding['Finding Set Version'], 'Reviewed By': 'staged-human-review', 'Reviewed At': 'staged-human-review' });
  const evidenceById = {}; authority.evidence.forEach(function(item) { evidenceById[String(item['Evidence ID'])] = item; });
  const errors = validateAssessmentFindingRecord_(actionable, { approvalRequired: true, evidenceById: evidenceById });
  if (errors.length) throw new Error('Replacement Finding is not eligible for later review: ' + errors.join('; '));
  const languageErrors=validatePlainLanguageFindingFields_(staged.finding);if(languageErrors.length)throw new Error('Replacement Finding fails plain-language validation: '+languageErrors.join('; '));
  validateStandaloneDraftRecommendation_(staged.recommendation, staged.finding);
  ['Title','Implementation Location','Intended Outcome','Dependencies','Limitations'].forEach(function(field){if(findingQualityDateText_(staged.recommendation[field])!==findingQualityDateText_(originalRecommendation[field]))throw new Error('Successor Recommendation differs at '+field+'.');});
  FQ_FINDING_COLUMNS.filter(function(field) { return ['Finding ID','Finding State','Expected Condition','Business Consequence','Consequence Basis','Recommended Action','Implementation Location','Intended Outcome','Completion Test','Recommendation ID','Reviewed By','Reviewed At','Approval Status','Approved Version','Validation Codes','Approval Operation Key','Supersedes Finding ID'].indexOf(field) === -1 && FQ_PRE_SNAPSHOT_FINDING_FIELDS.indexOf(field) === -1; }).forEach(function(field) { if (findingQualityDateText_(staged.finding[field]) !== findingQualityDateText_(originalFinding[field])) throw new Error('Replacement Finding changed authority at ' + field + '.'); });
}

function requirePreSnapshotDraftSet_(schema, finding) {
  const rows = readFindingQualityRecordsWithRows_(schema[FQ_FINDING_SETS_SHEET]).filter(function(record) { return String(record['Finding Set ID']) === String(finding['Finding Set ID']) && String(record.Version) === String(finding['Finding Set Version']); });
  if (rows.length !== 1) throw new Error('Pre-snapshot Finding Set is missing or ambiguous.');
  const set = rows[0];
  const returned=String(set['Return Operation Key']||'').indexOf('FQSETRETURN:')===0;
  if(String(set['Review Status'])!=='Draft'||String(set['Approval Status'])!=='Not Reviewed'||String(set['Document Eligibility'])!=='Not Eligible'||String(set['Reviewed By']||set['Reviewed At']||set['Approved At']||set['Immutable Hash']||set['Snapshot File ID']).trim())throw new Error('Pre-snapshot recovery requires an unsnapshotted Draft Finding Set.');
  if(String(finding['Supersedes Finding ID']||'').trim()&&!returned)throw new Error('A manually returned Draft Finding Set is not correction authority.');
  if(returned)assertReturnedFindingSet_(set,String(set['Return Operation Key']));
  return set;
}

function requirePreSnapshotReviewedRecommendation_(schema, finding) {
  const rows = readFindingQualityRecordsWithRows_(schema[FQ_RECOMMENDATIONS_SHEET]).filter(function(record) { return String(record['Recommendation ID']) === String(finding['Recommendation ID']); });
  if (rows.length !== 1) throw new Error('Reviewed Recommendation is missing or ambiguous.');
  const record = rows[0];
  if (String(record['Review Status']) !== 'Reviewed' || !String(record['Reviewed By'] || '').trim() || !String(record['Reviewed At'] || '').trim() || !String(record['Review Operation Key'] || '').trim() || String(record['Prospect ID']) !== String(finding['Prospect ID']) || String(record['Finding ID']) !== String(finding['Finding ID']) || String(record['Finding Set ID']) !== String(finding['Finding Set ID']) || String(record['Finding Set Version']) !== String(finding['Finding Set Version'])) throw new Error('Reviewed Recommendation authority is invalid.');
  return record;
}

function assertPreSnapshotAuthority_(schema, finding, recommendation, authority, set) {
  if (readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table).some(function(record) { return String(record['Prospect ID']) === String(finding['Prospect ID']); })) throw new Error('Pre-snapshot recovery is blocked by an existing Action.');
  if (String(set['Snapshot File ID'] || set['Immutable Hash'] || '').trim() || String(set['Document Eligibility']) !== 'Not Eligible') throw new Error('Pre-snapshot recovery is blocked by downstream immutable authority.');
  const candidate = normalizeRecommendationDraftCandidate_({ title: recommendation.Title, recommendedAction: recommendation['Recommended Action'], implementationLocation: recommendation['Implementation Location'], intendedOutcome: recommendation['Intended Outcome'], dependencies: recommendation.Dependencies, limitations: recommendation.Limitations });
  try { assertRecommendationSeedIdentity_(schema, finding, recommendation, authority, candidate); }
  catch (error) { throw new Error('Reviewed Recommendation wording or authority changed: ' + error.message); }
}

function getPreSnapshotRecoverySchema_(ss) {
  const definitions = [[FQ_CONTEXT_SHEET,FQ_CONTEXT_COLUMNS],[FQ_PRESENCE_SHEET,FQ_PRESENCE_COLUMNS],[FQ_EVIDENCE_SHEET,FQ_EVIDENCE_COLUMNS],[FQ_FINDINGS_SHEET,FQ_FINDING_COLUMNS],[FQ_RECOMMENDATIONS_SHEET,FQ_RECOMMENDATION_COLUMNS],[FQ_ACTIONS_SHEET,FQ_ACTION_COLUMNS],[FQ_FINDING_SETS_SHEET,FQ_FINDING_SET_COLUMNS]];
  const schema = {};
  definitions.forEach(function(definition) {
    const sheet = ss.getSheetByName(definition[0]); if (!sheet) throw new Error('Pre-snapshot recovery requires ' + definition[0] + '.');
    const last = Math.max(sheet.getLastColumn(), 1); const headers = sheet.getRange(1,1,1,last).getDisplayValues()[0].map(function(value){return String(value||'').trim();}); const map={}; const missing=[];
    definition[1].forEach(function(header){const positions=headers.map(function(value,index){return value===header?index+1:0;}).filter(Boolean);if(positions.length>1)throw new Error('Ambiguous pre-snapshot header: '+header+'.');if(!positions.length){const allowed=definition[0]===FQ_FINDINGS_SHEET?FQ_PRE_SNAPSHOT_FINDING_FIELDS:definition[0]===FQ_RECOMMENDATIONS_SHEET?FQ_PRE_SNAPSHOT_RECOMMENDATION_FIELDS:definition[0]===FQ_FINDING_SETS_SHEET?FQ_SET_RETURN_FIELDS:[];if(allowed.indexOf(header)===-1)throw new Error('Missing pre-snapshot header: '+header+'.');missing.push(header);}else map[header]=positions[0];});
    missing.forEach(function(header,index){map[header]=last+index+1;}); schema[definition[0]]={sheet:sheet,table:{headerRow:1,headers:map,lastColumn:last+missing.length},missingHeaders:missing,originalLastColumn:last,originalMaxColumns:sheet.getMaxColumns(),requiredLastColumn:last+missing.length,columnsToAdd:Math.max(0,last+missing.length-sheet.getMaxColumns()),addedColumns:0};
  });
  return schema;
}

function ensurePreSnapshotSheetCapacity_(schema, snapshots) {
  [FQ_FINDINGS_SHEET,FQ_RECOMMENDATIONS_SHEET].forEach(function(name){
    const entry=schema[name];
    const current=entry.sheet.getMaxColumns();
    const needed=Math.max(0,entry.requiredLastColumn-current);
    if(needed){entry.sheet.insertColumnsAfter(current,needed);entry.addedColumns=needed;}
    if(entry.sheet.getMaxColumns()<entry.requiredLastColumn)throw new Error(name+' capacity expansion did not allocate required column '+entry.requiredLastColumn+'.');
    snapshots.dimensions[name].addedColumns=needed;
  });
}

function migratePreSnapshotSchema_(schema) {
  [schema[FQ_FINDINGS_SHEET], schema[FQ_RECOMMENDATIONS_SHEET]].forEach(function(entry){entry.missingHeaders.forEach(function(header){const column=entry.table.headers[header];entry.sheet.getRange(1,Math.max(entry.originalLastColumn,1),entry.sheet.getMaxRows(),1).copyTo(entry.sheet.getRange(1,column,entry.sheet.getMaxRows(),1),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);entry.sheet.getRange(1,column).setValue(header);});});
  const entry=schema[FQ_FINDINGS_SHEET]; const range=entry.sheet.getRange(2,entry.table.headers['Finding State'],Math.max(entry.sheet.getMaxRows()-1,1),1); const rule=SpreadsheetApp.newDataValidation().requireValueInList(FQ_FINDING_STATES,true).setAllowInvalid(false).build(); range.setDataValidation(rule);
}

function snapshotPreSnapshotTransaction_(schema, finding, recommendation, set) {
  const dimensions={};[FQ_FINDINGS_SHEET,FQ_RECOMMENDATIONS_SHEET].forEach(function(name){const entry=schema[name];dimensions[name]={maxRows:entry.sheet.getMaxRows(),maxColumns:entry.sheet.getMaxColumns(),addedColumns:0};});
  return { findingRow:null,recommendationRow:null,setRow:schema[FQ_FINDING_SETS_SHEET].sheet.getRange(set._row,1,1,schema[FQ_FINDING_SETS_SHEET].table.lastColumn).getValues()[0],findingRowNumber:finding._row,recommendationRowNumber:recommendation._row,setRowNumber:set._row,findingValidation:schema[FQ_FINDINGS_SHEET].sheet.getRange(2,schema[FQ_FINDINGS_SHEET].table.headers['Finding State'],Math.max(schema[FQ_FINDINGS_SHEET].sheet.getMaxRows()-1,1),1).getDataValidations(),dimensions:dimensions,columnContracts:{},rowsReady:false};
}

function completePreSnapshotTransactionSnapshot_(schema, snapshots) {
  snapshots.findingRow=schema[FQ_FINDINGS_SHEET].sheet.getRange(snapshots.findingRowNumber,1,1,schema[FQ_FINDINGS_SHEET].table.lastColumn).getValues()[0];
  snapshots.recommendationRow=schema[FQ_RECOMMENDATIONS_SHEET].sheet.getRange(snapshots.recommendationRowNumber,1,1,schema[FQ_RECOMMENDATIONS_SHEET].table.lastColumn).getValues()[0];
  [FQ_FINDINGS_SHEET,FQ_RECOMMENDATIONS_SHEET].forEach(function(name){const entry=schema[name];snapshots.columnContracts[name]=entry.missingHeaders.map(function(header){const column=entry.table.headers[header];return {header:header,column:column,preExisting:column<=snapshots.dimensions[name].maxColumns,contract:capturePreSnapshotRangeContract_(entry.sheet.getRange(1,column,entry.sheet.getMaxRows(),1)),width:entry.sheet.getColumnWidth(column),hidden:entry.sheet.isColumnHiddenByUser(column)};});});
  snapshots.rowsReady=true;
}

function capturePreSnapshotRangeContract_(range) {
  const contract={values:range.getValues(),dataValidations:range.getDataValidations()};
  [['getNumberFormats','numberFormats'],['getBackgrounds','backgrounds'],['getFontColors','fontColors'],['getFontFamilies','fontFamilies'],['getFontLines','fontLines'],['getFontSizes','fontSizes'],['getFontStyles','fontStyles'],['getFontWeights','fontWeights'],['getHorizontalAlignments','horizontalAlignments'],['getVerticalAlignments','verticalAlignments'],['getWrapStrategies','wrapStrategies'],['getNotes','notes']].forEach(function(pair){if(typeof range[pair[0]]==='function')contract[pair[1]]=range[pair[0]]();});
  return contract;
}

function restorePreSnapshotRangeContract_(range, contract) {
  range.setValues(contract.values);range.setDataValidations(contract.dataValidations);
  [['numberFormats','setNumberFormats'],['backgrounds','setBackgrounds'],['fontColors','setFontColors'],['fontFamilies','setFontFamilies'],['fontLines','setFontLines'],['fontSizes','setFontSizes'],['fontStyles','setFontStyles'],['fontWeights','setFontWeights'],['horizontalAlignments','setHorizontalAlignments'],['verticalAlignments','setVerticalAlignments'],['wrapStrategies','setWrapStrategies'],['notes','setNotes']].forEach(function(pair){if(contract[pair[0]]!==undefined&&typeof range[pair[1]]==='function')range[pair[1]](contract[pair[0]]);});
}

function rollbackPreSnapshotRecovery_(schema, snapshots, created) {
  created.slice().reverse().forEach(function(item){const record=readFindingQualityRecord_(item[0].sheet,item[0].table,item[1]);if(String(record[item[2]])!==String(item[3]))throw new Error('Rollback target is not operation-owned.');item[0].sheet.deleteRow(item[1]);});
  if(snapshots.rowsReady){schema[FQ_FINDINGS_SHEET].sheet.getRange(snapshots.findingRowNumber,1,1,snapshots.findingRow.length).setValues([snapshots.findingRow]);schema[FQ_RECOMMENDATIONS_SHEET].sheet.getRange(snapshots.recommendationRowNumber,1,1,snapshots.recommendationRow.length).setValues([snapshots.recommendationRow]);}
  schema[FQ_FINDING_SETS_SHEET].sheet.getRange(snapshots.setRowNumber,1,1,snapshots.setRow.length).setValues([snapshots.setRow]);schema[FQ_FINDINGS_SHEET].sheet.getRange(2,schema[FQ_FINDINGS_SHEET].table.headers['Finding State'],snapshots.findingValidation.length,1).setDataValidations(snapshots.findingValidation);
  const limitations=rollbackPreSnapshotCapacity_(schema,snapshots);SpreadsheetApp.flush();return limitations;
}

function rollbackPreSnapshotCapacity_(schema,snapshots){const limitations=[];[FQ_RECOMMENDATIONS_SHEET,FQ_FINDINGS_SHEET].forEach(function(name){const entry=schema[name],dimension=snapshots.dimensions[name],contracts=snapshots.columnContracts[name]||[];contracts.filter(function(item){return item.preExisting;}).forEach(function(item){const range=entry.sheet.getRange(1,item.column,entry.sheet.getMaxRows(),1);restorePreSnapshotRangeContract_(range,item.contract);entry.sheet.setColumnWidth(item.column,item.width);if(item.hidden)entry.sheet.hideColumns(item.column);else entry.sheet.showColumns(item.column);});if(!dimension.addedColumns)return;const start=dimension.maxColumns+1;if(entry.sheet.getMaxColumns()!==dimension.maxColumns+dimension.addedColumns){limitations.push(name+' dimensions changed concurrently');return;}const values=entry.sheet.getRange(1,start,entry.sheet.getMaxRows(),dimension.addedColumns).getDisplayValues();const owned=values.every(function(row,rowIndex){return row.every(function(value,index){if(!String(value||'').trim())return true;if(rowIndex!==0)return false;const header=entry.missingHeaders.filter(function(item){return entry.table.headers[item]===start+index;})[0];return String(value)===String(header||'');});});if(owned)entry.sheet.deleteColumns(start,dimension.addedColumns);else{entry.missingHeaders.forEach(function(header){const column=entry.table.headers[header];if(column>=start&&String(entry.sheet.getRange(1,column).getDisplayValue()||'')===header)entry.sheet.getRange(1,column).clearContent();});limitations.push(name+' operation-created columns contain unowned data');}});return limitations;}

function assertCompletedPreSnapshotRecovery_(schema, originalFinding, originalRecommendation, set, candidate, identity) {
  const findings=readFindingQualityRecords_(schema[FQ_FINDINGS_SHEET].sheet,schema[FQ_FINDINGS_SHEET].table), recommendations=readFindingQualityRecords_(schema[FQ_RECOMMENDATIONS_SHEET].sheet,schema[FQ_RECOMMENDATIONS_SHEET].table);
  const original=findings.filter(function(r){return String(r['Finding ID'])===String(originalFinding['Finding ID']);}), replacement=findings.filter(function(r){return String(r['Finding ID'])===identity.findingId;}), oldRec=recommendations.filter(function(r){return String(r['Recommendation ID'])===String(originalRecommendation['Recommendation ID']);}), successor=recommendations.filter(function(r){return String(r['Recommendation ID'])===identity.recommendationId;});
  if(original.length!==1||replacement.length!==1||oldRec.length!==1||successor.length!==1)throw new Error('Pre-snapshot recovery readback is missing or ambiguous.');
  if(String(original[0]['Finding State'])!==FQ_PRE_SNAPSHOT_STATE||String(original[0]['Approval Status'])!==FQ_APPROVED_STATUS||String(original[0]['Superseded By Finding ID'])!==identity.findingId||String(original[0]['Supersession Operation Key'])!==identity.operationKey)throw new Error('Original Finding history readback failed.');
  if(String(oldRec[0]['Review Status'])!=='Reviewed'||String(oldRec[0]['Superseded By Recommendation ID'])!==identity.recommendationId)throw new Error('Original Recommendation history readback failed.');
  if(String(replacement[0]['Finding State'])!=='Draft'||String(replacement[0]['Approval Status'])!=='Not Reviewed'||String(replacement[0]['Supersedes Finding ID'])!==String(originalFinding['Finding ID'])||String(replacement[0]['Expected Condition'])!==candidate.expectedCondition||String(replacement[0]['Consequence Basis'])!==candidate.consequenceBasis||String(replacement[0]['Completion Test'])!==candidate.completionTest)throw new Error('Replacement Finding readback failed.');
  if(String(successor[0]['Review Status'])!=='Draft'||String(successor[0]['Supersedes Recommendation ID'])!==String(originalRecommendation['Recommendation ID'])||String(successor[0]['Finding ID'])!==identity.findingId)throw new Error('Successor Recommendation readback failed.');
  const currentSets=readFindingQualityRecords_(schema[FQ_FINDING_SETS_SHEET].sheet,schema[FQ_FINDING_SETS_SHEET].table).filter(function(r){return String(r['Finding Set ID'])===String(set['Finding Set ID'])&&String(r.Version)===String(set.Version);});
  if(currentSets.length!==1||parseFindingQualityList_(currentSets[0]['Finding IDs']).indexOf(identity.findingId)===-1||parseFindingQualityList_(currentSets[0]['Finding IDs']).indexOf(String(originalFinding['Finding ID']))!==-1||String(currentSets[0]['Review Status'])!=='Draft'||String(currentSets[0]['Document Eligibility'])!=='Not Eligible')throw new Error('Finding Set membership readback failed.');
  if(readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet,schema[FQ_ACTIONS_SHEET].table).some(function(r){return String(r['Prospect ID'])===String(originalFinding['Prospect ID']);}))throw new Error('Recovery created a prohibited Action.');
}
