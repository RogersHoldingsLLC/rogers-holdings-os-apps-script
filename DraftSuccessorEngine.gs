/**
 * Transactional seeding for an existing Draft Finding Set successor.
 * This workflow never reviews, approves, snapshots, previews, or renders.
 */

var FQ_DRAFT_SUCCESSOR_OPERATION_PREFIX = 'FQDRAFTSUCCESSOR';

function buildFindingQualityDraftSuccessorOperationKey_(prospectId, findingSetId, sourceVersion, targetVersion) {
  return [FQ_DRAFT_SUCCESSOR_OPERATION_PREFIX, prospectId, findingSetId, sourceVersion, targetVersion].join(':');
}

function fq1PlainLanguageDraftSuccessorRequest_() {
  return {
    findingSetId: 'FSET-WEBGBP-1', sourceVersion: '1', targetVersion: '2',
    expectedSourceFingerprint: '5f5ed13f329fe13878b4546fc16ab0bc88ef83e6787af510315dfd5f3fd28645',
    expectedSourceApprovedAt: '2026-08-14T02:11:31.325Z',
    evidenceReferences: ['EVID-WEB-1'],
    expectedEvidence: { 'EVID-WEB-1': { 'Test Result': 'No direct route to inquiry form', Limitations: 'Fictional public-page evidence' } },
    context: {
      'Primary Service': 'Home electrical repair', 'Target Customer': 'Homeowners who need planned electrical work',
      'Service Area': 'Acceptance County', 'Desired Customer Action': 'Send a service request',
      'Primary Business Objective': 'Get more service requests from the right customers',
      'Relevant Conversion Destination': 'https://fixture-web-gbp.example/request',
      'Known Constraints': 'Do not claim emergency service', 'Industry Context': 'Local service'
    },
    presence: [
      { channelType: 'Website', channelName: 'Website', role: 'Helps customers learn about services and ask for help', limitations: '' },
      { channelType: 'Google Business Profile', channelName: 'Google Business Profile', role: 'Helps local customers find and identify the business', limitations: 'We only checked that the listing exists. We did not review it in depth.' }
    ],
    finding: {
      findingId: 'FND-VALID-1-V2', recommendationId: 'REC-VALID-1-V2', category: 'Website Navigation',
      title: 'The Services page menu needs a Request Service link', channelType: 'Website', presenceState: 'Verified Present',
      customerJourneyStage: 'Asking for service', businessObjective: 'Get more service requests from the right customers',
      evidenceSource: 'Element Inspection', evidenceLocation: 'Services page primary navigation',
      evidenceExcerpt: 'No direct route to inquiry form', observation: 'The Services page menu has no Request Service link.',
      expectedCondition: 'A customer should reach the request form from the Services page menu.',
      consequence: 'A customer must search for the request form.', consequenceBasis: 'The Services page menu has no direct link to the request form.',
      recommendation: 'Add a Request Service link to the Services page menu. Point it to the approved request form.',
      implementationLocation: 'Services page menu template', intendedOutcome: 'Customers can open the request form without searching.',
      completionTest: 'Test the link on a phone and a computer. It should open the request form in one click.',
      confidence: 0.95, limitations: 'Form submission not tested.'
    },
    recommendation: { title: 'The Services page menu needs a Request Service link', dependencies: 'Confirm the request form web address. Get access to the Services page menu template. Choose who will make the change.' },
    action: {
      actionId: 'ACT-REC-VALID-1-V2', sequence: 1, title: 'Add the Request Service link',
      implementationPath: 'Add the link in the Services page menu template.',
      ownership: 'FQ-1 Fixture Electrical LLC chooses who will make the change. Outside help needs separate approval.',
      dependencies: 'Confirm the request form web address. Get access to the Services page menu template. Choose who will make the change.'
    }
  };
}

function seedSelectedPlainLanguageDraftSuccessor() {
  const selected = getSelectedFindingQualityActionRow_('seedDraftSuccessor');
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Seed Draft Successor', 'Type SEED DRAFT V2 exactly. This creates Draft records only.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== 'SEED DRAFT V2') throw new Error('Draft successor seeding cancelled.');
  const result = seedFindingQualityDraftSuccessor_(selected, fq1PlainLanguageDraftSuccessorRequest_());
  ui.alert('Draft Successor', result.status === 'already-completed' ? 'This Draft successor was already seeded. No records changed.' : 'Draft v2 records were seeded. Review status remains Draft.', ui.ButtonSet.OK);
  return result;
}

function seedFindingQualityDraftSuccessor_(selected, request, hooks) {
  hooks = hooks || {};
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return seedFindingQualityDraftSuccessorLocked_(selected, request, hooks); }
  finally { lock.releaseLock(); }
}

function seedFindingQualityDraftSuccessorLocked_(selected, request, hooks) {
  const ss = selected.ss;
  const set = selected.record;
  const sourceVersion = String(request.sourceVersion);
  const targetVersion = String(request.targetVersion);
  if (String(set['Finding Set ID']) !== String(request.findingSetId) || String(set.Version) !== targetVersion || String(set['Review Status']) !== 'Draft' || String(set['Approval Status']) !== 'Not Reviewed' || String(set['Document Eligibility']) !== 'Not Eligible' || String(set['Supersedes Version']) !== sourceVersion) throw new Error('Selected Finding Set is not the expected Draft successor.');
  const prospectId = String(set['Prospect ID']);
  const operationKey = buildFindingQualityDraftSuccessorOperationKey_(prospectId, request.findingSetId, sourceVersion, targetVersion);
  const schema = getExistingFindingQualityDraftSuccessorSchema_(ss);
  const setRecords = readFindingQualityRecords_(selected.sheet, selected.table);
  const sourceMatches = setRecords.filter(function(item) { return String(item['Finding Set ID']) === String(request.findingSetId) && String(item.Version) === sourceVersion; });
  if (sourceMatches.length !== 1) throw new Error('Exactly one source Finding Set is required.');
  const source = sourceMatches[0];
  if (String(source['Approval Status']) !== FQ_APPROVED_STATUS || String(source['Document Eligibility']) !== 'Eligible' || String(source['Immutable Hash']) !== String(request.expectedSourceFingerprint) || findingQualityDateText_(source['Approved At']) !== String(request.expectedSourceApprovedAt) || !String(source['Snapshot File ID']).trim() || !String(source['Finding IDs']).trim() || !String(source['Evidence References']).trim()) throw new Error('Approved source Finding Set baseline differs from the expected state.');
  const approvedSource = loadApprovedFindingSetForGeneration_({ prospectId: prospectId }, { approvedFindingSetReference: { findingSetId: request.findingSetId, version: sourceVersion, fingerprint: request.expectedSourceFingerprint, approvalStatus: FQ_APPROVED_STATUS } });

  const evidenceSheet = schema[FQ_EVIDENCE_SHEET].sheet;
  const evidenceTable = schema[FQ_EVIDENCE_SHEET].table;
  const evidenceRecords = readFindingQualityRecords_(evidenceSheet, evidenceTable);
  const evidence = resolveFindingQualityEvidenceReferences_(evidenceRecords, request.evidenceReferences, prospectId, request.findingSetId);
  assertFindingQualityEvidenceMatchesApprovedSnapshot_(evidence, approvedSource && approvedSource.reviewedInput && approvedSource.reviewedInput.evidence);
  evidence.forEach(function(record) {
    const expected = request.expectedEvidence[String(record['Evidence ID'])];
    if (!expected || String(record['Test Result']) !== expected['Test Result'] || String(record.Limitations) !== expected.Limitations) throw new Error('Immutable evidence differs from the approved reuse contract: ' + record['Evidence ID'] + '.');
  });
  const evidenceHashes = evidence.map(function(record) { return fingerprintFindingQualityValue_(findingQualityEvidenceImmutableProjection_(record)); });

  const marker = 'Operation ' + operationKey;
  if (String(set.Notes || '').indexOf(marker) !== -1) {
    verifyCompletedFindingQualityDraftSuccessor_(schema, set, request, operationKey, evidenceHashes);
    return { ok: true, status: 'already-completed', operationKey: operationKey };
  }

  const sourceContexts = readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table).filter(function(item) { return String(item['Prospect ID']) === prospectId && String(item.Version) === sourceVersion; });
  if (sourceContexts.length !== 1) throw new Error('Exactly one source Business Context is required.');
  const sourcePresence = readFindingQualityRecords_(schema[FQ_PRESENCE_SHEET].sheet, schema[FQ_PRESENCE_SHEET].table).filter(function(item) { return String(item['Prospect ID']) === prospectId && String(item['Inventory Version']) === sourceVersion; });
  if (!sourcePresence.length) throw new Error('Source Presence Inventory is missing.');

  const context = Object.assign({}, sourceContexts[0], request.context, { 'Context ID': 'CTX-' + fingerprintFindingQualityText_(operationKey).slice(0, 16), Version: targetVersion, Source: 'Owner-proposed plain-language Draft successor', 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', Fingerprint: '' });
  const inventoryId = 'INV-' + fingerprintFindingQualityText_(operationKey).slice(0, 16);
  const presence = request.presence.map(function(proposal, index) {
    const sourceRecord = sourcePresence.filter(function(item) { return String(item['Channel Type']) === String(proposal.channelType); });
    if (sourceRecord.length !== 1) throw new Error('Exactly one source Presence record is required for ' + proposal.channelType + '.');
    return Object.assign({}, sourceRecord[0], { 'Presence Record ID': 'PRES-' + fingerprintFindingQualityText_(operationKey + ':' + index).slice(0, 16), 'Inventory ID': inventoryId, 'Inventory Version': targetVersion, 'Channel Name': proposal.channelName, 'Role in Customer Journey': proposal.role, Limitations: proposal.limitations, Notes: '', 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '' });
  });
  const f = request.finding;
  const finding = {
    'Finding ID': f.findingId, 'Prospect ID': prospectId, 'Finding Set ID': request.findingSetId, 'Finding Set Version': targetVersion,
    Category: f.category, 'Finding Title': f.title, 'Finding State': 'Draft', 'Channel Type': f.channelType, 'Presence State': f.presenceState,
    'Customer Journey Stage': f.customerJourneyStage, 'Business Objective': f.businessObjective, 'Evidence Source': f.evidenceSource,
    'Evidence Location': f.evidenceLocation, 'Evidence Observed At': evidence[0]['Captured At'], 'Evidence Excerpt': f.evidenceExcerpt,
    Observation: f.observation, 'Expected Condition': f.expectedCondition, 'Business Consequence': f.consequence,
    'Consequence Basis': f.consequenceBasis, 'Recommended Action': f.recommendation, 'Implementation Location': f.implementationLocation,
    'Intended Outcome': f.intendedOutcome, 'Completion Test': f.completionTest, 'Evidence Confidence': f.confidence,
    'Evidence References': request.evidenceReferences.join(', '), Limitations: f.limitations, 'Recommendation ID': f.recommendationId,
    'Reviewed By': '', 'Reviewed At': '', 'Approval Status': 'Not Reviewed', 'Approved Version': '', 'Validation Codes': ''
  };
  const recommendation = { 'Recommendation ID': f.recommendationId, 'Prospect ID': prospectId, 'Finding Set ID': request.findingSetId, 'Finding Set Version': targetVersion, 'Finding ID': f.findingId, Title: request.recommendation.title, 'Recommended Action': f.recommendation, 'Implementation Location': f.implementationLocation, 'Intended Outcome': f.intendedOutcome, Dependencies: request.recommendation.dependencies, 'Review Status': 'Draft', 'Operation Key': operationKey };
  const action = { 'Action ID': request.action.actionId, 'Prospect ID': prospectId, 'Finding Set ID': request.findingSetId, 'Finding Set Version': targetVersion, 'Recommendation ID': f.recommendationId, Sequence: request.action.sequence, Title: request.action.title, 'Implementation Path': request.action.implementationPath, Ownership: request.action.ownership, Dependencies: request.action.dependencies, 'Completion Test': f.completionTest, 'Review Status': 'Draft', 'Operation Key': operationKey };

  validateBusinessContextRecord_(context);
  presence.forEach(function(record) { validateAssessmentPresenceRecord_(record, { humanApproval: false }); });
  const findingErrors = validateAssessmentFindingRecord_(finding, { approvalRequired: false });
  if (findingErrors.length) throw new Error('Draft finding validation failed: ' + findingErrors.join('; '));
  assertPlainLanguageFindingSetForApproval_({ findings: [finding] });
  validateDraftRecommendationAndAction_(recommendation, action, finding);
  assertNoFindingQualityDraftSuccessorConflicts_(schema, context, presence, finding, recommendation, action, operationKey);

  const added = [];
  const setBefore = selected.sheet.getRange(selected.row, 1, 1, selected.table.lastColumn).getValues()[0];
  try {
    added.push([schema[FQ_CONTEXT_SHEET], appendFindingQualityRecord_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table, context), 'Context ID', context['Context ID']]);
    presence.forEach(function(record) { added.push([schema[FQ_PRESENCE_SHEET], appendFindingQualityRecord_(schema[FQ_PRESENCE_SHEET].sheet, schema[FQ_PRESENCE_SHEET].table, record), 'Presence Record ID', record['Presence Record ID']]); });
    added.push([schema[FQ_FINDINGS_SHEET], appendFindingQualityRecord_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, finding), 'Finding ID', finding['Finding ID']]);
    added.push([schema[FQ_RECOMMENDATIONS_SHEET], appendFindingQualityRecord_(schema[FQ_RECOMMENDATIONS_SHEET].sheet, schema[FQ_RECOMMENDATIONS_SHEET].table, recommendation), 'Recommendation ID', recommendation['Recommendation ID']]);
    added.push([schema[FQ_ACTIONS_SHEET], appendFindingQualityRecord_(schema[FQ_ACTIONS_SHEET].sheet, schema[FQ_ACTIONS_SHEET].table, action), 'Action ID', action['Action ID']]);
    if (hooks.afterChildWrites) hooks.afterChildWrites();
    const updated = Object.assign({}, set, { 'Business Context Version': targetVersion, 'Presence Inventory Version': targetVersion, 'Evidence References': request.evidenceReferences.join(', '), 'Finding IDs': finding['Finding ID'], Notes: [String(set.Notes || '').trim(), marker, 'Evidence SHA-256 ' + evidenceHashes.join(',')].filter(Boolean).join('\n') });
    writeFindingQualityRecord_(selected.sheet, selected.table, selected.row, updated);
    verifyCompletedFindingQualityDraftSuccessor_(schema, updated, request, operationKey, evidenceHashes);
    return { ok: true, status: 'completed', operationKey: operationKey, contextId: context['Context ID'], inventoryId: inventoryId, findingId: f.findingId, recommendationId: f.recommendationId, actionId: action['Action ID'], evidenceReferences: request.evidenceReferences.slice() };
  } catch (error) {
    try {
      selected.sheet.getRange(selected.row, 1, 1, selected.table.lastColumn).setValues([setBefore]);
      added.reverse().forEach(function(item) { deleteExactOperationOwnedFindingQualityRow_(item[0], item[2], item[3]); });
      SpreadsheetApp.flush();
    } catch (rollbackError) { throw new Error('Draft successor failed and rollback could not be verified: ' + rollbackError.message); }
    throw error;
  }
}

function getExistingFindingQualityDraftSuccessorSchema_(ss) {
  const definitions = [[FQ_CONTEXT_SHEET, FQ_CONTEXT_COLUMNS], [FQ_PRESENCE_SHEET, FQ_PRESENCE_COLUMNS], [FQ_EVIDENCE_SHEET, FQ_EVIDENCE_COLUMNS], [FQ_FINDINGS_SHEET, FQ_FINDING_COLUMNS], [FQ_RECOMMENDATIONS_SHEET, FQ_RECOMMENDATION_COLUMNS], [FQ_ACTIONS_SHEET, FQ_ACTION_COLUMNS], [FQ_FINDING_SETS_SHEET, FQ_FINDING_SET_COLUMNS]];
  const schema = {};
  definitions.forEach(function(definition) {
    const sheet = ss.getSheetByName(definition[0]);
    if (!sheet) throw new Error('Draft successor seeding requires the normalized sheet "' + definition[0] + '". Run Set Up Finding Quality Foundation first.');
    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
    if (headers.length < definition[1].length || definition[1].some(function(header, index) {
      if (definition[0] === FQ_RECOMMENDATIONS_SHEET && header === 'Limitations' && !headers[index]) return false;
      if (definition[0] === FQ_RECOMMENDATIONS_SHEET && ['Reviewed By', 'Reviewed At', 'Review Operation Key'].indexOf(header) !== -1 && !headers[index]) return false;
      if (definition[0] === FQ_FINDINGS_SHEET && header === 'Approval Operation Key' && !headers[index]) return false;
      return headers[index] !== header;
    })) throw new Error('Draft successor schema differs from the approved contract on "' + definition[0] + '".');
    const headerMap = {};
    definition[1].forEach(function(header, index) { headerMap[header] = index + 1; });
    schema[definition[0]] = { sheet: sheet, table: { headerRow: 1, headers: headerMap, lastColumn: definition[1].length } };
  });
  return schema;
}

function assertFindingQualityEvidenceMatchesApprovedSnapshot_(records, snapshotEvidence) {
  const snapshot = [].concat(snapshotEvidence || []);
  records.forEach(function(record) {
    const id = String(record['Evidence ID']);
    const matches = snapshot.filter(function(item) { return String(item.evidenceId || item.key) === id; });
    if (matches.length !== 1) throw new Error('Approved snapshot evidence is missing or ambiguous: ' + id + '.');
    const local = canonicalizeFindingQualityEvidenceForReuse_(findingQualitySnapshotEvidence_(record));
    const remote = canonicalizeFindingQualityEvidenceForReuse_(matches[0]);
    if (stableStringifyFindingQuality_(local) !== stableStringifyFindingQuality_(remote)) throw new Error('Evidence no longer matches the approved immutable snapshot: ' + id + '.');
  });
}

function canonicalizeFindingQualityEvidenceForReuse_(value) {
  const item = value || {};
  return {
    evidenceId: String(item.evidenceId || ''), prospectId: String(item.prospectId || ''),
    findingSetCandidateId: String(item.findingSetCandidateId || ''), candidateVersion: String(item.candidateVersion || ''),
    sourceType: String(item.sourceType || ''), sourceUrl: String(item.sourceUrl || ''), pageTitle: String(item.pageTitle || ''), pagePath: String(item.pagePath || ''),
    elementType: String(item.elementType || ''), elementLabel: String(item.elementLabel || ''), evidenceLocation: String(item.evidenceLocation || ''),
    capturedAt: findingQualityDateText_(item.capturedAt), captureMethod: String(item.captureMethod || ''), desktopMobileContext: String(item.desktopMobileContext || ''),
    evidenceExcerpt: String(item.evidenceExcerpt || ''), observedValue: String(item.observedValue || ''), screenshotReference: String(item.screenshotReference || ''),
    testPerformed: String(item.testPerformed || ''), testResult: String(item.testResult || ''), confidence: Number(item.confidence),
    limitations: parseFindingQualityList_(item.limitations), rawArtifactReference: String(item.rawArtifactReference || ''), acquisitionVersion: String(item.acquisitionVersion || ''),
    reviewStatus: String(item.reviewStatus || ''), reviewedBy: String(item.reviewedBy || ''), reviewedAt: findingQualityDateText_(item.reviewedAt)
  };
}

function validateDraftRecommendationAndAction_(recommendation, action, finding) {
  ['Recommendation ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Finding ID', 'Title', 'Recommended Action', 'Implementation Location', 'Intended Outcome'].forEach(function(field) { if (!String(recommendation[field] || '').trim()) throw new Error('Draft Recommendation requires ' + field + '.'); });
  ['Action ID', 'Prospect ID', 'Finding Set ID', 'Finding Set Version', 'Recommendation ID', 'Sequence', 'Title', 'Implementation Path', 'Ownership', 'Dependencies', 'Completion Test'].forEach(function(field) { if (!String(action[field] || '').trim()) throw new Error('Draft Action requires ' + field + '.'); });
  if (String(recommendation['Finding ID']) !== String(finding['Finding ID']) || String(action['Recommendation ID']) !== String(recommendation['Recommendation ID']) || String(action['Completion Test']) !== String(finding['Completion Test'])) throw new Error('Draft recommendation/action lineage is invalid.');
  assertPlainLanguageFindingSetForApproval_({ findings: [{ 'Finding Title': action.Title, Observation: action['Implementation Path'], 'Expected Condition': action.Ownership, 'Business Consequence': action.Dependencies, 'Consequence Basis': '', 'Recommended Action': recommendation['Recommended Action'], 'Implementation Location': recommendation['Implementation Location'], 'Intended Outcome': recommendation['Intended Outcome'], 'Completion Test': action['Completion Test'] }] });
}

function assertNoFindingQualityDraftSuccessorConflicts_(schema, context, presence, finding, recommendation, action, operationKey) {
  [[FQ_CONTEXT_SHEET, 'Context ID', context['Context ID']], [FQ_FINDINGS_SHEET, 'Finding ID', finding['Finding ID']], [FQ_RECOMMENDATIONS_SHEET, 'Recommendation ID', recommendation['Recommendation ID']], [FQ_ACTIONS_SHEET, 'Action ID', action['Action ID']]].concat(presence.map(function(item) { return [FQ_PRESENCE_SHEET, 'Presence Record ID', item['Presence Record ID']]; })).forEach(function(spec) {
    const entry = schema[spec[0]];
    if (findFindingQualityRows_(entry.sheet, entry.table, spec[1], spec[2]).length) throw new Error('Draft successor record already exists without a completed operation: ' + spec[2] + '.');
  });
  [recommendation, action].forEach(function(item) { if (String(item['Operation Key']) !== operationKey) throw new Error('Draft successor operation key mismatch.'); });
}

function verifyCompletedFindingQualityDraftSuccessor_(schema, set, request, operationKey, evidenceHashes) {
  const checks = [[FQ_CONTEXT_SHEET, 'Version', request.targetVersion, 1], [FQ_PRESENCE_SHEET, 'Inventory Version', request.targetVersion, request.presence.length], [FQ_FINDINGS_SHEET, 'Finding ID', request.finding.findingId, 1], [FQ_RECOMMENDATIONS_SHEET, 'Recommendation ID', request.finding.recommendationId, 1], [FQ_ACTIONS_SHEET, 'Action ID', request.action.actionId, 1]];
  checks.forEach(function(spec) { const matches = findFindingQualityRows_(schema[spec[0]].sheet, schema[spec[0]].table, spec[1], spec[2]).filter(function(item) { return String(item['Prospect ID']) === String(set['Prospect ID']); }); if (matches.length !== spec[3]) throw new Error('Completed Draft successor verification failed for ' + spec[0] + '.'); });
  if (String(set['Business Context Version']) !== String(request.targetVersion) || String(set['Presence Inventory Version']) !== String(request.targetVersion) || String(set['Evidence References']) !== request.evidenceReferences.join(', ') || String(set['Finding IDs']) !== request.finding.findingId || String(set.Notes || '').indexOf('Operation ' + operationKey) === -1 || String(set.Notes || '').indexOf('Evidence SHA-256 ' + evidenceHashes.join(',')) === -1 || String(set['Review Status']) !== 'Draft' || String(set['Approval Status']) !== 'Not Reviewed') throw new Error('Completed Draft Finding Set linkage is invalid.');
}

function deleteExactOperationOwnedFindingQualityRow_(entry, idHeader, id) {
  const matches = [];
  for (let row = 2; row <= entry.sheet.getLastRow(); row += 1) if (String(readFindingQualityRecord_(entry.sheet, entry.table, row)[idHeader]) === String(id)) matches.push(row);
  if (matches.length !== 1) throw new Error('Operation-owned rollback target is missing or ambiguous: ' + id + '.');
  entry.sheet.deleteRow(matches[0]);
}
