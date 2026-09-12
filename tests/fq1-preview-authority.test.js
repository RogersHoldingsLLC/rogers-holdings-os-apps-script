const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const goldSource = fs.readFileSync(path.join(root, 'GoldStandardDeliverables.gs'), 'utf8');
const previewSource = fs.readFileSync(path.join(root, 'DeliverablePreviewEngine.gs'), 'utf8');
const auditSource = fs.readFileSync(path.join(root, 'AuditEngine.gs'), 'utf8');
const pdfSource = fs.readFileSync(path.join(root, 'PdfEngine.gs'), 'utf8');

function approvedRendererInput() {
  return {
    packagePreparedAt: '2026-08-14T02:11:31.325Z',
    company: 'FQ-1 Fixture Electrical LLC',
    website: 'https://fixture-web-gbp.example/request',
    businessContext: { version: '1', primaryService: 'Residential electrical repair', targetCustomer: 'Homeowners needing scheduled electrical work', serviceArea: 'Acceptance County', desiredCustomerAction: 'Submit a service request', primaryBusinessObjective: 'Increase qualified service inquiries', relevantConversionDestination: 'https://fixture-web-gbp.example/request', knownConstraints: 'No emergency-service claim', industryContext: 'Local service' },
    businessContextVersion: '1',
    presenceInventoryVersion: '1',
    presence: [
      { channelType: 'Website', channelName: 'Website', presenceState: 'Verified Present', applicability: 'Applicable', roleInCustomerJourney: 'Service evaluation and inquiry', limitations: [] },
      { channelType: 'Google Business Profile', channelName: 'Google Business Profile', presenceState: 'Verified Present', applicability: 'Applicable', roleInCustomerJourney: 'Local discovery and identity verification', limitations: ['Basic presence only; no deep GBP audit.'] }
    ],
    evidence: [{
      key: 'EVID-WEB-1',
      label: 'Element Inspection — Services page primary navigation',
      detail: 'No request-service link in primary navigation',
      state: 'Actionable', sourceType: 'Element Inspection', sourceUrl: 'https://fixture-web-gbp.example/services', pageTitle: 'Services', pagePath: '/services', elementType: 'Primary navigation', elementLabel: 'Services page navigation', evidenceLocation: 'Services page primary navigation', capturedAt: '2026-08-13T18:00:00Z', captureMethod: 'Element inspection', desktopMobileContext: 'Desktop and mobile', evidenceExcerpt: 'Services and About are present; no contact or request-service destination is shown.', testPerformed: 'Non-submitting navigation review', testResult: 'No direct route to inquiry form', confidence: 0.95, limitations: ['Form submission not tested.']
    }],
    findings: [{
      key: 'FND-VALID-1',
      category: 'Primary service navigation lacks a request-service path',
      state: 'Actionable',
      channelType: 'Website', customerJourneyStage: 'Service evaluation', businessObjective: 'Increase qualified service inquiries', evidenceSource: 'Element Inspection', evidenceLocation: 'Services page primary navigation', evidenceExcerpt: 'No request-service destination is shown.',
      observation: 'The Services page primary navigation has no button or link leading to the request-service form.',
      expectedCondition: 'A high-intent visitor can reach the approved request-service destination from the Services page navigation.',
      businessImpact: 'A visitor evaluating a service must leave the Services page path and search for a way to request help.',
      consequenceBasis: 'The reviewed navigation path contains no direct route from service evaluation to the inquiry action.',
      recommendation: 'Add a Request Service link targeting the approved inquiry form to the Services page primary navigation.',
      implementationLocation: 'Services page primary navigation template', intendedOutcome: 'Visitors can move from service evaluation to inquiry without searching.', completionTest: 'Verify on desktop and mobile that the Services page Request Service link reaches the working inquiry form in one click.', evidenceConfidence: 0.95,
      priority: 'Priority Improvement',
      evidenceKeys: ['EVID-WEB-1'],
      limitations: ['Form submission not tested.']
    }],
    recommendations: [{
      key: 'REC-VALID-1', findingKey: 'FND-VALID-1',
      title: 'Primary service navigation lacks a request-service path',
      change: 'Add a Request Service link targeting the approved inquiry form to the Services page primary navigation.',
      why: 'Visitors can move from service evaluation to inquiry without searching.',
      dependency: 'Form submission not tested'
    }],
    actions: [{
      key: 'ACT-REC-VALID-1', recommendationKey: 'REC-VALID-1', sequence: 1,
      title: 'Primary service navigation lacks a request-service path',
      outcome: 'Visitors can move from service evaluation to inquiry without searching.',
      implementationPath: 'Add the approved link at the Services page primary navigation template.',
      dependency: 'Form submission not tested',
      completionTest: 'Verify on desktop and mobile that the Services page Request Service link reaches the working inquiry form in one click.'
    }],
    limitations: [],
    primaryConclusion: 'Primary service navigation lacks a request-service path',
    primaryConclusionDetail: 'The Services page primary navigation has no button or link leading to the request-service form.',
    businessImplication: 'A visitor evaluating a service must leave the Services page path and search for a way to request help.',
    firstStep: 'Add a Request Service link targeting the approved inquiry form to the Services page primary navigation.'
  };
}

function load() {
  let modal;
  const context = vm.createContext({
    Object, Array, Date, JSON, Math, Number, String, RegExp, Set, encodeURIComponent,
    Utilities: { formatDate: (date, timeZone, pattern) => pattern === 'yyyy-MM-dd'
      ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
      : new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', day: 'numeric', year: 'numeric' }).format(date) },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    normalizeClientProspect_: value => value || {},
    normalizeClientBusinessName_: value => String(value || ''),
    getClientSafeReportFile_: (_prospect, report) => report || {},
    getRogersContactInfo_: () => ({ company: 'Rogers Holdings LLC', email: 'owner@example.test' }),
    formatDisplayDate_: () => '2026-08-16',
    escapeHtml_: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    HtmlService: {
      createHtmlOutput: html => ({ html, setWidth() { return this; }, setHeight() { return this; } })
    },
    SpreadsheetApp: {
      getUi: () => ({ showModalDialog: output => { modal = output.html; } })
    }
  });
  vm.runInContext(goldSource, context, { filename: 'GoldStandardDeliverables.gs' });
  vm.runInContext(previewSource, context, { filename: 'DeliverablePreviewEngine.gs' });
  context.loadApprovedFindingSetForGeneration_ = () => ({
    reference: { findingSetId: 'FSET-WEBGBP-1', version: '1', fingerprint: 'approved-fixture-hash', approvalStatus: 'Approved for Client' },
    reviewedInput: approvedRendererInput()
  });
  return { context, getModal: () => modal };
}

test('one approved snapshot produces equivalent semantics for all preview/PDF plans', () => {
  const { context, getModal } = load();
  const plans = ['executiveBrief', 'assessment', 'improvementPlan'].map(type => context.buildGoldStandardDocumentPlan_(type, {}, {}));
  for (const plan of plans) {
    assert.deepEqual(Array.from(plan.semantics.findingIds), ['FND-VALID-1']);
    assert.deepEqual(Array.from(plan.semantics.evidenceReferences), ['EVID-WEB-1']);
    assert.deepEqual(Array.from(plan.semantics.recommendationIds), ['REC-VALID-1']);
    assert.deepEqual(Array.from(plan.semantics.completionTests), [approvedRendererInput().actions[0].completionTest]);
    assert.equal(plan.approvedFindingSetReference.findingSetId, 'FSET-WEBGBP-1');
  }
  assert.equal(JSON.stringify(plans[0].semantics), JSON.stringify(plans[1].semantics));
  assert.equal(JSON.stringify(plans[1].semantics), JSON.stringify(plans[2].semantics));
  assert.deepEqual(plans.map(plan => plan.input.preparedDate), ['August 13, 2026', 'August 13, 2026', 'August 13, 2026']);
  assert.deepEqual(plans.map(plan => plan.input.preparedDateIso), ['2026-08-13', '2026-08-13', '2026-08-13']);
  const retries = ['executiveBrief', 'assessment', 'improvementPlan'].map(type => context.buildGoldStandardDocumentPlan_(type, {}, {}));
  assert.deepEqual(retries.map(plan => plan.input.preparedDate), plans.map(plan => plan.input.preparedDate));
  assert.deepEqual(retries.map(plan => plan.input.preparedDateIso), plans.map(plan => plan.input.preparedDateIso));
  const previewFunctions = ['showExecutiveSnapshotPreview_', 'showDigitalBusinessAssessmentPreview_', 'showImprovementPlanPreview_'];
  plans.forEach(function(plan, index) {
    assert.match(plan.pdfHtml, /August 13, 2026/);
    context[previewFunctions[index]]({}, plan);
    const preview = getModal();
    assert.match(preview, /2026-08-13/);
    assert.match(preview, /Prepared:<\/b> August 13, 2026/);
    assert.doesNotMatch(preview, /2026-08-16/);
  });
  retries.forEach(plan => assert.match(plan.pdfHtml, /August 13, 2026/));
});

test('Executive Brief preview and PDF render one complete Checked row per approved evidence URL', () => {
  const { context, getModal } = load();
  const fixture = approvedRendererInput();
  fixture.evidence = [
    Object.assign({}, fixture.evidence[0], { key: 'EVID-HOME', label: 'Website — https://rogersholdingsllc.com/', evidenceLocation: 'https://rogersholdingsllc.com/' }),
    Object.assign({}, fixture.evidence[0], { key: 'EVID-FORM', label: 'Business Snapshot — https://rogersholdingsllc.com/business-snapshot/', evidenceLocation: 'https://rogersholdingsllc.com/business-snapshot/' })
  ];
  fixture.findings[0].evidenceKeys = ['EVID-HOME', 'EVID-FORM'];
  context.loadApprovedFindingSetForGeneration_ = () => ({
    reference: { findingSetId: 'FSET-REAL-1', version: '1', fingerprint: 'approved-real-hash', approvalStatus: 'Approved for Client' },
    reviewedInput: fixture
  });
  const plan = context.buildGoldStandardDocumentPlan_('executiveBrief', {}, {});
  context.showExecutiveSnapshotPreview_({}, plan);
  const preview = getModal();
  const pdfWhere = plan.pdfHtml.slice(plan.pdfHtml.toLowerCase().indexOf('where we looked'), plan.pdfHtml.toLowerCase().indexOf('what we did not test'));
  const previewWhere = preview.slice(preview.indexOf('Where We Looked'), preview.indexOf('What We Did Not Test'));
  assert.equal((pdfWhere.match(/&#10003; Checked/g) || []).length, 2);
  assert.equal((previewWhere.match(/&#10003; Checked/g) || []).length, 2);
  for (const url of ['https://rogersholdingsllc.com/', 'https://rogersholdingsllc.com/business-snapshot/']) {
    assert.match(pdfWhere, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(previewWhere, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('legacy immutable snapshots preserve semicolons inside one approved limitation', () => {
  const { context, getModal } = load();
  const fixture = approvedRendererInput();
  const approvedLimitation = 'Public pages verified reachable and ownership confirmed. The secure submission endpoint is not connected; the Business Snapshot form prepares an email for the customer to review and send. No submission was performed.';
  const legacySnapshotFragments = [
    'Public pages verified reachable and ownership confirmed. The secure submission endpoint is not connected',
    'the Business Snapshot form prepares an email for the customer to review and send. No submission was performed.'
  ];
  fixture.limitations = legacySnapshotFragments.slice();
  fixture.findings[0].limitations = legacySnapshotFragments.slice();
  fixture.evidence[0].limitations = legacySnapshotFragments.slice();
  context.loadApprovedFindingSetForGeneration_ = () => ({
    reference: { findingSetId: 'FSET-REAL-1', version: '1', fingerprint: 'unchanged-immutable-snapshot', approvalStatus: 'Approved for Client' },
    reviewedInput: fixture
  });

  for (const [type, previewFunction] of [
    ['executiveBrief', 'showExecutiveSnapshotPreview_'],
    ['assessment', 'showDigitalBusinessAssessmentPreview_'],
    ['improvementPlan', 'showImprovementPlanPreview_']
  ]) {
    const plan = context.buildGoldStandardDocumentPlan_(type, {}, {});
    assert.deepEqual(Array.from(plan.input.limitations), [approvedLimitation]);
    assert.match(plan.pdfHtml, new RegExp(approvedLimitation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    context[previewFunction]({}, plan);
    assert.match(getModal(), new RegExp(approvedLimitation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(plan.approvedFindingSetReference.fingerprint, 'unchanged-immutable-snapshot');
  }
});

test('limitation normalization preserves exact punctuation and genuine independent items', () => {
  const { context } = load();
  const exact = 'The endpoint is not connected; the form prepares an email.';
  assert.deepEqual(Array.from(context.normalizeGoldStandardLimitationList_([exact])), [exact]);
  assert.deepEqual(Array.from(context.normalizeGoldStandardLimitationList_([
    'Form submission was not tested.',
    'Hosting access was not reviewed.'
  ])), ['Form submission was not tested.', 'Hosting access was not reviewed.']);
  assert.deepEqual(Array.from(context.normalizeGoldStandardLimitationList_([
    'The endpoint is not connected',
    'the form prepares an email.'
  ])), [exact]);
});

test('snapshot approvedAt controls numeric and written package dates across the prior New York calendar day', () => {
  const { context, getModal } = load();
  const v1 = approvedRendererInput();
  const v2 = Object.assign({}, approvedRendererInput(), { packagePreparedAt: '2026-08-16T02:59:38.341Z' });
  context.loadApprovedFindingSetForGeneration_ = function(_prospect, options) {
    const historical = options && options.authorityVersion === '1';
    return {
      reference: { findingSetId: 'FSET-WEBGBP-1', version: historical ? '1' : '2', fingerprint: historical ? 'approved-v1' : 'approved-v2', approvalStatus: 'Approved for Client' },
      reviewedInput: historical ? v1 : v2
    };
  };
  const previewFunctions = ['showExecutiveSnapshotPreview_', 'showDigitalBusinessAssessmentPreview_', 'showImprovementPlanPreview_'];
  const v2Plans = ['executiveBrief', 'assessment', 'improvementPlan'].map(type => context.buildGoldStandardDocumentPlan_(type, {}, {}, { authorityVersion: '2' }));
  v2Plans.forEach(function(plan, index) {
    assert.equal(plan.input.preparedDateIso, '2026-08-15');
    assert.equal(plan.input.preparedDate, 'August 15, 2026');
    assert.match(plan.pdfHtml, /August 15, 2026/);
    context[previewFunctions[index]]({}, plan);
    const preview = getModal();
    assert.match(preview, /2026-08-15/);
    assert.match(preview, /Prepared:<\/b> August 15, 2026/);
    assert.doesNotMatch(preview, /2026-08-16/);
  });
  const laterRetries = ['executiveBrief', 'assessment', 'improvementPlan'].map(type => context.buildGoldStandardDocumentPlan_(type, {}, {}, { authorityVersion: '2', retryAt: '2026-09-30T23:59:59Z' }));
  assert.deepEqual(laterRetries.map(plan => plan.input.preparedDateIso), ['2026-08-15', '2026-08-15', '2026-08-15']);
  assert.deepEqual(laterRetries.map(plan => plan.input.preparedDate), ['August 15, 2026', 'August 15, 2026', 'August 15, 2026']);
  const historicalV1 = context.buildGoldStandardDocumentPlan_('assessment', {}, {}, { authorityVersion: '1' });
  assert.equal(historicalV1.approvedFindingSetReference.version, '1');
  assert.equal(historicalV1.input.preparedDateIso, '2026-08-13');
  assert.equal(historicalV1.input.preparedDate, 'August 13, 2026');
});

test('one-finding Assessment is diagnostic, evidence-adaptive, and non-repetitive', () => {
  const { context, getModal } = load();
  const plan = context.buildGoldStandardDocumentPlan_('assessment', {}, {});
  context.showDigitalBusinessAssessmentPreview_({}, plan);
  const preview = getModal();
  const html = plan.pdfHtml;
  const approved = approvedRendererInput();
  const finding = approved.findings[0];
  const recommendation = approved.recommendations[0].change;
  const completionTest = approved.actions[0].completionTest;

  assert.equal(plan.content.findings.length, 1);
  assert.equal((html.match(new RegExp(recommendation, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(finding.observation, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(completionTest, 'g')) || []).length, 1);
  assert.match(html, /What We Checked/);
  assert.match(html, /Increase qualified service inquiries/);
  assert.match(html, /Where We Looked/);
  assert.match(html, /Google Business Profile/);
  assert.match(html, /How We Checked/);
  assert.match(html, /Test record:<\/b> Element inspection/);
  assert.match(html, /What should happen/i);
  assert.match(html, /Form submission not tested/);
  assert.match(html, /No direct route to inquiry form/);
  assert.match(preview, /No direct route to inquiry form/);
  assert.doesNotMatch(preview + html, /Services and About are present|no contact or request-service destination is shown/i);
  assert.doesNotMatch(html, />Executive Conclusion<|>Approved Recommendations<|>Phased Roadmap<|Digital Presence Score|Top Opportunities/i);
  assert.equal((html.match(/class="page /g) || []).length, 3);

  for (const value of [finding.observation, finding.expectedCondition, finding.businessImpact, finding.consequenceBasis, recommendation, completionTest, 'Basic presence only; no deep GBP audit.']) {
    const pattern = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    assert.match(preview, pattern);
    assert.match(html, pattern);
  }
});

test('Assessment expands by approved findings and treats channel states without fabrication', () => {
  const { context } = load();
  const fixture = approvedRendererInput();
  fixture.presence.push({ channelType: 'Instagram', channelName: 'Instagram', presenceState: 'Not Verified', applicability: 'Needs Verification', roleInCustomerJourney: 'Potential discovery', limitations: ['Exact owned profile not verified.'] });
  fixture.presence.push({ channelType: 'Marketplace / directory', channelName: 'Marketplace', presenceState: 'Not Applicable', applicability: 'Not Applicable', roleInCustomerJourney: '', limitations: [] });
  for (let index = 2; index <= 3; index += 1) {
    const findingKey = `FND-${index}`;
    const recommendationKey = `REC-${index}`;
    fixture.findings.push(Object.assign({}, fixture.findings[0], { key: findingKey, category: `Approved diagnostic ${index}`, observation: `Specific observed condition ${index} at the reviewed location.`, expectedCondition: `Specific expected condition ${index} at the reviewed location.`, businessImpact: `Specific supported consequence ${index} in the approved customer journey.`, consequenceBasis: `Evidence ${index} connects the condition to the approved journey.`, recommendation: `Update the approved element ${index} at the reviewed location.`, implementationLocation: `Approved location ${index}`, completionTest: `Verify approved condition ${index} passes on desktop and mobile.`, evidenceKeys: ['EVID-WEB-1'] }));
    fixture.recommendations.push({ key: recommendationKey, findingKey, title: `Approved diagnostic ${index}`, change: `Update the approved element ${index} at the reviewed location.`, why: `Specific supported consequence ${index} in the approved customer journey.`, dependency: `Approved dependency ${index}.` });
    fixture.actions.push({ key: `ACT-${index}`, recommendationKey, sequence: index, title: `Approved diagnostic ${index}`, outcome: `Approved outcome ${index}.`, implementationPath: `Update approved location ${index}.`, dependency: `Approved dependency ${index}.`, completionTest: `Verify approved condition ${index} passes on desktop and mobile.` });
  }
  context.loadApprovedFindingSetForGeneration_ = () => ({ reference: { findingSetId: 'FSET-WEBGBP-1', version: '1', fingerprint: 'approved-fixture-hash', approvalStatus: 'Approved for Client' }, reviewedInput: fixture });
  const plan = context.buildGoldStandardDocumentPlan_('assessment', {}, {});
  assert.equal(plan.content.findings.length, 3);
  assert.equal((plan.pdfHtml.match(/class="page /g) || []).length, 5);
  assert.match(plan.pdfHtml, /Not checked/);
  assert.match(plan.pdfHtml, /Not needed here/);
  assert.doesNotMatch(plan.pdfHtml, /Instagram deficiency|Marketplace deficiency|Phased Roadmap/i);
});

test('FQ-1 previews contain only approved Services-page analysis and no legacy generic content', () => {
  const { context, getModal } = load();
  const forbidden = [
    'Digital Presence Score',
    'Clarify the offer and intended audience',
    'Strengthen credible proof at key decision points',
    'Make the inquiry or engagement path easy to understand',
    'find, trust, and contact the business more easily'
  ];
  const calls = [
    ['executiveBrief', 'showExecutiveSnapshotPreview_'],
    ['assessment', 'showDigitalBusinessAssessmentPreview_'],
    ['improvementPlan', 'showImprovementPlanPreview_']
  ];
  for (const [type, fn] of calls) {
    const plan = context.buildGoldStandardDocumentPlan_(type, {}, {});
    context[fn]({}, plan);
    const html = getModal();
    assert.match(html, /Prepared:<\/b> August 13, 2026/);
    assert.match(html, /Primary service navigation lacks a request-service path/);
    if (type !== 'improvementPlan') assert.match(html, /Services page primary navigation has no button or link/);
    assert.match(html, /Add a Request Service link targeting the approved inquiry form/);
    if (type !== 'assessment') assert.match(html, /working inquiry form in one click/);
    for (const phrase of forbidden) assert.doesNotMatch(html, new RegExp(phrase, 'i'));
  }
});

test('one-action Improvement Plan is execution-only, non-repetitive, and preview/PDF equivalent', () => {
  const { context, getModal } = load();
  const plan = context.buildGoldStandardDocumentPlan_('improvementPlan', {}, {});
  context.showImprovementPlanPreview_({}, plan);
  const preview = getModal();
  const pdf = plan.pdfHtml;
  const approved = approvedRendererInput();
  const finding = approved.findings[0];
  const recommendation = approved.recommendations[0].change;
  const action = approved.actions[0];
  const required = [
    'These steps show what to change, who will do it, and how to check the work.',
    recommendation, finding.implementationLocation, action.outcome, action.implementationPath, action.completionTest,
    'Add a Request Service link to the Services page menu. Test it on a phone and a computer. The link should open the request form in one click.',
    'Confirmed web address for the request form', 'Access to the Services page primary navigation template', 'A person chosen to make the change',
    'Confirm the request form web address. Choose who will make the change.',
    'Add the Request Service link to the Services page menu.',
    'Test the link on a phone and a computer. It should open the form in one click.',
    'Write down the test result. Then close the task.',
    'Choose who will make the change. Confirm the request form web address. Then approve the menu update.',
    'FQ-1 Fixture Electrical LLC chooses who will make the change. Outside help needs separate approval.',
    'Form submission not tested'
  ];

  assert.equal(plan.content.actions.length, 1);
  assert.equal((pdf.match(/class="page /g) || []).length, 2);
  for (const value of required) {
    const pattern = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    assert.match(preview, pattern);
    assert.match(pdf, pattern);
  }
  assert.equal((preview.match(/Form submission not tested/g) || []).length, 1);
  assert.equal((pdf.match(/Form submission not tested/g) || []).length, 1);
  assert.match(preview, /What we need first:[\s\S]*What we did not test:/i);
  assert.match(pdf, /What we need first[\s\S]*What we did not test/i);
  assert.doesNotMatch(preview + pdf, /\.\s*;/);
  assert.deepEqual(Array.from(plan.content.actions[0].dependencies), ['Confirmed web address for the request form', 'Access to the Services page primary navigation template', 'A person chosen to make the change']);
  assert.equal((preview.match(new RegExp(recommendation, 'g')) || []).length, 1);
  assert.equal((pdf.match(new RegExp(recommendation, 'g')) || []).length, 1);
  assert.doesNotMatch(preview + pdf, /Priorities &amp; Strategy|Approved Recommendations|Observation:|Business consequence:|Why it matters:/i);
  assert.doesNotMatch(preview + pdf, /pricing|payment terms|signature|presumed engagement/i);
  assert.doesNotMatch(preview + pdf, /Complete the approved correction|documented decisions|authorize Action 01/i);
  assert.doesNotMatch(preview + pdf, /execution plan|approved correction|ownership|dependencies|verification/i);
});

test('multi-action Improvement Plan preserves approved sequence deterministically', () => {
  const { context } = load();
  const fixture = approvedRendererInput();
  for (let index = 2; index <= 3; index += 1) {
    const findingKey = `FND-PLAN-${index}`;
    const recommendationKey = `REC-PLAN-${index}`;
    fixture.findings.push(Object.assign({}, fixture.findings[0], { key: findingKey, category: `Execution action ${index}`, recommendation: `Update approved target ${index} at location ${index}.`, implementationLocation: `Approved location ${index}`, completionTest: `Verify action ${index} passes its approved test.`, limitations: [`Constraint ${index}`] }));
    fixture.recommendations.push({ key: recommendationKey, findingKey, title: `Execution action ${index}`, change: `Update approved target ${index} at location ${index}.`, why: `Approved outcome ${index}.`, dependency: `Constraint ${index}` });
    fixture.actions.push({ key: `ACT-PLAN-${index}`, recommendationKey, sequence: index, title: `Execution action ${index}`, outcome: `Approved outcome ${index}.`, implementationPath: `Owner updates approved target ${index} at location ${index}.`, dependency: `Constraint ${index}`, completionTest: `Verify action ${index} passes its approved test.` });
  }
  context.loadApprovedFindingSetForGeneration_ = () => ({ reference: { findingSetId: 'FSET-WEBGBP-1', version: '1', fingerprint: 'approved-fixture-hash', approvalStatus: 'Approved for Client' }, reviewedInput: fixture });
  const plan = context.buildGoldStandardDocumentPlan_('improvementPlan', {}, {});
  assert.deepEqual(Array.from(plan.content.actions.map(item => item.sequence)), [1, 2, 3]);
  assert.equal((plan.pdfHtml.match(/class="page /g) || []).length, 4);
  assert.ok(plan.pdfHtml.indexOf('Execution action 2') < plan.pdfHtml.indexOf('Execution action 3'));
  for (let index = 2; index <= 3; index += 1) assert.equal((plan.pdfHtml.match(new RegExp(`Constraint ${index}`, 'g')) || []).length, 1);
});

test('one-finding Executive Brief communicates every approved element once', () => {
  const { context, getModal } = load();
  const plan = context.buildGoldStandardDocumentPlan_('executiveBrief', {}, {});
  const html = plan.pdfHtml;
  context.showExecutiveSnapshotPreview_({}, plan);
  const preview = getModal();
  const approved = approvedRendererInput();
  const finding = approved.findings[0];
  const recommendation = approved.recommendations[0].change;
  const completionTest = approved.actions[0].completionTest;

  assert.equal((html.match(new RegExp(finding.category, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(finding.observation, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(recommendation, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(completionTest, 'g')) || []).length, 1);
  assert.match(html, /Form submission not tested/);
  assert.match(html, /Where we looked[\s\S]*Services page primary navigation/i);
  assert.doesNotMatch(html, /Digital Presence Score|Top Opportunities|What Stood Out|Primary Priority|Recommended First Step/i);

  for (const value of [finding.category, finding.observation, finding.businessImpact, recommendation, completionTest, 'Form submission not tested']) {
    assert.match(preview, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Executive Brief uses approved ordering for two and three-plus findings without fabricating detail', () => {
  const { context } = load();
  for (const total of [2, 4]) {
    const fixture = approvedRendererInput();
    for (let index = 2; index <= total; index += 1) {
      const key = `FND-APPROVED-${index}`;
      const rec = `REC-APPROVED-${index}`;
      fixture.findings.push({ key, category: `Approved priority ${index}`, state: 'Actionable', observation: `Observed condition ${index} at the approved location.`, expectedCondition: `Approved expected condition ${index} at the reviewed location.`, businessImpact: `Approved consequence ${index} for the customer journey.`, consequenceBasis: `Reviewed evidence ${index} supports the approved journey conclusion.`, recommendation: `Update approved target ${index} at location ${index}.`, completionTest: `Verify target ${index} passes the approved check.`, priority: 'Priority Improvement', evidenceKeys: ['EVID-WEB-1'] });
      fixture.recommendations.push({ key: rec, findingKey: key, title: `Approved priority ${index}`, change: `Update approved target ${index} at location ${index}.`, why: `Approved consequence ${index} for the customer journey.`, dependency: `Approved dependency ${index}.` });
      fixture.actions.push({ key: `ACT-${index}`, recommendationKey: rec, sequence: index, title: `Approved priority ${index}`, outcome: `Approved outcome ${index}.`, implementationPath: `Update target ${index} at location ${index}.`, dependency: `Approved dependency ${index}.`, completionTest: `Verify target ${index} passes the approved check.` });
    }
    context.loadApprovedFindingSetForGeneration_ = () => ({ reference: { findingSetId: 'FSET-WEBGBP-1', version: '1', fingerprint: 'approved-fixture-hash', approvalStatus: 'Approved for Client' }, reviewedInput: fixture });
    const plan = context.buildGoldStandardDocumentPlan_('executiveBrief', {}, {});
    assert.equal(plan.content.title, fixture.findings[0].category);
    assert.deepEqual(Array.from(plan.content.secondaryPriorities), fixture.findings.slice(1, 3).map(item => item.category));
    assert.equal(plan.content.additionalPriorityCount, Math.max(0, total - 3));
    assert.doesNotMatch(plan.pdfHtml, /Digital Presence Score|Supporting Priority/i);
  }
});

test('Executive Brief preview and PDF consume the same immutable content plan', () => {
  assert.match(goldSource, /buildGoldStandardExecutiveBriefContent_\(input\)/);
  assert.match(goldSource, /buildGoldStandardExecutiveBriefHtml_\(input, executiveBriefContent\)/);
  assert.match(previewSource, /const content = verifiedPlan\.content/);
  assert.doesNotMatch(previewSource.slice(previewSource.indexOf('function showExecutiveSnapshotPreview_'), previewSource.indexOf('function showDigitalBusinessAssessmentPreview_')), /input\.findings|input\.recommendations|input\.actions/);
});

test('menu actions are preview-only and PDF callbacks rebuild the exact approved plan before mutation', () => {
  const assessmentPreview = auditSource.slice(auditSource.indexOf('function generateAuditPackage()'), auditSource.indexOf('function generateDigitalBusinessAssessmentPdfFromPreview'));
  const briefPreview = auditSource.slice(auditSource.indexOf('function generateExecutiveSnapshot()'), auditSource.indexOf('function generateExecutiveBriefPdfFromPreview'));
  const planPreview = pdfSource.slice(pdfSource.indexOf('function generateProposal()'), pdfSource.indexOf('function generateImprovementPlanPdfFromPreview'));
  for (const body of [assessmentPreview, briefPreview, planPreview]) {
    assert.match(body, /buildGoldStandardDocumentPlan_/);
    assert.doesNotMatch(body, /getOrCreateAuditPackageFolder_|upsertAuditPackageBlobFile_|logPipelineActivity_|refreshSalesOperatingSystem_|applySmartFindingsToProspect_/);
  }
  for (const [source, start, end] of [
    [auditSource, 'function generateDigitalBusinessAssessmentPdfFromPreview', 'function generateExecutiveSnapshot'],
    [auditSource, 'function generateExecutiveBriefPdfFromPreview', 'function runFullProspectPackage'],
    [pdfSource, 'function generateImprovementPlanPdfFromPreview', 'function buildProposal_']
  ]) {
    const body = source.slice(source.indexOf(start), source.indexOf(end));
    assert.match(body, /executeGoldStandardDocumentGeneration_/);
    assert.doesNotMatch(body, /getOrCreateAuditPackageFolder_|upsertAuditPackageBlobFile_|logPipelineActivity_|refreshSalesOperatingSystem_/);
  }
});

test('plain-language Draft v2 preview and PDF share reviewed copy and simple headings', () => {
  const { context, getModal } = load();
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'fq1-plain-draft-v2.json'), 'utf8'));
  context.loadApprovedFindingSetForGeneration_ = () => ({ reference: { findingSetId: 'FSET-WEBGBP-1', version: '2', fingerprint: 'draft-v2-test-only', approvalStatus: 'Approved for Client' }, reviewedInput: fixture });
  const checks = [
    ['executiveBrief', 'showExecutiveSnapshotPreview_', ['Quick summary', 'Main problem', 'What we saw', 'Why this matters', 'What This Means', 'One Clear Fix', 'What Should Happen', 'How to check the fix', 'Where we looked', 'What we did not test', 'Want Help With This Fix']],
    ['assessment', 'showDigitalBusinessAssessmentPreview_', ['What We Checked', 'Where We Looked', 'How We Checked', 'What We Found', 'What should happen', 'What Happens Next']],
    ['improvementPlan', 'showImprovementPlanPreview_', ['Goal', 'Steps to Fix It', 'Who will do it', 'What we need first', 'Steps', 'Next Step']]
  ];
  for (const [type, previewFunction, headings] of checks) {
    const plan = context.buildGoldStandardDocumentPlan_(type, {}, {});
    assert.equal(plan.approvedFindingSetReference.version, '2');
    context[previewFunction]({}, plan);
    const preview = getModal();
    const phrases = type === 'improvementPlan'
      ? ['Add a Request Service link to the Services page menu.']
      : type === 'executiveBrief'
        ? ['The Services page menu has no Request Service link.', 'People can learn about your services, but they still have to search for the request form.', 'Add a Request Service link to the Services page menu.']
        : ['The Services page menu has no Request Service link.', 'A customer must search for the request form.', 'Add a Request Service link to the Services page menu.'];
    for (const phrase of phrases) {
      assert.match(preview, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(plan.pdfHtml, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    for (const heading of headings) assert.match(preview + plan.pdfHtml, new RegExp(heading, 'i'));
    assert.doesNotMatch(preview + plan.pdfHtml, /Found and checked|Used in this review/i);
    if (type === 'executiveBrief') {
      for (const copy of [
        'People can learn about your services, but they still have to search for the request form.',
        'That extra step makes asking for help harder.',
        'A clear Request Service link gives them one easy next step.',
        'What This Means',
        'Your website helps people learn about your services. The missing link is the next step to ask for help.',
        'One Clear Fix',
        'What Should Happen',
        'Want Help With This Fix?',
        'Reply to this report. We can walk through the next steps with you.',
        'Checked'
      ]) {
        const copyPattern = new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        assert.match(preview, copyPattern, `missing Executive Brief preview copy: ${copy}`);
        assert.match(plan.pdfHtml, copyPattern, `missing Executive Brief PDF copy: ${copy}`);
      }
      assert.doesNotMatch(preview + plan.pdfHtml, /Main items|Items checked|1 item/i);
    }
    if (type === 'assessment') {
      for (const copy of [
        'We checked the saved pages for a clear way to ask for help. This report shows what we checked, what we found, and what to do next.',
        'A customer must search for the request form. That extra step makes asking for help harder.'
      ]) {
        const copyPattern = new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        assert.match(preview, copyPattern, `missing Assessment preview copy: ${copy}`);
        assert.match(plan.pdfHtml, copyPattern, `missing Assessment PDF copy: ${copy}`);
      }
      assert.equal(plan.content.methodology[0].locationValue, 'Services page primary navigation');
      assert.equal(plan.content.methodology[0].captureMethodValue, 'Controlled manual fixture');
      assert.equal(plan.content.methodology[0].desktopMobileContextValue, 'Both');
      assert.equal(plan.content.methodology[0].testPerformedValue, 'Non-submitting navigation review');
      assert.equal(plan.content.methodology[0].resultValue, 'No direct route to inquiry form');
      assert.deepEqual(Array.from(plan.content.evidenceNotes), ['Fictional public-page evidence (a fictional public test page)']);
      assert.ok(!plan.content.limitations.includes('Fictional public-page evidence'));
      for (const rendered of [preview, plan.pdfHtml]) {
        for (const copy of [
          'Where we checked:',
          'Services page menu',
          'Test record:',
          'Controlled manual fixture (a test website checked by a person)',
          'What we checked:',
          'The menu link on a phone and computer',
          'What we did:',
          'We checked the menu without sending the form',
          'What we found:',
          'No direct route to inquiry form',
          'Important Evidence Note',
          'Fictional public-page evidence (a fictional public test page)',
          'Form submission not tested.'
        ]) assert.ok(rendered.includes(copy), `missing Assessment renderer copy: ${copy}`);
        const methodologyBlock = rendered.slice(rendered.indexOf('How We Checked'), rendered.indexOf('Important Evidence Note'));
        assert.doesNotMatch(methodologyBlock, /Controlled manual fixture\s*[·•]/);
        assert.doesNotMatch(rendered, /<b>Evidence:<\/b>/);
        assert.doesNotMatch(rendered, /Website\s*·\s*Services page menu\s*·\s*Controlled manual fixture/);
      }
      const previewFinding = preview.slice(preview.indexOf('What We Found'), preview.indexOf('What Happens Next'));
      const pdfFinding = plan.pdfHtml.slice(plan.pdfHtml.indexOf('What we found 1'), plan.pdfHtml.indexOf('What Happens Next'));
      assert.match(previewFinding, /Observed result:<\/b> No direct route to inquiry form/);
      assert.match(pdfFinding, /Observed result:<\/b> No direct route to inquiry form/);
      assert.doesNotMatch(previewFinding + pdfFinding, /Controlled manual fixture|Phone and computer|Checked the menu without sending the form/);
      assert.doesNotMatch(preview, /What We Did Not Check[\s\S]{0,400}Fictional public-page evidence/);
      assert.doesNotMatch(plan.pdfHtml, /What We Did Not Check<\/h2>[\s\S]{0,400}Fictional public-page evidence/);
      assert.match(preview + plan.pdfHtml, /&#10003; Checked/);
      assert.doesNotMatch(preview + plan.pdfHtml, /Why we know this/i);
    }
    if (type === 'improvementPlan') {
      assert.equal(plan.content.subtitle, 'These steps show what to change, who will do it, and how to check the work.');
      for (const rendered of [preview, plan.pdfHtml]) {
        assert.match(rendered, /These steps show what to change, who will do it, and how to check the work\./);
        assert.doesNotMatch(rendered, /execution plan|approved correction|ownership|dependencies|verification/i);
      }
      assert.match(preview, /2026-08-15/);
      assert.match(preview, /Prepared:<\/b> August 15, 2026/);
      assert.match(preview + plan.pdfHtml, /Make it easy for customers to reach the request form from the Services page menu\./);
      assert.equal((preview.match(/How to check the fix:/gi) || []).length, 0);
      assert.equal((plan.pdfHtml.match(/How to check the fix/gi) || []).length, 0);
      assert.equal((preview.match(/Test the link on a phone and a computer\./g) || []).length, 1);
      assert.equal((plan.pdfHtml.match(/Test the link on a phone and a computer\./g) || []).length, 1);
    }
  }
});

test('real one-action Improvement Plan keeps authority in its proper section without repeating full instructions', () => {
  const reviewedInput = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'rogers-approved-v1-renderer.json'), 'utf8'));
  const { context } = load();
  context.loadApprovedFindingSetForGeneration_ = () => ({
    reference: { findingSetId: 'FSET-a2ae86fa62d97824', version: '1', fingerprint: '70a20a6d7ef2427430699251188a8358a31bbcfda8b02f2e15a1431f9a7c0629', approvalStatus: 'Approved for Client' },
    reviewedInput
  });
  const plan = context.buildGoldStandardDocumentPlan_('improvementPlan', {}, {});
  assert.equal(plan.content.objective, 'Create a simpler and more dependable lead-capture path with structured intake records and auditable follow-up.');
  assert.deepEqual(Array.from(plan.content.sequence), []);
  assert.deepEqual(Array.from(plan.content.actions[0].dependencies), [
    'Access to the Business Snapshot form submission workflow',
    'A person chosen to make the change'
  ]);
  assert.equal(plan.content.actions[0].showImplementationPath, false);
  assert.equal(plan.content.actions[0].showIntendedOutcome, false);
  assert.equal((plan.pdfHtml.match(/Connect the Business Snapshot form to a secure submission system/g) || []).length, 1);
  assert.equal((plan.pdfHtml.match(/Submit an authorized test Business Snapshot through the published form/g) || []).length, 1);
  assert.match(plan.pdfHtml, /Next step/);
});
