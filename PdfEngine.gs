/**
 * Rogers Holdings OS - PdfEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function buildAuditReportPdfBlob_(prospect, reportFile) {
  // PDF V3 CHANGE: add executive impression, divider sequencing, and score display guardrails.
  const reportText = getAuditReportTextFromReportFile_(reportFile);
  const findings = getSmartFindings_(prospect);
  const opportunities = buildAuditOpportunities_(prospect, findings, reportText);
  let consultingFindings = buildConsultingFindingCards_(prospect, opportunities, reportFile);
  consultingFindings = enforcePdfFindingEvidenceQuality_(prospect, reportFile, consultingFindings);
  const screenshotHtml = buildWebsiteScreenshotHtml_(prospect, reportFile);
  const nextStep = buildRecommendedNextStep_(prospect);
  const estimatedImpact = estimateAuditImpact_(prospect, consultingFindings);
  const estimatedOpportunity = estimateAuditOpportunity_(prospect, consultingFindings);
  const scoreDisplay = displayAuditScoreForPdf_(prospect, consultingFindings);
  const letterGrade = auditLetterGradeForPdf_(prospect, consultingFindings);
  const recommendedPackage = buildRecommendedPackage_(prospect);
  const html = buildBrandedPdfHtml_({
    title: 'Website & Digital Presence Review',
    subtitle: prospect.company,
    badge: 'Business Review',
    bodyHtml: [
      brandedPdfCoverHtml_('Website & Digital Presence Review', prospect.company, prospect.website, 'Business Review'),
      brandedPdfSectionHtml_('Executive Briefing', buildAuditExecutiveBriefingHtml_(
        prospect,
        consultingFindings,
        reportText,
        scoreDisplay,
        letterGrade,
        nextStep,
        estimatedImpact,
        estimatedOpportunity
      )),
      screenshotHtml,
      brandedPdfDividerPageHtml_('WEBSITE REVIEW FINDINGS'),
      brandedPdfSectionHtml_('Key Findings', consultingFindingCardsHtml_(consultingFindings)),
      brandedPdfSectionHtml_('PROOF OF FINDINGS', proofOfFindingsHtml_(prospect, reportFile, consultingFindings)),
      brandedPdfDividerPageHtml_('IMPROVEMENT ROADMAP'),
      brandedPdfSectionHtml_('Business Impact', businessImpactSectionHtml_(prospect, consultingFindings)),
      brandedPdfSectionHtml_('Quick Wins', quickWinsSectionHtml_(prospect, consultingFindings)),
      brandedPdfSectionHtml_('Improvement Roadmap', priorityRoadmapHtml_(prospect)),
      brandedPdfSectionHtml_('Digital Trust Checklist', trustChecklistHtml_(prospect)),
      brandedPdfSectionHtml_('Recommended Service Package', recommendedServicePackageHtml_(recommendedPackage)),
      buildCompetitivePositionSection_(prospect),
      brandedPdfDividerPageHtml_('RECOMMENDED NEXT STEPS'),
      brandedPdfSectionHtml_('Recommended Next Step', finalRecommendationHtml_(prospect, nextStep, estimatedImpact))
    ].filter(Boolean).join('')
  });
  return htmlToPdfBlob_(html, 'Audit Report.pdf');
}

function buildProposalPdfBlob_(prospect, proposal) {
  const recommendedPackage = buildRecommendedPackage_(prospect);
  const html = buildBrandedPdfHtml_({
    title: 'Digital Improvement Proposal',
    subtitle: prospect.company,
    badge: 'Proposal',
    bodyHtml: [
      brandedPdfCoverHtml_('Digital Improvement Proposal', prospect.company, prospect.website, 'Recommended Solution'),
      brandedPdfSectionHtml_('Thank You', proposalIntroHtml_(prospect)),
      brandedPdfSectionHtml_('What We Found', proposalFindingsSummaryHtml_(prospect)),
      brandedPdfSectionHtml_('Recommended Solution', proposalSolutionHtml_(prospect, recommendedPackage)),
      brandedPdfSectionHtml_('Deliverables', deliverableCardsHtml_(recommendedPackage.deliverables)),
      brandedPdfSectionHtml_('Timeline', projectRoadmapHtml_()),
      brandedPdfSectionHtml_('Why Rogers Holdings', whyRogersHoldingsHtml_()),
      brandedPdfSectionHtml_('Investment', proposalInvestmentHtml_(recommendedPackage)),
      brandedPdfSectionHtml_('Next Steps', proposalNextStepsHtml_(prospect)),
      brandedPdfSectionHtml_('Acceptance', acceptancePageHtml_(prospect, recommendedPackage))
    ].join('')
  });
  return htmlToPdfBlob_(html, 'Proposal.pdf');
}

function buildDiscoveryCallBriefPdfBlob_(prospect, startDate, durationMinutes) {
  const findings = getSmartFindings_(prospect);
  const html = buildBrandedPdfHtml_({
    title: 'Discovery Call Brief',
    subtitle: prospect.company,
    badge: 'Internal',
    bodyHtml: [
      brandedPdfCoverHtml_('Discovery Call Brief', prospect.company, 'Internal Rogers Holdings LLC document', 'Call preparation brief'),
      brandedPdfSectionHtml_('Prospect Information', executiveSummaryCardsHtml_([
        ['Call Time', formatDiscoveryDateTime_(startDate), 'status-gold'],
        ['Duration', `${durationMinutes} minutes`, 'status-black'],
        ['Audit Score', formatAuditScoreForPdf_(prospect.auditScore), scoreStatusClass_(prospect.auditScore)],
        ['Priority', prospect.priorityTier || 'Not assigned', priorityStatusClass_(prospect.priorityTier)]
      ]) + brandedPdfDefinitionListHtml_([
        ['Company', prospect.company],
        ['Contact', prospect.contact],
        ['Email', prospect.email],
        ['Phone', prospect.phone],
        ['Website', prospect.website],
        ['Call Time', formatDiscoveryDateTime_(startDate)],
        ['Duration', `${durationMinutes} minutes`]
      ])),
      brandedPdfSectionHtml_('Audit Findings', recommendationCardsHtml_(findings.length ? findings : splitTextForPdfList_(prospect.notes), 'Finding')),
      brandedPdfSectionHtml_('Recommendations', recommendationCardsHtml_(buildAuditRecommendations_(prospect, findings), 'Recommendation')),
      brandedPdfSectionHtml_('Call Preparation Notes', recommendationCardsHtml_([
        'Confirm the owner’s top business goal for the next 30-90 days.',
        'Ask what currently prevents more customers from calling or booking.',
        'Review the audit score in plain English.',
        'Recommend one practical next step before discussing larger scope.',
        'Confirm decision process, timeline, and budget comfort.'
      ], 'Prep'))
    ].join('')
  });
  return htmlToPdfBlob_(html, 'Discovery Call Brief.pdf');
}

function getAuditReportTextFromReportFile_(reportFile) {
  return String((reportFile && reportFile.text) || '').trim();
}

function buildAuditRecommendations_(prospect, findings) {
  const service = String(prospect.offerService || '').trim();
  const recommendations = [
    service ? `Start with ${service}.` : 'Start with the highest-impact website and local visibility improvements.',
    'Make the next customer action clear on key pages.',
    'Strengthen trust signals so visitors feel confident contacting the business.',
    'Improve local search clarity around services, location, and contact options.'
  ];

  if (findings && findings.length) {
    recommendations.push('Use the key findings as the first practical improvement checklist.');
  }

  return recommendations;
}

function auditLetterGradeForPdf_(prospect, findings) {
  const score = Number(displayAuditScoreForPdf_(prospect, findings));
  if (Number.isNaN(score)) {
    return 'Not Scored';
  }
  if (score >= 93) {
    return 'A';
  }
  if (score >= 85) {
    return 'B';
  }
  if (score >= 75) {
    return 'C';
  }
  if (score >= 65) {
    return 'D';
  }
  return 'F';
}

function buildCustomerFacingSummary_(prospect, reportText) {
  if (isNearPerfectAuditScore_(prospect)) {
    const template = getIndustryRecommendationTemplate_(prospect);
    return `The website shows a strong digital foundation for ${template.businessContext}. The best next moves are focused on growth, refinement, and turning a strong presence into more consistent customer action.`;
  }

  const candidate = firstNonBlank_([prospect.summary, reportText, prospect.notes]);
  const cleaned = sanitizeCustomerPdfText_(candidate);
  if (cleaned) {
    return trimPdfSummary_(cleaned);
  }

  return 'The website presents the business professionally and provides a solid foundation. The clearest opportunities are improving local visibility, strengthening trust signals, and making the customer’s next step easier.';
}

function sanitizeCustomerPdfText_(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const internalPattern = /\b(proposal sent|prospect|crm|pipeline|audit package|priority tier|tracked|internal|pursuit|implementation phase|converted after|lead status)\b/i;
  if (internalPattern.test(text)) {
    return '';
  }

  return text;
}

function trimPdfSummary_(text) {
  const sentences = String(text || '').match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length) {
    return sentences.slice(0, 2).join(' ').trim();
  }
  return String(text || '').slice(0, 420).trim();
}

function customerFacingAssessment_(prospect, findings) {
  // PDF V3 CHANGE: avoid credibility issues when a perfect score still has visible findings.
  if (hasPerfectScoreWithFindings_(prospect, findings)) {
    return 'Very Strong';
  }

  if (isNearPerfectAuditScore_(prospect)) {
    return 'Strong Digital Foundation';
  }

  const cleaned = sanitizeCustomerPdfText_(prospect && prospect.auditOutcome);
  return cleaned || 'Assessment complete';
}

function isNearPerfectAuditScore_(prospect) {
  const score = Number(prospect && prospect.auditScore);
  return !Number.isNaN(score) && score >= 95;
}

function hasPerfectScoreWithFindings_(prospect, findings) {
  // PDF V3 CHANGE: cap only the displayed PDF score, never the stored audit score.
  const score = Number(prospect && prospect.auditScore);
  return score === 100 && !!(findings && findings.length);
}

function displayAuditScoreForPdf_(prospect, findings) {
  // PDF V3 CHANGE: display 94/100 when score is 100 but findings still exist.
  if (hasPerfectScoreWithFindings_(prospect, findings)) {
    return '94/100';
  }
  return formatAuditScoreForPdf_(prospect && prospect.auditScore);
}

function buildAuditExecutiveBriefingHtml_(prospect, findings, reportText, scoreDisplay, letterGrade, nextStep, estimatedImpact, estimatedOpportunity) {
  const assessment = customerFacingAssessment_(prospect, findings);
  const strengths = buildBusinessStrengths_(prospect, findings);
  const opportunities = buildTopBusinessOpportunities_(prospect, findings);
  const narrative = buildConsultantNarrative_(prospect, findings, reportText, nextStep, estimatedImpact);

  return [
    '<div class="executive-brief">',
    '<div class="narrative-callout">',
    '<div class="callout-label">Consultant Summary</div>',
    `<p>${escapeHtml_(narrative)}</p>`,
    '</div>',
    '<div class="brief-grid">',
    '<div class="brief-primary">',
    '<h3>Overall Assessment</h3>',
    `<p>${escapeHtml_(assessment)}</p>`,
    '<div class="score-strip">',
    `<span><strong>${escapeHtml_(scoreDisplay)}</strong><small>Current Score</small></span>`,
    `<span><strong>${escapeHtml_(letterGrade)}</strong><small>Letter Grade</small></span>`,
    `<span><strong>${escapeHtml_(estimatedOpportunity)}</strong><small>Estimated Opportunity</small></span>`,
    '</div>',
    '</div>',
    '<div class="brief-primary">',
    '<h3>Recommended First Step</h3>',
    `<p>${escapeHtml_(nextStep)}</p>`,
    `<p class="muted-copy">Expected business impact: ${escapeHtml_(estimatedImpact || 'Medium')}. The first step should improve clarity, trust, and customer action before expanding into larger work.</p>`,
    '</div>',
    '</div>',
    twoColumnInsightHtml_('Business Strengths', strengths, 'Top Opportunities', opportunities),
    '<div class="impact-summary">',
    '<h3>Expected Business Impact</h3>',
    brandedPdfListHtml_(buildExecutiveImpactBullets_(prospect, findings)),
    '</div>',
    '</div>'
  ].join('');
}

function buildConsultantNarrative_(prospect, findings, reportText, nextStep, estimatedImpact) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const summary = buildCustomerFacingSummary_(prospect, reportText);
  const firstFinding = findings && findings.length ? findings[0] : null;
  const firstObservation = firstFinding ? sanitizeCustomerPdfText_(firstFinding.observation) : '';
  const opening = summary || `The business has a useful digital foundation for ${template.businessContext}, with the clearest opportunity around making trust, services, and the next customer action easier to understand.`;
  const observation = firstObservation
    ? `The most important pattern is this: ${firstObservation.charAt(0).toLowerCase()}${firstObservation.slice(1)}`
    : `The most important pattern is that customers need a clear path from interest to action.`;

  return `${opening} ${observation}. The recommended first step is ${String(nextStep || 'a focused discovery conversation').toLowerCase()}, with expected impact rated ${String(estimatedImpact || 'Medium').toLowerCase()} because the improvements connect directly to visibility, confidence, and inquiry flow.`;
}

function buildBusinessStrengths_(prospect, findings) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const strengths = [];
  const score = Number(prospect && prospect.auditScore);

  if (!Number.isNaN(score) && score >= 80) {
    strengths.push('The business already has a useful digital foundation to build from.');
  } else {
    strengths.push('The business has clear services and market value that can be presented more effectively online.');
  }

  strengths.push(`The strongest opportunities are practical, business-facing improvements for ${template.businessContext}.`);

  if (findings && findings.length) {
    strengths.push('The review produced specific next steps instead of vague technical recommendations.');
  } else {
    strengths.push('The recommended improvements can be prioritized without overcomplicating the website.');
  }

  return strengths.slice(0, 3);
}

function buildTopBusinessOpportunities_(prospect, findings) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const findingActions = (findings || []).map(function(finding) {
    return sanitizeCustomerPdfText_(finding.recommendedAction);
  }).filter(Boolean);

  return (findingActions.length ? findingActions : template.opportunities).slice(0, 3);
}

function buildExecutiveImpactBullets_(prospect, findings) {
  const template = getIndustryRecommendationTemplate_(prospect);
  return [
    `Make it easier for customers to understand and trust ${template.businessContext}.`,
    'Reduce friction between website visits and real inquiries.',
    'Improve the path from recommendation to measurable business outcome.'
  ];
}

function buildOverallBusinessImpression_(prospect, findings) {
  // PDF V3 CHANGE: add customer-facing overall impression to the executive summary.
  const template = getIndustryRecommendationTemplate_(prospect);
  if (hasPerfectScoreWithFindings_(prospect, findings) || isNearPerfectAuditScore_(prospect)) {
    return `The business has a very strong digital foundation. The best next step is refinement around ${template.opportunities[0].toLowerCase()}, ${template.opportunities[1].toLowerCase()}, and ${template.opportunities[2].toLowerCase()}`;
  }
  return `The business has clear room to improve customer-facing performance through ${template.opportunities[0].toLowerCase()}, ${template.opportunities[1].toLowerCase()}, and ${template.opportunities[2].toLowerCase()}`;
}

function estimateAuditImpact_(prospect, findings) {
  if (isNearPerfectAuditScore_(prospect)) {
    return 'Medium';
  }

  const score = Number(prospect.auditScore);
  const highImpactCount = (findings || []).filter(function(finding) {
    return String(finding.impactLevel || '').toLowerCase() === 'high';
  }).length;

  if ((!Number.isNaN(score) && score < 55) || highImpactCount >= 2) {
    return 'High';
  }
  if ((!Number.isNaN(score) && score < 75) || highImpactCount === 1) {
    return 'Medium';
  }
  return 'Medium';
}

function estimateAuditEffort_(prospect) {
  if (isNearPerfectAuditScore_(prospect)) {
    return 'Low';
  }

  const score = Number(prospect.auditScore);
  if (!Number.isNaN(score) && score < 45) {
    return 'High';
  }
  if (!Number.isNaN(score) && score < 75) {
    return 'Moderate';
  }
  return 'Low';
}

function estimateAuditOpportunity_(prospect, findings) {
  if (isNearPerfectAuditScore_(prospect)) {
    return 'Low';
  }

  const score = Number(prospect.auditScore);
  const categories = (findings || []).map(function(finding) {
    return String(finding.category || '').toLowerCase();
  }).join(' ');
  let opportunityScore = 0;

  if (Number.isNaN(score) || score < 55) {
    opportunityScore += 3;
  } else if (score < 75) {
    opportunityScore += 2;
  } else if (score < 90) {
    opportunityScore += 1;
  }

  if (categories.indexOf('trust') !== -1 || categories.indexOf('reviews') !== -1) {
    opportunityScore += 1;
  }
  if (categories.indexOf('local seo') !== -1 || categories.indexOf('google business') !== -1) {
    opportunityScore += 1;
  }
  if (categories.indexOf('conversion') !== -1 || categories.indexOf('call-to-action') !== -1) {
    opportunityScore += 1;
  }

  if (opportunityScore >= 4) {
    return 'High';
  }
  if (opportunityScore >= 2) {
    return 'Moderate';
  }
  return 'Low';
}

function opportunityStatusClass_(opportunity) {
  const value = String(opportunity || '').toLowerCase();
  if (value === 'high') {
    return 'status-red';
  }
  if (value === 'moderate') {
    return 'status-gold';
  }
  return 'status-green';
}

function buildAuditOpportunities_(prospect, findings, reportText) {
  // PDF V4 CHANGE: high-scoring audits get optimization opportunities, not weak problem language.
  if (isHighScoringAudit_(prospect)) {
    return buildGrowthOpportunityFindings_(prospect);
  }

  const opportunities = (findings && findings.length ? findings : splitTextForPdfList_(prospect.notes || reportText))
    .filter(function(item) {
      return String(item || '').trim();
    });
  if (opportunities.length >= 3) {
    return opportunities.slice(0, 5);
  }

  return opportunities.concat([
    'Clarify the customer path from landing on the site to contacting the business.',
    'Strengthen trust signals so visitors feel confident before reaching out.',
    'Improve local visibility cues around services, location, and next steps.'
  ]).slice(0, 5);
}

function isHighScoringAudit_(prospect) {
  const score = Number(prospect && prospect.auditScore);
  return !Number.isNaN(score) && score >= 90;
}

function buildGrowthOpportunityFindings_(prospect) {
  const key = inferIndustryKey_(prospect);
  const templates = {
    roofing: [
      'Increase local roofing visibility for high-value repair and replacement searches.',
      'Generate more estimate requests from homeowners who are ready to compare contractors.',
      'Strengthen homeowner trust with project proof, reviews, licenses, and service area clarity.',
      'Create clearer emergency repair and inspection paths for urgent customer needs.'
    ],
    dental: [
      'Increase appointment requests for new patients comparing local practices.',
      'Improve patient confidence with clearer credentials, reviews, services, and location details.',
      'Improve local search visibility for core treatment and appointment intent.',
      'Make the new-patient request path easier to complete on mobile.'
    ],
    logistics: [
      'Add more shipper proof and case studies.',
      'Improve freight inquiry conversion.',
      'Expand service area visibility.',
      'Add lane-specific landing pages.'
    ],
    default: [
      'Improve local visibility for customers comparing nearby options.',
      'Increase qualified inquiries with a clearer request path.',
      'Strengthen customer trust with stronger proof and service clarity.',
      'Expand service area visibility for higher-intent searches.'
    ]
  };
  return templates[key] || templates.default;
}

function buildRecommendedNextStep_(prospect) {
  if (isNearPerfectAuditScore_(prospect)) {
    return 'Growth Opportunities';
  }

  const service = String(prospect.offerService || '').trim();
  if (service) {
    return `Start with ${service}`;
  }
  return 'Schedule a short discovery conversation';
}

function twoColumnInsightHtml_(leftTitle, leftItems, rightTitle, rightItems) {
  return [
    '<div class="two-column">',
    `<div class="insight-panel"><h3>${escapeHtml_(leftTitle)}</h3>${brandedPdfListHtml_(leftItems)}</div>`,
    `<div class="insight-panel"><h3>${escapeHtml_(rightTitle)}</h3>${brandedPdfListHtml_(rightItems)}</div>`,
    '</div>'
  ].join('');
}

function priorityOpportunitiesHtml_(prospect) {
  const template = getIndustryRecommendationTemplate_(prospect);
  return [
    '<div class="summary-card priority-opportunities">',
    '<h3>Priority Opportunities</h3>',
    brandedPdfListHtml_(template.opportunities),
    '</div>'
  ].join('');
}

function getIndustryRecommendationTemplate_(prospect) {
  const key = inferIndustryKey_(prospect);
  const templates = {
    roofing: {
      businessContext: 'a local roofing business',
      opportunities: [
        'Increase local roofing visibility.',
        'Generate more estimate requests.',
        'Strengthen homeowner trust.'
      ],
      finalFocus: [
        'Clearer roofing service visibility.',
        'Stronger proof for homeowners comparing contractors.',
        'Easier estimate request paths.'
      ],
      roadmap: {
        quickWins: ['Make roof repair and replacement actions obvious.', 'Put estimate requests within the first screen.'],
        trust: ['Feature reviews, licenses, and project proof.', 'Clarify service areas and emergency availability.'],
        lead: ['Create dedicated repair, replacement, and inspection paths.', 'Reduce friction in the estimate request flow.'],
        growth: ['Track estimate sources.', 'Simplify follow-up after quote requests.']
      }
    },
    dental: {
      businessContext: 'a dental practice',
      opportunities: [
        'Increase appointment requests.',
        'Improve patient confidence.',
        'Improve local search visibility.'
      ],
      finalFocus: [
        'Clearer appointment paths.',
        'Stronger patient confidence before booking.',
        'Better local search visibility for core services.'
      ],
      roadmap: {
        quickWins: ['Make appointment requests easy to find.', 'Clarify accepted services and patient next steps.'],
        trust: ['Feature reviews, credentials, and patient comfort cues.', 'Clarify location, hours, and insurance expectations.'],
        lead: ['Create service-specific pages for high-value treatments.', 'Reduce friction in new patient requests.'],
        growth: ['Track appointment sources.', 'Simplify follow-up for new patient inquiries.']
      }
    },
    logistics: {
      businessContext: 'a logistics or transportation business',
      opportunities: [
        'Improve shipper credibility.',
        'Increase freight inquiry opportunities.',
        'Strengthen transportation visibility.'
      ],
      finalFocus: [
        'Clearer shipper credibility.',
        'Stronger freight inquiry paths.',
        'Better visibility for service lanes and capabilities.'
      ],
      roadmap: {
        quickWins: ['Clarify lanes, capabilities, and contact paths.', 'Make quote requests easy for shippers.'],
        trust: ['Add credentials, equipment, service areas, and proof points.', 'Strengthen reliability messaging.'],
        lead: ['Create dedicated freight inquiry paths.', 'Clarify who the business serves and where.'],
        growth: ['Track inquiry sources.', 'Simplify follow-up for quote requests.']
      }
    },
    default: {
      businessContext: 'a local business',
      opportunities: [
        'Improve local visibility.',
        'Increase customer inquiries.',
        'Strengthen customer confidence.'
      ],
      finalFocus: [
        'Clearer local visibility.',
        'Stronger trust signals.',
        'Easier customer action.'
      ],
      roadmap: {
        quickWins: ['Clarify the main customer action.', 'Make contact options obvious.'],
        trust: ['Surface reviews and proof points.', 'Clarify service areas.'],
        lead: ['Improve request and quote paths.', 'Create service-specific next steps.'],
        growth: ['Track inquiry sources.', 'Simplify follow-up.']
      }
    }
  };

  return templates[key] || templates.default;
}

function inferIndustryKey_(prospect) {
  const text = [
    prospect && prospect.industry,
    prospect && prospect.company,
    prospect && prospect.offerService,
    prospect && prospect.notes,
    prospect && prospect.summary
  ].join(' ').toLowerCase();

  if (textIncludesAny_(text, ['roof', 'roofing', 'shingle', 'gutter'])) {
    return 'roofing';
  }
  if (textIncludesAny_(text, ['dental', 'dentist', 'orthodont', 'patient'])) {
    return 'dental';
  }
  if (textIncludesAny_(text, ['logistics', 'freight', 'transport', 'trucking', 'shipper', 'carrier'])) {
    return 'logistics';
  }

  return 'default';
}

function getAuditEvidenceObject_(prospect, reportFile) {
  const provided = mergeEvidenceObjects_(
    normalizeEvidenceObject_(reportFile && (reportFile.evidence || reportFile.evidenceObject)),
    normalizeEvidenceObject_(prospect && (prospect.evidence || prospect.evidenceObject))
  );

  const captured = {
    website: captureWebsite(prospect, reportFile),
    mobile: captureMobile(prospect, reportFile),
    googleBusiness: captureGoogleBusiness(prospect, reportFile),
    pageSpeed: capturePageSpeed(prospect, reportFile),
    searchResults: captureSearchResults(prospect, reportFile),
    interpretation: generateBusinessInterpretation(prospect, reportFile)
  };

  return mergeEvidenceObjects_(captured, provided);
}

function normalizeEvidenceObject_(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return {};
}

function mergeEvidenceObjects_(base, override) {
  const result = {};
  [base || {}, override || {}].forEach(function(source) {
    Object.keys(source).forEach(function(key) {
      const current = result[key];
      const next = source[key];
      if (current && typeof current === 'object' && next && typeof next === 'object' && !Array.isArray(current) && !Array.isArray(next)) {
        result[key] = mergeEvidenceObjects_(current, next);
      } else if (next !== undefined && next !== null && next !== '') {
        result[key] = next;
      } else if (current === undefined) {
        result[key] = next;
      }
    });
  });
  return result;
}

function captureWebsite(prospect, reportFile) {
  return {
    type: 'website',
    screenshotDataUri: buildEvidenceImageDataUri_(
      reportFile && reportFile.screenshotBase64,
      reportFile && reportFile.screenshotMimeType
    ) || buildEvidenceImageDataUri_(
      prospect && prospect.websiteScreenshotBase64,
      prospect && prospect.websiteScreenshotMimeType
    ),
    screenshotUrl: firstNonBlank_([
      reportFile && reportFile.screenshotUrl,
      prospect && prospect.websiteScreenshotUrl
    ]),
    homepageText: firstNonBlank_([
      reportFile && reportFile.homepageText,
      reportFile && reportFile.pageText,
      prospect && prospect.homepageText
    ]),
    detectedElements: normalizeEvidenceObject_(reportFile && reportFile.detectedElements),
    missingElements: normalizeEvidenceArray_(reportFile && reportFile.missingElements)
  };
}

function captureMobile(prospect, reportFile) {
  return {
    type: 'mobile',
    screenshotDataUri: buildEvidenceImageDataUri_(
      reportFile && reportFile.mobileScreenshotBase64,
      reportFile && reportFile.mobileScreenshotMimeType
    ) || buildEvidenceImageDataUri_(
      prospect && prospect.mobileScreenshotBase64,
      prospect && prospect.mobileScreenshotMimeType
    ),
    screenshotUrl: firstNonBlank_([
      reportFile && reportFile.mobileScreenshotUrl,
      prospect && prospect.mobileScreenshotUrl
    ]),
    notes: firstNonBlank_([
      reportFile && reportFile.mobileNotes,
      prospect && prospect.mobileNotes
    ])
  };
}

function captureGoogleBusiness(prospect, reportFile) {
  return {
    type: 'google-business',
    profileUrl: firstNonBlank_([
      reportFile && reportFile.googleBusinessProfileUrl,
      prospect && prospect.googleBusinessProfileUrl
    ]),
    evidenceText: firstNonBlank_([
      reportFile && reportFile.googleBusinessEvidence,
      prospect && prospect.googleBusinessEvidence
    ]),
    status: firstNonBlank_([
      reportFile && reportFile.googleBusinessStatus,
      prospect && prospect.googleBusinessStatus
    ])
  };
}

function capturePageSpeed(prospect, reportFile) {
  return {
    type: 'page-speed',
    score: firstNonBlank_([
      reportFile && reportFile.pageSpeedScore,
      prospect && prospect.pageSpeedScore
    ]),
    loadTime: firstNonBlank_([
      reportFile && reportFile.loadTime,
      prospect && prospect.loadTime
    ]),
    evidenceText: firstNonBlank_([
      reportFile && reportFile.pageSpeedEvidence,
      prospect && prospect.pageSpeedEvidence
    ])
  };
}

function captureSearchResults(prospect, reportFile) {
  return {
    type: 'search-results',
    query: firstNonBlank_([
      reportFile && reportFile.searchQuery,
      prospect && prospect.searchQuery
    ]),
    rankSummary: firstNonBlank_([
      reportFile && reportFile.searchRankSummary,
      prospect && prospect.searchRankSummary
    ]),
    evidenceText: firstNonBlank_([
      reportFile && reportFile.searchEvidence,
      prospect && prospect.searchEvidence
    ])
  };
}

function annotateEvidence(evidenceObject, finding) {
  const category = finding && finding.category;
  const website = evidenceObject && evidenceObject.website || {};
  const annotations = normalizeEvidenceArray_(website.annotations).filter(function(annotation) {
    return !category || !annotation.category || String(annotation.category).toLowerCase() === String(category).toLowerCase();
  });
  return annotations.length ? annotations : [];
}

function generateBusinessInterpretation(prospect, reportFile) {
  return {
    type: 'business-interpretation',
    summary: firstNonBlank_([
      reportFile && reportFile.businessInterpretation,
      prospect && prospect.businessInterpretation,
      prospect && prospect.summary,
      prospect && prospect.notes
    ])
  };
}

function normalizeEvidenceArray_(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return value.split(',').map(function(item) {
        return item.trim();
      }).filter(Boolean);
    }
  }
  return [];
}

function buildEvidenceImageDataUri_(base64, mimeType) {
  if (!base64) {
    return '';
  }
  return `data:${escapeHtml_(mimeType || 'image/png')};base64,${base64}`;
}

function getEvidenceScreenshotUri_(evidenceObject) {
  const website = evidenceObject && evidenceObject.website || {};
  return firstNonBlank_([
    website.screenshotDataUri,
    website.screenshotUrl
  ]);
}

function getEvidenceMobileScreenshotUri_(evidenceObject) {
  const mobile = evidenceObject && evidenceObject.mobile || {};
  return firstNonBlank_([
    mobile.screenshotDataUri,
    mobile.screenshotUrl
  ]);
}

function getEvidenceDetailForCategory_(evidenceObject, category) {
  const website = evidenceObject && evidenceObject.website || {};
  const googleBusiness = evidenceObject && evidenceObject.googleBusiness || {};
  const pageSpeed = evidenceObject && evidenceObject.pageSpeed || {};
  const searchResults = evidenceObject && evidenceObject.searchResults || {};
  const interpretation = evidenceObject && evidenceObject.interpretation || {};
  const categoryKey = String(category || '').toLowerCase();

  if (categoryKey.indexOf('google') !== -1 && googleBusiness.evidenceText) {
    return {
      sourceType: 'google-business',
      sourceLabel: 'Google Business evidence',
      detail: googleBusiness.evidenceText
    };
  }

  if ((categoryKey.indexOf('local') !== -1 || categoryKey.indexOf('seo') !== -1) && searchResults.evidenceText) {
    return {
      sourceType: 'search-results',
      sourceLabel: 'Search results evidence',
      detail: searchResults.evidenceText
    };
  }

  if ((categoryKey.indexOf('speed') !== -1 || categoryKey.indexOf('technical') !== -1) && (pageSpeed.evidenceText || pageSpeed.score || pageSpeed.loadTime)) {
    return {
      sourceType: 'page-speed',
      sourceLabel: 'PageSpeed evidence',
      detail: pageSpeed.evidenceText || ['Score: ' + pageSpeed.score, 'Load time: ' + pageSpeed.loadTime].filter(function(item) {
        return item.indexOf('undefined') === -1 && item.indexOf(': ') !== item.length - 2;
      }).join(' | ')
    };
  }

  if (website.homepageText) {
    return {
      sourceType: 'page-content',
      sourceLabel: 'Homepage text evidence',
      detail: String(website.homepageText).slice(0, 280)
    };
  }

  if (interpretation.summary) {
    return {
      sourceType: 'business-interpretation',
      sourceLabel: 'Business interpretation',
      detail: interpretation.summary
    };
  }

  return null;
}

function buildConsultingFindingCards_(prospect, opportunities, reportFile) {
  const usedCategories = {};
  const usedActions = {};
  const cards = [];

  opportunities.forEach(function(opportunity, index) {
    if (cards.length >= 5) {
      return;
    }

    const category = categorizeFinding_(opportunity, usedCategories);
    const recommendedAction = buildFindingRecommendedAction_(category, opportunity, index, usedActions);
    const actionKey = recommendedAction.toLowerCase();
    if (usedActions[actionKey]) {
      return;
    }

    usedCategories[category] = true;
    usedActions[actionKey] = true;
    cards.push({
      category: category,
      impactLevel: getFindingImpactLevel_(prospect, index),
      observation: sanitizeCustomerPdfText_(opportunity) || fallbackObservationForCategory_(category),
      evidence: buildFindingEvidence_(prospect, reportFile, category, opportunity),
      businessImpact: buildFindingBusinessImpact_(category, opportunity),
      recommendedAction: recommendedAction
    });
  });

  return cards.length ? cards : defaultConsultingFindingCards_(prospect, reportFile);
}

function buildFindingEvidence_(prospect, reportFile, category, observation) {
  // PDF V4 CHANGE: prioritize real proof over audit score text.
  const evidenceObject = getAuditEvidenceObject_(prospect, reportFile);
  const aiEvidence = getEvidenceDetailForCategory_(evidenceObject, category);
  const screenshot = getEvidenceScreenshotUri_(evidenceObject);
  const realEvidence = buildRealFindingEvidenceDetail_(prospect, category, observation);
  if (aiEvidence && aiEvidence.detail) {
    return aiEvidence;
  }

  if (screenshot) {
    return {
      sourceType: 'screenshot',
      sourceLabel: 'Website screenshot',
      detail: realEvidence || evidenceDetailForCategory_(category)
    };
  }

  if (realEvidence) {
    return {
      sourceType: evidenceSourceTypeForCategory_(category),
      sourceLabel: evidenceSourceLabelForCategory_(category),
      detail: realEvidence
    };
  }

  const cleanObservation = sanitizeCustomerPdfText_(observation);
  if (cleanObservation) {
    return {
      sourceType: 'page-content',
      sourceLabel: 'Page content evidence',
      detail: cleanObservation
    };
  }

  const score = String(prospect && prospect.auditScore || '').trim();
  if (score) {
    return {
      sourceType: 'metric',
      sourceLabel: 'Supporting audit metric',
      detail: 'Audit score was used only because screenshot, homepage content, and specific detection evidence were not available.'
    };
  }

  return {
    sourceType: 'technical',
    sourceLabel: 'Technical finding evidence',
    detail: fallbackObservationForCategory_(category)
  };
}

function buildRealFindingEvidenceDetail_(prospect, category, observation) {
  const context = [
    prospect && prospect.summary,
    prospect && prospect.notes,
    observation
  ].join(' ').toLowerCase();
  const city = String(prospect && prospect.city || '').trim();
  const state = String(prospect && prospect.state || '').trim();
  const locationText = [city, state].filter(Boolean).join('/');

  if (category === 'Contact Visibility') {
    if (!textIncludesAny_(context, ['phone visible', 'phone number visible', 'call button visible'])) {
      return 'Phone number not visible above the fold.';
    }
    return 'Contact information should be easier to confirm from the first screen.';
  }

  if (category === 'Local SEO') {
    if (locationText) {
      return `No clear ${locationText} keywords detected in the homepage heading structure.`;
    }
    return 'No city/state keywords detected in homepage heading structure.';
  }

  if (category === 'Google Business Profile') {
    return 'No Google Business Profile link detected on website.';
  }

  if (category === 'Call-to-Action Clarity' || category === 'Conversion Path') {
    if (textIncludesAny_(context, ['quote', 'request', 'book', 'appointment', 'contact form'])) {
      return 'Primary customer action should be more visible and easier to complete from the homepage.';
    }
    return 'No visible quote request button found on homepage.';
  }

  if (category === 'Reviews / Trust Signals') {
    return 'No customer reviews, testimonials, certifications, or trust badges detected.';
  }

  if (category === 'Service Page Clarity') {
    return 'Service details and service area language are not clear enough from the first website impression.';
  }

  if (category === 'Mobile Usability') {
    return 'Mobile visitors need a clearer first-screen path to call, request, or confirm services.';
  }

  if (category === 'Speed / Technical Foundation') {
    if (textIncludesAny_(context, ['ssl', 'secure'])) {
      return 'Security and trust indicators should be confirmed as part of the technical foundation.';
    }
    return 'Technical foundation signals should be tightened so the website supports trust and conversion.';
  }

  const cleanObservation = sanitizeCustomerPdfText_(observation);
  return cleanObservation || '';
}

function evidenceSourceTypeForCategory_(category) {
  if (category === 'Contact Visibility' || category === 'Call-to-Action Clarity' || category === 'Conversion Path' || category === 'Reviews / Trust Signals') {
    return 'missing-element';
  }
  if (category === 'Local SEO' || category === 'Google Business Profile') {
    return 'page-content';
  }
  return 'technical';
}

function evidenceSourceLabelForCategory_(category) {
  const labels = {
    'Contact Visibility': 'Missing element detected',
    'Call-to-Action Clarity': 'Missing element detected',
    'Conversion Path': 'Missing element detected',
    'Reviews / Trust Signals': 'Missing trust signal detected',
    'Local SEO': 'Homepage text evidence',
    'Google Business Profile': 'Local visibility evidence',
    'Service Page Clarity': 'Homepage content evidence',
    'Mobile Usability': 'Customer experience evidence',
    'Speed / Technical Foundation': 'Technical finding evidence'
  };
  return labels[category] || 'Audit finding evidence';
}

function evidenceDetailForCategory_(category) {
  const details = {
    'Contact Visibility': 'Phone number, hours, or contact options are not prominent enough in the visible website experience.',
    'Call-to-Action Clarity': 'The primary customer action is not clear enough near the first website impression.',
    'Reviews / Trust Signals': 'Customer proof such as reviews, testimonials, certifications, or trust badges is not visible enough near decision points.',
    'Conversion Path': 'Quote, request, booking, or contact paths are not easy enough to identify.',
    'Service Page Clarity': 'Services and service areas need to be easier for a first-time visitor to confirm.',
    'Local SEO': 'Local service and location signals need to be clearer in the homepage content.',
    'Google Business Profile': 'Local discovery signals can be strengthened between the website and Google Business presence.',
    'Mobile Usability': 'The mobile experience needs a clearer path to call, request, or confirm services.',
    'Speed / Technical Foundation': 'Technical foundation signals can be improved to support confidence and customer action.'
  };
  return details[category] || 'The website evidence documents the customer-facing friction behind this finding.';
}

function categorizeFinding_(observation, usedCategories) {
  const text = String(observation || '').toLowerCase();
  const matches = [
    ['Contact Visibility', ['phone', 'contact', 'email', 'hours', 'address', 'call']],
    ['Local SEO', ['search', 'seo', 'meta', 'title', 'local visibility', 'service area']],
    ['Google Business Profile', ['google business', 'gbp', 'map', 'maps']],
    ['Reviews / Trust Signals', ['review', 'trust', 'credibility', 'proof', 'testimonial']],
    ['Mobile Usability', ['mobile', 'responsive', 'small screen']],
    ['Call-to-Action Clarity', ['call to action', 'cta', 'next step', 'button', 'request']],
    ['Service Page Clarity', ['service', 'offer', 'menu', 'pricing', 'scope']],
    ['Speed / Technical Foundation', ['speed', 'load', 'performance', 'ssl', 'secure', 'technical']],
    ['Conversion Path', ['conversion', 'form', 'lead', 'inquiry', 'quote', 'booking']]
  ];

  for (let index = 0; index < matches.length; index += 1) {
    const category = matches[index][0];
    const keywords = matches[index][1];
    if (!usedCategories[category] && keywords.some(function(keyword) { return text.indexOf(keyword) !== -1; })) {
      return category;
    }
  }

  for (let index = 0; index < matches.length; index += 1) {
    if (!usedCategories[matches[index][0]]) {
      return matches[index][0];
    }
  }

  return 'Digital Foundation';
}

function fallbackObservationForCategory_(category) {
  const observations = {
    'Contact Visibility': 'Important contact details can be made easier to find.',
    'Local SEO': 'Local search signals can be made clearer for nearby customers.',
    'Google Business Profile': 'Google Business visibility can be strengthened.',
    'Reviews / Trust Signals': 'Trust signals can be surfaced more clearly before a customer reaches out.',
    'Mobile Usability': 'Mobile visitors should be able to understand and act quickly.',
    'Call-to-Action Clarity': 'The next customer action can be made more obvious.',
    'Service Page Clarity': 'Core services can be explained more clearly.',
    'Speed / Technical Foundation': 'The technical foundation can better support customer confidence.',
    'Conversion Path': 'The inquiry path can be simplified.'
  };
  return observations[category] || 'The digital experience can be made clearer and easier to act on.';
}

function getFindingImpactLevel_(prospect, index) {
  const score = Number(prospect.auditScore);
  if (!Number.isNaN(score) && score < 50) {
    return index < 2 ? 'High' : 'Medium';
  }
  if (!Number.isNaN(score) && score < 70) {
    return index === 0 ? 'High' : 'Medium';
  }
  return index === 0 ? 'Medium' : 'Low';
}

function buildFindingBusinessImpact_(category, observation) {
  const text = String(observation || '').toLowerCase();
  if (category === 'Contact Visibility') {
    return 'Customers who are ready to call or request help may have to work too hard to connect.';
  }
  if (category === 'Local SEO' || category === 'Google Business Profile') {
    return 'Nearby customers may not clearly see the business when they are comparing local options.';
  }
  if (category === 'Reviews / Trust Signals') {
    return 'Visitors may need more proof before they feel confident enough to call or request a quote.';
  }
  if (category === 'Mobile Usability') {
    return 'Mobile visitors may leave before finding the information or action they need.';
  }
  if (category === 'Call-to-Action Clarity' || category === 'Conversion Path') {
    return 'Interested visitors may not move smoothly from attention to inquiry.';
  }
  if (category === 'Service Page Clarity') {
    return 'Customers may not quickly understand whether the business offers the exact service they need.';
  }
  if (category === 'Speed / Technical Foundation') {
    return 'Performance or trust issues can reduce confidence before the customer takes action.';
  }
  if (text.indexOf('search') !== -1 || text.indexOf('visibility') !== -1) {
    return 'The business may miss local discovery opportunities from ready-to-act customers.';
  }
  return 'The site may not convert attention into customer inquiries as effectively as it could.';
}

function buildFindingRecommendedAction_(category, observation, index, usedActions) {
  const text = String(observation || '').toLowerCase();
  const actionsByCategory = {
    'Contact Visibility': [
      'Place the phone number, hours, and request option where customers can find them quickly.',
      'Add a persistent contact path for mobile visitors.'
    ],
    'Local SEO': [
      'Clarify page titles, descriptions, services, and service area signals.',
      'Add location-focused service language that matches how local customers search.'
    ],
    'Google Business Profile': [
      'Align the website’s services, hours, and contact details with the Google Business Profile.',
      'Use the site to reinforce the same categories and service area shown on Google.'
    ],
    'Reviews / Trust Signals': [
      'Feature reviews, proof points, and credibility cues near key decision points.',
      'Add trust signals before the main request or quote action.'
    ],
    'Mobile Usability': [
      'Tighten the mobile first screen so the value and next step are visible immediately.',
      'Reduce mobile friction around calling, requesting, or confirming services.'
    ],
    'Call-to-Action Clarity': [
      'Improve the primary call-to-action near the top of the homepage.',
      'Use one clear next step instead of multiple competing actions.'
    ],
    'Service Page Clarity': [
      'Make the main services easier to understand within the first screen.',
      'Create clearer service sections that answer what is offered, where, and how to request help.'
    ],
    'Speed / Technical Foundation': [
      'Improve load speed, secure-page confidence, and technical basics that affect trust.',
      'Clean up technical friction before adding more marketing traffic.'
    ],
    'Conversion Path': [
      'Create a clearer path from interest to call, quote, or request.',
      'Simplify the inquiry flow so customers can act without second-guessing.'
    ]
  };

  const categoryActions = actionsByCategory[category] || [];
  for (let actionIndex = 0; actionIndex < categoryActions.length; actionIndex += 1) {
    const action = categoryActions[actionIndex];
    if (!usedActions || !usedActions[action.toLowerCase()]) {
      return action;
    }
  }

  if (text.indexOf('speed') !== -1) {
    return 'Prioritize the technical fixes that directly affect customer confidence and speed.';
  }

  const defaults = [
    'Tighten the homepage message so visitors understand the value faster.',
    'Add proof points that reduce hesitation before a customer reaches out.',
    'Improve local service cues so nearby customers can confirm fit quickly.',
    'Simplify the page flow so the next step is obvious.',
    'Make the inquiry path easier to follow from the first screen.'
  ];
  return defaults[index % defaults.length];
}

function defaultConsultingFindingCards_(prospect, reportFile) {
  return [
    {
      category: 'Local SEO',
      impactLevel: getFindingImpactLevel_(prospect, 0),
      observation: 'Local search signals can be made clearer for nearby customers.',
      evidence: buildFindingEvidence_(prospect, reportFile, 'Local SEO', 'Local search signals can be made clearer for nearby customers.'),
      businessImpact: 'Nearby customers may not clearly see the business when they are comparing local options.',
      recommendedAction: 'Clarify page titles, descriptions, services, and service area signals.'
    },
    {
      category: 'Reviews / Trust Signals',
      impactLevel: getFindingImpactLevel_(prospect, 1),
      observation: 'Trust signals can be surfaced more clearly before a customer reaches out.',
      evidence: buildFindingEvidence_(prospect, reportFile, 'Reviews / Trust Signals', 'Trust signals can be surfaced more clearly before a customer reaches out.'),
      businessImpact: 'Visitors may need more proof before they feel confident enough to call or request a quote.',
      recommendedAction: 'Feature reviews, proof points, and credibility cues near key decision points.'
    },
    {
      category: 'Conversion Path',
      impactLevel: getFindingImpactLevel_(prospect, 2),
      observation: 'The inquiry path can be simplified.',
      evidence: buildFindingEvidence_(prospect, reportFile, 'Conversion Path', 'The inquiry path can be simplified.'),
      businessImpact: 'Interested visitors may not move smoothly from attention to inquiry.',
      recommendedAction: 'Create a clearer path from interest to call, quote, or request.'
    }
  ];
}

function proofOfFindingsHtml_(prospect, reportFile, findings) {
  // PDF V4 CHANGE: proof cards require real evidence and avoid score-first proof.
  const evidenceObject = getAuditEvidenceObject_(prospect, reportFile);
  const screenshot = getEvidenceScreenshotUri_(evidenceObject);
  const items = (findings || []).slice(0, 5);
  if (!items.length) {
    return '<div class="summary-card"><p>No finding evidence available.</p></div>';
  }

  return items.map(function(finding, index) {
    return [
      '<div class="proof-card">',
      `<div class="proof-heading"><span>${escapeHtml_(finding.category)}</span><span>${escapeHtml_(finding.evidence && finding.evidence.sourceLabel || 'Audit evidence')}</span></div>`,
      screenshot ? annotatedFindingScreenshotHtml_(screenshot, finding, index, evidenceObject) : '',
      '<div class="proof-grid">',
      `<div><h3>Screenshot or Data Source</h3><p>${escapeHtml_(finding.evidence && finding.evidence.sourceLabel || 'Audit evidence')}</p></div>`,
      `<div><h3>Explanation</h3><p>${escapeHtml_(finding.evidence && finding.evidence.detail || finding.observation)}</p></div>`,
      `<div><h3>Why It Matters</h3><p>${escapeHtml_(finding.businessImpact)}</p></div>`,
      '</div>',
      '</div>'
    ].join('');
  }).join('');
}

function enforcePdfFindingEvidenceQuality_(prospect, reportFile, findings) {
  // PDF V4 CHANGE: reject generic score evidence before Audit Report PDF rendering.
  const evidenceObject = getAuditEvidenceObject_(prospect, reportFile);
  const screenshot = getEvidenceScreenshotUri_(evidenceObject);
  return (findings || []).map(function(finding) {
    const evidence = finding.evidence || {};
    const detail = String(evidence.detail || '').trim();
    const isScoreEvidence = detail.toLowerCase().indexOf('audit score:') !== -1;
    const needsRealEvidence = !detail || (screenshot && isScoreEvidence);
    if (!needsRealEvidence) {
      return finding;
    }

    const rebuiltEvidence = buildFindingEvidence_(prospect, reportFile, finding.category, finding.observation);
    if (rebuiltEvidence.detail && rebuiltEvidence.detail.toLowerCase().indexOf('audit score:') === -1) {
      return Object.assign({}, finding, { evidence: rebuiltEvidence });
    }

    return Object.assign({}, finding, {
      evidence: {
        sourceType: screenshot ? 'screenshot' : evidenceSourceTypeForCategory_(finding.category),
        sourceLabel: screenshot ? 'Website screenshot' : evidenceSourceLabelForCategory_(finding.category),
        detail: evidenceDetailForCategory_(finding.category)
      }
    });
  });
}

function annotatedFindingScreenshotHtml_(screenshot, finding, index, evidenceObject) {
  // PDF V4 CHANGE: draw numbered gold callouts directly over screenshot evidence.
  const aiAnnotations = annotateEvidence(evidenceObject, finding);
  const annotation = aiAnnotations.length ? aiAnnotations[0] : null;
  const placement = annotation && annotation.placement
    ? normalizeAnnotationPlacement_(annotation.placement)
    : annotationInlinePlacementForCategory_(finding.category, index);
  const label = annotation && annotation.label
    ? annotation.label
    : annotationLabelForCategory_(finding.category);
  const markerNumber = index + 1;
  return [
    '<div style="position:relative;border:1px solid #D8C7A4;background:#FFFFFF;padding:8px;margin:12px 0 16px;overflow:hidden;">',
    `<img src="${screenshot}" alt="Annotated website evidence" style="width:100%;max-height:260px;object-fit:cover;display:block;">`,
    `<div style="${placement.markerStyle}">${markerNumber}</div>`,
    `<div style="${placement.boxStyle}"><strong>${markerNumber}</strong> &rarr; ${escapeHtml_(label)}</div>`,
    `<div style="${placement.arrowStyle}"></div>`,
    '</div>'
  ].join('');
}

function normalizeAnnotationPlacement_(placement) {
  if (!placement || typeof placement !== 'object') {
    return annotationInlinePlacementForCategory_('', 0);
  }
  return {
    markerStyle: placement.markerStyle || 'position:absolute;right:22px;top:26px;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
    boxStyle: placement.boxStyle || 'position:absolute;right:20px;top:58px;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
    arrowStyle: placement.arrowStyle || 'position:absolute;right:84px;top:48px;width:92px;height:2px;background:#C8A15A;transform:rotate(-18deg);z-index:3;'
  };
}

function annotationInlinePlacementForCategory_(category, index) {
  const placements = {
    'Contact Visibility': {
      markerStyle: 'position:absolute;right:22px;top:26px;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;right:20px;top:58px;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
      arrowStyle: 'position:absolute;right:84px;top:48px;width:92px;height:2px;background:#C8A15A;transform:rotate(-18deg);z-index:3;'
    },
    'Call-to-Action Clarity': {
      markerStyle: 'position:absolute;left:50%;top:30px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;left:50%;top:62px;width:170px;margin-left:-85px;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;text-align:center;z-index:3;',
      arrowStyle: 'position:absolute;left:50%;top:54px;width:2px;height:70px;background:#C8A15A;z-index:3;'
    },
    'Reviews / Trust Signals': {
      markerStyle: 'position:absolute;right:24px;top:46%;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;right:20px;top:56%;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
      arrowStyle: 'position:absolute;right:94px;top:51%;width:110px;height:2px;background:#C8A15A;transform:rotate(12deg);z-index:3;'
    },
    'Service Page Clarity': {
      markerStyle: 'position:absolute;left:24px;top:44%;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;left:20px;top:54%;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
      arrowStyle: 'position:absolute;left:92px;top:50%;width:112px;height:2px;background:#C8A15A;transform:rotate(-10deg);z-index:3;'
    },
    'Local SEO': {
      markerStyle: 'position:absolute;left:24px;bottom:38px;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;left:20px;bottom:72px;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
      arrowStyle: 'position:absolute;left:96px;bottom:58px;width:118px;height:2px;background:#C8A15A;transform:rotate(15deg);z-index:3;'
    },
    'Conversion Path': {
      markerStyle: 'position:absolute;right:24px;bottom:38px;width:24px;height:24px;border-radius:50%;background:#C8A15A;color:#05070A;text-align:center;line-height:24px;font-weight:700;font-size:12px;z-index:4;',
      boxStyle: 'position:absolute;right:20px;bottom:72px;border:2px solid #C8A15A;background:rgba(5,7,10,.88);color:#FFFFFF;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;z-index:3;',
      arrowStyle: 'position:absolute;right:96px;bottom:58px;width:118px;height:2px;background:#C8A15A;transform:rotate(-15deg);z-index:3;'
    }
  };
  const fallback = [
    placements['Contact Visibility'],
    placements['Service Page Clarity'],
    placements['Conversion Path'],
    placements['Reviews / Trust Signals']
  ];
  return placements[category] || fallback[index % fallback.length];
}

function annotationPlacementForCategory_(category, index) {
  const placements = {
    'Contact Visibility': { boxClass: 'annotation-top-right', arrowClass: 'arrow-top-right' },
    'Call-to-Action Clarity': { boxClass: 'annotation-top-center', arrowClass: 'arrow-top-center' },
    'Reviews / Trust Signals': { boxClass: 'annotation-mid-right', arrowClass: 'arrow-mid-right' },
    'Conversion Path': { boxClass: 'annotation-bottom-right', arrowClass: 'arrow-bottom-right' },
    'Service Page Clarity': { boxClass: 'annotation-mid-left', arrowClass: 'arrow-mid-left' },
    'Local SEO': { boxClass: 'annotation-bottom-left', arrowClass: 'arrow-bottom-left' },
    'Google Business Profile': { boxClass: 'annotation-bottom-left', arrowClass: 'arrow-bottom-left' },
    'Mobile Usability': { boxClass: 'annotation-top-center', arrowClass: 'arrow-top-center' }
  };
  const fallback = [
    { boxClass: 'annotation-top-right', arrowClass: 'arrow-top-right' },
    { boxClass: 'annotation-mid-left', arrowClass: 'arrow-mid-left' },
    { boxClass: 'annotation-bottom-right', arrowClass: 'arrow-bottom-right' }
  ];
  return placements[category] || fallback[index % fallback.length];
}

function annotationLabelForCategory_(category) {
  const labels = {
    'Contact Visibility': 'Contact visibility',
    'Call-to-Action Clarity': 'Primary customer action',
    'Reviews / Trust Signals': 'Trust proof',
    'Conversion Path': 'Inquiry path',
    'Service Page Clarity': 'Service clarity',
    'Local SEO': 'Local visibility',
    'Google Business Profile': 'Local discovery signal',
    'Mobile Usability': 'Mobile next step',
    'Speed / Technical Foundation': 'Technical friction'
  };
  return labels[category] || 'Evidence point';
}

function consultingFindingCardsHtml_(findings) {
  return (findings || []).map(function(finding) {
    const impactClass = impactStatusClass_(finding.impactLevel);
    const evidenceDetail = finding.evidence && finding.evidence.detail ? String(finding.evidence.detail) : '';
    const evidenceLabel = finding.evidence && finding.evidence.sourceLabel ? String(finding.evidence.sourceLabel) : 'Supporting evidence';
    return [
      '<div class="finding-card">',
      '<div class="finding-card-top">',
      `<span class="finding-category">${escapeHtml_(finding.category)}</span>`,
      `<span class="impact-pill ${impactClass}">${escapeHtml_(finding.impactLevel)} Impact</span>`,
      '</div>',
      `<h3>Finding</h3><p>${escapeHtml_(finding.observation)}</p>`,
      `<h3>Why This Matters</h3><p>${escapeHtml_(buildFindingWhyThisMatters_(finding))}</p>`,
      `<h3>Business Impact</h3><p>${escapeHtml_(finding.businessImpact)}</p>`,
      `<h3>Recommended Action</h3><p>${escapeHtml_(finding.recommendedAction)}</p>`,
      evidenceDetail ? `<div class="finding-evidence"><strong>${escapeHtml_(evidenceLabel)}:</strong> ${escapeHtml_(evidenceDetail)}</div>` : '',
      '</div>'
    ].join('');
  }).join('');
}

function buildFindingWhyThisMatters_(finding) {
  const category = String(finding && finding.category || '').toLowerCase();
  if (category.indexOf('contact') !== -1 || category.indexOf('call') !== -1) {
    return 'Customers who are ready to call, book, or request help should not have to search for the next step.';
  }
  if (category.indexOf('trust') !== -1 || category.indexOf('review') !== -1) {
    return 'Trust signals help customers feel confident before they decide to contact the business.';
  }
  if (category.indexOf('local') !== -1 || category.indexOf('google') !== -1) {
    return 'Local visibility helps the right customers find the business when they are comparing nearby options.';
  }
  if (category.indexOf('mobile') !== -1) {
    return 'Many customers make decisions from a phone, so the mobile experience must make action simple.';
  }
  if (category.indexOf('service') !== -1) {
    return 'Clear service information helps customers quickly decide whether the business can solve their problem.';
  }
  return 'This matters because small points of friction can reduce trust, delay action, and cost the business qualified inquiries.';
}

function impactStatusClass_(impactLevel) {
  const value = String(impactLevel || '').toLowerCase();
  if (value === 'high') {
    return 'impact-high';
  }
  if (value === 'medium') {
    return 'impact-medium';
  }
  return 'impact-low';
}

function priorityRoadmapHtml_(prospect) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const roadmap = template.roadmap;
  const phases = [
    {
      phase: 'Phase 1',
      title: 'Quick Wins',
      actions: roadmap.quickWins,
      outcomes: 'More visitors understand what to do next.'
    },
    {
      phase: 'Phase 2',
      title: 'Trust & Credibility',
      actions: roadmap.trust,
      outcomes: 'Customers feel safer choosing the business.'
    },
    {
      phase: 'Phase 3',
      title: 'Lead Generation',
      actions: roadmap.lead,
      outcomes: 'More calls, form submissions, and qualified conversations.'
    },
    {
      phase: 'Phase 4',
      title: 'Automation & Growth',
      actions: roadmap.growth,
      outcomes: 'A cleaner rhythm for long-term growth.'
    }
  ];

  return '<div class="roadmap-grid">' + phases.map(function(item) {
    return [
      '<div class="roadmap-card">',
      `<div class="roadmap-phase">${escapeHtml_(item.phase)}</div>`,
      `<h3>${escapeHtml_(item.title)}</h3>`,
      brandedPdfListHtml_(item.actions),
      `<p class="outcome-line">${escapeHtml_(item.outcomes)}</p>`,
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

function trustChecklistHtml_(prospect) {
  const text = [
    prospect.notes,
    prospect.summary,
    prospect.auditOutcome
  ].join(' ').toLowerCase();
  const checks = [
    ['Reviews Visible', !textIncludesAny_(text, ['missing review', 'reviews not visible', 'no reviews'])],
    ['SSL Enabled', !textIncludesAny_(text, ['ssl missing', 'not secure', 'no https', 'missing ssl'])],
    ['Mobile Friendly', !textIncludesAny_(text, ['not mobile', 'mobile issue', 'mobile friendly: no'])],
    ['Contact Form', !textIncludesAny_(text, ['missing contact form', 'no contact form'])],
    ['Google Business Profile', !textIncludesAny_(text, ['missing google business', 'gbp missing', 'no google business'])],
    ['Clear Call To Action', !textIncludesAny_(text, ['missing call to action', 'missing cta', 'no call to action'])],
    ['Service Area Coverage', !textIncludesAny_(text, ['missing service area', 'service area unclear'])]
  ];

  return '<div class="checklist-grid">' + checks.map(function(check) {
    const passed = check[1];
    return [
      `<div class="checklist-item ${passed ? 'check-pass' : 'check-improve'}">`,
      `<span class="check-status">${passed ? 'Pass' : 'Improve'}</span>`,
      `<span class="check-label">${escapeHtml_(check[0])}</span>`,
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

function buildCompetitivePositionSection_(prospect) {
  const competitiveText = firstNonBlank_([
    prospect.competitivePosition,
    prospect.competitorSummary,
    prospect.competitors
  ]);
  if (!competitiveText) {
    return '';
  }

  return brandedPdfSectionHtml_('Competitive Position', [
    '<div class="summary-card">',
    `<p>${escapeHtml_(competitiveText)}</p>`,
    '</div>',
    '<div class="indicator-row">',
    '<span class="indicator active">Your Business</span>',
    '<span class="indicator">Nearby Alternatives</span>',
    '<span class="indicator">Improvement Opportunity</span>',
    '</div>'
  ].join(''));
}

function finalRecommendationHtml_(prospect, nextStep, estimatedImpact) {
  const contact = getRogersContactInfo_();
  const estimatedEffort = estimateAuditEffort_(prospect);
  const template = getIndustryRecommendationTemplate_(prospect);
  return [
    '<div class="conclusion-panel">',
    '<h3>Recommended Next Step</h3>',
    '<p>The next step should be simple: confirm the highest-impact improvement, define the first scope of work, and connect that work to a business result the owner can recognize.</p>',
    '<div class="next-step-flow">',
    '<div><strong>Finding</strong><span>Customer-facing friction or missed visibility.</span></div>',
    '<div><strong>Improvement</strong><span>Practical website, trust, or inquiry-path update.</span></div>',
    '<div><strong>Outcome</strong><span>More confidence, clearer action, and better inquiry quality.</span></div>',
    '<div><strong>Discovery Call</strong><span>Confirm scope, timing, and the first move.</span></div>',
    '</div>',
    '<p>Based on this review, the highest-return improvements are:</p>',
    brandedPdfListHtml_(template.finalFocus),
    '<div class="final-metrics">',
    `<div class="metric-card"><div class="metric-label">Estimated Effort</div><div class="metric-value">${escapeHtml_(estimatedEffort)}</div></div>`,
    `<div class="metric-card"><div class="metric-label">Expected Impact</div><div class="metric-value">${escapeHtml_(estimatedImpact || 'Medium')}</div></div>`,
    '</div>',
    '<h3>Schedule a short discovery conversation.</h3>',
    `<p>Use that conversation to confirm the next best improvement and align the first step around ${escapeHtml_(nextStep)}.</p>`,
    '<div class="contact-card">',
    `<strong>${escapeHtml_(contact.name)}</strong><br>`,
    `${escapeHtml_(contact.company)}<br>`,
    contact.email ? `${escapeHtml_(contact.email)}<br>` : '',
    contact.phone ? `${escapeHtml_(contact.phone)}<br>` : '',
    '</div>',
    '</div>'
  ].join('');
}

function buildRecommendedPackage_(prospect) {
  const service = String(prospect.offerService || 'Website Audit').trim();
  const investmentRange = recommendedInvestmentRangeForService_(service);
  const highScore = isNearPerfectAuditScore_(prospect);
  return {
    name: highScore ? 'Growth & Optimization Review' : 'Digital Visibility & Conversion Improvement Package',
    scope: 'A focused improvement engagement built around the highest-impact opportunities for customer trust, local visibility, and a clearer inquiry path.',
    timeline: '2-4 weeks',
    service: service,
    investmentRange: investmentRange,
    investment: 'Final investment confirmed after scope review.',
    outcome: highScore ? 'Refine an already strong presence into clearer growth opportunities.' : 'Clearer customer action, local visibility, and trust signals.',
    deliverables: [
      ['Strategy', 'Business goal alignment, improvement planning, and a clear action sequence.'],
      ['Website Improvements', 'Messaging, call-to-action, trust, and lead capture improvements.'],
      ['Local Visibility', 'Service area, Google Business, and local discovery recommendations.'],
      ['Systems', 'Simple inquiry and follow-up workflow recommendations.']
    ]
  };
}

function businessImpactSectionHtml_(prospect, findings) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const impactItems = [
    `Help customers quickly understand why ${template.businessContext} should be trusted.`,
    'Reduce friction between a visitor landing on the website and taking the next step.',
    'Make contact options, service details, and credibility signals easier to find.',
    'Support better local visibility by clarifying services, location, and customer intent.'
  ];

  if (isHighScoringAudit_(prospect)) {
    impactItems[0] = 'Turn an already credible digital presence into more consistent customer action.';
    impactItems[1] = 'Use stronger proof points and clearer calls-to-action to improve conversion quality.';
  }

  return [
    '<div class="impact-panel">',
    '<p class="section-subtitle">The purpose of this review is not to list technical issues. It is to identify practical improvements that can help the business earn trust, create clarity, and make customer action easier.</p>',
    recommendationCardsHtml_(impactItems, 'Impact'),
    '</div>'
  ].join('');
}

function quickWinsSectionHtml_(prospect, findings) {
  const template = getIndustryRecommendationTemplate_(prospect);
  const actions = ((template.roadmap && template.roadmap.quickWins) || []).slice(0, 4);
  const fallbackActions = [
    'Make phone, quote, booking, or contact options visible near the top of key pages.',
    'Clarify the primary services and service area in plain English.',
    'Add or improve trust signals such as reviews, testimonials, certifications, project examples, or guarantees.',
    'Simplify the next step so customers know exactly how to request help.'
  ];

  return recommendationCardsHtml_(actions.length ? actions : fallbackActions, 'Quick Win');
}

function recommendedServicePackageHtml_(recommendedPackage) {
  return [
    '<div class="solution-panel">',
    `<h3>${escapeHtml_(recommendedPackage.name)}</h3>`,
    '<p>This package is recommended because it focuses first on the improvements most likely to create customer confidence and clearer inquiry flow.</p>',
    brandedPdfDefinitionListHtml_([
      ['Recommended Service', recommendedPackage.service],
      ['Primary Outcome', recommendedPackage.outcome],
      ['Typical Timeline', recommendedPackage.timeline],
      ['Investment Range', recommendedPackage.investmentRange],
      ['Scope', recommendedPackage.scope]
    ]),
    '</div>'
  ].join('');
}

function recommendedInvestmentRangeForService_(service) {
  const key = String(service || '').toLowerCase();
  const ranges = [
    ['website audit', '$199 - $399'],
    ['google business optimization', '$399 - $799'],
    ['local seo', '$499 - $1,250'],
    ['ai automation', '$750 - $2,500'],
    ['business systems', '$1,000 - $3,500'],
    ['client website', '$1,500 - $5,000'],
    ['monthly support', '$299 - $999/mo'],
    ['one-time project', '$499 - $2,500'],
    ['consulting', '$150 - $250/hr']
  ];

  for (let index = 0; index < ranges.length; index += 1) {
    if (key.indexOf(ranges[index][0]) !== -1) {
      return ranges[index][1];
    }
  }

  return '$499 - $2,500';
}

function proposalIntroHtml_(prospect) {
  return [
    '<div class="summary-card executive-summary">',
    `<h3>Thank you, ${escapeHtml_(prospect.company || 'team')}.</h3>`,
    '<p>This proposal translates the website review into a practical improvement plan. It focuses on what customers see, what may slow them down, and what should be improved first to create more trust, visibility, and qualified inquiries.</p>',
    '<p>The recommendation is intentionally focused. The goal is not to add unnecessary technology. The goal is to create a clearer digital foundation that supports real customer decisions.</p>',
    '</div>'
  ].join('');
}

function proposalFindingsSummaryHtml_(prospect) {
  const findings = getSmartFindings_(prospect).slice(0, 5);
  const values = findings.length ? findings : [
    'Customers should be able to quickly understand what the business offers.',
    'Trust signals should be visible before a customer decides to call or request help.',
    'The next step should be simple, clear, and easy to find.'
  ];

  return [
    '<div class="narrative-callout">',
    '<div class="callout-label">What this means</div>',
    '<p>The findings point to the same business goal: help customers understand the offer faster, feel more confident, and know exactly how to take the next step.</p>',
    '</div>',
    recommendationCardsHtml_(values, 'Finding')
  ].join('');
}

function proposalSolutionHtml_(prospect, recommendedPackage) {
  return [
    '<div class="solution-panel">',
    `<h3>${escapeHtml_(recommendedPackage.name)}</h3>`,
    '<p>The recommended solution is focused on practical improvements that can help customers move from interest to inquiry with less friction.</p>',
    brandedPdfDefinitionListHtml_([
      ['Service', recommendedPackage.service],
      ['Outcome', recommendedPackage.outcome],
      ['Recommended Investment Range', recommendedPackage.investmentRange],
      ['Final Investment', recommendedPackage.investment],
      ['Timeline', recommendedPackage.timeline],
      ['Scope', recommendedPackage.scope],
    ]),
    '</div>'
  ].join('');
}

function deliverableCardsHtml_(deliverables) {
  return '<div class="deliverable-grid">' + (deliverables || []).map(function(item, index) {
    return [
      '<div class="deliverable-card">',
      `<div class="deliverable-icon">${String(index + 1).padStart(2, '0')}</div>`,
      `<h3>${escapeHtml_(item[0])}</h3>`,
      `<p>${escapeHtml_(item[1])}</p>`,
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

function projectRoadmapHtml_() {
  return timelineHtml_([
    'Discovery: confirm goals and constraints.',
    'Planning: define the highest-impact improvements.',
    'Build: complete approved updates.',
    'Refinement: improve messaging and customer flow.',
    'Launch: publish and confirm next steps.'
  ]);
}

function proposalInvestmentHtml_(recommendedPackage) {
  return [
    '<div class="solution-panel">',
    '<h3>Investment</h3>',
    '<p>Final investment is confirmed after scope review so the work matches the actual business need and avoids unnecessary spend.</p>',
    brandedPdfDefinitionListHtml_([
      ['Recommended Range', recommendedPackage.investmentRange],
      ['Final Investment', recommendedPackage.investment],
      ['Timeline', recommendedPackage.timeline],
      ['Scope Basis', 'Final scope and start date will be confirmed before work begins.']
    ]),
    '</div>'
  ].join('');
}

function proposalNextStepsHtml_(prospect) {
  const contact = getRogersContactInfo_();
  return [
    '<div class="conclusion-panel">',
    '<h3>Recommended Next Steps</h3>',
    '<div class="next-step-flow">',
    '<div><strong>1. Review</strong><span>Confirm the findings and business priorities.</span></div>',
    '<div><strong>2. Align</strong><span>Choose the first improvement tied to the clearest outcome.</span></div>',
    '<div><strong>3. Scope</strong><span>Confirm timeline, investment, and responsibilities.</span></div>',
    '<div><strong>4. Begin</strong><span>Schedule kickoff and execute the first approved improvement.</span></div>',
    '</div>',
    '<p>The recommended discovery conversation should confirm the most important business goal for the next 30-90 days, then turn this proposal into a clear starting plan.</p>',
    '<div class="contact-card">',
    `<strong>${escapeHtml_(contact.name)}</strong><br>`,
    `${escapeHtml_(contact.company)}<br>`,
    contact.email ? `${escapeHtml_(contact.email)}<br>` : '',
    contact.phone ? `${escapeHtml_(contact.phone)}<br>` : '',
    '</div>',
    '</div>'
  ].join('');
}

function whyRogersHoldingsHtml_() {
  return [
    '<div class="why-panel">',
    '<p class="section-subtitle">Rogers Holdings LLC approaches this work as a business improvement project, not a technology project for its own sake.</p>',
    '<div class="deliverable-grid">',
    '<div class="deliverable-card"><h3>Practical Recommendations</h3><p>Focus first on improvements that a business owner and customer can both recognize.</p></div>',
    '<div class="deliverable-card"><h3>Business-First Approach</h3><p>Connect website decisions to visibility, trust, inquiry quality, and customer experience.</p></div>',
    '<div class="deliverable-card"><h3>No Unnecessary Technology</h3><p>Recommend only what supports the business goal and avoids needless complexity.</p></div>',
    '<div class="deliverable-card"><h3>Clear Communication</h3><p>Keep the work understandable, scoped, and aligned around measurable improvement.</p></div>',
    '</div>',
    '</div>'
  ].join('');
}

function acceptancePageHtml_(prospect, recommendedPackage) {
  const contact = getRogersContactInfo_();
  return [
    '<div class="acceptance-panel">',
    '<h3>Approval</h3>',
    `<p><strong>Business:</strong> ${escapeHtml_(prospect.company || '')}</p>`,
    `<p><strong>Summary:</strong> ${escapeHtml_(recommendedPackage.name)}</p>`,
    '<p>Final scope, investment, and start date will be confirmed before work begins.</p>',
    '<div class="signature-row"><span>Authorized Signature</span><span>Date</span></div>',
    '<div class="signature-row"><span>Rogers Holdings LLC</span><span>Date</span></div>',
    '<div class="contact-card">',
    `<strong>${escapeHtml_(contact.name)}</strong><br>`,
    `${escapeHtml_(contact.company)}<br>`,
    contact.email ? `${escapeHtml_(contact.email)}<br>` : '',
    contact.phone ? `${escapeHtml_(contact.phone)}<br>` : '',
    '</div>',
    '</div>'
  ].join('');
}

function getPdfDesignSystem_() {
  return {
    colors: {
      black: '#111111',
      charcoal: '#05070a',
      text: '#171717',
      gold: '#d6a84f',
      goldDark: '#b88728',
      goldSoft: '#d8c7a4',
      goldBorder: '#e6dac2',
      paper: '#ffffff',
      neutral: '#fbfaf7',
      coverNeutral: '#f7f4ed',
      muted: '#6f6a60',
      success: '#2f6f45',
      warning: '#b88728',
      danger: '#8a2f2f'
    },
    typography: {
      family: 'Arial, sans-serif',
      bodySize: '12px',
      bodyLineHeight: '1.55',
      cardLineHeight: '1.5',
      sectionTitleSize: '24px',
      coverTitleSize: '48px',
      coverClientSize: '34px',
      metricValueSize: '21px',
      cardTitleSize: '13px',
      labelSize: '9px',
      sectionLabelSize: '11px',
      footerSize: '9px'
    },
    spacing: {
      pageTop: '82px',
      pageX: '48px',
      pageBottom: '18px',
      cardPadding: '16px',
      cardGap: '14px',
      sectionGap: '30px',
      footerX: '44px',
      headerHeight: '54px'
    },
    borders: {
      card: '1px solid #d8c7a4',
      light: '1px solid #e6dac2',
      section: '2px solid #d6a84f',
      dark: '1px solid #111111'
    },
    radius: {
      card: '6px',
      small: '4px',
      browser: '8px',
      pill: '20px'
    },
    shadows: {
      card: '0 4px 14px rgba(0,0,0,.04)',
      cover: '18px 0 38px rgba(0,0,0,.18)',
      device: '0 10px 26px rgba(0,0,0,.12)'
    },
    components: {
      pageShell: 'buildBrandedPdfHtml_',
      cover: 'brandedPdfCoverHtml_',
      section: 'brandedPdfSectionHtml_',
      divider: 'brandedPdfDividerPageHtml_',
      summaryCards: 'executiveSummaryCardsHtml_',
      recommendationCards: 'recommendationCardsHtml_',
      definitionList: 'brandedPdfDefinitionListHtml_',
      footer: 'fixed footer inside buildBrandedPdfHtml_'
    }
  };
}

function buildBrandedPdfHtml_(document) {
  const design = getPdfDesignSystem_();
  const colors = design.colors;
  const typography = design.typography;
  const spacing = design.spacing;
  const borders = design.borders;
  const radius = design.radius;
  const shadows = design.shadows;
  const assets = getRogersBrandPdfAssets_();
  const contact = getRogersContactInfo_();
  const coverStyle = assets.coverBackground
    ? `background-image: linear-gradient(90deg, rgba(255,255,255,.94), rgba(255,255,255,.86)), url('${assets.coverBackground}');`
    : `background: ${colors.coverNeutral};`;
  const watermarkHtml = assets.watermark
    ? `<img class="watermark" src="${assets.watermark}" alt="">`
    : '';
  const logoHtml = assets.primaryLogo
    ? `<img class="pdf-logo" src="${assets.primaryLogo}" alt="Rogers Holdings LLC">`
    : '<div class="pdf-logo-text">Rogers Holdings LLC</div>';
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; }
          body { margin: 0; font-family: ${typography.family}; color: ${colors.text}; background: ${colors.paper}; }
          .doc-shell { position: relative; }
          .watermark { position: fixed; right: 34px; bottom: 34px; width: 150px; opacity: .045; z-index: 0; }
          .header { position: fixed; top: 0; left: 0; right: 0; height: ${spacing.headerHeight}; padding: 14px ${spacing.footerX} 0; border-bottom: ${borders.light}; background: rgba(255,255,255,.94); z-index: 4; }
          .footer { position: fixed; left: ${spacing.footerX}; right: ${spacing.footerX}; bottom: 18px; border-top: ${borders.light}; padding-top: 8px; font-size: ${typography.footerSize}; color: ${colors.muted}; text-transform: uppercase; letter-spacing: 1px; z-index: 4; }
          .pdf-logo { height: 34px; width: auto; object-fit: contain; }
          .pdf-logo-text { color: ${colors.black}; font-size: ${typography.bodySize}; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
          .cover { min-height: 710px; color: ${colors.text}; padding: 0; background-size: cover; background-position: center; ${coverStyle} page-break-after: always; position: relative; z-index: 5; overflow: hidden; }
          .cover-side-panel { position: absolute; left: 0; top: 0; bottom: 0; width: 36%; padding: 52px 34px; background: linear-gradient(180deg, ${colors.charcoal}, ${colors.text}); border-right: 5px solid ${colors.gold}; box-shadow: ${shadows.cover}; box-sizing: border-box; }
          .cover-main { position: absolute; left: 36%; top: 0; right: 0; bottom: 0; padding: 88px 58px 58px 62px; box-sizing: border-box; }
          .cover-logo { width: 132px; height: auto; background: ${colors.paper}; border: 1px solid ${colors.gold}; padding: 8px; margin-bottom: 28px; display: block; }
          .cover-logo-text { color: ${colors.paper}; font-size: ${typography.cardTitleSize}; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 34px; }
          .cover-gold-rule { width: 78px; height: 3px; background: ${colors.gold}; margin: 22px 0 26px; }
          .cover-title { margin: 0 0 18px; font-size: ${typography.coverTitleSize}; line-height: .98; letter-spacing: 0; color: #0e0e0e; }
          .cover-subtitle { color: ${colors.goldDark}; font-size: ${typography.bodySize}; text-transform: uppercase; letter-spacing: 1.7px; font-weight: 700; margin: 0 0 48px; }
          .customer-feature { margin-top: 0; padding: 22px 0 0; border-top: ${borders.card}; }
          .customer-label { color: ${colors.muted}; font-size: ${typography.labelSize}; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; margin-bottom: 10px; }
          .customer-name { color: ${colors.black}; font-size: ${typography.coverClientSize}; font-weight: 700; line-height: 1.08; }
          .cover-reference { color: #5f5a51; font-size: 12px; margin-top: 14px; line-height: 1.5; }
          .cover-date { margin-top: 24px; color: ${colors.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; }
          .cover-motto { position: absolute; left: 34px; bottom: 42px; color: rgba(214,168,79,.82); font-size: 10px; text-transform: uppercase; letter-spacing: 1.6px; }
          .cover-accent-top { position: absolute; right: 48px; top: 46px; width: 170px; height: 2px; background: ${colors.gold}; }
          .cover-accent-bottom { position: absolute; right: 48px; bottom: 46px; width: 230px; height: 2px; background: ${colors.gold}; }
          .cover-accent-corner { position: absolute; right: 48px; top: 58px; width: 2px; height: 84px; background: ${colors.text}; opacity: .34; }
          .brand { color: ${colors.paper}; font-size: 14px; line-height: 1.35; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; }
          h1 { margin: 16px 0 12px; font-size: 36px; line-height: 1.08; }
          h2 { margin: 0 0 18px; font-size: ${typography.sectionTitleSize}; color: ${colors.black}; border-bottom: ${borders.section}; padding-bottom: 10px; page-break-after: avoid; }
          h3 { margin: 0 0 8px; font-size: ${typography.cardTitleSize}; color: ${colors.black}; page-break-after: avoid; }
          .cover .meta { margin-top: 16px; color: #f4ead7; font-size: 13px; line-height: 1.6; }
          .badge { display: inline-block; padding: 7px 11px; border: 1px solid ${colors.gold}; color: ${colors.gold}; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
          .section { padding: ${spacing.pageTop} ${spacing.pageX} ${spacing.pageBottom}; page-break-inside: auto; position: relative; z-index: 1; }
          .section-title-large { font-size: ${typography.sectionTitleSize}; letter-spacing: 0; }
          .section + .section { padding-top: ${spacing.sectionGap}; }
          .section-subtitle { color: #4f4a42; font-size: 13px; margin: -6px 0 18px; }
          p, li, dd, dt { font-size: ${typography.bodySize}; line-height: ${typography.bodyLineHeight}; }
          ul { margin: 0; padding-left: 20px; }
          li { margin-bottom: 7px; }
          dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 18px; }
          dt { font-weight: 700; color: ${colors.black}; }
          dd { margin: 0; }
          .score { font-size: 44px; color: ${colors.goldDark}; font-weight: 700; margin-bottom: 8px; }
          .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: ${spacing.cardGap}; margin-bottom: ${spacing.cardGap}; }
          .metric-card, .recommendation-card, .summary-card, .price-card, .solution-panel { border: ${borders.card}; background: ${colors.neutral}; padding: ${spacing.cardPadding}; border-radius: ${radius.small}; page-break-inside: avoid; }
          .metric-card { border-top: 4px solid ${colors.goldDark}; }
          .metric-card.status-green { border-top-color: ${colors.success}; }
          .metric-card.status-gold { border-top-color: ${colors.goldDark}; }
          .metric-card.status-red { border-top-color: ${colors.danger}; }
          .metric-card.status-black { border-top-color: ${colors.black}; }
          .metric-label { font-size: ${typography.labelSize}; letter-spacing: 1.4px; color: ${colors.muted}; text-transform: uppercase; margin-bottom: 8px; }
          .metric-value { font-size: ${typography.metricValueSize}; color: ${colors.black}; font-weight: 700; }
          .executive-summary p { font-size: 13px; line-height: 1.65; }
          .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
          .insight-panel { border: ${borders.card}; background: ${colors.paper}; padding: ${spacing.cardPadding}; border-radius: ${radius.card}; page-break-inside: avoid; }
          .insight-panel h3 { color: ${colors.goldDark}; text-transform: uppercase; letter-spacing: 1px; font-size: ${typography.sectionLabelSize}; }
          .status-pill { display: inline-block; margin-top: 10px; padding: 4px 8px; font-size: ${typography.labelSize}; letter-spacing: 1px; text-transform: uppercase; color: #fff; background: ${colors.black}; border-radius: ${radius.pill}; }
          .status-green { background: ${colors.success}; }
          .status-gold { background: ${colors.goldDark}; }
          .status-red { background: ${colors.danger}; }
          .status-black { background: ${colors.black}; }
          .metric-card.status-green, .metric-card.status-gold, .metric-card.status-red, .metric-card.status-black { background: ${colors.neutral}; }
          .executive-brief { page-break-inside: auto; }
          .narrative-callout { border-left: 5px solid ${colors.goldDark}; background: ${colors.neutral}; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; }
          .narrative-callout p { margin: 0; font-size: 13px; line-height: 1.7; }
          .callout-label { color: ${colors.goldDark}; font-size: ${typography.labelSize}; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
          .brief-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${spacing.cardGap}; margin-bottom: ${spacing.cardGap}; }
          .brief-primary { border: ${borders.card}; background: ${colors.paper}; padding: 18px; border-radius: ${radius.card}; page-break-inside: avoid; }
          .brief-primary p { margin-top: 0; }
          .score-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
          .score-strip span { border-top: ${borders.light}; padding-top: 9px; }
          .score-strip strong { display: block; color: ${colors.black}; font-size: 18px; margin-bottom: 3px; }
          .score-strip small { display: block; color: ${colors.muted}; font-size: ${typography.labelSize}; text-transform: uppercase; letter-spacing: 1px; }
          .muted-copy { color: ${colors.muted}; }
          .impact-summary { border: ${borders.card}; background: linear-gradient(135deg, ${colors.paper} 0%, ${colors.neutral} 100%); padding: 18px; border-radius: ${radius.card}; margin-top: ${spacing.cardGap}; page-break-inside: avoid; }
          .priority-opportunities { margin-top: 14px; }
          .finding-card { border: ${borders.card}; background: ${colors.paper}; padding: 16px 18px; margin-bottom: ${spacing.cardGap}; border-radius: ${radius.small}; page-break-inside: avoid; box-shadow: ${shadows.card}; }
          .finding-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
          .finding-category { color: ${colors.black}; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
          .impact-pill { color: #fff; font-size: ${typography.labelSize}; text-transform: uppercase; letter-spacing: 1px; border-radius: ${radius.pill}; padding: 5px 9px; }
          .impact-high { background: ${colors.danger}; }
          .impact-medium { background: ${colors.goldDark}; }
          .impact-low { background: ${colors.success}; }
          .finding-evidence { border-top: ${borders.light}; color: ${colors.muted}; font-size: ${typography.sectionLabelSize}; line-height: 1.45; margin-top: 12px; padding-top: 10px; }
          .proof-card { border: ${borders.card}; background: ${colors.paper}; padding: ${spacing.cardPadding}; margin-bottom: 18px; border-radius: ${radius.small}; page-break-inside: avoid; }
          .proof-heading { display: flex; justify-content: space-between; gap: 12px; border-bottom: ${borders.light}; padding-bottom: 8px; margin-bottom: 12px; color: ${colors.black}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
          .proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
          .annotated-shot { position: relative; border: ${borders.card}; background: ${colors.neutral}; padding: 8px; min-height: 220px; overflow: hidden; }
          .annotated-shot-img { width: 100%; max-height: 320px; object-fit: contain; display: block; }
          .annotation-box { position: absolute; border: 2px solid ${colors.gold}; background: rgba(5, 7, 10, .88); color: #fff; padding: 7px 9px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
          .annotation-arrow { position: absolute; width: 48px; height: 2px; background: ${colors.gold}; transform-origin: center; }
          .annotation-arrow:after { content: ""; position: absolute; right: -1px; top: -4px; border-left: 8px solid ${colors.gold}; border-top: 5px solid transparent; border-bottom: 5px solid transparent; }
          .annotation-top-right { top: 38px; right: 28px; }
          .arrow-top-right { top: 86px; right: 142px; transform: rotate(145deg); }
          .annotation-top-center { top: 32px; left: 38%; }
          .arrow-top-center { top: 82px; left: 48%; transform: rotate(90deg); }
          .annotation-mid-right { top: 42%; right: 28px; }
          .arrow-mid-right { top: 50%; right: 150px; transform: rotate(180deg); }
          .annotation-bottom-right { bottom: 34px; right: 28px; }
          .arrow-bottom-right { bottom: 84px; right: 150px; transform: rotate(205deg); }
          .annotation-mid-left { top: 42%; left: 28px; }
          .arrow-mid-left { top: 50%; left: 150px; transform: rotate(0deg); }
          .annotation-bottom-left { bottom: 34px; left: 28px; }
          .arrow-bottom-left { bottom: 84px; left: 150px; transform: rotate(335deg); }
          .recommendation-card { margin-bottom: 10px; border-left: 4px solid ${colors.goldDark}; }
          .recommendation-kicker { font-size: ${typography.labelSize}; letter-spacing: 1px; text-transform: uppercase; color: ${colors.goldDark}; font-weight: 700; margin-bottom: 6px; }
          .roadmap-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: ${spacing.cardGap}; }
          .roadmap-card { border: ${borders.card}; border-top: 4px solid ${colors.black}; padding: ${spacing.cardPadding}; background: ${colors.neutral}; border-radius: ${radius.small}; page-break-inside: avoid; }
          .roadmap-phase { color: ${colors.goldDark}; font-size: 10px; text-transform: uppercase; letter-spacing: 1.3px; font-weight: 700; margin-bottom: 6px; }
          .outcome-line { border-top: ${borders.light}; margin-top: 10px; padding-top: 9px; color: #4f4a42; font-weight: 700; }
          .checklist-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .checklist-item { border: ${borders.card}; padding: 12px 14px; border-radius: ${radius.card}; background: ${colors.paper}; page-break-inside: avoid; }
          .check-status { display: inline-block; width: 64px; padding: 4px 7px; border-radius: 18px; color: #fff; font-size: ${typography.labelSize}; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-right: 10px; }
          .check-pass .check-status { background: ${colors.success}; }
          .check-improve .check-status { background: ${colors.goldDark}; }
          .check-label { font-size: ${typography.bodySize}; font-weight: 700; color: ${colors.black}; }
          .indicator-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
          .indicator { border: ${borders.card}; padding: 12px; text-align: center; border-radius: ${radius.card}; font-size: ${typography.sectionLabelSize}; text-transform: uppercase; letter-spacing: 1px; }
          .indicator.active { background: ${colors.black}; color: #fff; border-color: ${colors.black}; }
          .conclusion-panel, .acceptance-panel { border: ${borders.card}; background: linear-gradient(135deg, ${colors.paper} 0%, ${colors.neutral} 100%); padding: 24px; border-radius: ${radius.card}; page-break-inside: avoid; }
          .final-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: ${spacing.cardGap}; margin: 16px 0; }
          .contact-card { margin-top: 18px; border-left: 4px solid ${colors.goldDark}; padding: 12px 14px; background: ${colors.paper}; font-size: ${typography.bodySize}; line-height: 1.6; }
          .next-step-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
          .next-step-flow div { border: ${borders.card}; background: ${colors.paper}; padding: 12px; border-radius: ${radius.small}; page-break-inside: avoid; }
          .next-step-flow strong { display: block; color: ${colors.goldDark}; font-size: ${typography.sectionLabelSize}; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 6px; }
          .next-step-flow span { display: block; color: ${colors.text}; font-size: ${typography.sectionLabelSize}; line-height: 1.45; }
          .deliverable-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: ${spacing.cardGap}; }
          .deliverable-card { border: ${borders.card}; padding: ${spacing.cardPadding}; background: ${colors.paper}; border-radius: ${radius.card}; page-break-inside: avoid; }
          .deliverable-icon { width: 36px; height: 36px; border-radius: 50%; background: ${colors.black}; color: ${colors.gold}; display: flex; align-items: center; justify-content: center; font-size: ${typography.sectionLabelSize}; font-weight: 700; margin-bottom: 10px; }
          .timeline { border-left: 2px solid ${colors.goldSoft}; margin-left: 8px; }
          .timeline-item { margin: 0 0 16px 18px; padding: 0 0 0 12px; position: relative; }
          .timeline-item:before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: ${colors.goldDark}; position: absolute; left: -24px; top: 3px; }
          .screenshot-section { page-break-before: always; page-break-after: always; }
          .device-label { margin: 0 0 8px; color: ${colors.black}; font-size: ${typography.sectionLabelSize}; letter-spacing: 1.1px; text-transform: uppercase; font-weight: 700; }
          .screenshot-frame { border: ${borders.card}; padding: 10px; background: ${colors.paper}; }
          .website-screenshot { width: 100%; max-height: 360px; object-fit: contain; display: block; }
          .device-grid { display: grid; grid-template-columns: 1.7fr .8fr; gap: 18px; align-items: start; }
          .mobile-device { border: 9px solid ${colors.black}; border-radius: 28px; padding: 8px; background: ${colors.paper}; box-shadow: ${shadows.device}; }
          .mobile-screenshot { width: 100%; max-height: 330px; object-fit: contain; display: block; border-radius: 18px; }
          .browser-frame { border: ${borders.card}; background: ${colors.paper}; border-radius: ${radius.browser}; overflow: hidden; }
          .browser-bar { height: 34px; background: ${colors.black}; display: flex; align-items: center; gap: 7px; padding: 0 12px; color: #f4ead7; }
          .browser-bar span { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${colors.gold}; opacity: .8; }
          .browser-url { margin-left: 8px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #f4ead7; }
          .snapshot-notes { padding: 14px 16px 16px; background: ${colors.neutral}; border-top: ${borders.card}; }
          .caption { margin: 10px 12px 14px; color: ${colors.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
          pre { white-space: pre-wrap; font-family: ${typography.family}; background: ${colors.neutral}; border: ${borders.card}; padding: ${spacing.cardPadding}; font-size: ${typography.sectionLabelSize}; line-height: 1.45; }
          .signature-row { display: flex; justify-content: space-between; gap: 36px; margin-top: 34px; }
          .signature-row span { display: inline-block; width: 45%; border-top: ${borders.dark}; padding-top: 8px; font-size: ${typography.bodySize}; }
          /* PDF V3 CHANGE: force divider pages to render as black/charcoal pages. */
          .divider-page { min-height: 710px; background-color: ${colors.charcoal} !important; background: ${colors.charcoal} !important; color: #fff; page-break-before: always; page-break-after: always; position: relative; text-align: center; z-index: 5; }
          .divider-inner { position: absolute; top: 190px; left: 70px; right: 70px; }
          .divider-logo { width: 118px; height: auto; background: #fff; border: 1px solid ${colors.gold}; padding: 8px; margin: 0 auto 28px; display: block; }
          .divider-logo-text { color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 28px; }
          .divider-line { width: 120px; height: 3px; background: ${colors.gold}; margin: 0 auto 30px; }
          .divider-title { font-size: 34px; line-height: 1.1; letter-spacing: 2px; font-weight: 700; color: #fff; }
        </style>
      </head>
      <body>
        <div class="doc-shell">
          ${watermarkHtml}
          <div class="header">${logoHtml}</div>
          <div class="footer">Rogers Holdings LLC &nbsp; | &nbsp; ${escapeHtml_(contact.name)} &nbsp; | &nbsp; ${escapeHtml_(contact.email)} &nbsp; | &nbsp; ${escapeHtml_(contact.phone)} &nbsp; | &nbsp; ${escapeHtml_(document.title || '')}</div>
          ${document.bodyHtml}
        </div>
      </body>
    </html>
  `;
}

function brandedPdfDividerPageHtml_(title) {
  // PDF V4 CHANGE: inline PDF-safe dark divider rendering.
  const design = getPdfDesignSystem_();
  const colors = design.colors;
  const assets = getRogersBrandPdfAssets_();
  const watermarkSource = assets.watermark || assets.primaryLogo || '';
  const logoHtml = assets.primaryLogo
    ? `<img src="${assets.primaryLogo}" alt="Rogers Holdings LLC" style="width:170px;height:auto;display:block;margin:0 auto 38px;background:${colors.paper};border:1px solid ${colors.gold};padding:12px;">`
    : `<div style="color:${colors.paper};font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:38px;">Rogers Holdings LLC</div>`;
  const watermarkHtml = watermarkSource
    ? `<img src="${watermarkSource}" alt="" style="position:absolute;left:50%;top:50%;width:420px;height:auto;margin-left:-210px;margin-top:-210px;opacity:.05;z-index:1;">`
    : '';

  return [
    `<div style="min-height:710px;height:710px;width:100%;box-sizing:border-box;background-color:${colors.charcoal};background:${colors.charcoal};color:${colors.paper};page-break-before:always;page-break-after:always;position:relative;overflow:hidden;text-align:center;padding:128px 64px 80px;z-index:10;">`,
    watermarkHtml,
    '<div style="position:relative;z-index:2;margin:0 auto;max-width:620px;">',
    logoHtml,
    `<div style="height:1px;background:${colors.gold};width:260px;margin:0 auto 28px;"></div>`,
    `<div style="color:${colors.paper};font-size:42px;line-height:1.05;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 auto 28px;">${escapeHtml_(title)}</div>`,
    `<div style="height:1px;background:${colors.gold};width:260px;margin:0 auto 34px;"></div>`,
    `<div style="color:${colors.gold};font-size:11px;text-transform:uppercase;letter-spacing:2px;">Rogers Holdings LLC</div>`,
    '</div>',
    '</div>'
  ].join('');
}

function brandedPdfCoverHtml_(title, company, detail, kicker) {
  const assets = getRogersBrandPdfAssets_();
  const coverLogoHtml = assets.primaryLogo
    ? `<img class="cover-logo" src="${assets.primaryLogo}" alt="Rogers Holdings LLC">`
    : '<div class="cover-logo-text">Rogers Holdings LLC</div>';
  const dateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const coverLabel = title === 'Discovery Call Brief' ? (kicker || 'Call preparation brief') : 'Independent Digital Assessment';
  return `
    <div class="cover">
      <div class="cover-accent-top"></div>
      <div class="cover-accent-corner"></div>
      <div class="cover-accent-bottom"></div>
      <div class="cover-side-panel">
        ${coverLogoHtml}
        <div class="brand">Rogers Holdings LLC</div>
        <div class="cover-gold-rule"></div>
        <div class="badge">${escapeHtml_(coverLabel)}</div>
        <div class="cover-motto">Christ. Family. Business.</div>
      </div>
      <div class="cover-main">
        <p class="cover-subtitle">${escapeHtml_(coverLabel)}</p>
        <h1 class="cover-title">${escapeHtml_(title)}</h1>
        <div class="customer-feature">
          <div class="customer-label">Prepared For</div>
          <div class="customer-name">${escapeHtml_(company || '')}</div>
          <div class="cover-reference">${escapeHtml_(detail || '')}</div>
          <div class="cover-date">${escapeHtml_(dateText)}</div>
        </div>
      </div>
    </div>
  `;
}

function executiveSummaryCardsHtml_(cards) {
  return '<div class="card-grid">' + cards.map(function(card) {
    return [
      `<div class="metric-card ${escapeHtml_(card[2] || '')}">`,
      `<div class="metric-label">${escapeHtml_(card[0])}</div>`,
      `<div class="metric-value">${escapeHtml_(card[1] || '')}</div>`,
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

function recommendationCardsHtml_(items, label) {
  const values = (items || []).filter(function(item) {
    return String(item || '').trim();
  });
  if (!values.length) {
    return '<div class="summary-card"><p>No specific notes available.</p></div>';
  }

  return values.map(function(item, index) {
    return [
      '<div class="recommendation-card">',
      `<div class="recommendation-kicker">${escapeHtml_(label || 'Item')} ${index + 1}</div>`,
      `<p>${escapeHtml_(item)}</p>`,
      '</div>'
    ].join('');
  }).join('');
}

function timelineHtml_(items) {
  return '<div class="timeline">' + (items || []).map(function(item) {
    return `<div class="timeline-item"><p>${escapeHtml_(item)}</p></div>`;
  }).join('') + '</div>';
}

function pricingCardsHtml_(items) {
  return '<div class="card-grid">' + (items || []).map(function(item) {
    const parts = String(item || '').split(':');
    const title = parts.shift() || 'Investment';
    const body = parts.join(':').trim();
    return [
      '<div class="price-card">',
      `<h3>${escapeHtml_(title)}</h3>`,
      `<p>${escapeHtml_(body)}</p>`,
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

function buildWebsiteScreenshotHtml_(prospect, reportFile) {
  // PDF V4 CHANGE: dedicated evidence page with actual observed audit notes only.
  const evidenceObject = getAuditEvidenceObject_(prospect, reportFile);
  const screenshot = getEvidenceScreenshotUri_(evidenceObject);
  const mobileScreenshot = getEvidenceMobileScreenshotUri_(evidenceObject);
  if (!screenshot) {
    return '';
  }
  const observedNotes = buildWebsiteSnapshotNotes_(prospect);

  const desktopHtml = [
    '<div>',
    '<p class="device-label">Desktop Website View</p>',
    '<div class="browser-frame">',
    '<div class="browser-bar"><span></span><span></span><span></span><div class="browser-url">Desktop Website View</div></div>',
    `<div class="screenshot-frame"><img class="website-screenshot" src="${screenshot}" alt="Desktop website screenshot"></div>`,
    '</div>',
    '</div>'
  ].join('');
  const mobileHtml = mobileScreenshot
    ? [
      '<div>',
      '<p class="device-label">Mobile Website View</p>',
      '<div class="mobile-device">',
      `<img class="mobile-screenshot" src="${mobileScreenshot}" alt="Mobile website screenshot">`,
      '</div>',
      '</div>'
    ].join('')
    : '';

  return [
    '<div class="section screenshot-section">',
    '<h2 class="section-title-large">CURRENT DIGITAL PRESENCE</h2>',
    '<p class="section-subtitle">Snapshot of the customer experience today.</p>',
    mobileScreenshot ? `<div class="device-grid">${desktopHtml}${mobileHtml}</div>` : desktopHtml,
    observedNotes.length ? [
      '<div class="snapshot-notes"><h3>What We Observed</h3>',
      brandedPdfListHtml_(observedNotes),
      '</div>'
    ].join('') : '',
    '</div>'
  ].join('');
}

function buildWebsiteSnapshotNotes_(prospect) {
  // PDF V4 CHANGE: avoid generic screenshot bullets when no real audit evidence exists.
  const smartFindings = getSmartFindings_(prospect);
  const notes = smartFindings.concat(splitTextForPdfList_(firstNonBlank_([prospect.summary, prospect.notes])))
    .map(function(note) {
      return sanitizeCustomerPdfText_(note);
    })
    .filter(function(note) {
      const value = String(note || '').trim();
      return value && value.toLowerCase().indexOf('audit score') === -1;
    });
  const unique = [];
  const seen = {};
  notes.forEach(function(note) {
    const key = note.toLowerCase();
    if (!seen[key] && unique.length < 3) {
      seen[key] = true;
      unique.push(note);
    }
  });
  return unique;
}

function getWebsiteScreenshotDataUri_(prospect, reportFile) {
  return getEvidenceScreenshotUri_(getAuditEvidenceObject_(prospect, reportFile));
}

function getWebsiteMobileScreenshotDataUri_(prospect, reportFile) {
  return getEvidenceMobileScreenshotUri_(getAuditEvidenceObject_(prospect, reportFile));
}

function scoreStatusClass_(score) {
  const value = Number(score);
  if (Number.isNaN(value)) {
    return 'status-black';
  }
  if (value >= 75) {
    return 'status-green';
  }
  if (value >= 50) {
    return 'status-gold';
  }
  return 'status-red';
}

function outcomeStatusClass_(outcome) {
  const value = String(outcome || '').toLowerCase();
  if (value.indexOf('strong') !== -1 || value.indexOf('good') !== -1) {
    return 'status-green';
  }
  if (value.indexOf('nurture') !== -1 || value.indexOf('not audited') !== -1) {
    return 'status-gold';
  }
  if (value.indexOf('poor') !== -1) {
    return 'status-red';
  }
  return 'status-black';
}

function priorityStatusClass_(priorityTier) {
  const value = String(priorityTier || '').toLowerCase();
  if (value.indexOf('hot') !== -1 || value === 'a') {
    return 'status-red';
  }
  if (value.indexOf('good') !== -1 || value === 'b') {
    return 'status-gold';
  }
  if (value.indexOf('later') !== -1 || value === 'c') {
    return 'status-black';
  }
  return 'status-black';
}

function statusLabelFromClass_(statusClass) {
  const labels = {
    'status-green': 'Expected Outcome',
    'status-gold': 'Recommended Focus',
    'status-red': 'Opportunity Level',
    'status-black': 'Current Score'
  };
  return labels[statusClass] || 'Current Score';
}

function brandedPdfSectionHtml_(title, contentHtml) {
  return `<div class="section"><h2>${escapeHtml_(title)}</h2>${contentHtml}</div>`;
}

function brandedPdfListHtml_(items) {
  const values = (items || []).filter(function(item) {
    return String(item || '').trim();
  });
  if (!values.length) {
    return '<p>No specific notes available.</p>';
  }
  return '<ul>' + values.map(function(item) {
    return `<li>${escapeHtml_(item)}</li>`;
  }).join('') + '</ul>';
}

function brandedPdfDefinitionListHtml_(items) {
  return '<dl>' + items.map(function(item) {
    return `<dt>${escapeHtml_(item[0])}</dt><dd>${escapeHtml_(item[1] || '')}</dd>`;
  }).join('') + '</dl>';
}

function getRogersBrandPdfAssets_() {
  const folder = getBrandAssetPackageFolder_();
  if (!folder) {
    return {
      coverBackground: '',
      primaryLogo: '',
      watermark: ''
    };
  }

  return {
    coverBackground: getBrandAssetDataUri_(folder, [
      '008-COVER-2.png',
      'COVER 2.PNG',
      'cover.png'
    ]),
    primaryLogo: getBrandAssetDataUri_(folder, [
      '013-RH_logo_white_background.jpg',
      'RH_logo_white_background.jpg',
      'primary-logo.jpg',
      'primary-logo.png'
    ]),
    watermark: getBrandAssetDataUri_(folder, [
      '001-apple-touch-icon.png',
      'apple-touch-icon.png',
      'watermark.png',
      '011-Profile-Logo.png'
    ])
  };
}

function getBrandAssetPackageFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = String(
    properties.getProperty('BRAND_ASSET_FOLDER_ID') ||
    properties.getProperty('ROGERS_BRAND_ASSET_FOLDER_ID') ||
    ''
  ).trim();

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      console.warn('Rogers Holdings PDF brand asset folder ID could not be opened: ' + (error && error.message ? error.message : String(error)));
    }
  }

  const folderNames = [
    'Brand Asset Package',
    'Brand Assets',
    'Rogers Holdings Brand Asset Package'
  ];
  for (let index = 0; index < folderNames.length; index += 1) {
    const folders = DriveApp.getFoldersByName(folderNames[index]);
    if (folders.hasNext()) {
      return folders.next();
    }
  }

  console.warn('Rogers Holdings PDF brand asset folder was not found. Set Script Property BRAND_ASSET_FOLDER_ID or create a Drive folder named Brand Asset Package.');
  return null;
}

function getBrandAssetDataUri_(folder, preferredNames) {
  const file = findBrandAssetFile_(folder, preferredNames);
  if (!file) {
    return '';
  }

  const blob = file.getBlob();
  const contentType = blob.getContentType() || getContentTypeFromFileName_(file.getName());
  return `data:${contentType};base64,${Utilities.base64Encode(blob.getBytes())}`;
}

function findBrandAssetFile_(folder, preferredNames) {
  for (let index = 0; index < preferredNames.length; index += 1) {
    const files = folder.getFilesByName(preferredNames[index]);
    if (files.hasNext()) {
      return files.next();
    }
  }

  const normalizedPreferred = preferredNames.map(function(name) {
    return normalizeLookupKey_(name);
  });
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileKey = normalizeLookupKey_(file.getName());
    for (let index = 0; index < normalizedPreferred.length; index += 1) {
      if (fileKey && (fileKey === normalizedPreferred[index] || fileKey.indexOf(normalizedPreferred[index]) !== -1)) {
        return file;
      }
    }
  }

  return null;
}

function getContentTypeFromFileName_(fileName) {
  const extension = String(fileName || '').split('.').pop().toLowerCase();
  const types = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml'
  };
  return types[extension] || 'application/octet-stream';
}

function htmlToPdfBlob_(html, fileName) {
  return Utilities
    .newBlob(html, 'text/html', fileName.replace(/\.pdf$/i, '.html'))
    .getAs(MimeType.PDF)
    .setName(fileName);
}

function formatAuditScoreForPdf_(auditScore) {
  if (auditScore === '' || auditScore === null || auditScore === undefined) {
    return 'Not scored';
  }
  return `${auditScore}/100`;
}

function splitTextForPdfList_(text) {
  return String(text || '')
    .split(/\n+|\. /)
    .map(function(item) {
      return item.replace(/\.$/, '').trim();
    })
    .filter(Boolean)
    .slice(0, 6);
}

function buildAuditPackageOutreachText_(drafts) {
  return [
    'SUBJECT',
    drafts.subject,
    '',
    'INITIAL OUTREACH EMAIL',
    drafts.initialEmail,
    '',
    'FOLLOW-UP EMAIL',
    drafts.followUpEmail
  ].join('\n');
}

function generateProposal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getActiveSheet();

  if (!sheet || sheet.getName() !== MASTER_PROSPECT_SHEET) {
    ui.alert(
      'Rogers Holdings OS',
      'Select a prospect row on the Master Prospect Tracker sheet first.',
      ui.ButtonSet.OK
    );
    return;
  }

  const selectedRow = sheet.getActiveRange().getRow();
  const table = getHeaderTable_(sheet, [
    'Company',
    'Website',
    'Audit Score',
    'Audit Outcome',
    'Priority Tier'
  ]);

  if (selectedRow <= table.headerRow) {
    ui.alert(
      'Rogers Holdings OS',
      'Select a data row below the Master Prospect Tracker header row.',
      ui.ButtonSet.OK
    );
    return;
  }

  const values = sheet.getRange(selectedRow, 1, 1, table.lastColumn).getValues()[0];
  const prospect = {
    company: getValueByHeader_(values, table.headers, 'Company'),
    website: getValueByHeader_(values, table.headers, 'Website'),
    auditScore: getValueByHeader_(values, table.headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(values, table.headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(values, table.headers, 'Priority Tier'),
    offerService: getValueByHeader_(values, table.headers, 'Offer / Service'),
    notes: getValueByHeader_(values, table.headers, 'Notes')
  };

  if (!prospect.company) {
    ui.alert(
      'Rogers Holdings OS',
      'The selected row does not have a Company value.',
      ui.ButtonSet.OK
    );
    return;
  }

  applySmartFindingsToProspect_(sheet, table.headers, selectedRow, prospect);
  const proposal = buildProposal_(prospect);
  showProposalModal_(prospect, proposal);
  setProspectStatusIfHeader_(sheet, table.headers, selectedRow, 'Proposal Sent');
  logProposalGenerated_(ss, prospect, proposal);
  updateSelectedProspectLastActivity_(sheet, table.headers, selectedRow);
  refreshSalesOperatingSystem_();
}

function buildProposal_(prospect) {
  const company = String(prospect.company || '').trim();
  const website = String(prospect.website || 'Not provided').trim();
  const auditScore = prospect.auditScore === '' || prospect.auditScore === null || prospect.auditScore === undefined
    ? 'Not scored'
    : String(prospect.auditScore) + '/100';
  const auditOutcome = String(prospect.auditOutcome || 'Website review completed').trim();
  const priorityTier = String(prospect.priorityTier || 'Not assigned').trim();
  const recommendedService = String(prospect.offerService || 'Website and local visibility improvement').trim();
  const findings = getSmartFindings_(prospect);
  const findingsText = findings.length
    ? findings.map(function(finding) {
      return '- ' + finding;
    }).join('\n')
    : proposalFindingsFromOutcome_(auditOutcome, priorityTier);
  const impact = proposalImpactFromService_(recommendedService);

  const proposalText = [
    'ROGERS HOLDINGS LLC',
    'DIGITAL IMPROVEMENT PROPOSAL',
    '',
    `Prepared for: ${company}`,
    `Website: ${website}`,
    `Current Audit Score: ${auditScore}`,
    '',
    'SUMMARY OF FINDINGS',
    findingsText,
    '',
    'RECOMMENDED SERVICE',
    recommendedService,
    '',
    'EXPECTED BUSINESS IMPACT',
    impact,
    '',
    'PRICING OPTIONS',
    '',
    'Starter',
    '$500 one-time',
    'Best for basic cleanup and quick wins.',
    '- Review the highest-priority website issues',
    '- Improve basic trust and contact visibility',
    '- Provide a short action summary',
    '',
    'Professional',
    '$1,500 one-time',
    'Best for businesses that need stronger website conversion and local visibility.',
    '- Implement priority website improvements',
    '- Improve call-to-action and service messaging',
    '- Strengthen local search and trust signals',
    '- Provide before/after summary notes',
    '',
    'Premium',
    '$3,000+ project',
    'Best for businesses that need a deeper digital foundation or a larger rebuild.',
    '- Full website and digital presence improvement plan',
    '- Conversion-focused page updates or rebuild guidance',
    '- Local visibility and customer inquiry improvements',
    '- Follow-up review and next-step recommendations',
    '',
    'NEXT STEP',
    'If this looks useful, Rogers Holdings LLC can start with the option that best fits the business need and budget.',
    '',
    'Brian Rogers',
    'Rogers Holdings LLC'
  ].join('\n');

  return {
    company: company,
    website: website,
    auditScore: auditScore,
    findings: findingsText,
    recommendedService: recommendedService,
    impact: impact,
    proposalText: proposalText
  };
}

function proposalFindingsFromOutcome_(auditOutcome, priorityTier) {
  return [
    `The audit outcome is ${auditOutcome}.`,
    `The current priority tier is ${priorityTier}.`,
    'The main opportunity is to make the website easier for local customers to understand, trust, and act on.'
  ].join(' ');
}

function proposalImpactFromService_(recommendedService) {
  return [
    `The recommended service is ${recommendedService}.`,
    'Expected impact includes clearer messaging, stronger customer trust, easier contact paths, and better conversion from visitors who are already reviewing the business online.'
  ].join(' ');
}

function showProposalModal_(prospect, proposal) {
  const html = HtmlService
    .createHtmlOutput(buildProposalHtml_(prospect, proposal))
    .setWidth(780)
    .setHeight(720);

  SpreadsheetApp.getUi().showModalDialog(html, 'Proposal Draft');
}

function buildProposalHtml_(prospect, proposal) {
  return `
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            box-sizing: border-box;
            margin: 0;
            padding: 22px;
            background: #ffffff;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
          }
          .header {
            border-bottom: 2px solid #b88728;
            margin-bottom: 18px;
            padding-bottom: 12px;
          }
          h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }
          .meta {
            margin-top: 6px;
            color: #555555;
            font-size: 13px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 18px;
          }
          .field {
            border: 1px solid #dddddd;
            border-radius: 4px;
            padding: 10px;
          }
          .label {
            color: #755515;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .value {
            margin-top: 5px;
            font-size: 14px;
          }
          label {
            display: block;
            margin: 18px 0 8px;
            color: #755515;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          textarea {
            box-sizing: border-box;
            width: 100%;
            min-height: 340px;
            border: 1px solid #cccccc;
            border-radius: 4px;
            padding: 12px;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
            line-height: 1.45;
            resize: vertical;
            white-space: pre-wrap;
          }
          .button-row {
            display: flex;
            gap: 10px;
            margin-top: 18px;
          }
          button {
            min-height: 38px;
            border: 1px solid #111111;
            border-radius: 4px;
            padding: 0 14px;
            background: #111111;
            color: #ffffff;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
          }
          button.secondary {
            border-color: #b88728;
            background: #ffffff;
            color: #111111;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml_(proposal.company)} Proposal</h1>
          <div class="meta">Rogers Holdings LLC | Copy and paste ready</div>
        </div>

        <div class="grid">
          <div class="field">
            <div class="label">Company Name</div>
            <div class="value">${escapeHtml_(proposal.company)}</div>
          </div>
          <div class="field">
            <div class="label">Website</div>
            <div class="value">${escapeHtml_(proposal.website)}</div>
          </div>
          <div class="field">
            <div class="label">Current Audit Score</div>
            <div class="value">${escapeHtml_(proposal.auditScore)}</div>
          </div>
          <div class="field">
            <div class="label">Recommended Service</div>
            <div class="value">${escapeHtml_(proposal.recommendedService)}</div>
          </div>
        </div>

        <label for="proposal">Proposal Text</label>
        <textarea id="proposal">${escapeHtml_(proposal.proposalText)}</textarea>

        <div class="button-row">
          <button id="copyProposalButton" onclick="copyProposal()">Copy Proposal</button>
          <button class="secondary" onclick="google.script.host.close()">Close</button>
        </div>
        <div id="copyMessage" class="meta"></div>

        <script>
          function copyProposal() {
            const textarea = document.getElementById('proposal');
            const button = document.getElementById('copyProposalButton');
            const message = document.getElementById('copyMessage');
            const text = textarea.value;

            function markCopied() {
              button.textContent = 'Copied!';
              message.textContent = '';
            }

            function fallbackCopy() {
              textarea.focus();
              textarea.select();
              textarea.setSelectionRange(0, textarea.value.length);

              try {
                if (document.execCommand('copy')) {
                  markCopied();
                  return true;
                }
              } catch (error) {
                // Continue to manual-copy message below.
              }

              message.textContent = 'Copy failed. Please manually select the proposal text and copy it.';
              return false;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text)
                .then(markCopied)
                .catch(fallbackCopy);
              return;
            }

            fallbackCopy();
          }
        </script>
      </body>
    </html>
  `;
}

function logProposalGenerated_(ss, prospect, proposal) {
  const sheet = getRequiredSheet_(ss, ACTIVITY_FEED_SHEET);
  const table = getHeaderTable_(sheet, [
    'Date',
    'Company',
    'Activity Type',
    'Activity Notes'
  ]);

  const rowValues = new Array(table.lastColumn).fill('');
  setIfHeader_(rowValues, table.headers, 'Date', new Date());
  setIfHeader_(rowValues, table.headers, 'Company', prospect.company);
  setIfHeader_(rowValues, table.headers, 'Activity Type', 'Proposal Generated');
  setIfHeader_(rowValues, table.headers, 'Activity Notes', `Generated proposal for ${proposal.recommendedService}.`);
  setIfHeader_(rowValues, table.headers, 'Next Action', 'Send Proposal');

  const targetRow = Math.max(sheet.getLastRow() + 1, table.headerRow + 1);
  sheet.getRange(targetRow, 1, 1, table.lastColumn).setValues([rowValues]);
}
