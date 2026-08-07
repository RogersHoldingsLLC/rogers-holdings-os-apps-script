/**
 * Canonical Business Snapshot intake for a future fixed-version Apps Script
 * library consumer. This file intentionally exposes no web handler.
 */

var BUSINESS_SNAPSHOT_SCHEMA_VERSION = 'business-snapshot.v1';
var BUSINESS_SNAPSHOT_OPERATION_PREFIX = 'INTAKE:';
var BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY = 'BOP_SPREADSHEET_ID';
var BUSINESS_SNAPSHOT_TIME_ZONE = 'America/New_York';
var BUSINESS_SNAPSHOT_LOCK_TIMEOUT_MS = 30000;
var BUSINESS_SNAPSHOT_ACCEPTED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
var BUSINESS_SNAPSHOT_ACCEPTED_AT_MAXIMUM_AGE_MS = 7 * 24 * 60 * 60 * 1000;
var BUSINESS_SNAPSHOT_FIELD_LENGTHS = {
  fullName: { minimum: 1, maximum: 120 },
  businessName: { minimum: 1, maximum: 140 },
  email: { minimum: 3, maximum: 254 },
  phone: { minimum: 0, maximum: 30 },
  website: { minimum: 0, maximum: 2048 },
  primaryChallenge: { minimum: 20, maximum: 2000 }
};
var BUSINESS_SNAPSHOT_ERROR_CODES = {
  VALIDATION: 'BUSINESS_SNAPSHOT_VALIDATION',
  DUPLICATE_ENTITY: 'BUSINESS_SNAPSHOT_DUPLICATE_ENTITY',
  LOCK_TIMEOUT: 'BUSINESS_SNAPSHOT_LOCK_TIMEOUT',
  CONFIGURATION: 'BUSINESS_SNAPSHOT_CONFIGURATION',
  TEMPORARY_FAILURE: 'BUSINESS_SNAPSHOT_TEMPORARY_FAILURE',
  RECONCILIATION_REQUIRED: 'BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED'
};
var BUSINESS_SNAPSHOT_REQUIRED_TRACKER_HEADERS = [
  'Company', 'Contact', 'Email', 'Phone', 'Website', 'Source',
  'Audit Outcome', 'Priority Tier', 'Audit Source', 'Status', 'Next Action',
  'Last Activity', 'Offer / Service', 'Moved to CRM', 'Notes', 'Prospect ID'
];
var BUSINESS_SNAPSHOT_PUBLIC_ENVIRONMENTS = ['staging', 'production'];

function BusinessSnapshotError(code, message, diagnostics, cause) {
  this.name = 'BusinessSnapshotError';
  this.code = code;
  this.message = message;
  this.diagnostics = diagnostics || null;
  this.cause = cause || null;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, BusinessSnapshotError);
  } else {
    this.stack = (new Error(message)).stack;
  }
  if (cause && cause.stack && this.stack) {
    this.stack += '\nCaused by: ' + cause.stack;
  }
}
BusinessSnapshotError.prototype = Object.create(Error.prototype);
BusinessSnapshotError.prototype.constructor = BusinessSnapshotError;

function createBusinessSnapshotError_(code, message, diagnostics, cause) {
  return new BusinessSnapshotError(code, message, diagnostics, cause);
}

function isBusinessSnapshotError_(error) {
  return error instanceof BusinessSnapshotError ||
    (
      error &&
      error.name === 'BusinessSnapshotError' &&
      Object.keys(BUSINESS_SNAPSHOT_ERROR_CODES).some(function(key) {
        return BUSINESS_SNAPSHOT_ERROR_CODES[key] === error.code;
      })
    );
}

function asBusinessSnapshotTemporaryFailure_(error, phase) {
  if (isBusinessSnapshotError_(error)) return error;
  return createBusinessSnapshotError_(
    BUSINESS_SNAPSHOT_ERROR_CODES.TEMPORARY_FAILURE,
    'Business Snapshot intake encountered a temporary failure.',
    {
      phase: phase || 'processing',
      originalErrorName: error && error.name ? error.name : null,
      originalErrorMessage: error && error.message ? error.message : String(error)
    },
    error
  );
}

/**
 * Range.setValues interprets leading "=" as a formula. Prefixing the input
 * marker forces Sheets to retain the value as literal text while displaying
 * the original user text. Other strings, including international phone
 * numbers beginning with "+", remain unchanged.
 */
function toBusinessSnapshotSheetLiteral_(value) {
  return typeof value === 'string' && value.charAt(0) === '=' ? "'" + value : value;
}

function literalizeBusinessSnapshotSheetRow_(rowValues) {
  return rowValues.map(toBusinessSnapshotSheetLiteral_);
}

function parseBusinessSnapshotCalendarKey_(value) {
  const key = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error('Business Snapshot calendar date key is invalid.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) {
    throw new Error('Business Snapshot calendar date key is invalid.');
  }
  return date;
}

function formatBusinessSnapshotCalendarKey_(date) {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

/**
 * Compares calendar-date keys by advancing UTC calendar days. It never
 * subtracts operational timestamps or assumes that a local day is 24 hours.
 */
function businessSnapshotCalendarDayDifference_(fromKey, toKey) {
  const normalizedFromKey = String(fromKey || '').trim();
  const normalizedToKey = String(toKey || '').trim();
  let cursor = parseBusinessSnapshotCalendarKey_(normalizedFromKey);
  parseBusinessSnapshotCalendarKey_(normalizedToKey);
  if (normalizedFromKey === normalizedToKey) return 0;
  const direction = normalizedFromKey < normalizedToKey ? 1 : -1;
  let difference = 0;
  while (formatBusinessSnapshotCalendarKey_(cursor) !== normalizedToKey) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    difference += direction;
    if (Math.abs(difference) > 36600) {
      throw new Error('Business Snapshot calendar date difference exceeds the supported range.');
    }
  }
  return difference;
}

/**
 * Returns a date-only value that displays as the current Business Snapshot
 * business date in the destination spreadsheet, regardless of either the
 * spreadsheet or Apps Script project time zone.
 */
function getBusinessSnapshotFollowUpDateContext_(ss, now) {
  let spreadsheetTimeZone = '';
  let businessDateKey = '';
  let dueDate = null;
  try {
    spreadsheetTimeZone = String(ss.getSpreadsheetTimeZone() || '').trim();
    if (!spreadsheetTimeZone) throw new Error('Spreadsheet time zone is unavailable.');
    businessDateKey = Utilities.formatDate(
      now instanceof Date ? now : new Date(),
      BUSINESS_SNAPSHOT_TIME_ZONE,
      'yyyy-MM-dd'
    );
    dueDate = Utilities.parseDate(businessDateKey, spreadsheetTimeZone, 'yyyy-MM-dd');
  } catch (error) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.CONFIGURATION,
      'Business Snapshot date configuration is invalid.',
      { businessTimeZone: BUSINESS_SNAPSHOT_TIME_ZONE },
      error
    );
  }
  if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.CONFIGURATION,
      'Business Snapshot due date could not be normalized.',
      { businessTimeZone: BUSINESS_SNAPSHOT_TIME_ZONE }
    );
  }
  return {
    dueDate: dueDate,
    daysUntilDue: businessSnapshotCalendarDayDifference_(businessDateKey, businessDateKey)
  };
}

/**
 * Safe boundary for a future anonymous receiver. These functions deliberately
 * reconstruct the public object instead of copying properties from internal
 * results or errors.
 */
function ingestBusinessSnapshotPublic(input, environment) {
  let requestId = '';
  let publicEnvironment = 'staging';
  try {
    requestId = normalizeBusinessSnapshotPublicRequestId_(input == null ? '' : input.requestId);
    publicEnvironment = normalizeBusinessSnapshotPublicEnvironment_(environment);
    const result = ingestBusinessSnapshot(input);
    return {
      ok: true,
      environment: publicEnvironment,
      requestId: requestId,
      prospectId: String(result.prospectId || ''),
      retry: result.retry === true
    };
  } catch (error) {
    let code = BUSINESS_SNAPSHOT_ERROR_CODES.TEMPORARY_FAILURE;
    try {
      code = publicBusinessSnapshotErrorCode_(error);
    } catch (ignored) {
      code = BUSINESS_SNAPSHOT_ERROR_CODES.TEMPORARY_FAILURE;
    }
    return {
      ok: false,
      environment: publicEnvironment,
      requestId: requestId,
      code: code
    };
  }
}

function normalizeBusinessSnapshotPublicEnvironment_(environment) {
  const value = String(environment || '').trim().toLowerCase();
  return BUSINESS_SNAPSHOT_PUBLIC_ENVIRONMENTS.indexOf(value) === -1 ? 'staging' : value;
}

function normalizeBusinessSnapshotPublicRequestId_(requestId) {
  const value = String(requestId || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
    ? value
    : '';
}

function publicBusinessSnapshotErrorCode_(error) {
  const code = error && error.code;
  const allowlisted = Object.keys(BUSINESS_SNAPSHOT_ERROR_CODES).some(function(key) {
    return BUSINESS_SNAPSHOT_ERROR_CODES[key] === code;
  });
  return allowlisted ? code : BUSINESS_SNAPSHOT_ERROR_CODES.TEMPORARY_FAILURE;
}

/**
 * Creates one Lead Found prospect from a validated receiver payload.
 * Safe retries return the Prospect ID associated with INTAKE:<requestId>.
 */
function ingestBusinessSnapshot(input) {
  let submission = null;
  let lock = null;
  let lockAcquired = false;
  let result = null;
  let pendingError = null;
  let phase = 'input normalization';
  try {
    submission = normalizeBusinessSnapshotInput_(input);
    phase = 'identity validation';
    validateBusinessSnapshotIdentity_(submission);
    phase = 'lock acquisition';
    try {
      lock = LockService.getScriptLock();
      lockAcquired = lock.tryLock(BUSINESS_SNAPSHOT_LOCK_TIMEOUT_MS);
    } catch (error) {
      throw createBusinessSnapshotError_(
        BUSINESS_SNAPSHOT_ERROR_CODES.LOCK_TIMEOUT,
        'Business Snapshot intake could not acquire the script lock.',
        { timeoutMs: BUSINESS_SNAPSHOT_LOCK_TIMEOUT_MS },
        error
      );
    }
    if (!lockAcquired) {
      throw createBusinessSnapshotError_(
        BUSINESS_SNAPSHOT_ERROR_CODES.LOCK_TIMEOUT,
        'Business Snapshot intake timed out waiting for the script lock.',
        { timeoutMs: BUSINESS_SNAPSHOT_LOCK_TIMEOUT_MS }
      );
    }
    phase = 'spreadsheet resolution';
    const ss = getBusinessSnapshotSpreadsheet_();
    const operationKey = BUSINESS_SNAPSHOT_OPERATION_PREFIX + submission.requestId;
    phase = 'idempotency lookup';
    const existing = findBusinessSnapshotIntakeActivity_(ss, operationKey);
    if (existing) {
      assertBusinessSnapshotRetryFollowUpExists_(ss, existing.prospectId);
      result = {
        accepted: true,
        retry: true,
        submissionId: existing.prospectId,
        prospectId: existing.prospectId,
        operationKey: operationKey
      };
    } else {
      phase = 'new submission validation';
      validateBusinessSnapshotInput_(submission);
      phase = 'duplicate entity check';
      assertBusinessSnapshotProspectIsNew_(ss, submission);
      phase = 'prospect creation';
      result = createBusinessSnapshotProspect_(ss, submission, operationKey);
    }
  } catch (error) {
    pendingError = asBusinessSnapshotTemporaryFailure_(error, phase);
  }

  if (lockAcquired) {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      if (pendingError) {
        const diagnostics = pendingError.diagnostics || {};
        diagnostics.lockReleaseFailure = {
          name: releaseError && releaseError.name ? releaseError.name : null,
          message: releaseError && releaseError.message
            ? releaseError.message
            : String(releaseError)
        };
        pendingError.diagnostics = diagnostics;
        if (releaseError && releaseError.stack && pendingError.stack) {
          pendingError.stack += '\nLock release failure: ' + releaseError.stack;
        }
      } else {
        pendingError = asBusinessSnapshotTemporaryFailure_(releaseError, 'lock release');
      }
    }
  }

  if (pendingError) throw pendingError;
  return result;
}

function getBusinessSnapshotSpreadsheet_() {
  let spreadsheetId;
  try {
    spreadsheetId = String(
      PropertiesService.getScriptProperties().getProperty(BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY) || ''
    ).trim();
  } catch (error) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.CONFIGURATION,
      'Business Snapshot spreadsheet configuration could not be read.',
      { property: BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY },
      error
    );
  }
  if (!spreadsheetId) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.CONFIGURATION,
      'BOP_SPREADSHEET_ID is required for Business Snapshot intake.',
      { property: BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY }
    );
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId)) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.CONFIGURATION,
      'BOP_SPREADSHEET_ID is invalid.',
      { property: BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY }
    );
  }
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.TEMPORARY_FAILURE,
      'The configured BOP spreadsheet could not be opened.',
      { property: BUSINESS_SNAPSHOT_SPREADSHEET_PROPERTY },
      error
    );
  }
}

function normalizeBusinessSnapshotInput_(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    schemaVersion: String(source.schemaVersion || '').trim(),
    requestId: String(source.requestId || '').trim().toLowerCase(),
    fullName: normalizeBusinessSnapshotSingleLine_(source.fullName),
    businessName: normalizeBusinessSnapshotSingleLine_(source.businessName),
    email: normalizeBusinessSnapshotSingleLine_(source.email).toLowerCase(),
    phone: normalizeBusinessSnapshotSingleLine_(source.phone),
    website: normalizeBusinessSnapshotSingleLine_(source.website),
    primaryChallenge: normalizeBusinessSnapshotMultiline_(source.primaryChallenge),
    consent: String(source.consent || '').trim(),
    acceptedAt: normalizeBusinessSnapshotAcceptedAt_(source.acceptedAt)
  };
}

function validateBusinessSnapshotInput_(submission) {
  validateBusinessSnapshotIdentity_(submission);
  Object.keys(BUSINESS_SNAPSHOT_FIELD_LENGTHS).forEach(function(field) {
    const limits = BUSINESS_SNAPSHOT_FIELD_LENGTHS[field];
    const length = submission[field].length;
    if (length < limits.minimum || length > limits.maximum) {
      throwBusinessSnapshotValidationError_(
        'Business Snapshot ' + field + ' must be between ' +
          limits.minimum + ' and ' + limits.maximum + ' characters.',
        field,
        { minimum: limits.minimum, maximum: limits.maximum, actual: length }
      );
    }
  });
  if (!submission.acceptedAt) {
    throwBusinessSnapshotValidationError_('Business Snapshot acceptedAt must be a valid date.', 'acceptedAt');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(submission.email)) {
    throwBusinessSnapshotValidationError_('Business Snapshot email is invalid.', 'email');
  }
  if (submission.website && !/^https?:\/\/[^\s]+$/i.test(submission.website)) {
    throwBusinessSnapshotValidationError_(
      'Business Snapshot website must be an absolute HTTP(S) URL.',
      'website'
    );
  }
  const now = Date.now();
  const acceptedAtMs = submission.acceptedAt.getTime();
  if (acceptedAtMs > now + BUSINESS_SNAPSHOT_ACCEPTED_AT_FUTURE_TOLERANCE_MS) {
    throwBusinessSnapshotValidationError_(
      'Business Snapshot acceptedAt exceeds the permitted future tolerance.',
      'acceptedAt',
      { futureToleranceMs: BUSINESS_SNAPSHOT_ACCEPTED_AT_FUTURE_TOLERANCE_MS }
    );
  }
  if (acceptedAtMs < now - BUSINESS_SNAPSHOT_ACCEPTED_AT_MAXIMUM_AGE_MS) {
    throwBusinessSnapshotValidationError_(
      'Business Snapshot acceptedAt is older than the permitted maximum age.',
      'acceptedAt',
      { maximumAgeMs: BUSINESS_SNAPSHOT_ACCEPTED_AT_MAXIMUM_AGE_MS }
    );
  }
  if (submission.consent !== 'business-snapshot-contact-consent-v1') {
    throwBusinessSnapshotValidationError_('Business Snapshot consent is invalid.', 'consent');
  }
}

function validateBusinessSnapshotIdentity_(submission) {
  if (submission.schemaVersion !== BUSINESS_SNAPSHOT_SCHEMA_VERSION) {
    throwBusinessSnapshotValidationError_('Unsupported Business Snapshot schemaVersion.', 'schemaVersion');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submission.requestId)) {
    throwBusinessSnapshotValidationError_('Business Snapshot requestId must be a UUID v4.', 'requestId');
  }
}

function throwBusinessSnapshotValidationError_(message, field, diagnostics) {
  const details = diagnostics || {};
  details.field = field;
  throw createBusinessSnapshotError_(
    BUSINESS_SNAPSHOT_ERROR_CODES.VALIDATION,
    message,
    details
  );
}

function createBusinessSnapshotProspect_(ss, submission, operationKey) {
  const prospectSheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const activitySheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const followUpSheet = getRequiredSheet_(ss, FOLLOW_UPS_SHEET);
  const table = getHeaderTable_(prospectSheet, BUSINESS_SNAPSHOT_REQUIRED_TRACKER_HEADERS);
  const before = {
    prospectLastRow: prospectSheet.getLastRow(),
    activityLastRow: activitySheet.getLastRow(),
    followUpLastRow: followUpSheet.getLastRow(),
    followUpSnapshot: snapshotBusinessSnapshotRows_(followUpSheet)
  };
  const rowNumber = Math.max(before.prospectLastRow + 1, table.headerRow + 1);
  let prospectId = '';
  let prospectWritten = false;
  let followUpId = '';
  const followUpActivityOperationKey = operationKey + ':FOLLOWUP';

  try {
    const followUpDateContext = getBusinessSnapshotFollowUpDateContext_(ss, new Date());
    const rowValues = new Array(table.lastColumn).fill('');
    setIfHeader_(rowValues, table.headers, 'Company', submission.businessName);
    setIfHeader_(rowValues, table.headers, 'Contact', submission.fullName);
    setIfHeader_(rowValues, table.headers, 'Email', submission.email);
    setIfHeader_(rowValues, table.headers, 'Phone', submission.phone);
    setIfHeader_(rowValues, table.headers, 'Website', submission.website);
    setIfHeader_(rowValues, table.headers, 'Source', 'Website');
    setIfHeader_(rowValues, table.headers, 'Audit Outcome', 'Not Audited');
    setIfHeader_(rowValues, table.headers, 'Priority Tier', 'D - Nurture');
    setIfHeader_(rowValues, table.headers, 'Audit Source', 'Website Audit Tool API');
    setIfHeader_(rowValues, table.headers, 'Status', 'Lead Found');
    setIfHeader_(rowValues, table.headers, 'Next Action', 'Generate Executive Brief');
    setIfHeader_(rowValues, table.headers, 'Last Activity', submission.acceptedAt);
    setIfHeader_(rowValues, table.headers, 'Offer / Service', 'Business Snapshot');
    setIfHeader_(rowValues, table.headers, 'Moved to CRM', 'No');
    setIfHeader_(rowValues, table.headers, 'Notes', submission.primaryChallenge);
    prospectSheet.getRange(rowNumber, 1, 1, table.lastColumn)
      .setValues([literalizeBusinessSnapshotSheetRow_(rowValues)]);
    prospectWritten = true;

    const context = {
      ss: ss,
      sheet: prospectSheet,
      selectedRow: rowNumber,
      table: table,
      values: rowValues
    };
    prospectId = ensureProspectRevenueId_(context);
    logProspectRevenueActivity_(
      context,
      'Business Snapshot Intake',
      'Website Business Snapshot request accepted.',
      operationKey
    );
    followUpId = generateUniqueBusinessSnapshotFollowUpId_(followUpSheet, submission.businessName);
    appendBusinessSnapshotFollowUp_(
      ss,
      followUpSheet,
      prospectSheet,
      table.headers,
      rowNumber,
      prospectId,
      followUpId,
      followUpActivityOperationKey,
      followUpDateContext
    );
    assertBusinessSnapshotFollowUpCreated_(
      followUpSheet,
      before.followUpSnapshot,
      followUpId,
      prospectId
    );

    return {
      accepted: true,
      retry: false,
      submissionId: prospectId,
      prospectId: prospectId,
      operationKey: operationKey
    };
  } catch (error) {
    const cleanupErrors = rollbackBusinessSnapshotIntake_(
      prospectSheet,
      activitySheet,
      followUpSheet,
      before,
      rowNumber,
      prospectId,
      operationKey,
      followUpId,
      followUpActivityOperationKey,
      prospectWritten
    );
    if (cleanupErrors.length) {
      throw createBusinessSnapshotError_(
        BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
        'Business Snapshot intake failed and reconciliation is required.',
        {
          cleanupErrors: cleanupErrors,
          originalErrorCode: error && error.code ? error.code : null,
          originalErrorMessage: error && error.message ? error.message : String(error)
        },
        error
      );
    }
    throw error;
  }
}

function findBusinessSnapshotIntakeActivity_(ss, operationKey) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, ['Prospect ID', 'Operation Key']);
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  if (!count) return null;
  const values = sheet.getRange(start, 1, count, table.lastColumn).getValues();
  const matches = values.reduce(function(rows, row, index) {
    if (String(getValueByHeader_(row, table.headers, 'Operation Key') || '') === operationKey) {
      rows.push({ values: row, rowNumber: start + index });
    }
    return rows;
  }, []);
  if (matches.length > 1) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Business Snapshot operation key is ambiguous; reconciliation is required.',
      { operationKey: operationKey, matchCount: matches.length }
    );
  }
  if (matches.length === 1) {
    const prospectId = String(getValueByHeader_(matches[0].values, table.headers, 'Prospect ID') || '').trim();
    if (!prospectId) {
      throw createBusinessSnapshotError_(
        BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
        'Business Snapshot retry record has no Prospect ID; reconciliation is required.',
        { operationKey: operationKey, activityRow: matches[0].rowNumber }
      );
    }
    assertBusinessSnapshotProspectIdExists_(ss, prospectId);
    return { prospectId: prospectId, rowNumber: matches[0].rowNumber };
  }
  return null;
}

function assertBusinessSnapshotProspectIdExists_(ss, prospectId) {
  const sheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const table = getHeaderTable_(sheet, ['Prospect ID']);
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const values = count ? sheet.getRange(start, table.headers['Prospect ID'], count, 1).getDisplayValues() : [];
  const matches = values.filter(function(row) {
    return String(row[0] || '').trim().toLowerCase() === prospectId.toLowerCase();
  });
  if (matches.length !== 1) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Business Snapshot retry Prospect ID is missing or ambiguous; reconciliation is required.',
      { prospectId: prospectId, matchCount: matches.length }
    );
  }
}

function assertBusinessSnapshotRetryFollowUpExists_(ss, prospectId) {
  const sheet = getRequiredSheet_(ss, FOLLOW_UPS_SHEET);
  const table = getHeaderTable_(sheet, [
    'Related Prospect ID', 'Follow-Up Type', 'Current Status', 'Completed'
  ]);
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const values = count ? sheet.getRange(start, 1, count, table.lastColumn).getValues() : [];
  const matches = values.filter(function(row) {
    const relatedProspectId = String(
      getValueByHeader_(row, table.headers, 'Related Prospect ID') || ''
    ).trim();
    const followUpType = String(
      getValueByHeader_(row, table.headers, 'Follow-Up Type') || ''
    ).trim();
    const currentStatus = String(
      getValueByHeader_(row, table.headers, 'Current Status') || ''
    ).trim();
    const completed = isFollowUpCompletedValue_(
      getValueByHeader_(row, table.headers, 'Completed')
    );
    return relatedProspectId === prospectId &&
      (followUpType === 'Executive Brief' || followUpType === 'Executive Snapshot') &&
      currentStatus === 'Lead Found' &&
      !completed;
  });
  if (matches.length !== 1) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Business Snapshot retry Follow-Up is missing or ambiguous; reconciliation is required.',
      { prospectId: prospectId, matchCount: matches.length }
    );
  }
}

function assertBusinessSnapshotProspectIsNew_(ss, submission) {
  const sheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const table = getHeaderTable_(sheet, ['Company', 'Email']);
  const start = table.headerRow + 1;
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  if (!count) return;
  const values = sheet.getRange(start, 1, count, table.lastColumn).getValues();
  const companyKey = normalizeLookupKey_(submission.businessName);
  const emailKey = submission.email.toLowerCase();
  const duplicate = values.some(function(row) {
    const existingCompany = normalizeLookupKey_(getValueByHeader_(row, table.headers, 'Company'));
    const existingEmail = String(getValueByHeader_(row, table.headers, 'Email') || '').trim().toLowerCase();
    return (companyKey && existingCompany === companyKey) ||
      (emailKey && existingEmail === emailKey);
  });
  if (duplicate) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.DUPLICATE_ENTITY,
      'A matching company or email exists without this requestId.',
      { company: submission.businessName, email: submission.email }
    );
  }
}

function rollbackBusinessSnapshotIntake_(
  prospectSheet,
  activitySheet,
  followUpSheet,
  before,
  rowNumber,
  prospectId,
  operationKey,
  followUpId,
  followUpActivityOperationKey,
  prospectWritten
) {
  const errors = [];
  rollbackBusinessSnapshotRowsByIdentity_(
    followUpSheet, 'Follow-Up ID', followUpId, errors, 'Follow-Up', before.followUpLastRow
  );
  rollbackBusinessSnapshotRowsByIdentity_(
    activitySheet, 'Operation Key', followUpActivityOperationKey, errors, 'Follow-Up activity', before.activityLastRow
  );
  rollbackBusinessSnapshotRowsByIdentity_(
    activitySheet, 'Operation Key', operationKey, errors, 'Intake activity', before.activityLastRow
  );
  if (prospectId) {
    rollbackBusinessSnapshotRowsByIdentity_(
      prospectSheet, 'Prospect ID', prospectId, errors, 'Prospect'
    );
  } else if (prospectWritten) {
    try {
      if (prospectSheet.getLastRow() === rowNumber) prospectSheet.deleteRow(rowNumber);
      else errors.push('prospect cleanup could not prove the unidentified appended row');
    } catch (error) {
      errors.push('prospect cleanup failed');
    }
  }
  if (!businessSnapshotRowsEqual_(snapshotBusinessSnapshotRows_(followUpSheet), before.followUpSnapshot)) {
    errors.push('pre-existing Follow-Up state was changed or cleanup could not be proven');
  }
  return errors;
}

function rollbackBusinessSnapshotRowsByIdentity_(sheet, header, expected, errors, label, originalLastRow) {
  if (!expected) return;
  try {
    const table = getHeaderTable_(sheet, [header]);
    const allMatches = findRowsByExactHeaderValue_(sheet, table, header, expected);
    const matches = allMatches.filter(function(rowNumber) {
      return originalLastRow == null || rowNumber > originalLastRow;
    });
    if (allMatches.length !== matches.length) {
      errors.push(label + ' cleanup found the identifier in pre-existing state');
      return;
    }
    if (matches.length > 1) {
      errors.push(label + ' cleanup found an ambiguous identifier');
      return;
    }
    matches.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });
    if (findRowsByExactHeaderValue_(sheet, getHeaderTable_(sheet, [header]), header, expected).length) {
      errors.push(label + ' cleanup could not prove removal');
    }
  } catch (error) {
    errors.push(label + ' cleanup failed');
  }
}

function snapshotBusinessSnapshotRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  return lastRow && lastColumn
    ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
    : [];
}

function businessSnapshotRowsEqual_(left, right) {
  if (left.length !== right.length) return false;
  return left.every(function(row, rowIndex) {
    if (row.length !== right[rowIndex].length) return false;
    return row.every(function(value, columnIndex) {
      const other = right[rowIndex][columnIndex];
      if (value instanceof Date || other instanceof Date) {
        return value instanceof Date && other instanceof Date &&
          value.getTime() === other.getTime();
      }
      return value === other;
    });
  });
}

function assertBusinessSnapshotFollowUpCreated_(sheet, beforeSnapshot, followUpId, prospectId) {
  const table = getHeaderTable_(sheet, ['Follow-Up ID', 'Related Prospect ID']);
  const matches = findRowsByExactHeaderValue_(sheet, table, 'Follow-Up ID', followUpId);
  if (matches.length !== 1) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Business Snapshot Follow-Up creation could not be proven.',
      { followUpMatchCount: matches.length }
    );
  }
  const row = sheet.getRange(matches[0], 1, 1, table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(row, table.headers, 'Related Prospect ID') || '').trim() !== prospectId) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Business Snapshot Follow-Up is not linked to the exact Prospect ID.'
    );
  }
  const currentSnapshot = snapshotBusinessSnapshotRows_(sheet);
  const currentPrefix = currentSnapshot.slice(0, beforeSnapshot.length);
  if (!businessSnapshotRowsEqual_(currentPrefix, beforeSnapshot)) {
    throw createBusinessSnapshotError_(
      BUSINESS_SNAPSHOT_ERROR_CODES.RECONCILIATION_REQUIRED,
      'Pre-existing Follow-Up state changed during Business Snapshot intake.'
    );
  }
}

function normalizeBusinessSnapshotSingleLine_(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBusinessSnapshotMultiline_(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map(function(line) { return line.replace(/[ \t]+/g, ' ').trim(); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeBusinessSnapshotAcceptedAt_(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value || ''));
  return isNaN(date.getTime()) ? null : date;
}
