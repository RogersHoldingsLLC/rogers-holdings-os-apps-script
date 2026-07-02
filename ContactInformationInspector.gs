/**
 * Rogers Holdings OS - ContactInformationInspector.
 * First production inspector for structured contact accessibility findings.
 *
 * This module is isolated and does not change existing audit, PDF, Gmail,
 * Drive, dashboard, menu, or scoring workflows.
 */

function inspectContactInformation(input) {
  const context = normalizeContactInspectionInput_(input || {});
  const inspection = context.inspection || createInspection(context.prospect || {});
  const signals = collectContactInformationSignals_(context);
  const rules = getContactInformationInspectionRules_();

  rules.forEach(function(rule) {
    if (!rule.isMissing(signals)) {
      return;
    }

    addFinding(inspection, {
      category: 'Contact Information',
      title: rule.title(signals),
      description: rule.description(signals),
      severity: rule.severity,
      status: 'Open',
      evidence: rule.evidence(signals, context),
      businessImpact: rule.businessImpact,
      customerImpact: rule.customerImpact,
      recommendation: {
        summary: rule.recommendation,
        action: rule.recommendation,
        rationale: rule.rationale,
        expectedOutcome: rule.expectedOutcome
      },
      difficulty: rule.difficulty,
      expectedRoi: rule.expectedRoi,
      inspectorNotes: rule.inspectorNotes,
      aiNotes: '',
      metadata: {
        inspector: 'Contact Information Inspector',
        signalKey: rule.key,
        ruleId: rule.ruleId || rule.key,
        ruleVersion: rule.version || ''
      }
    });
  });

  inspection.metadata = inspection.metadata || {};
  inspection.metadata.contactInformationSignals = signals;
  inspection.metadata.contactInformationInspectedAt = new Date();
  inspection.score = calculateInspectionScore(inspection);
  inspection.businessSummary = getBusinessSummary(inspection);
  return inspection;
}

function normalizeContactInspectionInput_(input) {
  const data = input || {};
  const reportFile = data.reportFile || {};
  const prospect = data.prospect || data.business || data;
  const evidence = normalizeContactEvidenceObject_(data.evidence || reportFile.evidence || prospect.evidence);

  return {
    inspection: data.inspection || null,
    prospect: prospect,
    website: data.website || prospect.website || '',
    html: firstNonBlank_([
      data.html,
      data.pageHtml,
      reportFile.html,
      reportFile.pageHtml,
      evidence.html
    ]),
    text: firstNonBlank_([
      data.text,
      data.pageText,
      data.homepageText,
      reportFile.text,
      reportFile.pageText,
      reportFile.homepageText,
      evidence.text,
      evidence.homepageText
    ]),
    aboveFoldText: firstNonBlank_([
      data.aboveFoldText,
      reportFile.aboveFoldText,
      evidence.aboveFoldText
    ]),
    headerText: firstNonBlank_([
      data.headerText,
      reportFile.headerText,
      evidence.headerText
    ]),
    footerText: firstNonBlank_([
      data.footerText,
      reportFile.footerText,
      evidence.footerText
    ]),
    links: normalizeContactLinks_(data.links || reportFile.links || evidence.links),
    forms: normalizeContactForms_(data.forms || reportFile.forms || evidence.forms),
    evidence: evidence,
    sourceUrl: data.sourceUrl || reportFile.sourceUrl || prospect.website || ''
  };
}

function normalizeContactEvidenceObject_(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value.website || value.contactInformation || value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed.website || parsed.contactInformation || parsed;
    } catch (error) {
      return {};
    }
  }
  return {};
}

function collectContactInformationSignals_(context) {
  const allText = [
    context.text,
    stripHtmlForContactInspection_(context.html),
    context.headerText,
    context.footerText,
    context.aboveFoldText
  ].join(' ');
  const normalizedAllText = normalizeInspectionText_(allText);
  const normalizedHeader = normalizeInspectionText_(context.headerText);
  const normalizedFooter = normalizeInspectionText_(context.footerText);
  const normalizedAboveFold = normalizeInspectionText_(context.aboveFoldText || context.headerText);
  const html = String(context.html || '');
  const links = context.links || [];
  const forms = context.forms || [];
  const contactPageLinks = links.filter(function(link) {
    return isContactPageLink_(link);
  });

  return {
    phoneNumbers: extractPhoneNumbers_(allText),
    headerPhoneNumbers: extractPhoneNumbers_(context.headerText),
    aboveFoldPhoneNumbers: extractPhoneNumbers_(context.aboveFoldText || context.headerText),
    footerPhoneNumbers: extractPhoneNumbers_(context.footerText),
    emails: extractEmailAddresses_(allText),
    clickToCallLinks: links.filter(function(link) {
      return String(link.href || link.url || '').toLowerCase().indexOf('tel:') === 0;
    }),
    contactPageLinks: contactPageLinks,
    contactForms: forms.filter(function(form) {
      return isContactForm_(form);
    }),
    businessHours: detectBusinessHours_(normalizedAllText),
    physicalAddress: detectPhysicalAddress_(allText),
    footerContactInfo: hasFooterContactInfo_(normalizedFooter, context.footerText),
    headerContactInfo: hasHeaderContactInfo_(normalizedHeader, context.headerText),
    phoneAboveFold: extractPhoneNumbers_(normalizedAboveFold).length > 0,
    hasAnyContactText: textIncludesAny_(normalizedAllText, ['contact', 'call', 'email', 'phone', 'hours', 'address']),
    sourceUrl: context.sourceUrl || '',
    sampleText: normalizedAllText.slice(0, 420),
    linkCount: links.length,
    formCount: forms.length,
    htmlLength: html.length
  };
}

function getContactInformationInspectionRules_() {
  const rules = [
    {
      key: 'phone-present',
      ruleId: 'missing-phone-number',
      severity: 'High',
      difficulty: 'Low',
      expectedRoi: 'High',
      isMissing: function(signals) { return !signals.phoneNumbers.length; },
      title: function() { return 'Phone number was not detected on the website.'; },
      description: function() { return 'The inspection did not find a phone number in the supplied website text or HTML.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Missing Element', 'Phone number scan', 'No phone number pattern was detected in the supplied homepage content.', context.sourceUrl)]; },
      businessImpact: 'Ready-to-call customers may not have a fast path to contact the business.',
      customerImpact: 'Customers who prefer calling may leave or choose another business if a number is not easy to find.',
      recommendation: 'Add a clearly visible phone number to the website header, footer, and contact section.',
      rationale: 'Phone visibility supports immediate customer action and reduces contact friction.',
      expectedOutcome: 'More customers can call directly without searching for contact details.',
      inspectorNotes: 'Phone detection checks common U.S. phone formats and tel links.'
    },
    {
      key: 'phone-above-fold',
      ruleId: 'phone-below-first-screen',
      severity: 'Medium',
      difficulty: 'Low',
      expectedRoi: 'High',
      isMissing: function(signals) { return signals.phoneNumbers.length > 0 && !signals.phoneAboveFold; },
      title: function() { return 'Phone number was not detected above the fold.'; },
      description: function(signals) { return `A phone number was detected (${signals.phoneNumbers[0]}), but not in the supplied above-the-fold or header content.`; },
      evidence: function(signals, context) { return [buildContactEvidence_('Placement Evidence', 'Above-the-fold scan', `Detected phone number ${signals.phoneNumbers[0]}, but not in the supplied above-the-fold/header content.`, context.sourceUrl)]; },
      businessImpact: 'High-intent visitors may not see the fastest contact option at the moment they are deciding what to do next.',
      customerImpact: 'Customers may need to scroll or search before they can call.',
      recommendation: 'Place the primary phone number in the top header or first visible section on desktop and mobile.',
      rationale: 'Above-the-fold phone placement shortens the path from interest to action.',
      expectedOutcome: 'Customers can call faster from the first screen.',
      inspectorNotes: 'Uses supplied aboveFoldText first, then headerText as fallback.'
    },
    {
      key: 'click-to-call',
      ruleId: 'missing-click-to-call',
      severity: 'Medium',
      difficulty: 'Low',
      expectedRoi: 'High',
      isMissing: function(signals) { return signals.phoneNumbers.length > 0 && !signals.clickToCallLinks.length; },
      title: function() { return 'Click-to-call link was not detected.'; },
      description: function(signals) { return `A phone number was detected (${signals.phoneNumbers[0]}), but no tel: click-to-call link was found.`; },
      evidence: function(signals, context) { return [buildContactEvidence_('Link Evidence', 'Link scan', 'No tel: link was detected in the supplied link list or HTML link data.', context.sourceUrl)]; },
      businessImpact: 'Mobile visitors may have to manually copy or retype the number, reducing call conversion.',
      customerImpact: 'Customers on mobile may experience unnecessary friction when trying to call.',
      recommendation: 'Wrap visible phone numbers with tel: links so mobile customers can tap to call.',
      rationale: 'Click-to-call is a low-effort improvement that directly supports call volume.',
      expectedOutcome: 'More mobile visitors can call with one tap.',
      inspectorNotes: 'Requires supplied link data with href/url values.'
    },
    {
      key: 'email-address',
      ruleId: 'missing-email',
      severity: 'Low',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      isMissing: function(signals) { return !signals.emails.length; },
      title: function() { return 'Email address was not detected on the website.'; },
      description: function() { return 'The inspection did not find an email address in the supplied website text or HTML.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Missing Element', 'Email scan', 'No email address pattern was detected in the supplied homepage content.', context.sourceUrl)]; },
      businessImpact: 'Some customers, vendors, or partners may not have a written contact path.',
      customerImpact: 'Customers who prefer email may be forced into a form or may not contact the business.',
      recommendation: 'Add a monitored business email address or clear written contact option.',
      rationale: 'Email provides a secondary contact path for customers who are not ready to call.',
      expectedOutcome: 'Customers have a clearer written inquiry option.',
      inspectorNotes: 'Email may be intentionally hidden behind forms; severity is low by default.'
    },
    {
      key: 'contact-page',
      ruleId: 'missing-contact-page',
      severity: 'Medium',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      isMissing: function(signals) { return !signals.contactPageLinks.length; },
      title: function() { return 'Contact page link was not detected.'; },
      description: function() { return 'The supplied website links did not include a clear Contact page link.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Navigation Evidence', 'Link scan', 'No link with contact-focused text or URL was detected.', context.sourceUrl)]; },
      businessImpact: 'Customers may not know where to find full contact details, directions, or inquiry options.',
      customerImpact: 'Customers may need to hunt through the site to contact the business.',
      recommendation: 'Add a clear Contact page link in the main navigation and footer.',
      rationale: 'A dedicated contact page gives customers one reliable place to act.',
      expectedOutcome: 'Customers can find all contact methods in one expected location.',
      inspectorNotes: 'Checks link text and href/url for contact indicators.'
    },
    {
      key: 'contact-form',
      ruleId: 'missing-contact-form',
      severity: 'Medium',
      difficulty: 'Medium',
      expectedRoi: 'High',
      isMissing: function(signals) { return !signals.contactForms.length; },
      title: function() { return 'Contact form was not detected.'; },
      description: function() { return 'The supplied form data did not include a contact, quote, booking, or request form.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Form Evidence', 'Form scan', `Detected ${signals.formCount} supplied form record(s), but none matched contact intent.`, context.sourceUrl)]; },
      businessImpact: 'Customers who prefer requesting help online may not have a simple lead capture path.',
      customerImpact: 'Customers may be forced to call even when they prefer submitting details online.',
      recommendation: 'Add a short contact or request form with name, contact method, service need, and message fields.',
      rationale: 'Forms capture inquiries from customers who are not ready or able to call.',
      expectedOutcome: 'The website can collect more qualified inquiries outside of phone calls.',
      inspectorNotes: 'Checks supplied forms for contact, quote, request, booking, or message intent.'
    },
    {
      key: 'business-hours',
      ruleId: 'missing-hours',
      severity: 'Low',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      isMissing: function(signals) { return !signals.businessHours; },
      title: function() { return 'Business hours were not detected.'; },
      description: function() { return 'The inspection did not find visible business hours in the supplied content.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Content Evidence', 'Hours scan', 'No recognizable hours, weekday schedule, or open/closed language was detected.', context.sourceUrl)]; },
      businessImpact: 'Customers may hesitate if they cannot tell when the business is available.',
      customerImpact: 'Customers may not know whether to call now, wait, or choose another provider.',
      recommendation: 'Add clear business hours near contact details and on the Contact page.',
      rationale: 'Hours reduce uncertainty and help customers time their outreach.',
      expectedOutcome: 'Customers understand availability before they call or submit a request.',
      inspectorNotes: 'Detects common weekday/hour/open/closed patterns.'
    },
    {
      key: 'physical-address',
      ruleId: 'missing-address',
      severity: 'Low',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      isMissing: function(signals) { return !signals.physicalAddress; },
      title: function() { return 'Physical address was not detected.'; },
      description: function() { return 'The inspection did not find a street-style business address in the supplied content.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Content Evidence', 'Address scan', 'No street address pattern was detected in the supplied website content.', context.sourceUrl)]; },
      businessImpact: 'Local trust and map confidence may be weaker without a clear address or service-area explanation.',
      customerImpact: 'Customers may be unsure where the business operates or whether it serves their area.',
      recommendation: 'Add a physical address or clear service-area statement near contact details.',
      rationale: 'Location clarity supports trust and local customer confidence.',
      expectedOutcome: 'Customers can confirm location or service area faster.',
      inspectorNotes: 'Some service-area businesses may intentionally avoid publishing a full street address.'
    },
    {
      key: 'footer-contact-info',
      ruleId: 'missing-footer-contact-info',
      severity: 'Low',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      isMissing: function(signals) { return signals.hasAnyContactText && !signals.footerContactInfo; },
      title: function() { return 'Footer contact information was not detected.'; },
      description: function() { return 'Contact information exists somewhere in the supplied content, but not in the supplied footer content.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Placement Evidence', 'Footer scan', 'Footer content did not include phone, email, address, hours, or contact language.', context.sourceUrl)]; },
      businessImpact: 'Visitors who scroll to the bottom may not find an expected contact option.',
      customerImpact: 'Customers may miss a standard place where contact details are normally available.',
      recommendation: 'Add phone, email or contact page link, hours, and service-area/location details to the footer.',
      rationale: 'Footer contact details create a consistent final action point.',
      expectedOutcome: 'Customers have a reliable contact option at the end of the page.',
      inspectorNotes: 'Uses supplied footerText only; no DOM parsing yet.'
    },
    {
      key: 'header-contact-info',
      ruleId: 'missing-header-contact-info',
      severity: 'Medium',
      difficulty: 'Low',
      expectedRoi: 'High',
      isMissing: function(signals) { return signals.hasAnyContactText && !signals.headerContactInfo; },
      title: function() { return 'Header contact information was not detected.'; },
      description: function() { return 'Contact information exists somewhere in the supplied content, but not in the supplied header content.'; },
      evidence: function(signals, context) { return [buildContactEvidence_('Placement Evidence', 'Header scan', 'Header content did not include phone, email, contact, call, or request language.', context.sourceUrl)]; },
      businessImpact: 'High-intent visitors may not see a quick action path when they first arrive.',
      customerImpact: 'Customers may need to search before they can contact the business.',
      recommendation: 'Add the primary phone number or Contact/Request action to the website header.',
      rationale: 'Header contact visibility improves the first-screen customer path.',
      expectedOutcome: 'Customers can act faster from the top of the website.',
      inspectorNotes: 'Uses supplied headerText only; no DOM parsing yet.'
    }
  ];
  return rules.map(function(rule) {
    return mergeInspectionRuleMetadata_(rule, rule.ruleId || rule.key);
  });
}

function buildContactEvidence_(type, label, description, sourceUrl) {
  return {
    type: type,
    source: 'Contact Information Inspector',
    sourceUrl: sourceUrl || '',
    label: label,
    description: description,
    value: description,
    confidence: null,
    metadata: {
      inspector: 'Contact Information Inspector'
    }
  };
}

function normalizeContactLinks_(links) {
  if (!links) {
    return [];
  }
  if (Array.isArray(links)) {
    return links.map(function(link) {
      if (typeof link === 'string') {
        return { href: link, text: link };
      }
      return link || {};
    });
  }
  if (typeof links === 'string') {
    try {
      const parsed = JSON.parse(links);
      return normalizeContactLinks_(parsed);
    } catch (error) {
      return links.split(/\n|,/).map(function(item) {
        return { href: item.trim(), text: item.trim() };
      }).filter(function(link) {
        return link.href;
      });
    }
  }
  return [];
}

function normalizeContactForms_(forms) {
  if (!forms) {
    return [];
  }
  if (Array.isArray(forms)) {
    return forms.map(function(form) {
      return typeof form === 'string' ? { text: form } : (form || {});
    });
  }
  if (typeof forms === 'string') {
    try {
      const parsed = JSON.parse(forms);
      return normalizeContactForms_(parsed);
    } catch (error) {
      return [{ text: forms }];
    }
  }
  return [];
}

function isContactPageLink_(link) {
  const text = [
    link && link.text,
    link && link.label,
    link && link.href,
    link && link.url
  ].join(' ').toLowerCase();
  return textIncludesAny_(text, ['contact', 'get in touch', 'request', 'quote', 'schedule', 'book']);
}

function isContactForm_(form) {
  const text = [
    form && form.id,
    form && form.name,
    form && form.action,
    form && form.text,
    form && form.label,
    form && form.fields ? JSON.stringify(form.fields) : ''
  ].join(' ').toLowerCase();
  return textIncludesAny_(text, ['contact', 'quote', 'request', 'book', 'schedule', 'message', 'name', 'email', 'phone']);
}

function stripHtmlForContactInspection_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInspectionText_(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractPhoneNumbers_(text) {
  const value = String(text || '');
  const matches = value.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || [];
  const seen = {};
  return matches.map(function(match) {
    return match.replace(/\s+/g, ' ').trim();
  }).filter(function(match) {
    const key = match.replace(/\D/g, '');
    if (key.length < 10 || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

function extractEmailAddresses_(text) {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const seen = {};
  return matches.filter(function(match) {
    const key = match.toLowerCase();
    if (seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

function detectBusinessHours_(normalizedText) {
  return textIncludesAny_(normalizedText, [
    'hours',
    'open ',
    'closed',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'mon-fri',
    '24/7'
  ]) || /\b\d{1,2}\s?(am|pm)\b/i.test(normalizedText);
}

function detectPhysicalAddress_(text) {
  const value = String(text || '');
  return /\b\d{2,6}\s+[A-Za-z0-9.' -]+\s+(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Highway|Hwy\.?|Suite|Ste\.?)\b/i.test(value);
}

function hasFooterContactInfo_(normalizedFooter, footerText) {
  return extractPhoneNumbers_(footerText).length > 0 ||
    extractEmailAddresses_(footerText).length > 0 ||
    detectPhysicalAddress_(footerText) ||
    textIncludesAny_(normalizedFooter, ['contact', 'call', 'email', 'hours', 'address']);
}

function hasHeaderContactInfo_(normalizedHeader, headerText) {
  return extractPhoneNumbers_(headerText).length > 0 ||
    extractEmailAddresses_(headerText).length > 0 ||
    textIncludesAny_(normalizedHeader, ['contact', 'call', 'request', 'quote', 'book']);
}
