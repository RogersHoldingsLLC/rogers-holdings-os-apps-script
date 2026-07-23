/**
 * Business Optimization Platform - DigitalPresenceAssessmentEngine.
 * Shared client-facing assessment language for PDFs, previews, and outreach.
 */

function getDigitalPresenceAssessment_(score, confidenceState) {
  const numericScore = parseDigitalPresenceScore_(score);
  const confidence = confidenceState || {};

  if (numericScore === null || confidence.scoreAllowed === false) {
    return {
      score: null,
      scoreText: 'Not verified',
      title: 'Digital Presence Review In Progress',
      subtitle: 'Available evidence supports a preliminary review, but not a definitive score or severity rating.',
      confidence: confidence.level || 'INSUFFICIENT'
    };
  }

  const roundedScore = Math.max(0, Math.min(100, Math.round(numericScore)));
  let title;
  let subtitle;

  if (roundedScore >= 90) {
    title = 'Excellent Digital Presence';
    subtitle = 'Your business has a strong online presence with only minor optimization opportunities.';
  } else if (roundedScore >= 80) {
    title = 'Strong Digital Foundation';
    subtitle = 'Your business performs well online and has several opportunities to increase visibility and conversions.';
  } else if (roundedScore >= 70) {
    title = 'Healthy Foundation with Improvement Opportunities';
    subtitle = 'Your business has a solid digital presence but several improvements could significantly increase customer engagement.';
  } else if (roundedScore >= 60) {
    title = 'Moderate Improvement Needed';
    subtitle = 'Several areas are limiting visibility, customer trust, and lead generation.';
  } else if (roundedScore >= 50) {
    title = 'Significant Improvement Needed';
    subtitle = 'Important opportunities exist to improve your online presence and customer experience.';
  } else if (roundedScore >= 40) {
    title = 'High Priority for Improvement';
    subtitle = 'Your online presence is preventing potential customers from fully trusting or finding your business.';
  } else {
    title = 'Critical Digital Issues Detected';
    subtitle = 'Immediate improvements are recommended to strengthen visibility, credibility, and lead generation.';
  }

  return {
    score: roundedScore,
    scoreText: `${roundedScore} / 100`,
    title: title,
    subtitle: subtitle
  };
}

function getAssessmentConfidenceState_(prospect, reportFile) {
  const business = prospect || {};
  const report = reportFile || {};
  const inspection = report.inspectionResult || report.inspection || business.inspectionResult || {};
  const inspectorResults = inspection.inspectorResults || [];
  const completed = inspectorResults.filter(function(item) { return item && item.status === 'Completed'; }).length;
  const unavailable = inspectorResults.filter(function(item) { return item && (item.status === 'Unavailable' || item.status === 'Failed'); }).length;
  const evidence = [].concat(report.evidence || [], inspection.evidence || []);
  const findings = [].concat(report.findings || [], inspection.findings || []);
  const score = parseDigitalPresenceScore_(business.auditScore);
  const explicitlyIncomplete = report.inspectionComplete === false || inspection.complete === false || unavailable > 0;
  const structuredSupport = completed > 0 || evidence.length >= 2 || findings.some(function(item) {
    return item && (item.evidence || item.status || item.confidence !== undefined);
  });
  const suspiciousZero = score === 0 && !structuredSupport;
  const scoreAllowed = score !== null && !explicitlyIncomplete && !suspiciousZero;
  return {
    level: scoreAllowed ? (structuredSupport ? 'HIGH' : 'LEGACY_VERIFIED') : 'INSUFFICIENT',
    scoreAllowed: scoreAllowed,
    severityAllowed: scoreAllowed,
    complete: scoreAllowed,
    reason: explicitlyIncomplete ? 'Inspection did not complete successfully.' : (suspiciousZero ? 'A zero score lacks sufficient structured inspection evidence.' : '')
  };
}

function getReportScoreContext_(prospect, reportFile) {
  const business = prospect || {};
  const confidence = getAssessmentConfidenceState_(business, reportFile || {});
  const assessment = getDigitalPresenceAssessment_(business.auditScore, confidence);
  const verified = confidence.scoreAllowed === true && assessment.score !== null;
  return {
    displayScore: verified ? assessment.scoreText : 'Not verified',
    scoreVerified: verified,
    severityLabel: verified ? assessment.title : 'Digital Presence Review In Progress',
    safeFallbackLanguage: verified
      ? assessment.subtitle
      : 'Available evidence supports a preliminary review, but not a definitive score or severity rating.',
    confidence: confidence.level || 'INSUFFICIENT',
    complete: confidence.complete === true,
    reason: confidence.reason || ''
  };
}

function normalizeAssessmentEvidence_(prospect, reportFile) {
  const business = prospect || {};
  const report = reportFile || {};
  const confidence = getAssessmentConfidenceState_(business, report);
  const sourceItems = [].concat(report.findings || [], (report.inspectionResult && report.inspectionResult.findings) || [], report.evidence || []);
  const normalizedItems = sourceItems.map(function(item) {
    return normalizeClientEvidenceItem_(item, confidence);
  });
  const definitions = [
    ['reviews', 'Reviews Visible', /review|testimonial/, /missing reviews?|no reviews?|reviews? not (visible|detected)|missing testimonial/],
    ['ssl', 'SSL Enabled', /ssl|https|secure/, /ssl missing|not secure|no https|missing ssl/],
    ['mobile', 'Mobile Friendly', /mobile/, /not mobile|mobile issue|mobile friendly\s*:\s*no/],
    ['contact_form', 'Contact Form', /contact form|inquiry form|request form/, /missing contact form|no contact form/],
    ['google_business', 'Google Business Profile', /google business|gbp/, /missing google business|gbp missing|no google business|google business profile link (was )?not detected/],
    ['call_to_action', 'Clear Call To Action', /call to action|\bcta\b|request|book|contact us|get started/, /missing call to action|missing cta|no call to action|cta (was )?not detected/],
    ['service_area', 'Service Area Coverage', /service area|serving|geographic market/, /missing service area|service area unclear|service area (was )?not detected/]
  ];
  const signals = {};
  definitions.forEach(function(definition) {
    const supplied = report.normalizedEvidence && report.normalizedEvidence.signals && report.normalizedEvidence.signals[definition[0]];
    const suppliedItem = supplied ? normalizeClientEvidenceItem_(supplied, confidence) : null;
    const matchingItems = normalizedItems.filter(function(item) {
      return definition[2].test([item.key, item.source, item.explanation].join(' ').toLowerCase());
    });
    const eligibleItem = matchingItems.find(function(item) { return item.status === 'FAIL'; }) || matchingItems.find(function(item) { return item.status === 'PASS'; });
    const selected = suppliedItem && suppliedItem.status !== 'UNKNOWN' ? suppliedItem : eligibleItem;
    signals[definition[0]] = Object.assign({}, selected || {
      key: definition[0], label: definition[1],
      status: 'UNKNOWN', confidence: 0, source: '', explanation: 'Not verified from the available inspection evidence.',
      clientFindingEligible: false, recommendationEligible: false, outreachEligible: false, observed: false
    }, { key: definition[0], label: definition[1] });
  });
  return { version: '1.1', confidence: confidence, items: normalizedItems, signals: signals };
}

function normalizeClientEvidenceItem_(item, overallConfidence) {
  const value = item || {};
  const objectItem = typeof value === 'object' ? value : { observation: String(value || '') };
  const explicitStatus = String(objectItem.status || '').toUpperCase().replace(/\s+/g, '_');
  const validStatus = ['PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE'].indexOf(explicitStatus) !== -1 ? explicitStatus : '';
  const rawConfidence = Number(objectItem.confidence);
  const confidence = Number.isNaN(rawConfidence)
    ? ((overallConfidence && overallConfidence.complete === true) ? 0.7 : 0)
    : Math.max(0, Math.min(1, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence));
  const explicitlyObserved = objectItem.observed === true || objectItem.verified === true;
  const completeLegacyObservation = overallConfidence && overallConfidence.complete === true && !!String(objectItem.observation || objectItem.description || '').trim();
  let status = validStatus;
  if (!status && (explicitlyObserved || completeLegacyObservation)) {
    status = objectItem.supportsStrength === true ? 'PASS' : (objectItem.supportsOpportunity === true || typeof value === 'string' ? 'FAIL' : 'UNKNOWN');
  }
  status = status || 'UNKNOWN';
  const observed = (status === 'PASS' || status === 'FAIL') && confidence >= 0.65 && objectItem.requiresReview !== true;
  const explanation = String(objectItem.explanation || objectItem.observation || objectItem.description || objectItem.title || '').trim();
  return {
    key: String(objectItem.key || objectItem.id || ''),
    status: status,
    confidence: confidence,
    source: String(objectItem.source || objectItem.sourceLabel || objectItem.pageUrl || ''),
    explanation: explanation || (status === 'UNKNOWN' ? 'Not verified from the available inspection evidence.' : ''),
    observed: observed,
    clientFindingEligible: observed,
    recommendationEligible: observed && status === 'FAIL' && objectItem.supportsOpportunity !== false,
    outreachEligible: observed && status === 'FAIL' && objectItem.supportsOpportunity !== false
  };
}

function getClientEligibleEvidenceItems_(prospect, reportFile, purpose) {
  const contract = normalizeAssessmentEvidence_(prospect || {}, reportFile || {});
  const eligibilityKey = purpose === 'recommendation'
    ? 'recommendationEligible'
    : (purpose === 'outreach' ? 'outreachEligible' : 'clientFindingEligible');
  return contract.items.filter(function(item) { return item[eligibilityKey] === true; });
}

function filterClientEligibleEvidence_(items, prospect, reportFile, purpose) {
  const confidence = getAssessmentConfidenceState_(prospect || {}, reportFile || {});
  const eligibilityKey = purpose === 'recommendation'
    ? 'recommendationEligible'
    : (purpose === 'outreach' ? 'outreachEligible' : 'clientFindingEligible');
  const values = Array.isArray(items) ? items : (items ? [items] : []);
  return values.filter(function(item) {
    return normalizeClientEvidenceItem_(item, confidence)[eligibilityKey] === true;
  });
}

function getClientSafeReportFile_(prospect, reportFile) {
  const report = reportFile || {};
  const confidence = getAssessmentConfidenceState_(prospect || {}, report);
  return Object.assign({}, report, {
    text: confidence.complete === true ? report.text : '',
    findings: filterClientEligibleEvidence_(report.findings || [], prospect, report, 'finding'),
    evidence: filterClientEligibleEvidence_(report.evidence || [], prospect, report, 'finding')
  });
}

function parseDigitalPresenceScore_(score) {
  if (score === '' || score === null || score === undefined) {
    return null;
  }

  const match = String(score).match(/\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  const numericScore = Number(match[0]);
  return Number.isNaN(numericScore) ? null : numericScore;
}

function getClientFacingServiceName_(service, score) {
  const value = String(service || '').trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === 'website audit' || normalized === 'website and local visibility review') {
    const assessment = getDigitalPresenceAssessment_(score);
    if (assessment.score !== null && assessment.score >= 90) {
      return 'Growth & Optimization Review';
    }
    return 'Digital Visibility & Conversion Improvement Package';
  }
  return value;
}
