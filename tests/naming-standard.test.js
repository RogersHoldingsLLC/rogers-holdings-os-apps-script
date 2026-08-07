const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = fileName => fs.readFileSync(path.join(ROOT, fileName), 'utf8');

function loadNamingContext() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(read('Config.js'), context, { filename: 'Config.js' });
  vm.runInContext(read('SheetHelpers.js'), context, { filename: 'SheetHelpers.js' });
  vm.runInContext(read('DemoData.js'), context, { filename: 'DemoData.js' });
  return context;
}

test('canonical prospect journey and dropdown language are enforced', () => {
  const context = loadNamingContext();
  assert.deepEqual(Array.from(context.PIPELINE_STAGES.slice(0, 7)), [
    'Lead Found',
    'Executive Brief Sent',
    'Discovery Meeting Scheduled',
    'Digital Business Assessment',
    'Improvement Plan Sent',
    'Project Started',
    'Client'
  ]);
  assert.ok(context.PROSPECT_DROPDOWN_DEFAULTS['Next Action'].includes('Generate Executive Brief'));
  assert.ok(context.PROSPECT_DROPDOWN_DEFAULTS['Next Action'].includes('Confirm Executive Brief Sent'));
  assert.ok(context.PROSPECT_DROPDOWN_DEFAULTS['Offer / Service'].includes('Business Snapshot'));
  assert.ok(!context.PROSPECT_DROPDOWN_DEFAULTS['Offer / Service'].includes('Website Audit'));
});

test('legacy stored values normalize to canonical display and workflow values', () => {
  const context = loadNamingContext();
  assert.equal(context.normalizePipelineStage_('Executive Snapshot Sent'), 'Executive Brief Sent');
  assert.equal(context.normalizePipelineStage_('Digital Business Assessment Presented'), 'Digital Business Assessment');
  assert.equal(
    context.normalizeNextAction_('Generate Executive Snapshot', context.PROSPECT_DROPDOWN_DEFAULTS['Next Action']),
    'Generate Executive Brief'
  );
  assert.equal(
    context.normalizeOfferService_('Website Audit', context.PROSPECT_DROPDOWN_DEFAULTS['Offer / Service']),
    'Business Snapshot'
  );
  assert.equal(context.validateProspectStageTransition_('Executive Snapshot Sent', 'Discovery Meeting Scheduled').allowed, true);

  vm.runInContext(read('DigitalPresenceAssessmentEngine.js'), context, { filename: 'DigitalPresenceAssessmentEngine.js' });
  assert.equal(context.getClientFacingServiceName_('Website Audit', 82), 'Business Snapshot');
});

test('customer and operator surfaces use canonical Executive Brief language', () => {
  const deprecatedOpportunityLabel = ['Digital', 'Opportunity', 'Snapshot'].join(' ');
  for (const fileName of ['Menu.js', 'DeliverablePreviewEngine.js', 'PdfEngine.js']) {
    const source = read(fileName);
    assert.doesNotMatch(source, /['"`]Executive Snapshot(?:\.pdf| Generated| Sent)?/);
    assert.ok(!source.includes(deprecatedOpportunityLabel));
  }
  assert.match(read('Menu.js'), /Generate Executive Brief/);
  assert.match(read('DeliverablePreviewEngine.js'), /hero-label">Executive Brief/);
  assert.match(read('PdfEngine.js'), /htmlToPdfBlob_\(html, 'Executive Brief\.pdf'\)/);
});

test('synthetic local package uses canonical filenames and Gmail copy', () => {
  const files = [];
  const folder = {
    getFilesByName(name) {
      const matches = files.filter(file => file.getName() === name && !file.trashed);
      let index = 0;
      return { hasNext: () => index < matches.length, next: () => matches[index++] };
    },
    createFile(nameOrBlob, contents) {
      const name = typeof nameOrBlob === 'string' ? nameOrBlob : nameOrBlob.name;
      const file = {
        name,
        contents,
        trashed: false,
        getName() { return this.name; },
        setDescription() { return this; },
        setContent(value) { this.contents = value; return this; },
        setTrashed(value) { this.trashed = value; return this; }
      };
      files.push(file);
      return file;
    }
  };
  const blob = name => ({ name, setName(value) { this.name = value; return this; } });
  const driveContext = {
    console,
    MimeType: { PLAIN_TEXT: 'text/plain' },
    buildAuditReportPdfBlob_: () => blob('internal-assessment.pdf'),
    buildProposalPdfBlob_: () => blob('internal-plan.pdf'),
    buildAuditPackageOutreachText_: () => 'Synthetic outreach copy'
  };
  vm.createContext(driveContext);
  vm.runInContext(read('DriveEngine.js'), driveContext, { filename: 'DriveEngine.js' });
  driveContext.trashLegacyAuditPackageTextFiles_ = () => {};
  const generated = driveContext.storeAuditPackageFiles_(folder, {}, {}, {}, { company: 'Synthetic Co' });
  assert.deepEqual(Array.from(generated, file => file.getName()), [
    'Digital Business Assessment.pdf',
    'Outreach Email Draft.txt',
    'Improvement Plan.pdf'
  ]);

  const gmailContext = {
    console,
    filterClientEligibleEvidence_: () => ['Clearer call to action'],
    getSmartFindings_: () => ['Clearer call to action'],
    getReportScoreContext_: () => ({ displayScore: '82', severityLabel: 'Good foundation', safeFallbackLanguage: '' }),
    getBusinessClassificationContext_: () => ({ audience: 'prospective customers' })
  };
  vm.createContext(gmailContext);
  vm.runInContext(read('GmailEngine.js'), gmailContext, { filename: 'GmailEngine.js' });
  const body = gmailContext.buildAuditPackageSendEmailBody_(
    { company: 'Synthetic Co', website: 'https://example.test', reportFile: {} },
    { getUrl: () => 'https://drive.example.test/synthetic' },
    true
  );
  assert.match(body, /Digital Business Assessment and Improvement Plan/);
  assert.doesNotMatch(body, /Executive Snapshot|Audit Report|Proposal/);
});

test('synthetic Improvement Plan rendering never calls itself a proposal', () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(read('PdfEngine.js'), context, { filename: 'PdfEngine.js' });

  context.normalizeClientProspect_ = prospect => prospect;
  context.normalizeClientBusinessName_ = value => value;
  context.getImprovementPlanBusinessContext_ = () => ({
    type: 'local-service',
    audience: 'prospective customers'
  });
  context.getReportScoreContext_ = () => ({ scoreVerified: true });
  context.getSmartFindings_ = () => ['Make the primary customer action easier to find.'];
  context.getRogersContactInfo_ = () => ({
    name: 'Brian Rogers',
    company: 'Rogers Holdings LLC',
    email: 'hello@example.test',
    phone: ''
  });
  context.buildRecommendedPackage_ = () => ({
    name: 'Business Snapshot Action Package',
    service: 'Business Snapshot',
    outcome: 'Clearer customer action',
    investmentRange: '$500 - $1,500',
    investment: 'To confirm',
    timeline: '30 days',
    scope: 'Priority improvements',
    deliverables: [['Action plan', 'Prioritized recommendations']]
  });
  context.escapeHtml_ = value => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  context.brandedPdfCoverHtml_ = title => `<h1>${title}</h1>`;
  context.brandedPdfSectionHtml_ = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
  context.brandedPdfDefinitionListHtml_ = rows => rows.map(row => `<p>${row.join(': ')}</p>`).join('');
  context.recommendationCardsHtml_ = values => values.map(value => `<p>${value}</p>`).join('');
  context.renderPdfCardGroup_ = html => html;
  context.buildBrandedPdfHtml_ = document => `<title>${document.title}</title>${document.bodyHtml}`;
  context.htmlToPdfBlob_ = (html, name) => ({ html, name });

  const rendered = context.buildProposalPdfBlob_({
    company: 'Synthetic Co',
    website: 'https://example.test',
    reportFile: {}
  }, { company: 'Synthetic Co' });
  assert.equal(rendered.name, 'Improvement Plan.pdf');
  assert.match(rendered.html, /<title>Improvement Plan<\/title>/);
  assert.match(rendered.html, /Business Snapshot/);
  assert.doesNotMatch(rendered.html, /\bproposal\b/i);
  assert.doesNotMatch(rendered.html, /Website Audit Tool(?: API)?/);

  const modal = context.buildProposalHtml_({}, {
    company: 'Synthetic Co',
    website: 'https://example.test',
    auditScore: '82',
    recommendedService: 'Business Snapshot',
    proposalText: 'IMPROVEMENT PLAN\nA practical starting plan.'
  });
  const visibleModalCopy = modal
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  assert.match(visibleModalCopy, /Improvement Plan Text/);
  assert.doesNotMatch(visibleModalCopy, /\bproposal\b/i);
  assert.match(modal, /manually select the Improvement Plan text/);
});

test('Website Audit Tool API is canonical while legacy source values remain accepted', () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(read('Config.js'), context, { filename: 'Config.js' });
  vm.runInContext(read('AuditEngine.js'), context, { filename: 'AuditEngine.js' });

  assert.equal(context.AUDIT_SOURCE_VALUES[0], 'Website Audit Tool API');
  assert.ok(context.AUDIT_SOURCE_VALUES.includes('Website Audit Tool'));
  assert.ok(context.VERIFIED_CLIENT_FACING_AUDIT_SOURCES.includes('Website Audit Tool API'));
  assert.ok(context.VERIFIED_CLIENT_FACING_AUDIT_SOURCES.includes('Website Audit Tool'));
  assert.equal(context.isWebsiteAuditToolSource_('Website Audit Tool API'), true);
  assert.equal(context.isWebsiteAuditToolSource_('Website Audit Tool'), true);
  assert.equal(context.isWebsiteAuditToolSource_('Website Audit'), false);

  assert.match(read('BusinessSnapshotIntake.js'), /'Audit Source', 'Website Audit Tool API'/);
  assert.match(read('AuditEngine.js'), /'Audit Source', 'Website Audit Tool API'/);
  assert.match(read('ExecutiveBusinessIntelligenceEngine.js'), /source: 'Website Audit Tool API'/);
});

test('activity, next action, and workspace wording are canonical', () => {
  const activitySource = read('AuditEngine.js') + read('ProspectRevenueWorkflow.js');
  assert.match(activitySource, /Executive Brief Generated/);
  assert.match(activitySource, /Confirm Executive Brief Sent/);
  assert.doesNotMatch(activitySource, /Executive Snapshot Generated|Confirm Executive Snapshot Sent/);
  const workspaceSource = read('SheetHelpers.js');
  assert.match(workspaceSource, />Confirm Executive Brief Sent</);
  assert.match(workspaceSource, /'Lead Found': 'Generate Executive Brief'/);
});

test('legacy artifact filenames remain accepted by package discovery', () => {
  const gmailSource = read('GmailEngine.js');
  assert.match(gmailSource, /AuditReport\.pdf/);
  assert.match(gmailSource, /Audit Report\.pdf/);
  assert.match(gmailSource, /\['Improvement Plan\.pdf', 'Proposal\.pdf'\]/);
});
