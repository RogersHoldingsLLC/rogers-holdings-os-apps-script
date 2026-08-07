/**
 * Business Optimization Platform - Executive Business Intelligence Engine.
 * Builds deterministic, evidence-grounded consulting intelligence without
 * changing spreadsheet schemas, public APIs, lifecycle state, or audit scores.
 */

function generateExecutiveBusinessIntelligence_(input) {
  const context = normalizeExecutiveBusinessIntelligenceInput_(input || {});
  const evidence = normalizeExecutiveBusinessEvidence_(context);
  const profile = discoverExecutiveBusinessProfile_(context, evidence);
  const analysis = analyzeExecutiveBusiness_(profile, evidence);
  const opportunities = reviewExecutiveBusinessOpportunities_(
    prioritizeExecutiveBusinessOpportunities_(profile, analysis, evidence),
    evidence
  );
  const review = buildExecutiveBusinessReviewResult_(profile, evidence, opportunities);

  return {
    objectType: 'ExecutiveBusinessIntelligence',
    version: '1.0',
    businessProfile: profile,
    evidence: evidence,
    analysis: analysis,
    opportunities: opportunities,
    narrative: buildExecutiveBusinessNarrative_(profile, analysis, opportunities, review),
    review: review,
    metadata: {
      source: 'ExecutiveBusinessIntelligenceEngine',
      deterministic: true,
      evidenceCount: evidence.length,
      opportunityCount: opportunities.length,
      futureAiAdapter: 'Structured result may be passed to an approved adapter after consultant review.'
    }
  };
}

function normalizeExecutiveBusinessIntelligenceInput_(input) {
  const data = input || {};
  return {
    prospect: data.prospect || data.business || data,
    reportFile: data.reportFile || data.report || {},
    inspectionResult: data.inspectionResult || data.inspection || (data.reportFile && (data.reportFile.inspectionResult || data.reportFile.inspection)) || {},
    evidence: data.evidence || [],
    approved: data.approved === true
  };
}

function getBusinessClassificationContext_(prospect, reportFile) {
  const business = prospect || {};
  const report = reportFile || {};
  const text = [business.industry, business.company, business.offerService, business.summary, business.notes, report.text]
    .concat(executiveBusinessArray_(report.findings).map(function(item) { return item && (item.observation || item.description || item.title); }))
    .filter(Boolean).join(' ');
  const industry = executiveBusinessText_(business.industry) || inferExecutiveBusinessIndustry_(text) || 'Unknown';
  const model = inferExecutiveBusinessModel_(industry, text);
  const nonprofit = /church|nonprofit|non-profit|ministry|charity|foundation/i.test(industry + ' ' + model + ' ' + text);
  const professional = /consulting|digital optimization|professional services|b2b|business-to-business|logistics|industrial|freight/i.test(industry + ' ' + model + ' ' + text);
  const localService = /plumb|roof|dental|dentist|hvac|electrician|landscap|contractor|home service|local service business/i.test(industry + ' ' + model + ' ' + text);
  if (nonprofit) {
    return {
      type: 'nonprofit', industry: industry, businessModel: model,
      audiencePerspective: 'a participant, supporter, volunteer, member, or community stakeholder deciding how to engage',
      audience: 'participants, supporters, volunteers, members, and community stakeholders',
      priorities: ['Clarify the mission, programs, and ways to participate.', 'Strengthen visible proof of community impact and stewardship.', 'Make participation, support, volunteer, and contribution paths easy to understand.'],
      firstStep: 'Confirm the highest-priority participation or support journey during discovery.',
      visibilityLabel: 'Community Visibility',
      visibilityDescription: 'Mission, program, event, and community-discovery recommendations.'
    };
  }
  if (professional) {
    return {
      type: 'professional', industry: industry, businessModel: model,
      audiencePerspective: 'a business decision-maker or organizational buyer evaluating fit, credibility, and the next conversation',
      audience: 'business decision-makers and organizational buyers',
      priorities: ['Clarify capabilities and the business needs each service addresses.', 'Strengthen proof of expertise, outcomes, and delivery credibility.', 'Make the path to a qualified consultation or discovery conversation explicit.'],
      firstStep: 'Confirm the best-fit buyer, priority business need, and qualified discovery path.',
      visibilityLabel: 'Market Visibility',
      visibilityDescription: 'Capability, audience, proof, and relevant market-discovery recommendations.'
    };
  }
  if (localService) {
    return {
      type: 'local-service', industry: industry, businessModel: model,
      audiencePerspective: 'a local customer deciding whether to trust and contact the business',
      audience: 'local customers',
      priorities: ['Clarify services and service-area fit.', 'Strengthen visible trust and proof near decision points.', 'Make the call, booking, quote, or service-request path easy to use.'],
      firstStep: 'Confirm the highest-impact local customer action and service path.',
      visibilityLabel: 'Local Visibility',
      visibilityDescription: 'Service area, Google Business, and local discovery recommendations.'
    };
  }
  return {
    type: 'neutral', industry: industry, businessModel: model,
    audiencePerspective: 'a prospective customer or stakeholder evaluating the organization and its next step',
    audience: 'prospective customers and stakeholders',
    priorities: ['Clarify the offer and intended audience.', 'Strengthen credible proof at key decision points.', 'Make the inquiry or engagement path easy to understand.'],
    firstStep: 'Confirm the intended audience, priority need, and clearest next action.',
    visibilityLabel: 'Audience Visibility',
    visibilityDescription: 'Offer, audience, proof, and relevant discovery recommendations.'
  };
}

function normalizeExecutiveBusinessEvidence_(context) {
  const items = [];
  const seen = {};
  const prospect = context.prospect || {};
  const report = context.reportFile || {};
  const inspection = context.inspectionResult || {};

  function add(item, defaults) {
    const data = item || {};
    const base = defaults || {};
    const observation = executiveBusinessText_(data.observation || data.description || data.label || data.title || data.value || base.observation);
    const rawValue = data.rawValue !== undefined ? data.rawValue : (data.value !== undefined ? data.value : observation);
    if ((!observation && (rawValue === '' || rawValue === undefined || rawValue === null)) || executiveBusinessInternalText_(observation) || executiveBusinessInternalText_(rawValue)) return;
    const source = executiveBusinessText_(data.source || base.source || 'Provided business data');
    const pageUrl = executiveBusinessText_(data.pageUrl || data.sourceUrl || base.pageUrl || prospect.website);
    const category = executiveBusinessCategory_(data.category || data.type || base.category || 'General');
    const key = [source, pageUrl, category, observation, String(rawValue)].join('|').toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    const clientState = normalizeClientEvidenceItem_(Object.assign({}, base, data, {
      observation: observation,
      supportsStrength: data.supportsStrength === true || base.supportsStrength === true,
      supportsOpportunity: data.supportsOpportunity === true || base.supportsOpportunity === true
    }), getAssessmentConfidenceState_(prospect, report));
    items.push({
      id: executiveBusinessEvidenceId_(data.id, items.length + 1),
      source: source,
      pageUrl: pageUrl,
      pageType: executiveBusinessText_(data.pageType || base.pageType || 'Unknown'),
      category: category,
      claimType: 'Observed Fact',
      observation: observation || executiveBusinessText_(rawValue),
      rawValue: rawValue,
      confidence: executiveBusinessConfidence_(data.confidence, base.confidence),
      observedAt: data.observedAt || data.capturedAt || base.observedAt || '',
      supportsStrength: data.supportsStrength === true || base.supportsStrength === true,
      supportsOpportunity: data.supportsOpportunity === true || base.supportsOpportunity === true,
      requiresReview: data.requiresReview === true || base.requiresReview === true,
      status: clientState.status,
      clientFindingEligible: clientState.clientFindingEligible,
      recommendationEligible: clientState.recommendationEligible,
      outreachEligible: clientState.outreachEligible
    });
  }

  executiveBusinessArray_(context.evidence).forEach(function(item) { add(item); });
  executiveBusinessArray_(inspection.evidence).forEach(function(item) { add(item, { source: 'Inspection Engine' }); });
  executiveBusinessArray_(inspection.findings).forEach(function(finding) {
    executiveBusinessArray_(finding.evidence).forEach(function(item) {
      add(item, { source: 'Inspection Engine', category: finding.category, supportsOpportunity: true });
    });
    if (finding.title || finding.description) {
      add({
        id: finding.id,
        category: finding.category,
        observation: finding.description || finding.title,
        confidence: finding.metadata && finding.metadata.confidenceScore,
        supportsOpportunity: true
      }, { source: 'Inspection finding' });
    }
  });

  executiveBusinessArray_(report.evidence).forEach(function(item) { add(item, { source: 'Website Audit Tool API' }); });
  executiveBusinessArray_(report.findings).forEach(function(item) {
    add(item, { source: 'Website Audit Tool API', supportsOpportunity: true });
  });

  [
    ['Business identity', prospect.company, false],
    ['Website', prospect.website, false],
    ['Industry', prospect.industry, false],
    ['Primary services', prospect.primaryServices || prospect.offerService, false],
    ['Geographic market', [prospect.city, prospect.state].filter(Boolean).join(', '), false],
    ['Business summary', prospect.summary, false],
    ['Audit notes', prospect.notes, false],
    ['Competitive position', prospect.competitivePosition, false]
  ].forEach(function(entry) {
    if (entry[1]) add({ category: entry[0], observation: entry[0] + ': ' + entry[1], rawValue: entry[1], supportsStrength: entry[2] }, { source: 'Prospect record', confidence: entry[2] ? 0.95 : 0.7 });
  });

  return items.map(function(item, index) {
    item.id = executiveBusinessEvidenceId_(item.id, index + 1);
    return item;
  });
}

function discoverExecutiveBusinessProfile_(context, evidence) {
  const prospect = context.prospect || {};
  const evidenceText = evidence.map(function(item) { return item.observation; }).join(' ');
  const eligibleEvidence = evidence.filter(function(item) { return item.clientFindingEligible; });
  const industry = executiveBusinessText_(prospect.industry) || inferExecutiveBusinessIndustry_(evidenceText);
  const model = inferExecutiveBusinessModel_(industry, evidenceText);
  const primaryServices = executiveBusinessServices_(prospect, evidenceText, industry);
  const market = executiveBusinessText_([prospect.city, prospect.state].filter(Boolean).join(', ')) || executiveBusinessValueFromEvidence_(evidence, 'Geographic market');
  const trustSignals = executiveBusinessMatchingEvidence_(eligibleEvidence, /review|testimonial|licensed|insured|certif|years|family-owned|accredit|guarantee|case stud|project/i, true);
  const differentiators = executiveBusinessMatchingEvidence_(eligibleEvidence, /24\/7|emergency|family-owned|same-day|speciali|custom|nationwide|local|nonprofit|community/i, true);
  const uncertainties = [];
  if (!industry) uncertainties.push('Industry requires consultant review.');
  if (!primaryServices.length) uncertainties.push('Primary services are not established by available evidence.');
  if (!market) uncertainties.push('Geographic market is not established by available evidence.');
  if (!evidence.length) uncertainties.push('No normalized business evidence is available.');

  return {
    companyName: normalizeClientBusinessName_(executiveBusinessText_(prospect.company)) || 'Unknown',
    website: executiveBusinessText_(prospect.website) || 'Unknown',
    industry: industry || 'Unknown',
    businessModel: model || 'Unknown',
    customerType: inferExecutiveBusinessCustomerType_(industry, evidenceText),
    geographicMarket: market || 'Unknown',
    primaryServices: primaryServices,
    secondaryServices: executiveBusinessArray_(prospect.secondaryServices).map(executiveBusinessText_).filter(Boolean),
    targetCustomer: inferExecutiveBusinessTargetCustomer_(industry, model),
    likelyCustomerNeeds: inferExecutiveBusinessCustomerNeeds_(industry),
    buyingContext: inferExecutiveBusinessBuyingContext_(industry),
    conversionGoal: inferExecutiveBusinessConversionGoal_(industry, evidenceText),
    differentiators: differentiators,
    trustSignals: trustSignals,
    brandPosition: executiveBusinessText_(prospect.brandPosition) || 'Requires consultant review',
    businessStrengths: trustSignals.concat(differentiators).slice(0, 5),
    uncertainties: uncertainties,
    evidenceReferences: evidence.map(function(item) { return item.id; })
  };
}

function analyzeExecutiveBusiness_(profile, evidence) {
  const strengthItems = evidence.filter(function(item) { return item.supportsStrength && item.clientFindingEligible; });
  const opportunityItems = evidence.filter(function(item) { return item.supportsOpportunity && item.recommendationEligible; });
  const negative = opportunityItems.filter(function(item) { return executiveBusinessNegativeObservation_(item.observation); });
  const unclear = opportunityItems.filter(function(item) { return /unclear|missing|not visible|not found|unknown|difficult|weak|no clear/i.test(item.observation); });
  const strengths = executiveBusinessUnique_(profile.businessStrengths.concat(strengthItems.map(function(item) { return item.observation; }))).slice(0, 5);
  const trust = executiveBusinessMatchingEvidence_(evidence.filter(function(item) { return item.clientFindingEligible; }), /review|testimonial|licensed|insured|certif|guarantee|years|case stud|family-owned/i, false);
  const conversion = executiveBusinessMatchingEvidence_(opportunityItems, /call.to.action|cta|contact|quote|book|form|phone/i, false);
  const messaging = executiveBusinessMatchingEvidence_(opportunityItems, /headline|service|message|unclear|generic|position/i, false);
  const journey = [];
  if (profile.buyingContext !== 'Unknown') journey.push('The audience appears to face a ' + profile.buyingContext.toLowerCase() + ' decision.');
  if (profile.conversionGoal !== 'Unknown') journey.push('The primary next step appears to be ' + profile.conversionGoal.toLowerCase() + '.');
  unclear.slice(0, 2).forEach(function(item) { journey.push('Observed friction: ' + item.observation); });

  return {
    businessDescription: buildExecutiveBusinessDescription_(profile),
    customerDescription: profile.targetCustomer,
    strengths: strengths,
    frictionPoints: negative.map(function(item) { return item.observation; }).slice(0, 6),
    missedOpportunities: unclear.map(function(item) { return item.observation; }).slice(0, 6),
    credibilitySignals: trust.slice(0, 5),
    messagingGaps: messaging.filter(executiveBusinessNegativeObservation_).slice(0, 5),
    conversionGaps: conversion.filter(executiveBusinessNegativeObservation_).slice(0, 5),
    customerJourneyObservations: journey,
    strategicThemes: executiveBusinessStrategicThemes_(negative),
    consultantReviewItems: profile.uncertainties.concat(evidence.filter(function(item) { return item.requiresReview || item.confidence < 0.65; }).map(function(item) { return item.id + ': ' + item.observation; })).slice(0, 8)
  };
}

function prioritizeExecutiveBusinessOpportunities_(profile, analysis, evidence) {
  const candidates = [];
  evidence.filter(function(item) {
    return item.supportsOpportunity && item.recommendationEligible && executiveBusinessNegativeObservation_(item.observation);
  }).forEach(function(item) {
    const impactArea = executiveBusinessImpactArea_(item.category + ' ' + item.observation);
    candidates.push({
      title: executiveBusinessOpportunityTitle_(item.observation, impactArea),
      personalizedObservation: item.observation,
      observationType: 'Observed Fact',
      businessReason: executiveBusinessReason_(profile, impactArea),
      businessReasonType: 'Reasonable Interpretation',
      evidenceIds: [item.id],
      impactArea: impactArea,
      expectedImpact: item.confidence >= 0.8 ? 'High' : 'Medium',
      effort: executiveBusinessEffort_(item.observation),
      priority: item.confidence >= 0.8 ? 'P1 High' : 'P2 Normal',
      confidence: item.confidence,
      recommendedAction: executiveBusinessRecommendedAction_(profile, item.observation, impactArea),
      whyNow: executiveBusinessWhyNow_(profile, impactArea),
      consultantNote: item.requiresReview ? 'Confirm this observation before client delivery.' : 'Verify scope and owner priorities before implementation.',
      requiresReview: item.requiresReview || item.confidence < 0.65
    });
  });
  return candidates.sort(function(a, b) {
    return executiveBusinessPriorityScore_(b) - executiveBusinessPriorityScore_(a);
  });
}

function reviewExecutiveBusinessOpportunities_(opportunities, evidence) {
  const validEvidence = {};
  evidence.forEach(function(item) { validEvidence[item.id] = item; });
  const seen = {};
  return (opportunities || []).filter(function(item) {
    item.evidenceIds = executiveBusinessUnique_(item.evidenceIds || []).filter(function(id) { return !!validEvidence[id]; });
    if (!item.evidenceIds.length || executiveBusinessGenericRecommendation_(item.recommendedAction)) return false;
    const key = (item.impactArea + '|' + item.title).toLowerCase().replace(/[^a-z0-9|]+/g, ' ');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).slice(0, 4);
}

function buildExecutiveBusinessReviewResult_(profile, evidence, opportunities) {
  const grounded = evidence.filter(function(item) { return item.clientFindingEligible; });
  const observed = grounded.filter(function(item) { return item.source !== 'Prospect record'; });
  let status = 'Needs Consultant Review';
  if (grounded.length < 3 || !observed.length || profile.companyName === 'Unknown' || profile.industry === 'Unknown') status = 'Insufficient Evidence';
  return {
    status: status,
    allowedStatuses: ['Draft', 'Needs Consultant Review', 'Approved for Client', 'Insufficient Evidence'],
    clientDeliveryAllowed: false,
    reasons: status === 'Insufficient Evidence'
      ? ['At least three reliable business-specific evidence items, including an observed report item, a company identity, and an industry are required.']
      : ['Deterministic output requires consultant verification before client delivery.'],
    reviewItems: opportunities.filter(function(item) { return item.requiresReview; }).map(function(item) { return item.title; }).concat(profile.uncertainties)
  };
}

function buildExecutiveBusinessNarrative_(profile, analysis, opportunities, review) {
  const company = profile.companyName === 'Unknown' ? 'This business' : profile.companyName;
  const service = profile.primaryServices[0] || profile.industry.toLowerCase() + ' services';
  const market = profile.geographicMarket !== 'Unknown' ? ' in ' + profile.geographicMarket : '';
  const strength = analysis.strengths[0] || '';
  const top = opportunities[0];
  const opening = review.status === 'Insufficient Evidence'
    ? 'The available evidence is not yet sufficient for a client-ready consultation. Additional business discovery is required before recommendations are presented.'
    : company + ' appears to provide ' + service + market + ' for ' + profile.targetCustomer.toLowerCase() + '. The review focuses on how that specific buying journey can become clearer and more trustworthy.';
  return {
    consultantOpeningLetter: opening,
    executiveSummary: opening + (strength ? ' Available evidence also establishes a credible business strength.' : '') + (top ? ' The assessment identifies ' + opportunities.length + ' evidence-grounded priorit' + (opportunities.length === 1 ? 'y' : 'ies') + ' for action planning.' : ''),
    immediateStandout: strength || (top ? top.personalizedObservation : 'More evidence is required before identifying a defensible standout observation.'),
    recognizedStrengths: analysis.strengths,
    customerJourneySummary: analysis.customerJourneyObservations.join(' ') || 'The customer journey requires consultant review because the available evidence does not establish a reliable path.',
    topPriorities: opportunities.map(function(item) { return item.title; }),
    opportunityExplanations: opportunities.map(function(item) {
      return item.businessReason + ' ' + item.whyNow;
    }),
    closingConsultantNote: review.status === 'Insufficient Evidence'
      ? 'Complete business discovery and verify uncertain observations before client delivery.'
      : 'These priorities should be reviewed with the business owner, then narrowed to the simplest effective first move.',
    signature: 'Business Optimization Platform\nby Rogers Holdings LLC'
  };
}

function getExecutiveBusinessIntelligenceForReport_(prospect, reportFile) {
  return generateExecutiveBusinessIntelligence_({ prospect: prospect || {}, reportFile: reportFile || {} });
}

function executiveBusinessClientContent_(intelligence) {
  const result = intelligence || {};
  const review = result.review || {};
  if (review.status === 'Insufficient Evidence') {
    return { available: false };
  }
  const narrative = result.narrative || {};
  return {
    available: true,
    consultantOpeningLetter: executiveBusinessText_(narrative.consultantOpeningLetter),
    executiveSummary: executiveBusinessText_(narrative.executiveSummary),
    immediateStandout: executiveBusinessText_(narrative.immediateStandout),
    recognizedStrengths: executiveBusinessArray_(narrative.recognizedStrengths),
    customerJourneySummary: executiveBusinessText_(narrative.customerJourneySummary),
    topPriorities: executiveBusinessArray_(narrative.topPriorities),
    opportunityExplanations: executiveBusinessArray_(narrative.opportunityExplanations)
  };
}

function executiveBusinessArray_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter(Boolean) : []; } catch (error) { return []; }
  }
  return [];
}

function executiveBusinessText_(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function executiveBusinessConfidence_(value, fallback) {
  const number = Number(value === undefined || value === null || value === '' ? fallback : value);
  return Number.isNaN(number) ? 0.7 : Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}
function executiveBusinessEvidenceId_(value, index) {
  const clean = executiveBusinessText_(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'EBI-EVID-' + String(index).padStart(3, '0');
}
function executiveBusinessCategory_(value) {
  const text = executiveBusinessText_(value);
  return text || 'General';
}
function executiveBusinessValueFromEvidence_(evidence, category) {
  const match = evidence.filter(function(item) { return item.category === category; })[0];
  return match ? executiveBusinessText_(match.rawValue) : '';
}
function executiveBusinessUnique_(values) {
  const seen = {};
  return (values || []).map(executiveBusinessText_).filter(function(value) {
    const key = value.toLowerCase();
    if (!value || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
function executiveBusinessMatchingEvidence_(evidence, pattern, strengthsOnly) {
  return executiveBusinessUnique_((evidence || []).filter(function(item) {
    return (!strengthsOnly || item.supportsStrength) && pattern.test(item.observation);
  }).map(function(item) { return item.observation; }));
}
function inferExecutiveBusinessIndustry_(text) {
  const value = String(text || '').toLowerCase();
  if (/plumb|drain|water heater|sewer/.test(value)) return 'Plumbing';
  if (/roof|shingle|storm damage|gutter/.test(value)) return 'Roofing';
  if (/logistic|freight|warehouse|industrial|supply chain/.test(value)) return 'Logistics and Industrial Services';
  if (/church|ministry|worship|nonprofit|donat|community outreach/.test(value)) return 'Church or Nonprofit';
  if (/business consult|digital optimi|automation|ai-powered|artificial intelligence|google workspace|operational consult|website audit|business optimization/.test(value)) return 'Business Consulting and Digital Optimization';
  return '';
}
function inferExecutiveBusinessModel_(industry, text) {
  if (/church|nonprofit/i.test(industry)) return 'Mission-driven organization';
  if (/logistics|industrial/i.test(industry)) return 'B2B service provider';
  if (/plumbing|roofing/i.test(industry)) return 'Local service business';
  if (/consulting|digital optimization/i.test(industry) || /b2b|business-to-business/i.test(text)) return 'B2B professional services firm';
  if (/subscription|membership/i.test(text)) return 'Recurring-revenue service';
  return 'Unknown';
}
function inferExecutiveBusinessCustomerType_(industry) {
  if (/logistics|industrial/i.test(industry)) return 'Business';
  if (/church|nonprofit/i.test(industry)) return 'Community members and supporters';
  if (/plumbing|roofing/i.test(industry)) return 'Residential and property customers';
  if (/consulting|digital optimization/i.test(industry)) return 'Business and nonprofit leaders';
  return 'Unknown';
}
function inferExecutiveBusinessTargetCustomer_(industry, model) {
  if (/plumbing/i.test(industry)) return 'Homeowners and property managers who need prompt, trustworthy help';
  if (/roofing/i.test(industry)) return 'Property owners comparing a high-trust, high-consideration contractor';
  if (/logistics|industrial/i.test(industry)) return 'Operations and procurement leaders evaluating service reliability';
  if (/church|nonprofit/i.test(industry)) return 'People seeking participation, support, events, or ways to contribute';
  if (/consulting|digital optimization/i.test(industry)) return 'Business and nonprofit leaders seeking practical digital and operational improvement';
  return model === 'Unknown' ? 'Prospective customers whose needs require further discovery' : 'Prospective customers appropriate to this business model';
}
function inferExecutiveBusinessCustomerNeeds_(industry) {
  if (/plumbing/i.test(industry)) return ['Fast response', 'Clear service availability', 'Visible trust and contact information'];
  if (/roofing/i.test(industry)) return ['Proof of workmanship', 'Clear process and warranty', 'Confidence before requesting an estimate'];
  if (/logistics|industrial/i.test(industry)) return ['Capability fit', 'Operational reliability', 'Low-friction sales qualification'];
  if (/church|nonprofit/i.test(industry)) return ['Clear mission', 'Service and event information', 'Simple participation or donation path'];
  if (/consulting|digital optimization/i.test(industry)) return ['Clear capability fit', 'Credible proof of outcomes', 'A practical path from discovery to engagement'];
  return [];
}
function inferExecutiveBusinessBuyingContext_(industry) {
  if (/plumbing/i.test(industry)) return 'Urgent, local, trust-sensitive';
  if (/roofing/i.test(industry)) return 'High-consideration, proof-driven, locally competitive';
  if (/logistics|industrial/i.test(industry)) return 'Longer-cycle, capability-driven, multi-stakeholder';
  if (/church|nonprofit/i.test(industry)) return 'Relationship-led and mission-driven';
  if (/consulting|digital optimization/i.test(industry)) return 'Consultative, evidence-driven, multi-stakeholder';
  return 'Unknown';
}
function inferExecutiveBusinessConversionGoal_(industry, text) {
  if (/plumbing/i.test(industry)) return /book|schedule/i.test(text) ? 'Schedule service' : 'Call for service';
  if (/roofing/i.test(industry)) return 'Request an inspection or estimate';
  if (/logistics|industrial/i.test(industry)) return 'Start a qualified sales conversation';
  if (/church|nonprofit/i.test(industry)) return /donat/i.test(text) ? 'Visit, participate, or donate' : 'Visit or participate';
  if (/consulting|digital optimization/i.test(industry)) return 'Start a qualified discovery conversation';
  return 'Unknown';
}
function executiveBusinessServices_(prospect, text, industry) {
  const provided = executiveBusinessArray_(prospect.primaryServices).filter(function(item) { return !executiveBusinessInternalText_(item); });
  if (provided.length) return provided.map(executiveBusinessText_).filter(Boolean);
  if (prospect.offerService && !executiveBusinessInternalText_(prospect.offerService) && !/^website audit$/i.test(executiveBusinessText_(prospect.offerService))) return [executiveBusinessText_(prospect.offerService)];
  const candidates = [];
  if (/drain/i.test(text)) candidates.push('Drain cleaning');
  if (/water heater/i.test(text)) candidates.push('Water heater service');
  if (/emergency plumb/i.test(text)) candidates.push('Emergency plumbing');
  if (/roof repair/i.test(text)) candidates.push('Roof repair');
  if (/roof replacement/i.test(text)) candidates.push('Roof replacement');
  if (/freight/i.test(text)) candidates.push('Freight services');
  if (/warehouse/i.test(text)) candidates.push('Warehousing');
  if (/worship/i.test(text)) candidates.push('Worship services');
  if (/digital optimi/i.test(text)) candidates.push('Digital optimization');
  if (/automation/i.test(text)) candidates.push('Business automation');
  if (/ai-powered|artificial intelligence|\bai\b/i.test(text)) candidates.push('AI-powered tools');
  if (/google workspace/i.test(text)) candidates.push('Google Workspace solutions');
  if (/operational consult|business consult/i.test(text)) candidates.push('Business and operational consulting');
  return candidates.length ? executiveBusinessUnique_(candidates) : (industry ? [industry + ' services'] : []);
}
function buildExecutiveBusinessDescription_(profile) {
  if (profile.industry === 'Unknown') return 'Available evidence does not establish what the business does.';
  return profile.companyName + ' appears to operate as a ' + profile.businessModel.toLowerCase() + ' in ' + profile.industry + '.';
}
function executiveBusinessNegativeObservation_(value) { return /missing|not visible|not found|does not|unclear|weak|difficult|broken|slow|no clear|inconsistent|lacks?|without/i.test(String(value || '')); }
function executiveBusinessInternalText_(value) { return /\b(requires consultant review|review required|insufficient evidence|internal review|pending review)\b/i.test(String(value || '')); }
function executiveBusinessStrategicThemes_(items) { return executiveBusinessUnique_((items || []).map(function(item) { return executiveBusinessImpactArea_(item.category + ' ' + item.observation); })).slice(0, 4); }
function executiveBusinessImpactArea_(text) {
  const value = String(text || '').toLowerCase();
  if (/review|trust|testimonial|license|proof|certif/.test(value)) return 'Trust';
  if (/contact|call.to.action|cta|quote|book|form|phone|signup|sign up|volunteer/.test(value)) return 'Conversion';
  if (/local|search|google|service area|seo/.test(value)) return 'Visibility';
  if (/navigation|mobile|access|customer journey/.test(value)) return 'Customer Experience';
  if (/brand|message|headline|position/.test(value)) return 'Brand';
  if (/security|privacy|risk|broken/.test(value)) return 'Risk';
  if (/workflow|operation|process|automation/.test(value)) return 'Operations';
  return 'Revenue';
}
function executiveBusinessOpportunityTitle_(observation, area) {
  const text = String(observation || '').replace(/^[^:]+:\s*/, '').replace(/[.!?]+$/, '');
  return area + ': ' + text;
}
function executiveBusinessReason_(profile, area) {
  const context = profile.buyingContext !== 'Unknown' ? profile.buyingContext.toLowerCase() : 'evidence-sensitive';
  const goal = profile.conversionGoal !== 'Unknown' ? profile.conversionGoal.toLowerCase() : 'take the next step';
  if (area === 'Trust') return 'In a ' + context + ' decision, visible proof helps ' + profile.targetCustomer.toLowerCase() + ' feel confident enough to ' + goal + '.';
  if (area === 'Conversion') return 'The business depends on helping ' + profile.targetCustomer.toLowerCase() + ' ' + goal + ' without unnecessary friction.';
  if (area === 'Visibility') return 'Clear market and service signals help the right audience recognize that this business is relevant to their need.';
  return 'This observation affects how ' + profile.targetCustomer.toLowerCase() + ' understand and evaluate the business.';
}
function executiveBusinessRecommendedAction_(profile, observation, area) {
  if (area === 'Trust') return 'Place the strongest verified proof relevant to ' + profile.industry.toLowerCase() + ' near the decision point described in evidence.';
  if (area === 'Conversion') return 'Make the path to ' + profile.conversionGoal.toLowerCase() + ' explicit where the observed friction occurs.';
  if (area === 'Visibility') return 'Clarify the verified services and geographic market on the affected page before adding new marketing software.';
  if (area === 'Brand') return 'Clarify the intended customer and verified capability in the affected headline or message.';
  if (area === 'Customer Experience') return 'Improve the affected step in the current experience before considering a platform replacement.';
  return 'Correct the specific observed issue using the simplest change that preserves the current system.';
}
function executiveBusinessWhyNow_(profile, area) { return area + ' matters during the ' + (profile.buyingContext === 'Unknown' ? 'customer evaluation' : profile.buyingContext.toLowerCase()) + ' stage of this business’s customer journey.'; }
function executiveBusinessEffort_(text) { return /replace|redesign|migration|integration/i.test(text) ? 'High' : (/page|form|navigation|workflow/i.test(text) ? 'Medium' : 'Low'); }
function executiveBusinessPriorityScore_(item) { return (item.expectedImpact === 'High' ? 3 : 2) + (item.effort === 'Low' ? 2 : item.effort === 'Medium' ? 1 : 0) + Number(item.confidence || 0); }
function executiveBusinessGenericRecommendation_(text) {
  const value = executiveBusinessText_(text).toLowerCase();
  return !value || ['improve your website', 'improve seo', 'add a call to action', 'strengthen trust signals', 'optimize digital presence'].indexOf(value.replace(/[.!]+$/, '')) !== -1;
}
function executiveBusinessLowerSentence_(value) { const text = executiveBusinessText_(value).replace(/[.!?]+$/, ''); return text ? text.charAt(0).toLowerCase() + text.slice(1) : ''; }
