/**
 * Authoritative Gold Standard client-deliverable model and renderers.
 * The model preserves the lineage Evidence -> AssessmentFinding ->
 * Recommendation -> ImprovementPlanAction without exposing internal keys.
 */

function buildGoldStandardDeliverableInput_(prospect, reportFile, options) {
  const source = normalizeClientProspect_(prospect || {});
  const report = getClientSafeReportFile_(source, reportFile || {});
  const overrides = options && options.reviewedInput ? options.reviewedInput : {};
  const date = overrides.preparedDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const rawEvidence = [].concat(overrides.evidence || buildGoldStandardEvidence_(source, report));
  const rawFindings = [].concat(overrides.findings || buildGoldStandardFindings_(source, report));
  const evidence = rawEvidence.map(function(item, index) {
    return {
      key: String(item.key || 'evidence-' + (index + 1)),
      label: String(item.label || item.title || 'Reviewed evidence'),
      detail: String(item.detail || item.observation || ''),
      state: normalizeGoldStandardEvidenceState_(item.state || item.classification)
    };
  });
  const evidenceKeys = evidence.map(function(item) { return item.key; });
  const findings = rawFindings.map(function(item, index) {
    const state = normalizeGoldStandardEvidenceState_(item.state || item.classification);
    const links = [].concat(item.evidenceKeys || item.evidenceKey || []).filter(function(key) {
      return evidenceKeys.indexOf(String(key)) !== -1;
    }).map(String);
    const recommendation = state === 'Not Verified' ? '' : String(item.recommendation || item.maintain || '');
    return {
      key: String(item.key || 'finding-' + (index + 1)),
      category: String(item.category || item.title || 'Business finding'),
      state: state,
      observation: String(item.observation || item.evidenceGap || ''),
      businessMeaning: String(item.businessMeaning || item.businessImpact || item.businessValue || item.whyVerificationMatters || ''),
      recommendation: recommendation,
      verificationNeeded: state === 'Not Verified' ? String(item.verificationNeeded || '') : '',
      priority: String(item.priority || (state === 'Verified Strength' ? 'Verified Strength' : state)),
      evidenceKeys: links
    };
  });
  const findingKeys = findings.map(function(item) { return item.key; });
  const recommendations = findings.filter(function(item) {
    return (item.state === 'Actionable' || item.state === 'Verified Strength') && item.recommendation;
  }).map(function(item, index) {
    const supplied = [].concat(overrides.recommendations || []).filter(function(candidate) {
      return String(candidate.findingKey || '') === item.key;
    })[0] || {};
    return {
      key: String(supplied.key || 'recommendation-' + (index + 1)),
      findingKey: item.key,
      kind: item.state === 'Verified Strength' ? 'maintain' : 'improvement',
      title: String(supplied.title || item.category),
      change: String(supplied.change || item.recommendation),
      why: String(supplied.why || item.businessMeaning),
      dependency: String(supplied.dependency || 'Owner confirmation of the approved scope and destination.')
    };
  });
  const recommendationKeys = recommendations.map(function(item) { return item.key; });
  const suppliedActions = [].concat(overrides.actions || []);
  const actions = recommendations.map(function(item, index) {
    const supplied = suppliedActions.filter(function(candidate) {
      return String(candidate.recommendationKey || '') === item.key;
    })[0] || {};
    return {
      key: String(supplied.key || 'action-' + (index + 1)),
      recommendationKey: item.key,
      sequence: Number(supplied.sequence || index + 1),
      title: String(supplied.title || item.title),
      outcome: String(supplied.outcome || item.why),
      implementationPath: String(supplied.implementationPath || 'Owner or approved implementation support updates the relevant content or templates.'),
      dependency: String(supplied.dependency || item.dependency),
      completionTest: String(supplied.completionTest || 'Owner verifies the approved change across the intended customer path.')
    };
  }).sort(function(a, b) { return a.sequence - b.sequence; });
  const strength = findings.filter(function(item) { return item.state === 'Verified Strength'; })[0];
  const primary = findings.filter(function(item) { return item.state === 'Actionable'; })[0] || findings[0] || null;
  const model = {
    company: String(overrides.company || source.company || 'Business'),
    website: String(overrides.website || source.website || ''),
    preparedDate: String(date),
    reviewCategory: 'Focused Priorities',
    opening: String(overrides.opening || buildGoldStandardOpening_(source, primary)),
    evidence: evidence,
    limitations: [].concat(overrides.limitations || buildGoldStandardLimitations_(findings)).map(String),
    findings: findings,
    recommendations: recommendations,
    actions: actions,
    primaryFindingKey: primary ? primary.key : '',
    primaryConclusion: String(overrides.primaryConclusion || (primary ? primary.category : 'Confirm the highest-value business priority')),
    primaryConclusionDetail: String(overrides.primaryConclusionDetail || (primary ? primary.observation : 'The available evidence should be reviewed with the owner before implementation decisions are made.')),
    businessImplication: String(overrides.businessImplication || (primary ? primary.businessMeaning : 'A focused review will establish the most useful next step.')),
    firstStep: String(overrides.firstStep || (primary && primary.recommendation ? primary.recommendation : 'Confirm the primary business goal and the evidence required to support it.')),
    preserveWhatWorks: String(overrides.preserveWhatWorks || (strength ? strength.recommendation : 'Preserve verified strengths while implementing approved improvements.')),
    nextStep: String(overrides.nextStep || 'Review the Digital Business Assessment, confirm the approved priorities, and decide whether implementation will be handled internally or separately scoped.'),
    decisions: [].concat(overrides.decisions || ['Confirm the primary customer action or business outcome.', 'Approve the scope and dependencies for each priority.', 'Assign an owner for implementation and verification.']).map(String)
  };
  validateGoldStandardLineage_(model, findingKeys, recommendationKeys);
  return deepFreezeGoldStandard_(model);
}

function normalizeGoldStandardEvidenceState_(state) {
  const value = String(state || '').trim().toLowerCase();
  if (value === 'verified strength' || value === 'strength' || value === 'pass') return 'Verified Strength';
  if (value === 'not verified' || value === 'unknown' || value === 'unverified') return 'Not Verified';
  return 'Actionable';
}

function validateGoldStandardLineage_(model, findingKeys, recommendationKeys) {
  model.findings.forEach(function(item) {
    if (!item.evidenceKeys.length) throw new Error('Every Gold Standard finding must cite reviewed evidence.');
    if (item.state === 'Not Verified' && item.recommendation) throw new Error('Not Verified evidence cannot create an actionable recommendation.');
  });
  model.recommendations.forEach(function(item) {
    if (findingKeys.indexOf(item.findingKey) === -1) throw new Error('Gold Standard recommendation has invalid finding lineage.');
  });
  model.actions.forEach(function(item) {
    if (recommendationKeys.indexOf(item.recommendationKey) === -1) throw new Error('Gold Standard action has invalid recommendation lineage.');
  });
}

function deepFreezeGoldStandard_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key) { deepFreezeGoldStandard_(value[key]); });
  return Object.freeze(value);
}

function buildGoldStandardEvidence_(prospect, report) {
  const evidence = [];
  const visual = getAuditEvidenceObject_(prospect, report || {});
  if (visual && (visual.websiteScreenshotUrl || visual.websiteScreenshotBase64)) evidence.push({ key: 'desktop', label: 'Desktop website review', detail: 'Homepage, navigation, customer action, and visible trust signals.', state: 'Actionable' });
  if (visual && (visual.mobileScreenshotUrl || visual.mobileScreenshotBase64)) evidence.push({ key: 'mobile', label: 'Mobile website review', detail: 'Mobile hierarchy, customer action, and service path.', state: 'Actionable' });
  if (!evidence.length) evidence.push({ key: 'reviewed-narrative', label: 'Reviewed assessment evidence', detail: getAuditReportTextFromReportFile_(report) || prospect.summary || prospect.notes || 'Existing verified prospect audit evidence.', state: 'Actionable' });
  evidence.push({ key: 'operational-performance', label: 'Operational performance', detail: 'Response time, lead quality, and fulfillment outcomes were not observable in the reviewed public evidence.', state: 'Not Verified' });
  return evidence;
}

function buildGoldStandardFindings_(prospect, report) {
  const evidenceKeys = buildGoldStandardEvidence_(prospect, report).map(function(item) { return item.key; });
  const eligible = filterClientEligibleEvidence_([].concat((report && report.findings) || [], getSmartFindings_(prospect)), prospect, report || {}, 'finding');
  if (!eligible.length) return [{ key: 'verification', category: 'Additional business evidence', state: 'Not Verified', evidenceGap: 'The available reviewed evidence does not support a definitive improvement finding.', whyVerificationMatters: 'Owner confirmation is required before implementation advice is appropriate.', verificationNeeded: 'Confirm the customer goal, current workflow, and supporting evidence.', evidenceKeys: evidenceKeys }];
  const findings = eligible.slice(0, 3).map(function(candidate, index) {
    const item = candidate && typeof candidate === 'object' ? candidate : {};
    const text = typeof candidate === 'object' ? String(item.observation || item.finding || item.title || '') : String(candidate);
    const state = normalizeGoldStandardEvidenceState_(item.state || item.classification || item.evidenceState);
    return {
      key: 'finding-' + (index + 1),
      category: String(item.category || item.title || (index === 0 ? 'Primary Priority' : 'Supporting Priority ' + (index + 1))),
      state: state,
      observation: text,
      businessImpact: String(item.businessImpact || item.businessValue || item.whyVerificationMatters || 'This verified finding may affect customer clarity, trust, or the path to a qualified inquiry.'),
      recommendation: state === 'Not Verified' ? '' : String(item.recommendation || item.maintain || text),
      verificationNeeded: state === 'Not Verified' ? String(item.verificationNeeded || 'Confirm the current operational standard and supporting evidence.') : '',
      priority: String(item.priority || (state === 'Actionable' ? (index === 0 ? 'Primary - address first.' : 'Secondary - sequence after the primary priority.') : state)),
      evidenceKeys: evidenceKeys
    };
  });
  if (!findings.some(function(item) { return normalizeGoldStandardEvidenceState_(item.state) === 'Not Verified'; })) {
    findings.push({ key: 'operational-verification', category: 'Operational Performance', state: 'Not Verified', evidenceGap: 'Response time, lead quality, and fulfillment outcomes were not verified by the reviewed public evidence.', whyVerificationMatters: 'Public claims should reflect standards the business can consistently support.', verificationNeeded: 'Confirm current operating standards before publishing performance claims.', priority: 'Not Verified', evidenceKeys: ['operational-performance'] });
  }
  return findings;
}

function buildGoldStandardLimitations_(findings) {
  const gaps = findings.filter(function(item) { return normalizeGoldStandardEvidenceState_(item.state || item.classification) === 'Not Verified'; });
  return gaps.length ? gaps.map(function(item) { return String(item.verificationNeeded || item.evidenceGap || item.observation || 'Additional verification is required.'); }) : ['Operational performance and outcomes not visible in the reviewed evidence were not assumed.'];
}

function buildGoldStandardOpening_(prospect, primary) {
  return (prospect.company || 'The business') + ' has a credible foundation. The review concentrates on ' + (primary ? String(primary.category || primary.title || 'the clearest verified priorities').toLowerCase() : 'the clearest verified priorities') + '.';
}

function buildGoldStandardExecutiveBriefPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardExecutiveBriefHtml_(input), 'Executive Brief.pdf');
}

function buildGoldStandardAssessmentPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardAssessmentHtml_(input), 'Digital Business Assessment.pdf');
}

function buildGoldStandardImprovementPlanPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardImprovementPlanHtml_(input), 'Improvement Plan.pdf');
}

function goldStandardCss_() {
  return '@page{margin:0;size:letter}*{box-sizing:border-box}body{margin:0;background:#ddd;color:#111;font-family:Arial,Helvetica,sans-serif}.page{width:8.5in;height:11in;background:#fff;margin:0 auto;position:relative;overflow:hidden;break-after:page;page-break-after:always;padding:.78in .66in .62in}.page:last-child{break-after:auto}.content-page{padding-top:.92in}.header{position:absolute;top:.28in;left:.66in;right:.66in;height:.33in;border-bottom:1px solid #d8c59d;font-size:9px;text-transform:uppercase;letter-spacing:1.1px;font-weight:700}.header span{float:right;color:#70695e}footer{position:absolute;bottom:.25in;left:.66in;right:.66in;border-top:1px solid #d8c59d;padding-top:7px;color:#70695e;font-size:7.5px;text-transform:uppercase;letter-spacing:.65px;white-space:nowrap}footer b{color:#b88a32;padding:0 6px}h1,h2,h3,p{margin-top:0}h1{font-size:34px;line-height:1.03}h2{font-size:21px;border-bottom:2px solid #b88a32;padding-bottom:9px;margin-bottom:18px}h3{font-size:12px;margin:0 0 5px;text-transform:uppercase;letter-spacing:.7px}p,li{font-size:10.5px;line-height:1.46}.eyebrow{color:#b88a32;font-size:9px;text-transform:uppercase;letter-spacing:1.4px;font-weight:700}.cover{padding:0;background:#f7f2e7;display:grid;grid-template-columns:36% 64%}.rail{background:#111;color:white;padding:.64in .38in;border-right:5px solid #b88a32;position:relative}.rail .brand{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1.7px}.rail .descriptor{margin-top:.55in;border-top:3px solid #b88a32;padding-top:.2in;color:#ead8b3;font-size:10px;text-transform:uppercase;letter-spacing:1.2px}.motto{position:absolute;bottom:.55in;left:.38in;color:#b88a32;font-size:9px;text-transform:uppercase;letter-spacing:1.4px}.cover-main{padding:1.2in .58in}.cover-main h1{font-size:44px;margin:.12in 0 .68in}.client{font-size:27px;font-weight:700;line-height:1.12}.url{font-size:11px;color:#6d675e;margin-top:9px}.date{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6d675e;margin-top:18px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #d7c49e;border-left:4px solid #b88a32;background:#fff;padding:14px 15px;margin-bottom:12px;break-inside:avoid-page;page-break-inside:avoid}.soft{background:#f7f2e7}.label{font-size:8px;color:#b88a32;text-transform:uppercase;letter-spacing:1.1px;font-weight:700;margin-bottom:6px}.finding{border:1px solid #d7c49e;border-top:4px solid #111;padding:14px 16px;margin:0 0 14px;break-inside:avoid-page;page-break-inside:avoid;background:#fff}.finding-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:11px}.finding-head strong{font-size:13px}.pill{font-size:8px;text-transform:uppercase;letter-spacing:.8px;background:#111;color:white;padding:5px 8px;height:22px}.finding dl{display:grid;grid-template-columns:128px 1fr;gap:6px 12px;margin:0}.finding dt{font-size:8px;text-transform:uppercase;letter-spacing:.75px;color:#756b5d;font-weight:700}.finding dd{font-size:9.5px;line-height:1.4;margin:0}.roadmap{display:grid;gap:12px}.action{border:1px solid #d7c49e;background:#f7f2e7;padding:14px 16px;break-inside:avoid-page}.action-head{display:flex;gap:12px;align-items:baseline}.seq{color:#b88a32;font-size:20px;font-weight:700}.action table{width:100%;border-collapse:collapse;margin-top:9px}.action td{vertical-align:top;border-top:1px solid #ddd0b8;padding:7px 8px 0 0;font-size:9px;line-height:1.35}.decision{background:#111;color:white;border-top:4px solid #b88a32;padding:18px}.decision h3{color:#b88a32}ul{padding-left:17px;margin:6px 0}.brief{background:#f7f2e7;padding:.34in .43in .28in}.brief .top{border-bottom:3px solid #b88a32;display:flex;justify-content:space-between;padding-bottom:14px}.brief .top h1{font-size:28px;margin:3px 0 0}.brief .meta{text-align:right;font-size:9px;line-height:1.5;text-transform:uppercase;color:#70695e}.brief .identity{display:grid;grid-template-columns:1.35fr .65fr;gap:14px;margin-top:16px}.score{background:#111;color:white;padding:14px}.score strong{display:block;color:#b88a32;font-size:24px}.brief .main{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:13px}.brief .card{padding:12px 13px;margin:0}.brief .primary{margin-top:13px}.brief .cta{margin-top:13px;background:#111;color:white;border-top:4px solid #b88a32;padding:14px}.brief footer{left:.43in;right:.43in}.tiny{font-size:9px;color:#6d675e}.section-intro{margin-bottom:14px}.atomic{break-inside:avoid-page;page-break-inside:avoid}';
}

function goldStandardDocument_(pages) { return '<!doctype html><html><head><meta charset="utf-8"><style>' + goldStandardCss_() + '</style></head><body>' + pages.join('') + '</body></html>'; }
function goldStandardHeader_(title, page) { return '<div class="header">Rogers Holdings LLC <span>' + escapeHtml_(title) + ' · ' + escapeHtml_(page) + '</span></div>'; }
function goldStandardFooter_(title) { const contact = getRogersContactInfo_(); return '<footer>Rogers Holdings LLC <b>|</b> ' + escapeHtml_(title) + (contact.email ? ' <b>|</b> ' + escapeHtml_(contact.email) : '') + '</footer>'; }
function goldStandardCover_(input, title, descriptor) { return '<section class="page cover"><div class="rail"><div class="brand">Rogers Holdings LLC</div><div class="descriptor">' + escapeHtml_(descriptor) + '</div><div class="motto">Christ. Family. Business.</div></div><div class="cover-main"><div class="eyebrow">Prepared for</div><h1>' + escapeHtml_(title) + '</h1><div class="client">' + escapeHtml_(input.company) + '</div><div class="url">' + escapeHtml_(input.website) + '</div><div class="date">Prepared ' + escapeHtml_(input.preparedDate) + '</div></div></section>'; }
function goldStandardList_(items) { return '<ul>' + items.filter(Boolean).map(function(item) { return '<li>' + escapeHtml_(item) + '</li>'; }).join('') + '</ul>'; }

function buildGoldStandardExecutiveBriefHtml_(input) {
  const primary = input.findings.filter(function(item) { return item.key === input.primaryFindingKey; })[0] || input.findings[0] || {};
  const stoodOut = input.findings.slice(0, 3).map(function(item) { return item.observation; });
  const evidence = input.evidence.map(function(item) { return item.label; }).join(' · ');
  const page = '<section class="page brief"><div class="top"><div><div class="eyebrow">Business Snapshot</div><h1>Executive Brief</h1></div><div class="meta">Prepared ' + escapeHtml_(input.preparedDate) + '<br>Rogers Holdings LLC</div></div><div class="identity"><div class="card"><div class="label">Prepared for</div><h2 style="font-size:22px;border:0;padding:0;margin:0 0 5px">' + escapeHtml_(input.company) + '</h2><div class="tiny">' + escapeHtml_(input.website) + '</div><p style="margin-top:8px">' + escapeHtml_(input.opening) + '</p></div><div class="score"><strong>Focused Priorities</strong><div class="label" style="color:#ead8b3">Review category</div><p>Priority improvements are practical and evidence-based.</p></div></div><div class="main"><div class="card"><div class="label">What stood out</div>' + goldStandardList_(stoodOut) + '</div><div class="card"><div class="label">Business implication</div><p>' + escapeHtml_(input.businessImplication) + '</p><div class="label">Recommended first step</div><p>' + escapeHtml_(input.firstStep) + '</p></div></div><div class="card primary"><div class="label">Primary priority</div><h3>' + escapeHtml_(input.primaryConclusion) + '</h3><p>' + escapeHtml_(input.primaryConclusionDetail || primary.observation || '') + '</p></div><div class="card" style="margin-top:13px"><div class="label">Evidence reviewed</div><p>' + escapeHtml_(evidence) + '</p></div><div class="cta"><h3>Recommended next step</h3><p>' + escapeHtml_(input.nextStep) + '</p></div>' + goldStandardFooter_('Executive Brief') + '</section>';
  return goldStandardDocument_([page]);
}

function goldStandardFinding_(finding) {
  let rows;
  if (finding.state === 'Verified Strength') rows = [['Observation', finding.observation], ['Business Value', finding.businessMeaning], ['Maintain', finding.recommendation], ['Classification', finding.priority]];
  else if (finding.state === 'Not Verified') rows = [['Evidence Gap', finding.observation], ['Why Verification Matters', finding.businessMeaning], ['Verification Needed', finding.verificationNeeded], ['Classification', finding.priority]];
  else rows = [['Observation', finding.observation], ['Business Impact', finding.businessMeaning], ['Recommendation', finding.recommendation], ['Priority', finding.priority]];
  return '<article class="finding"><div class="finding-head"><strong>' + escapeHtml_(finding.category) + '</strong><span class="pill">' + escapeHtml_(finding.state === 'Actionable' ? finding.priority.split(' - ')[0] : finding.state) + '</span></div><dl>' + rows.map(function(row) { return '<dt>' + escapeHtml_(row[0]) + '</dt><dd>' + escapeHtml_(row[1]) + '</dd>'; }).join('') + '</dl></article>';
}

function goldStandardRecommendationCard_(item, index) { return '<div class="card"><h3>' + (index + 1) + '. ' + escapeHtml_(item.title) + '</h3><p><b>What should change:</b> ' + escapeHtml_(item.change) + '</p><p><b>Why it matters:</b> ' + escapeHtml_(item.why) + '</p><p><b>Dependency:</b> ' + escapeHtml_(item.dependency) + '</p></div>'; }
function goldStandardAction_(item) { return '<div class="action"><div class="action-head"><span class="seq">' + ('0' + item.sequence).slice(-2) + '</span><h3>' + escapeHtml_(item.title) + '</h3></div><table><tr><td><b>Owner/path</b><br>' + escapeHtml_(item.implementationPath) + '</td><td><b>Dependency</b><br>' + escapeHtml_(item.dependency) + '</td><td><b>Completion test</b><br>' + escapeHtml_(item.completionTest) + '</td></tr></table></div>'; }

function buildGoldStandardAssessmentHtml_(input) {
  const actionable = input.findings.filter(function(item) { return item.state === 'Actionable'; });
  const strengths = input.findings.filter(function(item) { return item.state === 'Verified Strength'; });
  const gaps = input.findings.filter(function(item) { return item.state === 'Not Verified'; });
  const evidenceItems = input.evidence.map(function(item) { return item.label + (item.detail ? ': ' + item.detail : ''); }).concat(input.limitations.map(function(item) { return 'Limitation: ' + item; }));
  const pages = [goldStandardCover_(input, 'Digital Business Assessment', 'Independent Digital Assessment')];
  pages.push('<section class="page content-page">' + goldStandardHeader_('Digital Business Assessment', '02') + '<h2>Executive Conclusion</h2><div class="card soft"><div class="label">Primary conclusion</div><h1 style="font-size:27px">' + escapeHtml_(input.primaryConclusion) + '</h1><p>' + escapeHtml_(input.primaryConclusionDetail) + '</p></div><div class="grid2"><div class="card"><h3>Business significance</h3><p>' + escapeHtml_(input.businessImplication) + '</p></div><div class="card"><h3>Assessment basis</h3><p>' + escapeHtml_(input.evidence.map(function(item) { return item.label; }).join(', ')) + '.</p></div></div><h2 style="margin-top:16px">Evidence Reviewed and Limitations</h2><div class="card">' + goldStandardList_(evidenceItems) + '</div>' + goldStandardFooter_('Digital Business Assessment') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Digital Business Assessment', '03') + '<h2>Findings - Priority Improvements</h2>' + actionable.slice(0, 2).map(goldStandardFinding_).join('') + goldStandardFooter_('Digital Business Assessment') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Digital Business Assessment', '04') + '<h2>Findings - Strengths and Verification</h2>' + strengths.concat(gaps).map(goldStandardFinding_).join('') + goldStandardFooter_('Digital Business Assessment') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Digital Business Assessment', '05') + '<h2>Priority Improvements</h2>' + input.recommendations.filter(function(item) { return item.kind === 'improvement'; }).slice(0, 3).map(goldStandardRecommendationCard_).join('') + '<h2 style="margin-top:18px">Preserve What Works</h2><div class="card soft"><h3>Verified strength</h3><p>' + escapeHtml_(input.preserveWhatWorks) + '</p><p><b>Evidence lineage:</b> ' + escapeHtml_(strengths.map(function(item) { return item.observation; }).join(' ') || 'Preserve only strengths supported by reviewed evidence.') + '</p></div>' + goldStandardFooter_('Digital Business Assessment') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Digital Business Assessment', '06') + '<h2>Phased Roadmap</h2><div class="roadmap">' + input.actions.slice(0, 3).map(goldStandardAction_).join('') + '</div><div class="decision" style="margin-top:16px"><h3>Recommended next step</h3><p>' + escapeHtml_(input.nextStep) + '</p></div>' + goldStandardFooter_('Digital Business Assessment') + '</section>');
  return goldStandardDocument_(pages);
}

function buildGoldStandardImprovementPlanHtml_(input) {
  const priorities = input.findings.filter(function(item) { return item.state !== 'Not Verified'; }).slice(0, 3);
  const pages = [goldStandardCover_(input, 'Improvement Plan', 'Recommended Solution')];
  pages.push('<section class="page content-page">' + goldStandardHeader_('Improvement Plan', '02') + '<h2>Priorities &amp; Strategy</h2><p class="section-intro">This advisory plan concentrates on the approved priorities that improve business clarity without expanding scope unnecessarily.</p>' + priorities.map(function(item, index) { return '<div class="card"><div class="label">Priority ' + (index + 1) + '</div><h3>' + escapeHtml_(item.category) + '</h3><p>Why it matters: ' + escapeHtml_(item.businessMeaning) + '</p></div>'; }).join('') + '<div class="decision"><h3>Strategy</h3><p>Address the primary improvement first, sequence dependent work second, and verify the combined experience without weakening proven strengths.</p></div>' + goldStandardFooter_('Improvement Plan') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Improvement Plan', '03') + '<h2>Action Roadmap</h2><div class="roadmap">' + input.actions.slice(0, 3).map(function(item) { return '<div class="action"><div class="action-head"><span class="seq">' + ('0' + item.sequence).slice(-2) + '</span><h3>' + escapeHtml_(item.title) + '</h3></div><table><tr><td><b>Intended outcome</b><br>' + escapeHtml_(item.outcome) + '</td><td><b>Implementation path</b><br>' + escapeHtml_(item.implementationPath) + '</td></tr><tr><td><b>Dependency</b><br>' + escapeHtml_(item.dependency) + '</td><td><b>Completion test</b><br>' + escapeHtml_(item.completionTest) + '</td></tr></table></div>'; }).join('') + '</div>' + goldStandardFooter_('Improvement Plan') + '</section>');
  pages.push('<section class="page content-page">' + goldStandardHeader_('Improvement Plan', '04') + '<h2>Decisions &amp; Next Step</h2><div class="grid2"><div class="card"><div class="label">Quick wins</div>' + goldStandardList_(['Approve the primary customer action and destination.', 'Confirm the business scope language required for implementation.', 'Assign the owner responsible for final verification.']) + '</div><div class="card"><div class="label">Later work</div>' + goldStandardList_(input.limitations.map(function(item) { return 'Verify before acting: ' + item; })) + '</div></div><div class="card"><h3>Ownership</h3><p><b>' + escapeHtml_(input.company) + ':</b> approve priorities, scope, destinations, and the final experience.</p><p><b>Implementation support, if engaged:</b> prepare approved content or template changes, complete quality assurance, and document results.</p><p>Rogers Holdings can separately scope implementation if the client wants assistance.</p></div><div class="card"><h3>Client decisions</h3>' + goldStandardList_(input.decisions) + '</div><div class="decision"><h3>Recommended next step</h3><p>' + escapeHtml_(input.nextStep) + '</p></div>' + goldStandardFooter_('Improvement Plan') + '</section>');
  return goldStandardDocument_(pages);
}
