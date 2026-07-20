/**
 * Business Optimization Platform - BusinessInterpretationEngine.
 * Converts structured findings into executive-level consulting language.
 *
 * This module runs in parallel. It does not replace existing PDF, audit,
 * proposal, Gmail, Drive, dashboard, menu, branding, or scoring workflows.
 */

function generateBusinessInterpretationCore_(input) {
  const context = normalizeBusinessInterpretationContext_(input || {});
  const findings = context.findings.length ? context.findings : [createFallbackBusinessInterpretationFinding_(context)];
  const interpretations = findings.map(function(finding) {
    return createBusinessInterpretation_(finding, context);
  });

  return {
    objectType: 'BusinessInterpretationResult',
    version: '1.0',
    company: context.company,
    website: context.website,
    industry: context.industry,
    generatedAt: new Date(),
    executiveSummary: generateExecutiveBusinessSummary_(context, interpretations),
    executiveNarrative: generateExecutiveNarrative_(context, interpretations),
    meetingTalkingPoints: generateMeetingTalkingPoints_(context, interpretations),
    interpretations: interpretations,
    metadata: {
      source: 'BusinessInterpretationEngine',
      findingCount: findings.length,
      confidence: calculateBusinessInterpretationConfidence_(interpretations)
    }
  };
}

function generateExecutiveBusinessSummary_(context, interpretations) {
  const companyText = context.company ? `${context.company}'s` : "the business's";
  const categoryText = summarizeBusinessInterpretationCategories_(interpretations);
  const highImpactCount = (interpretations || []).filter(function(item) {
    return item.riskLevel === 'High' || item.opportunityLevel === 'High';
  }).length;

  if (!interpretations || !interpretations.length) {
    return `We reviewed ${companyText} digital presence from the perspective of a potential customer. No major interpretation items are available yet, but the review should continue to focus on clarity, trust, visibility, and the customer path to contact.`;
  }

  const impactSentence = highImpactCount
    ? `${highImpactCount} item${highImpactCount === 1 ? '' : 's'} appear to have higher business impact and should be reviewed first.`
    : 'Most recommendations appear to be practical optimization opportunities rather than signs that the business needs to start over.';

  return `We reviewed ${companyText} digital presence from the perspective of a potential customer. Overall, we identified practical opportunities in ${categoryText} that could improve how customers discover, trust, and contact the business. ${impactSentence}`;
}

function generateBusinessImpactNarrative_(finding, context) {
  const category = String(finding.category || '').toLowerCase();
  const title = String(finding.title || '').toLowerCase();

  if (category.indexOf('contact') !== -1 || title.indexOf('phone') !== -1 || title.indexOf('contact') !== -1) {
    return 'Customers who are ready to contact the business may have difficulty locating the right contact path quickly, creating unnecessary friction during the buying process.';
  }
  if (category.indexOf('homepage') !== -1 || title.indexOf('headline') !== -1 || title.indexOf('service') !== -1) {
    return "The homepage may not immediately communicate the company's primary service or next step, making it harder for new visitors to understand whether the business can help them.";
  }
  if (category.indexOf('call') !== -1 || title.indexOf('call-to-action') !== -1 || title.indexOf('cta') !== -1) {
    return 'Visitors may not be given a clear next step after learning about the business, increasing the likelihood that they leave without making contact.';
  }
  if (category.indexOf('trust') !== -1 || title.indexOf('review') !== -1 || title.indexOf('testimonial') !== -1) {
    return 'The business may be missing an opportunity to build confidence before a customer decides whether to call, request a quote, or continue comparing options.';
  }
  if (category.indexOf('local') !== -1 || title.indexOf('service area') !== -1 || title.indexOf('location') !== -1) {
    return 'Customers and search engines may have less clarity about where the business operates, which can weaken local visibility and customer fit.';
  }
  if (category.indexOf('performance') !== -1 || title.indexOf('speed') !== -1) {
    return 'A slower or less reliable website experience can reduce customer patience and weaken the path from interest to inquiry.';
  }

  return firstNonBlank_([
    finding.businessImpact,
    `This issue may reduce clarity, trust, or customer action for ${context.company || 'the business'}, which can affect the number and quality of inquiries generated online.`
  ]);
}

function generateCustomerImpactNarrative_(finding, context) {
  const category = String(finding.category || '').toLowerCase();
  const title = String(finding.title || '').toLowerCase();

  if (category.indexOf('contact') !== -1 || title.indexOf('phone') !== -1) {
    return 'Customers may need to search longer than expected before they can call, email, or request help.';
  }
  if (category.indexOf('homepage') !== -1 || title.indexOf('headline') !== -1 || title.indexOf('service') !== -1) {
    return 'Customers may not understand what the business offers quickly enough to feel confident continuing.';
  }
  if (category.indexOf('call') !== -1 || title.indexOf('call-to-action') !== -1 || title.indexOf('cta') !== -1) {
    return 'Customers may be interested but unsure what action to take next.';
  }
  if (category.indexOf('trust') !== -1) {
    return 'Customers may not see enough proof to feel confident choosing the business over another option.';
  }
  if (category.indexOf('local') !== -1 || title.indexOf('service area') !== -1) {
    return 'Customers may be unsure whether the business serves their location.';
  }

  return firstNonBlank_([
    finding.customerImpact,
    'Customers may experience extra uncertainty or friction before deciding whether to contact the business.'
  ]);
}

function generateOpportunityStatement_(finding, context) {
  const category = String(finding.category || '').toLowerCase();
  if (category.indexOf('contact') !== -1) {
    return 'Improve the contact path so ready-to-act customers can reach the business with less effort.';
  }
  if (category.indexOf('homepage') !== -1) {
    return 'Improve the first impression so visitors understand the offer, location, and next step faster.';
  }
  if (category.indexOf('trust') !== -1) {
    return 'Strengthen confidence signals before customers decide whether to call or request service.';
  }
  if (category.indexOf('local') !== -1) {
    return 'Clarify local relevance so the business is easier to understand and easier to find.';
  }
  if (category.indexOf('lead') !== -1 || category.indexOf('call') !== -1) {
    return 'Make the inquiry path clearer so interested visitors are more likely to become qualified leads.';
  }
  return 'Turn a customer-facing friction point into a clearer path toward trust, understanding, and contact.';
}

function generateRecommendationNarrative_(finding, context) {
  const recommendation = finding.recommendation || {};
  const action = firstNonBlank_([
    recommendation.action,
    recommendation.summary,
    finding.recommendedAction
  ]);
  if (action) {
    return `${action} This matters because the improvement should make the customer path easier to understand and easier to act on.`;
  }

  const category = String(finding.category || '').toLowerCase();
  if (category.indexOf('contact') !== -1) {
    return 'Make the primary phone, email, contact, or quote path visible near the top of the website and repeat it in expected locations such as the footer and contact page.';
  }
  if (category.indexOf('homepage') !== -1) {
    return 'Tighten the first-screen message so it clearly explains what the business does, who it serves, and what the customer should do next.';
  }
  if (category.indexOf('trust') !== -1) {
    return 'Add practical proof points such as reviews, testimonials, years served, certifications, guarantees, or project examples near key decision points.';
  }
  return 'Prioritize the simplest improvement that makes the business easier to understand, trust, or contact.';
}

function generateExecutiveNarrative_(context, interpretations) {
  const topItems = (interpretations || []).slice(0, 3);
  if (!topItems.length) {
    return 'The current review should be used to confirm the highest-impact customer path improvements before recommending a scope of work.';
  }

  const focus = topItems.map(function(item) {
    return item.findingTitle;
  }).join('; ');

  return `The strongest business conversation should focus on practical improvements, not technical defects. The clearest discussion points are: ${focus}. Each recommendation should be connected to visibility, customer trust, and a simpler path to contact.`;
}

function generateMeetingTalkingPoints_(context, interpretations) {
  const points = [
    'Frame the conversation around customer clarity, trust, and ease of contact.',
    'Confirm whether this issue matches what the owner sees in real customer behavior.',
    'Ask which customer action matters most right now: calls, quote requests, bookings, or local visibility.'
  ];

  const highImpact = (interpretations || []).filter(function(item) {
    return item.expectedRoi === 'High' || item.opportunityLevel === 'High';
  })[0];

  if (highImpact) {
    points.unshift('This recommendation is one of the easiest improvements to discuss because it connects directly to customer action and business impact.');
  }

  return points;
}

function createBusinessInterpretation_(finding, context) {
  const riskLevel = mapBusinessInterpretationRiskLevel_(finding);
  const opportunityLevel = mapBusinessInterpretationOpportunityLevel_(finding);
  const confidence = getBusinessInterpretationConfidence_(finding, context);

  return {
    objectType: 'BusinessInterpretation',
    findingId: finding.id || '',
    findingTitle: finding.title || '',
    executiveSummary: generateFindingExecutiveSummary_(finding, context),
    businessImpact: generateBusinessImpactNarrative_(finding, context),
    customerImpact: generateCustomerImpactNarrative_(finding, context),
    riskLevel: riskLevel,
    opportunityLevel: opportunityLevel,
    revenueOpportunity: mapBusinessOpportunityDimension_(finding, ['lead', 'call', 'contact', 'quote', 'booking', 'conversion']),
    trustOpportunity: mapBusinessOpportunityDimension_(finding, ['trust', 'review', 'testimonial', 'proof', 'brand', 'logo']),
    visibilityOpportunity: mapBusinessOpportunityDimension_(finding, ['local', 'seo', 'search', 'service area', 'google']),
    customerExperienceOpportunity: mapBusinessOpportunityDimension_(finding, ['homepage', 'navigation', 'accessibility', 'performance', 'contact', 'call-to-action']),
    recommendedAction: generateRecommendationNarrative_(finding, context),
    estimatedDifficulty: finding.difficulty || 'Medium',
    expectedRoi: finding.expectedRoi || 'Medium',
    confidence: confidence,
    consultantNotes: buildBusinessInterpretationConsultantNotes_(finding, riskLevel, opportunityLevel, confidence)
  };
}

function generateFindingExecutiveSummary_(finding, context) {
  const title = String(finding.title || 'This finding').replace(/\.$/, '');
  const opportunity = generateOpportunityStatement_(finding, context);
  return `${title}. ${opportunity}`;
}

function normalizeBusinessInterpretationContext_(input) {
  const data = input || {};
  const prospect = data.prospect || data.business || data;
  const inspectionResult = data.inspectionResult || data.result || {};
  const inspection = data.inspection || {};
  const findings = normalizeBusinessInterpretationFindings_(
    data.findings || inspectionResult.findings || inspection.findings || []
  );

  return {
    company: data.company || prospect.company || inspectionResult.company || inspection.company || '',
    website: data.website || prospect.website || inspectionResult.website || inspection.website || '',
    industry: data.industry || prospect.industry || inspection.industry || '',
    prospect: prospect,
    inspection: inspection,
    inspectionResult: inspectionResult,
    findings: findings,
    sourceSummary: firstNonBlank_([
      data.summary,
      inspectionResult.summary,
      inspection.businessSummary,
      prospect.summary,
      prospect.notes
    ])
  };
}

function normalizeBusinessInterpretationFindings_(findings) {
  if (!findings) {
    return [];
  }
  if (Array.isArray(findings)) {
    return findings.filter(Boolean);
  }
  if (typeof findings === 'string') {
    return findings.split(/\n+/).map(function(line) {
      return line.trim();
    }).filter(Boolean).map(function(line, index) {
      return {
        id: 'TEXT-FINDING-' + (index + 1),
        title: line,
        description: line,
        severity: 'Medium',
        expectedRoi: 'Medium',
        difficulty: 'Medium',
        category: 'General'
      };
    });
  }
  return [];
}

function createFallbackBusinessInterpretationFinding_(context) {
  return {
    id: 'FALLBACK-FINDING',
    title: firstNonBlank_([
      context.sourceSummary,
      'Digital presence review needs business interpretation.'
    ]),
    description: context.sourceSummary,
    category: 'General',
    severity: 'Info',
    expectedRoi: 'Medium',
    difficulty: 'Medium',
    businessImpact: context.sourceSummary,
    customerImpact: ''
  };
}

function mapBusinessInterpretationRiskLevel_(finding) {
  const severity = String(finding.severity || '').toLowerCase();
  if (severity === 'critical' || severity === 'high') {
    return 'High';
  }
  if (severity === 'medium') {
    return 'Moderate';
  }
  return 'Low';
}

function mapBusinessInterpretationOpportunityLevel_(finding) {
  const roi = String(finding.expectedRoi || finding.expectedROI || '').toLowerCase();
  const priority = String(finding.priority || '').toLowerCase();
  if (roi === 'high' || priority.indexOf('p0') !== -1 || priority.indexOf('p1') !== -1) {
    return 'High';
  }
  if (roi === 'medium' || priority.indexOf('p2') !== -1) {
    return 'Moderate';
  }
  return 'Low';
}

function mapBusinessOpportunityDimension_(finding, terms) {
  const text = [
    finding.category,
    finding.title,
    finding.description,
    finding.businessImpact,
    finding.customerImpact
  ].join(' ').toLowerCase();
  return terms.some(function(term) {
    return text.indexOf(term) !== -1;
  }) ? 'High' : 'Moderate';
}

function getBusinessInterpretationConfidence_(finding, context) {
  const metadataConfidence = finding.metadata && finding.metadata.confidenceScore;
  if (metadataConfidence !== undefined && metadataConfidence !== null && metadataConfidence !== '') {
    return Number(metadataConfidence);
  }
  if (finding.evidence && finding.evidence.length) {
    return 0.82;
  }
  if (finding.description || finding.businessImpact || finding.customerImpact) {
    return 0.68;
  }
  return context.sourceSummary ? 0.55 : 0.45;
}

function calculateBusinessInterpretationConfidence_(interpretations) {
  const values = (interpretations || []).map(function(item) {
    return Number(item.confidence);
  }).filter(function(value) {
    return !Number.isNaN(value);
  });
  if (!values.length) {
    return 0;
  }
  const total = values.reduce(function(sum, value) {
    return sum + value;
  }, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function buildBusinessInterpretationConsultantNotes_(finding, riskLevel, opportunityLevel, confidence) {
  return [
    `Risk level: ${riskLevel}.`,
    `Opportunity level: ${opportunityLevel}.`,
    `Confidence: ${confidence}.`,
    'Use this interpretation to connect the finding to business outcomes during a meeting.'
  ].join(' ');
}

function summarizeBusinessInterpretationCategories_(interpretations) {
  const seen = {};
  const categories = (interpretations || []).map(function(item) {
    const title = String(item.findingTitle || '').toLowerCase();
    if (title.indexOf('phone') !== -1 || title.indexOf('contact') !== -1) {
      return 'contact accessibility';
    }
    if (title.indexOf('homepage') !== -1 || title.indexOf('headline') !== -1 || title.indexOf('service') !== -1) {
      return 'homepage clarity';
    }
    if (title.indexOf('trust') !== -1 || title.indexOf('review') !== -1) {
      return 'customer trust';
    }
    if (title.indexOf('local') !== -1 || title.indexOf('area') !== -1) {
      return 'local visibility';
    }
    return 'customer experience';
  }).filter(function(category) {
    if (seen[category]) {
      return false;
    }
    seen[category] = true;
    return true;
  });

  return categories.slice(0, 3).join(', ') || 'customer experience';
}
