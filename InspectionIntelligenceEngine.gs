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
    addInspectionIntelligenceFinding_(findings, seen, finding, context);
  });

  getInspectionIntelligenceRules_().forEach(function(rule) {
    if (findings.length >= 8) {
      return;
    }
    if (rule.detect(context)) {
      addInspectionIntelligenceFinding_(findings, seen, createInspectionIntelligenceFinding_(rule, context), context);
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
      source: 'InspectionResult',
      metadata: {
        ruleId: sourceFinding.ruleId || (sourceFinding.metadata && sourceFinding.metadata.ruleId) || '',
        ruleVersion: sourceFinding.ruleVersion || (sourceFinding.metadata && sourceFinding.metadata.ruleVersion) || '',
        expectedEvidence: sourceFinding.expectedEvidence || [],
        tags: sourceFinding.tags || []
      }
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
      version: definition.version || '',
      title: definition.title || '',
      description: definition.description || ''
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
    typicalIndustryBestPractice: '',
    whyThisMatters: '',
    visibilityImpact: '',
    talkingPoints: [],
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

function addInspectionIntelligenceFinding_(findings, seen, finding, context) {
  if (!finding) {
    return;
  }
  const enrichedFinding = enrichInspectionIntelligenceFinding_(finding, context || {});
  const key = [
    String(enrichedFinding.category || '').toLowerCase(),
    String(enrichedFinding.businessLanguage || enrichedFinding.consultantObservation || '').toLowerCase()
  ].join('|');
  if (seen[key]) {
    return;
  }
  seen[key] = true;
  findings.push(enrichedFinding);
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

function enrichInspectionIntelligenceFinding_(finding, context) {
  const result = finding || {};
  const normalizedContext = context || {};
  const ruleId = result.findingId
    ? String(result.findingId).replace(/^intel-/, '')
    : (result.metadata && result.metadata.ruleId) || result.ruleId || '';
  const rule = getInspectionRuleDefinition_(ruleId) || {};
  const template = getInspectionConsultantTemplate_(ruleId, result.category);
  const industryProfile = getInspectionIndustryProfile_(normalizedContext.prospect || {});
  const issue = firstInspectionIntelligenceValue_([
    result.businessLanguage,
    result.consultantObservation,
    rule.title,
    result.supportingEvidence
  ], 'A customer-facing website improvement was identified.');
  const action = firstInspectionIntelligenceValue_([
    result.recommendedAction,
    rule.recommendedAction,
    defaultInspectionIntelligenceAction_(result.category)
  ], 'Improve the customer path so the next step is easier to understand and act on.');

  const whyThisMatters = buildInspectionWhyThisMatters_(issue, result, rule, template, industryProfile);
  const businessImpact = buildInspectionBusinessImpact_(result, rule, template, industryProfile);
  const customerImpact = buildInspectionCustomerImpact_(result, rule, template, industryProfile);
  const revenueOpportunity = buildInspectionRevenueOpportunity_(result, template, industryProfile);
  const trustImpact = buildInspectionTrustImpact_(result, template, industryProfile);
  const visibilityImpact = buildInspectionVisibilityImpact_(result, template, industryProfile);
  const bestPractice = buildInspectionBestPractice_(result, template, industryProfile);
  const talkingPoints = buildInspectionDiscoveryTalkingPoints_(issue, action, result, template, industryProfile);

  result.executiveSummary = buildInspectionExecutiveSummary_(issue, action, result, template, industryProfile);
  result.whyThisMatters = whyThisMatters;
  result.whyThisMattersNarrative = whyThisMatters;
  result.businessImpact = businessImpact;
  result.customerImpact = customerImpact;
  result.customerExperienceImpact = customerImpact;
  result.revenueOpportunity = revenueOpportunity;
  result.trustImpact = trustImpact;
  result.visibilityImpact = visibilityImpact;
  result.typicalIndustryBestPractice = bestPractice;
  result.recommendedAction = action;
  result.priority = result.priority || rule.priority || priorityForInspectionIntelligenceSeverity_(result.severity);
  result.estimatedEffort = result.estimatedEffort || rule.estimatedEffort || effortForInspectionIntelligenceRule_(ruleId);
  result.estimatedRoi = result.estimatedRoi || result.expectedROI || rule.expectedROI || roiForInspectionIntelligenceRule_(ruleId, result.severity);
  result.expectedROI = result.expectedROI || result.estimatedRoi;
  result.talkingPoints = talkingPoints;
  result.discoveryMeetingTalkingPoints = talkingPoints;
  result.consultantObservation = buildInspectionConsultantObservation_(issue, result, template, industryProfile);
  result.metadata = result.metadata || {};
  result.metadata.industryProfile = industryProfile.key;
  result.metadata.enrichmentVersion = '1.0';
  return result;
}

function getInspectionConsultantTemplate_(ruleId, category) {
  const templates = getInspectionConsultantTemplates_();
  const normalizedRuleId = normalizeInspectionRuleId_(ruleId);
  if (templates[normalizedRuleId]) {
    return templates[normalizedRuleId];
  }

  const normalizedCategory = normalizeInspectionIntelligenceText_(category);
  if (normalizedCategory.indexOf('contact') !== -1 || normalizedCategory.indexOf('lead') !== -1) {
    return templates.contactPath;
  }
  if (normalizedCategory.indexOf('trust') !== -1 || normalizedCategory.indexOf('review') !== -1 || normalizedCategory.indexOf('brand') !== -1) {
    return templates.trustSignals;
  }
  if (normalizedCategory.indexOf('local') !== -1 || normalizedCategory.indexOf('google') !== -1) {
    return templates.localVisibility;
  }
  if (normalizedCategory.indexOf('navigation') !== -1 || normalizedCategory.indexOf('homepage') !== -1 || normalizedCategory.indexOf('content') !== -1) {
    return templates.clarity;
  }
  return templates.general;
}

function getInspectionConsultantTemplates_() {
  return {
    contactPath: {
      businessImpact: 'Qualified inquiries may be lost when ready-to-act visitors cannot find a clear contact path quickly.',
      customerImpact: 'Customers may have to work harder than expected to call, request help, book, or ask a question.',
      revenueOpportunity: 'Improving this path can increase calls, quote requests, appointment requests, and other high-intent inquiries from existing website traffic.',
      trustImpact: 'Clear contact details make the business feel accessible, active, and easier to trust.',
      visibilityImpact: 'Consistent contact details also support local confidence when customers compare options across search, maps, and the website.',
      bestPractice: 'Most strong local service websites keep phone, form, hours, and location or service-area details visible in the header, footer, and contact path.',
      consultantLead: 'This is a customer-action issue, not just a website detail.'
    },
    'missing-phone-number': {
      consultantLead: 'Customers who are ready to call should not have to search for the phone number.',
      bestPractice: 'For local service businesses, the primary phone number should appear in the header, footer, and contact section, with mobile click-to-call support.'
    },
    'phone-only-in-footer': {
      consultantLead: 'Customers looking for urgent help often decide within seconds whether to call or leave.',
      bestPractice: 'High-performing local service pages show the primary phone number or call option in the first screen on desktop and mobile.'
    },
    'phone-below-first-screen': {
      consultantLead: 'Customers looking for urgent help often decide within seconds whether to call or leave.',
      bestPractice: 'High-performing local service pages show the primary phone number or call option in the first screen on desktop and mobile.'
    },
    'missing-contact-form': {
      consultantLead: 'Not every qualified customer wants to call immediately.',
      bestPractice: 'A strong lead-generation website offers both a direct call path and a short request form for customers who prefer to submit details online.'
    },
    'missing-cta-button': {
      consultantLead: 'A visitor can understand the business and still leave if the next step is not obvious.',
      bestPractice: 'The first screen should include one primary action tied to business value, such as Request a Quote, Schedule Service, Book an Appointment, or Call Today.'
    },
    'weak-cta-wording': {
      consultantLead: 'Generic calls to action create hesitation at the exact moment a visitor is deciding what to do.',
      bestPractice: 'CTA wording should match the customer intent: call, schedule, book, request a quote, or start a consultation.'
    },
    trustSignals: {
      businessImpact: 'The business may lose comparison shoppers who need proof before contacting.',
      customerImpact: 'Customers may feel less certain that the business is credible, active, and safe to contact.',
      revenueOpportunity: 'Better trust signals can improve conversion from visitors who are already comparing providers.',
      trustImpact: 'Visible proof reduces hesitation and makes the business feel more established.',
      visibilityImpact: 'Trust content can reinforce local relevance when it includes reviews, project proof, credentials, or community signals.',
      bestPractice: 'Strong local websites surface reviews, testimonials, credentials, guarantees, and proof points near key decision points.',
      consultantLead: 'This is a confidence issue in the customer decision path.'
    },
    'missing-reviews': {
      consultantLead: 'Reviews often do the trust-building work before a customer ever calls.',
      bestPractice: 'Local businesses should feature recent review snippets, ratings, or a clear path to verified reviews near high-intent sections.'
    },
    'missing-testimonials': {
      consultantLead: 'Customers want proof from people who have already used the business.',
      bestPractice: 'Testimonials should be placed close to service descriptions, contact prompts, or other decision points.'
    },
    localVisibility: {
      businessImpact: 'Local search and customer confidence may be weaker when location, service area, or local proof is unclear.',
      customerImpact: 'Customers may not quickly confirm whether the business serves their location.',
      revenueOpportunity: 'Clearer local signals can help convert nearby searchers and reduce mismatched inquiries.',
      trustImpact: 'Location clarity makes the business feel more real, reachable, and relevant.',
      visibilityImpact: 'Local relevance improves when website copy, page titles, service areas, and Google Business signals tell the same story.',
      bestPractice: 'Strong local websites clearly state the primary service area, location signals, and service categories in plain English.',
      consultantLead: 'This is a local relevance issue.'
    },
    clarity: {
      businessImpact: 'The website may be asking visitors to work too hard to understand the offer, proof, or next step.',
      customerImpact: 'Customers may need more time to understand whether the business can help them.',
      revenueOpportunity: 'Clearer structure can improve conversion by reducing confusion before the customer leaves.',
      trustImpact: 'A clear, organized website makes the business feel more professional and easier to evaluate.',
      visibilityImpact: 'Clear headings, service pages, and page metadata also help search engines understand the business.',
      bestPractice: 'A strong first impression explains what the business does, who it serves, why it can be trusted, and what the customer should do next.',
      consultantLead: 'This is a clarity and first-impression issue.'
    },
    general: {
      businessImpact: 'The website may not convert interested visitors as efficiently as it could.',
      customerImpact: 'Customers may experience avoidable friction before taking action.',
      revenueOpportunity: 'Improving this item can help turn more existing visitors into qualified opportunities.',
      trustImpact: 'Reducing uncertainty helps customers feel more confident choosing the business.',
      visibilityImpact: 'Clearer, more complete website signals can support stronger digital presence over time.',
      bestPractice: 'The strongest business websites make the offer, proof, and next step easy to understand without extra effort.',
      consultantLead: 'This is a practical customer-experience improvement.'
    }
  };
}

function getInspectionIndustryProfile_(prospect) {
  const text = normalizeInspectionIntelligenceText_([
    prospect && prospect.industry,
    prospect && prospect.offerService,
    prospect && prospect.notes,
    prospect && prospect.summary
  ].join(' '));
  const profiles = getInspectionIndustryProfiles_();
  for (let index = 0; index < profiles.length; index += 1) {
    if (textIncludesAny_(text, profiles[index].terms)) {
      return profiles[index];
    }
  }
  return {
    key: 'general',
    label: 'local business',
    customerAction: 'contact the business',
    urgency: 'customers are comparing options and deciding who to trust',
    proof: 'reviews, proof points, service details, and clear contact paths'
  };
}

function getInspectionIndustryProfiles_() {
  return [
    {
      key: 'hvac',
      label: 'HVAC',
      terms: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace'],
      customerAction: 'schedule service or request emergency help',
      urgency: 'customers often need help quickly when comfort, heat, or cooling is disrupted',
      proof: 'reviews, emergency availability, service-area clarity, financing, certifications, and phone visibility'
    },
    {
      key: 'roofing',
      label: 'roofing',
      terms: ['roof', 'roofing', 'gutter', 'storm damage'],
      customerAction: 'request an estimate or inspection',
      urgency: 'homeowners often compare several contractors before trusting one with a major property decision',
      proof: 'reviews, project photos, licenses, warranties, service-area clarity, and estimate request paths'
    },
    {
      key: 'medical',
      label: 'medical',
      terms: ['medical', 'clinic', 'doctor', 'physician', 'healthcare', 'urgent care'],
      customerAction: 'book an appointment or call the office',
      urgency: 'patients need confidence, clarity, and a low-friction appointment path',
      proof: 'provider credentials, patient reviews, accepted insurance, location, hours, and appointment options'
    },
    {
      key: 'dental',
      label: 'dental',
      terms: ['dental', 'dentist', 'orthodont', 'teeth', 'oral'],
      customerAction: 'request an appointment',
      urgency: 'patients often choose the practice that feels trustworthy, convenient, and easy to contact',
      proof: 'patient reviews, credentials, before/after proof, insurance information, hours, and appointment CTAs'
    },
    {
      key: 'restaurant',
      label: 'restaurant',
      terms: ['restaurant', 'cafe', 'coffee', 'bar', 'food', 'menu', 'dining'],
      customerAction: 'view the menu, call, order, or visit',
      urgency: 'customers make quick decisions based on menu clarity, hours, reviews, location, and visual confidence',
      proof: 'menu access, hours, location, reviews, photos, online ordering, and social proof'
    },
    {
      key: 'legal',
      label: 'legal',
      terms: ['legal', 'law', 'attorney', 'lawyer', 'firm'],
      customerAction: 'request a consultation',
      urgency: 'potential clients need trust, discretion, credibility, and a clear consultation path',
      proof: 'practice areas, attorney credentials, reviews, consultation CTAs, case experience, and trust language'
    },
    {
      key: 'plumbing',
      label: 'plumbing',
      terms: ['plumb', 'drain', 'water heater', 'pipe'],
      customerAction: 'call or schedule service',
      urgency: 'customers may be dealing with urgent home problems and often choose the fastest credible option',
      proof: 'phone visibility, emergency messaging, service-area clarity, reviews, licenses, and schedule options'
    },
    {
      key: 'fitness',
      label: 'fitness',
      terms: ['fitness', 'gym', 'training', 'personal trainer', 'wellness'],
      customerAction: 'book a visit, trial, or consultation',
      urgency: 'customers need to understand the offer, atmosphere, proof, and first step before committing',
      proof: 'program clarity, testimonials, photos, pricing or trial options, location, and booking CTAs'
    }
  ];
}

function buildInspectionExecutiveSummary_(issue, action, finding, template, industryProfile) {
  return `${issue} For a ${industryProfile.label} business, this matters because ${industryProfile.urgency}. ${action}`;
}

function buildInspectionWhyThisMatters_(issue, finding, rule, template, industryProfile) {
  return `${template.consultantLead || 'This item affects the customer decision path'} For a ${industryProfile.label} business, ${industryProfile.urgency}. ${issue}`;
}

function buildInspectionBusinessImpact_(finding, rule, template, industryProfile) {
  return firstInspectionIntelligenceValue_([
    finding.businessImpact,
    rule.businessReason,
    template.businessImpact
  ], `This can affect how many qualified customers ${industryProfile.customerAction}.`);
}

function buildInspectionCustomerImpact_(finding, rule, template, industryProfile) {
  return firstInspectionIntelligenceValue_([
    finding.customerImpact,
    rule.customerReason,
    template.customerImpact
  ], `Customers may have a harder time deciding whether to ${industryProfile.customerAction}.`);
}

function buildInspectionRevenueOpportunity_(finding, template, industryProfile) {
  return firstInspectionIntelligenceValue_([
    finding.revenueOpportunity,
    template.revenueOpportunity
  ], `The opportunity is to convert more existing visitors into people who ${industryProfile.customerAction}.`);
}

function buildInspectionTrustImpact_(finding, template, industryProfile) {
  return firstInspectionIntelligenceValue_([
    finding.trustImpact,
    template.trustImpact
  ], `This can weaken confidence because customers expect to see ${industryProfile.proof}.`);
}

function buildInspectionVisibilityImpact_(finding, template, industryProfile) {
  return firstInspectionIntelligenceValue_([
    finding.visibilityImpact,
    template.visibilityImpact
  ], 'This can weaken the signals customers and search engines use to understand the business.');
}

function buildInspectionBestPractice_(finding, template, industryProfile) {
  return `${template.bestPractice || 'Strong websites make the offer, proof, and next step easy to understand.'} In ${industryProfile.label}, this usually means showing ${industryProfile.proof}.`;
}

function buildInspectionConsultantObservation_(issue, finding, template, industryProfile) {
  return `${template.consultantLead || 'This is a practical customer-experience improvement'} ${issue} The key question for the discovery meeting is whether this friction shows up in real customer behavior, such as fewer calls, weaker quote requests, or confusion about the next step.`;
}

function buildInspectionDiscoveryTalkingPoints_(issue, action, finding, template, industryProfile) {
  return [
    `Ask whether customers usually ${industryProfile.customerAction}, and which path matters most right now.`,
    `Confirm whether the owner has heard customer confusion related to this issue: ${issue}`,
    `Frame the recommendation around business outcomes: more leads, stronger trust, clearer visibility, and less customer friction.`,
    `Discuss the simplest first improvement: ${String(action || '').replace(/\.$/, '')}.`
  ];
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
