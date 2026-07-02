/**
 * Rogers Holdings OS - InspectionIntelligenceEngine.
 * Translates structured inspection and WebsiteDocument data into business-ready
 * findings without changing audit scoring, report layout, workflows, or menus.
 */

function generateInspectionIntelligenceFindings_(input) {
  const context = normalizeInspectionIntelligenceInput_(input || {});
  const findings = [];
  const seen = {};

  if (!hasInspectionIntelligenceSourceData_(context)) {
    return [];
  }

  translateInspectionResultFindings_(context).forEach(function(finding) {
    addInspectionIntelligenceFinding_(findings, seen, finding);
  });

  getInspectionIntelligenceRules_().forEach(function(rule) {
    if (findings.length >= 8) {
      return;
    }
    if (rule.detect(context)) {
      addInspectionIntelligenceFinding_(findings, seen, createInspectionIntelligenceFinding_(rule, context));
    }
  });

  return findings.slice(0, 8);
}

function getInspectionIntelligenceFindingsForReport_(prospect, reportFile) {
  return generateInspectionIntelligenceFindings_({
    prospect: prospect || {},
    reportFile: reportFile || {},
    inspectionResult: reportFile && (reportFile.inspectionResult || reportFile.inspection),
    websiteDocument: reportFile && (reportFile.websiteDocument || reportFile.websiteDocumentJson || reportFile.document)
  });
}

function normalizeInspectionIntelligenceInput_(input) {
  const data = input || {};
  const reportFile = data.reportFile || {};
  const prospect = data.prospect || {};
  const websiteDocument = normalizeInspectionIntelligenceWebsiteDocument_(
    data.websiteDocument ||
    data.website ||
    reportFile.websiteDocument ||
    reportFile.websiteDocumentJson ||
    reportFile.document ||
    prospect.websiteDocument
  );
  const inspectionResult = normalizeInspectionIntelligenceInspectionResult_(
    data.inspectionResult ||
    data.inspection ||
    reportFile.inspectionResult ||
    reportFile.inspection ||
    prospect.inspectionResult
  );
  const text = normalizeInspectionIntelligenceText_([
    websiteDocument.visibleText,
    websiteDocument.pageTitle,
    websiteDocument.metaDescription,
    reportFile.homepageText,
    reportFile.pageText,
    prospect.summary,
    prospect.notes
  ].join(' '));
  const firstScreenText = normalizeInspectionIntelligenceText_([
    reportFile.aboveFoldText,
    reportFile.firstScreenText,
    websiteDocument.headings.slice(0, 3).map(function(heading) {
      return heading.text;
    }).join(' '),
    websiteDocument.buttons.slice(0, 4).map(function(button) {
      return button.text;
    }).join(' ')
  ].join(' '));
  const links = websiteDocument.links || [];
  const navigationLinks = websiteDocument.navigationLinks && websiteDocument.navigationLinks.length
    ? websiteDocument.navigationLinks
    : links.slice(0, 40);
  return {
    prospect: prospect,
    reportFile: reportFile,
    websiteDocument: websiteDocument,
    inspectionResult: inspectionResult,
    text: text,
    firstScreenText: firstScreenText,
    links: links,
    navigationLinks: navigationLinks,
    footerLinks: websiteDocument.footerLinks || [],
    buttons: websiteDocument.buttons || [],
    forms: websiteDocument.forms || [],
    headings: websiteDocument.headings || [],
    images: websiteDocument.images || [],
    phoneNumbers: websiteDocument.phoneNumbers || [],
    emails: websiteDocument.emails || [],
    possibleAddresses: websiteDocument.possibleAddresses || [],
    pageTitle: String(websiteDocument.pageTitle || '').trim(),
    metaDescription: String(websiteDocument.metaDescription || '').trim()
  };
}

function hasInspectionIntelligenceSourceData_(context) {
  if (!context) {
    return false;
  }
  if (context.inspectionResult.findings && context.inspectionResult.findings.length) {
    return true;
  }
  const document = context.websiteDocument || {};
  return !!(
    document.rawHtml ||
    document.visibleText ||
    document.pageTitle ||
    document.metaDescription ||
    (document.links && document.links.length) ||
    (document.headings && document.headings.length) ||
    (document.buttons && document.buttons.length) ||
    (document.forms && document.forms.length) ||
    (document.images && document.images.length)
  );
}

function normalizeInspectionIntelligenceWebsiteDocument_(value) {
  const document = parseInspectionIntelligenceObject_(value) || {};
  return {
    objectType: document.objectType || 'WebsiteDocument',
    originalUrl: document.originalUrl || '',
    finalUrl: document.finalUrl || '',
    fetchStatus: document.fetchStatus || '',
    statusCode: document.statusCode || null,
    rawHtml: document.rawHtml || '',
    visibleText: document.visibleText || '',
    pageTitle: document.pageTitle || '',
    metaDescription: document.metaDescription || '',
    headings: normalizeInspectionIntelligenceArray_(document.headings),
    links: normalizeInspectionIntelligenceArray_(document.links),
    navigationLinks: normalizeInspectionIntelligenceArray_(document.navigationLinks),
    footerLinks: normalizeInspectionIntelligenceArray_(document.footerLinks),
    images: normalizeInspectionIntelligenceArray_(document.images),
    buttons: normalizeInspectionIntelligenceArray_(document.buttons),
    forms: normalizeInspectionIntelligenceArray_(document.forms),
    phoneNumbers: normalizeInspectionIntelligenceArray_(document.phoneNumbers),
    emails: normalizeInspectionIntelligenceArray_(document.emails),
    possibleAddresses: normalizeInspectionIntelligenceArray_(document.possibleAddresses),
    scripts: normalizeInspectionIntelligenceArray_(document.scripts),
    stylesheets: normalizeInspectionIntelligenceArray_(document.stylesheets),
    warnings: normalizeInspectionIntelligenceArray_(document.warnings),
    errors: normalizeInspectionIntelligenceArray_(document.errors),
    executionMetadata: document.executionMetadata || {}
  };
}

function normalizeInspectionIntelligenceInspectionResult_(value) {
  const result = parseInspectionIntelligenceObject_(value) || {};
  return {
    objectType: result.objectType || 'InspectionResult',
    overallScore: result.overallScore || result.score || null,
    overallGrade: result.overallGrade || '',
    findings: normalizeInspectionIntelligenceArray_(result.findings),
    evidence: normalizeInspectionIntelligenceArray_(result.evidence),
    businessSummary: result.businessSummary || '',
    categoryScores: result.categoryScores || {},
    inspectorResults: normalizeInspectionIntelligenceArray_(result.inspectorResults),
    executionMetadata: result.executionMetadata || {}
  };
}

function translateInspectionResultFindings_(context) {
  const sourceFindings = context.inspectionResult.findings || [];
  return sourceFindings.map(function(sourceFinding, index) {
    const evidence = sourceFinding.evidence && sourceFinding.evidence.length ? sourceFinding.evidence[0] : {};
    const recommendation = sourceFinding.recommendation || {};
    const issue = firstInspectionIntelligenceValue_([
      sourceFinding.title,
      sourceFinding.description,
      sourceFinding.inspectorNotes
    ], 'Inspection finding identified.');
    const action = firstInspectionIntelligenceValue_([
      recommendation.action,
      recommendation.summary,
      sourceFinding.recommendedAction
    ], defaultInspectionIntelligenceAction_(sourceFinding.category));
    return {
      findingId: sourceFinding.id || 'inspection-finding-' + (index + 1),
      category: sourceFinding.category || 'Website Experience',
      severity: normalizeInspectionIntelligenceSeverity_(sourceFinding.severity),
      confidence: normalizeInspectionIntelligenceConfidence_(evidence.confidence, 0.82),
      evidence: evidence,
      businessLanguage: issue,
      customerImpact: sourceFinding.customerImpact || customerImpactForInspectionCategory_(sourceFinding.category),
      businessImpact: sourceFinding.businessImpact || businessImpactForInspectionCategory_(sourceFinding.category),
      revenueImpact: revenueImpactForInspectionCategory_(sourceFinding.category),
      trustImpact: trustImpactForInspectionCategory_(sourceFinding.category),
      recommendedAction: action,
      executiveSummary: buildInspectionIntelligenceExecutiveSummary_(issue, action),
      consultantObservation: consultantObservationForInspectionCategory_(sourceFinding.category, issue),
      supportingEvidence: evidence.description || evidence.value || evidence.label || sourceFinding.description || issue,
      priority: sourceFinding.priority || priorityForInspectionIntelligenceSeverity_(sourceFinding.severity),
      estimatedEffort: sourceFinding.difficulty || 'Medium',
      estimatedRoi: sourceFinding.expectedRoi || sourceFinding.expectedROI || 'Medium',
      source: 'InspectionResult'
    };
  });
}

function getInspectionIntelligenceRules_() {
  return [
    inspectionIntelligenceRule_('missing-phone-number', 'Contact Information', 'High', 0.96, function(ctx) {
      return ctx.phoneNumbers.length === 0 && !textIncludesAny_(ctx.text, ['call us', 'phone']);
    }, 'No phone number was detected on the website.', 'Potential customers may not have an obvious way to call when they are ready to ask a question or request service.', 'Add a visible phone number in the header, footer, and primary contact section.'),
    inspectionIntelligenceRule_('phone-only-in-footer', 'Contact Information', 'Medium', 0.86, function(ctx) {
      return ctx.phoneNumbers.length > 0 && !textIncludesAny_(ctx.firstScreenText, ctx.phoneNumbers.map(String));
    }, 'The primary phone number appears to be missing from the first screen.', 'Customers who are ready to call may need to scroll or search before they find a direct contact option.', 'Place the primary phone number in the header or first-screen contact area.'),
    inspectionIntelligenceRule_('missing-contact-form', 'Lead Capture', 'High', 0.92, function(ctx) {
      return ctx.forms.length === 0;
    }, 'No contact form was detected on the website.', 'Visitors who prefer to request help online may leave instead of starting a conversation.', 'Add a simple contact, quote, booking, or request form tied to the main service offer.'),
    inspectionIntelligenceRule_('missing-cta-button', 'Calls To Action', 'High', 0.9, function(ctx) {
      return !hasInspectionIntelligenceCta_(ctx);
    }, 'No clear call-to-action button appears before scrolling.', 'Customers may understand the business but still not know the next step to take.', 'Add a primary button such as Request a Quote, Schedule Service, Book Now, or Call Today near the top of the homepage.'),
    inspectionIntelligenceRule_('weak-cta-wording', 'Calls To Action', 'Medium', 0.78, function(ctx) {
      return hasInspectionIntelligenceWeakCta_(ctx);
    }, 'The visible call-to-action wording appears generic.', 'Generic actions like Learn More can create friction when customers are ready to call, book, or request help.', 'Use action-specific wording tied to the desired customer step.'),
    inspectionIntelligenceRule_('missing-testimonials', 'Trust Signals', 'Medium', 0.84, function(ctx) {
      return !textIncludesAny_(ctx.text, ['testimonial', 'testimonials', 'what customers say']);
    }, 'No customer testimonials were found on the homepage.', 'Customers may have less proof that other people trust the business.', 'Add a short testimonial or customer proof section near the homepage decision path.'),
    inspectionIntelligenceRule_('missing-reviews', 'Trust Signals', 'Medium', 0.86, function(ctx) {
      return !textIncludesAny_(ctx.text, ['review', 'reviews', 'rated', 'stars', 'google rating']);
    }, 'No customer reviews were found anywhere on the homepage.', 'Visitors comparing local options may not see enough social proof before deciding who to contact.', 'Feature review snippets, ratings, or a link to verified customer reviews.'),
    inspectionIntelligenceRule_('missing-service-area', 'Local SEO', 'Medium', 0.84, function(ctx) {
      return !textIncludesAny_(ctx.text, ['service area', 'serving', 'locally owned', 'nearby', 'county', 'region']) && !ctx.prospect.city;
    }, 'The service area is not clearly visible on the website.', 'Local customers may not know whether the business serves their location.', 'Add clear city, state, and service area language near the homepage and contact areas.'),
    inspectionIntelligenceRule_('missing-emergency-messaging', 'Content Quality', 'Low', 0.72, function(ctx) {
      return isEmergencyRelevantIndustry_(ctx.prospect) && !textIncludesAny_(ctx.text, ['emergency', '24/7', 'same day', 'urgent']);
    }, 'Emergency or urgent-service messaging was not detected.', 'Customers with immediate needs may not know whether the business can respond quickly.', 'Add appropriate emergency, same-day, or urgent-service messaging if the business offers it.'),
    inspectionIntelligenceRule_('missing-hours', 'Contact Information', 'Medium', 0.88, function(ctx) {
      return !textIncludesAny_(ctx.text, ['hours', 'open', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    }, 'Business hours were not detected on the website.', 'Customers may hesitate if they do not know when the business is available.', 'Add business hours near the contact area and footer.'),
    inspectionIntelligenceRule_('missing-address', 'Contact Information', 'Medium', 0.82, function(ctx) {
      return ctx.possibleAddresses.length === 0 && !textIncludesAny_(ctx.text, ['address', 'located in']);
    }, 'A physical address was not detected on the website.', 'Customers may have less confidence that the business is local and established.', 'Add the primary business address or local service location details where appropriate.'),
    inspectionIntelligenceRule_('missing-email', 'Contact Information', 'Low', 0.9, function(ctx) {
      return ctx.emails.length === 0;
    }, 'No email address was detected on the website.', 'Some customers may not have a simple written contact option.', 'Add a monitored email address or clear contact form path.'),
    inspectionIntelligenceRule_('broken-navigation', 'Navigation', 'High', 0.8, function(ctx) {
      return hasInspectionIntelligenceBrokenLinks_(ctx);
    }, 'One or more internal navigation links appear incomplete or broken.', 'Customers may hit dead ends while trying to learn about services or contact the business.', 'Review navigation links and fix empty, placeholder, or broken internal paths.'),
    inspectionIntelligenceRule_('missing-h1', 'Homepage', 'High', 0.92, function(ctx) {
      return ctx.headings.filter(function(heading) { return String(heading.level).toLowerCase() === 'h1'; }).length === 0;
    }, 'No H1 heading describing the primary service was detected.', 'The homepage may not immediately communicate what the business does to customers or search engines.', 'Add one clear H1 that describes the primary service and location focus.'),
    inspectionIntelligenceRule_('duplicate-headings', 'Homepage', 'Low', 0.76, function(ctx) {
      return hasDuplicateInspectionIntelligenceHeadings_(ctx);
    }, 'Duplicate heading text was detected on the page.', 'Repeated headings can make the page feel less organized and harder to scan.', 'Review heading structure so each section has a distinct purpose.'),
    inspectionIntelligenceRule_('poor-page-title', 'Local SEO', 'Medium', 0.84, function(ctx) {
      return !ctx.pageTitle || ctx.pageTitle.length < 18 || ctx.pageTitle.length > 70;
    }, 'The page title appears missing, too short, or too long.', 'Search results may not clearly explain the business or service before customers click.', 'Rewrite the page title to include the business, primary service, and local relevance.'),
    inspectionIntelligenceRule_('missing-meta-description', 'Local SEO', 'Medium', 0.92, function(ctx) {
      return !ctx.metaDescription;
    }, 'No meta description was detected.', 'Search visibility and click-through may be limited because the page lacks a clear summary.', 'Add a concise meta description that explains the service, location, and customer next step.'),
    inspectionIntelligenceRule_('missing-social-links', 'Trust Signals', 'Low', 0.74, function(ctx) {
      return !hasInspectionIntelligenceSocialLink_(ctx);
    }, 'No social profile links were detected.', 'Some customers may look for additional proof before contacting a business.', 'Add relevant social or business profile links if they are active and professional.'),
    inspectionIntelligenceRule_('large-image-count', 'Performance', 'Low', 0.7, function(ctx) {
      return ctx.images.length >= 35;
    }, 'The page appears to use a large number of images.', 'Large image-heavy pages can feel slower, especially on mobile connections.', 'Compress images and remove unused visuals that do not support trust or conversion.'),
    inspectionIntelligenceRule_('very-low-text-content', 'Content Quality', 'High', 0.85, function(ctx) {
      return ctx.text.length > 0 && ctx.text.length < 700;
    }, 'The homepage has very limited readable text content.', 'Customers may not get enough information to understand services, trust the business, or decide to contact.', 'Add concise service, proof, location, and next-step content in plain English.'),
    inspectionIntelligenceRule_('missing-about-page', 'Trust Signals', 'Low', 0.82, function(ctx) {
      return !hasInspectionIntelligencePage_(ctx, ['about', 'our story', 'team']);
    }, 'No About page was detected in the navigation.', 'Customers may have fewer ways to understand who is behind the business.', 'Add or improve an About page with ownership, team, values, experience, and local credibility.'),
    inspectionIntelligenceRule_('missing-services-page', 'Navigation', 'High', 0.86, function(ctx) {
      return !hasInspectionIntelligencePage_(ctx, ['service', 'services', 'solutions', 'what we do']);
    }, 'No clear Services page was detected in the navigation.', 'Important services may require multiple clicks before customers can find them.', 'Add a clear Services page or service menu with the highest-value offerings.'),
    inspectionIntelligenceRule_('missing-faq', 'Content Quality', 'Low', 0.78, function(ctx) {
      return !hasInspectionIntelligencePage_(ctx, ['faq', 'questions']);
    }, 'No FAQ section or page was detected.', 'Customers may leave with unanswered questions that could have been resolved quickly.', 'Add a short FAQ addressing pricing, timing, service area, process, and common objections.'),
    inspectionIntelligenceRule_('missing-privacy-policy', 'Security', 'Medium', 0.86, function(ctx) {
      return !hasInspectionIntelligencePage_(ctx, ['privacy']);
    }, 'No Privacy Policy link was detected.', 'Customers may be less comfortable submitting forms if privacy expectations are unclear.', 'Add a Privacy Policy link in the footer.'),
    inspectionIntelligenceRule_('missing-terms', 'Security', 'Low', 0.72, function(ctx) {
      return !hasInspectionIntelligencePage_(ctx, ['terms', 'conditions']);
    }, 'No Terms or Conditions link was detected.', 'The site may be missing a basic trust and compliance signal.', 'Add Terms or Conditions where appropriate for the business model.'),
    inspectionIntelligenceRule_('missing-google-map', 'Local SEO', 'Low', 0.76, function(ctx) {
      return ctx.websiteDocument.rawHtml && ctx.websiteDocument.rawHtml.toLowerCase().indexOf('google.com/maps') === -1 && ctx.websiteDocument.rawHtml.toLowerCase().indexOf('maps.google') === -1;
    }, 'No embedded Google Map was detected.', 'Local customers may have less confidence about location or service area.', 'Add a Google Map or clear local location section if customers visit or evaluate proximity.'),
    inspectionIntelligenceRule_('missing-google-business-link', 'Google Business', 'Medium', 0.78, function(ctx) {
      return !textIncludesAny_(ctx.websiteDocument.rawHtml, ['g.page/', 'goo.gl/maps', 'google.com/maps', 'business.google.com']);
    }, 'No Google Business Profile link was detected on the website.', 'Customers may not have an easy path to verified reviews, directions, or local business details.', 'Add a link to the Google Business Profile near reviews, footer, or contact details.'),
    inspectionIntelligenceRule_('missing-trust-badges', 'Trust Signals', 'Medium', 0.78, function(ctx) {
      return !textIncludesAny_(ctx.text, ['licensed', 'insured', 'certified', 'award', 'accredited', 'guarantee', 'warranty']);
    }, 'No trust badges, certifications, guarantees, or credentials were detected.', 'Customers may not see enough proof to feel confident before making contact.', 'Add relevant credentials, licenses, guarantees, warranties, certifications, or proof points.'),
    inspectionIntelligenceRule_('weak-branding-consistency', 'Brand Consistency', 'Low', 0.7, function(ctx) {
      return ctx.images.length > 0 && !hasInspectionIntelligenceLogoSignal_(ctx);
    }, 'A clear logo or brand image signal was not detected in image data.', 'The site may feel less polished if the brand is not immediately recognizable.', 'Make sure the logo, business name, colors, and visual style are consistent in the header and key sections.'),
    inspectionIntelligenceRule_('broken-internal-links', 'Navigation', 'Medium', 0.82, function(ctx) {
      return hasInspectionIntelligenceBrokenInternalLinks_(ctx);
    }, 'Some internal links appear to be placeholders or incomplete.', 'Customers may experience unnecessary friction when navigating to important information.', 'Audit internal links and replace placeholder anchors with real destinations.')
  ];
}

function inspectionIntelligenceRule_(id, category, severity, confidence, detect, businessLanguage, customerImpact, recommendedAction) {
  const definition = getInspectionRuleDefinition_(id) || {};
  return {
    id: id,
    ruleId: definition.ruleId || id,
    category: category,
    severity: severity,
    confidence: confidence,
    detect: detect,
    businessLanguage: businessLanguage,
    customerImpact: customerImpact,
    recommendedAction: recommendedAction,
    priority: definition.priority || '',
    businessReason: definition.businessReason || '',
    customerReason: definition.customerReason || '',
    expectedEvidence: definition.expectedEvidence || [],
    estimatedEffort: definition.estimatedEffort || '',
    expectedROI: definition.expectedROI || '',
    tags: definition.tags || [],
    version: definition.version || ''
  };
}

function createInspectionIntelligenceFinding_(rule, context) {
  const evidence = buildInspectionIntelligenceEvidence_(rule, context);
  return {
    findingId: 'intel-' + rule.id,
    category: rule.category,
    severity: rule.severity,
    confidence: rule.confidence,
    evidence: evidence,
    businessLanguage: rule.businessLanguage,
    customerImpact: rule.customerImpact,
    businessImpact: rule.businessReason || businessImpactForInspectionCategory_(rule.category),
    revenueImpact: revenueImpactForInspectionCategory_(rule.category),
    trustImpact: trustImpactForInspectionCategory_(rule.category),
    recommendedAction: rule.recommendedAction,
    executiveSummary: buildInspectionIntelligenceExecutiveSummary_(rule.businessLanguage, rule.recommendedAction),
    consultantObservation: consultantObservationForInspectionCategory_(rule.category, rule.businessLanguage),
    supportingEvidence: evidence.description || rule.businessLanguage,
    priority: rule.priority || priorityForInspectionIntelligenceSeverity_(rule.severity),
    estimatedEffort: rule.estimatedEffort || effortForInspectionIntelligenceRule_(rule.id),
    estimatedRoi: rule.expectedROI || roiForInspectionIntelligenceRule_(rule.id, rule.severity),
    source: 'InspectionIntelligenceEngine',
    metadata: {
      ruleId: rule.ruleId || rule.id,
      ruleVersion: rule.version || '',
      expectedEvidence: rule.expectedEvidence || [],
      tags: rule.tags || []
    }
  };
}

function buildInspectionIntelligenceEvidence_(rule, context) {
  const sourceUrl = context.websiteDocument.finalUrl || context.websiteDocument.originalUrl || context.prospect.website || '';
  const evidenceText = evidenceTextForInspectionIntelligenceRule_(rule.id, context);
  return {
    type: 'WebsiteDocument',
    source: 'Website Fetch Engine',
    sourceUrl: sourceUrl,
    label: evidenceLabelForInspectionIntelligenceRule_(rule.id),
    description: evidenceText,
    value: evidenceText,
    confidence: rule.confidence,
    metadata: {
      ruleId: rule.ruleId || rule.id,
      category: rule.category,
      expectedEvidence: rule.expectedEvidence || [],
      ruleVersion: rule.version || ''
    }
  };
}

function addInspectionIntelligenceFinding_(findings, seen, finding) {
  if (!finding) {
    return;
  }
  const key = [
    String(finding.category || '').toLowerCase(),
    String(finding.businessLanguage || finding.consultantObservation || '').toLowerCase()
  ].join('|');
  if (seen[key]) {
    return;
  }
  seen[key] = true;
  findings.push(finding);
}

function evidenceTextForInspectionIntelligenceRule_(ruleId, context) {
  const evidenceMap = {
    'missing-phone-number': 'WebsiteDocument phoneNumbers is empty.',
    'phone-only-in-footer': 'A phone number was detected, but it was not detected in first-screen text.',
    'missing-contact-form': 'WebsiteDocument forms is empty.',
    'missing-cta-button': 'No high-intent CTA wording was detected in buttons or primary links.',
    'weak-cta-wording': 'Generic button/link wording was detected without a clear request, quote, booking, or call action.',
    'missing-testimonials': 'Homepage text does not include testimonial language.',
    'missing-reviews': 'Homepage text does not include review, rating, or star language.',
    'missing-service-area': 'Service area language was not detected in visible text.',
    'missing-emergency-messaging': 'Urgent or emergency service wording was not detected for a relevant industry.',
    'missing-hours': 'Business hours or day-of-week language was not detected.',
    'missing-address': 'WebsiteDocument possibleAddresses is empty.',
    'missing-email': 'WebsiteDocument emails is empty.',
    'broken-navigation': 'Navigation includes placeholder, empty, or incomplete links.',
    'missing-h1': 'WebsiteDocument headings does not include an H1.',
    'duplicate-headings': 'Duplicate heading text was detected.',
    'poor-page-title': 'Page title is missing or outside the recommended length range.',
    'missing-meta-description': 'WebsiteDocument metaDescription is empty.',
    'missing-social-links': 'No common social profile links were detected.',
    'large-image-count': 'WebsiteDocument images count: ' + context.images.length + '.',
    'very-low-text-content': 'Visible text length: ' + context.text.length + ' characters.',
    'missing-about-page': 'Navigation did not include an About page.',
    'missing-services-page': 'Navigation did not include a Services page.',
    'missing-faq': 'Navigation and visible text did not include FAQ language.',
    'missing-privacy-policy': 'Footer/navigation did not include a Privacy Policy link.',
    'missing-terms': 'Footer/navigation did not include Terms or Conditions.',
    'missing-google-map': 'Raw HTML did not include Google Maps references.',
    'missing-google-business-link': 'Raw HTML did not include common Google Business or Google Maps profile links.',
    'missing-trust-badges': 'Visible text did not include common credential, license, guarantee, or certification language.',
    'weak-branding-consistency': 'Image metadata did not include a clear logo or brand signal.',
    'broken-internal-links': 'Internal links include placeholder anchors or incomplete paths.'
  };
  return evidenceMap[ruleId] || 'WebsiteDocument evidence supported this finding.';
}

function evidenceLabelForInspectionIntelligenceRule_(ruleId) {
  if (ruleId.indexOf('phone') !== -1 || ruleId.indexOf('email') !== -1 || ruleId.indexOf('address') !== -1 || ruleId.indexOf('hours') !== -1) {
    return 'Contact accessibility evidence';
  }
  if (ruleId.indexOf('cta') !== -1 || ruleId.indexOf('form') !== -1) {
    return 'Lead capture evidence';
  }
  if (ruleId.indexOf('review') !== -1 || ruleId.indexOf('testimonial') !== -1 || ruleId.indexOf('trust') !== -1) {
    return 'Trust signal evidence';
  }
  if (ruleId.indexOf('title') !== -1 || ruleId.indexOf('meta') !== -1 || ruleId.indexOf('h1') !== -1 || ruleId.indexOf('seo') !== -1) {
    return 'Search visibility evidence';
  }
  return 'WebsiteDocument evidence';
}

function buildInspectionIntelligenceExecutiveSummary_(finding, action) {
  return `${finding} The recommended next step is to ${String(action || '').replace(/\.$/, '').toLowerCase()}.`;
}

function consultantObservationForInspectionCategory_(category, issue) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('contact') !== -1 || value.indexOf('lead') !== -1 || value.indexOf('call') !== -1) {
    return `This likely creates unnecessary friction because customers who are ready to act may not see the fastest next step. ${issue}`;
  }
  if (value.indexOf('trust') !== -1 || value.indexOf('brand') !== -1) {
    return `Customers may hesitate because the page does not show enough confidence-building proof at the decision point. ${issue}`;
  }
  if (value.indexOf('local') !== -1 || value.indexOf('google') !== -1) {
    return `Most local competitors solve this by making location, service area, and proof easier to confirm. ${issue}`;
  }
  if (value.indexOf('navigation') !== -1 || value.indexOf('homepage') !== -1 || value.indexOf('content') !== -1) {
    return `This is usually one of the quickest wins because clearer structure helps customers understand the business faster. ${issue}`;
  }
  return `This finding should be reviewed because it may affect customer trust, clarity, or action. ${issue}`;
}

function customerImpactForInspectionCategory_(category) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('contact') !== -1 || value.indexOf('lead') !== -1 || value.indexOf('call') !== -1) {
    return 'Customers may have to work harder to call, book, request a quote, or ask a question.';
  }
  if (value.indexOf('trust') !== -1 || value.indexOf('brand') !== -1) {
    return 'Customers may feel less certain that the business is credible, active, and safe to contact.';
  }
  if (value.indexOf('local') !== -1 || value.indexOf('google') !== -1) {
    return 'Customers may not quickly confirm whether the business serves their location.';
  }
  if (value.indexOf('navigation') !== -1 || value.indexOf('homepage') !== -1 || value.indexOf('content') !== -1) {
    return 'Customers may need more time to understand the service and decide what to do next.';
  }
  return 'Customers may experience avoidable friction before taking action.';
}

function businessImpactForInspectionCategory_(category) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('contact') !== -1 || value.indexOf('lead') !== -1 || value.indexOf('call') !== -1) {
    return 'Qualified inquiries may be lost when action paths are not visible or convenient.';
  }
  if (value.indexOf('trust') !== -1 || value.indexOf('brand') !== -1) {
    return 'The business may lose comparison shoppers who need proof before contacting.';
  }
  if (value.indexOf('local') !== -1 || value.indexOf('google') !== -1) {
    return 'Local search and customer confidence may be weaker than necessary.';
  }
  if (value.indexOf('performance') !== -1) {
    return 'Slow or heavy pages can reduce engagement, especially on mobile.';
  }
  return 'The website may not convert interested visitors as efficiently as it could.';
}

function revenueImpactForInspectionCategory_(category) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('lead') !== -1 || value.indexOf('contact') !== -1 || value.indexOf('call') !== -1) {
    return 'Fewer calls, quote requests, bookings, or form submissions from visitors already evaluating the business.';
  }
  if (value.indexOf('local') !== -1 || value.indexOf('google') !== -1) {
    return 'Missed local discovery opportunities from customers searching nearby.';
  }
  return 'Lower conversion from visitors who may otherwise become qualified opportunities.';
}

function trustImpactForInspectionCategory_(category) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('trust') !== -1 || value.indexOf('security') !== -1 || value.indexOf('brand') !== -1) {
    return 'Reduced confidence before the customer decides to contact the business.';
  }
  return 'Small points of uncertainty may reduce confidence during the decision process.';
}

function defaultInspectionIntelligenceAction_(category) {
  const value = String(category || '').toLowerCase();
  if (value.indexOf('contact') !== -1) {
    return 'Make phone, email, form, address, and hours easier to find.';
  }
  if (value.indexOf('trust') !== -1) {
    return 'Add visible reviews, testimonials, proof points, credentials, or guarantees.';
  }
  if (value.indexOf('local') !== -1) {
    return 'Clarify service area, location, and local search signals.';
  }
  return 'Improve the customer path with clearer content and next steps.';
}

function priorityForInspectionIntelligenceSeverity_(severity) {
  const value = normalizeInspectionIntelligenceSeverity_(severity);
  if (value === 'Critical') {
    return 'P0 Immediate';
  }
  if (value === 'High') {
    return 'P1 High';
  }
  if (value === 'Medium') {
    return 'P2 Normal';
  }
  return 'P3 Future';
}

function effortForInspectionIntelligenceRule_(ruleId) {
  const lowEffort = ['missing-phone-number', 'phone-only-in-footer', 'missing-email', 'missing-hours', 'missing-meta-description', 'missing-social-links', 'missing-google-business-link'];
  return lowEffort.indexOf(ruleId) !== -1 ? 'Low' : 'Medium';
}

function roiForInspectionIntelligenceRule_(ruleId, severity) {
  if (String(severity || '').toLowerCase() === 'high') {
    return 'High';
  }
  const highRoi = ['missing-contact-form', 'missing-cta-button', 'missing-phone-number', 'missing-services-page', 'missing-h1'];
  return highRoi.indexOf(ruleId) !== -1 ? 'High' : 'Medium';
}

function normalizeInspectionIntelligenceSeverity_(severity) {
  const value = String(severity || '').toLowerCase();
  if (value === 'critical') {
    return 'Critical';
  }
  if (value === 'high') {
    return 'High';
  }
  if (value === 'low') {
    return 'Low';
  }
  if (value === 'info') {
    return 'Info';
  }
  return 'Medium';
}

function normalizeInspectionIntelligenceConfidence_(value, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numeric));
}

function hasInspectionIntelligenceCta_(context) {
  const ctaTerms = ['quote', 'estimate', 'schedule', 'book', 'call', 'contact', 'request', 'start', 'consultation', 'appointment', 'service'];
  const buttonText = context.buttons.map(function(button) {
    return button.text;
  }).join(' ');
  const linkText = context.links.slice(0, 60).map(function(link) {
    return link.text;
  }).join(' ');
  return textIncludesAny_(normalizeInspectionIntelligenceText_([buttonText, linkText, context.firstScreenText].join(' ')), ctaTerms);
}

function hasInspectionIntelligenceWeakCta_(context) {
  const genericTerms = ['learn more', 'read more', 'click here', 'more info'];
  const strongTerms = ['quote', 'estimate', 'schedule', 'book', 'call', 'contact', 'request', 'appointment'];
  const buttonText = normalizeInspectionIntelligenceText_(context.buttons.map(function(button) {
    return button.text;
  }).join(' '));
  return textIncludesAny_(buttonText, genericTerms) && !textIncludesAny_(buttonText, strongTerms);
}

function hasInspectionIntelligencePage_(context, terms) {
  const values = context.links.concat(context.navigationLinks).concat(context.footerLinks).map(function(link) {
    return [link.text, link.href, link.url].join(' ');
  }).join(' ');
  return textIncludesAny_(normalizeInspectionIntelligenceText_(values + ' ' + context.text), terms);
}

function hasInspectionIntelligenceSocialLink_(context) {
  const values = context.links.map(function(link) {
    return [link.href, link.url, link.text].join(' ');
  }).join(' ').toLowerCase();
  return textIncludesAny_(values, ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'x.com', 'twitter.com', 'tiktok.com']);
}

function hasInspectionIntelligenceLogoSignal_(context) {
  const values = context.images.map(function(image) {
    return [image.alt, image.title, image.src, image.url, image.className, image.id].join(' ');
  }).join(' ');
  const needles = ['logo'];
  const company = normalizeInspectionIntelligenceText_(context.prospect.company);
  if (company) {
    needles.push(company);
  }
  return textIncludesAny_(normalizeInspectionIntelligenceText_(values), needles);
}

function hasDuplicateInspectionIntelligenceHeadings_(context) {
  const seen = {};
  for (let index = 0; index < context.headings.length; index += 1) {
    const text = normalizeInspectionIntelligenceText_(context.headings[index].text);
    if (!text || text.length < 8) {
      continue;
    }
    if (seen[text]) {
      return true;
    }
    seen[text] = true;
  }
  return false;
}

function hasInspectionIntelligenceBrokenLinks_(context) {
  return context.navigationLinks.some(function(link) {
    const href = String(link.href || link.url || '').trim().toLowerCase();
    return !href || href === '#' || href === '/' || href.indexOf('javascript:') === 0;
  });
}

function hasInspectionIntelligenceBrokenInternalLinks_(context) {
  return context.links.some(function(link) {
    const href = String(link.href || '').trim().toLowerCase();
    return href === '#' || href === '' || href.indexOf('/#') === 0 || href.indexOf('todo') !== -1;
  });
}

function isEmergencyRelevantIndustry_(prospect) {
  const text = normalizeInspectionIntelligenceText_([prospect && prospect.industry, prospect && prospect.offerService, prospect && prospect.notes].join(' '));
  return textIncludesAny_(text, ['roof', 'plumb', 'hvac', 'electric', 'restoration', 'repair', 'auto', 'locksmith', 'medical', 'dental']);
}

function parseInspectionIntelligenceObject_(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function normalizeInspectionIntelligenceArray_(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function normalizeInspectionIntelligenceText_(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function firstInspectionIntelligenceValue_(values, fallback) {
  for (let index = 0; index < values.length; index += 1) {
    const value = String(values[index] || '').trim();
    if (value) {
      return value;
    }
  }
  return fallback || '';
}
