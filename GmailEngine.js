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
  const auditOutcome = String(prospect.auditOutcome || 'website review').trim();
  const offerService = String(prospect.offerService || 'website and local visibility review').trim();
  const findings = getSmartFindings_(prospect);
  const websiteLine = website
    ? `I took a quick look at ${website} and noticed a few opportunities that may help more local customers take action.`
    : 'I noticed there may be an opportunity to improve your online visibility so more local customers can find, trust, and contact the business.';
  const findingsLine = findings.length
    ? 'A few things stood out:\n' + findings.map(function(finding) {
      return '- ' + finding;
    }).join('\n')
    : '';
  const subject = website ? `Quick website note for ${company}` : `Quick local visibility note for ${company}`;
  const auditLine = website
    ? `The quick audit score came back at ${auditScore}/100 with this outcome: ${auditOutcome}. I would keep the next step simple: ${offerService}.`
    : `I would keep the next step simple: ${offerService}. The goal would be to improve local visibility and make it easier for customers to take the next step.`;

  const initialParts = [
    `Hi ${company} team,`,
    `My name is Brian with Rogers Holdings LLC. ${websiteLine}`,
    auditLine,
    findingsLine,
    'No pressure either way. I wanted to pass this along in case it is useful. If you would like, I can send over a short plain-English summary of the highest-impact fixes.',
    'Best,',
    'Brian Rogers',
    'Rogers Holdings LLC'
  ].filter(Boolean);

  const followUpParts = [
    `Hi ${company} team,`,
    website ? 'I wanted to follow up on the quick website note I sent over.' : 'I wanted to follow up on the quick local visibility note I sent over.',
    `Based on the audit, the practical next step still looks like ${offerService}. The goal would be simple: make it easier for local customers to understand what you offer, trust the business, and contact you.`,
    'If helpful, I can put together a short summary with the main opportunities and a recommended first step.',
    'Best,',
    'Brian Rogers',
    'Rogers Holdings LLC'
  ];

  return {
    subject: subject,
    initialEmail: initialParts.join('\n\n'),
    followUpEmail: followUpParts.join('\n\n')
  };
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
      'Add the missing fields before sending the audit package: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  if (!isAuditPackageGenerated_(context.values, context.table.headers)) {
    ui.alert(
      'Business Optimization Platform',
      'Generate the audit package first, then run Send Audit Package again.',
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
      throw new Error('Audit package folder was not found. Generate the audit package first.');
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
    let draftCreatedWithAttachments = false;

    try {
      const attachments = [
        packageFiles.auditReport.getBlob(),
        packageFiles.proposalDraft.getBlob()
      ];
      console.log('Send Audit Package: attachments prepared', {
        attachmentCount: attachments.length
      });
      console.log('Send Audit Package: Gmail draft attempted with attachments');
      GmailApp.createDraft(
        String(prospect.email || '').trim(),
        subject,
        body,
        {
          attachments: attachments
        }
      );
      draftCreatedWithAttachments = true;
      console.log('Send Audit Package: Gmail draft created with attachments');
    } catch (attachmentError) {
      console.warn(
        'Send Audit Package: attachment draft failed, attempting draft without attachments: ' +
        (attachmentError && attachmentError.message ? attachmentError.message : String(attachmentError))
      );
      console.log('Send Audit Package: Gmail draft attempted without attachments');
      GmailApp.createDraft(
        String(prospect.email || '').trim(),
        subject,
        buildAuditPackageSendEmailBody_(prospect, folder, true)
      );
      console.log('Send Audit Package: Gmail draft created without attachments');
    }

    setProspectStatusIfHeader_(context.sheet, context.table.headers, context.selectedRow, 'Audit Package Sent');
    setIfHeaderCell_(context.sheet, context.table.headers, context.selectedRow, 'Next Action', 'Follow Up');
    updateSelectedProspectFollowUpDate_(context.sheet, context.table.headers, context.selectedRow, 7);
    updateSelectedProspectLastActivity_(context.sheet, context.table.headers, context.selectedRow);
    logPipelineActivity_(
      context.ss,
      prospect.company,
      'Audit Package Sent',
      draftCreatedWithAttachments
        ? 'Audit package Gmail draft created with audit report PDF and proposal PDF attached.'
        : 'Audit package Gmail draft created without attachments; Drive folder link included due to attachment failure.'
    );
    refreshSalesOperatingSystem_();

    ui.alert('Business Optimization Platform', 'Audit Package Gmail Draft Created', ui.ButtonSet.OK);
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
    return fileName === 'Audit Report.pdf' ||
      (fileName.indexOf('Audit Report') === 0 && isPdf) ||
      (companyKey && fileKey.indexOf(companyKey) !== -1 && fileName.indexOf('Report') !== -1 && isPdf);
  });
  const outreachDraft = findAuditPackageFileByName_(folder, 'Outreach Email Draft.txt');
  const proposalDraft = findAuditPackageFileByName_(folder, 'Proposal.pdf');
  const missing = [];

  if (!auditReport) {
    missing.push('Audit Report.pdf');
  }
  if (!outreachDraft) {
    missing.push('Outreach Email Draft');
  }
  if (!proposalDraft) {
    missing.push('Proposal.pdf');
  }

  if (missing.length) {
    throw new Error('Audit package is missing required file(s): ' + missing.join(', ') + '. Regenerate the package and try again.');
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
  const findingsText = findings.length
    ? findings.map(function(finding) {
      return '- ' + finding;
    }).join('\n')
    : '- There may be practical opportunities to improve online visibility, trust, and customer inquiries.';

  const parts = [
    `Hi ${prospect.company} team,`,
    '',
    `My name is Brian with Rogers Holdings LLC. I completed a website audit for ${prospect.website} and wanted to send over the results in a simple format.`,
    '',
    'A few opportunities stood out:',
    findingsText,
    '',
    `The audit score came back at ${prospect.auditScore}/100 with this outcome: ${prospect.auditOutcome}. I attached the audit report and a short proposal draft so you can review the recommended next steps.`,
    includeFolderLinkOnly && folder ? `\nYou can review the audit package here: ${folder.getUrl()}` : '',
    '',
    'If it would be helpful, I would be glad to have a short conversation and walk through the highest-impact improvements.',
    '',
    'Best,',
    'Brian Rogers',
    'Rogers Holdings LLC'
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

  try {
    GmailApp.createDraft(recipient, drafts.subject, drafts.initialEmail);
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

  logOutreachGmailDraftCreated_(ss, prospect, drafts, recipient);
  setProspectStatusIfHeader_(sheet, table.headers, selectedRow, 'Draft Created');
  updateSelectedProspectLastActivity_(sheet, table.headers, selectedRow);
  refreshSalesOperatingSystem_();

  const message = recipient
    ? 'Gmail draft created.'
    : 'Gmail draft created.';

  ui.alert('Business Optimization Platform', message, ui.ButtonSet.OK);
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

function logOutreachGmailDraftCreated_(ss, prospect, drafts, recipient) {
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
  setIfHeader_(rowValues, table.headers, 'Activity Type', 'Gmail Draft Created');
  setIfHeader_(rowValues, table.headers, 'Activity Notes', 'Created outreach Gmail draft. Subject: ' + drafts.subject + '.' + recipientNote);
  setIfHeader_(rowValues, table.headers, 'Next Action', 'Send Intro Email');

  const targetRow = Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
}
