/**
 * Transactional Draft Presence Inventory seeding.
 * This workflow never verifies a channel or creates downstream Finding Quality state.
 */

var FQ_PRESENCE_SEED_CONFIRMATION = 'SEED PRESENCE DRAFT';
var FQ_PRESENCE_SEED_OPERATION_PREFIX = 'FQPRESENCE';

function seedSelectedProspectPresenceInventory() {
  const selected = requireSelectedFindingQualityProspect_();
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Seed Selected Prospect Presence Inventory',
    'Type ' + FQ_PRESENCE_SEED_CONFIRMATION + ' exactly. This creates Draft records only.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== FQ_PRESENCE_SEED_CONFIRMATION) {
    throw new Error('Presence Inventory seeding cancelled.');
  }
  const result = seedFindingQualityPresenceInventory_(selected, { additionalChannels: [] }, {});
  ui.alert(
    'Presence Inventory Draft',
    result.status === 'already-completed'
      ? 'This Presence Inventory Draft was already seeded. No records changed.'
      : 'The supported Presence records were seeded as Draft and Not Verified. Review each record before marking it Reviewed.',
    ui.ButtonSet.OK
  );
  return result;
}

function seedFindingQualityPresenceInventory_(selected, request, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return seedFindingQualityPresenceInventoryLocked_(selected, request || {}, hooks || {});
  } finally {
    lock.releaseLock();
  }
}

function seedFindingQualityPresenceInventoryLocked_(selected, request, hooks) {
  assertSelectedPresenceProspectStillExact_(selected);
  const ss = selected.ss;
  const prospectId = String(selected.prospectId || '').trim();
  const company = String(selected.prospect && selected.prospect.company || '').trim();
  const operator = requireHumanReviewer_();
  const schema = getExistingFindingQualityDraftSuccessorSchema_(ss);
  const contexts = readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table)
    .filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  const context = resolveCurrentReviewedPresenceContext_(contexts);
  const inventoryVersion = String(context.Version);
  const operationKey = [FQ_PRESENCE_SEED_OPERATION_PREFIX, prospectId, inventoryVersion].join(':');
  const inventoryId = 'INV-' + fingerprintFindingQualityText_(operationKey).slice(0, 16);
  const marker = 'Operation ' + operationKey;
  const presenceEntry = schema[FQ_PRESENCE_SHEET];
  const allPresence = readFindingQualityRecords_(presenceEntry.sheet, presenceEntry.table);
  const operationRecords = allPresence.filter(function(record) { return String(record.Notes || '').indexOf(marker) !== -1; });

  const records = buildDraftPresenceInventoryRecords_(selected, context, request, {
    prospectId: prospectId,
    company: company,
    operator: operator,
    operationKey: operationKey,
    inventoryId: inventoryId,
    inventoryVersion: inventoryVersion,
    capturedAt: new Date()
  });
  records.forEach(function(record) { validateAssessmentPresenceRecord_(record, { humanApproval: false }); });
  assertNoPresenceSeedDownstreamState_(schema, prospectId);

  if (operationRecords.length) {
    assertCompletedPresenceInventory_(operationRecords, records, operationKey);
    return { ok: true, status: 'already-completed', operationKey: operationKey, inventoryId: inventoryId, inventoryVersion: inventoryVersion, recordIds: records.map(function(record) { return record['Presence Record ID']; }) };
  }
  if (allPresence.some(function(record) { return String(record['Prospect ID']) === prospectId; })) {
    throw new Error('Presence records already exist for this prospect without the completed operation. Reconciliation is required.');
  }
  assertNoPresenceInventoryIdCollisions_(allPresence, records, inventoryId);

  const added = [];
  try {
    records.forEach(function(record, index) {
      const row = appendFindingQualityRecord_(presenceEntry.sheet, presenceEntry.table, record);
      added.push({ row: row, id: record['Presence Record ID'] });
      if (hooks.afterWrite) hooks.afterWrite(index + 1, record);
    });
    const persisted = readFindingQualityRecords_(presenceEntry.sheet, presenceEntry.table)
      .filter(function(record) { return String(record.Notes || '').indexOf(marker) !== -1; });
    assertCompletedPresenceInventory_(persisted, records, operationKey);
    assertNoPresenceSeedDownstreamState_(schema, prospectId);
    return { ok: true, status: 'completed', operationKey: operationKey, inventoryId: inventoryId, inventoryVersion: inventoryVersion, recordIds: records.map(function(record) { return record['Presence Record ID']; }) };
  } catch (error) {
    try {
      added.reverse().forEach(function(item) { deleteExactPresenceSeedRow_(presenceEntry, item.row, item.id, operationKey); });
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      throw new Error('Presence Inventory seeding failed and rollback could not be verified: ' + rollbackError.message);
    }
    throw error;
  }
}

function assertSelectedPresenceProspectStillExact_(selected) {
  if (!selected || !selected.sheet || !selected.table || !selected.selectedRow) throw new Error('One selected prospect is required.');
  const persisted = selected.sheet.getRange(selected.selectedRow, 1, 1, selected.table.lastColumn).getValues()[0];
  const prospectId = String(getValueByHeader_(persisted, selected.table.headers, 'Prospect ID') || '').trim();
  const company = String(getValueByHeader_(persisted, selected.table.headers, 'Company') || '').trim();
  if (!prospectId || prospectId !== String(selected.prospectId || '').trim() || company !== String(selected.prospect && selected.prospect.company || '').trim()) {
    throw new Error('The selected prospect identity changed before Presence Inventory seeding.');
  }
  const matches = findRowsByExactHeaderValue_(selected.sheet, selected.table, 'Prospect ID', prospectId);
  if (matches.length !== 1 || matches[0] !== selected.selectedRow) throw new Error('The selected Prospect ID is missing or ambiguous.');
}

function resolveCurrentReviewedPresenceContext_(contexts) {
  if (!contexts.length) throw new Error('A Reviewed Business Context is required before Presence Inventory seeding.');
  const versions = contexts.map(function(record) { return Number(record.Version); });
  if (versions.some(function(version) { return !Number.isInteger(version) || version < 1; })) throw new Error('Business Context versions are invalid or ambiguous.');
  const currentVersion = Math.max.apply(null, versions);
  const current = contexts.filter(function(record) { return Number(record.Version) === currentVersion; });
  if (current.length !== 1 || String(current[0]['Review Status']) !== 'Reviewed' || !String(current[0]['Reviewed By'] || '').trim() || !String(current[0]['Reviewed At'] || '').trim()) {
    throw new Error('Exactly one current Reviewed Business Context is required. Draft, duplicate, or stale context state was found.');
  }
  validateBusinessContextRecord_(current[0]);
  return current[0];
}

function buildDraftPresenceInventoryRecords_(selected, context, request, authority) {
  const website = normalizeFindingQualityPresenceUrl_(selected.prospect && selected.prospect.website, 'Master Prospect Tracker website');
  const destination = String(context['Relevant Conversion Destination'] || '').trim();
  const normalizedDestination = destination ? normalizeFindingQualityPresenceUrl_(destination, 'Reviewed conversion destination') : '';
  if (website && normalizedDestination && normalizeWebsiteKey_(website).split('/')[0] !== normalizeWebsiteKey_(normalizedDestination).split('/')[0]) {
    throw new Error('The tracker website and Reviewed conversion destination do not share the same website authority.');
  }
  const proposals = [];
  if (website) {
    proposals.push({
      channelType: 'Website', channelName: 'Website', identifier: website,
      evidenceSource: 'Master Prospect Tracker and Reviewed Business Context',
      evidenceLocation: [website, normalizedDestination].filter(Boolean).join(' | '),
      applicability: 'Needs Review',
      role: 'Website and request path for the reviewed business goal',
      limitations: 'Website presence, ownership, page access, and form submission are not verified.',
      note: 'Draft seeded from existing authoritative records.'
    });
  }
  [].concat(request.additionalChannels || []).forEach(function(channel) {
    proposals.push(validateOperatorProvidedPresenceChannel_(channel));
  });
  if (!proposals.length) throw new Error('No authoritative Presence channel is available to seed.');
  return proposals.map(function(proposal) {
    const channelToken = String(proposal.channelType).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return {
      'Presence Record ID': 'PRES-' + fingerprintFindingQualityText_(authority.operationKey + ':' + channelToken).slice(0, 16),
      'Prospect ID': authority.prospectId,
      'Inventory ID': authority.inventoryId,
      'Inventory Version': authority.inventoryVersion,
      'Channel Type': proposal.channelType,
      'Channel Name': proposal.channelName,
      'Presence State': 'Not Verified',
      'Verified URL or Identifier': proposal.identifier,
      'Ownership Confidence': 'Needs Review',
      'Evidence Source': proposal.evidenceSource,
      'Evidence Location': proposal.evidenceLocation,
      'Captured At': authority.capturedAt,
      Applicability: proposal.applicability,
      'Role in Customer Journey': proposal.role,
      Limitations: proposal.limitations,
      Notes: [proposal.note, 'Seeded by ' + authority.operator + '.', 'Operation ' + authority.operationKey].filter(Boolean).join(' '),
      'Review Status': 'Draft',
      'Reviewed By': '',
      'Reviewed At': ''
    };
  });
}

function validateOperatorProvidedPresenceChannel_(channel) {
  const source = channel || {};
  if (source.explicitOperatorProvided !== true) throw new Error('Additional Presence channels require explicit operator-provided facts.');
  const required = ['channelType', 'channelName', 'identifier', 'evidenceSource', 'evidenceLocation', 'role', 'limitations'];
  required.forEach(function(field) { if (!String(source[field] || '').trim()) throw new Error('Operator-provided Presence channel requires ' + field + '.'); });
  if (String(source.channelType).trim() === 'Website') throw new Error('The canonical Website channel cannot be duplicated.');
  return {
    channelType: String(source.channelType).trim(), channelName: String(source.channelName).trim(),
    identifier: String(source.identifier).trim(), evidenceSource: String(source.evidenceSource).trim(),
    evidenceLocation: String(source.evidenceLocation).trim(), applicability: String(source.applicability || 'Needs Review').trim(),
    role: String(source.role).trim(), limitations: String(source.limitations).trim(),
    note: 'Draft seeded from explicit operator-provided facts and provenance.'
  };
}

function normalizeFindingQualityPresenceUrl_(value, label) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(text)) throw new Error(label + ' must be an absolute HTTPS URL.');
  return text;
}

function assertNoPresenceInventoryIdCollisions_(allPresence, records, inventoryId) {
  if (allPresence.some(function(record) { return String(record['Inventory ID']) === inventoryId; })) throw new Error('Presence Inventory ID collision detected.');
  records.forEach(function(record) {
    if (allPresence.some(function(item) { return String(item['Presence Record ID']) === String(record['Presence Record ID']); })) throw new Error('Presence Record ID collision detected.');
  });
}

function assertNoPresenceSeedDownstreamState_(schema, prospectId) {
  [FQ_EVIDENCE_SHEET, FQ_FINDINGS_SHEET, FQ_FINDING_SETS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET].forEach(function(name) {
    const records = readFindingQualityRecords_(schema[name].sheet, schema[name].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
    if (records.length) throw new Error('Presence Inventory seeding requires no downstream Finding Quality state for this prospect: ' + name + '.');
  });
}

function assertCompletedPresenceInventory_(persisted, expected, operationKey) {
  if (persisted.length !== expected.length) throw new Error('Presence Inventory operation is missing or ambiguous.');
  const expectedById = {};
  expected.forEach(function(record) { expectedById[record['Presence Record ID']] = record; });
  persisted.forEach(function(record) {
    const expectedRecord = expectedById[record['Presence Record ID']];
    if (!expectedRecord || String(record.Notes || '').indexOf('Operation ' + operationKey) === -1) throw new Error('Presence Inventory retry differs from the completed operation.');
    FQ_PRESENCE_COLUMNS.forEach(function(field) {
      if (field === 'Captured At') return;
      if (String(record[field] || '') !== String(expectedRecord[field] || '')) throw new Error('Presence Inventory retry differs at ' + field + '.');
    });
  });
}

function deleteExactPresenceSeedRow_(entry, row, id, operationKey) {
  if (row <= entry.table.headerRow || row > entry.sheet.getLastRow()) throw new Error('Presence rollback row is outside the operation boundary.');
  const record = readFindingQualityRecord_(entry.sheet, entry.table, row);
  if (String(record['Presence Record ID']) !== String(id) || String(record.Notes || '').indexOf('Operation ' + operationKey) === -1) {
    throw new Error('Presence rollback target is not operation-owned.');
  }
  entry.sheet.deleteRow(row);
}
