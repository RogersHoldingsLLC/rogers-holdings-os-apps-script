/**
 * Rogers Holdings OS - HomepageInspector.
 * Isolated inspector for first impression, homepage clarity, and above-the-fold
 * customer understanding. This does not change existing production workflows.
 */

function inspectHomepage(input) {
  const context = normalizeHomepageInspectionInput_(input || {});
  const inspection = context.inspection || createInspection(context.prospect || {});
  const signals = collectHomepageInspectionSignals_(context);
  const rules = getHomepageInspectionRules_();

  rules.forEach(function(rule) {
    if (!rule.shouldCreateFinding(signals, context)) {
      return;
    }

    const confidence = rule.confidence(signals, context);
    addFinding(inspection, {
      category: 'Homepage',
      title: rule.title(signals, context),
      description: rule.description(signals, context),
      severity: rule.severity(signals, context),
      status: 'Open',
      evidence: rule.evidence(signals, context, confidence),
      businessImpact: rule.businessImpact(signals, context),
      customerImpact: rule.customerImpact(signals, context),
      recommendation: {
        summary: rule.recommendation(signals, context),
        action: rule.recommendation(signals, context),
        rationale: rule.rationale,
        expectedOutcome: rule.expectedOutcome
      },
      difficulty: rule.difficulty,
      expectedRoi: rule.expectedRoi,
      inspectorNotes: rule.inspectorNotes(signals, context),
      aiNotes: '',
      metadata: {
        inspector: 'Homepage Inspector',
        signalKey: rule.key,
        confidenceScore: confidence,
        evidenceStrength: signals.evidenceStrength
      }
    });
  });

  inspection.metadata = inspection.metadata || {};
  inspection.metadata.homepageSignals = signals;
  inspection.metadata.homepageInspectedAt = new Date();
  inspection.score = calculateInspectionScore(inspection);
  inspection.businessSummary = getBusinessSummary(inspection);
  return inspection;
}

function normalizeHomepageInspectionInput_(input) {
  const data = input || {};
  const reportFile = data.reportFile || {};
  const prospect = data.prospect || data.business || data;
  const evidence = normalizeHomepageEvidenceObject_(data.evidence || reportFile.evidence || prospect.evidence);

  return {
    inspection: data.inspection || null,
    prospect: prospect,
    website: data.website || data.url || prospect.website || '',
    company: data.company || prospect.company || '',
    city: data.city || prospect.city || '',
    state: data.state || prospect.state || '',
    industry: data.industry || prospect.industry || '',
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
      data.firstScreenText,
      reportFile.aboveFoldText,
      evidence.aboveFoldText,
      evidence.firstScreenText
    ]),
    mobileFirstScreenText: firstNonBlank_([
      data.mobileFirstScreenText,
      data.mobileText,
      reportFile.mobileFirstScreenText,
      evidence.mobileFirstScreenText,
      evidence.mobileText
    ]),
    heroHeadline: firstNonBlank_([
      data.heroHeadline,
      reportFile.heroHeadline,
      evidence.heroHeadline
    ]),
    heroText: firstNonBlank_([
      data.heroText,
      data.heroSubheadline,
      reportFile.heroText,
      reportFile.heroSubheadline,
      evidence.heroText,
      evidence.heroSubheadline
    ]),
    headerText: firstNonBlank_([
      data.headerText,
      reportFile.headerText,
      evidence.headerText
    ]),
    links: normalizeHomepageLinks_(data.links || reportFile.links || evidence.links),
    buttons: normalizeHomepageLinks_(data.buttons || reportFile.buttons || evidence.buttons),
    images: normalizeHomepageImages_(data.images || reportFile.images || evidence.images),
    headings: normalizeHomepageHeadings_(data.headings || reportFile.headings || evidence.headings),
    forms: normalizeHomepageForms_(data.forms || reportFile.forms || evidence.forms),
    evidence: evidence,
    sourceUrl: data.sourceUrl || reportFile.sourceUrl || prospect.website || data.website || data.url || ''
  };
}

function normalizeHomepageEvidenceObject_(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value.website || value.homepage || value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed.website || parsed.homepage || parsed;
    } catch (error) {
      return {};
    }
  }
  return {};
}

function collectHomepageInspectionSignals_(context) {
  const html = String(context.html || '');
  const text = firstNonBlank_([
    context.text,
    stripHtmlForHomepageInspection_(html)
  ]);
  const aboveFoldText = firstNonBlank_([
    context.aboveFoldText,
    context.heroHeadline,
    context.heroText,
    context.headerText,
    text.slice(0, 650)
  ]);
  const normalizedText = normalizeHomepageInspectionText_(text);
  const normalizedFirstScreen = normalizeHomepageInspectionText_(aboveFoldText);
  const normalizedMobile = normalizeHomepageInspectionText_(context.mobileFirstScreenText);
  const heroHeadline = firstNonBlank_([
    context.heroHeadline,
    getPrimaryHomepageHeading_(context.headings, html, aboveFoldText)
  ]);
  const heroText = firstNonBlank_([
    context.heroText,
    getHomepageSupportingText_(aboveFoldText, heroHeadline)
  ]);
  const ctaItems = collectHomepageCtaItems_(context.links.concat(context.buttons), html);
  const serviceTerms = getHomepageServiceTerms_(context);
  const serviceAreaTerms = getHomepageServiceAreaTerms_(context);
  const trustTerms = getHomepageTrustTerms_();
  const genericPhrases = getHomepageGenericPhrases_();

  return {
    sourceUrl: context.sourceUrl || '',
    company: context.company || '',
    industry: context.industry || '',
    text: text,
    aboveFoldText: aboveFoldText,
    mobileFirstScreenText: context.mobileFirstScreenText || '',
    normalizedText: normalizedText,
    normalizedFirstScreen: normalizedFirstScreen,
    normalizedMobile: normalizedMobile,
    evidenceStrength: getHomepageEvidenceStrength_(context, text, aboveFoldText),
    companyNameVisible: isCompanyNameVisible_(context.company, normalizedFirstScreen, normalizedText),
    logoPresent: detectHomepageLogo_(context, html),
    heroHeadline: heroHeadline,
    heroHeadlineClear: isHomepageHeroHeadlineClear_(heroHeadline, serviceTerms),
    heroText: heroText,
    supportingHeroTextPresent: isHomepageSupportingTextUseful_(heroText),
    primaryServiceClear: textIncludesAny_(normalizedFirstScreen, serviceTerms) || textIncludesAny_(normalizedText.slice(0, 900), serviceTerms),
    serviceAreaVisible: serviceAreaTerms.length ? textIncludesAny_(normalizedFirstScreen, serviceAreaTerms) || textIncludesAny_(normalizedText.slice(0, 1200), serviceAreaTerms) : detectHomepageServiceAreaLanguage_(normalizedText),
    primaryCtaItems: ctaItems.primary,
    secondaryCtaItems: ctaItems.secondary,
    trustSignalFirstScreen: textIncludesAny_(normalizedFirstScreen, trustTerms),
    contactOptionFirstScreen: hasHomepageContactOption_(normalizedFirstScreen),
    clutterSignals: getHomepageClutterSignals_(aboveFoldText, context.links, context.buttons),
    genericWordingMatches: genericPhrases.filter(function(phrase) {
      return normalizedFirstScreen.indexOf(phrase) !== -1 || normalizedText.slice(0, 900).indexOf(phrase) !== -1;
    }),
    mobileFirstScreenClear: isHomepageMobileFirstScreenClear_(context.mobileFirstScreenText, serviceTerms),
    readability: calculateHomepageReadability_(aboveFoldText || text),
    weakFirstImpressionSignals: getHomepageWeakFirstImpressionSignals_(normalizedFirstScreen, html),
    sampleFirstScreen: aboveFoldText.slice(0, 420),
    linkCount: context.links.length,
    buttonCount: context.buttons.length,
    imageCount: context.images.length,
    headingCount: context.headings.length,
    formCount: context.forms.length
  };
}

function getHomepageInspectionRules_() {
  return [
    {
      key: 'company-name-visibility',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return signals.company && !signals.companyNameVisible; },
      title: function() { return 'The company name was not clearly visible in the first screen.'; },
      description: function(signals) { return `The supplied first-screen content did not clearly include "${signals.company}".`; },
      severity: function() { return 'Medium'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.aboveFoldText ? 0.82 : 0.62); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Visibility Evidence', 'Company name scan', `Company name "${signals.company}" was not detected in the supplied first-screen content.`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Visitors may not immediately confirm they have landed on the right business website.'; },
      customerImpact: function() { return 'Customers may hesitate if the business identity is not obvious right away.'; },
      recommendation: function(signals) { return `Place "${signals.company}" clearly in the header, logo area, or first visible section.`; },
      rationale: 'Clear identity builds confidence in the first few seconds.',
      expectedOutcome: 'Visitors can quickly confirm the business identity before deciding what to do next.',
      inspectorNotes: function() { return 'Uses supplied company name and first-screen/homepage text.'; }
    },
    {
      key: 'logo-presence',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return !signals.logoPresent; },
      title: function() { return 'A clear logo was not detected on the homepage.'; },
      description: function() { return 'The supplied HTML, image data, and first-screen content did not include a clear logo signal.'; },
      severity: function() { return 'Low'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.imageCount || signals.evidenceStrength === 'Strong' ? 0.78 : 0.55); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Brand Evidence', 'Logo scan', `Detected ${signals.imageCount} supplied image record(s), but no logo-focused alt text, filename, class, or identifier.`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Brand recognition and perceived professionalism may be weaker on arrival.'; },
      customerImpact: function() { return 'Customers may have less visual confirmation that the site belongs to the business.'; },
      recommendation: function() { return 'Add a clear business logo in the header and ensure the image alt text or filename identifies it as the logo.'; },
      rationale: 'A recognizable logo supports trust and immediate brand confirmation.',
      expectedOutcome: 'Visitors get a stronger brand cue as soon as the page loads.',
      inspectorNotes: function() { return 'Checks image metadata, HTML logo attributes, and logo-related text.'; }
    },
    {
      key: 'hero-headline-clarity',
      difficulty: 'Medium',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.heroHeadlineClear; },
      title: function() { return 'The hero headline does not clearly explain the business value.'; },
      description: function(signals) {
        return signals.heroHeadline
          ? `Detected hero headline: "${signals.heroHeadline}". It does not clearly state the primary service or customer outcome.`
          : 'No clear hero headline was detected in the supplied homepage evidence.';
      },
      severity: function() { return 'High'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.heroHeadline ? 0.86 : 0.64); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Content Evidence', 'Hero headline', signals.heroHeadline || 'No hero headline was available in supplied headings or first-screen content.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'A vague first message can reduce quote requests, calls, and customer confidence.'; },
      customerImpact: function() { return 'Customers may not understand what the business does or whether it can solve their need.'; },
      recommendation: function(signals) { return signals.industry ? `Rewrite the hero headline so it clearly names the ${signals.industry} service and the customer outcome.` : 'Rewrite the hero headline so it clearly names the primary service and customer outcome.'; },
      rationale: 'The hero headline should answer what the business does and why it matters.',
      expectedOutcome: 'Visitors understand the offer faster and are more likely to continue toward contact.',
      inspectorNotes: function() { return 'Uses explicit heroHeadline first, then headings and first-screen text fallback.'; }
    },
    {
      key: 'supporting-hero-text',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return !signals.supportingHeroTextPresent; },
      title: function() { return 'Supporting hero text was not clearly detected.'; },
      description: function() { return 'The first screen does not appear to include a short supporting explanation beneath the primary headline.'; },
      severity: function() { return 'Medium'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.aboveFoldText ? 0.76 : 0.55); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Content Evidence', 'Supporting text scan', signals.sampleFirstScreen || 'No first-screen copy was supplied.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Visitors may not get enough context to trust the offer or choose the next step.'; },
      customerImpact: function() { return 'Customers may need to scroll or search to understand fit, service details, or value.'; },
      recommendation: function() { return 'Add one concise supporting sentence that explains who the service is for, what problem it solves, and why the business is credible.'; },
      rationale: 'Supporting copy turns a headline into a clear customer promise.',
      expectedOutcome: 'Customers get enough context to keep moving toward an inquiry.',
      inspectorNotes: function() { return 'Flags missing or very thin first-screen supporting copy.'; }
    },
    {
      key: 'primary-service-clarity',
      difficulty: 'Medium',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.primaryServiceClear; },
      title: function() { return 'The homepage does not clearly explain the primary service in the first screen.'; },
      description: function(signals) { return signals.industry ? `The supplied first-screen content did not clearly connect the page to ${signals.industry} services.` : 'The supplied first-screen content did not clearly identify the primary service.'; },
      severity: function() { return 'High'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.sampleFirstScreen ? 0.84 : 0.58); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Service Evidence', 'Primary service scan', signals.sampleFirstScreen || 'No first-screen text was supplied for service clarity review.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Customers who cannot quickly understand the service may leave before contacting the business.'; },
      customerImpact: function() { return 'Customers may be unsure whether the business handles their specific need.'; },
      recommendation: function(signals) { return signals.industry ? `State the main ${signals.industry} service clearly near the top of the homepage.` : 'State the main service clearly near the top of the homepage.'; },
      rationale: 'Service clarity is a core driver of qualified inquiries.',
      expectedOutcome: 'Visitors can quickly match their need to the business offering.',
      inspectorNotes: function() { return 'Uses industry, service terms, first-screen text, and homepage text.'; }
    },
    {
      key: 'service-area-visibility',
      difficulty: 'Low',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.serviceAreaVisible; },
      title: function() { return 'The service area is not clearly visible on the homepage.'; },
      description: function(signals, context) {
        const location = [context.city, context.state].filter(Boolean).join(', ');
        return location ? `The supplied homepage evidence did not clearly show ${location} or a service-area statement.` : 'The supplied homepage evidence did not clearly show a city, state, or service-area statement.';
      },
      severity: function() { return 'Medium'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.sampleFirstScreen ? 0.8 : 0.57); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Location Evidence', 'Service area scan', signals.sampleFirstScreen || 'No homepage text was supplied for service-area review.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Local visibility and customer fit may be weaker if visitors cannot confirm the service area.'; },
      customerImpact: function() { return 'Customers may be unsure whether the business serves their location.'; },
      recommendation: function(signals, context) {
        const location = [context.city, context.state].filter(Boolean).join(', ');
        return location ? `Add a clear service-area line such as "Serving ${location} and surrounding areas."` : 'Add a clear service-area line near the homepage hero or contact section.';
      },
      rationale: 'Service-area clarity supports local trust and local search relevance.',
      expectedOutcome: 'Visitors can confirm geographic fit faster.',
      inspectorNotes: function() { return 'Checks city/state values and common service-area language.'; }
    },
    {
      key: 'primary-cta-presence',
      difficulty: 'Low',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.primaryCtaItems.length; },
      title: function() { return 'No primary call-to-action was detected in the hero section.'; },
      description: function() { return 'The supplied first-screen links, buttons, and homepage content did not include a strong primary action such as call, quote, schedule, book, or request.'; },
      severity: function() { return 'High'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.linkCount || signals.buttonCount ? 0.86 : 0.62); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('CTA Evidence', 'Primary CTA scan', `Detected ${signals.linkCount} link(s) and ${signals.buttonCount} button record(s), but no strong primary CTA.`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Visitors may not know the next step to request service, schedule, or contact the business.'; },
      customerImpact: function() { return 'Customers may have to hunt for the action they need.'; },
      recommendation: function() { return 'Add one prominent primary call-to-action near the top of the homepage, such as Request a Quote, Schedule Service, or Call Now.'; },
      rationale: 'A clear CTA turns interest into action.',
      expectedOutcome: 'More visitors have a direct path to become inquiries.',
      inspectorNotes: function() { return 'Checks supplied links, buttons, and common CTA phrases in HTML.'; }
    },
    {
      key: 'secondary-cta-presence',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return signals.primaryCtaItems.length > 0 && !signals.secondaryCtaItems.length; },
      title: function() { return 'A secondary call-to-action was not detected.'; },
      description: function(signals) { return `A primary action was detected (${signals.primaryCtaItems[0]}), but no softer secondary action was found.`; },
      severity: function() { return 'Low'; },
      confidence: function(signals) { return homepageConfidence_(signals, 0.74); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('CTA Evidence', 'Secondary CTA scan', `Primary CTA detected: ${signals.primaryCtaItems[0]}. No secondary CTA such as Learn More, Services, Contact, or View Work was detected.`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Visitors who are not ready to call or request service may not have a lower-commitment next step.'; },
      customerImpact: function() { return 'Customers may leave if they want to learn more before contacting the business.'; },
      recommendation: function() { return 'Add a secondary action such as View Services, See Our Work, Learn More, or Contact Us beside the primary CTA.'; },
      rationale: 'Secondary CTAs support visitors who need more context before converting.',
      expectedOutcome: 'More visitors continue exploring instead of leaving.',
      inspectorNotes: function() { return 'Only runs when a primary CTA exists.'; }
    },
    {
      key: 'trust-signal-first-screen',
      difficulty: 'Medium',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.trustSignalFirstScreen; },
      title: function() { return 'No trust signal was detected in the first screen.'; },
      description: function() { return 'The supplied first-screen content did not include reviews, years in business, licensed/insured language, certifications, ratings, guarantees, or similar proof.'; },
      severity: function() { return 'Medium'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.sampleFirstScreen ? 0.78 : 0.55); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Trust Evidence', 'First-screen trust scan', signals.sampleFirstScreen || 'No first-screen content was supplied for trust-signal review.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'The homepage may miss an early chance to reduce customer doubt and increase confidence.'; },
      customerImpact: function() { return 'Customers may not see proof that the business is credible before deciding whether to act.'; },
      recommendation: function() { return 'Add one strong trust cue near the hero section, such as review rating, years served, licensed/insured, certifications, or a short testimonial.'; },
      rationale: 'Trust signals help customers feel safer taking the next step.',
      expectedOutcome: 'Customers have more confidence before calling or requesting service.',
      inspectorNotes: function() { return 'Checks first-screen copy for common trust and proof terms.'; }
    },
    {
      key: 'contact-option-first-screen',
      difficulty: 'Low',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return !signals.contactOptionFirstScreen; },
      title: function() { return 'No contact option was detected in the first screen.'; },
      description: function() { return 'The supplied first-screen content did not include a phone number, email, contact link, quote request, booking path, or call action.'; },
      severity: function() { return 'Medium'; },
      confidence: function(signals) { return homepageConfidence_(signals, signals.sampleFirstScreen ? 0.82 : 0.58); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Contact Evidence', 'First-screen contact scan', signals.sampleFirstScreen || 'No first-screen content was supplied for contact option review.', context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Ready-to-act visitors may not see a fast contact path when intent is highest.'; },
      customerImpact: function() { return 'Customers may need to scroll or navigate before they can contact the business.'; },
      recommendation: function() { return 'Add a visible first-screen contact path such as Call Now, Request a Quote, Schedule Service, or Contact Us.'; },
      rationale: 'First-screen contact options reduce friction for high-intent visitors.',
      expectedOutcome: 'Customers can act faster from the top of the homepage.',
      inspectorNotes: function() { return 'Complements the Contact Information Inspector with first-screen placement context.'; }
    },
    {
      key: 'homepage-clutter',
      difficulty: 'Medium',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return signals.clutterSignals.length > 0; },
      title: function() { return 'The first screen may feel cluttered.'; },
      description: function(signals) { return `Detected clutter signal: ${signals.clutterSignals[0]}.`; },
      severity: function() { return 'Low'; },
      confidence: function(signals) { return homepageConfidence_(signals, 0.68); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Layout Evidence', 'First-screen clutter scan', signals.clutterSignals.join(' '), context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Too many competing elements can weaken the main message and reduce action.'; },
      customerImpact: function() { return 'Customers may have difficulty deciding what to read or click first.'; },
      recommendation: function() { return 'Reduce competing first-screen elements and prioritize one clear message, one primary CTA, and one supporting trust cue.'; },
      rationale: 'Simpler first screens make decisions easier.',
      expectedOutcome: 'Visitors understand the offer and next step with less effort.',
      inspectorNotes: function() { return 'Uses available text volume, link count, and button count as proxy signals.'; }
    },
    {
      key: 'generic-wording',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return signals.genericWordingMatches.length > 0; },
      title: function(signals) { return `Generic homepage wording detected: "${signals.genericWordingMatches[0]}".`; },
      description: function(signals) { return `The homepage uses generic wording that may not explain what makes the business specific or credible: "${signals.genericWordingMatches[0]}".`; },
      severity: function() { return 'Low'; },
      confidence: function(signals) { return homepageConfidence_(signals, 0.82); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Copy Evidence', 'Generic wording scan', `Matched phrase: ${signals.genericWordingMatches[0]}`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Generic copy can make the business sound interchangeable instead of clearly useful.'; },
      customerImpact: function() { return 'Customers may not understand why they should choose this business over another option.'; },
      recommendation: function() { return 'Replace generic claims with specific services, locations, proof points, and customer outcomes.'; },
      rationale: 'Specific copy builds trust faster than broad claims.',
      expectedOutcome: 'Visitors get clearer reasons to contact the business.',
      inspectorNotes: function() { return 'Checks common generic marketing phrases in first-screen/homepage copy.'; }
    },
    {
      key: 'mobile-first-screen-clarity',
      difficulty: 'Medium',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return signals.mobileFirstScreenText && !signals.mobileFirstScreenClear; },
      title: function() { return 'The mobile first screen does not clearly explain the service or next step.'; },
      description: function(signals) { return `Supplied mobile first-screen text: "${signals.mobileFirstScreenText.slice(0, 220)}".`; },
      severity: function() { return 'Medium'; },
      confidence: function() { return 0.82; },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Mobile Evidence', 'Mobile first-screen scan', signals.mobileFirstScreenText.slice(0, 420), context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Mobile visitors may not understand the offer quickly enough to call, book, or request service.'; },
      customerImpact: function() { return 'Customers on phones may have to scroll or search before understanding the business.'; },
      recommendation: function() { return 'Make the mobile first screen show the service, location/service area, and primary action without requiring extra scrolling.'; },
      rationale: 'Many local business visitors arrive on mobile and make quick decisions.',
      expectedOutcome: 'Mobile visitors can understand and act faster.',
      inspectorNotes: function() { return 'Only runs when mobile first-screen evidence is supplied.'; }
    },
    {
      key: 'readability',
      difficulty: 'Low',
      expectedRoi: 'Medium',
      shouldCreateFinding: function(signals) { return signals.readability.needsReview; },
      title: function() { return 'Homepage copy may be harder to scan than necessary.'; },
      description: function(signals) { return `Average sentence length is approximately ${signals.readability.averageSentenceWords} words, with ${signals.readability.wordCount} words in the reviewed first-screen copy.`; },
      severity: function() { return 'Low'; },
      confidence: function(signals) { return homepageConfidence_(signals, 0.7); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('Readability Evidence', 'Sentence length scan', `Average sentence length: ${signals.readability.averageSentenceWords} words.`, context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Harder-to-scan copy can reduce understanding and slow down customer action.'; },
      customerImpact: function() { return 'Customers may need more effort to understand the offer.'; },
      recommendation: function() { return 'Shorten first-screen copy into direct, plain-English statements with clear headings and brief supporting lines.'; },
      rationale: 'Readable copy improves comprehension and action.',
      expectedOutcome: 'Visitors can understand the message faster.',
      inspectorNotes: function() { return 'Uses simple sentence-length heuristics, not a formal readability score.'; }
    },
    {
      key: 'weak-first-impression',
      difficulty: 'Medium',
      expectedRoi: 'High',
      shouldCreateFinding: function(signals) { return signals.weakFirstImpressionSignals.length > 0; },
      title: function(signals) { return `Weak first impression signal detected: ${signals.weakFirstImpressionSignals[0]}.`; },
      description: function(signals) { return `The homepage evidence includes a weak first impression signal: ${signals.weakFirstImpressionSignals[0]}.`; },
      severity: function() { return 'High'; },
      confidence: function(signals) { return homepageConfidence_(signals, 0.86); },
      evidence: function(signals, context, confidence) { return [buildHomepageEvidence_('First Impression Evidence', 'Weak signal scan', signals.weakFirstImpressionSignals.join(' '), context.sourceUrl, confidence)]; },
      businessImpact: function() { return 'Weak first impression signals can immediately reduce trust and inquiry intent.'; },
      customerImpact: function() { return 'Customers may question whether the business is active, professional, or ready to help.'; },
      recommendation: function() { return 'Remove placeholder, broken, or incomplete homepage elements and replace them with clear service, proof, and contact content.'; },
      rationale: 'The homepage should signal active, reliable operation.',
      expectedOutcome: 'Visitors see a more complete and trustworthy first impression.',
      inspectorNotes: function() { return 'Checks for placeholder, lorem ipsum, coming soon, under construction, and obvious error language.'; }
    }
  ];
}

function buildHomepageEvidence_(type, label, description, sourceUrl, confidence) {
  return {
    type: type,
    source: 'Homepage Inspector',
    sourceUrl: sourceUrl || '',
    label: label,
    description: description,
    value: description,
    confidence: confidence === undefined ? null : confidence,
    metadata: {
      inspector: 'Homepage Inspector',
      confidenceScore: confidence === undefined ? null : confidence
    }
  };
}

function normalizeHomepageLinks_(links) {
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
      return normalizeHomepageLinks_(JSON.parse(links));
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

function normalizeHomepageImages_(images) {
  if (!images) {
    return [];
  }
  if (Array.isArray(images)) {
    return images.map(function(image) {
      return typeof image === 'string' ? { src: image, alt: image } : (image || {});
    });
  }
  if (typeof images === 'string') {
    try {
      return normalizeHomepageImages_(JSON.parse(images));
    } catch (error) {
      return images.split(/\n|,/).map(function(item) {
        return { src: item.trim(), alt: item.trim() };
      }).filter(function(image) {
        return image.src;
      });
    }
  }
  return [];
}

function normalizeHomepageHeadings_(headings) {
  if (!headings) {
    return [];
  }
  if (Array.isArray(headings)) {
    return headings.map(function(heading) {
      return typeof heading === 'string' ? { text: heading, level: '' } : (heading || {});
    });
  }
  if (typeof headings === 'string') {
    try {
      return normalizeHomepageHeadings_(JSON.parse(headings));
    } catch (error) {
      return headings.split(/\n/).map(function(item) {
        return { text: item.trim(), level: '' };
      }).filter(function(heading) {
        return heading.text;
      });
    }
  }
  return [];
}

function normalizeHomepageForms_(forms) {
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
      return normalizeHomepageForms_(JSON.parse(forms));
    } catch (error) {
      return [{ text: forms }];
    }
  }
  return [];
}

function stripHtmlForHomepageInspection_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHomepageInspectionText_(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getPrimaryHomepageHeading_(headings, html, fallbackText) {
  const headingList = headings || [];
  const h1 = headingList.filter(function(heading) {
    return String(heading.level || heading.tag || '').toLowerCase() === 'h1';
  })[0] || headingList[0];
  if (h1 && h1.text) {
    return String(h1.text).trim();
  }

  const htmlH1 = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (htmlH1 && htmlH1[1]) {
    return stripHtmlForHomepageInspection_(htmlH1[1]).slice(0, 160);
  }

  return String(fallbackText || '').split(/[.!?\n]/)[0].trim().slice(0, 160);
}

function getHomepageSupportingText_(aboveFoldText, heroHeadline) {
  const text = String(aboveFoldText || '').trim();
  const headline = String(heroHeadline || '').trim();
  if (!text) {
    return '';
  }
  if (headline && text.indexOf(headline) === 0) {
    return text.slice(headline.length).trim().slice(0, 260);
  }
  const sentences = text.split(/[.!?\n]/).map(function(item) {
    return item.trim();
  }).filter(Boolean);
  return sentences.slice(1, 3).join('. ').slice(0, 260);
}

function getHomepageServiceTerms_(context) {
  const industry = normalizeHomepageInspectionText_(context.industry);
  const serviceTerms = [
    industry,
    'roof', 'roofing', 'plumbing', 'hvac', 'heating', 'cooling',
    'dental', 'dentist', 'fitness', 'auto repair', 'lawn care',
    'restaurant', 'cafe', 'logistics', 'freight', 'transportation',
    'website', 'seo', 'automation', 'consulting', 'service', 'services',
    'repair', 'installation', 'maintenance', 'cleaning', 'contractor'
  ].filter(Boolean);
  const seen = {};
  return serviceTerms.filter(function(term) {
    const key = normalizeHomepageInspectionText_(term);
    if (!key || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

function getHomepageServiceAreaTerms_(context) {
  return [
    context.city,
    context.state,
    [context.city, context.state].filter(Boolean).join(', '),
    'service area',
    'serving',
    'near me',
    'local',
    'surrounding areas'
  ].map(function(value) {
    return normalizeHomepageInspectionText_(value);
  }).filter(Boolean);
}

function getHomepageTrustTerms_() {
  return [
    'review', 'reviews', 'testimonial', 'testimonials', 'rated',
    'stars', 'licensed', 'insured', 'certified', 'certification',
    'years', 'family owned', 'locally owned', 'trusted', 'guarantee',
    'warranty', 'award', 'bbb', 'google rating', 'clients served'
  ];
}

function getHomepageGenericPhrases_() {
  return [
    'quality service',
    'best service',
    'professional service',
    'customer satisfaction',
    'we are committed',
    'exceed expectations',
    'one stop shop',
    'solutions for all your needs',
    'welcome to our website',
    'your trusted partner'
  ];
}

function isCompanyNameVisible_(company, normalizedFirstScreen, normalizedText) {
  const normalizedCompany = normalizeHomepageInspectionText_(company);
  if (!normalizedCompany) {
    return true;
  }
  return normalizedFirstScreen.indexOf(normalizedCompany) !== -1 ||
    normalizedText.slice(0, 900).indexOf(normalizedCompany) !== -1;
}

function detectHomepageLogo_(context, html) {
  const imageText = (context.images || []).map(function(image) {
    return [
      image.alt,
      image.src,
      image.fileName,
      image.className,
      image.id
    ].join(' ');
  }).join(' ');
  const combined = normalizeHomepageInspectionText_([imageText, html, context.headerText].join(' '));
  return textIncludesAny_(combined, ['logo', 'brand-logo', 'site-logo', 'custom-logo', 'navbar-brand']);
}

function isHomepageHeroHeadlineClear_(headline, serviceTerms) {
  const value = normalizeHomepageInspectionText_(headline);
  if (!value || value.length < 12) {
    return false;
  }
  if (getHomepageGenericPhrases_().some(function(phrase) {
    return value.indexOf(phrase) !== -1;
  })) {
    return false;
  }
  return textIncludesAny_(value, serviceTerms) ||
    textIncludesAny_(value, ['help', 'serving', 'repair', 'build', 'grow', 'schedule', 'quote', 'customers']);
}

function isHomepageSupportingTextUseful_(heroText) {
  const value = normalizeHomepageInspectionText_(heroText);
  return value.length >= 35 && value.split(' ').length >= 7;
}

function collectHomepageCtaItems_(links, html) {
  const primaryTerms = ['call', 'quote', 'schedule', 'book', 'request', 'estimate', 'contact', 'get started', 'start now', 'appointment'];
  const secondaryTerms = ['learn more', 'services', 'view', 'about', 'portfolio', 'gallery', 'see our work'];
  const allItems = (links || []).map(function(link) {
    return [link.text, link.label, link.href, link.url].join(' ').trim();
  });
  const htmlText = stripHtmlForHomepageInspection_(String(html || ''));
  if (htmlText) {
    allItems.push(htmlText.slice(0, 900));
  }
  return {
    primary: allItems.filter(function(item) {
      return textIncludesAny_(normalizeHomepageInspectionText_(item), primaryTerms);
    }).slice(0, 5),
    secondary: allItems.filter(function(item) {
      return textIncludesAny_(normalizeHomepageInspectionText_(item), secondaryTerms);
    }).slice(0, 5)
  };
}

function detectHomepageServiceAreaLanguage_(normalizedText) {
  return textIncludesAny_(normalizedText.slice(0, 1200), ['service area', 'serving', 'surrounding areas', 'local', 'near me']);
}

function hasHomepageContactOption_(normalizedFirstScreen) {
  return extractHomepagePhoneNumbers_(normalizedFirstScreen).length > 0 ||
    extractHomepageEmailAddresses_(normalizedFirstScreen).length > 0 ||
    textIncludesAny_(normalizedFirstScreen, ['contact', 'call', 'quote', 'request', 'schedule', 'book', 'appointment']);
}

function extractHomepagePhoneNumbers_(text) {
  const matches = String(text || '').match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || [];
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

function extractHomepageEmailAddresses_(text) {
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

function getHomepageClutterSignals_(aboveFoldText, links, buttons) {
  const signals = [];
  const words = String(aboveFoldText || '').trim().split(/\s+/).filter(Boolean).length;
  if (words > 180) {
    signals.push(`First-screen copy contains approximately ${words} words.`);
  }
  if ((links || []).length > 16) {
    signals.push(`First-screen/link evidence includes ${(links || []).length} links.`);
  }
  if ((buttons || []).length > 6) {
    signals.push(`Button evidence includes ${(buttons || []).length} buttons.`);
  }
  return signals;
}

function isHomepageMobileFirstScreenClear_(mobileText, serviceTerms) {
  const value = normalizeHomepageInspectionText_(mobileText);
  if (!value) {
    return true;
  }
  return textIncludesAny_(value, serviceTerms) &&
    textIncludesAny_(value, ['call', 'quote', 'schedule', 'book', 'contact', 'request', 'service', 'serving']);
}

function calculateHomepageReadability_(text) {
  const value = String(text || '').trim();
  const words = value.split(/\s+/).filter(Boolean);
  const sentences = value.split(/[.!?]+/).map(function(item) {
    return item.trim();
  }).filter(Boolean);
  const sentenceCount = Math.max(sentences.length, 1);
  const averageSentenceWords = Math.round(words.length / sentenceCount);
  return {
    wordCount: words.length,
    sentenceCount: sentenceCount,
    averageSentenceWords: averageSentenceWords,
    needsReview: words.length >= 70 && averageSentenceWords > 24
  };
}

function getHomepageWeakFirstImpressionSignals_(normalizedFirstScreen, html) {
  const source = [normalizedFirstScreen, normalizeHomepageInspectionText_(html)].join(' ');
  const checks = [
    { phrase: 'lorem ipsum', label: 'placeholder lorem ipsum text' },
    { phrase: 'coming soon', label: 'coming soon language' },
    { phrase: 'under construction', label: 'under construction language' },
    { phrase: 'page not found', label: 'page not found language' },
    { phrase: '404', label: '404 error language' },
    { phrase: 'default title', label: 'default title language' },
    { phrase: 'add your text', label: 'placeholder editing text' }
  ];
  return checks.filter(function(check) {
    return source.indexOf(check.phrase) !== -1;
  }).map(function(check) {
    return check.label;
  });
}

function getHomepageEvidenceStrength_(context, text, aboveFoldText) {
  if (context.html || context.headings.length || context.links.length || context.images.length || context.buttons.length) {
    return 'Strong';
  }
  if (aboveFoldText || text) {
    return 'Moderate';
  }
  return 'Weak';
}

function homepageConfidence_(signals, baseConfidence) {
  const base = Number(baseConfidence || 0.6);
  if (signals.evidenceStrength === 'Strong') {
    return Math.min(0.95, Math.round((base + 0.08) * 100) / 100);
  }
  if (signals.evidenceStrength === 'Weak') {
    return Math.max(0.42, Math.round((base - 0.18) * 100) / 100);
  }
  return Math.round(base * 100) / 100;
}
