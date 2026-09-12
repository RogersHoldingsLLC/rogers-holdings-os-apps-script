/**
 * Transactional Draft Evidence seeding from one Reviewed Presence record.
 * The public command performs read-only HTTPS GET capture and creates Evidence only.
 */

var FQ_EVIDENCE_SEED_CONFIRMATION = 'SEED EVIDENCE DRAFTS';
var FQ_EVIDENCE_SEED_OPERATION_PREFIX = 'FQEVIDENCE';
var FQ_EVIDENCE_MAX_BYTES = 2097152;

function seedSelectedPresenceEvidenceDrafts() {
  const selected = requireSelectedReviewedPresenceForEvidence_();
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Seed Selected Presence Evidence Drafts',
    'Type ' + FQ_EVIDENCE_SEED_CONFIRMATION + ' exactly. This uses read-only page checks and creates Draft Evidence only.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== FQ_EVIDENCE_SEED_CONFIRMATION) {
    throw new Error('Evidence Draft seeding cancelled.');
  }
  const result = seedFindingQualityEvidenceDrafts_(selected, {}, {});
  ui.alert(
    'Evidence Drafts',
    result.status === 'already-completed'
      ? 'These Evidence Drafts were already seeded. No records changed.'
      : 'The Website Evidence records were seeded as Draft. Review every field before marking Evidence Reviewed.',
    ui.ButtonSet.OK
  );
  return result;
}

function requireSelectedReviewedPresenceForEvidence_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== FQ_PRESENCE_SHEET || range.getNumRows() !== 1 || range.getRow() <= 1) {
    throw new Error('Select exactly one data row on ' + FQ_PRESENCE_SHEET + '.');
  }
  const table = getHeaderTable_(sheet, FQ_PRESENCE_COLUMNS);
  const row = range.getRow();
  if (row > sheet.getLastRow()) throw new Error('Select exactly one data row on ' + FQ_PRESENCE_SHEET + '.');
  const record = findingQualityRecordFromValues_(sheet.getRange(row, 1, 1, table.lastColumn).getValues()[0], table);
  if (!String(record['Presence Record ID'] || '').trim()) throw new Error('The selected Presence row has no exact Presence Record ID.');
  return { ss: ss, sheet: sheet, table: table, row: row, record: record };
}

function seedFindingQualityEvidenceDrafts_(selected, request, hooks) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return seedFindingQualityEvidenceDraftsLocked_(selected, request || {}, hooks || {}); }
  finally { lock.releaseLock(); }
}

function seedFindingQualityEvidenceDraftsLocked_(selected, request, hooks) {
  const schema = getExistingFindingQualityDraftSuccessorSchema_(selected.ss);
  const presence = assertSelectedReviewedPresenceStillExact_(selected, schema);
  const prospectId = String(presence['Prospect ID']);
  const context = resolveCurrentReviewedEvidenceContext_(schema, prospectId);
  assertEvidenceSeedAuthority_(schema, presence, context);
  const operator = requireHumanReviewer_();
  const authorityFingerprint = fingerprintFindingQualityValue_(reviewedPresenceEvidenceProjection_(presence));
  const operationKey = [FQ_EVIDENCE_SEED_OPERATION_PREFIX, presence['Presence Record ID'], presence['Inventory Version'], authorityFingerprint.slice(0, 16)].join(':');
  const evidenceEntry = schema[FQ_EVIDENCE_SHEET];
  const allEvidence = readFindingQualityRecords_(evidenceEntry.sheet, evidenceEntry.table);
  const operationRecords = allEvidence.filter(function(record) { return String(record['Acquisition Version']) === operationKey; });
  if (operationRecords.length) {
    assertCompletedEvidenceDraftOperation_(operationRecords, presence, operationKey);
    return { ok: true, status: 'already-completed', operationKey: operationKey, evidenceIds: operationRecords.map(function(record) { return record['Evidence ID']; }) };
  }
  if (allEvidence.some(function(record) { return String(record['Prospect ID']) === prospectId; })) {
    throw new Error('Evidence already exists for this prospect without the completed operation. Reconciliation is required.');
  }

  const targets = buildReviewedPresenceEvidenceTargets_(presence, context);
  const captures = targets.map(function(target) {
    return captureApprovedEvidencePage_(target.url, targets.map(function(item) { return item.url; }), hooks.fetch || UrlFetchApp.fetch);
  });
  const capturedAt = new Date();
  const records = targets.map(function(target, index) {
    return buildDraftEvidenceRecord_(presence, target, captures[index], {
      operationKey: operationKey, operator: operator, capturedAt: capturedAt
    });
  });
  records.forEach(validateAssessmentEvidenceRecord_);
  assertNoEvidenceIdCollisions_(allEvidence, records);
  assertNoEvidenceSeedDownstreamState_(schema, prospectId);

  const added = [];
  try {
    records.forEach(function(record, index) {
      const row = appendFindingQualityRecord_(evidenceEntry.sheet, evidenceEntry.table, record);
      added.push({ row: row, id: record['Evidence ID'] });
      if (hooks.afterWrite) hooks.afterWrite(index + 1, record);
    });
    const persisted = readFindingQualityRecords_(evidenceEntry.sheet, evidenceEntry.table)
      .filter(function(record) { return String(record['Acquisition Version']) === operationKey; });
    assertExactEvidenceDraftReadback_(persisted, records, operationKey);
    assertNoEvidenceSeedDownstreamState_(schema, prospectId);
    return { ok: true, status: 'completed', operationKey: operationKey, evidenceIds: records.map(function(record) { return record['Evidence ID']; }) };
  } catch (error) {
    try {
      added.reverse().forEach(function(item) { deleteExactEvidenceSeedRow_(evidenceEntry, item.row, item.id, operationKey); });
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      throw new Error('Evidence Draft seeding failed and rollback could not be verified: ' + rollbackError.message);
    }
    throw error;
  }
}

function assertSelectedReviewedPresenceStillExact_(selected, schema) {
  if (!selected || !selected.sheet || !selected.table || !selected.row) throw new Error('One selected Presence record is required.');
  const current = findingQualityRecordFromValues_(selected.sheet.getRange(selected.row, 1, 1, selected.table.lastColumn).getValues()[0], selected.table);
  if (String(current['Presence Record ID']) !== String(selected.record['Presence Record ID'])) throw new Error('The selected Presence identity changed before Evidence seeding.');
  const matches = readFindingQualityRecords_(schema[FQ_PRESENCE_SHEET].sheet, schema[FQ_PRESENCE_SHEET].table)
    .filter(function(record) { return String(record['Presence Record ID']) === String(current['Presence Record ID']); });
  if (matches.length !== 1) throw new Error('The selected Presence record is missing or ambiguous.');
  const presence = matches[0];
  validateAssessmentPresenceRecord_(presence, { humanApproval: true });
  if (String(presence['Review Status']) !== 'Reviewed' || !String(presence['Reviewed By'] || '').trim() || !String(presence['Reviewed At'] || '').trim()) throw new Error('Evidence seeding requires one Reviewed Presence record.');
  if (String(presence.Applicability) !== 'Applicable' || String(presence['Presence State']) !== 'Verified Present' || String(presence['Channel Type']) !== 'Website') throw new Error('Evidence seeding supports only a Reviewed, applicable, Verified Present Website record.');
  return presence;
}

function resolveCurrentReviewedEvidenceContext_(schema, prospectId) {
  const contexts = readFindingQualityRecords_(schema[FQ_CONTEXT_SHEET].sheet, schema[FQ_CONTEXT_SHEET].table)
    .filter(function(record) { return String(record['Prospect ID']) === prospectId; });
  return resolveCurrentReviewedPresenceContext_(contexts);
}

function assertEvidenceSeedAuthority_(schema, presence, context) {
  const prospectId = String(presence['Prospect ID']);
  const tracker = schema[FQ_CONTEXT_SHEET].sheet.getParent().getSheetByName(MASTER_PROSPECT_SHEET);
  if (!tracker) throw new Error('Master Prospect Tracker is missing.');
  const table = getHeaderTable_(tracker, ['Prospect ID', 'Company', 'Website']);
  const matches = findRowsByExactHeaderValue_(tracker, table, 'Prospect ID', prospectId);
  if (matches.length !== 1) throw new Error('Evidence seeding requires one unique prospect.');
  const row = tracker.getRange(matches[0], 1, 1, table.lastColumn).getValues()[0];
  const trackerWebsite = normalizeApprovedEvidenceUrl_(getValueByHeader_(row, table.headers, 'Website'), 'canonical prospect website');
  const presenceUrl = normalizeApprovedEvidenceUrl_(presence['Verified URL or Identifier'], 'Reviewed Presence URL');
  const destination = normalizeApprovedEvidenceUrl_(context['Relevant Conversion Destination'], 'Reviewed conversion destination');
  if (trackerWebsite !== presenceUrl) throw new Error('The Reviewed Presence URL does not match the canonical prospect website.');
  assertApprovedEvidenceDomainFamily_([presenceUrl, destination]);
  if (!String(presence.Limitations || '').trim()) throw new Error('Reviewed Presence limitations are required before Evidence seeding.');
}

function reviewedPresenceEvidenceProjection_(record) {
  const projection = {};
  FQ_PRESENCE_COLUMNS.forEach(function(field) { projection[field] = findingQualityDateText_(record[field]); });
  return projection;
}

function buildReviewedPresenceEvidenceTargets_(presence, context) {
  const website = normalizeApprovedEvidenceUrl_(presence['Verified URL or Identifier'], 'Reviewed Presence URL');
  const destination = normalizeApprovedEvidenceUrl_(context['Relevant Conversion Destination'], 'Reviewed conversion destination');
  if (website === destination) throw new Error('Canonical website and conversion destination must be distinct Evidence targets.');
  return [
    { key: 'WEBSITE', url: website, label: 'Canonical website', defaultTitle: 'Rogers Holdings LLC website', observed: 'The reviewed canonical website returned a readable HTML page.', limitation: 'Read-only page capture. No form or state-changing request was sent.' },
    { key: 'CONVERSION', url: destination, label: 'Business Snapshot conversion destination', defaultTitle: 'Business Snapshot', observed: 'The reviewed conversion destination returned a readable HTML page.', limitation: String(presence.Limitations) }
  ];
}

function normalizeApprovedEvidenceUrl_(value, label) {
  const text = String(value || '').trim();
  if (!/^https:\/\//i.test(text)) throw new Error(label + ' must be an absolute HTTPS URL.');
  const match = text.match(/^https:\/\/([^\/?#]+)([^?#]*)(?:[?#].*)?$/i);
  if (!match || !match[1] || /@/.test(match[1])) throw new Error(label + ' is unsupported.');
  if (/[?#]/.test(text)) throw new Error(label + ' must not contain a query string or fragment.');
  return text;
}

function approvedEvidenceHost_(value) { return normalizeApprovedEvidenceUrl_(value, 'Evidence URL').match(/^https:\/\/([^\/]+)/i)[1].replace(/^www\./i, ''); }

function assertApprovedEvidenceDomainFamily_(urls) {
  const hosts = urls.map(approvedEvidenceHost_);
  if (!hosts.length || hosts.some(function(host) { return host !== hosts[0]; })) throw new Error('Evidence URLs must use the same approved website domain.');
}

function captureApprovedEvidencePage_(initialUrl, approvedUrls, fetcher) {
  let url = initialUrl;
  const approvedHosts = approvedUrls.map(approvedEvidenceHost_);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    if (approvedHosts.indexOf(approvedEvidenceHost_(url)) === -1) throw new Error('Off-domain Evidence capture was rejected.');
    const response = fetcher(url, { method: 'get', followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: true, headers: { Accept: 'text/html,application/xhtml+xml' } });
    const code = Number(response.getResponseCode());
    const headers = response.getAllHeaders ? response.getAllHeaders() : {};
    if (code >= 300 && code < 400) {
      const location = String(headers.Location || headers.location || '').trim();
      if (!location) throw new Error('Evidence redirect has no exact destination.');
      url = resolveApprovedEvidenceRedirect_(url, location);
      if (approvedHosts.indexOf(approvedEvidenceHost_(url)) === -1) throw new Error('Off-domain Evidence redirect was rejected.');
      continue;
    }
    if (code === 401 || code === 403) throw new Error('Authenticated Evidence content is unsupported.');
    if (code < 200 || code >= 300) throw new Error('Evidence URL returned unsupported HTTP status ' + code + '.');
    const contentType = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
    if (contentType.indexOf('text/html') === -1 && contentType.indexOf('application/xhtml+xml') === -1) throw new Error('Evidence response content type is unsupported.');
    const bytes = response.getBlob().getBytes();
    if (bytes.length > FQ_EVIDENCE_MAX_BYTES) throw new Error('Evidence response exceeds the safe capture limit.');
    const html = response.getContentText();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return { finalUrl: url, contentType: contentType, byteLength: bytes.length, contentHash: fingerprintFindingQualityText_(html), pageTitle: titleMatch ? stripEvidenceHtmlText_(titleMatch[1]) : '' };
  }
  throw new Error('Evidence redirect limit exceeded.');
}

function resolveApprovedEvidenceRedirect_(base, location) {
  if (/^https:\/\//i.test(location)) return normalizeApprovedEvidenceUrl_(location, 'Evidence redirect');
  if (/^\/\//.test(location)) return normalizeApprovedEvidenceUrl_('https:' + location, 'Evidence redirect');
  const origin = base.match(/^(https:\/\/[^\/]+)/i)[1];
  if (location.charAt(0) === '/') return normalizeApprovedEvidenceUrl_(origin + location, 'Evidence redirect');
  const directory = base.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
  if (location.indexOf('..') !== -1) throw new Error('Ambiguous relative Evidence redirect was rejected.');
  return normalizeApprovedEvidenceUrl_(directory + location, 'Evidence redirect');
}

function stripEvidenceHtmlText_(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }

function buildDraftEvidenceRecord_(presence, target, capture, authority) {
  const pathMatch = capture.finalUrl.match(/^https:\/\/[^\/]+(\/[^?#]*)/i);
  const rawReference = 'sha256:' + capture.contentHash + '; bytes:' + capture.byteLength + '; presence:' + presence['Presence Record ID'];
  return {
    'Evidence ID': 'EVID-' + fingerprintFindingQualityText_(authority.operationKey + ':' + target.key).slice(0, 16),
    'Prospect ID': String(presence['Prospect ID']), 'Finding Set Candidate ID': '', 'Candidate Version': '',
    'Source Type': 'Page Content', 'Source URL': target.url, 'Page Title': capture.pageTitle || target.defaultTitle,
    'Page Path': pathMatch ? pathMatch[1] : '/', 'Element Type': 'Page', 'Element Label': target.label,
    'Evidence Location': capture.finalUrl, 'Captured At': authority.capturedAt,
    'Capture Method': 'Read-only HTTPS GET seeded by ' + authority.operator + '; no cookies, form data, or state-changing request sent.',
    'Desktop/Mobile Context': 'Not Applicable', 'Evidence Excerpt': '', 'Observed Value': target.observed,
    'Screenshot Reference': '', 'Test Performed': 'Read-only page availability and HTML content check.',
    'Test Result': target.observed, Confidence: 'High', Limitations: target.limitation,
    'Raw Artifact Reference': rawReference, 'Acquisition Version': authority.operationKey,
    'Review Status': 'Draft', 'Reviewed By': '', 'Reviewed At': ''
  };
}

function assertCompletedEvidenceDraftOperation_(records, presence, operationKey) {
  if (records.length !== 2) throw new Error('Evidence Draft operation is missing or ambiguous.');
  const ids = {};
  records.forEach(function(record) {
    validateAssessmentEvidenceRecord_(record);
    if (String(record['Prospect ID']) !== String(presence['Prospect ID']) || String(record['Acquisition Version']) !== operationKey || String(record['Review Status']) !== 'Draft') throw new Error('Evidence Draft retry differs from the completed operation.');
    if (ids[record['Evidence ID']]) throw new Error('Evidence Draft retry contains duplicate records.');
    ids[record['Evidence ID']] = true;
  });
}

function assertExactEvidenceDraftReadback_(persisted, expected, operationKey) {
  if (persisted.length !== expected.length) throw new Error('Evidence Draft readback is missing or ambiguous.');
  const expectedById = {};
  expected.forEach(function(record) { expectedById[record['Evidence ID']] = record; });
  persisted.forEach(function(record) {
    const expectedRecord = expectedById[record['Evidence ID']];
    if (!expectedRecord || String(record['Acquisition Version']) !== operationKey) throw new Error('Evidence Draft readback is not operation-owned.');
    FQ_EVIDENCE_COLUMNS.forEach(function(field) {
      if (findingQualityDateText_(record[field]) !== findingQualityDateText_(expectedRecord[field])) throw new Error('Evidence Draft readback differs at ' + field + '.');
    });
  });
}

function assertNoEvidenceIdCollisions_(allEvidence, records) {
  records.forEach(function(record) {
    if (allEvidence.some(function(item) { return String(item['Evidence ID']) === String(record['Evidence ID']); })) throw new Error('Evidence ID collision detected.');
  });
}

function assertNoEvidenceSeedDownstreamState_(schema, prospectId) {
  [FQ_FINDINGS_SHEET, FQ_FINDING_SETS_SHEET, FQ_RECOMMENDATIONS_SHEET, FQ_ACTIONS_SHEET].forEach(function(name) {
    const records = readFindingQualityRecords_(schema[name].sheet, schema[name].table).filter(function(record) { return String(record['Prospect ID']) === prospectId; });
    if (records.length) throw new Error('Evidence seeding requires no downstream Finding Quality state for this prospect: ' + name + '.');
  });
}

function deleteExactEvidenceSeedRow_(entry, row, id, operationKey) {
  if (row <= entry.table.headerRow || row > entry.sheet.getLastRow()) throw new Error('Evidence rollback row is outside the operation boundary.');
  const record = readFindingQualityRecord_(entry.sheet, entry.table, row);
  if (String(record['Evidence ID']) !== String(id) || String(record['Acquisition Version']) !== operationKey) throw new Error('Evidence rollback target is not operation-owned.');
  entry.sheet.deleteRow(row);
}
