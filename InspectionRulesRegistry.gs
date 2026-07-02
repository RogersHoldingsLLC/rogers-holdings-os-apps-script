/**
 * Rogers Holdings OS - InspectionRulesRegistry.
 * Central source of truth for inspection rule metadata.
 *
 * This registry does not execute detection logic. Inspectors keep their current
 * detection predicates and use this module for consistent metadata, business
 * language, evidence expectations, and future rule governance.
 */

function getInspectionRulesRegistry_() {
  const grouped = {};
  getInspectionRulesRegistryCategories_().forEach(function(category) {
    grouped[category] = [];
  });
  getInspectionRuleDefinitions_().forEach(function(rule) {
    const category = rule.category || 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(copyInspectionRuleDefinition_(rule));
  });
  return grouped;
}

function getInspectionRulesRegistryCategories_() {
  return [
    'Homepage',
    'Navigation',
    'Contact Information',
    'Calls To Action',
    'Trust Signals',
    'Reviews',
    'Google Business',
    'Local SEO',
    'Performance',
    'Accessibility',
    'Brand Consistency',
    'Lead Generation',
    'Content Quality',
    'Analytics',
    'Security',
    'Mobile Experience'
  ];
}

function getInspectionRuleDefinition_(ruleId) {
  const normalized = normalizeInspectionRuleId_(ruleId);
  const rules = getInspectionRuleDefinitions_();
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const aliases = (rule.aliases || []).map(normalizeInspectionRuleId_);
    if (normalizeInspectionRuleId_(rule.ruleId) === normalized || aliases.indexOf(normalized) !== -1) {
      return copyInspectionRuleDefinition_(rule);
    }
  }
  return null;
}

function getInspectionRulesByCategory_(category) {
  const normalized = String(category || '').toLowerCase();
  return getInspectionRuleDefinitions_().filter(function(rule) {
    return String(rule.category || '').toLowerCase() === normalized;
  }).map(copyInspectionRuleDefinition_);
}

function flattenInspectionRulesRegistry_() {
  return getInspectionRuleDefinitions_().map(copyInspectionRuleDefinition_);
}

function mergeInspectionRuleMetadata_(target, ruleId) {
  const targetRule = target || {};
  const definition = getInspectionRuleDefinition_(ruleId || targetRule.ruleId || targetRule.id || targetRule.key);
  if (!definition) {
    return targetRule;
  }

  if (!targetRule.ruleId) targetRule.ruleId = definition.ruleId;
  if (!targetRule.category) targetRule.category = definition.category;
  if (!targetRule.severity) targetRule.severity = definition.severity;
  if (!targetRule.priority) targetRule.priority = definition.priority;
  if (targetRule.enabled === undefined) targetRule.enabled = definition.enabled;
  if (!targetRule.minimumConfidence) targetRule.minimumConfidence = definition.minimumConfidence;
  if (!targetRule.expectedEvidence) targetRule.expectedEvidence = definition.expectedEvidence;
  if (!targetRule.businessReason) targetRule.businessReason = definition.businessReason;
  if (!targetRule.customerReason) targetRule.customerReason = definition.customerReason;
  if (!targetRule.recommendedAction) targetRule.recommendedAction = definition.recommendedAction;
  if (!targetRule.estimatedEffort) targetRule.estimatedEffort = definition.estimatedEffort;
  if (!targetRule.expectedROI && !targetRule.expectedRoi) targetRule.expectedROI = definition.expectedROI;
  if (!targetRule.tags) targetRule.tags = definition.tags;
  if (!targetRule.version) targetRule.version = definition.version;
  return targetRule;
}

function normalizeInspectionRuleId_(ruleId) {
  return String(ruleId || '').trim().toLowerCase().replace(/_/g, '-');
}

function copyInspectionRuleDefinition_(rule) {
  return JSON.parse(JSON.stringify(rule || {}));
}

function getInspectionRuleDefinitions_() {
  return [
    inspectionRuleDefinition_({
      ruleId: 'missing-phone-number',
      aliases: ['phone-present'],
      category: 'Contact Information',
      title: 'Phone number was not detected on the website.',
      description: 'The inspection did not find a phone number in the supplied website content.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.phoneNumbers', 'homepage text', 'tel links'],
      businessReason: 'Ready-to-call customers may not have a fast path to contact the business.',
      customerReason: 'Customers who prefer calling may leave or choose another business if a number is not easy to find.',
      recommendedAction: 'Add a clearly visible phone number to the website header, footer, and contact section.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['contact', 'phone', 'lead-capture', 'local-business']
    }),
    inspectionRuleDefinition_({
      ruleId: 'phone-below-first-screen',
      aliases: ['phone-above-fold', 'phone-only-in-footer'],
      category: 'Contact Information',
      title: 'Phone number was not detected above the fold.',
      description: 'A phone number exists, but it was not detected in the first-screen or header content.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['aboveFoldText', 'headerText', 'WebsiteDocument.phoneNumbers'],
      businessReason: 'High-intent visitors may not see the fastest contact option at the moment they are deciding what to do next.',
      customerReason: 'Customers may need to scroll or search before they can call.',
      recommendedAction: 'Place the primary phone number in the top header or first visible section on desktop and mobile.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['contact', 'phone', 'above-the-fold', 'conversion']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-click-to-call',
      aliases: ['click-to-call'],
      category: 'Contact Information',
      title: 'Click-to-call link was not detected.',
      description: 'A phone number exists, but a tel: click-to-call link was not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.links', 'tel links'],
      businessReason: 'Mobile visitors may have to manually copy or retype the number, reducing call conversion.',
      customerReason: 'Customers on mobile may experience unnecessary friction when trying to call.',
      recommendedAction: 'Wrap visible phone numbers with tel: links so mobile customers can tap to call.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['contact', 'mobile', 'phone', 'conversion']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-email',
      aliases: ['email-address'],
      category: 'Contact Information',
      title: 'Email address was not detected on the website.',
      description: 'The inspection did not find an email address in the supplied website content.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.emails', 'homepage text'],
      businessReason: 'Some customers, vendors, or partners may not have a written contact path.',
      customerReason: 'Customers who prefer email may be forced into a form or may not contact the business.',
      recommendedAction: 'Add a monitored business email address or clear written contact option.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['contact', 'email', 'secondary-contact']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-contact-page',
      aliases: ['contact-page'],
      category: 'Navigation',
      title: 'Contact page link was not detected.',
      description: 'The website links did not include a clear Contact page link.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.links', 'navigation links'],
      businessReason: 'Customers may not know where to find full contact details, directions, or inquiry options.',
      customerReason: 'Customers may need to hunt through the site to contact the business.',
      recommendedAction: 'Add a clear Contact page link in the main navigation and footer.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['navigation', 'contact', 'customer-path']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-contact-form',
      aliases: ['contact-form'],
      category: 'Lead Generation',
      title: 'Contact form was not detected.',
      description: 'No contact, quote, booking, or request form was detected.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.forms', 'form labels', 'form actions'],
      businessReason: 'Customers who prefer requesting help online may not have a simple lead capture path.',
      customerReason: 'Customers may be forced to call even when they prefer submitting details online.',
      recommendedAction: 'Add a short contact or request form with name, contact method, service need, and message fields.',
      estimatedEffort: 'Medium',
      expectedROI: 'High',
      tags: ['lead-capture', 'forms', 'conversion']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-hours',
      aliases: ['business-hours'],
      category: 'Contact Information',
      title: 'Business hours were not detected.',
      description: 'Visible business hours were not detected in the website content.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['visible text', 'footer text', 'contact section'],
      businessReason: 'Customers may hesitate if they cannot tell when the business is available.',
      customerReason: 'Customers may not know whether to call now, wait, or choose another provider.',
      recommendedAction: 'Add clear business hours near contact details and on the Contact page.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['contact', 'hours', 'local-business']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-address',
      aliases: ['physical-address'],
      category: 'Contact Information',
      title: 'Physical address was not detected.',
      description: 'A street-style address or clear location detail was not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.possibleAddresses', 'visible text', 'footer text'],
      businessReason: 'Local trust and map confidence may be weaker without a clear address or service-area explanation.',
      customerReason: 'Customers may be unsure where the business operates or whether it serves their area.',
      recommendedAction: 'Add a physical address or clear service-area statement near contact details.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['contact', 'address', 'local-seo', 'trust']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-footer-contact-info',
      aliases: ['footer-contact-info'],
      category: 'Contact Information',
      title: 'Footer contact information was not detected.',
      description: 'Contact information exists somewhere, but not in the footer content.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['footerText', 'WebsiteDocument.footerLinks'],
      businessReason: 'Visitors who scroll to the bottom may not find an expected contact option.',
      customerReason: 'Customers may miss a standard place where contact details are normally available.',
      recommendedAction: 'Add phone, email or contact page link, hours, and service-area/location details to the footer.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['contact', 'footer', 'customer-path']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-header-contact-info',
      aliases: ['header-contact-info'],
      category: 'Contact Information',
      title: 'Header contact information was not detected.',
      description: 'Contact information exists somewhere, but not in the header content.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['headerText', 'aboveFoldText'],
      businessReason: 'High-intent visitors may not see a quick action path when they first arrive.',
      customerReason: 'Customers may need to search before they can contact the business.',
      recommendedAction: 'Add the primary phone number or Contact/Request action to the website header.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['contact', 'header', 'above-the-fold', 'conversion']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-cta-button',
      category: 'Calls To Action',
      title: 'No clear call-to-action button appears before scrolling.',
      description: 'No high-intent call-to-action was detected in buttons, links, or first-screen content.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.buttons', 'WebsiteDocument.links', 'firstScreenText'],
      businessReason: 'Visitors may understand the business but still not know the next step to take.',
      customerReason: 'Customers may have to decide on their own whether to call, book, request, or keep browsing.',
      recommendedAction: 'Add a primary button such as Request a Quote, Schedule Service, Book Now, or Call Today near the top of the homepage.',
      estimatedEffort: 'Medium',
      expectedROI: 'High',
      tags: ['cta', 'conversion', 'homepage', 'lead-capture']
    }),
    inspectionRuleDefinition_({
      ruleId: 'weak-cta-wording',
      category: 'Calls To Action',
      title: 'The visible call-to-action wording appears generic.',
      description: 'Generic button or link wording was detected without a clear request, quote, booking, or call action.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.buttons', 'WebsiteDocument.links'],
      businessReason: 'Generic actions like Learn More can create friction when customers are ready to call, book, or request help.',
      customerReason: 'Customers may not immediately understand which action gets them closer to help.',
      recommendedAction: 'Use action-specific wording tied to the desired customer step.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['cta', 'copywriting', 'conversion']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-reviews',
      category: 'Reviews',
      title: 'No customer reviews were found anywhere on the homepage.',
      description: 'Review, rating, star, or Google rating language was not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['visible text', 'homepage text', 'review links'],
      businessReason: 'Visitors comparing local options may not see enough social proof before deciding who to contact.',
      customerReason: 'Customers may have less confidence that other people trust the business.',
      recommendedAction: 'Feature review snippets, ratings, or a link to verified customer reviews.',
      estimatedEffort: 'Medium',
      expectedROI: 'High',
      tags: ['reviews', 'trust', 'social-proof']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-testimonials',
      category: 'Trust Signals',
      title: 'No customer testimonials were found on the homepage.',
      description: 'Testimonial language was not detected in homepage content.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['visible text', 'homepage text'],
      businessReason: 'Customers may have less proof that other people trust the business.',
      customerReason: 'Customers may need more reassurance before contacting.',
      recommendedAction: 'Add a short testimonial or customer proof section near the homepage decision path.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['testimonials', 'trust', 'homepage']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-service-area',
      category: 'Local SEO',
      title: 'The service area is not clearly visible on the website.',
      description: 'Service area, serving, county, region, or local service wording was not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['visible text', 'homepage text', 'prospect city/state'],
      businessReason: 'Local visibility and customer fit may be weaker if visitors cannot confirm the service area.',
      customerReason: 'Local customers may not know whether the business serves their location.',
      recommendedAction: 'Add clear city, state, and service area language near the homepage and contact areas.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['local-seo', 'service-area', 'local-business']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-emergency-messaging',
      category: 'Content Quality',
      title: 'Emergency or urgent-service messaging was not detected.',
      description: 'Urgent, emergency, 24/7, or same-day language was not detected for an industry where it may matter.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['visible text', 'industry context'],
      businessReason: 'Customers with immediate needs may not know whether the business can respond quickly.',
      customerReason: 'Urgent customers may choose another provider if response timing is unclear.',
      recommendedAction: 'Add appropriate emergency, same-day, or urgent-service messaging if the business offers it.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['content', 'urgent-service', 'industry-specific']
    }),
    inspectionRuleDefinition_({
      ruleId: 'broken-navigation',
      category: 'Navigation',
      title: 'One or more internal navigation links appear incomplete or broken.',
      description: 'Navigation includes placeholder, empty, or incomplete links.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.links', 'navigationLinks'],
      businessReason: 'Customers may hit dead ends while trying to learn about services or contact the business.',
      customerReason: 'Customers may lose confidence if important links do not work.',
      recommendedAction: 'Review navigation links and fix empty, placeholder, or broken internal paths.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['navigation', 'broken-links', 'quality']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-h1',
      category: 'Homepage',
      title: 'No H1 heading describing the primary service was detected.',
      description: 'The heading structure did not include a clear H1.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.headings'],
      businessReason: 'The homepage may not immediately communicate what the business does to customers or search engines.',
      customerReason: 'Customers may need extra time to understand the primary service.',
      recommendedAction: 'Add one clear H1 that describes the primary service and location focus.',
      estimatedEffort: 'Low',
      expectedROI: 'High',
      tags: ['homepage', 'seo', 'headings', 'clarity']
    }),
    inspectionRuleDefinition_({
      ruleId: 'poor-page-title',
      category: 'Local SEO',
      title: 'The page title appears missing, too short, or too long.',
      description: 'The page title is missing or outside the recommended length range.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.pageTitle'],
      businessReason: 'Search results may not clearly explain the business or service before customers click.',
      customerReason: 'Customers may not understand from search results why this business is relevant.',
      recommendedAction: 'Rewrite the page title to include the business, primary service, and local relevance.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['local-seo', 'page-title', 'search']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-meta-description',
      category: 'Local SEO',
      title: 'No meta description was detected.',
      description: 'The WebsiteDocument metaDescription field was empty.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.metaDescription'],
      businessReason: 'Search visibility and click-through may be limited because the page lacks a clear summary.',
      customerReason: 'Customers may not see a clear reason to click from search results.',
      recommendedAction: 'Add a concise meta description that explains the service, location, and customer next step.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['local-seo', 'meta-description', 'search']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-social-links',
      category: 'Trust Signals',
      title: 'No social profile links were detected.',
      description: 'No common social profile links were detected in the website links.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.links'],
      businessReason: 'Some customers may look for additional proof before contacting a business.',
      customerReason: 'Customers may have fewer ways to verify the business outside the website.',
      recommendedAction: 'Add relevant social or business profile links if they are active and professional.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['trust', 'social', 'profiles']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-about-page',
      category: 'Navigation',
      title: 'No About page was detected in the navigation.',
      description: 'Navigation did not include an About, Our Story, or Team page.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.navigationLinks', 'WebsiteDocument.links'],
      businessReason: 'Customers may have fewer ways to understand who is behind the business.',
      customerReason: 'Customers may have less context for trust, ownership, or experience.',
      recommendedAction: 'Add or improve an About page with ownership, team, values, experience, and local credibility.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['navigation', 'trust', 'about']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-services-page',
      category: 'Navigation',
      title: 'No clear Services page was detected in the navigation.',
      description: 'Navigation did not include a Services, Solutions, or What We Do page.',
      severity: 'High',
      priority: 'P1 High',
      expectedEvidence: ['WebsiteDocument.navigationLinks', 'WebsiteDocument.links'],
      businessReason: 'Important services may require multiple clicks before customers can find them.',
      customerReason: 'Customers may not quickly confirm whether the business offers what they need.',
      recommendedAction: 'Add a clear Services page or service menu with the highest-value offerings.',
      estimatedEffort: 'Medium',
      expectedROI: 'High',
      tags: ['navigation', 'services', 'customer-path']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-faq',
      category: 'Content Quality',
      title: 'No FAQ section or page was detected.',
      description: 'Navigation and visible text did not include FAQ language.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.links', 'visible text'],
      businessReason: 'Customers may leave with unanswered questions that could have been resolved quickly.',
      customerReason: 'Customers may not find answers to timing, pricing, process, or service-area questions.',
      recommendedAction: 'Add a short FAQ addressing pricing, timing, service area, process, and common objections.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['content', 'faq', 'objections']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-privacy-policy',
      category: 'Security',
      title: 'No Privacy Policy link was detected.',
      description: 'Footer and navigation links did not include a Privacy Policy.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.footerLinks', 'WebsiteDocument.links'],
      businessReason: 'Customers may be less comfortable submitting forms if privacy expectations are unclear.',
      customerReason: 'Customers may not know how their information will be handled.',
      recommendedAction: 'Add a Privacy Policy link in the footer.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['security', 'privacy', 'forms']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-terms',
      category: 'Security',
      title: 'No Terms or Conditions link was detected.',
      description: 'Footer and navigation links did not include Terms or Conditions.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.footerLinks', 'WebsiteDocument.links'],
      businessReason: 'The site may be missing a basic trust and compliance signal.',
      customerReason: 'Customers may have less clarity about policies or expectations.',
      recommendedAction: 'Add Terms or Conditions where appropriate for the business model.',
      estimatedEffort: 'Low',
      expectedROI: 'Low',
      tags: ['security', 'terms', 'compliance']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-google-map',
      category: 'Google Business',
      title: 'No embedded Google Map was detected.',
      description: 'Google Maps references were not detected in the raw HTML.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.rawHtml', 'map embeds'],
      businessReason: 'Local customers may have less confidence about location or service area.',
      customerReason: 'Customers may not quickly confirm proximity, directions, or local relevance.',
      recommendedAction: 'Add a Google Map or clear local location section if customers visit or evaluate proximity.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['google-business', 'maps', 'local-seo']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-google-business-link',
      category: 'Google Business',
      title: 'No Google Business Profile link was detected on the website.',
      description: 'Common Google Business or Google Maps profile links were not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.rawHtml', 'WebsiteDocument.links'],
      businessReason: 'Customers may not have an easy path to verified reviews, directions, or local business details.',
      customerReason: 'Customers may need to search separately to verify the business on Google.',
      recommendedAction: 'Add a link to the Google Business Profile near reviews, footer, or contact details.',
      estimatedEffort: 'Low',
      expectedROI: 'Medium',
      tags: ['google-business', 'reviews', 'local-seo']
    }),
    inspectionRuleDefinition_({
      ruleId: 'missing-trust-badges',
      category: 'Trust Signals',
      title: 'No trust badges, certifications, guarantees, or credentials were detected.',
      description: 'Common credential, license, guarantee, certification, or warranty language was not detected.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['visible text', 'image alt text', 'homepage proof section'],
      businessReason: 'Customers may not see enough proof to feel confident before making contact.',
      customerReason: 'Customers may have less confidence that the business is qualified, safe, or reliable.',
      recommendedAction: 'Add relevant credentials, licenses, guarantees, warranties, certifications, or proof points.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['trust', 'credentials', 'proof']
    }),
    inspectionRuleDefinition_({
      ruleId: 'weak-branding-consistency',
      category: 'Brand Consistency',
      title: 'A clear logo or brand image signal was not detected in image data.',
      description: 'Image metadata did not include a clear logo or brand signal.',
      severity: 'Low',
      priority: 'P3 Future',
      expectedEvidence: ['WebsiteDocument.images', 'image alt text', 'image filenames'],
      businessReason: 'The site may feel less polished if the brand is not immediately recognizable.',
      customerReason: 'Customers may have weaker brand recall or confidence after the first visit.',
      recommendedAction: 'Make sure the logo, business name, colors, and visual style are consistent in the header and key sections.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['brand', 'logo', 'visual-consistency']
    }),
    inspectionRuleDefinition_({
      ruleId: 'broken-internal-links',
      category: 'Navigation',
      title: 'Some internal links appear to be placeholders or incomplete.',
      description: 'Internal links include placeholder anchors or incomplete paths.',
      severity: 'Medium',
      priority: 'P2 Normal',
      expectedEvidence: ['WebsiteDocument.links', 'internal links'],
      businessReason: 'Customers may experience unnecessary friction when navigating to important information.',
      customerReason: 'Customers may hit dead ends when trying to evaluate or contact the business.',
      recommendedAction: 'Audit internal links and replace placeholder anchors with real destinations.',
      estimatedEffort: 'Medium',
      expectedROI: 'Medium',
      tags: ['navigation', 'broken-links', 'quality']
    })
  ];
}

function inspectionRuleDefinition_(input) {
  const rule = input || {};
  return {
    ruleId: rule.ruleId,
    category: rule.category,
    title: rule.title,
    description: rule.description,
    severity: rule.severity || 'Medium',
    priority: rule.priority || 'P2 Normal',
    enabled: rule.enabled === undefined ? true : !!rule.enabled,
    industry: rule.industry || 'All',
    minimumConfidence: rule.minimumConfidence === undefined ? 0.7 : rule.minimumConfidence,
    expectedEvidence: rule.expectedEvidence || [],
    businessReason: rule.businessReason || '',
    customerReason: rule.customerReason || '',
    recommendedAction: rule.recommendedAction || '',
    estimatedEffort: rule.estimatedEffort || 'Medium',
    expectedROI: rule.expectedROI || 'Medium',
    tags: rule.tags || [],
    version: rule.version || '1.0',
    aliases: rule.aliases || []
  };
}
