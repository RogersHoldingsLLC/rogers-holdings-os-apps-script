/**
 * Business Optimization Platform - Client Deliverable Preview System.
 * Provides preview-first modals for customer-facing deliverables without changing generation logic.
 */

function createPreviewDialog_(config) {
  const settings = config || {};
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<base target="_top">',
    renderPreviewStyles_(),
    '</head>',
    '<body>',
    '<div class="preview-shell">',
    renderPreviewHeader_(settings),
    renderPreviewBody_(settings),
    renderPreviewFooter_(settings),
    '</div>',
    renderPreviewClientScript_(),
    '</body>',
    '</html>'
  ].join('');

  return HtmlService.createHtmlOutput(html)
    .setWidth(settings.width || 860)
    .setHeight(settings.height || 760);
}

function renderPreviewHeader_(config) {
  const settings = config || {};
  const company = normalizeClientBusinessName_(settings.company) || 'Selected Company';
  const website = settings.website || 'Website not provided';
  const assessmentDate = settings.assessmentDate || formatDisplayDate_(new Date());
  return [
    '<header class="preview-header">',
    '<div>',
    '<div class="brand">Rogers Holdings LLC</div>',
    `<h1>${escapeHtml_(settings.title || 'Client Deliverable')}</h1>`,
    '</div>',
    '<div class="prepared-box">',
    '<div class="prepared-label">Prepared for</div>',
    `<div class="prepared-company">${escapeHtml_(company)}</div>`,
    `<div class="prepared-meta">${escapeHtml_(website)}</div>`,
    `<div class="prepared-meta">${escapeHtml_(assessmentDate)}</div>`,
    '</div>',
    '</header>'
  ].join('');
}

function renderPreviewBody_(config) {
  const settings = config || {};
  return [
    '<main class="preview-body">',
    `<section class="document-preview ${settings.scrollable === false ? '' : 'scrollable'}">`,
    settings.bodyHtml || '',
    '</section>',
    '</main>'
  ].join('');
}

function renderPreviewFooter_(config) {
  const settings = config || {};
  return [
    '<footer class="preview-footer">',
    renderActionButtons_(settings),
    '<div id="previewStatus" class="preview-status">Preview mode</div>',
    '</footer>'
  ].join('');
}

function renderActionButtons_(config) {
  const settings = config || {};
  const generatePdfAction = settings.generatePdfAction || '';
  const generatePdfPayload = encodeURIComponent(JSON.stringify(settings.generatePdfPayload || {}));
  const gmailAction = settings.gmailAction || 'createOutreachGmailDraft';
  return [
    '<div class="button-row">',
    `<button class="primary" type="button" onclick="runPreviewServerAction_(this, '${escapeHtml_(generatePdfAction)}', 'Generating PDF…', 'PDF generated successfully.', '${escapeHtml_(generatePdfPayload)}')">Generate PDF</button>`,
    `<button type="button" onclick="runPreviewServerAction_(this, '${escapeHtml_(gmailAction)}', 'Creating Gmail draft…', 'Gmail draft created successfully.')">Create Gmail Draft</button>`,
    '<button type="button" onclick="google.script.host.close()">Close</button>',
    '</div>'
  ].join('');
}

function renderPreviewCard_(title, content, options) {
  const config = options || {};
  const editable = config.editable ? ' editable-field' : '';
  return [
    '<article class="preview-card">',
    `<div class="card-kicker">${escapeHtml_(config.kicker || '')}</div>`,
    `<h2>${escapeHtml_(title || '')}</h2>`,
    `<div class="card-content${editable}" data-field="${escapeHtml_(config.field || title || '')}">${content || ''}</div>`,
    '</article>'
  ].join('');
}

function renderPreviewList_(items) {
  const values = (items || []).filter(function(item) {
    return String(item || '').trim();
  });
  if (!values.length) {
    return '<p class="muted">Details will appear here when they are available.</p>';
  }
  return '<ul>' + values.map(function(item) {
    return `<li>${escapeHtml_(item)}</li>`;
  }).join('') + '</ul>';
}

function showExecutiveSnapshotPreview_(prospect, documentPlan) {
  prospect = normalizeClientProspect_(prospect);
  const verifiedPlan = requireGoldStandardPreviewPlan_(documentPlan, 'executiveBrief');
  const input = verifiedPlan.input;
  const content = verifiedPlan.content;
  const checkedEvidence = content.evidenceReferences.map(function(item) { return '<p><span class="check-badge">&#10003; Checked</span> ' + escapeHtml_(item) + '</p>'; }).join('');
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Executive Brief</div>',
    `<h2>${escapeHtml_(prospect.company || 'Selected Company')}</h2>`,
    `<p><b>Prepared:</b> ${escapeHtml_(input.preparedDate)}</p>`,
    `<p>${escapeHtml_(content.summary)}</p>`,
    '</div>',
    renderPreviewCard_('Main Problem', `<p><strong>${escapeHtml_(content.title)}</strong></p>`),
    renderPreviewCard_('What We Saw', `<p>${escapeHtml_(content.observation)}</p>`),
    renderPreviewCard_('Why This Matters', `<p>${escapeHtml_(content.consequence)}</p>`),
    content.synthesis ? renderPreviewCard_('What This Means', `<p>${escapeHtml_(content.synthesis)}</p>`) : '',
    renderPreviewCard_(content.clearFixLabel, `<p>${escapeHtml_(content.clearFix)}</p>`),
    renderPreviewCard_('What Should Happen', `<p>${escapeHtml_(content.expectedResult)}</p>`),
    renderPreviewCard_('How to Check the Fix', `<p>${escapeHtml_(content.completionTest)}</p>`),
    renderPreviewCard_('Where We Looked', checkedEvidence),
    content.limitations.length ? renderPreviewCard_('What We Did Not Test', renderPreviewList_(content.limitations)) : '',
    content.secondaryPriorities.length ? renderPreviewCard_('Additional Approved Priorities', renderPreviewList_(content.secondaryPriorities)) : '',
    renderPreviewCard_('Next Step', `<p>${escapeHtml_(content.nextStep)}</p>`),
    renderPreviewCard_('Want Help With This Fix?', `<p>${escapeHtml_(content.helpCta)}</p>`)
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Executive Brief',
    company: input.company,
    website: input.website,
    assessmentDate: input.preparedDateIso,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateExecutiveBriefPdfFromPreview',
    generatePdfPayload: documentPlan.approvedFindingSetReference,
    editable: false
  }), 'Executive Brief');
}

function showDigitalBusinessAssessmentPreview_(prospect, documentPlan) {
  prospect = normalizeClientProspect_(prospect);
  const verifiedPlan = requireGoldStandardPreviewPlan_(documentPlan, 'assessment');
  const input = verifiedPlan.input;
  const content = verifiedPlan.content;
  const overview = [
    ['Main goal', content.overview.primaryBusinessObjective],
    ['What customers should do', content.overview.desiredCustomerAction],
    ['Main service', content.overview.primaryService],
    ['Who needs the service', content.overview.targetCustomer],
    ['Area served', content.overview.serviceArea],
    ['Rule to follow', content.overview.knownConstraints]
  ].filter(function(row) { return row[1]; }).map(function(row) { return '<p><b>' + escapeHtml_(row[0]) + ':</b> ' + escapeHtml_(row[1]) + '</p>'; }).join('');
  const scope = content.scope.map(function(item) {
    const status = item.checked ? '<span class="check-badge">&#10003; Checked</span>' : escapeHtml_(item.status);
    return '<div class="approved-evidence"><p><strong>' + escapeHtml_(item.channel) + '</strong></p><p>' + status + '</p><p><b>How it helps:</b> ' + escapeHtml_(item.role) + '</p>' + (item.limitation ? '<p><b>What we did not check:</b> ' + escapeHtml_(item.limitation) + '</p>' : '') + '</div>';
  }).join('');
  const methodology = content.methodology.map(function(item) {
    return '<div class="approved-evidence"><p><b>Where we checked:</b> ' + escapeHtml_(item.whereChecked) + '</p><p><b>Test record:</b> ' + escapeHtml_(item.testRecord) + '</p><p><b>What we checked:</b> ' + escapeHtml_(item.whatChecked) + '</p><p><b>What we did:</b> ' + escapeHtml_(item.whatDone) + '</p><p><b>What we found:</b> ' + escapeHtml_(item.whatFound) + '</p></div>';
  }).join('');
  const findings = content.findings.map(function(item) {
    const evidence = item.evidence.map(function(evidenceItem) { return '<p><b>Observed result:</b> ' + escapeHtml_(evidenceItem.observedResult) + '</p>'; }).join('');
    const basis = item.showConsequenceBasis ? '<p><b>Why we know this:</b> ' + escapeHtml_(item.consequenceBasis) + '</p>' : '';
    return '<div class="approved-finding" data-finding-id="' + escapeHtml_(item.findingId) + '"><p><strong>' + escapeHtml_(item.title) + '</strong></p><p><b>What we saw:</b> ' + escapeHtml_(item.observation) + '</p><p><b>What should happen:</b> ' + escapeHtml_(item.expectedCondition) + '</p><p><b>Why this matters:</b> ' + escapeHtml_(item.consequence) + '</p>' + basis + '<p><b>What to change:</b> ' + escapeHtml_(item.recommendation) + '</p>' + (item.implementationLocation ? '<p><b>Where to change it:</b> ' + escapeHtml_(item.implementationLocation) + '</p>' : '') + '<p><b>How to check the fix:</b> ' + escapeHtml_(item.completionTest) + '</p>' + evidence + (item.limitations.length ? '<p><b>What we did not test:</b> ' + escapeHtml_(item.limitations.join('; ')) + '</p>' : '') + '</div>';
  }).join('');
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Digital Business Assessment</div>',
    `<h2>${escapeHtml_(input.company)}</h2>`,
    `<p><b>Prepared:</b> ${escapeHtml_(input.preparedDate)}</p>`,
    '<p>We checked the saved facts. This report shows what we found.</p>',
    '</div>',
    renderPreviewCard_('What We Checked', '<p>' + escapeHtml_(content.overview.purpose) + '</p>' + overview),
    scope ? renderPreviewCard_('Where We Looked', scope) : '',
    methodology ? renderPreviewCard_('How We Checked', methodology) : '',
    content.evidenceNotes.length ? renderPreviewCard_('Important Evidence Note', renderPreviewList_(content.evidenceNotes)) : '',
    renderPreviewCard_('What We Found', findings),
    content.limitations.length ? renderPreviewCard_('What We Did Not Check', renderPreviewList_(content.limitations)) : '',
    renderPreviewCard_('What Happens Next', '<p>' + escapeHtml_(content.conclusion) + '</p><p>' + escapeHtml_(content.nextStep) + '</p>')
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Digital Business Assessment',
    company: input.company,
    website: input.website,
    assessmentDate: input.preparedDateIso,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateDigitalBusinessAssessmentPdfFromPreview',
    generatePdfPayload: documentPlan.approvedFindingSetReference,
    gmailAction: 'sendAuditPackage',
    editable: false
  }), 'Digital Business Assessment');
}

function showImprovementPlanPreview_(prospect, documentPlan) {
  prospect = normalizeClientProspect_(prospect);
  const verifiedPlan = requireGoldStandardPreviewPlan_(documentPlan, 'improvementPlan');
  const input = verifiedPlan.input;
  const content = verifiedPlan.content;
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Improvement Plan</div>',
    `<h2>${escapeHtml_(input.company)}</h2>`,
    `<p><b>Prepared:</b> ${escapeHtml_(input.preparedDate)}</p>`,
    `<p>${escapeHtml_(content.subtitle)}</p>`,
    '</div>',
    renderPreviewCard_('Goal', '<p>' + escapeHtml_(content.objective) + '</p>'),
    renderPreviewCard_('Steps to Fix It', renderGoldStandardImprovementPreviewActions_(content.actions)),
    content.planLimitations.length ? renderPreviewCard_('What Else We Did Not Test', renderPreviewList_(content.planLimitations)) : '',
    content.sequence.length ? renderPreviewCard_('Steps', renderPreviewList_(content.sequence)) : '',
    renderPreviewCard_('Next Step', '<p>' + escapeHtml_(content.nextStep) + '</p>')
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Improvement Plan',
    company: input.company,
    website: input.website,
    assessmentDate: input.preparedDateIso,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateImprovementPlanPdfFromPreview',
    generatePdfPayload: documentPlan.approvedFindingSetReference,
    gmailAction: 'createOutreachGmailDraft',
    editable: false
  }), 'Improvement Plan');
}

function requireGoldStandardPreviewPlan_(plan, documentType) {
  if (!plan || plan.documentType !== documentType || !plan.input || !plan.input.preparedDate || !plan.input.preparedDateIso || !plan.approvedFindingSetReference) {
    throw new Error('A verified Gold Standard document plan is required for preview.');
  }
  return plan;
}

function renderGoldStandardPreviewEvidence_(input) {
  return renderPreviewList_((input.evidence || []).map(function(item) { return item.label + ': ' + item.detail; }));
}

function renderGoldStandardPreviewFindings_(input) {
  return (input.findings || []).map(function(item) {
    return '<div class="approved-finding" data-finding-id="' + escapeHtml_(item.key) + '"><p><strong>' + escapeHtml_(item.category) + '</strong></p><p><b>Observation:</b> ' + escapeHtml_(item.observation) + '</p><p><b>Business consequence:</b> ' + escapeHtml_(item.businessMeaning) + '</p>' + (item.recommendation ? '<p><b>Recommendation:</b> ' + escapeHtml_(item.recommendation) + '</p>' : '') + '</div>';
  }).join('');
}

function renderGoldStandardImprovementPreviewActions_(actions) {
  return (actions || []).map(function(item) {
    const path = item.showImplementationPath ? ' ' + escapeHtml_(item.implementationPath) : '';
    const completion = item.showCompletionTest ? '<p><b>How to check the fix:</b> ' + escapeHtml_(item.completionTest) + '</p>' : '';
    const outcome = item.showIntendedOutcome ? '<p><b>What should happen:</b> ' + escapeHtml_(item.intendedOutcome) + '</p>' : '';
    return '<div class="approved-action" data-action-id="' + escapeHtml_(item.actionId) + '"><p><strong>' + ('0' + item.sequence).slice(-2) + ' · ' + escapeHtml_(item.title) + '</strong></p><p><b>What to change:</b> ' + escapeHtml_(item.exactChange) + '</p><p><b>Where to change it:</b> ' + escapeHtml_(item.implementationLocation) + '</p>' + outcome + '<p><b>Who will do it:</b> ' + escapeHtml_(item.ownership) + path + '</p>' + (item.dependencies.length ? '<div><b>What we need first:</b>' + renderPreviewList_(item.dependencies) + '</div>' : '') + (item.limitations.length ? '<p><b>What we did not test:</b> ' + escapeHtml_(item.limitations.join('; ')) + '</p>' : '') + completion + '</div>';
  }).join('');
}

function showOutreachEmailPreview_(prospect, drafts, recipient) {
  prospect = normalizeClientProspect_(prospect);
  const bodyHtml = [
    '<div class="gmail-preview">',
    '<div class="gmail-top">',
    `<div><strong>To:</strong> ${escapeHtml_(recipient || 'No recipient email available')}</div>`,
    `<div><strong>Subject:</strong> ${escapeHtml_(drafts.subject || '')}</div>`,
    '</div>',
    `<div class="email-body editable-field" data-field="emailBody">${formatEmailPreviewHtml_(drafts.initialEmail)}</div>`,
    '</div>'
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Outreach Email',
    company: prospect.company,
    website: prospect.website,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateExecutiveSnapshot',
    gmailAction: 'createOutreachGmailDraft',
    editable: true
  }), 'Outreach Email');
}

function formatEmailPreviewHtml_(emailText) {
  return String(emailText || '')
    .split(/\n{2,}/)
    .map(function(paragraph) {
      return `<p>${escapeHtml_(paragraph).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function buildDeliverablePreviewAssessmentSummary_(prospect, findings) {
  const company = normalizeClientBusinessName_(prospect && prospect.company) || 'the business';
  const count = (findings || []).length;
  const focus = buildRecommendedNextStep_(prospect || {});
  return count
    ? `Rogers Holdings reviewed ${company}'s digital presence and identified ${count} practical finding${count === 1 ? '' : 's'}. The recommended focus is: ${focus}`
    : `Rogers Holdings reviewed ${company}'s digital presence and prepared a business-focused assessment. The recommended focus is: ${focus}`;
}

function renderPreviewStyles_() {
  return [
    '<style>',
    'body{margin:0;background:#f4f1ea;color:#111;font-family:Arial,Helvetica,sans-serif;}',
    '.preview-shell{height:100vh;display:flex;flex-direction:column;}',
    '.preview-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;background:#05070a;color:#fff;border-bottom:4px solid #c8a15a;padding:24px 28px;}',
    '.brand{color:#c8a15a;text-transform:uppercase;letter-spacing:1.6px;font-size:12px;font-weight:700;margin-bottom:8px;}',
    'h1{margin:0;font-size:28px;letter-spacing:0;font-weight:700;}',
    '.prepared-box{text-align:right;max-width:330px;}',
    '.prepared-label{color:#c8a15a;text-transform:uppercase;letter-spacing:1.4px;font-size:10px;font-weight:700;}',
    '.prepared-company{font-size:18px;font-weight:700;margin-top:5px;}',
    '.prepared-meta{color:#e6ded0;font-size:12px;margin-top:4px;}',
    '.preview-body{padding:20px 24px;overflow:hidden;flex:1;}',
    '.document-preview{background:#fff;border:1px solid #ddd4c3;border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,.08);padding:22px;box-sizing:border-box;}',
    '.document-preview.scrollable{max-height:560px;overflow:auto;}',
    '.hero-card{background:#111;color:#fff;border-left:5px solid #c8a15a;border-radius:6px;padding:18px 20px;margin-bottom:16px;}',
    '.hero-label,.card-kicker{color:#c8a15a;text-transform:uppercase;letter-spacing:1.3px;font-size:10px;font-weight:700;}',
    '.hero-card h2{margin:7px 0 6px;font-size:24px;}',
    '.hero-card p{margin:0;color:#e8dec9;}',
    '.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}',
    '.preview-card{border:1px solid #ddd4c3;background:#fbfaf7;border-radius:7px;padding:16px;margin-bottom:14px;}',
    '.preview-card h2{margin:5px 0 10px;font-size:17px;color:#111;}',
    '.preview-card p{line-height:1.55;margin:0 0 8px;}',
    '.card-content[contenteditable=true]{outline:2px solid #c8a15a;background:#fff;padding:10px;border-radius:5px;}',
    '.big-number{font-size:38px;font-weight:700;color:#9b7528;line-height:1;}',
    '.check-badge{display:inline-block;background:#9b7528;color:#fff;border-radius:11px;padding:3px 8px;font-size:11px;font-weight:700;white-space:nowrap;}',
    'ul{margin:0;padding-left:20px;} li{margin-bottom:7px;line-height:1.45;}',
    '.muted{color:#6f6a60;}',
    '.gmail-preview{border:1px solid #dedede;border-radius:8px;background:#fff;overflow:hidden;}',
    '.gmail-top{background:#f7f7f7;border-bottom:1px solid #dedede;padding:14px 16px;font-size:13px;line-height:1.7;}',
    '.email-body{padding:18px 20px;font-size:14px;line-height:1.55;}',
    '.preview-footer{display:flex;justify-content:space-between;gap:14px;align-items:center;background:#fff;border-top:1px solid #ddd4c3;padding:14px 18px;}',
    '.button-row{display:flex;gap:9px;flex-wrap:wrap;}',
    'button{min-height:36px;border:1px solid #111;border-radius:5px;background:#fff;color:#111;padding:0 12px;font-size:12px;font-weight:700;cursor:pointer;}',
    'button.primary{background:#111;color:#fff;border-color:#111;}',
    'button:disabled{opacity:.4;cursor:not-allowed;}',
    '.preview-status{font-size:12px;color:#6f6a60;}',
    '.finding-card,.visual-evidence-card{box-shadow:none!important;}',
    '</style>'
  ].join('');
}

function renderPreviewClientScript_() {
  return [
    '<script>',
    'function setPreviewButtonsDisabled_(disabled){document.querySelectorAll(".button-row button").forEach(function(button){button.disabled=disabled;});}',
    'function previewFailureMessage_(error){var detail=error&&error.message?error.message:"";return detail||"Document generation could not be completed safely. Do not retry until the operation has been reconciled.";}',
    'function parsePreviewServerReceipt_(value){if(typeof value!=="string"){throw new Error("Document generation returned an unsafe response. The committed operation must be reconciled before retry.");}var result=JSON.parse(value);if(!result||result.ok!==true||!result.operationKey){throw new Error("Document generation returned an invalid receipt. The committed operation must be reconciled before retry.");}return result;}',
    'function runPreviewServerAction_(button,fn,pendingMessage,successMessage,encodedPayload){if(!fn){setStatus_("This action is not available from this preview.");return;}setPreviewButtonsDisabled_(true);setStatus_(pendingMessage||"Working…");try{var payload=encodedPayload?JSON.parse(decodeURIComponent(encodedPayload)):{};google.script.run.withSuccessHandler(function(value){try{var result=parsePreviewServerReceipt_(value);setPreviewButtonsDisabled_(false);var warning=result.warning?" "+result.warning:"";var retry=result.idempotent?" Existing verified generation reconciled.":"";setStatus_((successMessage||"Action completed successfully.")+retry+warning);}catch(error){setPreviewButtonsDisabled_(false);setStatus_(previewFailureMessage_(error));}}).withFailureHandler(function(error){setPreviewButtonsDisabled_(false);setStatus_(previewFailureMessage_(error));})[fn](payload);}catch(e){setPreviewButtonsDisabled_(false);setStatus_(previewFailureMessage_(e));}}',
    'function setStatus_(message){var el=document.getElementById("previewStatus");if(el){el.textContent=message;}}',
    '</script>'
  ].join('');
}
