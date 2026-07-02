/**
 * Rogers Holdings OS - Client Deliverable Preview System.
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
  const company = settings.company || 'Selected Company';
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
  const gmailAction = settings.gmailAction || 'createOutreachGmailDraft';
  return [
    '<div class="button-row">',
    '<button class="primary" type="button" onclick="setPreviewMode_()">Preview</button>',
    `<button type="button" onclick="toggleEditMode_()" ${settings.editable ? '' : 'disabled'}>Edit</button>`,
    `<button type="button" onclick="runPreviewServerAction_('${escapeHtml_(generatePdfAction)}', 'PDF generation started.')">Generate PDF</button>`,
    `<button type="button" onclick="runPreviewServerAction_('${escapeHtml_(gmailAction)}', 'Gmail draft creation started.')">Create Gmail Draft</button>`,
    `<button type="button" onclick="savePreviewEdits_()" ${settings.editable ? '' : 'disabled'}>Save</button>`,
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
    return '<p class="muted">No details available yet.</p>';
  }
  return '<ul>' + values.map(function(item) {
    return `<li>${escapeHtml_(item)}</li>`;
  }).join('') + '</ul>';
}

function showExecutiveSnapshotPreview_(prospect, reportFile) {
  const findings = getSmartFindings_(prospect);
  const digitalPresence = getDigitalPresenceAssessment_(prospect.auditScore);
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Executive Snapshot</div>',
    `<h2>${escapeHtml_(prospect.company || 'Selected Company')}</h2>`,
    '<p>Concise meeting-focused summary prepared for initial review.</p>',
    '</div>',
    '<div class="card-grid">',
    renderPreviewCard_('Digital Presence Score', `<div class="big-number">${escapeHtml_(digitalPresence.scoreText)}</div><p><strong>${escapeHtml_(digitalPresence.title)}</strong></p><p>${escapeHtml_(digitalPresence.subtitle)}</p>`),
    renderPreviewCard_('Recommended First Step', `<p>${escapeHtml_(buildExecutiveSnapshotFirstStep_(prospect))}</p>`),
    '</div>',
    renderPreviewCard_('Top Opportunities', renderPreviewList_(buildExecutiveSnapshotOpportunities_(prospect, findings).slice(0, 3))),
    renderPreviewCard_('Key Observation', buildExecutiveSnapshotEvidenceHtml_(prospect, reportFile || {}))
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Executive Snapshot',
    company: prospect.company,
    website: prospect.website,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateExecutiveSnapshot',
    editable: false
  }), 'Executive Snapshot');
}

function showDigitalBusinessAssessmentPreview_(prospect, reportFile) {
  const findings = getSmartFindings_(prospect);
  const opportunities = buildAuditOpportunities_(prospect, findings, getAuditReportTextFromReportFile_(reportFile || {}), reportFile || {});
  let cards = buildConsultingFindingCards_(prospect, opportunities, reportFile || {});
  cards = enforcePdfFindingEvidenceQuality_(prospect, reportFile || {}, cards);
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Digital Business Assessment</div>',
    `<h2>${escapeHtml_(prospect.company || 'Selected Company')}</h2>`,
    '<p>Executive summary, findings, evidence, and practical recommendations.</p>',
    '</div>',
    '<div class="card-grid">',
    renderPreviewCard_('Executive Summary', `<p>${escapeHtml_(buildDeliverablePreviewAssessmentSummary_(prospect, cards))}</p>`),
    renderPreviewCard_('Recommended Focus', `<p>${escapeHtml_(buildRecommendedNextStep_(prospect))}</p>`),
    '</div>',
    renderPreviewCard_('Findings', consultingFindingCardsHtml_(cards, getAuditEvidenceObject_(prospect, reportFile || {}))),
    renderPreviewCard_('Recommendations', priorityRoadmapHtml_(prospect))
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Digital Business Assessment',
    company: prospect.company,
    website: prospect.website,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateAuditPackage',
    gmailAction: 'sendAuditPackage',
    editable: false
  }), 'Digital Business Assessment');
}

function showImprovementPlanPreview_(prospect, proposal) {
  const recommendedPackage = buildRecommendedPackage_(prospect);
  const bodyHtml = [
    '<div class="hero-card">',
    '<div class="hero-label">Improvement Plan</div>',
    `<h2>${escapeHtml_(proposal.company || prospect.company || 'Selected Company')}</h2>`,
    '<p>A practical path from assessment findings to measurable business improvement.</p>',
    '</div>',
    '<div class="card-grid">',
    renderPreviewCard_('Executive Recommendation', `<p>${escapeHtml_(proposal.recommendedService || recommendedPackage.name || 'Recommended service package')}</p>`, { editable: true, field: 'executiveRecommendation' }),
    renderPreviewCard_('Estimated Investment', `<p>${escapeHtml_(recommendedPackage.investment || 'Final investment confirmed after scope review')}</p>`, { editable: true, field: 'investment' }),
    '</div>',
    renderPreviewCard_('Recommended Scope', deliverableCardsHtml_(recommendedPackage.deliverables), { editable: true, field: 'scope' }),
    renderPreviewCard_('Business Outcomes', `<p>${escapeHtml_(proposal.impact || proposalImpactFromService_(proposal.recommendedService))}</p>`, { editable: true, field: 'businessOutcomes' }),
    renderPreviewCard_('Next Steps', proposalNextStepsHtml_(prospect), { editable: true, field: 'nextSteps' })
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(createPreviewDialog_({
    title: 'Improvement Plan',
    company: proposal.company || prospect.company,
    website: proposal.website || prospect.website,
    bodyHtml: bodyHtml,
    generatePdfAction: 'generateAuditPackage',
    gmailAction: 'createOutreachGmailDraft',
    editable: true
  }), 'Improvement Plan');
}

function showOutreachEmailPreview_(prospect, drafts, recipient) {
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
  const company = String(prospect && prospect.company || 'the business').trim();
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
    'var editMode=false;',
    'function setPreviewMode_(){editMode=false;document.querySelectorAll(".editable-field").forEach(function(el){el.contentEditable="false";});setStatus_("Preview mode");}',
    'function toggleEditMode_(){editMode=!editMode;document.querySelectorAll(".editable-field").forEach(function(el){el.contentEditable=editMode?"true":"false";});setStatus_(editMode?"Edit mode enabled":"Preview mode");}',
    'function savePreviewEdits_(){setPreviewMode_();setStatus_("Local edits saved in this preview. Regenerate the deliverable to persist changes.");}',
    'function runPreviewServerAction_(fn,msg){if(!fn){setStatus_("No action configured for this button.");return;}setStatus_(msg||"Running action...");try{google.script.run.withSuccessHandler(function(){setStatus_("Action complete.");})[fn]();}catch(e){setStatus_("Action could not be started: "+e.message);}}',
    'function setStatus_(message){var el=document.getElementById("previewStatus");if(el){el.textContent=message;}}',
    'setPreviewMode_();',
    '</script>'
  ].join('');
}
