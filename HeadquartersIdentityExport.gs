/**
 * Headquarters Identity Exclusion Snapshot v1.
 *
 * Strictly read-only BOP-owned source boundary for DE-002. This module is
 * deliberately independent of workflow, schema-repair, audit, and activity
 * helpers so an export cannot mutate BOP state.
 */

var HEADQUARTERS_IDENTITY_EXPORT_VERSION = 'rh-bop-identity-exclusion-snapshot-v1';
var HEADQUARTERS_IDENTITY_EXPORT_TOKEN_PROPERTY = 'HEADQUARTERS_IDENTITY_EXPORT_TOKEN';
var HEADQUARTERS_IDENTITY_EXPORT_SPREADSHEET_PROPERTY = 'BOP_SPREADSHEET_ID';
var HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE_PROPERTY =
  'HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE';
var HEADQUARTERS_IDENTITY_EXPORT_HEADER_ROW = 4;
var HEADQUARTERS_IDENTITY_EXPORT_FRESHNESS_MINUTES = 5;
var HEADQUARTERS_IDENTITY_EXPORT_MAXIMUM_ENTRIES = 100000;
var HEADQUARTERS_IDENTITY_EXPORT_MAXIMUM_BYTES = 512 * 1024;
var HEADQUARTERS_IDENTITY_EXPORT_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
var HEADQUARTERS_IDENTITY_EXPORT_PROSPECT_HEADERS = [
  'Prospect ID', 'Status', 'Company', 'Website'
];
var HEADQUARTERS_IDENTITY_EXPORT_CLIENT_HEADERS = [
  'Client ID', 'Status', 'Company', 'Client Name', 'Website'
];

function buildHeadquartersIdentityExportV1_() {
  const acquisition = acquireHeadquartersIdentityExportSourceV1_();
  const snapshot = buildHeadquartersIdentityExportV1FromSource_(
    acquisition.source,
    new Date()
  );
  verifyHeadquartersIdentityExportSourceV1_(acquisition);
  return snapshot;
}

function readHeadquartersIdentityExportSourceV1_() {
  return acquireHeadquartersIdentityExportSourceV1_().source;
}

function acquireHeadquartersIdentityExportSourceV1_() {
  const spreadsheetId = readHeadquartersIdentityExportSpreadsheetIdV1_();
  const expectedWorkbookTitle = readHeadquartersIdentityExportExpectedWorkbookTitleV1_();
  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_UNAVAILABLE');
  }
  assertHeadquartersIdentityWorkbookV1_(spreadsheet, spreadsheetId, expectedWorkbookTitle);

  const first = readHeadquartersIdentityWorkbookSnapshotV1_(spreadsheet);
  const second = readHeadquartersIdentityWorkbookSnapshotV1_(spreadsheet);
  assertHeadquartersIdentityWorkbookV1_(spreadsheet, spreadsheetId, expectedWorkbookTitle);
  if (readHeadquartersIdentityExportSpreadsheetIdV1_() !== spreadsheetId ||
      readHeadquartersIdentityExportExpectedWorkbookTitleV1_() !== expectedWorkbookTitle ||
      fingerprintHeadquartersIdentitySourceV1_(first) !== fingerprintHeadquartersIdentitySourceV1_(second)) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CHANGED_DURING_EXPORT');
  }

  const prospects = parseHeadquartersIdentitySheetSnapshotV1_(
    second.prospects,
    HEADQUARTERS_IDENTITY_EXPORT_PROSPECT_HEADERS,
    'Prospect ID',
    ['Company'],
    'prospect'
  );
  const clients = parseHeadquartersIdentitySheetSnapshotV1_(
    second.clients,
    HEADQUARTERS_IDENTITY_EXPORT_CLIENT_HEADERS,
    'Client ID',
    ['Company', 'Client Name'],
    'client'
  );

  return {
    spreadsheet: spreadsheet,
    spreadsheetId: spreadsheetId,
    expectedWorkbookTitle: expectedWorkbookTitle,
    sourceFingerprint: fingerprintHeadquartersIdentitySourceV1_(second),
    source: {
      prospects: prospects.entries,
      clients: clients.entries
    }
  };
}

function verifyHeadquartersIdentityExportSourceV1_(acquisition) {
  if (!acquisition || !acquisition.spreadsheet || !acquisition.spreadsheetId ||
      !acquisition.expectedWorkbookTitle || !acquisition.sourceFingerprint) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_READ_INVALID');
  }
  assertHeadquartersIdentityWorkbookV1_(
    acquisition.spreadsheet,
    acquisition.spreadsheetId,
    acquisition.expectedWorkbookTitle
  );
  if (readHeadquartersIdentityExportSpreadsheetIdV1_() !== acquisition.spreadsheetId ||
      readHeadquartersIdentityExportExpectedWorkbookTitleV1_() !== acquisition.expectedWorkbookTitle) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CHANGED_DURING_EXPORT');
  }
  const finalSnapshot = readHeadquartersIdentityWorkbookSnapshotV1_(acquisition.spreadsheet);
  if (fingerprintHeadquartersIdentitySourceV1_(finalSnapshot) !== acquisition.sourceFingerprint) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CHANGED_DURING_EXPORT');
  }
}

function readHeadquartersIdentityExportSpreadsheetIdV1_() {
  let spreadsheetId = '';
  try {
    spreadsheetId = String(PropertiesService.getScriptProperties()
      .getProperty(HEADQUARTERS_IDENTITY_EXPORT_SPREADSHEET_PROPERTY) || '').trim();
  } catch (error) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CONFIGURATION_UNAVAILABLE');
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId)) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CONFIGURATION_INVALID');
  }
  return spreadsheetId;
}

function readHeadquartersIdentityExportExpectedWorkbookTitleV1_() {
  let expectedWorkbookTitle = '';
  try {
    expectedWorkbookTitle = String(PropertiesService.getScriptProperties()
      .getProperty(HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE_PROPERTY) || '');
  } catch (error) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CONFIGURATION_UNAVAILABLE');
  }
  if (expectedWorkbookTitle !== expectedWorkbookTitle.trim() ||
      expectedWorkbookTitle.length < 1 || expectedWorkbookTitle.length > 300 ||
      /[\u0000-\u001F\u007F]/.test(expectedWorkbookTitle)) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CONFIGURATION_INVALID');
  }
  return expectedWorkbookTitle;
}

function assertHeadquartersIdentityWorkbookV1_(spreadsheet, spreadsheetId, expectedWorkbookTitle) {
  if (!spreadsheet || String(spreadsheet.getId() || '') !== spreadsheetId ||
      String(spreadsheet.getName() || '') !== expectedWorkbookTitle) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_IDENTITY_MISMATCH');
  }
}

function readHeadquartersIdentityWorkbookSnapshotV1_(spreadsheet) {
  const prospectSheet = spreadsheet.getSheetByName(MASTER_PROSPECT_SHEET);
  const clientSheet = spreadsheet.getSheetByName(CLIENTS_SHEET);
  if (!prospectSheet || !clientSheet) {
    throw createHeadquartersIdentityExportErrorV1_('REQUIRED_SHEET_MISSING');
  }
  return {
    prospects: readHeadquartersIdentitySheetSnapshotV1_(prospectSheet),
    clients: readHeadquartersIdentitySheetSnapshotV1_(clientSheet)
  };
}

function readHeadquartersIdentitySheetSnapshotV1_(sheet) {
  const before = getHeadquartersIdentitySheetMetadataV1_(sheet);
  if (before.lastColumn < 1 || before.maxRows < HEADQUARTERS_IDENTITY_EXPORT_HEADER_ROW) {
    throw createHeadquartersIdentityExportErrorV1_('REQUIRED_HEADER_MISSING');
  }
  const capturedRowCount = Math.max(
    before.lastRow - HEADQUARTERS_IDENTITY_EXPORT_HEADER_ROW + 1,
    1
  );
  const range = sheet.getRange(
    HEADQUARTERS_IDENTITY_EXPORT_HEADER_ROW,
    1,
    capturedRowCount,
    before.lastColumn
  );
  const displayValues = range.getDisplayValues();
  const formulas = range.getFormulas();
  const after = getHeadquartersIdentitySheetMetadataV1_(sheet);
  if (fingerprintHeadquartersIdentitySourceV1_(before) !== fingerprintHeadquartersIdentitySourceV1_(after)) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_CHANGED_DURING_EXPORT');
  }
  if (!Array.isArray(displayValues) || !Array.isArray(formulas) ||
      displayValues.length !== capturedRowCount || formulas.length !== capturedRowCount ||
      displayValues.some(function(row) { return !Array.isArray(row) || row.length !== before.lastColumn; }) ||
      formulas.some(function(row) { return !Array.isArray(row) || row.length !== before.lastColumn; })) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_READ_INVALID');
  }
  return {
    metadata: before,
    displayValues: displayValues,
    formulas: formulas
  };
}

function getHeadquartersIdentitySheetMetadataV1_(sheet) {
  return {
    sheetId: String(sheet.getSheetId()),
    name: String(sheet.getName()),
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    maxRows: sheet.getMaxRows()
  };
}

function fingerprintHeadquartersIdentitySourceV1_(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_READ_INVALID');
  }
}

function parseHeadquartersIdentitySheetSnapshotV1_(snapshot, requiredHeaders, idHeader, nameHeaders, lifecycle) {
  if (!snapshot || !snapshot.metadata || !Array.isArray(snapshot.displayValues) ||
      !Array.isArray(snapshot.formulas) || !snapshot.displayValues.length || !snapshot.formulas.length) {
    throw createHeadquartersIdentityExportErrorV1_('SOURCE_READ_INVALID');
  }
  const headerValues = snapshot.displayValues[0];
  const headerFormulas = snapshot.formulas[0];
  const headers = resolveHeadquartersIdentityHeadersV1_(headerValues, requiredHeaders);
  if (requiredHeaders.some(function(header) { return String(headerFormulas[headers[header]] || '') !== ''; })) {
    throw createHeadquartersIdentityExportErrorV1_('UNTRUSTED_HEADER_FORMULA');
  }
  if (snapshot.formulas.slice(1).some(function(row) {
    return row.some(function(value) { return String(value || '') !== ''; });
  })) {
    throw createHeadquartersIdentityExportErrorV1_('UNTRUSTED_SOURCE_FORMULA');
  }

  const seenIds = Object.create(null);
  const entries = [];
  snapshot.displayValues.slice(1).forEach(function(row) {
    const relevant = row.some(function(value) { return String(value || '').trim() !== ''; });
    if (!relevant) return;

    const recordId = requireHeadquartersIdentityRecordIdV1_(row[headers[idHeader]]);
    const duplicateKey = recordId.toLowerCase();
    if (seenIds[duplicateKey]) {
      throw createHeadquartersIdentityExportErrorV1_('DUPLICATE_RECORD_ID');
    }
    seenIds[duplicateKey] = true;

    const businessName = resolveHeadquartersIdentityBusinessNameV1_(row, headers, nameHeaders);
    const website = String(row[headers.Website] || '').trim();
    const domain = parseHeadquartersIdentityDomainV1_(website);
    entries.push({
      recordId: recordId,
      lifecycle: lifecycle,
      businessName: businessName,
      domains: domain ? [domain] : []
    });
  });

  return { entries: entries };
}

function resolveHeadquartersIdentityHeadersV1_(headerValues, requiredHeaders) {
  const indexes = {};
  const duplicates = {};
  headerValues.forEach(function(value, index) {
    const header = String(value || '').trim();
    if (!header) return;
    if (Object.prototype.hasOwnProperty.call(indexes, header)) {
      duplicates[header] = true;
      return;
    }
    indexes[header] = index;
  });
  if (requiredHeaders.some(function(header) { return duplicates[header]; })) {
    throw createHeadquartersIdentityExportErrorV1_('AMBIGUOUS_REQUIRED_HEADER');
  }
  if (requiredHeaders.some(function(header) { return !Object.prototype.hasOwnProperty.call(indexes, header); })) {
    throw createHeadquartersIdentityExportErrorV1_('REQUIRED_HEADER_MISSING');
  }
  return indexes;
}

function requireHeadquartersIdentityRecordIdV1_(value) {
  const recordId = String(value || '');
  if (recordId !== recordId.trim() || !HEADQUARTERS_IDENTITY_EXPORT_SAFE_ID.test(recordId)) {
    throw createHeadquartersIdentityExportErrorV1_('RECORD_ID_INVALID');
  }
  return recordId;
}

function resolveHeadquartersIdentityBusinessNameV1_(row, headers, nameHeaders) {
  for (let index = 0; index < nameHeaders.length; index += 1) {
    const rawValue = String(row[headers[nameHeaders[index]]] || '');
    if (!rawValue.trim()) continue;
    return requireHeadquartersIdentityBusinessNameV1_(rawValue);
  }
  throw createHeadquartersIdentityExportErrorV1_('BUSINESS_NAME_INVALID');
}

function requireHeadquartersIdentityBusinessNameV1_(value) {
  const businessName = String(value || '');
  if (businessName !== businessName.trim() || businessName.length < 1 || businessName.length > 300 ||
      /[\u0000-\u001F\u007F]/.test(businessName) ||
      !canonicalizeHeadquartersIdentityBusinessNameV1_(businessName)) {
    throw createHeadquartersIdentityExportErrorV1_('BUSINESS_NAME_INVALID');
  }
  return businessName;
}

function canonicalizeHeadquartersIdentityBusinessNameV1_(value) {
  const tokens = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const suffixes = {
    llc: true,
    inc: true,
    incorporated: true,
    corp: true,
    corporation: true,
    ltd: true,
    limited: true,
    co: true,
    company: true
  };
  while (tokens.length && suffixes[tokens[tokens.length - 1]]) tokens.pop();
  return tokens.join(' ');
}

function parseHeadquartersIdentityDomainV1_(value) {
  let input = String(value || '').trim();
  if (!input) return '';
  if (/\s|\\|%/.test(input) || /^\/\//.test(input)) {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }

  const scheme = input.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
  if (scheme) {
    const normalizedScheme = scheme[1].toLowerCase();
    if (normalizedScheme !== 'http' && normalizedScheme !== 'https') {
      throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
    }
    input = input.slice(scheme[0].length);
  } else if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(input)) {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }

  const authority = input.split(/[\/?#]/, 1)[0];
  if (!authority || authority.indexOf('@') !== -1 || authority.indexOf(':') !== -1) {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }
  let hostname = authority.toLowerCase();
  while (hostname.indexOf('www.') === 0) hostname = hostname.slice(4);
  if (!hostname || hostname.length > 253 || hostname.indexOf('.') === -1 || hostname.slice(-1) === '.') {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }

  const labels = hostname.split('.');
  if (labels.some(function(label) {
    return !label || label.length > 63 || !/^[a-z0-9-]+$/.test(label) ||
      label.charAt(0) === '-' || label.charAt(label.length - 1) === '-';
  })) {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }
  const topLevel = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(topLevel)) {
    throw createHeadquartersIdentityExportErrorV1_('WEBSITE_INVALID');
  }
  return hostname;
}

function validateHeadquartersIdentityEntryV1_(entry, seenIds) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
  }
  const recordId = requireHeadquartersIdentityRecordIdV1_(entry.recordId);
  const duplicateKey = recordId.toLowerCase();
  if (seenIds[duplicateKey]) {
    throw createHeadquartersIdentityExportErrorV1_('DUPLICATE_RECORD_ID');
  }
  seenIds[duplicateKey] = true;
  if (entry.lifecycle !== 'prospect' && entry.lifecycle !== 'client') {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
  }
  const businessName = requireHeadquartersIdentityBusinessNameV1_(entry.businessName);
  if (!Array.isArray(entry.domains) || entry.domains.length > 1) {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
  }
  const domains = [];
  for (let index = 0; index < entry.domains.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(entry.domains, index)) {
      throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
    }
    const domain = entry.domains[index];
    if (typeof domain !== 'string' || !domain || parseHeadquartersIdentityDomainV1_(domain) !== domain) {
      throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
    }
    domains.push(domain);
  }
  return {
    recordId: recordId,
    lifecycle: entry.lifecycle,
    businessName: businessName,
    domains: domains
  };
}

function appendValidatedHeadquartersIdentityEntriesV1_(sourceEntries, seenIds, entries) {
  for (let index = 0; index < sourceEntries.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(sourceEntries, index)) {
      throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
    }
    entries.push(validateHeadquartersIdentityEntryV1_(sourceEntries[index], seenIds));
  }
}

function assertDenseHeadquartersIdentityEntriesV1_(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(entries, index) ||
        !entries[index] || typeof entries[index] !== 'object' || Array.isArray(entries[index])) {
      throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
    }
  }
}

function buildHeadquartersIdentityExportV1FromSource_(source, generatedAt) {
  const now = new Date(generatedAt);
  if (isNaN(now.getTime()) || !source || !Array.isArray(source.prospects) || !Array.isArray(source.clients)) {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_INPUT_INVALID');
  }
  if (source.prospects.length + source.clients.length > HEADQUARTERS_IDENTITY_EXPORT_MAXIMUM_ENTRIES) {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_LIMIT_EXCEEDED');
  }

  const seenIds = Object.create(null);
  const entries = [];
  appendValidatedHeadquartersIdentityEntriesV1_(source.prospects, seenIds, entries);
  appendValidatedHeadquartersIdentityEntriesV1_(source.clients, seenIds, entries);
  entries.sort(function(left, right) {
    if (left.lifecycle !== right.lifecycle) return left.lifecycle < right.lifecycle ? -1 : 1;
    const leftId = left.recordId.toLowerCase();
    const rightId = right.recordId.toLowerCase();
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
  assertDenseHeadquartersIdentityEntriesV1_(entries);
  const expiresAt = new Date(now.getTime() + HEADQUARTERS_IDENTITY_EXPORT_FRESHNESS_MINUTES * 60000);
  const snapshot = {
    version: HEADQUARTERS_IDENTITY_EXPORT_VERSION,
    source: 'business-optimization-platform',
    complete: true,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    entries: entries
  };
  const canonical = JSON.stringify(snapshot);
  if (getHeadquartersIdentityUtf8ByteLengthV1_(canonical) > HEADQUARTERS_IDENTITY_EXPORT_MAXIMUM_BYTES) {
    throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_SIZE_LIMIT_EXCEEDED');
  }
  return snapshot;
}

function getHeadquartersIdentityUtf8ByteLengthV1_(value) {
  const text = String(value || '');
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x7F) {
      bytes += 1;
    } else if (code <= 0x7FF) {
      bytes += 2;
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      const next = text.charCodeAt(index + 1);
      if (next < 0xDC00 || next > 0xDFFF) {
        throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
      }
      bytes += 4;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      throw createHeadquartersIdentityExportErrorV1_('SNAPSHOT_ENTRY_INVALID');
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function createHeadquartersIdentityExportErrorV1_(code) {
  const error = new Error('Identity exclusion snapshot is unavailable.');
  error.code = code;
  return error;
}
