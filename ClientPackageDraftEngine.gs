/**
 * Acceptance-safe complete client-package Gmail draft transaction.
 * This boundary never renders documents and never sends email.
 */

var CLIENT_PACKAGE_DRAFT_CONFIRMATION = 'CREATE CLIENT PACKAGE DRAFT';
var CLIENT_PACKAGE_DRAFT_ACTIVITY_TYPE = 'Client Package Gmail Draft Created';
var CLIENT_PACKAGE_SENT_CONFIRMATION = 'RECONCILE SENT CLIENT PACKAGE';
var CLIENT_PACKAGE_SENT_ACTIVITY_TYPE = 'Complete Client Package Sent';
var CLIENT_PACKAGE_DRAFT_FILE_NAMES = [
  'Executive Brief.pdf',
  'Digital Business Assessment.pdf',
  'Improvement Plan.pdf'
];
var CLIENT_PACKAGE_DRAFT_DOCUMENT_TOKENS = {
  'Executive Brief.pdf': 'EXECUTIVEBRIEF',
  'Digital Business Assessment.pdf': 'DIGITALBUSINESSASSESSMENT',
  'Improvement Plan.pdf': 'IMPROVEMENTPLAN'
};

function createClientPackageGmailDraft() {
  const context = getSelectedProspectContext_([
    'Company', 'Email', 'Prospect ID', 'Next Action', 'Last Activity', 'Gmail Draft Created'
  ]);
  if (!context) return '';
  const ui = SpreadsheetApp.getUi();
  const linkPrompt = ui.prompt(
    'Create Complete Client Package Gmail Draft',
    'Paste the Return Link. It must be one absolute HTTPS URL. Nothing changes until the link is validated and you complete the final confirmation.',
    ui.ButtonSet.OK_CANCEL
  );
  if (linkPrompt.getSelectedButton() !== ui.Button.OK) return '';
  let returnLink;
  try {
    returnLink = validateClientPackageReturnLink_(linkPrompt.getResponseText());
  } catch (error) {
    ui.alert('Client Package Gmail Draft', error.message || String(error), ui.ButtonSet.OK);
    return '';
  }
  const confirmation = ui.prompt(
    'Final Confirmation',
    'Validated Return Link:\n' + returnLink + '\n\nType ' + CLIENT_PACKAGE_DRAFT_CONFIRMATION + ' exactly to create one Gmail draft. No email will be sent.',
    ui.ButtonSet.OK_CANCEL
  );
  if (confirmation.getSelectedButton() !== ui.Button.OK) return '';
  if (confirmation.getResponseText() !== CLIENT_PACKAGE_DRAFT_CONFIRMATION) {
    ui.alert('Client Package Gmail Draft', 'Confirmation did not match exactly. No Gmail draft or workbook record was changed.', ui.ButtonSet.OK);
    return '';
  }
  try {
    const result = createClientPackageGmailDraftTransactional_(context, returnLink);
    ui.alert(
      'Client Package Gmail Draft',
      result.status === 'already-completed'
        ? 'The exact client-package draft was already completed and verified. No timestamps or records changed.'
        : 'The complete client-package Gmail draft was created and verified. No email was sent.',
      ui.ButtonSet.OK
    );
    return serializeClientPackageDraftResult_(result);
  } catch (error) {
    ui.alert('Client Package Gmail Draft', error.message || String(error), ui.ButtonSet.OK);
    return '';
  }
}

function validateClientPackageReturnLink_(rawValue) {
  const raw = String(rawValue === null || rawValue === undefined ? '' : rawValue);
  if (/\r|\n/.test(raw)) throw new Error('Return Link must be a single line.');
  const value = raw.trim();
  if (!value) throw new Error('Return Link is required.');
  if (/\s/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Return Link contains unsupported whitespace or control characters.');
  const scheme = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
  if (!scheme) throw new Error('Return Link must be one valid absolute HTTPS URL.');
  if (String(scheme[1]).toLowerCase() === 'http') throw new Error('Return Link must use HTTPS.');
  if (String(scheme[1]).toLowerCase() !== 'https') throw new Error('Return Link is unsupported.');
  if (/\\|[<>"']/.test(value) || /%(?![0-9A-Fa-f]{2})/.test(value)) throw new Error('Return Link is malformed or unsupported.');
  const remainder = value.slice(scheme[0].length);
  const authorityEndMatch = remainder.search(/[\/?#]/);
  const authority = authorityEndMatch === -1 ? remainder : remainder.slice(0, authorityEndMatch);
  if (!authority) throw new Error('Return Link must include a host.');
  if (authority.indexOf('@') !== -1) throw new Error('Return Link must not contain embedded credentials.');
  assertSupportedClientPackageHttpsAuthority_(authority);
  return value;
}

function assertSupportedClientPackageHttpsAuthority_(authority) {
  let host = String(authority);
  let port = '';
  if (host.charAt(0) === '[') {
    const ipv6 = host.match(/^(\[[0-9A-Fa-f:.]+\])(?::([0-9]{1,5}))?$/);
    if (!ipv6 || ipv6[1].indexOf(':') === -1) throw new Error('Return Link host is malformed or unsupported.');
    host = ipv6[1];
    port = ipv6[2] || '';
  } else {
    const colon = host.lastIndexOf(':');
    if (colon !== -1) {
      if (host.indexOf(':') !== colon) throw new Error('Return Link host is malformed or unsupported.');
      port = host.slice(colon + 1);
      host = host.slice(0, colon);
      if (!/^\d{1,5}$/.test(port)) throw new Error('Return Link port is malformed or unsupported.');
    }
    const normalizedHost = host.charAt(host.length - 1) === '.' ? host.slice(0, -1) : host;
    if (!normalizedHost || normalizedHost.length > 253) throw new Error('Return Link must include a valid host.');
    const labels = normalizedHost.split('.');
    if (labels.some(function(label) {
      return !label || label.length > 63 || !/^[A-Za-z0-9\u00A1-\uFFFF-]+$/.test(label) || label.charAt(0) === '-' || label.charAt(label.length - 1) === '-';
    })) throw new Error('Return Link host is malformed or unsupported.');
    if (labels.length === 4 && labels.every(function(label) { return /^\d+$/.test(label); }) && labels.some(function(label) { return Number(label) > 255; })) {
      throw new Error('Return Link host is malformed or unsupported.');
    }
  }
  if (port && Number(port) > 65535) throw new Error('Return Link port is malformed or unsupported.');
  return true;
}

function clientPackageDraftHashText_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function buildClientPackageDraftOperationKey_(prospectId, reference, returnLink) {
  return [
    'CLIENTPACKAGEDRAFT', String(prospectId), reference.findingSetId,
    reference.version, reference.fingerprint, clientPackageDraftHashText_(returnLink)
  ].join(':');
}

function buildClientPackageDraftContent_(prospect, returnLink) {
  const contactName = String(prospect.contact || '').trim();
  const greeting = contactName ? 'Hi ' + contactName + ',' : 'Hi ' + String(prospect.company || '').trim() + ' team,';
  const subject = 'Your complete business optimization package — ' + String(prospect.company || '').trim();
  const plainBody = [
    greeting,
    '',
    'I prepared your complete business optimization package for review. The attached documents are:',
    '- Executive Brief',
    '- Digital Business Assessment',
    '- Improvement Plan',
    '',
    'Return Link: ' + returnLink,
    '',
    'Please use the Return Link when you are ready to respond or continue the conversation.',
    '',
    'Best,',
    'Brian Keith Rogers',
    'Rogers Holdings LLC',
    'briankeith@rogersholdingsllc.com',
    '859-404-7300'
  ].join('\n');
  const htmlBody = [
    '<p>' + escapeHtml_(greeting) + '</p>',
    '<p>I prepared your complete business optimization package for review. The attached documents are:</p>',
    '<ul><li>Executive Brief</li><li>Digital Business Assessment</li><li>Improvement Plan</li></ul>',
    '<p><strong>Return Link:</strong> <a href="' + escapeHtml_(returnLink) + '">' + escapeHtml_(returnLink) + '</a></p>',
    '<p>Please use the Return Link when you are ready to respond or continue the conversation.</p>',
    '<p>Best,<br>Brian Keith Rogers<br>Rogers Holdings LLC<br>briankeith@rogersholdingsllc.com<br>859-404-7300</p>'
  ].join('');
  return { subject: subject, plainBody: plainBody, htmlBody: htmlBody, returnLink: returnLink };
}

function loadClientPackageDraftAuthority_(context) {
  const prospect = Object.assign({}, context.prospect || {}, {
    company: String(context.prospect.company || '').trim(),
    prospectId: String(context.prospect.prospectId || '').trim(),
    email: String(context.prospect.email || '').trim()
  });
  if (!prospect.prospectId || !prospect.email) throw new Error('The selected prospect requires an exact Prospect ID and recipient email. No changes were made.');
  const approved = loadApprovedFindingSetForGeneration_(prospect, {});
  return { prospect: prospect, reference: assertApprovedFindingSetReference_(approved.reference) };
}

function loadVerifiedClientPackagePdfFiles_(context, authority) {
  const folder = getAuditPackageFolder_(authority.prospect.company);
  if (!folder) throw new Error('The selected prospect package folder was not found. No changes were made.');
  const activeFiles = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) activeFiles.push(iterator.next());
  const unsafe = activeFiles.filter(function(file) {
    const name = String(file.getName() || '');
    return /\.pdf$/i.test(name) && (/^\.bop-(?:staging|backup|rollback)-/i.test(name) || CLIENT_PACKAGE_DRAFT_FILE_NAMES.indexOf(name) === -1);
  });
  if (unsafe.length) throw new Error('The package folder contains staged, backup, rollback, or ambiguous PDF artifacts. Reconcile the folder before creating a draft.');
  const files = CLIENT_PACKAGE_DRAFT_FILE_NAMES.map(function(name) {
    const matches = activeFiles.filter(function(file) { return String(file.getName()) === name && !file.isTrashed(); });
    if (matches.length !== 1) throw new Error('Exactly one active canonical ' + name + ' is required.');
    const file = matches[0];
    const expectedOperation = [
      'GOLDDOC', authority.prospect.prospectId, CLIENT_PACKAGE_DRAFT_DOCUMENT_TOKENS[name],
      authority.reference.findingSetId, authority.reference.version, authority.reference.fingerprint
    ].join(':');
    const generationReceipt = assertClientPackageGenerationReceipt_(context, authority, name, expectedOperation);
    const description = String(file.getDescription() || '');
    if (file.getMimeType() !== MimeType.PDF || file.getSize() <= 0) {
      throw new Error(name + ' does not match the selected prospect\'s approved immutable Finding Set authority.');
    }
    const hash = hashGoldStandardBlob_(file.getBlob());
    const artifactAuthority = assertClientPackageCanonicalPdfAuthority_(authority, name, description, hash, expectedOperation, generationReceipt);
    return { name: name, file: file, hash: hash, generationOperationKey: expectedOperation, correctionOperationKey: artifactAuthority.correctionOperationKey };
  });
  if (files.length !== 3) throw new Error('The client package must contain exactly three canonical PDF attachments.');
  return { folder: folder, files: files };
}

function assertClientPackageCanonicalPdfAuthority_(authority, fileName, description, artifactHash, originalOperationKey, generationReceipt) {
  const originalDescription = 'Generated by Business Optimization Platform. Operation ' + originalOperationKey + '. Artifact SHA-256 ' + artifactHash + '.';
  if (description === originalDescription) return { corrected: false, correctionOperationKey: '' };
  if (fileName !== 'Executive Brief.pdf') throw new Error(fileName + ' does not match its exact original GOLDDOC artifact authority.');
  const correctionKey = buildExecutiveBriefPdfCorrectionKey_(authority.prospect, authority.reference);
  const supportedMarker = 'Operation ' + correctionKey + '.';
  const correctionMarkerCount = description.split(supportedMarker).length - 1;
  if (correctionMarkerCount !== 1) throw new Error('Executive Brief.pdf correction authority is missing or duplicated.');
  const expectedDescription = executiveBriefCorrectionDescription_(correctionKey, artifactHash, originalOperationKey, generationReceipt.originalGeneratedAt);
  if (description !== expectedDescription) throw new Error('Executive Brief.pdf correction authority or original-generation lineage is invalid.');
  return { corrected: true, correctionOperationKey: correctionKey };
}

function assertClientPackageGenerationReceipt_(context, authority, fileName, operationKey) {
  const activity = findClientPackageDraftActivities_(context.ss, operationKey);
  if (activity.rows.length !== 1) throw new Error(fileName + ' requires exactly one matching GOLDDOC Activity receipt.');
  const row = activity.sheet.getRange(activity.rows[0], 1, 1, activity.table.lastColumn).getValues()[0];
  const expected = {
    'Company': authority.prospect.company,
    'Activity Type': fileName.replace('.pdf', '') + ' Generated',
    'Activity Notes': 'Generated ' + fileName + ' from approved Finding Quality snapshot ' + authority.reference.findingSetId + ' v' + authority.reference.version + '.',
    'Prospect ID': authority.prospect.prospectId,
    'Operation Key': operationKey
  };
  Object.keys(expected).forEach(function(header) {
    if (!activity.table.headers[header] || String(row[activity.table.headers[header] - 1]) !== String(expected[header])) throw new Error(fileName + ' GOLDDOC Activity authority mismatch: ' + header);
  });
  const activityDate = row[activity.table.headers.Date - 1];
  const originalGeneratedAt = findingQualityDateText_(activityDate);
  if (!activityDate || !originalGeneratedAt) throw new Error(fileName + ' GOLDDOC Activity timestamp is missing.');
  return { activityDate: activityDate, originalGeneratedAt: originalGeneratedAt };
}

function findClientPackageDraftActivities_(ss, operationKey) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Prospect ID', 'Operation Key']);
  return { sheet: sheet, table: table, rows: findRowsByExactHeaderValue_(sheet, table, 'Operation Key', operationKey) };
}

function clientPackageDraftActivityNote_(returnLink, subject) {
  return 'Created complete client-package Gmail draft. Subject: ' + subject + '. Return Link: ' + returnLink + '. Attachments: ' + CLIENT_PACKAGE_DRAFT_FILE_NAMES.join(', ') + '. No email was sent.';
}

function findExactClientPackageGmailDrafts_(recipient, subject) {
  return findExactGmailDraftMatches_(recipient, subject);
}

function assertClientPackageDraftReadback_(draft, recipient, content, files) {
  const message = draft.getMessage();
  if (normalizeGmailDraftRecipient_(message.getTo()) !== normalizeGmailDraftRecipient_(recipient) || String(message.getSubject()) !== content.subject) throw new Error('Gmail draft recipient or subject readback failed.');
  if (canonicalizeClientPackagePlainBody_(message.getPlainBody()) !== canonicalizeClientPackagePlainBody_(content.plainBody)) throw new Error('Gmail draft plain-body readback failed.');
  if (canonicalizeClientPackageHtmlBody_(message.getBody()) !== canonicalizeClientPackageHtmlBody_(content.htmlBody)) throw new Error('Gmail draft HTML-body readback failed.');
  const actualHtml = String(message.getBody() || '');
  const expectedLink = '<a href="' + escapeHtml_(content.returnLink) + '">' + escapeHtml_(content.returnLink) + '</a>';
  if (actualHtml.split(expectedLink).length - 1 !== 1) throw new Error('Gmail draft Return Link readback failed.');
  const attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  if (attachments.length !== 3) throw new Error('Gmail draft must contain exactly three attachments.');
  const actualAttachments = {};
  attachments.forEach(function(blob) {
    const name = String(blob.getName());
    if (actualAttachments[name]) throw new Error('Gmail draft contains a duplicate attachment named ' + name + '.');
    actualAttachments[name] = hashGoldStandardBlob_(blob);
  });
  files.forEach(function(item) {
    if (actualAttachments[item.name] !== item.hash) throw new Error('Gmail draft attachment readback failed at ' + item.name + '.');
  });
  return { draftId: String(draft.getId()), timestamp: message.getDate() };
}

function canonicalizeClientPackagePlainBody_(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
}

function canonicalizeClientPackageHtmlBody_(value) {
  let html = String(value || '').replace(/\r\n?/g, '\n').trim();
  const gmailWrapper = html.match(/^<div dir=(?:"ltr"|'ltr')>([\s\S]*)<\/div>$/i);
  if (gmailWrapper) html = gmailWrapper[1];
  return html.replace(/<br\s*\/?>/gi, '<br>').replace(/>\s+</g, '><').trim();
}

function assertClientPackageDraftWorkbookReceipt_(context, authority, operationKey, returnLink, content, files) {
  const activity = findClientPackageDraftActivities_(context.ss, operationKey);
  if (activity.rows.length !== 1) throw new Error('Exactly one matching client-package Activity receipt is required.');
  const activityRow = activity.sheet.getRange(activity.rows[0], 1, 1, activity.table.lastColumn).getValues()[0];
  const expected = {
    'Company': authority.prospect.company,
    'Activity Type': CLIENT_PACKAGE_DRAFT_ACTIVITY_TYPE,
    'Activity Notes': clientPackageDraftActivityNote_(returnLink, content.subject),
    'Prospect ID': authority.prospect.prospectId,
    'Operation Key': operationKey
  };
  Object.keys(expected).forEach(function(header) {
    if (!activity.table.headers[header] || String(activityRow[activity.table.headers[header] - 1]) !== String(expected[header])) throw new Error('Client-package Activity receipt mismatch: ' + header);
  });
  const row = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(row, context.table.headers, 'Gmail Draft Created')) !== 'Yes' || String(getValueByHeader_(row, context.table.headers, 'Next Action')) !== 'Confirm Improvement Plan Sent') throw new Error('Client-package Prospect state does not reconcile.');
  const activityDate = activityRow[activity.table.headers.Date - 1];
  const lastActivity = getValueByHeader_(row, context.table.headers, 'Last Activity');
  if (!activityDate || !lastActivity || new Date(activityDate).getTime() !== new Date(lastActivity).getTime()) throw new Error('Client-package workbook timestamps do not reconcile exactly.');
  return { activity: activity, activityRow: activity.rows[0], timestamp: lastActivity };
}

function createClientPackageGmailDraftTransactional_(context, returnLink) {
  returnLink = validateClientPackageReturnLink_(returnLink);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const authority = loadClientPackageDraftAuthority_(context);
    const packageFiles = loadVerifiedClientPackagePdfFiles_(context, authority);
    const content = buildClientPackageDraftContent_(authority.prospect, returnLink);
    const operationKey = buildClientPackageDraftOperationKey_(authority.prospect.prospectId, authority.reference, returnLink);
    const matches = findExactClientPackageGmailDrafts_(authority.prospect.email, content.subject);
    assertUnambiguousGmailDraftMatches_(matches, authority.prospect.email, content.subject);
    const existingActivity = findClientPackageDraftActivities_(context.ss, operationKey);
    if (matches.length === 1 || existingActivity.rows.length) {
      if (matches.length !== 1 || existingActivity.rows.length !== 1) throw new Error('A partial client-package draft operation requires reconciliation. No records were changed.');
      const gmailReceipt = assertClientPackageDraftReadback_(matches[0], authority.prospect.email, content, packageFiles.files);
      const workbookReceipt = assertClientPackageDraftWorkbookReceipt_(context, authority, operationKey, returnLink, content, packageFiles.files);
      return buildClientPackageDraftResult_('already-completed', operationKey, authority, packageFiles, gmailReceipt, workbookReceipt);
    }
    const before = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
    let draft = null;
    let activityRow = 0;
    let transactionStage = 'gmail-create-not-started';
    try {
      transactionStage = 'gmail-create-started';
      draft = GmailApp.createDraft(authority.prospect.email, content.subject, content.plainBody, {
        htmlBody: content.htmlBody,
        attachments: packageFiles.files.map(function(item) { return item.file.getBlob().setName(item.name); })
      });
      transactionStage = 'gmail-created-readback-pending';
      const gmailReceipt = assertClientPackageDraftReadback_(draft, authority.prospect.email, content, packageFiles.files);
      transactionStage = 'gmail-readback-verified';
      const after = before.slice();
      const now = new Date();
      setIfHeader_(after, context.table.headers, 'Gmail Draft Created', 'Yes');
      setIfHeader_(after, context.table.headers, 'Next Action', 'Confirm Improvement Plan Sent');
      setIfHeader_(after, context.table.headers, 'Last Activity', now);
      context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).setValues([after]);
      transactionStage = 'prospect-updated';
      const activity = findClientPackageDraftActivities_(context.ss, operationKey);
      if (activity.rows.length) throw new Error('Unexpected client-package Activity collision.');
      const rowValues = new Array(activity.table.lastColumn).fill('');
      setIfHeader_(rowValues, activity.table.headers, 'Date', now);
      setIfHeader_(rowValues, activity.table.headers, 'Company', authority.prospect.company);
      setIfHeader_(rowValues, activity.table.headers, 'Activity Type', CLIENT_PACKAGE_DRAFT_ACTIVITY_TYPE);
      setIfHeader_(rowValues, activity.table.headers, 'Activity Notes', clientPackageDraftActivityNote_(returnLink, content.subject));
      setIfHeader_(rowValues, activity.table.headers, 'Prospect ID', authority.prospect.prospectId);
      setIfHeader_(rowValues, activity.table.headers, 'Operation Key', operationKey);
      activityRow = Math.max(activity.sheet.getLastRow() + 1, activity.table.headerRow + 1);
      activity.sheet.getRange(activityRow, 1, 1, activity.table.lastColumn).setValues([literalizeBusinessSnapshotSheetRow_(rowValues)]);
      transactionStage = 'activity-appended';
      const workbookReceipt = assertClientPackageDraftWorkbookReceipt_(context, authority, operationKey, returnLink, content, packageFiles.files);
      transactionStage = 'transaction-verified';
      return buildClientPackageDraftResult_('completed', operationKey, authority, packageFiles, gmailReceipt, workbookReceipt);
    } catch (error) {
      const firstError = error && error.message ? error.message : String(error);
      console.error('Client-package transaction failure. Stage: ' + transactionStage + '. First exception: ' + firstError);
      let restored = true;
      const rollback = { activity: 'not-present', prospect: 'pending', gmail: draft ? 'pending' : 'not-created' };
      try {
        const activity = findClientPackageDraftActivities_(context.ss, operationKey);
        if (activity.rows.length === 1 && (!activityRow || activity.rows[0] === activityRow)) {
          activity.sheet.deleteRow(activity.rows[0]);
          rollback.activity = 'deleted';
        }
        else if (activity.rows.length) throw new Error('Operation Activity ownership is ambiguous.');
        restoreGoldStandardProspectRow_(context, before);
        rollback.prospect = 'restored';
        if (draft) {
          draft.deleteDraft();
          rollback.gmail = 'deleted';
        }
        if (findExactClientPackageGmailDrafts_(authority.prospect.email, content.subject).length) throw new Error('Operation-created Gmail draft cleanup failed.');
      } catch (rollbackError) {
        restored = false;
        console.error('Client-package rollback failure: ' + (rollbackError.message || String(rollbackError)));
      }
      console.error('Client-package rollback result. Activity: ' + rollback.activity + '. Prospect: ' + rollback.prospect + '. Gmail: ' + rollback.gmail + '. Verified: ' + restored + '.');
      throw new Error(restored ? 'Client-package draft creation failed; the Gmail draft, Prospect row, and Activity receipt were rolled back.' : 'Client-package draft creation failed and rollback could not be verified. Reconciliation is required.');
    }
  } finally {
    lock.releaseLock();
  }
}

function buildClientPackageDraftResult_(status, operationKey, authority, packageFiles, gmailReceipt, workbookReceipt) {
  return {
    ok: true,
    status: String(status),
    operationKey: String(operationKey),
    prospectId: String(authority.prospect.prospectId),
    findingSetId: String(authority.reference.findingSetId),
    findingSetVersion: String(authority.reference.version),
    immutableHash: String(authority.reference.fingerprint),
    draftId: String(gmailReceipt.draftId),
    attachmentNames: packageFiles.files.map(function(item) { return String(item.name); }),
    attachmentHashes: packageFiles.files.map(function(item) { return String(item.hash); }),
    activityTimestamp: String(workbookReceipt.timestamp)
  };
}

function serializeClientPackageDraftResult_(result) {
  if (!result || result.ok !== true) throw new Error('Client-package draft receipt is invalid.');
  return JSON.stringify({
    ok: true,
    status: String(result.status || ''),
    operationKey: String(result.operationKey || ''),
    prospectId: String(result.prospectId || ''),
    findingSetId: String(result.findingSetId || ''),
    findingSetVersion: String(result.findingSetVersion || ''),
    immutableHash: String(result.immutableHash || ''),
    draftId: String(result.draftId || ''),
    attachmentNames: [].concat(result.attachmentNames || []).map(String),
    attachmentHashes: [].concat(result.attachmentHashes || []).map(String),
    activityTimestamp: String(result.activityTimestamp || '')
  });
}

function reconcileManuallySentClientPackage() {
  const context = getSelectedProspectContext_(['Company', 'Email', 'Prospect ID', 'Status', 'Next Action', 'Last Activity', 'Gmail Draft Created', 'Lifecycle Operation Key', 'Lifecycle Operation State', 'Lifecycle Operation Details', 'Lifecycle Confirmed At']);
  if (!context) return '';
  let plan;
  try {
    plan = prepareClientPackageSentReconciliation_(context);
  } catch (error) {
    SpreadsheetApp.getUi().alert('Sent Client Package Reconciliation', error.message || String(error), SpreadsheetApp.getUi().ButtonSet.OK);
    return '';
  }
  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.prompt('Reconcile Manually Sent Client Package', 'Verified sent package:\n' + plan.subject + '\nSent: ' + plan.sentAt.toISOString() + '\n\nThis records the sent package and advances only to Executive Brief Sent. Type ' + CLIENT_PACKAGE_SENT_CONFIRMATION + ' exactly.', ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK) return '';
  if (confirmation.getResponseText() !== CLIENT_PACKAGE_SENT_CONFIRMATION) {
    ui.alert('Sent Client Package Reconciliation', 'Confirmation did not match exactly. No workbook record was changed.', ui.ButtonSet.OK);
    return '';
  }
  try {
    const result = reconcileManuallySentClientPackageTransactional_(context);
    ui.alert('Sent Client Package Reconciliation', result.status === 'already-completed' ? 'The exact sent package was already reconciled. No timestamps or records changed.' : 'The sent client package was reconciled at its original Gmail send time. CRM advanced only to Executive Brief Sent.', ui.ButtonSet.OK);
    return JSON.stringify(result);
  } catch (error) {
    ui.alert('Sent Client Package Reconciliation', error.message || String(error), ui.ButtonSet.OK);
    return '';
  }
}

function prepareClientPackageSentReconciliation_(context) {
  const authority = loadClientPackageDraftAuthority_(context);
  const packageFiles = loadVerifiedClientPackagePdfFiles_(context, authority);
  const draftReceipt = assertExistingClientPackageDraftReceipt_(context, authority, packageFiles);
  const content = buildClientPackageDraftContent_(authority.prospect, draftReceipt.returnLink);
  const messages = findExactSentClientPackageMessages_(authority.prospect.email, content.subject);
  if (messages.length !== 1) throw new Error('Exactly one matching sent client-package Gmail message is required. Missing or duplicate messages must be reconciled first.');
  const gmailReceipt = assertSentClientPackageMessage_(messages[0], authority.prospect.email, content, packageFiles.files);
  const operationKey = ['CLIENTPACKAGESENT', authority.prospect.prospectId, authority.reference.findingSetId, authority.reference.version, authority.reference.fingerprint, clientPackageDraftHashText_(gmailReceipt.messageId)].join(':');
  return { authority: authority, packageFiles: packageFiles, draftReceipt: draftReceipt, content: content, message: messages[0], messageId: gmailReceipt.messageId, sentAt: gmailReceipt.sentAt, subject: content.subject, operationKey: operationKey };
}

function assertExistingClientPackageDraftReceipt_(context, authority, packageFiles) {
  const prospectRow = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  if (String(getValueByHeader_(prospectRow, context.table.headers, 'Gmail Draft Created')) !== 'Yes') throw new Error('The selected prospect does not retain a completed client-package draft receipt.');
  const sheet = getRequiredSheet_(context.ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Prospect ID', 'Operation Key']);
  const count = Math.max(sheet.getLastRow() - table.headerRow, 0);
  const values = count ? sheet.getRange(table.headerRow + 1, 1, count, table.lastColumn).getValues() : [];
  const rows = [];
  values.forEach(function(row, index) {
    if (String(getValueByHeader_(row, table.headers, 'Activity Type')) === CLIENT_PACKAGE_DRAFT_ACTIVITY_TYPE && String(getValueByHeader_(row, table.headers, 'Prospect ID')) === authority.prospect.prospectId) rows.push({ row: table.headerRow + 1 + index, values: row });
  });
  if (rows.length !== 1) throw new Error('Exactly one client-package Gmail draft Activity receipt is required.');
  const receipt = rows[0].values;
  const notes = String(getValueByHeader_(receipt, table.headers, 'Activity Notes'));
  const match = notes.match(/^Created complete client-package Gmail draft\. Subject: ([\s\S]+?)\. Return Link: (https:\/\/\S+)\. Attachments: Executive Brief\.pdf, Digital Business Assessment\.pdf, Improvement Plan\.pdf\. No email was sent\.$/);
  if (!match) throw new Error('The client-package Gmail draft Activity receipt is malformed.');
  const returnLink = validateClientPackageReturnLink_(match[2]);
  const subject = buildClientPackageDraftContent_(authority.prospect, returnLink).subject;
  const expectedKey = buildClientPackageDraftOperationKey_(authority.prospect.prospectId, authority.reference, returnLink);
  if (match[1] !== subject || String(getValueByHeader_(receipt, table.headers, 'Company')) !== authority.prospect.company || String(getValueByHeader_(receipt, table.headers, 'Operation Key')) !== expectedKey || packageFiles.files.length !== 3) throw new Error('The client-package Gmail draft Activity receipt does not match immutable package authority.');
  return { returnLink: returnLink, operationKey: expectedKey, activityRow: rows[0].row };
}

function clientPackageEmailAddress_(value) {
  const match = String(value || '').match(/<([^<>]+)>\s*$/);
  return String(match ? match[1] : value || '').trim().toLowerCase();
}

function findExactSentClientPackageMessages_(recipient, subject) {
  const query = 'in:sent subject:"' + String(subject).replace(/["\\]/g, ' ') + '"';
  const messages = [];
  GmailApp.search(query, 0, 20).forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (clientPackageEmailAddress_(message.getTo()) === clientPackageEmailAddress_(recipient) && String(message.getSubject()) === subject) messages.push(message);
    });
  });
  return messages;
}

function canonicalizeSentClientPackageText_(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\ufeff/, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\*Return Link:\*/g, 'Return Link:')
    .replace(/[ \t\n]+/g, ' ')
    .trim();
}

function expectedSentClientPackageText_(content) {
  const greeting = String(content.plainBody).split('\n')[0];
  return [
    greeting,
    'I prepared your complete business optimization package for review. The attached documents are:',
    '- Executive Brief',
    '- Digital Business Assessment',
    '- Improvement Plan',
    'Return Link: ' + content.returnLink,
    'Please use the Return Link when you are ready to respond or continue the conversation.',
    '--',
    '[image: Rogers Holdings LLC]',
    'Brian Keith Rogers',
    'FOUNDER',
    'Rogers Holdings LLC',
    '859-404-7300 <+18594047300> · rogersholdingsllc.com <https://www.rogersholdingsllc.com/>',
    'briankeith@rogersholdingsllc.com',
    'Better systems. Clearer decisions. Stronger businesses.'
  ].join('\n');
}

function assertSentClientPackageMessage_(message, recipient, content, files) {
  if (clientPackageEmailAddress_(message.getTo()) !== clientPackageEmailAddress_(recipient) || String(message.getSubject()) !== content.subject) throw new Error('Sent client-package recipient or subject mismatch.');
  if (clientPackageEmailAddress_(message.getFrom()) !== 'briankeith@rogersholdingsllc.com') throw new Error('Sent client-package sender mismatch.');
  const persistedPlain = String(message.getPlainBody() || '');
  const plain = canonicalizeSentClientPackageText_(persistedPlain);
  const expectedPlain = canonicalizeSentClientPackageText_(expectedSentClientPackageText_(content));
  if (plain !== expectedPlain) throw new Error('Sent client-package body, Return Link, or branded signature mismatch.');
  if (persistedPlain.split(content.returnLink).length - 1 !== 1) throw new Error('Sent client-package Return Link is missing or duplicated.');
  const attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  if (attachments.length !== 3) throw new Error('Sent client package must contain exactly three attachments.');
  const actual = {};
  attachments.forEach(function(blob) {
    const name = String(blob.getName());
    if (actual[name]) throw new Error('Sent client package contains a duplicate attachment named ' + name + '.');
    actual[name] = hashGoldStandardBlob_(blob);
  });
  files.forEach(function(item) {
    if (actual[item.name] !== item.hash) throw new Error('Sent client-package attachment mismatch at ' + item.name + '.');
  });
  const sentAt = new Date(message.getDate());
  if (isNaN(sentAt.getTime())) throw new Error('Sent client-package Gmail timestamp is invalid.');
  return { messageId: String(message.getId()), sentAt: sentAt };
}

function sentClientPackageActivityNote_(plan) {
  return 'Verified manually sent complete client package. Subject: ' + plan.subject + '. Return Link: ' + plan.draftReceipt.returnLink + '. Attachments: ' + CLIENT_PACKAGE_DRAFT_FILE_NAMES.join(', ') + '. Gmail message identity SHA-256: ' + clientPackageDraftHashText_(plan.messageId) + '.';
}

function assertSentClientPackageReconciliationReadback_(context, plan) {
  const persisted = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  const expected = { 'Status': 'Executive Brief Sent', 'Next Action': 'Schedule Discovery Meeting', 'Lifecycle Operation Key': plan.operationKey, 'Lifecycle Operation State': 'Complete', 'Lifecycle Operation Details': 'Verified complete client package manually sent; lifecycle advanced only from Lead Found to Executive Brief Sent.' };
  Object.keys(expected).forEach(function(header) {
    if (String(getValueByHeader_(persisted, context.table.headers, header)) !== expected[header]) throw new Error('Sent-package Prospect readback mismatch: ' + header);
  });
  ['Last Activity', 'Lifecycle Confirmed At'].forEach(function(header) {
    if (new Date(getValueByHeader_(persisted, context.table.headers, header)).getTime() !== plan.sentAt.getTime()) throw new Error('Sent-package original send timestamp readback mismatch: ' + header);
  });
  const activity = findClientPackageDraftActivities_(context.ss, plan.operationKey);
  if (activity.rows.length !== 1) throw new Error('Exactly one sent-package Activity receipt is required.');
  const row = activity.sheet.getRange(activity.rows[0], 1, 1, activity.table.lastColumn).getValues()[0];
  const fields = { 'Company': plan.authority.prospect.company, 'Activity Type': CLIENT_PACKAGE_SENT_ACTIVITY_TYPE, 'Activity Notes': sentClientPackageActivityNote_(plan), 'Prospect ID': plan.authority.prospect.prospectId, 'Operation Key': plan.operationKey };
  Object.keys(fields).forEach(function(header) {
    if (String(getValueByHeader_(row, activity.table.headers, header)) !== fields[header]) throw new Error('Sent-package Activity readback mismatch: ' + header);
  });
  if (new Date(getValueByHeader_(row, activity.table.headers, 'Date')).getTime() !== plan.sentAt.getTime()) throw new Error('Sent-package Activity did not preserve the original Gmail send timestamp.');
  return { activityRow: activity.rows[0] };
}

function reconcileManuallySentClientPackageTransactional_(context) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const plan = prepareClientPackageSentReconciliation_(context);
    const range = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn);
    const before = range.getValues()[0];
    const current = normalizePipelineStage_(getValueByHeader_(before, context.table.headers, 'Status')) || 'Lead Found';
    const existing = findClientPackageDraftActivities_(context.ss, plan.operationKey);
    if (current === 'Executive Brief Sent' || existing.rows.length) {
      if (current !== 'Executive Brief Sent' || existing.rows.length !== 1) throw new Error('A partial sent-package reconciliation requires manual review. No records were changed.');
      assertSentClientPackageReconciliationReadback_(context, plan);
      return sentClientPackageResult_('already-completed', plan);
    }
    const transition = validateProspectStageTransition_(current, 'Executive Brief Sent');
    if (!transition.allowed || transition.idempotent) throw new Error(transition.message || 'The sent-package lifecycle transition is not available.');
    let activityRow = 0;
    try {
      const after = before.slice();
      setIfHeader_(after, context.table.headers, 'Status', 'Executive Brief Sent');
      setIfHeader_(after, context.table.headers, 'Next Action', 'Schedule Discovery Meeting');
      setIfHeader_(after, context.table.headers, 'Last Activity', plan.sentAt);
      setIfHeader_(after, context.table.headers, 'Lifecycle Operation Key', plan.operationKey);
      setIfHeader_(after, context.table.headers, 'Lifecycle Operation State', 'Complete');
      setIfHeader_(after, context.table.headers, 'Lifecycle Operation Details', 'Verified complete client package manually sent; lifecycle advanced only from Lead Found to Executive Brief Sent.');
      setIfHeader_(after, context.table.headers, 'Lifecycle Confirmed At', plan.sentAt);
      range.setValues([after]);
      const activity = findClientPackageDraftActivities_(context.ss, plan.operationKey);
      if (activity.rows.length) throw new Error('Unexpected sent-package Activity collision.');
      const activityValues = new Array(activity.table.lastColumn).fill('');
      setIfHeader_(activityValues, activity.table.headers, 'Date', plan.sentAt);
      setIfHeader_(activityValues, activity.table.headers, 'Company', plan.authority.prospect.company);
      setIfHeader_(activityValues, activity.table.headers, 'Activity Type', CLIENT_PACKAGE_SENT_ACTIVITY_TYPE);
      setIfHeader_(activityValues, activity.table.headers, 'Activity Notes', sentClientPackageActivityNote_(plan));
      setIfHeader_(activityValues, activity.table.headers, 'Prospect ID', plan.authority.prospect.prospectId);
      setIfHeader_(activityValues, activity.table.headers, 'Operation Key', plan.operationKey);
      activityRow = Math.max(activity.sheet.getLastRow() + 1, activity.table.headerRow + 1);
      activity.sheet.getRange(activityRow, 1, 1, activity.table.lastColumn).setValues([literalizeBusinessSnapshotSheetRow_(activityValues)]);
      assertSentClientPackageReconciliationReadback_(context, plan);
      return sentClientPackageResult_('completed', plan);
    } catch (error) {
      let restored = true;
      try {
        const activity = findClientPackageDraftActivities_(context.ss, plan.operationKey);
        if (activity.rows.length === 1 && (!activityRow || activity.rows[0] === activityRow)) activity.sheet.deleteRow(activity.rows[0]);
        else if (activity.rows.length) throw new Error('Sent-package Activity ownership is ambiguous.');
        restoreGoldStandardProspectRow_(context, before);
      } catch (rollbackError) {
        restored = false;
        console.error('Sent-package reconciliation rollback failed: ' + (rollbackError.message || String(rollbackError)));
      }
      throw new Error(restored ? 'Sent-package reconciliation failed; the Prospect row and Activity receipt were rolled back.' : 'Sent-package reconciliation failed and rollback could not be verified.');
    }
  } finally {
    lock.releaseLock();
  }
}

function sentClientPackageResult_(status, plan) {
  return { ok: true, status: status, operationKey: plan.operationKey, prospectId: plan.authority.prospect.prospectId, sentAt: plan.sentAt.toISOString(), stage: 'Executive Brief Sent', nextAction: 'Schedule Discovery Meeting' };
}
