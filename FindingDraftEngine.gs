/**
 * Transactional first Draft Finding creation from one Reviewed Evidence row.
 * Creates the minimum required Draft Finding Set and Draft Finding only.
 */

var FQ_FINDING_DRAFT_CONFIRMATION = 'SEED FINDING DRAFT';
var FQ_FINDING_DRAFT_OPERATION_PREFIX = 'FQFINDINGDRAFT';
var FQ_FINDING_DRAFT_CATEGORIES = ['Website Conversion / Customer Journey', 'Contact Path / Lead Capture', 'Service / Offer Clarity', 'Geographic / Service-Area Clarity', 'Credibility / Trust Signals', 'Basic On-Page SEO / Local Relevance', 'Owned Presence Foundation'];

function seedReviewedEvidenceFindingDraft() {
  const selected = requireSelectedReviewedEvidenceForFinding_();
  const ui = SpreadsheetApp.getUi();
  const title = promptRequiredFindingDraftValue_(ui, 'Finding title', 'Enter the factual finding title.');
  const observation = promptRequiredFindingDraftValue_(ui, 'Observed condition', 'Enter what the reviewed evidence and owner confirmation show.');
  const consequence = promptRequiredFindingDraftValue_(ui, 'Business impact', 'Enter the supported business impact. Do not enter revenue, scores, severity, or priority.');
  const category = promptRequiredFindingDraftValue_(ui, 'Supported category', 'Enter one supported category exactly:\n' + FQ_FINDING_DRAFT_CATEGORIES.join('\n'));
  const confidence = promptRequiredFindingDraftValue_(ui, 'Evidence confidence', 'Enter a decimal from 0.60 through 1.00.');
  const confirmation = ui.prompt('Seed Reviewed Evidence Finding Draft', 'Type ' + FQ_FINDING_DRAFT_CONFIRMATION + ' exactly. This creates one Draft Finding Set and one Draft Finding.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK || confirmation.getResponseText() !== FQ_FINDING_DRAFT_CONFIRMATION) throw new Error('Finding Draft seeding cancelled.');
  const result = seedFindingQualityReviewedEvidenceDraft_(selected, { title: title, observation: observation, consequence: consequence, category: category, confidence: confidence }, {});
  ui.alert('Finding Draft', result.status === 'already-completed' ? 'This Finding Draft was already seeded. No records changed.' : 'One Draft Finding Set and one Draft Finding were seeded. Review both before any lifecycle action.', ui.ButtonSet.OK);
  return result;
}

function promptRequiredFindingDraftValue_(ui, title, message) {
  const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) throw new Error('Finding Draft seeding cancelled.');
  const value = String(response.getResponseText() || '').trim();
  if (!value) throw new Error(title + ' is required.');
  return value;
}

function requireSelectedReviewedEvidenceForFinding_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_EVIDENCE_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) throw new Error('Select exactly one data row on ' + FQ_EVIDENCE_SHEET + '.');
  const table = getHeaderTable_(sheet, FQ_EVIDENCE_COLUMNS);
  const row = range.getRow();
  if (row > sheet.getLastRow()) throw new Error('Select exactly one data row on ' + FQ_EVIDENCE_SHEET + '.');
  const record = findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, table.lastColumn).getValues()[0], table);
  if (!String(record['Evidence ID'] || '').trim()) throw new Error('The selected Evidence row has no exact Evidence ID.');
  return { ss: ss, sheet: sheet, table: table, row: row, record: record };
}

function seedFindingQualityReviewedEvidenceDraft_(selected, candidate, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return seedFindingQualityReviewedEvidenceDraftLocked_(selected, candidate || {}, hooks || {}); }
  finally { lock.releaseLock(); }
}

function seedFindingQualityReviewedEvidenceDraftLocked_(selected, candidate, hooks) {
  const schema = getExistingFindingQualityDraftSuccessorSchema_(selected.ss);
  const selectedEvidence = assertSelectedReviewedEvidenceStillExact_(selected, schema);
  const prospectId = String(selectedEvidence['Prospect ID']);
  const authority = resolveReviewedFindingDraftAuthority_(schema, prospectId, selectedEvidence);
  const normalized = normalizeFindingDraftCandidate_(candidate);
  const authorityHash = fingerprintFindingQualityValue_({
    context: businessContextCanonicalProjection_(authority.context),
    presence: reviewedPresenceEvidenceProjection_(authority.presence),
    evidence: authority.evidence.map(findingDraftEvidenceAuthorityProjection_)
  });
  const candidateHash = fingerprintFindingQualityValue_(normalized);
  const operationKey = [FQ_FINDING_DRAFT_OPERATION_PREFIX, selectedEvidence['Evidence ID'], authorityHash.slice(0, 16), candidateHash.slice(0, 16)].join(':');
  const findingSetId = 'FSET-' + fingerprintFindingQualityText_(operationKey + ':SET').slice(0, 16);
  const findingId = 'FND-' + fingerprintFindingQualityText_(operationKey + ':FINDING').slice(0, 16);
  const version = '1';
  authority.evidence.forEach(function(record) {
    const linkedSet = String(record['Finding Set Candidate ID'] || '');
    const linkedVersion = String(record['Candidate Version'] || '');
    if ((linkedSet || linkedVersion) && (linkedSet !== findingSetId || linkedVersion !== version)) throw new Error('Reviewed Evidence is already linked to another Finding Set.');
  });
  const operator = requireHumanReviewer_();
  const marker = 'Operation ' + operationKey;
  const setEntry = schema[FQ_FINDING_SETS_SHEET];
  const findingEntry = schema[FQ_FINDINGS_SHEET];
  const existingSets = readFindingQualityRecords_(setEntry.sheet, setEntry.table);
  const existingFindings = readFindingQualityRecords_(findingEntry.sheet, findingEntry.table);
  const operationSets = existingSets.filter(function(record) { return String(record.Notes || '').indexOf(marker) !== -1; });
  const operationFindings = existingFindings.filter(function(record) { return String(record['Validation Codes'] || '').indexOf('FQ_FINDING_DRAFT_OPERATION=' + operationKey) !== -1; });
  if (operationSets.length || operationFindings.length) {
    assertCompletedReviewedEvidenceFindingDraft_(schema, authority, normalized, operationKey, findingSetId, findingId);
    return { ok: true, status: 'already-completed', operationKey: operationKey, findingSetId: findingSetId, findingId: findingId, evidenceReferences: authority.evidence.map(function(record) { return record['Evidence ID']; }) };
  }
  assertNoFindingDraftConflicts_(schema, prospectId, findingSetId, findingId);

  const createdAt = new Date();
  const refs = authority.evidence.map(function(record) { return String(record['Evidence ID']); });
  const finding = buildReviewedEvidenceDraftFinding_(authority, normalized, { operationKey: operationKey, findingSetId: findingSetId, findingId: findingId, version: version });
  const set = buildReviewedEvidenceDraftFindingSet_(authority, { operationKey: operationKey, findingSetId: findingSetId, findingId: findingId, version: version, operator: operator, createdAt: createdAt, evidenceReferences: refs });
  const evidenceById = {};
  authority.evidence.forEach(function(record) { evidenceById[String(record['Evidence ID'])] = record; });
  const findingErrors = validateAssessmentFindingRecord_(finding, { approvalRequired: false, evidenceById: evidenceById });
  if (findingErrors.length) throw new Error('Draft Finding validation failed: ' + findingErrors.join('; '));
  validateInitialDraftFindingSet_(set, authority, finding);

  const evidenceBefore = authority.evidence.map(function(record) { const copy = Object.assign({}, record); delete copy._row; return copy; });
  const added = [];
  let evidenceLinked = false;
  try {
    authority.evidence.forEach(function(record) {
      const linked = Object.assign({}, record, { 'Finding Set Candidate ID': findingSetId, 'Candidate Version': version });
      writeFindingQualityRecord_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table, record._row, linked);
    });
    evidenceLinked = true;
    if (hooks.afterEvidenceLink) hooks.afterEvidenceLink();
    added.push([setEntry, appendFindingQualityRecord_(setEntry.sheet, setEntry.table, set), 'Finding Set ID', findingSetId]);
    if (hooks.afterWrite) hooks.afterWrite(1, set);
    added.push([findingEntry, appendFindingQualityRecord_(findingEntry.sheet, findingEntry.table, finding), 'Finding ID', findingId]);
    if (hooks.afterWrite) hooks.afterWrite(2, finding);
    assertExactReviewedEvidenceFindingDraftReadback_(schema, authority, set, finding, operationKey);
    assertNoFindingDraftSideEffects_(schema, prospectId);
    return { ok: true, status: 'completed', operationKey: operationKey, findingSetId: findingSetId, findingId: findingId, evidenceReferences: refs };
  } catch (error) {
    try {
      added.reverse().forEach(function(item) { deleteExactOperationOwnedFindingQualityRow_(item[0], item[2], item[3]); });
      if (evidenceLinked) authority.evidence.forEach(function(record, index) { writeFindingQualityRecord_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table, record._row, evidenceBefore[index]); });
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      throw new Error('Finding Draft seeding failed and rollback could not be verified: ' + rollbackError.message);
    }
    throw error;
  }
}

function assertSelectedReviewedEvidenceStillExact_(selected, schema) {
  if (!selected || !selected.sheet || !selected.table || !selected.row) throw new Error('One selected Evidence record is required.');
  const current = findingQualityRecordFromValues_(selected.sheet.getRange(selected.row, 1, 1, selected.table.lastColumn).getValues()[0], selected.table);
  if (String(current['Evidence ID']) !== String(selected.record['Evidence ID'])) throw new Error('The selected Evidence identity changed before Finding seeding.');
  const evidenceRows = readFindingQualityRecordsWithRows_(schema[FQ_EVIDENCE_SHEET]);
  const matches = evidenceRows.filter(function(record) { return String(record['Evidence ID']) === String(current['Evidence ID']); });
  if (matches.length !== 1) throw new Error('The selected Evidence record is missing or ambiguous.');
  const record = matches[0];
  validateAssessmentEvidenceRecord_(record);
  if (String(record['Review Status']) !== 'Reviewed' || !String(record['Reviewed By'] || '').trim() || !String(record['Reviewed At'] || '').trim()) throw new Error('Finding seeding requires one Reviewed Evidence record.');
  if (String(record['Element Label']) !== 'Business Snapshot conversion destination') throw new Error('The selected authority must be the Reviewed Business Snapshot conversion-destination Evidence.');
  return record;
}

function readFindingQualityRecordsWithRows_(entry) {
  const records = [];
  for (let row = entry.table.headerRow + 1; row <= entry.sheet.getLastRow(); row += 1) {
    const record = readFindingQualityRecord_(entry.sheet, entry.table, row);
    if (Object.keys(record).some(function(key) { return String(record[key] || '').trim(); })) { record._row = row; records.push(record); }
  }
  return records;
}

function resolveReviewedFindingDraftAuthority_(schema, prospectId, selectedEvidence) {
  const contexts = readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  const context = resolveCurrentReviewedPresenceContext_(contexts);
  const presence = readFindingQualityRecords_(schema[FQ_PRESENCE_SHEET].sheet, schema[FQ_PRESENCE_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  if (presence.length !== 1) throw new Error('Finding seeding requires one unique Website Presence record.');
  validateAssessmentPresenceRecord_(presence[0], { humanApproval: true });
  if (String(presence[0]['Review Status']) !== 'Reviewed' || String(presence[0].Applicability) !== 'Applicable' || String(presence[0]['Presence State']) !== 'Verified Present' || String(presence[0]['Channel Type']) !== 'Website') throw new Error('Finding seeding requires one Reviewed, applicable Website Presence.');
  if (String(context.Version) !== String(presence[0]['Inventory Version'])) throw new Error('Business Context and Presence versions are stale or mismatched.');
  const evidence = readFindingQualityRecordsWithRows_(schema[FQ_EVIDENCE_SHEET]).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  if (evidence.length !== 2) throw new Error('Finding seeding requires the complete two-record Reviewed Website Evidence chain.');
  const labels = ['Canonical website', 'Business Snapshot conversion destination'];
  labels.forEach(function(label) { if (evidence.filter(function(record) { return String(record['Element Label']) === label; }).length !== 1) throw new Error('Reviewed Evidence chain is missing or ambiguous: ' + label + '.'); });
  evidence.forEach(function(record) {
    validateAssessmentEvidenceRecord_(record);
    if (String(record['Review Status']) !== 'Reviewed' || String(record['Reviewed By'] || '') === '' || String(record['Reviewed At'] || '') === '') throw new Error('Every required Evidence record must be Reviewed.');
    if (String(record['Prospect ID']) !== prospectId || String(record['Acquisition Version']) !== String(selectedEvidence['Acquisition Version'])) throw new Error('Reviewed Evidence lineage is stale or mismatched.');
    if (String(record['Raw Artifact Reference'] || '').indexOf('presence:' + presence[0]['Presence Record ID']) === -1) throw new Error('Reviewed Evidence does not trace to the current Presence record.');
  });
  const linkage = evidence.map(function(record) { return String(record['Finding Set Candidate ID'] || '') + ':' + String(record['Candidate Version'] || ''); });
  if (new Set(linkage).size !== 1) throw new Error('Reviewed Evidence linkage is missing or ambiguous.');
  if (String(selectedEvidence['Evidence ID']) !== String(evidence.filter(function(record) { return String(record['Element Label']) === 'Business Snapshot conversion destination'; })[0]['Evidence ID'])) throw new Error('Selected Evidence is not the current conversion-destination authority.');
  assertExactFindingDraftProspect_(schema, prospectId, presence[0], context);
  return { prospectId: prospectId, context: context, presence: presence[0], evidence: evidence };
}

function findingDraftEvidenceAuthorityProjection_(record) {
  const projection = findingQualityEvidenceImmutableProjection_(record);
  delete projection['Finding Set Candidate ID'];
  delete projection['Candidate Version'];
  return projection;
}

function assertExactFindingDraftProspect_(schema, prospectId, presence, context) {
  const tracker = schema[FQ_CONTEXT_SHEET].sheet.getParent().getSheetByName(MASTER_PROSPECT_SHEET);
  if (!tracker) throw new Error('Master Prospect Tracker is missing.');
  const table = getHeaderTable_(tracker, ['Prospect ID', 'Company', 'Website']);
  const matches = findRowsByExactHeaderValue_(tracker, table, 'Prospect ID', prospectId);
  if (matches.length !== 1) throw new Error('Finding seeding requires one unique prospect.');
  const values = tracker.getRange(matches[0], 1, 1, table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(values, table.headers, 'Website') || '').trim() !== String(presence['Verified URL or Identifier'])) throw new Error('Prospect and Reviewed Presence website authority differ.');
  if (String(context['Relevant Conversion Destination']) !== String(findEvidenceByLabel_(schema, prospectId, 'Business Snapshot conversion destination')['Source URL'])) throw new Error('Reviewed conversion destination and Evidence source differ.');
}

function findEvidenceByLabel_(schema, prospectId, label) {
  const matches = readFindingQualityRecords_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table).filter(function(record) { return String(record['Prospect ID']) === prospectId && String(record['Element Label']) === label; });
  if (matches.length !== 1) throw new Error('Evidence label is missing or ambiguous: ' + label + '.');
  return matches[0];
}

function normalizeFindingDraftCandidate_(candidate) {
  const result = {
    title: String(candidate.title || '').trim().replace(/\s+/g, ' '),
    observation: String(candidate.observation || '').trim().replace(/\s+/g, ' '),
    consequence: String(candidate.consequence || '').trim().replace(/\s+/g, ' '),
    category: String(candidate.category || '').trim(), confidence: Number(candidate.confidence)
  };
  if (!result.title || !result.observation || !result.consequence) throw new Error('Finding title, observed condition, and business impact are required.');
  if (FQ_FINDING_DRAFT_CATEGORIES.indexOf(result.category) === -1) throw new Error('Finding category is not supported.');
  if (!isFinite(result.confidence) || result.confidence < 0.6 || result.confidence > 1) throw new Error('Evidence confidence must be from 0.60 through 1.00.');
  const unsupported = /\b(?:severity|priority|urgent|urgency|score|rating|lost revenue|revenue loss|financial impact|guaranteed|guarantee|conversion rate|percent|percentage)\b/i;
  if ([result.title, result.observation, result.consequence].some(function(value) { return unsupported.test(value); })) throw new Error('Finding candidate contains an unsupported claim or classification.');
  return result;
}

function buildReviewedEvidenceDraftFinding_(authority, candidate, identity) {
  const selected = authority.evidence.filter(function(record) { return String(record['Element Label']) === 'Business Snapshot conversion destination'; })[0];
  return {
    'Finding ID': identity.findingId, 'Prospect ID': authority.prospectId, 'Finding Set ID': identity.findingSetId, 'Finding Set Version': identity.version,
    Category: candidate.category, 'Finding Title': candidate.title, 'Finding State': 'Draft', 'Channel Type': 'Website', 'Presence State': authority.presence['Presence State'],
    'Customer Journey Stage': authority.context['Desired Customer Action'], 'Business Objective': authority.context['Primary Business Objective'],
    'Evidence Source': authority.evidence.map(function(record) { return record['Source Type']; }).join(', '), 'Evidence Location': selected['Source URL'],
    'Evidence Observed At': selected['Captured At'], 'Evidence Excerpt': selected['Test Result'], Observation: candidate.observation,
    'Expected Condition': '', 'Business Consequence': candidate.consequence, 'Consequence Basis': '', 'Recommended Action': '',
    'Implementation Location': '', 'Intended Outcome': '', 'Completion Test': '', 'Evidence Confidence': candidate.confidence,
    'Evidence References': authority.evidence.map(function(record) { return record['Evidence ID']; }).join(', '), Limitations: selected.Limitations,
    'Recommendation ID': '', 'Reviewed By': '', 'Reviewed At': '', 'Approval Status': 'Not Reviewed', 'Approved Version': '',
    'Validation Codes': 'FQ_FINDING_DRAFT_OPERATION=' + identity.operationKey
  };
}

function buildReviewedEvidenceDraftFindingSet_(authority, identity) {
  return {
    'Finding Set ID': identity.findingSetId, 'Prospect ID': authority.prospectId, Version: identity.version,
    'Created At': identity.createdAt, 'Created By': identity.operator, 'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': '', 'Approved At': '',
    'Approval Status': 'Not Reviewed', 'Business Context Version': authority.context.Version, 'Presence Inventory Version': authority.presence['Inventory Version'],
    'Evidence References': identity.evidenceReferences.join(', '), 'Finding IDs': identity.findingId, 'Document Eligibility': 'Not Eligible',
    'Supersedes Version': '', 'Immutable Hash': '', 'Snapshot File ID': '', Limitations: authority.evidence.filter(function(record) { return String(record['Element Label']) === 'Business Snapshot conversion destination'; })[0].Limitations,
    Notes: 'Initial Draft Finding Set. Operation ' + identity.operationKey
  };
}

function validateInitialDraftFindingSet_(set, authority, finding) {
  ['Finding Set ID', 'Prospect ID', 'Version', 'Created At', 'Created By', 'Review Status', 'Approval Status', 'Business Context Version', 'Presence Inventory Version', 'Evidence References', 'Finding IDs', 'Document Eligibility', 'Notes'].forEach(function(field) { if (!String(set[field] || '').trim()) throw new Error('Initial Draft Finding Set requires ' + field + '.'); });
  if (String(set['Review Status']) !== 'Draft' || String(set['Approval Status']) !== 'Not Reviewed' || String(set['Document Eligibility']) !== 'Not Eligible') throw new Error('Initial Finding Set must remain Draft and ineligible.');
  if (String(set['Prospect ID']) !== authority.prospectId || String(set['Finding IDs']) !== String(finding['Finding ID']) || String(set['Evidence References']) !== String(finding['Evidence References'])) throw new Error('Initial Draft Finding Set lineage is invalid.');
}

function assertNoFindingDraftConflicts_(schema, prospectId, findingSetId, findingId) {
  [FQ_FINDINGS_SHEET, FQ_FINDING_SETS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET].forEach(function(name) {
    const matches = readFindingQualityRecords_(schema[name].sheet, schema[name].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
    if (matches.length) throw new Error('Finding Draft seeding requires no existing downstream state for this prospect: ' + name + '.');
  });
  if (findFindingQualityRows_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table, 'Finding Set ID', findingSetId).length || findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', findingId).length) throw new Error('Deterministic Finding Draft ID collision detected.');
}

function assertNoFindingDraftSideEffects_(schema, prospectId) {
  [FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET].forEach(function(name) {
    if (readFindingQualityRecords_(schema[name].sheet, schema[name].table).some(function(record) { return String(record['Prospect ID']) === prospectId; })) throw new Error('Finding Draft seeding created a prohibited downstream record: ' + name + '.');
  });
}

function assertCompletedReviewedEvidenceFindingDraft_(schema, authority, candidate, operationKey, findingSetId, findingId) {
  const sets = findFindingQualityRows_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table, 'Finding Set ID', findingSetId);
  const findings = findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', findingId);
  if (sets.length !== 1 || findings.length !== 1) throw new Error('Finding Draft operation is missing or ambiguous.');
  if (String(sets[0].Notes || '').indexOf('Operation ' + operationKey) === -1 || String(findings[0]['Validation Codes'] || '').indexOf('FQ_FINDING_DRAFT_OPERATION=' + operationKey) === -1) throw new Error('Finding Draft retry is not operation-owned.');
  if (String(findings[0]['Finding Title']) !== candidate.title || String(findings[0].Observation) !== candidate.observation || String(findings[0]['Business Consequence']) !== candidate.consequence || String(findings[0].Category) !== candidate.category || Number(findings[0]['Evidence Confidence']) !== candidate.confidence) throw new Error('Finding Draft retry differs from the normalized candidate.');
  authority.evidence.forEach(function(record) {
    const persisted = findFindingQualityRows_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table, 'Evidence ID', record['Evidence ID']);
    if (persisted.length !== 1 || String(persisted[0]['Finding Set Candidate ID']) !== findingSetId || String(persisted[0]['Candidate Version']) !== '1') throw new Error('Finding Draft Evidence linkage is incomplete.');
  });
  assertNoFindingDraftSideEffects_(schema, authority.prospectId);
}

function assertExactReviewedEvidenceFindingDraftReadback_(schema, authority, expectedSet, expectedFinding, operationKey) {
  const sets = findFindingQualityRows_(schema[FQ_FINDING_SETS_SHEET].sheet, schema[FQ_FINDING_SETS_SHEET].table, 'Finding Set ID', expectedSet['Finding Set ID']);
  const findings = findFindingQualityRows_(schema[FQ_FINDINGS_SHEET].sheet, schema[FQ_FINDINGS_SHEET].table, 'Finding ID', expectedFinding['Finding ID']);
  if (sets.length !== 1 || findings.length !== 1) throw new Error('Finding Draft readback is missing or ambiguous.');
  FQ_FINDING_SET_COLUMNS.forEach(function(field) { if (findingQualityDateText_(sets[0][field]) !== findingQualityDateText_(expectedSet[field])) throw new Error('Finding Set readback differs at ' + field + '.'); });
  FQ_FINDING_COLUMNS.forEach(function(field) { if (findingQualityDateText_(findings[0][field]) !== findingQualityDateText_(expectedFinding[field])) throw new Error('Finding readback differs at ' + field + '.'); });
  authority.evidence.forEach(function(record) {
    const persisted = findFindingQualityRows_(schema[FQ_EVIDENCE_SHEET].sheet, schema[FQ_EVIDENCE_SHEET].table, 'Evidence ID', record['Evidence ID']);
    if (persisted.length !== 1 || String(persisted[0]['Finding Set Candidate ID']) !== String(expectedSet['Finding Set ID']) || String(persisted[0]['Candidate Version']) !== '1') throw new Error('Evidence linkage readback failed.');
    FQ_EVIDENCE_COLUMNS.filter(function(field) { return field !== 'Finding Set Candidate ID' && field !== 'Candidate Version'; }).forEach(function(field) {
      if (findingQualityDateText_(persisted[0][field]) !== findingQualityDateText_(record[field])) throw new Error('Evidence authority changed at ' + field + '.');
    });
  });
  if (String(expectedFinding['Validation Codes']).indexOf(operationKey) === -1) throw new Error('Finding operation marker is missing.');
}
