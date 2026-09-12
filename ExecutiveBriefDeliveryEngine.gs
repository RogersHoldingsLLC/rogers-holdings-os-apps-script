/** Executive Brief-only delivery. Gmail drafts and reads only; Brian sends manually. */
var EB_DELIVERY_OWNER = 'briankeith@rogersholdingsllc.com';
var EB_DELIVERY_DRAFT_EVENT = 'Executive Brief Delivery Draft Created';
var EB_DELIVERY_SENT_EVENT = 'Executive Brief Delivery Verified';
var EB_DELIVERY_DRAFT_CONFIRMATION = 'CREATE EXECUTIVE BRIEF DELIVERY DRAFT';
var EB_DELIVERY_SENT_CONFIRMATION = 'VERIFY SENT EXECUTIVE BRIEF';

function createExecutiveBriefDeliveryDraft() {
  return runExecutiveBriefDeliveryMenu_('draft');
}

function reconcileSentExecutiveBrief() {
  return runExecutiveBriefDeliveryMenu_('sent');
}

function runExecutiveBriefDeliveryMenu_(mode) {
  const ui = SpreadsheetApp.getUi();
  try {
    const context = getSelectedExecutiveBriefDeliveryProspect_();
    if (!context) return '';
    const preview = buildExecutiveBriefDeliveryPlan_(context, mode);
    const sent = mode === 'sent' ? prepareExecutiveBriefSent_(preview) : null;
    const phrase = mode === 'draft' ? EB_DELIVERY_DRAFT_CONFIRMATION : EB_DELIVERY_SENT_CONFIRMATION;
    const prompt = ui.prompt(mode === 'draft' ? 'Create Executive Brief Delivery Draft' : 'Reconcile Sent Executive Brief',
      'Prospect: ' + preview.identity.prospectId + '\nRecipient: ' + preview.identity.recipient +
      '\nFollow-Up: ' + preview.identity.followUpId + '\nFinding Set: ' + preview.identity.findingSetId + ' v' + preview.identity.version +
      '\nPDF: ' + preview.file.getUrl() + '\nPDF SHA-256: ' + preview.identity.pdfHash +
      (sent ? '\nVerified Gmail send time: ' + sent.sentAt : '\nReview this exact PDF before confirming. This creates a draft only. Brian must manually press Send in Gmail.') +
      '\n\nType ' + phrase + ' exactly.', ui.ButtonSet.OK_CANCEL);
    if (prompt.getSelectedButton() !== ui.Button.OK || prompt.getResponseText() !== phrase) return '';
    const result = mode === 'draft'
      ? createExecutiveBriefDeliveryDraftTransactional_(context, preview.operationKey)
      : reconcileSentExecutiveBriefTransactional_(context, sent);
    ui.alert('Executive Brief Delivery', mode === 'draft'
      ? 'The exact PDF draft is verified. Review recipient, body and attachment in Gmail; Brian must manually press Send. No delivery or follow-up completion was recorded.'
      : 'The sent Executive Brief and exact follow-up completion are verified. No email was sent and no Discovery Meeting task was created.', ui.ButtonSet.OK);
    return JSON.stringify(result);
  } catch (error) {
    ui.alert('Executive Brief Delivery Stopped', String(error.message || error) + '\nNo automatic retry. Resolve the reported state before continuing.', ui.ButtonSet.OK);
    return '';
  }
}

/** Reuse the full-row/header resolver; restrict selection checks to delivery. */
function getSelectedExecutiveBriefDeliveryProspect_() {
  const context = getSelectedProspectContext_(['Company', 'Contact', 'Email', 'Prospect ID']);
  if (!context) return null;
  const selection = context.sheet.getActiveRangeList();
  const ranges = selection ? selection.getRanges() : [];
  if (ranges.length !== 1 || ranges[0].getNumRows() !== 1 || ranges[0].getRow() !== context.selectedRow) {
    throw new Error('Select exactly one Master Prospect Tracker data row in a single range.');
  }
  return context;
}

function executiveBriefDeliveryHash_(value) {
  return clientPackageDraftHashText_(String(value));
}

function executiveBriefDeliveryText_(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function executiveBriefDeliveryAddress_(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(?:[^<>\r\n,;]*<)?([^<>\s,;]+@[^<>\s,;]+\.[^<>\s,;]+)>?$/);
  if (!match || (raw.includes('<') !== raw.endsWith('>'))) throw new Error('Exactly one valid email address is required.');
  return match[1].toLowerCase();
}

function buildExecutiveBriefDeliveryContent_(prospect) {
  const greeting = prospect.contact ? 'Hi ' + prospect.contact + ',' : 'Hi ' + prospect.company + ' team,';
  const paragraphs = [greeting, 'Your Free Business Snapshot Executive Brief is ready.',
    'I’ve attached the brief, which summarizes the main opportunity we identified, why it matters, and the recommended next step.',
    'Please review it when you have a chance. If you have questions or would like help working through the recommendation, reply to this email.'];
  const signature = ['Brian Keith Rogers', 'Founder', 'Rogers Holdings LLC', '859-404-4351', 'rogersholdingsllc.com', EB_DELIVERY_OWNER];
  return {
    subject: 'Your Free Business Snapshot — Executive Brief for ' + prospect.company,
    plainBody: paragraphs.join('\n\n') + '\n\n' + signature.join('\n'),
    htmlBody: paragraphs.map(function(p) { return '<p>' + escapeHtml_(p) + '</p>'; }).join('') +
      '<p><strong>' + escapeHtml_(signature[0]) + '</strong><br>' + signature.slice(1).map(escapeHtml_).join('<br>') + '</p>'
  };
}

/** Reads existing headers only; no schema creation, company-based identity, or lifecycle helpers. */
function executiveBriefDeliveryRows_(ss, sheetName, required) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Required sheet missing: ' + sheetName);
  const table = getHeaderTable_(sheet, required);
  required.forEach(function(key) { if (!table.headers[key]) throw new Error('Required header missing: ' + key); });
  const count = Math.max(0, sheet.getLastRow() - table.headerRow);
  const values = count ? sheet.getRange(table.headerRow + 1, 1, count, table.lastColumn).getValues() : [];
  return { sheet: sheet, table: table, rows: values.map(function(row, index) {
    const record = {};
    Object.keys(table.headers).forEach(function(key) { record[key] = row[table.headers[key] - 1]; });
    return { rowNumber: table.headerRow + 1 + index, values: row, record: record };
  }) };
}

function executiveBriefDeliveryReceipts_(ss, prospectId, event) {
  const data = executiveBriefDeliveryRows_(ss, ACTIVITY_FEED_SHEET, ['Date', 'Company', 'Activity Type', 'Activity Notes', 'Prospect ID', 'Operation Key']);
  data.matches = data.rows.filter(function(row) { return row.record['Prospect ID'] === prospectId && row.record['Activity Type'] === event; });
  if (data.matches.length > 1) throw new Error('Multiple ' + event + ' receipts require reconciliation.');
  return data;
}

function buildExecutiveBriefDeliveryPlan_(context, mode) {
  if (String(Session.getEffectiveUser().getEmail()).trim().toLowerCase() !== EB_DELIVERY_OWNER ||
      String(requireHumanReviewer_()).trim().toLowerCase() !== EB_DELIVERY_OWNER) throw new Error('Authenticated Brian owner account is required.');
  const data = executiveBriefDeliveryRows_(context.ss, MASTER_PROSPECT_SHEET, ['Prospect ID', 'Company', 'Contact', 'Email']);
  const id = String(context.prospect.prospectId || '').trim();
  const matches = data.rows.filter(function(row) { return String(row.record['Prospect ID']) === id; });
  // Service handles may differ even when they identify the same sheet in this workbook.
  if (!id || matches.length !== 1 || matches[0].rowNumber !== context.selectedRow || context.sheet.getSheetId() !== data.sheet.getSheetId()) throw new Error('Selected Prospect ID is missing, duplicated, or changed.');
  const row = matches[0].record;
  const prospect = { prospectId: id, company: String(row.Company || '').trim(), contact: String(row.Contact || '').trim(), email: executiveBriefDeliveryAddress_(row.Email) };
  if (!prospect.company || /[\r\n]/.test(prospect.company + prospect.contact)) throw new Error('Company/contact identity is invalid.');
  if (/^=/.test(prospect.company) || /^=/.test(id)) throw new Error('Formula-like record identity cannot be written to an Activity receipt.');
  const draftReceipts = executiveBriefDeliveryReceipts_(context.ss, id, EB_DELIVERY_DRAFT_EVENT);
  const receipt = draftReceipts.matches.length ? JSON.parse(String(draftReceipts.matches[0].record['Activity Notes'])) : null;
  if (receipt && (receipt.schema !== 'EB-DELIVERY-1' || !receipt.identity || receipt.reviewedBy !== EB_DELIVERY_OWNER ||
      !Number.isFinite(new Date(receipt.preparedAt).getTime()) || new Date(draftReceipts.matches[0].record.Date).toISOString() !== receipt.preparedAt ||
      (receipt.state === 'Ready' && !receipt.draftId))) throw new Error('Delivery draft receipt metadata is invalid.');
  const followUps = executiveBriefDeliveryRows_(context.ss, FOLLOW_UPS_SHEET, ['Follow-Up ID', 'Related Prospect ID', 'Follow-Up Type', 'Completed', 'Completed Date']);
  const open = followUps.rows.filter(function(f) { return f.record['Related Prospect ID'] === id && f.record['Follow-Up Type'] === 'Executive Brief' && !isFollowUpCompletedValue_(f.record.Completed); });
  let followUp;
  if (mode === 'sent') {
    if (!receipt || receipt.state !== 'Ready') throw new Error('An exact completed Executive Brief delivery-draft receipt is required.');
    const found = followUps.rows.filter(function(f) { return f.record['Follow-Up ID'] === receipt.identity.followUpId; });
    if (found.length !== 1 || found[0].record['Related Prospect ID'] !== id || found[0].record['Follow-Up Type'] !== 'Executive Brief') throw new Error('Receipt Follow-Up ID is missing, ambiguous, or relinked.');
    followUp = found[0];
    if (open.some(function(f) { return f.rowNumber !== followUp.rowNumber; })) throw new Error('Another open Executive Brief follow-up makes this delivery ambiguous.');
  } else {
    if (open.length !== 1) throw new Error('Exactly one OPEN Executive Brief follow-up is required.');
    followUp = open[0];
  }
  const followUpId = String(followUp.record['Follow-Up ID'] || '').trim();
  if (!followUpId || followUps.rows.filter(function(f) { return f.record['Follow-Up ID'] === followUpId; }).length !== 1) throw new Error('Follow-Up ID is missing or duplicated.');
  if (!isFollowUpCompletedValue_(followUp.record.Completed) && followUp.record['Completed Date']) throw new Error('Open Follow-Up has an unexpected completion timestamp.');
  const approved = loadApprovedFindingSetForGeneration_(prospect, {});
  const reference = assertApprovedFindingSetReference_(approved.reference);
  const sets = executiveBriefDeliveryRows_(context.ss, 'Assessment Finding Sets', ['Finding Set ID', 'Version', 'Prospect ID', 'Review Status', 'Approval Status', 'Document Eligibility', 'Immutable Hash', 'Snapshot File ID']);
  const setRows = sets.rows.filter(function(r) { return r.record['Finding Set ID'] === reference.findingSetId && String(r.record.Version) === String(reference.version); });
  if (setRows.length !== 1) throw new Error('Current Finding Set is missing or ambiguous.');
  const set = setRows[0].record;
  if (set['Prospect ID'] !== id || set['Review Status'] !== 'Approved for Client' || set['Approval Status'] !== 'Approved for Client' || set['Document Eligibility'] !== 'Eligible' || set['Immutable Hash'] !== reference.fingerprint || !set['Snapshot File ID']) throw new Error('Current approved Finding Set authority is stale or ineligible.');
  const folder = getAuditPackageFolder_(prospect.company);
  if (!folder) throw new Error('Canonical Executive Brief folder is missing.');
  const iterator = folder.getFiles();
  const files = [];
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (!file.isTrashed() && /^\.bop-(staging|backup|rollback)-.*Executive Brief\.pdf$/.test(file.getName())) throw new Error('Unreconciled Executive Brief artifacts exist.');
    if (!file.isTrashed() && file.getName() === 'Executive Brief.pdf') files.push(file);
  }
  if (files.length !== 1 || files[0].getMimeType() !== MimeType.PDF || files[0].getSize() <= 0) throw new Error('Exactly one non-empty canonical Executive Brief.pdf is required.');
  const file = files[0];
  const blob = file.getBlob();
  const hash = hashGoldStandardBlob_(blob);
  const generationKey = ['GOLDDOC', id, 'EXECUTIVEBRIEF', reference.findingSetId, reference.version, reference.fingerprint].join(':');
  const authority = { prospect: prospect, reference: reference };
  const generation = assertClientPackageGenerationReceipt_(context, authority, 'Executive Brief.pdf', generationKey);
  assertClientPackageCanonicalPdfAuthority_(authority, 'Executive Brief.pdf', String(file.getDescription()), hash, generationKey, generation);
  const content = buildExecutiveBriefDeliveryContent_(prospect);
  const identity = { prospectId: id, followUpId: followUpId, company: prospect.company, recipient: prospect.email, sender: EB_DELIVERY_OWNER,
    findingSetId: reference.findingSetId, version: String(reference.version), fingerprint: reference.fingerprint, snapshotId: String(set['Snapshot File ID']),
    generationOperationKey: generationKey, generationTimestamp: generation.originalGeneratedAt, pdfFileId: String(file.getId()), pdfHash: hash,
    subject: content.subject, contentHash: executiveBriefDeliveryHash_(executiveBriefDeliveryText_(content.plainBody)) };
  const operationKey = 'EBDELIVERYDRAFT:' + id + ':' + executiveBriefDeliveryHash_(JSON.stringify(identity));
  if (receipt && (JSON.stringify(receipt.identity) !== JSON.stringify(identity) || receipt.operationKey !== operationKey || draftReceipts.matches[0].record['Operation Key'] !== operationKey || draftReceipts.matches[0].record.Company !== prospect.company)) throw new Error('Existing draft receipt no longer matches current delivery authority.');
  return { context: context, identity: identity, operationKey: operationKey, content: content, file: file, blob: blob, followUps: followUps, followUp: followUp, draftReceipts: draftReceipts, receipt: receipt };
}

function assertExecutiveBriefDeliveryMessage_(message, plan, sent) {
  if (executiveBriefDeliveryAddress_(message.getTo()) !== plan.identity.recipient || String(message.getSubject()) !== plan.content.subject) throw new Error('Delivery recipient or subject mismatch.');
  if (message.getCc() || message.getBcc()) throw new Error('Additional CC/BCC recipients are not permitted.');
  if (executiveBriefDeliveryAddress_(message.getFrom()) !== EB_DELIVERY_OWNER) throw new Error('Delivery sender mismatch.');
  const body = executiveBriefDeliveryText_(message.getPlainBody());
  if (executiveBriefDeliveryHash_(body) !== plan.identity.contentHash) {
    // Sent-only exception for the observed Gmail rendering of this exact approved signature.
    const signature = ' Brian Keith Rogers Founder Rogers Holdings LLC 859-404-4351 rogersholdingsllc.com ' + EB_DELIVERY_OWNER;
    const bold = signature.replace('Brian Keith Rogers', '*Brian Keith Rogers*');
    const telephone = signature.replace('859-404-4351', '859-404-4351 <(859)%20404-4351>');
    const both = bold.replace('859-404-4351', '859-404-4351 <(859)%20404-4351>');
    const matches = sent && executiveBriefDeliveryText_(plan.content.plainBody).endsWith(signature) &&
      [bold, telephone, both].some(function(renderedSignature) {
        if (!body.endsWith(renderedSignature)) return false;
        const normalized = body.slice(0, -renderedSignature.length) + signature;
        return executiveBriefDeliveryHash_(normalized) === plan.identity.contentHash;
      });
    if (!matches) throw new Error('Delivery draft/content identity mismatch.');
  }
  const attachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  if (attachments.length !== 1 || attachments[0].getName() !== 'Executive Brief.pdf' || hashGoldStandardBlob_(attachments[0]) !== plan.identity.pdfHash) throw new Error('Exact Executive Brief.pdf attachment/hash mismatch.');
  if (sent && message.isDraft()) throw new Error('A draft is not evidence of sending.');
}

function findExecutiveBriefDeliveryDrafts_(plan) {
  return GmailApp.getDrafts().filter(function(draft) {
    const message = draft.getMessage();
    if (String(message.getSubject()) !== plan.content.subject) return false;
    try { return executiveBriefDeliveryAddress_(message.getTo()) === plan.identity.recipient; }
    catch (error) { return false; }
  });
}

function writeExecutiveBriefDeliveryReceipt_(data, rowNumber, identity, event, key, timestamp, receipt) {
  const row = new Array(data.table.lastColumn).fill('');
  const fields = { Date: timestamp, Company: identity.company, 'Activity Type': event, 'Activity Notes': JSON.stringify(receipt), 'Prospect ID': identity.prospectId, 'Operation Key': key };
  Object.keys(fields).forEach(function(header) { row[data.table.headers[header] - 1] = fields[header]; });
  data.sheet.getRange(rowNumber, 1, 1, data.table.lastColumn).setValues([row]);
  const actual = data.sheet.getRange(rowNumber, 1, 1, data.table.lastColumn).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(row)) throw new Error('Delivery Activity readback failed; reconcile before retry.');
}

function createExecutiveBriefDeliveryDraftTransactional_(context, confirmedOperationKey) {
  const lock = LockService.getDocumentLock(); lock.waitLock(30000);
  try {
    const plan = buildExecutiveBriefDeliveryPlan_(context, 'draft');
    if (confirmedOperationKey !== plan.operationKey) throw new Error('Reviewed PDF or delivery authority changed. Review again.');
    if (executiveBriefDeliveryReceipts_(context.ss, plan.identity.prospectId, EB_DELIVERY_SENT_EVENT).matches.length) throw new Error('Delivery is already recorded. No new draft is permitted.');
    const matches = findExecutiveBriefDeliveryDrafts_(plan);
    if (matches.length > 1) throw new Error('Multiple matching delivery drafts; no draft was created.');
    if (matches.length) assertExecutiveBriefDeliveryMessage_(matches[0].getMessage(), plan, false);
    if (plan.receipt && plan.receipt.state === 'Ready') {
      if (matches.length !== 1 || String(matches[0].getId()) !== plan.receipt.draftId) throw new Error('Recorded draft is missing or changed; reconcile sending instead of creating another.');
      return { status: 'already-completed', operationKey: plan.operationKey, draftId: plan.receipt.draftId };
    }
    if (plan.receipt && (plan.receipt.state !== 'Pending' || matches.length !== 1)) throw new Error('Pending draft creation requires manual reconciliation; no blind retry.');
    const receiptRow = plan.receipt ? plan.draftReceipts.matches[0].rowNumber : Math.max(plan.draftReceipts.sheet.getLastRow() + 1, plan.draftReceipts.table.headerRow + 1);
    const preparedAt = plan.receipt ? plan.receipt.preparedAt : new Date().toISOString();
    const receipt = { schema: 'EB-DELIVERY-1', state: 'Pending', identity: plan.identity, operationKey: plan.operationKey, preparedAt: preparedAt, reviewedBy: EB_DELIVERY_OWNER };
    // Persist intent before Gmail: a lost create response cannot lead to a second draft.
    if (!plan.receipt) writeExecutiveBriefDeliveryReceipt_(plan.draftReceipts, receiptRow, plan.identity, EB_DELIVERY_DRAFT_EVENT, plan.operationKey, new Date(preparedAt), receipt);
    const draft = matches[0] || GmailApp.createDraft(plan.identity.recipient, plan.content.subject, plan.content.plainBody, { htmlBody: plan.content.htmlBody, attachments: [plan.blob.setName('Executive Brief.pdf')] });
    assertExecutiveBriefDeliveryMessage_(draft.getMessage(), plan, false);
    if (buildExecutiveBriefDeliveryPlan_(context, 'draft').operationKey !== plan.operationKey) throw new Error('Authority changed during draft creation; reconcile the pending draft.');
    receipt.state = 'Ready'; receipt.draftId = String(draft.getId());
    writeExecutiveBriefDeliveryReceipt_(plan.draftReceipts, receiptRow, plan.identity, EB_DELIVERY_DRAFT_EVENT, plan.operationKey, new Date(preparedAt), receipt);
    return { status: 'completed', operationKey: plan.operationKey, draftId: receipt.draftId, pdfHash: plan.identity.pdfHash };
  } finally { lock.releaseLock(); }
}

/** Advanced Gmail lists individual SENT messages; thread search is insufficient. Read calls only. */
function findExecutiveBriefSentMessages_(plan) {
  const found = [], seen = {};
  let pageToken, pages = 0;
  do {
    if (++pages > 10) throw new Error('Sent search exceeds the bounded result limit; reconcile manually.');
    const options = { labelIds: ['SENT'], q: 'subject:"' + plan.content.subject.replace(/["\\]/g, ' ') + '"', maxResults: 100 };
    if (pageToken) options.pageToken = pageToken;
    const response = Gmail.Users.Messages.list('me', options);
    (response.messages || []).forEach(function(item) {
      if (!item.id || seen[item.id]) throw new Error('Ambiguous Gmail message identity.');
      seen[item.id] = true;
      const metadata = Gmail.Users.Messages.get('me', item.id, { format: 'minimal' });
      if (metadata.id !== item.id || !(metadata.labelIds || []).includes('SENT') || (metadata.labelIds || []).includes('DRAFT')) throw new Error('Message does not have verified SENT membership.');
      const message = GmailApp.getMessageById(item.id);
      if (String(message.getId()) !== item.id) throw new Error('Gmail message identity changed.');
      // Subject/recipient filter identifies candidates; every candidate must then pass sender/content/hash validation.
      if (String(message.getSubject()) === plan.content.subject && executiveBriefDeliveryAddress_(message.getTo()) === plan.identity.recipient) found.push(message);
    });
    pageToken = response.nextPageToken;
  } while (pageToken);
  if (found.length !== 1) throw new Error('Exactly one matching Sent Executive Brief is required; missing or multiple matches block.');
  return found[0];
}

function prepareExecutiveBriefSent_(plan) {
  const message = findExecutiveBriefSentMessages_(plan);
  assertExecutiveBriefDeliveryMessage_(message, plan, true);
  const sentAt = new Date(message.getDate());
  const preparedAt = new Date(plan.receipt.preparedAt);
  if (!Number.isFinite(sentAt.getTime()) || !Number.isFinite(preparedAt.getTime()) || sentAt.getTime() < preparedAt.getTime()) throw new Error('Gmail send timestamp is invalid or predates the delivery draft.');
  const messageReference = 'gmail-message-sha256:' + executiveBriefDeliveryHash_(message.getId());
  return { operationKey: plan.operationKey, deliveryKey: 'EBDELIVERYSENT:' + executiveBriefDeliveryHash_(plan.operationKey + ':' + messageReference), messageReference: messageReference, sentAt: sentAt.toISOString() };
}

function reconcileSentExecutiveBriefTransactional_(context, confirmedSent) {
  const lock = LockService.getDocumentLock(); lock.waitLock(30000);
  try {
    const plan = buildExecutiveBriefDeliveryPlan_(context, 'sent');
    const sent = prepareExecutiveBriefSent_(plan);
    if (JSON.stringify(sent) !== JSON.stringify(confirmedSent)) throw new Error('Sent delivery changed after owner review.');
    const fresh = buildExecutiveBriefDeliveryPlan_(context, 'sent');
    if (fresh.operationKey !== plan.operationKey || fresh.followUp.rowNumber !== plan.followUp.rowNumber || JSON.stringify(fresh.followUp.values) !== JSON.stringify(plan.followUp.values)) throw new Error('Delivery authority or Follow-Up changed during Gmail verification.');
    const activity = executiveBriefDeliveryReceipts_(context.ss, plan.identity.prospectId, EB_DELIVERY_SENT_EVENT);
    const receipt = { schema: 'EB-DELIVERY-1', identity: plan.identity, draftId: plan.receipt.draftId, draftOperationKey: plan.operationKey, deliveryKey: sent.deliveryKey, messageReference: sent.messageReference, sentAt: sent.sentAt };
    const follow = plan.followUp;
    if (activity.matches.length) {
      const prior = activity.matches[0].record;
      if (prior['Operation Key'] !== sent.deliveryKey || prior.Company !== plan.identity.company || JSON.stringify(JSON.parse(prior['Activity Notes'])) !== JSON.stringify(receipt) || new Date(prior.Date).toISOString() !== sent.sentAt || !isFollowUpCompletedValue_(follow.record.Completed) || new Date(follow.record['Completed Date']).toISOString() !== sent.sentAt) throw new Error('Partial or mismatched verified delivery requires reconciliation.');
      return { status: 'already-completed', receipt: receipt };
    }
    if (isFollowUpCompletedValue_(follow.record.Completed)) throw new Error('Follow-Up was completed without this delivery receipt.');
    const rowNumber = Math.max(activity.sheet.getLastRow() + 1, activity.table.headerRow + 1);
    const completion = { sheet: plan.followUps.sheet, table: plan.followUps.table, rowNumber: follow.rowNumber };
    let completionStarted = false;
    try {
      writeExecutiveBriefDeliveryReceipt_(activity, rowNumber, plan.identity, EB_DELIVERY_SENT_EVENT, sent.deliveryKey, new Date(sent.sentAt), receipt);
      const currentFollowUps = executiveBriefDeliveryRows_(context.ss, FOLLOW_UPS_SHEET, ['Follow-Up ID', 'Related Prospect ID', 'Follow-Up Type', 'Completed', 'Completed Date']);
      const exact = currentFollowUps.rows.filter(function(f) { return f.record['Follow-Up ID'] === plan.identity.followUpId; });
      if (exact.length !== 1 || JSON.stringify(exact[0].values) !== JSON.stringify(follow.values)) throw new Error('Exact Follow-Up changed before completion.');
      completion.rowNumber = exact[0].rowNumber;
      completionStarted = true;
      writeSelectedFollowUpCompletion_(completion, new Date(sent.sentAt));
      const persisted = plan.followUps.sheet.getRange(completion.rowNumber, 1, 1, plan.followUps.table.lastColumn).getValues()[0];
      const expected = follow.values.slice(); expected[plan.followUps.table.headers.Completed - 1] = true; expected[plan.followUps.table.headers['Completed Date'] - 1] = new Date(sent.sentAt);
      if (JSON.stringify(persisted) !== JSON.stringify(expected)) throw new Error('Exact Follow-Up completion readback mismatch.');
      return { status: 'completed', receipt: receipt };
    } catch (error) {
      // Restore only the two authorized follow-up cells and this operation's Activity row.
      try {
        if (completionStarted) {
        const now = plan.followUps.sheet.getRange(completion.rowNumber, 1, 1, plan.followUps.table.lastColumn).getValues()[0];
        if (now[plan.followUps.table.headers['Follow-Up ID'] - 1] !== plan.identity.followUpId || now[plan.followUps.table.headers['Related Prospect ID'] - 1] !== plan.identity.prospectId) throw new Error('Follow-Up moved during completion.');
        plan.followUps.sheet.getRange(completion.rowNumber, plan.followUps.table.headers.Completed).setValue(follow.record.Completed);
        plan.followUps.sheet.getRange(completion.rowNumber, plan.followUps.table.headers['Completed Date']).setValue(follow.record['Completed Date']);
        const restored = plan.followUps.sheet.getRange(completion.rowNumber, 1, 1, plan.followUps.table.lastColumn).getValues()[0];
        if (JSON.stringify(restored) !== JSON.stringify(follow.values)) throw new Error('Follow-Up rollback readback failed.');
        }
        const own = activity.sheet.getRange(rowNumber, 1, 1, activity.table.lastColumn).getValues()[0];
        if (own.some(function(v) { return v !== ''; })) {
          if (own[activity.table.headers['Operation Key'] - 1] !== sent.deliveryKey || own[activity.table.headers['Prospect ID'] - 1] !== plan.identity.prospectId) throw new Error('Activity ownership is uncertain.');
          activity.sheet.deleteRow(rowNumber);
        }
      } catch (rollbackError) { throw new Error('Delivery completion failed and rollback is uncertain. Stop for reconciliation: ' + rollbackError.message); }
      throw new Error('Delivery completion failed; only this operation was rolled back. ' + error.message);
    }
  } finally { lock.releaseLock(); }
}
