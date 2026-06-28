/**
 * Rogers Holdings OS - InspectionEngine.
 * Creates structured inspection objects for future Website & Digital Presence Review workflows.
 *
 * This module intentionally does not replace existing audit scoring, PDF rendering,
 * Gmail, Drive, dashboard, or menu behavior yet.
 */

function createInspection(input) {
  const data = input || {};
  const now = new Date();
  const categories = getInspectionCategories_();
  const inspection = {
    objectType: 'Inspection',
    id: data.id || buildInspectionId_('INSP'),
    version: '1.0',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    company: data.company || '',
    website: data.website || '',
    city: data.city || '',
    state: data.state || '',
    industry: data.industry || '',
    source: data.source || 'Rogers Holdings OS',
    status: data.status || 'Draft',
    categories: categories,
    findings: [],
    evidence: [],
    recommendations: [],
    score: data.score === undefined ? null : data.score,
    priorityMatrix: getPriorityMatrix(),
    businessSummary: '',
    inspectorNotes: data.inspectorNotes || '',
    aiNotes: data.aiNotes || '',
    metadata: data.metadata || {}
  };

  (data.findings || []).forEach(function(finding) {
    addFinding(inspection, finding);
  });

  inspection.score = calculateInspectionScore(inspection);
  inspection.businessSummary = getBusinessSummary(inspection);
  return inspection;
}

function addFinding(inspection, findingInput) {
  if (!inspection || inspection.objectType !== 'Inspection') {
    throw new Error('addFinding requires an Inspection object.');
  }

  const finding = createInspectionFinding_(findingInput || {}, inspection);
  inspection.findings.push(finding);
  inspection.updatedAt = new Date();
  inspection.score = calculateInspectionScore(inspection);
  inspection.businessSummary = getBusinessSummary(inspection);
  return finding;
}

function addEvidence(target, evidenceInput) {
  const evidence = createInspectionEvidence_(evidenceInput || {});
  if (!target) {
    throw new Error('addEvidence requires an Inspection or InspectionFinding object.');
  }

  if (target.objectType === 'Inspection') {
    target.evidence.push(evidence);
    target.updatedAt = new Date();
    return evidence;
  }

  if (target.objectType === 'InspectionFinding') {
    target.evidence.push(evidence);
    return evidence;
  }

  throw new Error('addEvidence target must be an Inspection or InspectionFinding object.');
}

function calculateInspectionScore(inspection) {
  if (!inspection || !inspection.findings) {
    return 100;
  }

  const severityWeights = {
    Critical: 18,
    High: 12,
    Medium: 7,
    Low: 3,
    Info: 0
  };
  const statusAdjustment = {
    Open: 1,
    Reviewing: 1,
    Planned: 0.75,
    Fixed: 0,
    Deferred: 0.5
  };

  let penalty = 0;
  inspection.findings.forEach(function(finding) {
    const severity = normalizeInspectionSeverity_(finding.severity);
    const status = finding.status || 'Open';
    const adjustment = statusAdjustment[status] === undefined ? 1 : statusAdjustment[status];
    penalty += (severityWeights[severity] || 0) * adjustment;
  });

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  return score;
}

function getPriorityMatrix() {
  return {
    objectType: 'InspectionPriorityMatrix',
    severity: ['Critical', 'High', 'Medium', 'Low', 'Info'],
    priority: ['P0 Immediate', 'P1 High', 'P2 Normal', 'P3 Future'],
    difficulty: ['Low', 'Medium', 'High'],
    expectedRoi: ['High', 'Medium', 'Low'],
    rules: [
      { severity: 'Critical', expectedRoi: 'High', priority: 'P0 Immediate' },
      { severity: 'High', expectedRoi: 'High', priority: 'P1 High' },
      { severity: 'High', expectedRoi: 'Medium', priority: 'P1 High' },
      { severity: 'Medium', expectedRoi: 'High', priority: 'P1 High' },
      { severity: 'Medium', expectedRoi: 'Medium', priority: 'P2 Normal' },
      { severity: 'Low', expectedRoi: 'High', priority: 'P2 Normal' },
      { severity: 'Low', expectedRoi: 'Medium', priority: 'P3 Future' },
      { severity: 'Info', expectedRoi: 'Low', priority: 'P3 Future' }
    ]
  };
}

function getBusinessSummary(inspection) {
  if (!inspection || !inspection.findings || !inspection.findings.length) {
    return 'No inspection findings have been recorded yet.';
  }

  const openFindings = inspection.findings.filter(function(finding) {
    return finding.status !== 'Fixed';
  });
  const topCategories = getTopInspectionCategories_(openFindings);
  const highImpactCount = openFindings.filter(function(finding) {
    return finding.severity === 'Critical' || finding.severity === 'High';
  }).length;

  if (!openFindings.length) {
    return 'Inspection findings have been addressed. The digital presence is ready for ongoing optimization.';
  }

  const categoryText = topCategories.length ? topCategories.join(', ') : 'customer experience';
  const impactText = highImpactCount
    ? `${highImpactCount} high-impact finding${highImpactCount === 1 ? '' : 's'} should be reviewed first`
    : 'the findings are primarily optimization opportunities';

  return `The inspection identified opportunities in ${categoryText}. ${impactText}, with recommendations focused on trust, visibility, lead capture, and a clearer customer path.`;
}

function getInspectionCategories_() {
  return [
    createInspectionCategory_('Contact Information', 'contact-information', 'Phone, email, address, hours, and visible contact paths.'),
    createInspectionCategory_('Trust Signals', 'trust-signals', 'Reviews, testimonials, proof, certifications, and credibility cues.'),
    createInspectionCategory_('Calls To Action', 'calls-to-action', 'Buttons, quote paths, booking paths, and primary customer next steps.'),
    createInspectionCategory_('Homepage', 'homepage', 'First impression, clarity, positioning, and above-the-fold message.'),
    createInspectionCategory_('Navigation', 'navigation', 'Menu clarity, page structure, and ease of finding important information.'),
    createInspectionCategory_('Local SEO', 'local-seo', 'Location, service area, title/meta signals, and local search clarity.'),
    createInspectionCategory_('Google Business', 'google-business', 'Google Business Profile alignment and local discovery support.'),
    createInspectionCategory_('Performance', 'performance', 'Speed, loading behavior, and technical friction.'),
    createInspectionCategory_('Accessibility', 'accessibility', 'Basic usability, readability, contrast, and accessible navigation.'),
    createInspectionCategory_('Content Quality', 'content-quality', 'Plain-English service explanation, relevance, and completeness.'),
    createInspectionCategory_('Brand Consistency', 'brand-consistency', 'Visual and message consistency across customer-facing touchpoints.'),
    createInspectionCategory_('Lead Capture', 'lead-capture', 'Forms, calls, quote requests, booking, and inquiry flow.'),
    createInspectionCategory_('Analytics', 'analytics', 'Measurement readiness, tracking, and attribution foundation.'),
    createInspectionCategory_('Security', 'security', 'SSL, trust, form security, and basic customer confidence signals.')
  ];
}

function createInspectionCategory_(name, key, description) {
  return {
    objectType: 'InspectionCategory',
    id: key,
    name: name,
    key: key,
    description: description,
    enabled: true,
    weight: 1,
    inspectorNotes: '',
    aiNotes: '',
    metadata: {}
  };
}

function createInspectionFinding_(input, inspection) {
  const data = input || {};
  const category = normalizeInspectionCategory_(data.category, inspection);
  const severity = normalizeInspectionSeverity_(data.severity);
  const expectedRoi = normalizeInspectionExpectedRoi_(data.expectedRoi || data.expectedROI);
  const difficulty = normalizeInspectionDifficulty_(data.difficulty);
  const recommendation = createInspectionRecommendation_(data.recommendation || {});
  const finding = {
    objectType: 'InspectionFinding',
    id: data.id || buildInspectionId_('FIND'),
    category: category.name,
    categoryId: category.id,
    title: data.title || category.name + ' Opportunity',
    description: data.description || '',
    severity: severity,
    priority: data.priority || resolveInspectionPriority_(severity, expectedRoi),
    status: data.status || 'Open',
    evidence: [],
    businessImpact: data.businessImpact || '',
    customerImpact: data.customerImpact || '',
    recommendation: recommendation,
    difficulty: difficulty,
    expectedRoi: expectedRoi,
    inspectorNotes: data.inspectorNotes || '',
    aiNotes: data.aiNotes || '',
    metadata: data.metadata || {}
  };

  (data.evidence || []).forEach(function(evidence) {
    addEvidence(finding, evidence);
  });

  return finding;
}

function createInspectionEvidence_(input) {
  const data = input || {};
  return {
    objectType: 'InspectionEvidence',
    id: data.id || buildInspectionId_('EVID'),
    type: data.type || 'Observation',
    source: data.source || '',
    sourceUrl: data.sourceUrl || '',
    label: data.label || '',
    description: data.description || '',
    value: data.value === undefined ? '' : data.value,
    screenshotUrl: data.screenshotUrl || '',
    screenshotDataUri: data.screenshotDataUri || '',
    annotations: data.annotations || [],
    capturedAt: data.capturedAt || new Date(),
    confidence: data.confidence === undefined ? null : data.confidence,
    metadata: data.metadata || {}
  };
}

function createInspectionRecommendation_(input) {
  const data = typeof input === 'string' ? { summary: input } : (input || {});
  return {
    objectType: 'InspectionRecommendation',
    id: data.id || buildInspectionId_('REC'),
    summary: data.summary || '',
    action: data.action || data.summary || '',
    rationale: data.rationale || '',
    expectedOutcome: data.expectedOutcome || '',
    owner: data.owner || '',
    timeframe: data.timeframe || '',
    metadata: data.metadata || {}
  };
}

function createInspectionResult_(inspection) {
  const source = inspection || createInspection();
  return {
    objectType: 'InspectionResult',
    inspectionId: source.id,
    company: source.company || '',
    website: source.website || '',
    score: calculateInspectionScore(source),
    status: source.status || 'Draft',
    summary: getBusinessSummary(source),
    findings: source.findings || [],
    evidence: source.evidence || [],
    recommendations: source.recommendations || [],
    generatedAt: new Date(),
    metadata: source.metadata || {}
  };
}

function resolveInspectionPriority_(severity, expectedRoi) {
  const matrix = getPriorityMatrix();
  const normalizedSeverity = normalizeInspectionSeverity_(severity);
  const normalizedRoi = normalizeInspectionExpectedRoi_(expectedRoi);
  const match = matrix.rules.filter(function(rule) {
    return rule.severity === normalizedSeverity && rule.expectedRoi === normalizedRoi;
  })[0];
  if (match) {
    return match.priority;
  }
  if (normalizedSeverity === 'Critical') {
    return 'P0 Immediate';
  }
  if (normalizedSeverity === 'High') {
    return 'P1 High';
  }
  if (normalizedSeverity === 'Medium') {
    return 'P2 Normal';
  }
  return 'P3 Future';
}

function normalizeInspectionCategory_(category, inspection) {
  const categories = inspection && inspection.categories ? inspection.categories : getInspectionCategories_();
  const value = String(category || '').toLowerCase().trim();
  const match = categories.filter(function(item) {
    return item.name.toLowerCase() === value || item.key.toLowerCase() === value || item.id.toLowerCase() === value;
  })[0];
  return match || categories[0];
}

function normalizeInspectionSeverity_(severity) {
  const value = String(severity || 'Medium').toLowerCase();
  if (value === 'critical' || value === 'p0') {
    return 'Critical';
  }
  if (value === 'high' || value === 'p1') {
    return 'High';
  }
  if (value === 'low' || value === 'p3') {
    return 'Low';
  }
  if (value === 'info' || value === 'informational') {
    return 'Info';
  }
  return 'Medium';
}

function normalizeInspectionDifficulty_(difficulty) {
  const value = String(difficulty || 'Medium').toLowerCase();
  if (value === 'low' || value === 'easy') {
    return 'Low';
  }
  if (value === 'high' || value === 'hard') {
    return 'High';
  }
  return 'Medium';
}

function normalizeInspectionExpectedRoi_(expectedRoi) {
  const value = String(expectedRoi || 'Medium').toLowerCase();
  if (value === 'high') {
    return 'High';
  }
  if (value === 'low') {
    return 'Low';
  }
  return 'Medium';
}

function getTopInspectionCategories_(findings) {
  const counts = {};
  (findings || []).forEach(function(finding) {
    const category = finding.category || 'General';
    counts[category] = (counts[category] || 0) + 1;
  });
  return Object.keys(counts)
    .sort(function(a, b) {
      return counts[b] - counts[a];
    })
    .slice(0, 3);
}

function buildInspectionId_(prefix) {
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `${prefix}-${timestamp}-${random}`;
}
