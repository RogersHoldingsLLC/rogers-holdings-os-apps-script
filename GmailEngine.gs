/**
 * Business Optimization Platform - GmailEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function buildOutreachDrafts_(prospect) {
  const company = String(prospect.company || '').trim();
  const website = String(prospect.website || '').trim();
  const auditScore = prospect.auditScore === '' || prospect.auditScore === null || prospect.auditScore === undefined
    ? 'not scored'
    : String(prospect.auditScore);
  const digitalPresence = getDigitalPresenceAssessment_(prospect.auditScore);
  const offerService = getClientFacingServiceName_(prospect.offerService || 'website and local visibility review', prospect.auditScore);
  const findings = getSmartFindings_(prospect);
  const websiteLine = website
    ? `I reviewed ${website} from the perspective of a local customer deciding whether to trust and contact the business.`
    : 'I reviewed your online presence from the perspective of a local customer deciding whether to trust and contact the business.';
  const findingsLine = findings.length
    ? 'A couple of opportunities stood out:\n' + findings.slice(0, 2).map(function(finding) {
      return '- ' + finding;
    }).join('\n')
    : '';
  const subject = website ? `Website review for ${company}` : `Local visibility review for ${company}`;
  const scoreValue = digitalPresence.score;
  const opportunityFrame = scoreValue !== null && scoreValue >= 90
    ? 'The main opportunity looks more like refinement and growth than a major rebuild.'
    : 'The main opportunity is practical improvement: clearer trust signals, visibility, and customer action.';
  const auditLine = website
    ? `The Digital Presence Score came back at ${digitalPresence.scoreText || auditScore}. ${digitalPresence.title}. ${opportunityFrame}`
    : `The clearest starting point appears to be ${offerService}. The goal would be to improve visibility, credibility, and the path for customers to take action.`;

  const initialParts = [
    `Hi ${company} team,`,
    `My name is Brian Keith Rogers with Rogers Holdings LLC. ${websiteLine}`,
    auditLine,
    findingsLine,
    `I prepared a short Executive Snapshot with the clearest next step: ${offerService}.`,
    'If it would be useful, I can send it over or walk through it in a quick conversation.',
    'Best,',
    'Brian Keith Rogers',
    'Rogers Holdings LLC',
    'briankeith@rogersholdingsllc.com',
    '859-404-7300'
  ].filter(Boolean);

  const followUpParts = [
    `Hi ${company} team,`,
    website ? 'I wanted to follow up on the website review note I sent over.' : 'I wanted to follow up on the local visibility review note I sent over.',
    `The practical next step still looks like ${offerService}.`,
    'If useful, I can share the Executive Snapshot and walk through the highest-impact opportunities in a short conversation.',
    'Best,',
    'Brian Keith Rogers',
    'Rogers Holdings LLC',
    'briankeith@rogersholdingsllc.com',
    '859-404-7300'
  ];

  return {
    subject: subject,
    initialEmail: initialParts.join('\n\n'),
    followUpEmail: followUpParts.join('\n\n')
  };
}

function normalizeGmailDraftRecipient_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeGmailDraftSubject_(value) {
  return String(value || '').trim();
}

function findExactGmailDraftMatches_(recipient, subject) {
  const normalizedRecipient = normalizeGmailDraftRecipient_(recipient);
  const normalizedSubject = normalizeGmailDraftSubject_(subject);
  return GmailApp.getDrafts().filter(function(draft) {
    const message = draft.getMessage();
    return normalizeGmailDraftRecipient_(message.getTo()) === normalizedRecipient &&
      normalizeGmailDraftSubject_(message.getSubject()) === normalizedSubject;
  });
}

function assertUnambiguousGmailDraftMatches_(matches, recipient, subject) {
  if (matches.length > 1) {
    throw new Error(`Multiple Gmail drafts match recipient ${String(recipient || '').trim()} and subject "${normalizeGmailDraftSubject_(subject)}" in the current Gmail account. Resolve the duplicate drafts before retrying; no new draft was created.`);
  }
}

function reconcileExactGmailDraft_(recipient, subject, body, options) {
  const matches = findExactGmailDraftMatches_(recipient, subject);
  assertUnambiguousGmailDraftMatches_(matches, recipient, subject);
  if (matches.length === 1) {
    matches[0].update(recipient, subject, body, options || {});
    return { draft: matches[0], created: false, updated: true };
  }
  return { draft: GmailApp.createDraft(recipient, subject, body, options || {}), created: true, updated: false };
}

function reconcileAfterAmbiguousGmailCreateError_(recipient, subject) {
  const matches = findExactGmailDraftMatches_(recipient, subject);
  assertUnambiguousGmailDraftMatches_(matches, recipient, subject);
  return matches.length === 1
    ? { draft: matches[0], created: false, updated: false, retainedAfterError: true }
    : null;
}

function createOrReconcileAssessmentGmailDraft_(recipient, subject, body, attachments, fallbackBody) {
  try {
    const result = reconcileExactGmailDraft_(recipient, subject, body, { attachments: attachments });
    result.withAttachments = true;
    return result;
  } catch (attachmentError) {
    const persisted = reconcileAfterAmbiguousGmailCreateError_(recipient, subject);
    if (persisted) {
      persisted.withAttachments = null;
      return persisted;
    }
    const fallback = reconcileExactGmailDraft_(recipient, subject, fallbackBody);
    fallback.withAttachments = false;
    fallback.attachmentError = attachmentError;
    return fallback;
  }
}

function sendAuditPackage() {
  const context = getSelectedProspectContext_([
    'Company'
  ]);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const prospect = buildSelectedProspectForAuditPackage_(context);
  prospect.email = getValueByHeader_(context.values, context.table.headers, 'Email');
  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company'],
    ['Website', 'website'],
    ['Email', 'email'],
    ['Audit Score', 'auditScore'],
    ['Audit Outcome', 'auditOutcome']
  ]);

  if (missing.length) {
    ui.alert(
      'Business Optimization Platform',
      'Add the missing fields before sending the Digital Business Assessment: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  if (!isAuditPackageGenerated_(context.values, context.table.headers)) {
    ui.alert(
      'Business Optimization Platform',
      'Generate the Digital Business Assessment first, then run Send Audit Package again.',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    console.log('Send Audit Package: selected prospect loaded', {
      company: prospect.company,
      website: prospect.website,
      email: prospect.email
    });
    const folder = getAuditPackageFolder_(prospect.company);
    if (!folder) {
      throw new Error('Digital Business Assessment folder was not found. Generate the Digital Business Assessment first.');
    }
    console.log('Send Audit Package: folder found', {
      folderName: folder.getName(),
      folderUrl: folder.getUrl()
    });

    const packageFiles = getRequiredAuditPackageFiles_(folder, prospect);
    console.log('Send Audit Package: audit report file found', {
      fileName: packageFiles.auditReport.getName(),
      fileId: packageFiles.auditReport.getId()
    });
    console.log('Send Audit Package: proposal PDF file found', {
      fileName: packageFiles.proposalDraft.getName(),
      fileId: packageFiles.proposalDraft.getId()
    });
    console.log('Send Audit Package: outreach email draft file found', {
      fileName: packageFiles.outreachDraft.getName(),
      fileId: packageFiles.outreachDraft.getId()
    });
    const subject = `Website Improvement Opportunities for ${prospect.company}`;
    const body = buildAuditPackageSendEmailBody_(prospect, folder);
    const attachments = [packageFiles.auditReport.getBlob(), packageFiles.proposalDraft.getBlob()];
    console.log('Send Audit Package: attachments prepared', { attachmentCount: attachments.length });
    const gmailDraftResult = createOrReconcileAssessmentGmailDraft_(
      String(prospect.email || '').trim(), subject, body, attachments,
      buildAuditPackageSendEmailBody_(prospect, folder, true)
    );
    const draftActivityType = gmailDraftResult.created
      ? 'Digital Business Assessment Gmail Draft Created'
      : 'Digital Business Assessment Gmail Draft Updated';

    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Next Action', 'Present Digital Business Assessment');
    updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
    logPipelineActivity_(
      context.ss,
      prospect.company,
      draftActivityType,
      gmailDraftResult.withAttachments === true
        ? `${gmailDraftResult.created ? 'Created' : gmailDraftResult.updated ? 'Updated' : 'Retained'} Digital Business Assessment Gmail draft with assessment PDF and Improvement Plan PDF attached.`
        : gmailDraftResult.withAttachments === false
          ? `${gmailDraftResult.created ? 'Created' : 'Updated'} Digital Business Assessment Gmail draft without attachments; Drive folder link included due to attachment failure.`
          : 'Retained the single matching Digital Business Assessment Gmail draft after an ambiguous attachment operation; no fallback duplicate was created.'
    );
    refreshSalesOperatingSystem_();

    ui.alert(
      gmailDraftResult.created ? 'Email Draft Ready' : 'Email Draft Updated',
      `${gmailDraftResult.created ? 'A new' : 'The existing'} Digital Business Assessment email draft is ready in Gmail.\n\nNext Step\nReview the message, verify the attached documents, and send it when ready.`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Business Optimization Platform',
      error && error.message ? error.message : String(error),
      ui.ButtonSet.OK
    );
  }
}

function getRequiredAuditPackageFiles_(folder, prospect) {
  const auditReport = findNewestAuditPackageFile_(folder, function(fileName) {
    const companyKey = normalizeLookupKey_(prospect.company);
    const fileKey = normalizeLookupKey_(fileName);
    const isPdf = /\.pdf$/i.test(fileName);
    return fileName === 'AuditReport.pdf' ||
      fileName === 'Audit Report.pdf' ||
      (fileName.indexOf('Audit Report') === 0 && isPdf) ||
      (companyKey && fileKey.indexOf(companyKey) !== -1 && fileName.indexOf('Report') !== -1 && isPdf);
  });
  const outreachDraft = findAuditPackageFileByName_(folder, 'Outreach Email Draft.txt');
  const proposalDraft = findAuditPackageFileByName_(folder, 'Proposal.pdf');
  const missing = [];

  if (!auditReport) {
    missing.push('AuditReport.pdf');
  }
  if (!outreachDraft) {
    missing.push('Outreach Email Draft');
  }
  if (!proposalDraft) {
    missing.push('Proposal.pdf');
  }

  if (missing.length) {
    throw new Error('Digital Business Assessment is missing required file(s): ' + missing.join(', ') + '. Regenerate the package and try again.');
  }

  return {
    auditReport: auditReport,
    outreachDraft: outreachDraft,
    proposalDraft: proposalDraft
  };
}

function findNewestAuditPackageFile_(folder, matcher) {
  const files = folder.getFiles();
  let newestFile = null;
  let newestTime = 0;
  let checkedCount = 0;
  const maxFilesToCheck = 30;

  while (files.hasNext()) {
    if (checkedCount >= maxFilesToCheck) {
      console.warn('Send Audit Package: file lookup stopped at safety limit', {
        folderName: folder.getName(),
        checkedCount: checkedCount
      });
      break;
    }

    const file = files.next();
    checkedCount += 1;
    const fileName = String(file.getName() || '');
    if (matcher(fileName, file)) {
      const updatedTime = file.getLastUpdated().getTime();
      if (!newestFile || updatedTime > newestTime) {
        newestFile = file;
        newestTime = updatedTime;
      }
    }
  }

  console.log('Send Audit Package: file lookup completed', {
    folderName: folder.getName(),
    checkedCount: checkedCount,
    selectedFile: newestFile ? newestFile.getName() : ''
  });
  return newestFile;
}

function buildAuditPackageSendEmailBody_(prospect, folder, includeFolderLinkOnly) {
  const findings = getSmartFindings_(prospect).slice(0, 3);
  const digitalPresence = getDigitalPresenceAssessment_(prospect.auditScore);
  const findingsText = findings.length
    ? findings.map(function(finding) {
      return '- ' + finding;
    }).join('\n')
    : '- Improve visibility, credibility, and the path for customers to take action.';

  const parts = [
    `Hi ${prospect.company} team,`,
    '',
    `My name is Brian Keith Rogers with Rogers Holdings LLC. I completed a website and digital presence review for ${prospect.website} and prepared the results in a practical, business-focused format.`,
    '',
    'A few practical opportunities stood out:',
    findingsText,
    '',
    `The Digital Presence Score came back at ${digitalPresence.scoreText}. ${digitalPresence.title}. ${digitalPresence.subtitle} I attached the Digital Business Assessment and Improvement Plan so you can review the business impact, quick wins, recommended service package, and next steps.`,
    includeFolderLinkOnly && folder ? `\nYou can review the Digital Business Assessment package here: ${folder.getUrl()}` : '',
    '',
    'If helpful, I would be glad to walk through the highest-impact improvements in a short conversation and answer any questions.',
    '',
    'Best,',
    'Brian Keith Rogers',
    'Rogers Holdings LLC',
    'briankeith@rogersholdingsllc.com',
    '859-404-7300'
  ];

  return parts.filter(function(part) {
    return part !== '';
  }).join('\n');
}

function createOutreachGmailDraft() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();

  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
    ui.alert(
      'Business Optimization Platform',
      'Select a prospect row on the Master Prospect Tracker sheet first.',
      ui.ButtonSet.OK
    );
    return;
  }

  const selectedRow = sheet.getActiveRange().getRow();
  const table = getHeaderTable_(sheet, [
    'Company'
  ]);

  if (selectedRow <= table.headerRow) {
    ui.alert(
      'Business Optimization Platform',
      'Select a data row below the Master Prospect Tracker header row.',
      ui.ButtonSet.OK
    );
    return;
  }

  const values = sheet.getRange(selectedRow, 1, 1, table.lastColumn).getValues()[0];
  const prospect = {
    company: getValueByHeader_(values, table.headers, 'Company'),
    email: getValueByHeader_(values, table.headers, 'Email'),
    website: getValueByHeader_(values, table.headers, 'Website'),
    auditScore: getValueByHeader_(values, table.headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(values, table.headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(values, table.headers, 'Priority Tier'),
    offerService: getValueByHeader_(values, table.headers, 'Offer / Service'),
    notes: getValueByHeader_(values, table.headers, 'Notes')
  };

  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company']
  ]);

  if (missing.length) {
    ui.alert(
      'Business Optimization Platform',
      'Add the missing required field before creating a Gmail draft: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  applySmartFindingsToProspect_(sheet, table.headers, selectedRow, prospect);
  const drafts = buildOutreachDrafts_(prospect);
  const recipient = String(prospect.email || '').trim();

  let gmailDraftResult = null;
  try {
    gmailDraftResult = reconcileExactGmailDraft_(recipient, drafts.subject, drafts.initialEmail);
  } catch (error) {
    if (!recipient) {
      ui.alert(
        'Business Optimization Platform',
        'Add an email address, then run Create Outreach Gmail Draft again.',
        ui.ButtonSet.OK
      );
      return;
    }
    throw error;
  }

  logOutreachGmailDraftReconciled_(ss, prospect, drafts, recipient, gmailDraftResult);
  setIfHeaderCell_(sheet, table.headers, selectedRow, 'Next Action', 'Confirm Executive Snapshot Sent');
  updateSelectedProspectLastActivity_(sheet, table.headers, selectedRow);
  refreshSalesOperatingSystem_();

  if (typeof showOutreachEmailPreview_ === 'function') {
    showOutreachEmailPreview_(prospect, drafts, recipient);
  } else {
    ui.alert('Business Optimization Platform', 'Gmail draft created.', ui.ButtonSet.OK);
  }
}

function requiredProspectFieldsMissing_(prospect, fieldPairs) {
  return fieldPairs
    .filter(function(pair) {
      const value = prospect[pair[1]];
      return value === null || value === undefined || String(value).trim() === '';
    })
    .map(function(pair) {
      return pair[0];
    });
}

function logOutreachGmailDraftReconciled_(ss, prospect, drafts, recipient, result) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, [
    'Date',
    'Company',
    'Activity Type',
    'Activity Notes'
  ]);

  const recipientNote = recipient ? ' Recipient: ' + recipient + '.' : ' No recipient email was available.';
  const rowValues = new Array(table.lastColumn).fill('');
  setIfHeader_(rowValues, table.headers, 'Date', new Date());
  setIfHeader_(rowValues, table.headers, 'Company', prospect.company);
  const action = result && result.created ? 'Created' : 'Updated';
  setIfHeader_(rowValues, table.headers, 'Activity Type', `Outreach Gmail Draft ${action}`);
  setIfHeader_(rowValues, table.headers, 'Activity Notes', `${action} outreach Gmail draft. Subject: ${drafts.subject}.${recipientNote}`);
  setIfHeader_(rowValues, table.headers, 'Next Action', 'Schedule Discovery Meeting');

  const targetRow = Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
}
