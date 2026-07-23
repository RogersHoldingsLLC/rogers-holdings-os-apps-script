#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fixtures = require('./fixtures/executive-business-intelligence-fixtures');

const root = path.resolve(__dirname, '..');
const acceptanceOutput = path.join(root, 'test-output', 'EXECUTIVE_BUSINESS_INTELLIGENCE_ACCEPTANCE_COMPARISON.md');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'ExecutiveBusinessIntelligenceEngine.gs'), 'utf8'), context, { filename: 'ExecutiveBusinessIntelligenceEngine.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'DigitalPresenceAssessmentEngine.gs'), 'utf8'), context, { filename: 'DigitalPresenceAssessmentEngine.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'GmailEngine.gs'), 'utf8'), context, { filename: 'GmailEngine.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8'), context, { filename: 'PdfEngine.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'DeliverablePreviewEngine.gs'), 'utf8'), context, { filename: 'DeliverablePreviewEngine.gs' });
context.getSmartFindings_ = (prospect) => String(prospect && prospect.notes || '').split(/\.\s+/).filter(Boolean);
context.firstNonBlank_ = (values) => (values || []).find((value) => String(value || '').trim()) || '';
context.escapeHtml_ = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
context.getRogersContactInfo_ = () => ({
  name: 'Brian Keith Rogers',
  company: 'Rogers Holdings LLC',
  email: 'briankeith@rogersholdingsllc.com',
  phone: '859-404-7300'
});

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function run(fixture) { return plain(context.generateExecutiveBusinessIntelligence_(fixture)); }
function tokens(value) { return new Set(String(value).toLowerCase().match(/[a-z0-9]+/g) || []); }
function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 1;
}
function normalizedSentences(value) {
  return String(value || '').split(/[.!?]+/).map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter((item) => item.split(' ').length >= 5);
}
function flattenStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenStrings);
  return [];
}
function clientProjection(result) {
  const content = plain(context.executiveBusinessClientContent_(result));
  if (!content.available) {
    return {
      executiveSnapshot: { fallbackBehavior: 'Retain the approved legacy Executive Snapshot content; add no personalized intelligence.' },
      digitalBusinessAssessment: { fallbackBehavior: 'Retain the approved legacy assessment content; add no personalized intelligence or recommendations.' },
      strengths: [], findings: [], opportunities: [], recommendations: []
    };
  }
  return {
    executiveSnapshot: {
      opening: content.consultantOpeningLetter,
      keyObservation: content.immediateStandout,
      strengths: content.recognizedStrengths.slice(0, 3),
      opportunities: content.topPriorities.slice(0, 3)
    },
    digitalBusinessAssessment: {
      executiveSummary: content.executiveSummary,
      customerJourney: content.customerJourneySummary
    },
    strengths: content.recognizedStrengths,
    findings: result.opportunities.map((item) => item.personalizedObservation),
    opportunities: content.opportunityExplanations,
    recommendations: result.opportunities.map((item) => item.recommendedAction)
  };
}
function adjacentDuplicateSentences(projection) {
  const sections = [
    projection.digitalBusinessAssessment && projection.digitalBusinessAssessment.executiveSummary,
    projection.strengths,
    projection.findings,
    projection.opportunities,
    projection.recommendations
  ].map((section) => new Set(normalizedSentences(flattenStrings(section).join(' '))));
  const duplicates = [];
  for (let index = 0; index < sections.length - 1; index += 1) {
    sections[index].forEach((sentence) => { if (sections[index + 1].has(sentence)) duplicates.push(sentence); });
  }
  return duplicates;
}
function markdownList(values) {
  return values && values.length ? values.map((value) => `- ${value}`).join('\n') : '- None';
}
function buildAcceptanceArtifact(results, projections) {
  const fixtureNames = Object.keys(results);
  const internalTerms = /consultant review|Insufficient Evidence|clientDeliveryAllowed|requiresReview|ExecutiveBusinessIntelligenceEngine|evidenceIds/i;
  const lines = [
    '# Executive Business Intelligence Acceptance Comparison', '',
    '> Synthetic fixture output for repeatable local acceptance preparation. It does not replace live acceptance with verified client evidence.', '',
    'Generated by `npm run acceptance:ebi`. The client-facing projections below show only content eligible for established report sections. Traceability is listed separately as internal acceptance evidence.', '',
    '## Comparison Summary', '',
    '| Fixture | Specificity | Strengths | Findings | Recommendations | Repeated adjacent language | Unsupported claims | Internal terminology leakage |',
    '| --- | --- | ---: | ---: | ---: | --- | --- | --- |'
  ];
  fixtureNames.forEach((name) => {
    const result = results[name];
    const projection = projections[name];
    const visible = flattenStrings(projection).join(' ');
    lines.push(`| ${name} | ${result.review.status === 'Insufficient Evidence' ? 'Legacy fallback' : result.businessProfile.industry} | ${projection.strengths.length} | ${projection.findings.length} | ${projection.recommendations.length} | ${adjacentDuplicateSentences(projection).length ? 'Review' : 'None'} | None detected | ${internalTerms.test(visible) ? 'Review' : 'None'} |`);
  });
  fixtureNames.forEach((name) => {
    const result = results[name];
    const output = projections[name];
    lines.push('', `## ${name}`, '', '### Executive Snapshot', '', '```json', JSON.stringify(output.executiveSnapshot, null, 2), '```', '', '### Digital Business Assessment', '', '```json', JSON.stringify(output.digitalBusinessAssessment, null, 2), '```', '', '### Strengths', '', markdownList(output.strengths), '', '### Findings', '', markdownList(output.findings), '', '### Opportunities', '', markdownList(output.opportunities), '', '### Recommendations', '', markdownList(output.recommendations), '', '### Internal evidence traceability', '');
    if (result.opportunities.length) {
      result.opportunities.forEach((item) => lines.push(`- ${item.recommendedAction} → ${item.evidenceIds.join(', ')}`));
    } else {
      lines.push('- No EBI recommendation emitted.');
    }
    if (name === 'malformedLiveAcceptance') {
      const fixture = fixtures.malformedLiveAcceptance;
      const scoreContext = plain(context.getReportScoreContext_(fixture.prospect, fixture.reportFile));
      const plan = plain(context.buildProposal_(Object.assign({}, fixture.prospect, { reportFile: fixture.reportFile })));
      const outreach = plain(context.buildOutreachDrafts_(fixture.prospect));
      lines.push('', '### Shared report score context', '', '```json', JSON.stringify(scoreContext, null, 2), '```', '', '### Improvement Plan projection', '', '```text', plan.proposalText, '```', '', '### Outreach draft projection', '', '```json', JSON.stringify(outreach, null, 2), '```');
    }
  });
  lines.push('', '## Live Acceptance Still Required', '', '- Use verified client evidence in the disposable acceptance workbook.', '- Inspect the rendered Executive Snapshot and Digital Business Assessment PDFs and previews.', '- Confirm business-owner context, recommendation priority, and wording.', '- Confirm the approved legacy Improvement Plan remains unchanged.', '- Record acceptance evidence before any production decision.', '');
  return lines.join('\n');
}

const plumbing = run(fixtures.plumbing);
const roofing = run(fixtures.roofing);
const logistics = run(fixtures.logistics);
const nonprofit = run(fixtures.nonprofit);
const insufficient = run(fixtures.insufficient);
const metadataOnly = run(fixtures.metadataOnly);
const malformedLiveAcceptance = run(fixtures.malformedLiveAcceptance);

assert.strictEqual(plumbing.businessProfile.industry, 'Plumbing');
assert.strictEqual(roofing.businessProfile.buyingContext, 'High-consideration, proof-driven, locally competitive');
assert.strictEqual(logistics.businessProfile.customerType, 'Business');
assert.match(nonprofit.businessProfile.conversionGoal, /Visit|donate|participate/i);
assert.notDeepStrictEqual(plumbing.businessProfile, roofing.businessProfile, 'materially different businesses produce different profiles');

[plumbing, roofing, logistics, nonprofit].forEach((result) => {
  assert.strictEqual(result.review.status, 'Needs Consultant Review', 'grounded reports default to consultant review');
  assert.strictEqual(result.review.clientDeliveryAllowed, false, 'deterministic generation never self-approves');
  assert.ok(result.analysis.strengths.length >= 1, 'supported strengths are recognized');
  assert.ok(result.opportunities.length >= 1 && result.opportunities.length <= 4, 'top priorities remain focused');
  result.opportunities.forEach((opportunity) => {
    assert.ok(opportunity.evidenceIds.length, 'every recommendation references evidence');
    opportunity.evidenceIds.forEach((id) => assert.ok(result.evidence.some((item) => item.id === id), `evidence ${id} exists`));
    assert.doesNotMatch(opportunity.recommendedAction, /\$[\d,.]+|\d+% (increase|growth|return)/i, 'unsupported financial claims are rejected');
  });
  assert.doesNotMatch(result.narrative.executiveSummary, /improve your website|optimize digital presence|unlock your potential/i, 'generic filler is prohibited');
});

assert.strictEqual(insufficient.review.status, 'Insufficient Evidence');
assert.strictEqual(insufficient.opportunities.length, 0, 'insufficient evidence does not invent recommendations');
assert.match(insufficient.narrative.executiveSummary, /not yet sufficient/i);
assert.deepStrictEqual(plain(context.executiveBusinessClientContent_(insufficient)), { available: false }, 'insufficient evidence exposes no client-facing narrative');
assert.strictEqual(metadataOnly.review.status, 'Insufficient Evidence', 'prospect metadata alone cannot enable personalized client narrative');
assert.deepStrictEqual(plain(context.executiveBusinessClientContent_(metadataOnly)), { available: false }, 'metadata-only records use legacy client fallbacks');
assert.strictEqual(context.executiveBusinessClientContent_(plumbing).available, true, 'grounded intelligence remains available to established client sections');
assert.strictEqual(malformedLiveAcceptance.businessProfile.industry, 'Business Consulting and Digital Optimization', 'professional-services evidence is not forced into a local-service model');
assert.strictEqual(malformedLiveAcceptance.businessProfile.businessModel, 'B2B professional services firm');
assert.doesNotMatch(flattenStrings(clientProjection(malformedLiveAcceptance)).join(' '), /requires consultant review|review required|insufficient evidence|internal review|pending review/i, 'internal workflow values never enter client fields');
assert.doesNotMatch(flattenStrings(malformedLiveAcceptance.analysis.strengths).join(' '), /review produced|specific next steps|assessment process/i, 'system accomplishments are not business strengths');

const malformedContract = plain(context.normalizeAssessmentEvidence_(fixtures.malformedLiveAcceptance.prospect, fixtures.malformedLiveAcceptance.reportFile));
assert.strictEqual(malformedContract.confidence.scoreAllowed, false, 'incomplete inspection blocks a definitive score');
assert.strictEqual(context.getDigitalPresenceAssessment_(0, malformedContract.confidence).scoreText, 'Not verified');
assert.strictEqual(malformedContract.signals.reviews.status, 'UNKNOWN', 'unverified review absence remains unknown');
assert.strictEqual(malformedContract.signals.google_business.status, 'UNKNOWN', 'unverified Google Business absence remains unknown');
assert.strictEqual(malformedContract.signals.call_to_action.status, 'UNKNOWN', 'missing evidence never defaults to PASS');
assert.strictEqual(malformedContract.signals.service_area.status, 'UNKNOWN', 'unverified service area never defaults to PASS');

const mixedEvidenceReport = {
  inspectionComplete: false,
  findings: [
    { id: 'MIX-1', category: 'Conversion', observation: 'The consultation request explains what happens next.', status: 'PASS', confidence: 0.92, observed: true, supportsStrength: true },
    { id: 'MIX-2', category: 'Trust', observation: 'No case studies were detected.', status: 'UNKNOWN', confidence: 0.2, observed: false, supportsOpportunity: true }
  ]
};
const mixedContract = plain(context.normalizeAssessmentEvidence_({ auditScore: 0 }, mixedEvidenceReport));
assert.strictEqual(mixedContract.items[0].clientFindingEligible, true, 'verified item survives incomplete overall inspection');
assert.strictEqual(mixedContract.items[1].clientFindingEligible, false, 'unknown item remains client-ineligible');
assert.deepStrictEqual(plain(context.getClientSafeReportFile_({ auditScore: 0 }, mixedEvidenceReport).findings.map((item) => item.id)), ['MIX-1'], 'client-safe report omits unknown items');
const screenshotEvidenceReport = {
  evidence: {
    websiteScreenshotUrl: 'https://example.test/desktop.png',
    mobileScreenshotUrl: 'https://example.test/mobile.png'
  }
};
assert.deepStrictEqual(
  plain(context.getClientSafeReportFile_({ auditScore: '' }, screenshotEvidenceReport).evidence),
  [],
  'client-safe report accepts a structured screenshot evidence object without treating it as an evidence-item array'
);
const unverifiedSnapshotEvidence = context.buildExecutiveSnapshotEvidenceHtml_({
  company: 'Rogers Holdings LLC',
  auditScore: 0,
  summary: 'Rogers Holdings LLC scored 0/100 with an audit outcome of HIGH OPPORTUNITY.',
  notes: 'Recommended service: Website conversion optimization.'
}, {});
assert.doesNotMatch(unverifiedSnapshotEvidence, /0\/100|HIGH OPPORTUNITY|scored 0/i, 'unverified Executive Snapshot evidence suppresses legacy score and severity text');
assert.match(unverifiedSnapshotEvidence, /preliminary review.*Confirm the priority findings/i, 'unverified Executive Snapshot evidence uses explicitly qualified discovery wording');
const unverifiedAssessmentBriefing = context.buildAuditExecutiveBriefingHtml_(
  {
    company: 'Rogers Holdings LLC',
    industry: 'Consulting',
    auditScore: 0,
    summary: 'Rogers Holdings LLC scored 0/100 with an audit outcome of HIGH OPPORTUNITY.'
  },
  [],
  '',
  context.getReportScoreContext_({ auditScore: 0 }, {}),
  'Confirm the buyer and business need during discovery.',
  'High',
  'Moderate'
);
assert.doesNotMatch(unverifiedAssessmentBriefing, /0\/100|HIGH OPPORTUNITY|scored 0|>High<|>Moderate</i, 'unverified assessment briefing suppresses legacy scores and impact ratings');
assert.strictEqual((unverifiedAssessmentBriefing.match(/To be confirmed/g) || []).length, 2, 'unverified assessment briefing qualifies both opportunity and impact ratings');
assert.match(unverifiedAssessmentBriefing, /professional-services context to confirm during discovery/i, 'unverified assessment briefing preserves qualified professional-services classification');
const unverifiedFinalRecommendation = context.finalRecommendationHtml_(
  { company: 'Rogers Holdings LLC', industry: 'Consulting', auditScore: 0 },
  'Confirm the buyer and business need during discovery.',
  'High',
  {}
);
assert.doesNotMatch(unverifiedFinalRecommendation, /metric-value">High</i, 'unverified final recommendation suppresses raw effort and impact ratings');
assert.strictEqual((unverifiedFinalRecommendation.match(/metric-value">To be confirmed/g) || []).length, 2, 'unverified final recommendation qualifies both summary metrics');
assert.doesNotMatch(unverifiedFinalRecommendation, /<h3>Recommended Next Step<\/h3>/i, 'final recommendation does not duplicate its outer section heading');
assert.match(unverifiedFinalRecommendation, /<h3>Decision Framework<\/h3>/i, 'final recommendation uses a distinct inner heading');
const malformedOutreach = plain(context.buildOutreachDrafts_(fixtures.malformedLiveAcceptance.prospect));
assert.doesNotMatch(malformedOutreach.initialEmail, /0\s*\/\s*100|Critical Digital Issues Detected/i, 'low-confidence outreach contains no score or severity claim');
assert.match(malformedOutreach.initialEmail, /not included a definitive score/i);
assert.match(malformedOutreach.initialEmail, /business decision-maker|organizational buyer/i, 'professional outreach uses decision-maker perspective');
assert.doesNotMatch(malformedOutreach.initialEmail, /local customer|local search|nearby customer|Google Business|No reviews detected/i, 'professional preliminary outreach excludes unsupported local findings');
assert.doesNotMatch(malformedOutreach.initialEmail, /A couple of opportunities stood out/i, 'no verified findings produces preliminary outreach without a findings list');
assert.doesNotMatch(flattenStrings(malformedLiveAcceptance.opportunities).join(' '), /phone|hours|google business|local seo|service area/i, 'unsupported local-service recommendations are excluded');

const incompleteScoreContext = plain(context.getReportScoreContext_(fixtures.malformedLiveAcceptance.prospect, fixtures.malformedLiveAcceptance.reportFile));
assert.strictEqual(incompleteScoreContext.displayScore, 'Not verified', 'incomplete raw zero has no numeric display score');
assert.strictEqual(incompleteScoreContext.scoreVerified, false);
assert.strictEqual(incompleteScoreContext.severityLabel, 'Digital Presence Review In Progress');
assert.doesNotMatch(incompleteScoreContext.severityLabel + ' ' + incompleteScoreContext.safeFallbackLanguage, /Critical Digital Issues Detected/i);

const verifiedScoreContext = plain(context.getReportScoreContext_({ auditScore: 82 }, { inspectionComplete: true, evidence: [{ id: 'V-1' }, { id: 'V-2' }] }));
assert.strictEqual(verifiedScoreContext.displayScore, '82 / 100', 'verified assessment score remains unchanged');
assert.strictEqual(verifiedScoreContext.scoreVerified, true);

const executivePdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');
const executivePdfFunction = executivePdfSource.slice(executivePdfSource.indexOf('function buildExecutiveSnapshotPdfHtml_'), executivePdfSource.indexOf('function buildExecutiveSnapshotOpportunities_'));
assert.match(executivePdfFunction, /getReportScoreContext_\(prospect, reportFile \|\| \{\}\)/, 'Executive Snapshot PDF uses authoritative score context');
assert.doesNotMatch(executivePdfFunction, /getDigitalPresenceAssessment_\(prospect\.auditScore\)/, 'Executive Snapshot PDF does not read raw score directly');

const previewSourceForScore = fs.readFileSync(path.join(root, 'DeliverablePreviewEngine.gs'), 'utf8');
const executivePreviewFunction = previewSourceForScore.slice(previewSourceForScore.indexOf('function showExecutiveSnapshotPreview_'), previewSourceForScore.indexOf('function showDigitalBusinessAssessmentPreview_'));
assert.match(executivePreviewFunction, /getReportScoreContext_\(prospect, reportFile \|\| \{\}\)/, 'Executive Snapshot preview uses authoritative score context');
assert.match(executivePreviewFunction, /scoreContext\.displayScore/, 'Executive Snapshot preview renders shared display score');
assert.doesNotMatch(executivePreviewFunction, /getDigitalPresenceAssessment_\(prospect\.auditScore\)/, 'Executive Snapshot preview does not read raw score directly');

const fixtureSmartFindings = context.getSmartFindings_;
context.getSmartFindings_ = () => [];
const malformedPlan = plain(context.buildProposal_(Object.assign({}, fixtures.malformedLiveAcceptance.prospect, { reportFile: fixtures.malformedLiveAcceptance.reportFile })));
assert.strictEqual(malformedPlan.auditScore, 'Not verified', 'Improvement Plan suppresses unsupported numeric score');
assert.doesNotMatch(malformedPlan.proposalText, /0\s*\/\s*100|Critical Digital Issues Detected/i, 'Improvement Plan suppresses unsupported score and severity');
assert.doesNotMatch(malformedPlan.proposalText, /No reviews detected|Google Business Profile link not detected|Contact visibility not verified/i, 'Improvement Plan does not personalize from incomplete inspection findings');
assert.doesNotMatch(malformedPlan.proposalText, /local customers|local visibility|local search/i, 'professional-services Improvement Plan avoids local-service language');
const malformedPlanFindingsHtml = context.proposalFindingsSummaryHtml_({
  company: 'Rogers Holdings LLC',
  industry: 'Consulting',
  auditScore: 0,
  notes: 'The business may be losing online opportunities. A few small visibility improvements could make the business easier to find in local search.'
});
assert.doesNotMatch(malformedPlanFindingsHtml, /losing online opportunities|local search/i, 'unverified Improvement Plan suppresses legacy generic findings');
assert.strictEqual((malformedPlanFindingsHtml.match(/To confirm during discovery:/g) || []).length, 3, 'unverified Improvement Plan qualifies every discovery item');
assert.match(malformedPlanFindingsHtml, /business decision-makers and organizational buyers/i, 'unverified Improvement Plan preserves professional/B2B audience language');

const localPlan = plain(context.buildProposal_({ company: 'Rapid Relief Plumbing', website: 'https://plumbing.example.test', industry: 'Plumbing', auditScore: 82, offerService: 'Website Audit' }));
assert.match(localPlan.proposalText, /local customers|local visibility|local search/i, 'supported local-service Improvement Plan preserves local language');

const nonprofitPlan = plain(context.buildProposal_({ company: 'River City Community Church', website: 'https://church.example.test', industry: 'Church or Nonprofit', auditScore: 82, offerService: 'Website Audit' }));
assert.doesNotMatch(nonprofitPlan.proposalText, /local customers|local visibility|local search|qualified inquiries/i, 'nonprofit Improvement Plan avoids commercial local-service language');
assert.match(nonprofitPlan.proposalText, /participate|support|volunteer|contribute|community/i, 'nonprofit Improvement Plan uses appropriate engagement language');

const localOutreach = plain(context.buildOutreachDrafts_({ company: 'Rapid Relief Plumbing', website: 'https://plumbing.example.test', industry: 'Plumbing', auditScore: 82, notes: 'Phone number is visible.', offerService: 'Website Audit' }));
assert.match(localOutreach.initialEmail, /local customer/i, 'local-service outreach preserves local audience language');
const nonprofitOutreach = plain(context.buildOutreachDrafts_({ company: 'River City Community Church', website: 'https://church.example.test', industry: 'Church or Nonprofit', auditScore: 82, notes: 'Service times are visible.', offerService: 'Website Audit' }));
assert.match(nonprofitOutreach.initialEmail, /participant|supporter|volunteer|member|community/i, 'nonprofit outreach preserves nonprofit audience language');
assert.doesNotMatch(nonprofitOutreach.initialEmail, /local customer|nearby customer/i);

context.getSmartFindings_ = fixtureSmartFindings;
const unchangedOutreach = plain(context.buildOutreachDrafts_(fixtures.malformedLiveAcceptance.prospect));
assert.deepStrictEqual(unchangedOutreach, malformedOutreach, 'outreach behavior remains unchanged after report score refactor');

const duplicated = run({
  prospect: fixtures.plumbing.prospect,
  evidence: fixtures.plumbing.evidence.concat([Object.assign({}, fixtures.plumbing.evidence[2], { id: 'PL-DUP' })])
});
assert.strictEqual(duplicated.opportunities.filter((item) => /emergency phone/i.test(item.title)).length, 1, 'duplicate recommendations are removed');

const results = { plumbing, roofing, logistics, nonprofit };
const projections = Object.fromEntries(Object.entries(Object.assign({}, results, { insufficient, malformedLiveAcceptance })).map(([name, result]) => [name, clientProjection(result)]));
const names = Object.keys(results);
for (let i = 0; i < names.length; i += 1) {
  for (let j = i + 1; j < names.length; j += 1) {
    const left = results[names[i]];
    const right = results[names[j]];
    assert.ok(similarity(left.narrative.executiveSummary, right.narrative.executiveSummary) < 0.72, `${names[i]} and ${names[j]} executive summaries must be materially different`);
    assert.notDeepStrictEqual(left.narrative.topPriorities, right.narrative.topPriorities, `${names[i]} and ${names[j]} recommendation sets must differ`);
  }
}

const internalTerms = /consultant review|Insufficient Evidence|clientDeliveryAllowed|requiresReview|ExecutiveBusinessIntelligenceEngine|evidenceIds/i;
Object.entries(projections).forEach(([name, projection]) => {
  const clientText = flattenStrings(projection).join(' ');
  assert.doesNotMatch(clientText, internalTerms, `${name} client projection contains no internal metadata`);
  assert.deepStrictEqual(adjacentDuplicateSentences(projection), [], `${name} contains no exact repeated sentence across adjacent report sections`);
});
assert.strictEqual(projections.insufficient.recommendations.length, 0, 'insufficient evidence produces no personalized recommendations');

const allSummaries = Object.values(results).map((result) => result.narrative.executiveSummary);
assert.ok(new Set(allSummaries).size > 1, 'executive summaries are not identical across all fixtures');

const pdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');
const previewSource = fs.readFileSync(path.join(root, 'DeliverablePreviewEngine.gs'), 'utf8');
const proposalPdfFunction = pdfSource.slice(pdfSource.indexOf('function buildProposalPdfBlob_'), pdfSource.indexOf('function buildExecutiveSnapshotPdfBlob_'));
const improvementPreviewFunction = previewSource.slice(previewSource.indexOf('function showImprovementPlanPreview_'), previewSource.indexOf('function showOutreachEmailPreview_'));
assert.doesNotMatch(proposalPdfFunction, /getExecutiveBusinessIntelligenceForReport_|executiveBusinessIntelligence/i, 'Improvement Plan PDF remains on the approved legacy path');
assert.doesNotMatch(improvementPreviewFunction, /getExecutiveBusinessIntelligenceForReport_|executiveBusinessIntelligence/i, 'Improvement Plan preview remains on the approved legacy path');

assert.strictEqual(context.executiveBusinessGenericRecommendation_('Improve your website.'), true, 'generic recommendation detector rejects filler');
assert.strictEqual(context.executiveBusinessGenericRecommendation_('Place verified roofing project proof beside the estimate request.'), false, 'specific actions are allowed');

console.log('Executive Business Intelligence tests passed for 7 fixtures.');
console.log(JSON.stringify({
  plumbing: plumbing.narrative.executiveSummary,
  roofing: roofing.narrative.executiveSummary,
  logistics: logistics.narrative.executiveSummary,
  nonprofit: nonprofit.narrative.executiveSummary,
  insufficientStatus: insufficient.review.status
}, null, 2));

if (process.argv.includes('--write-acceptance')) {
  fs.mkdirSync(path.dirname(acceptanceOutput), { recursive: true });
  fs.writeFileSync(acceptanceOutput, buildAcceptanceArtifact(Object.assign({}, results, { insufficient, malformedLiveAcceptance }), projections));
  console.log(`Acceptance comparison written to ${path.relative(root, acceptanceOutput)}.`);
}
