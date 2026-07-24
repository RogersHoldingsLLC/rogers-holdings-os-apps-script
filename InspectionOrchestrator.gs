/**
 * Business Optimization Platform - InspectionOrchestrator.
 * Central inspection entry point. Coordinates registered inspectors and returns
 * one normalized InspectionResult.
 *
 * This module does not modify existing audit, PDF, Gmail, Drive, dashboard,
 * menu, branding, or sheet workflows.
 */

function runInspection(url, options) {
  const startedAt = new Date();
  const config = normalizeInspectionRunOptions_(url, options || {});
  const inspection = createInspection({
    company: config.prospect.company || config.company || '',
    website: config.url,
    city: config.prospect.city || config.city || '',
    state: config.prospect.state || config.state || '',
    industry: config.prospect.industry || config.industry || '',
    source: 'Inspection Orchestrator',
    status: 'Completed',
    metadata: {
      orchestratorVersion: '1.0',
      requestedInspectors: config.enabledInspectors,
      disabledInspectors: config.disabledInspectors
    }
  });
  const registry = getEnabledInspectionInspectors_(config);
  const inspectorResults = [];

  registry.forEach(function(inspector) {
    const inspectorStartedAt = new Date();
    const result = {
      name: inspector.name,
      category: inspector.category,
      version: inspector.version,
      enabled: inspector.enabled,
      status: 'Skipped',
      findingsBefore: inspection.findings.length,
      findingsAfter: inspection.findings.length,
      findingsAdded: 0,
      startedAt: inspectorStartedAt,
      completedAt: null,
      durationMs: 0,
      error: ''
    };

    try {
      if (!isInspectorRunnable_(inspector)) {
        result.status = 'Unavailable';
        result.error = 'Inspector runner is not available in this Apps Script project.';
      } else {
        inspector.runner(buildInspectorRunInput_(config, inspection, inspector));
        result.status = 'Completed';
      }
    } catch (error) {
      result.status = 'Failed';
      result.error = error && error.message ? error.message : String(error);
    }

    result.completedAt = new Date();
    result.durationMs = result.completedAt.getTime() - inspectorStartedAt.getTime();
    result.findingsAfter = inspection.findings.length;
    result.findingsAdded = Math.max(0, result.findingsAfter - result.findingsBefore);
    inspectorResults.push(result);
  });

  inspection.score = calculateInspectionScore(inspection);
  inspection.businessSummary = getBusinessSummary(inspection);
  inspection.metadata = inspection.metadata || {};
  inspection.metadata.inspectorResults = inspectorResults;
  inspection.metadata.executionMetadata = buildInspectionExecutionMetadata_(startedAt, registry, config);

  return normalizeInspectionResult_(inspection, inspectorResults, startedAt, config);
}

function getInspectionInspectorRegistry_(options) {
  const registry = [
    createInspectionInspectorMetadata_({
      name: 'Contact Information Inspector',
      key: 'contact-information',
      category: 'Contact Information',
      version: '1.0',
      enabled: true,
      description: 'Inspects phone, email, contact forms, contact pages, hours, address, and header/footer contact visibility.',
      order: 10,
      runner: typeof inspectContactInformation === 'function' ? inspectContactInformation : null
    }),
    createInspectionInspectorMetadata_({
      name: 'Homepage Inspector',
      key: 'homepage',
      category: 'Homepage',
      version: '1.0',
      enabled: true,
      description: 'Inspects homepage first impression, hero clarity, service clarity, calls to action, trust cues, and above-the-fold customer understanding.',
      order: 20,
      runner: typeof inspectHomepage === 'function' ? inspectHomepage : null
    }),
    createInspectionInspectorMetadata_({
      name: 'Trust Signals Inspector',
      key: 'trust-signals',
      category: 'Trust Signals',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for reviews, testimonials, proof, certifications, and credibility signals.',
      order: 30,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Calls To Action Inspector',
      key: 'calls-to-action',
      category: 'Calls To Action',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for buttons, quote paths, booking paths, and primary customer actions.',
      order: 40,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Local SEO Inspector',
      key: 'local-seo',
      category: 'Local SEO',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for location, service area, metadata, and local search clarity.',
      order: 50,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Google Business Inspector',
      key: 'google-business',
      category: 'Google Business',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for Google Business Profile alignment and local discovery support.',
      order: 60,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Performance Inspector',
      key: 'performance',
      category: 'Performance',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for speed, loading behavior, and technical friction.',
      order: 70,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Accessibility Inspector',
      key: 'accessibility',
      category: 'Accessibility',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for readability, contrast, alt text, heading structure, and accessible navigation.',
      order: 80,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Security Inspector',
      key: 'security',
      category: 'Security',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for SSL, form security, and customer confidence signals.',
      order: 90,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Lead Capture Inspector',
      key: 'lead-capture',
      category: 'Lead Capture',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for forms, request flow, booking, and inquiry capture.',
      order: 100,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Analytics Inspector',
      key: 'analytics',
      category: 'Analytics',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for measurement readiness, tracking, and attribution foundation.',
      order: 110,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Brand Consistency Inspector',
      key: 'brand-consistency',
      category: 'Brand Consistency',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for visual and message consistency across customer-facing touchpoints.',
      order: 120,
      runner: null
    }),
    createInspectionInspectorMetadata_({
      name: 'Content Quality Inspector',
      key: 'content-quality',
      category: 'Content Quality',
      version: 'Future',
      enabled: false,
      description: 'Future inspector for plain-English service explanation, relevance, and completeness.',
      order: 130,
      runner: null
    })
  ];

  return registry.concat(getAdditionalInspectionInspectors_(options || {}))
    .map(function(inspector) {
      return createInspectionInspectorMetadata_(inspector);
    })
    .sort(function(a, b) {
      return a.order - b.order;
    });
}

function getAdditionalInspectionInspectors_(options) {
  const extras = [];
  if (options && Array.isArray(options.inspectors)) {
    options.inspectors.forEach(function(inspector) {
      extras.push(inspector);
    });
  }
  if (typeof getCustomInspectionInspectors_ === 'function') {
    const customInspectors = getCustomInspectionInspectors_();
    if (Array.isArray(customInspectors)) {
      customInspectors.forEach(function(inspector) {
        extras.push(inspector);
      });
    }
  }
  return extras;
}

function createInspectionInspectorMetadata_(input) {
  const data = input || {};
  return {
    objectType: 'InspectionInspector',
    name: data.name || 'Unnamed Inspector',
    key: data.key || normalizeInspectionInspectorKey_(data.name || 'unnamed-inspector'),
    category: data.category || '',
    version: data.version || '1.0',
    enabled: data.enabled === undefined ? true : data.enabled === true,
    description: data.description || '',
    order: data.order === undefined ? 999 : Number(data.order),
    runner: data.runner || null,
    metadata: data.metadata || {}
  };
}

function getEnabledInspectionInspectors_(config) {
  const registry = getInspectionInspectorRegistry_(config);
  return registry.filter(function(inspector) {
    const isExplicitlyRequested = config.enabledInspectors.length > 0;
    if (isExplicitlyRequested && !inspectionInspectorMatchesList_(inspector, config.enabledInspectors)) {
      return false;
    }
    if (!isExplicitlyRequested && !inspector.enabled) {
      return false;
    }
    if (inspectionInspectorMatchesList_(inspector, config.disabledInspectors)) {
      return false;
    }
    return true;
  });
}

function normalizeInspectionRunOptions_(url, options) {
  const data = options || {};
  const prospect = data.prospect || data.business || {};
  const website = String(url || data.url || data.website || prospect.website || '').trim();
  return {
    url: website,
    company: data.company || prospect.company || '',
    city: data.city || prospect.city || '',
    state: data.state || prospect.state || '',
    industry: data.industry || prospect.industry || '',
    prospect: Object.assign({}, prospect, {
      website: prospect.website || website,
      company: prospect.company || data.company || ''
    }),
    reportFile: data.reportFile || {},
    evidence: data.evidence || {},
    html: data.html || data.pageHtml || '',
    text: data.text || data.pageText || data.homepageText || '',
    aboveFoldText: data.aboveFoldText || '',
    headerText: data.headerText || '',
    footerText: data.footerText || '',
    links: data.links || [],
    forms: data.forms || [],
    enabledInspectors: normalizeInspectionInspectorList_(data.enabledInspectors || data.onlyInspectors || []),
    disabledInspectors: normalizeInspectionInspectorList_(data.disabledInspectors || data.skipInspectors || []),
    inspectors: data.inspectors || []
  };
}

function buildInspectorRunInput_(config, inspection, inspector) {
  return {
    inspection: inspection,
    prospect: config.prospect,
    website: config.url,
    url: config.url,
    reportFile: config.reportFile,
    evidence: config.evidence,
    html: config.html,
    pageHtml: config.html,
    text: config.text,
    pageText: config.text,
    homepageText: config.text,
    aboveFoldText: config.aboveFoldText,
    headerText: config.headerText,
    footerText: config.footerText,
    links: config.links,
    forms: config.forms,
    sourceUrl: config.url,
    inspector: inspector
  };
}

function normalizeInspectionResult_(inspection, inspectorResults, startedAt, config) {
  const base = createInspectionResult_(inspection);
  const overallScore = calculateInspectionScore(inspection);
  const completedAt = new Date();
  return Object.assign({}, base, {
    overallScore: overallScore,
    overallGrade: getInspectionGrade_(overallScore),
    findings: inspection.findings || [],
    evidence: collectInspectionEvidence_(inspection),
    priorityMatrix: getPriorityMatrix(),
    businessSummary: getBusinessSummary(inspection),
    categoryScores: calculateInspectionCategoryScores_(inspection),
    inspectorResults: inspectorResults || [],
    executionMetadata: {
      orchestrator: 'Inspection Orchestrator',
      version: '1.0',
      url: config.url,
      startedAt: startedAt,
      completedAt: completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      enabledInspectors: (inspectorResults || []).map(function(result) {
        return result.name;
      }),
      findingCount: inspection.findings.length,
      evidenceCount: collectInspectionEvidence_(inspection).length
    }
  });
}

function calculateInspectionCategoryScores_(inspection) {
  const categoryScores = {};
  const categories = inspection && inspection.categories ? inspection.categories : getInspectionCategories_();
  categories.forEach(function(category) {
    const categoryFindings = (inspection.findings || []).filter(function(finding) {
      return finding.category === category.name || finding.categoryId === category.id;
    });
    categoryScores[category.name] = {
      category: category.name,
      score: calculateInspectionScore({ findings: categoryFindings }),
      findingCount: categoryFindings.length,
      criticalCount: countInspectionFindingsBySeverity_(categoryFindings, 'Critical'),
      highCount: countInspectionFindingsBySeverity_(categoryFindings, 'High'),
      mediumCount: countInspectionFindingsBySeverity_(categoryFindings, 'Medium'),
      lowCount: countInspectionFindingsBySeverity_(categoryFindings, 'Low')
    };
  });
  return categoryScores;
}

function collectInspectionEvidence_(inspection) {
  const evidence = [];
  (inspection.evidence || []).forEach(function(item) {
    evidence.push(item);
  });
  (inspection.findings || []).forEach(function(finding) {
    (finding.evidence || []).forEach(function(item) {
      evidence.push(item);
    });
  });
  return evidence;
}

function getInspectionGrade_(score) {
  const value = Number(score);
  if (Number.isNaN(value)) {
    return 'Not Graded';
  }
  if (value >= 93) {
    return 'A';
  }
  if (value >= 85) {
    return 'B';
  }
  if (value >= 75) {
    return 'C';
  }
  if (value >= 65) {
    return 'D';
  }
  return 'F';
}

function countInspectionFindingsBySeverity_(findings, severity) {
  return (findings || []).filter(function(finding) {
    return finding.severity === severity;
  }).length;
}

function normalizeInspectionInspectorList_(values) {
  if (!values) {
    return [];
  }
  if (Array.isArray(values)) {
    return values.map(function(value) {
      return normalizeInspectionInspectorKey_(value);
    }).filter(Boolean);
  }
  return String(values).split(',').map(function(value) {
    return normalizeInspectionInspectorKey_(value);
  }).filter(Boolean);
}

function normalizeInspectionInspectorKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inspectionInspectorMatchesList_(inspector, list) {
  const keys = [
    inspector.key,
    normalizeInspectionInspectorKey_(inspector.name),
    normalizeInspectionInspectorKey_(inspector.category)
  ];
  return (list || []).some(function(item) {
    return keys.indexOf(item) !== -1;
  });
}

function isInspectorRunnable_(inspector) {
  return inspector && typeof inspector.runner === 'function';
}

function buildInspectionExecutionMetadata_(startedAt, registry, config) {
  const completedAt = new Date();
  return {
    orchestrator: 'Inspection Orchestrator',
    version: '1.0',
    url: config.url,
    startedAt: startedAt,
    completedAt: completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    registeredInspectors: (registry || []).map(function(inspector) {
      return {
        name: inspector.name,
        key: inspector.key,
        category: inspector.category,
        version: inspector.version,
        enabled: inspector.enabled,
        runnable: isInspectorRunnable_(inspector)
      };
    })
  };
}
