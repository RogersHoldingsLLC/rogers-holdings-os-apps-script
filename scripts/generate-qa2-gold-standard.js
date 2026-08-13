#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-output', process.env.GOLD_STANDARD_OUTPUT || 'qa2-final-gold-standard');
const renderDir = path.join(out, 'rendered-pages');
fs.mkdirSync(renderDir, { recursive: true });

const context = vm.createContext({
  console,
  Object,
  Utilities: { formatDate: () => 'August 12, 2026' },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  normalizeClientProspect_: value => value || {},
  getClientSafeReportFile_: (_prospect, report) => report || {},
  getAuditEvidenceObject_: (_prospect, report) => (report && report.evidence) || {},
  getAuditReportTextFromReportFile_: report => String((report && report.text) || ''),
  filterClientEligibleEvidence_: values => values.filter(Boolean),
  getSmartFindings_: prospect => prospect.smartFindings || [],
  getRogersContactInfo_: () => ({ company: 'Rogers Holdings LLC', email: 'brian@rogersholdingsllc.com' }),
  escapeHtml_: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
});
vm.runInContext(fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8'), context, { filename: 'GoldStandardDeliverables.gs' });

const evidence = [
  { key: 'desktop', label: 'Desktop homepage', detail: 'Homepage, service navigation, contact path, and visible credentials were directly reviewed.', state: 'Actionable' },
  { key: 'mobile', label: 'Mobile homepage', detail: 'Mobile hierarchy, contact path, and service categories were directly reviewed.', state: 'Actionable' },
  { key: 'operations', label: 'Operational response performance', detail: 'Back-office response time and lead quality were not observable.', state: 'Not Verified' }
];
const findings = [
  { key: 'contact-action', category: 'Contact Action', state: 'Actionable', observation: 'The primary request-service action is not consistently prominent across key entry points.', businessImpact: 'Ready-to-act visitors may hesitate or continue comparing instead of contacting Harbor Light.', recommendation: 'Use one prominent request-service action in the header, hero, and high-intent service sections.', priority: 'Priority Improvement - address first because it directly supports inquiry conversion.', evidenceKeys: ['desktop', 'mobile'] },
  { key: 'service-boundary', category: 'Service Boundary', state: 'Actionable', observation: 'Residential and commercial capability boundaries are present but not quickly scannable.', businessImpact: 'Visitors may be uncertain whether Harbor Light handles their specific property or project type.', recommendation: 'Add concise residential and commercial scope statements and route each audience to relevant services.', priority: 'Priority Improvement - sequence after the primary conversion correction.', evidenceKeys: ['desktop', 'mobile'] },
  { key: 'credentials', category: 'License and Safety Credentials', state: 'Verified Strength', observation: 'License and safety credentials are visibly presented.', businessValue: 'These signals reduce perceived risk for customers selecting an electrical contractor.', maintain: 'Keep licensing and safety credentials visible near service claims and the customer contact path.', priority: 'Verified Strength', evidenceKeys: ['desktop', 'mobile'] },
  { key: 'response-time', category: 'Response-Time Performance', state: 'Not Verified', evidenceGap: 'The public website does not establish actual inquiry-response time or scheduling availability.', whyVerificationMatters: 'Response expectations affect customer confidence and operational follow-through.', verificationNeeded: 'Confirm current response-time standards and whether a public expectation can be supported operationally.', priority: 'Not Verified', evidenceKeys: ['operations'] }
];
const reviewedInput = {
  company: 'Harbor Light Electrical LLC',
  website: 'https://harborlightelectrical.example',
  preparedDate: 'August 12, 2026',
  opening: 'Harbor Light presents a credible electrical-services foundation. The clearest opportunity is making the contact path unmistakable for customers who are ready to request help.',
  evidence,
  findings,
  limitations: ['Back-office response times and lead quality were not verified.'],
  recommendations: [
    { key: 'request-action', findingKey: 'contact-action', title: 'Standardize the request-service action', change: 'Use one prominent action across the highest-intent pages.', why: 'It removes uncertainty at the moment a visitor is ready to contact the business.', dependency: 'Confirm the destination workflow and owner before publishing.' },
    { key: 'scope', findingKey: 'service-boundary', title: 'Clarify residential and commercial scope', change: 'Add concise audience-specific scope language.', why: 'Visitors can determine fit faster.', dependency: 'Confirm approved service boundaries and exclusions.' },
    { key: 'preserve-trust', findingKey: 'credentials', title: 'Preserve visible credibility signals', change: 'Keep credentials visible near the customer path.', why: 'Existing trust proof reduces perceived risk.', dependency: 'Priority improvements must not displace verified credentials.' }
  ],
  actions: [
    { key: 'action-request', recommendationKey: 'request-action', sequence: 1, title: 'Standardize request-service action', outcome: 'Visitors immediately know how to request help.', implementationPath: 'Owner or approved implementation support updates the shared header, hero, and service templates.', dependency: 'Approved phone or form destination.', completionTest: 'Action is visible and functional on desktop and mobile.' },
    { key: 'action-scope', recommendationKey: 'scope', sequence: 2, title: 'Clarify service boundaries', outcome: 'Residential and commercial visitors identify fit quickly.', implementationPath: 'Owner or approved implementation support publishes approved scope summaries and routes.', dependency: 'Owner-approved inclusions and exclusions.', completionTest: 'Each audience reaches relevant services in one step.' },
    { key: 'action-qa', recommendationKey: 'preserve-trust', sequence: 3, title: 'Validate trust and flow', outcome: 'Improved clarity without loss of credibility.', implementationPath: 'Owner or approved implementation support completes cross-device quality assurance for owner review.', dependency: 'Priority improvements are published in test.', completionTest: 'No broken routes and credentials remain prominent.' }
  ],
  primaryConclusion: 'Make the contact path unmistakable',
  primaryConclusionDetail: 'The strongest near-term improvement is a consistent request-service action across the homepage and service content. This is a verified conversion concern and the first recommended correction.',
  businessImplication: 'Customers seeking electrical help often arrive with immediate intent. A visible next step reduces hesitation and makes qualified contact easier.',
  firstStep: 'Place one prominent Request Electrical Service action in the header and key service sections.',
  preserveWhatWorks: 'Keep licensing and safety credentials visible near service claims and the customer contact path.',
  nextStep: 'Review the Digital Business Assessment, then confirm the primary customer action and service-boundary language in one focused working session.',
  decisions: ['Which request channel should be primary?', 'Which residential and commercial services are in scope?', 'Who owns inquiry follow-up?']
};
const input = context.buildGoldStandardDeliverableInput_({ company: reviewedInput.company, website: reviewedInput.website }, {}, { reviewedInput });
const docs = [
  ['Executive Brief', context.buildGoldStandardExecutiveBriefHtml_(input)],
  ['Digital Business Assessment', context.buildGoldStandardAssessmentHtml_(input)],
  ['Improvement Plan', context.buildGoldStandardImprovementPlanHtml_(input)]
];
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const [name, html] of docs) {
  const htmlPath = path.join(out, `${name}.html`);
  const pdfPath = path.join(out, `${name}.pdf`);
  fs.writeFileSync(htmlPath, html);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`], { stdio: 'ignore' });
  const count = Number(execFileSync('swift', [path.join(root, 'scripts/render-pdf-pages.swift'), pdfPath, path.join(renderDir, name.replaceAll(' ', '-')), path.join(out, `${name}.txt`)]).toString().trim());
  fs.writeFileSync(path.join(out, `${name}.pages`), String(count));
}
fs.writeFileSync(path.join(out, 'authoritative-input.json'), JSON.stringify(input, null, 2));
fs.writeFileSync(path.join(out, 'ACCEPTANCE_EVIDENCE.md'), '# Authoritative Gold Standard Reference\n\nFixture: Harbor Light Electrical LLC\n\nEntrypoint: buildGoldStandardDeliverableInput_ plus authoritative HTML renderers in GoldStandardDeliverables.gs.\n\nExpected page counts: 1 / 6 / 4.\n');
console.log(out);
