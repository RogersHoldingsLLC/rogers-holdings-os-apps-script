/**
 * Authoritative Gold Standard client-deliverable model and renderers.
 * The model preserves the lineage Evidence -> AssessmentFinding ->
 * Recommendation -> ImprovementPlanAction without exposing internal keys.
 */

function buildGoldStandardDeliverableInput_(prospect, reportFile, options) {
  const approvedFindingSet = loadApprovedFindingSetForGeneration_(prospect || {}, options || {});
  const approvedFindingSetReference = approvedFindingSet.reference;
  const source = normalizeClientProspect_(prospect || {});
  const report = getClientSafeReportFile_(source, reportFile || {});
  const overrides = approvedFindingSet.reviewedInput;
  const packagePreparedAt = String(overrides.packagePreparedAt || '').trim();
  const packagePreparedInstant = new Date(packagePreparedAt);
  if (!packagePreparedAt || isNaN(packagePreparedInstant.getTime())) throw findingQualityGenerationLockError_();
  const projectTimeZone = Session.getScriptTimeZone();
  const date = Utilities.formatDate(packagePreparedInstant, projectTimeZone, 'MMMM d, yyyy');
  const isoDate = Utilities.formatDate(packagePreparedInstant, projectTimeZone, 'yyyy-MM-dd');
  const rawEvidence = [].concat(overrides.evidence || buildGoldStandardEvidence_(source, report));
  const rawFindings = [].concat(overrides.findings || buildGoldStandardFindings_(source, report));
  const evidence = rawEvidence.map(function(item, index) {
    return {
      key: String(item.key || 'evidence-' + (index + 1)),
      label: sanitizeGoldStandardClientText_(item.label || item.title || 'Reviewed evidence'),
      detail: sanitizeGoldStandardClientText_(item.detail || item.observation || ''),
      state: normalizeGoldStandardEvidenceState_(item.state || item.classification),
      sourceType: sanitizeGoldStandardClientText_(item.sourceType || ''),
      sourceUrl: String(item.sourceUrl || ''),
      pageTitle: sanitizeGoldStandardClientText_(item.pageTitle || ''),
      pagePath: sanitizeGoldStandardClientText_(item.pagePath || ''),
      elementType: sanitizeGoldStandardClientText_(item.elementType || ''),
      elementLabel: sanitizeGoldStandardClientText_(item.elementLabel || ''),
      evidenceLocation: sanitizeGoldStandardClientText_(item.evidenceLocation || ''),
      capturedAt: String(item.capturedAt || ''),
      captureMethod: sanitizeGoldStandardClientText_(item.captureMethod || ''),
      desktopMobileContext: sanitizeGoldStandardClientText_(item.desktopMobileContext || ''),
      testPerformed: sanitizeGoldStandardClientText_(item.testPerformed || ''),
      testResult: sanitizeGoldStandardClientText_(item.testResult || ''),
      confidence: Number(item.confidence || 0),
      limitations: normalizeGoldStandardLimitationList_(item.limitations)
    };
  }).filter(function(item) { return item.label && item.detail; });
  const evidenceKeys = evidence.map(function(item) { return item.key; });
  const findings = rawFindings.map(function(item, index) {
    const state = normalizeGoldStandardEvidenceState_(item.state || item.classification);
    const links = [].concat(item.evidenceKeys || item.evidenceKey || []).filter(function(key) {
      return evidenceKeys.indexOf(String(key)) !== -1;
    }).map(String);
    const observation = sanitizeGoldStandardClientText_(item.observation || item.evidenceGap || '');
    const businessMeaning = sanitizeGoldStandardClientText_(item.businessMeaning || item.businessImpact || item.businessValue || item.whyVerificationMatters || '');
    let recommendation = state === 'Not Verified' ? '' : sanitizeGoldStandardClientText_(item.recommendation || item.maintain || '');
    let gatedState = state;
    if (state === 'Actionable' && !isGoldStandardActionableFinding_({
      category: item.category || item.title,
      observation: observation,
      businessMeaning: businessMeaning,
      recommendation: recommendation,
      evidenceKeys: links
    })) {
      gatedState = 'Not Verified';
      recommendation = '';
    }
    return {
      key: String(item.key || 'finding-' + (index + 1)),
      category: sanitizeGoldStandardClientText_(item.category || item.title || 'Evidence requiring review'),
      state: gatedState,
      channelType: sanitizeGoldStandardClientText_(item.channelType || ''),
      presenceState: sanitizeGoldStandardClientText_(item.presenceState || ''),
      customerJourneyStage: sanitizeGoldStandardClientText_(item.customerJourneyStage || ''),
      businessObjective: sanitizeGoldStandardClientText_(item.businessObjective || ''),
      evidenceSource: sanitizeGoldStandardClientText_(item.evidenceSource || ''),
      evidenceLocation: sanitizeGoldStandardClientText_(item.evidenceLocation || ''),
      evidenceObservedAt: String(item.evidenceObservedAt || ''),
      evidenceExcerpt: sanitizeGoldStandardClientText_(item.evidenceExcerpt || ''),
      observation: observation,
      expectedCondition: sanitizeGoldStandardClientText_(item.expectedCondition || ''),
      businessMeaning: businessMeaning,
      consequenceBasis: sanitizeGoldStandardClientText_(item.consequenceBasis || ''),
      recommendation: recommendation,
      implementationLocation: sanitizeGoldStandardClientText_(item.implementationLocation || ''),
      intendedOutcome: sanitizeGoldStandardClientText_(item.intendedOutcome || ''),
      completionTest: sanitizeGoldStandardClientText_(item.completionTest || ''),
      evidenceConfidence: Number(item.evidenceConfidence || 0),
      verificationNeeded: gatedState === 'Not Verified' ? sanitizeGoldStandardClientText_(item.verificationNeeded || 'Check this item. A person must approve it before we suggest a change.') : '',
      priority: sanitizeGoldStandardClientText_(item.priority || (gatedState === 'Verified Strength' ? 'Verified Strength' : gatedState)),
      evidenceKeys: links,
      limitations: normalizeGoldStandardLimitationList_(item.limitations || item.limitation)
    };
  }).filter(function(item) { return item.observation && item.businessMeaning && item.evidenceKeys.length; });
  const findingKeys = findings.map(function(item) { return item.key; });
  const findingLimitations = findings.reduce(function(result, item) {
    return result.concat(item.limitations || []);
  }, []);
  const recommendations = findings.filter(function(item) {
    return (item.state === 'Actionable' || item.state === 'Verified Strength') && item.recommendation;
  }).map(function(item, index) {
    const supplied = [].concat(overrides.recommendations || []).filter(function(candidate) {
      return String(candidate.findingKey || '') === item.key;
    })[0] || {};
    return {
      key: String(supplied.key || 'recommendation-' + (index + 1)),
      findingKey: item.key,
      kind: item.state === 'Verified Strength' ? 'maintain' : 'improvement',
      title: sanitizeGoldStandardClientText_(supplied.title || item.category),
      change: sanitizeGoldStandardClientText_(supplied.change || item.recommendation),
      why: sanitizeGoldStandardClientText_(supplied.why || item.businessMeaning),
      dependency: sanitizeGoldStandardClientText_(supplied.dependency || item.dependency || ('Owner approval of the ' + item.category.toLowerCase() + ' scope.'))
    };
  }).filter(function(item) { return isGoldStandardRecommendation_(item); });
  const recommendationKeys = recommendations.map(function(item) { return item.key; });
  const suppliedActions = [].concat(overrides.actions || []);
  const actions = recommendations.map(function(item, index) {
    const supplied = suppliedActions.filter(function(candidate) {
      return String(candidate.recommendationKey || '') === item.key;
    })[0] || {};
    const linkedFinding = findings.filter(function(candidate) { return candidate.key === item.findingKey; })[0] || {};
    return {
      key: String(supplied.key || 'action-' + (index + 1)),
      recommendationKey: item.key,
      sequence: Number(supplied.sequence || index + 1),
      title: sanitizeGoldStandardClientText_(supplied.title || item.title),
      outcome: sanitizeGoldStandardClientText_(supplied.outcome || item.why),
      implementationPath: sanitizeGoldStandardClientText_(supplied.implementationPath || ('Owner or approved implementation support implements the approved change: ' + item.change)),
      dependency: sanitizeGoldStandardClientText_(supplied.dependency || item.dependency),
      completionTest: sanitizeGoldStandardClientText_(supplied.completionTest || ('Verify the completed change resolves the documented condition: ' + linkedFinding.observation))
    };
  }).filter(function(item) { return item && isGoldStandardPlanAction_(item); }).sort(function(a, b) { return a.sequence - b.sequence; });
  const strength = findings.filter(function(item) { return item.state === 'Verified Strength'; })[0];
  const primary = findings.filter(function(item) { return item.state === 'Actionable'; })[0] || findings[0] || null;
  const model = {
    approvedFindingSetReference: approvedFindingSetReference,
    company: sanitizeGoldStandardClientText_(overrides.company || source.company || 'Business'),
    website: String(overrides.website || source.website || ''),
    preparedDate: String(date),
    preparedDateIso: String(isoDate),
    businessContext: normalizeGoldStandardBusinessContext_(overrides.businessContext || {}),
    businessContextVersion: String(overrides.businessContextVersion || ''),
    presence: [].concat(overrides.presence || []).map(normalizeGoldStandardPresence_).filter(function(item) { return item.channelType; }),
    presenceInventoryVersion: String(overrides.presenceInventoryVersion || ''),
    reviewCategory: 'Focused Priorities',
    opening: sanitizeGoldStandardClientText_(overrides.opening || buildGoldStandardOpening_(source, primary)),
    evidence: evidence,
    limitations: normalizeGoldStandardLimitationList_([].concat(overrides.limitations || [], findingLimitations, (overrides.limitations && overrides.limitations.length) || findingLimitations.length ? [] : buildGoldStandardLimitations_(findings))).filter(function(value, index, all) {
      return Boolean(value) && all.indexOf(value) === index;
    }),
    findings: findings,
    recommendations: recommendations,
    actions: actions,
    primaryFindingKey: primary ? primary.key : '',
    primaryConclusion: sanitizeGoldStandardClientText_(overrides.primaryConclusion || (primary ? primary.category : '')),
    primaryConclusionDetail: sanitizeGoldStandardClientText_(overrides.primaryConclusionDetail || (primary ? primary.observation : '')),
    businessImplication: sanitizeGoldStandardClientText_(overrides.businessImplication || (primary ? primary.businessMeaning : '')),
    firstStep: sanitizeGoldStandardClientText_(overrides.firstStep || (primary && primary.recommendation ? primary.recommendation : '')),
    preserveWhatWorks: sanitizeGoldStandardClientText_(overrides.preserveWhatWorks || (strength ? strength.recommendation : '')),
    nextStep: sanitizeGoldStandardClientText_(overrides.nextStep || 'Review this Executive Brief. Choose who will make the change.'),
    decisions: [].concat(overrides.decisions || ['Choose the main action customers should take.', 'Approve what each change needs.', 'Choose who will do and check the work.']).map(sanitizeGoldStandardClientText_).filter(Boolean)
  };
  validateGoldStandardLineage_(model, findingKeys, recommendationKeys);
  assertGoldStandardGenerationReady_(model);
  return deepFreezeGoldStandard_(model);
}

function assertApprovedFindingSetReference_(reference) {
  return assertApprovedFindingSetReferenceShape_(reference);
}

function normalizeGoldStandardBusinessContext_(value) {
  const item = value || {};
  return {
    version: String(item.version || ''),
    primaryService: sanitizeGoldStandardClientText_(item.primaryService || ''),
    targetCustomer: sanitizeGoldStandardClientText_(item.targetCustomer || ''),
    serviceArea: sanitizeGoldStandardClientText_(item.serviceArea || ''),
    desiredCustomerAction: sanitizeGoldStandardClientText_(item.desiredCustomerAction || ''),
    primaryBusinessObjective: sanitizeGoldStandardClientText_(item.primaryBusinessObjective || ''),
    relevantConversionDestination: String(item.relevantConversionDestination || ''),
    knownConstraints: sanitizeGoldStandardClientText_(item.knownConstraints || ''),
    industryContext: sanitizeGoldStandardClientText_(item.industryContext || '')
  };
}

/**
 * Preserves approved limitation text while supporting snapshots written before
 * semicolons were retained inside a single list item. Those snapshots contain a
 * distinctive adjacent pair: an unterminated clause followed by a lowercase
 * continuation. Complete, independently authored limitations remain separate.
 */
function normalizeGoldStandardLimitationList_(value) {
  const items = [].concat(value || []).map(sanitizeGoldStandardClientText_).filter(Boolean);
  return items.reduce(function(result, item) {
    const prior = result.length ? result[result.length - 1] : '';
    const priorIsUnterminated = prior && !/[.!?][\"'\)\]]*$/.test(prior);
    const itemIsContinuation = /^[a-z]/.test(item);
    if (priorIsUnterminated && itemIsContinuation) {
      result[result.length - 1] = prior.replace(/\s+$/, '') + '; ' + item;
    } else {
      result.push(item);
    }
    return result;
  }, []);
}

function normalizeGoldStandardPresence_(value) {
  const item = value || {};
  const state = String(item.presenceState || '').trim();
  return {
    channelType: sanitizeGoldStandardClientText_(item.channelType || ''),
    channelName: sanitizeGoldStandardClientText_(item.channelName || item.channelType || ''),
    presenceState: state === 'Verified Absent' ? 'No Verified Presence Identified' : sanitizeGoldStandardClientText_(state),
    applicability: sanitizeGoldStandardClientText_(item.applicability || ''),
    roleInCustomerJourney: sanitizeGoldStandardClientText_(item.roleInCustomerJourney || ''),
    verifiedUrlOrIdentifier: String(item.verifiedUrlOrIdentifier || ''),
    limitations: normalizeGoldStandardLimitationList_(item.limitations)
  };
}

function buildGoldStandardDocumentPlan_(documentType, prospect, reportFile, options) {
  const input = buildGoldStandardDeliverableInput_(prospect || {}, reportFile || {}, options || {});
  const executiveBriefContent = documentType === 'executiveBrief' ? buildGoldStandardExecutiveBriefContent_(input) : null;
  const assessmentContent = documentType === 'assessment' ? buildGoldStandardAssessmentContent_(input) : null;
  const improvementPlanContent = documentType === 'improvementPlan' ? buildGoldStandardImprovementPlanContent_(input) : null;
  const definitions = {
    executiveBrief: {
      title: 'Executive Brief', fileName: 'Executive Brief.pdf', pdfHtml: buildGoldStandardExecutiveBriefHtml_(input, executiveBriefContent)
    },
    assessment: {
      title: 'Digital Business Assessment', fileName: 'Digital Business Assessment.pdf', pdfHtml: buildGoldStandardAssessmentHtml_(input, assessmentContent)
    },
    improvementPlan: {
      title: 'Improvement Plan', fileName: 'Improvement Plan.pdf', pdfHtml: buildGoldStandardImprovementPlanHtml_(input, improvementPlanContent)
    }
  };
  const definition = definitions[String(documentType || '')];
  if (!definition) throw new Error('Unknown Gold Standard document type.');
  const semantics = {
    findingIds: input.findings.map(function(item) { return item.key; }),
    evidenceReferences: input.findings.reduce(function(result, item) {
      return result.concat(item.evidenceKeys || []);
    }, []).filter(function(value, index, all) { return all.indexOf(value) === index; }),
    recommendationIds: input.recommendations.map(function(item) { return item.key; }),
    recommendations: input.recommendations.map(function(item) { return item.change; }),
    completionTests: input.actions.map(function(item) { return item.completionTest; }),
    limitations: input.limitations.slice()
  };
  return deepFreezeGoldStandard_({
    documentType: documentType,
    title: definition.title,
    fileName: definition.fileName,
    approvedFindingSetReference: input.approvedFindingSetReference,
    input: input,
    content: executiveBriefContent || assessmentContent || improvementPlanContent,
    semantics: semantics,
    pdfHtml: definition.pdfHtml
  });
}

function buildGoldStandardPdfBlobFromPlan_(plan) {
  if (!plan || !plan.pdfHtml || !plan.fileName || !plan.approvedFindingSetReference) {
    throw new Error('A verified Gold Standard document plan is required.');
  }
  return htmlToPdfBlob_(plan.pdfHtml, plan.fileName);
}

function sanitizeGoldStandardClientText_(value) {
  return String(value == null ? '' : value)
    .replace(/\b[^.\n]*\bscored\s+\d+(?:\.\d+)?\s*\/\s*100\b[^.\n]*\.?/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*\/\s*100\b/g, '')
    .replace(/\bHIGH\s+OPPORTUNITY\b/gi, '')
    .replace(/\baudit\s+(?:score|grade)\s*(?:of|:|was)?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[;,:-]+|[;,:-]+\s*$/g, '')
    .trim();
}

function normalizeGoldStandardComparison_(value) {
  return sanitizeGoldStandardClientText_(value).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function isGoldStandardPlaceholderTitle_(value) {
  return /^(primary priority|supporting priority(?:\s+\d+)?|business finding|priority improvement)$/i.test(String(value || '').trim());
}

function isGoldStandardActionLanguage_(value) {
  return /\b(add|align|clarify|complete|confirm|consolidate|create|define|document|establish|implement|keep|move|place|preserve|publish|remove|replace|route|standardize|test|update|use|validate|verify)(?:s|d|ing)?\b/i.test(String(value || ''));
}

function isGoldStandardActionableFinding_(item) {
  const observation = normalizeGoldStandardComparison_(item.observation);
  const recommendation = normalizeGoldStandardComparison_(item.recommendation);
  return Boolean(
    item.category && !isGoldStandardPlaceholderTitle_(item.category) &&
    observation.length >= 24 && item.businessMeaning && item.businessMeaning.length >= 20 &&
    recommendation.length >= 16 && observation !== recommendation &&
    isGoldStandardActionLanguage_(item.recommendation) && item.evidenceKeys && item.evidenceKeys.length
  );
}

function isGoldStandardRecommendation_(item) {
  return Boolean(item.title && !isGoldStandardPlaceholderTitle_(item.title) && item.change && item.why &&
    isGoldStandardActionLanguage_(item.change) &&
    normalizeGoldStandardComparison_(item.change) !== normalizeGoldStandardComparison_(item.why));
}

function isGoldStandardPlanAction_(item) {
  return Boolean(item.title && !isGoldStandardPlaceholderTitle_(item.title) && item.outcome &&
    item.implementationPath && item.completionTest && isGoldStandardActionLanguage_(item.implementationPath));
}

function assertGoldStandardGenerationReady_(model) {
  const improvements = model.recommendations.filter(function(item) { return item.kind === 'improvement'; });
  const actionRecommendationKeys = model.actions.map(function(item) { return item.recommendationKey; });
  if (!improvements.length || !model.primaryFindingKey) {
    throw new Error('Gold Standard generation blocked: insufficient reviewed evidence. Add a specific evidence-linked observation, business implication, and approved actionable recommendation, then retry.');
  }
  const missingAction = improvements.some(function(item) { return actionRecommendationKeys.indexOf(item.key) === -1; });
  if (missingAction) {
    throw new Error('Gold Standard generation blocked: each approved recommendation requires a reviewed implementation path and completion test.');
  }
  model.findings.forEach(function(item) {
    const required = item.state === 'Actionable'
      ? ['observation', 'expectedCondition', 'businessMeaning', 'consequenceBasis', 'recommendation', 'completionTest']
      : item.state === 'Verified Strength'
        ? ['observation', 'businessMeaning', 'recommendation']
        : ['observation', 'businessMeaning'];
    const missing = required.filter(function(field) { return !String(item[field] || '').trim(); });
    if (missing.length) throw new Error('Gold Standard generation blocked: approved ' + item.state + ' finding ' + item.key + ' is missing required authority: ' + missing.join(', ') + '.');
  });
}

function normalizeGoldStandardEvidenceState_(state) {
  const value = String(state || '').trim().toLowerCase();
  if (value === 'verified strength' || value === 'strength' || value === 'pass') return 'Verified Strength';
  if (value === 'not verified' || value === 'unknown' || value === 'unverified') return 'Not Verified';
  return 'Actionable';
}

function validateGoldStandardLineage_(model, findingKeys, recommendationKeys) {
  model.findings.forEach(function(item) {
    if (!item.evidenceKeys.length) throw new Error('Every Gold Standard finding must cite reviewed evidence.');
    if (item.state === 'Not Verified' && item.recommendation) throw new Error('Not Verified evidence cannot create an actionable recommendation.');
  });
  model.recommendations.forEach(function(item) {
    if (findingKeys.indexOf(item.findingKey) === -1) throw new Error('Gold Standard recommendation has invalid finding lineage.');
  });
  model.actions.forEach(function(item) {
    if (recommendationKeys.indexOf(item.recommendationKey) === -1) throw new Error('Gold Standard action has invalid recommendation lineage.');
  });
}

function deepFreezeGoldStandard_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key) { deepFreezeGoldStandard_(value[key]); });
  return Object.freeze(value);
}

function buildGoldStandardEvidence_(prospect, report) {
  const evidence = [];
  const visual = getAuditEvidenceObject_(prospect, report || {});
  if (visual && (visual.websiteScreenshotUrl || visual.websiteScreenshotBase64)) evidence.push({ key: 'desktop', label: 'Desktop website review', detail: 'Homepage, navigation, customer action, and visible trust signals.', state: 'Actionable' });
  if (visual && (visual.mobileScreenshotUrl || visual.mobileScreenshotBase64)) evidence.push({ key: 'mobile', label: 'Mobile website review', detail: 'Mobile hierarchy, customer action, and service path.', state: 'Actionable' });
  getGoldStandardCandidateFindings_(prospect, report).forEach(function(candidate, index) {
    if (!candidate || typeof candidate !== 'object') return;
    const proof = candidate.evidence && typeof candidate.evidence === 'object' ? candidate.evidence : {};
    const detail = sanitizeGoldStandardClientText_(candidate.supportingEvidence || proof.description || proof.value || proof.detail || '');
    const label = sanitizeGoldStandardClientText_(proof.label || candidate.sourceLabel || candidate.source || '');
    if (detail && label) evidence.push({ key: 'finding-evidence-' + (index + 1), label: label, detail: detail, state: candidate.state || candidate.classification || candidate.evidenceState || 'Actionable' });
  });
  if (!evidence.length) evidence.push({ key: 'legacy-evidence-gap', label: 'Legacy assessment narrative', detail: 'The stored narrative does not contain specific reviewed evidence sufficient for client-facing recommendations.', state: 'Not Verified' });
  evidence.push({ key: 'operational-performance', label: 'Operational performance', detail: 'Response time, lead quality, and fulfillment outcomes were not observable in the reviewed public evidence.', state: 'Not Verified' });
  return evidence;
}

function getGoldStandardCandidateFindings_(prospect, report) {
  return [].concat((report && report.findings) || [], getSmartFindings_(prospect));
}

function buildGoldStandardFindings_(prospect, report) {
  const eligible = filterClientEligibleEvidence_(getGoldStandardCandidateFindings_(prospect, report), prospect, report || {}, 'finding');
  const findings = eligible.map(function(candidate, index) {
    if (!candidate || typeof candidate !== 'object') return null;
    const item = candidate;
    const text = sanitizeGoldStandardClientText_(item.observation || item.businessLanguage || item.consultantObservation || item.finding || item.description || '');
    const state = normalizeGoldStandardEvidenceState_(item.state || item.classification || item.evidenceState);
    const proof = item.evidence && typeof item.evidence === 'object' ? item.evidence : {};
    const hasSpecificProof = Boolean(sanitizeGoldStandardClientText_(item.supportingEvidence || proof.description || proof.value || proof.detail || ''));
    const evidenceKeys = [].concat(item.evidenceKeys || item.evidenceKey || (hasSpecificProof ? ['finding-evidence-' + (index + 1)] : []));
    return {
      key: 'finding-' + (index + 1),
      category: sanitizeGoldStandardClientText_(item.category || item.title || ''),
      state: state,
      observation: text,
      businessImpact: sanitizeGoldStandardClientText_(item.businessImpact || item.businessValue || item.whyVerificationMatters || ''),
      recommendation: state === 'Not Verified' ? '' : sanitizeGoldStandardClientText_(item.recommendedAction || (item.recommendation && (item.recommendation.action || item.recommendation.summary)) || item.recommendation || item.maintain || ''),
      verificationNeeded: state === 'Not Verified' ? sanitizeGoldStandardClientText_(item.verificationNeeded || '') : '',
      priority: sanitizeGoldStandardClientText_(item.priority || state),
      evidenceKeys: evidenceKeys
    };
  }).filter(Boolean);
  if (!findings.length) findings.push({ key: 'verification', category: 'Reviewed Evidence Required', state: 'Not Verified', evidenceGap: 'The stored legacy narrative does not identify a specific verified customer-facing condition.', whyVerificationMatters: 'Implementation advice requires traceable evidence and consultant review.', verificationNeeded: 'Review the website or operational source, record the specific observation and source, and approve any recommendation before generation.', priority: 'Not Verified', evidenceKeys: ['legacy-evidence-gap'] });
  if (!findings.some(function(item) { return normalizeGoldStandardEvidenceState_(item.state) === 'Not Verified'; })) {
    findings.push({ key: 'operational-verification', category: 'Operational Performance', state: 'Not Verified', evidenceGap: 'Response time, lead quality, and fulfillment outcomes were not verified by the reviewed public evidence.', whyVerificationMatters: 'Public claims should reflect standards the business can consistently support.', verificationNeeded: 'Confirm current operating standards before publishing performance claims.', priority: 'Not Verified', evidenceKeys: ['operational-performance'] });
  }
  return findings;
}

function buildGoldStandardLimitations_(findings) {
  const gaps = findings.filter(function(item) { return normalizeGoldStandardEvidenceState_(item.state || item.classification) === 'Not Verified'; });
  return gaps.length ? gaps.map(function(item) { return String(item.verificationNeeded || item.evidenceGap || item.observation || 'We need one more check.'); }) : ['We did not guess about results we could not see.'];
}

function buildGoldStandardOpening_(prospect, primary) {
  if (!primary || isGoldStandardPlaceholderTitle_(primary.category || primary.title)) return '';
  return 'We checked the saved facts for ' + (prospect.company || 'the business') + '. The main problem is ' + String(primary.category || primary.title).toLowerCase() + '.';
}

function buildGoldStandardExecutiveBriefPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardExecutiveBriefHtml_(input), 'Executive Brief.pdf');
}

function buildGoldStandardAssessmentPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardAssessmentHtml_(input), 'Digital Business Assessment.pdf');
}

function buildGoldStandardImprovementPlanPdfBlob_(input) {
  return htmlToPdfBlob_(buildGoldStandardImprovementPlanHtml_(input), 'Improvement Plan.pdf');
}

function goldStandardCss_() {
  return '@page{margin:0;size:letter}*{box-sizing:border-box}body{margin:0;background:#ddd;color:#111;font-family:Arial,Helvetica,sans-serif}.page{width:8.5in;height:11in;background:#fff;margin:0 auto;position:relative;overflow:hidden;break-after:page;page-break-after:always;padding:.78in .66in .62in}.page:last-child{break-after:auto}.content-page{padding-top:.92in}.header{position:absolute;top:.28in;left:.66in;right:.66in;height:.33in;border-bottom:1px solid #d8c59d;font-size:9px;text-transform:uppercase;letter-spacing:1.1px;font-weight:700}.header span{float:right;color:#70695e}footer{position:absolute;bottom:.25in;left:.66in;right:.66in;border-top:1px solid #d8c59d;padding-top:7px;color:#70695e;font-size:7.5px;text-transform:uppercase;letter-spacing:.65px;white-space:nowrap}footer b{color:#b88a32;padding:0 6px}h1,h2,h3,p{margin-top:0}h1{font-size:34px;line-height:1.03}h2{font-size:21px;border-bottom:2px solid #b88a32;padding-bottom:9px;margin-bottom:18px}h3{font-size:12px;margin:0 0 5px;text-transform:uppercase;letter-spacing:.7px}p,li{font-size:10.5px;line-height:1.46}.eyebrow{color:#b88a32;font-size:9px;text-transform:uppercase;letter-spacing:1.4px;font-weight:700}.cover{padding:0;background:#f7f2e7;display:grid;grid-template-columns:36% 64%}.rail{background:#111;color:white;padding:.64in .38in;border-right:5px solid #b88a32;position:relative}.rail .brand{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1.7px}.rail .descriptor{margin-top:.55in;border-top:3px solid #b88a32;padding-top:.2in;color:#ead8b3;font-size:10px;text-transform:uppercase;letter-spacing:1.2px}.motto{position:absolute;bottom:.55in;left:.38in;color:#b88a32;font-size:9px;text-transform:uppercase;letter-spacing:1.4px}.cover-main{padding:1.2in .58in}.cover-main h1{font-size:44px;margin:.12in 0 .68in}.client{font-size:27px;font-weight:700;line-height:1.12}.url{font-size:11px;color:#6d675e;margin-top:9px}.date{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6d675e;margin-top:18px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #d7c49e;border-left:4px solid #b88a32;background:#fff;padding:14px 15px;margin-bottom:12px;break-inside:avoid-page;page-break-inside:avoid}.soft{background:#f7f2e7}.label{font-size:8px;color:#b88a32;text-transform:uppercase;letter-spacing:1.1px;font-weight:700;margin-bottom:6px}.finding{border:1px solid #d7c49e;border-top:4px solid #111;padding:14px 16px;margin:0 0 14px;break-inside:avoid-page;page-break-inside:avoid;background:#fff}.finding-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:11px}.finding-head strong{font-size:13px}.pill{font-size:8px;text-transform:uppercase;letter-spacing:.8px;background:#111;color:white;padding:5px 8px;height:22px;white-space:nowrap}.check-badge{display:inline-block;background:#9b7528;color:#fff;border-radius:10px;padding:2px 7px;font-size:8px;font-weight:700;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}.finding dl{display:grid;grid-template-columns:128px 1fr;gap:6px 12px;margin:0}.finding dt{font-size:8px;text-transform:uppercase;letter-spacing:.75px;color:#756b5d;font-weight:700}.finding dd{font-size:9.5px;line-height:1.4;margin:0}.roadmap{display:grid;gap:12px}.action{border:1px solid #d7c49e;background:#f7f2e7;padding:14px 16px;break-inside:avoid-page}.action-head{display:flex;gap:12px;align-items:baseline}.seq{color:#b88a32;font-size:20px;font-weight:700}.action table{width:100%;border-collapse:collapse;margin-top:9px}.action td{vertical-align:top;border-top:1px solid #ddd0b8;padding:7px 8px 0 0;font-size:9px;line-height:1.35}.decision{background:#111;color:white;border-top:4px solid #b88a32;padding:18px}.decision h3{color:#b88a32}ul{padding-left:17px;margin:6px 0}.brief{background:#f7f2e7;padding:.3in .43in .28in}.brief .top{border-bottom:3px solid #b88a32;display:flex;justify-content:space-between;padding-bottom:11px}.brief .top h1{font-size:28px;margin:3px 0 0}.brief .meta{text-align:right;font-size:9px;line-height:1.5;text-transform:uppercase;color:#70695e}.brief .summary{display:grid;grid-template-columns:1fr 2.2in;gap:12px;align-items:stretch;margin-top:12px}.brief .summary .card{margin:0}.brief .scope{background:#111;color:#fff;border-top:4px solid #b88a32;padding:11px 13px}.brief .scope strong{display:block;color:#d2a33e;font-size:13px;margin-bottom:6px;text-transform:uppercase}.brief .priority{border:1px solid #d7c49e;border-top:4px solid #111;background:#fff;padding:11px 14px;margin-top:10px}.brief .priority h2{border:0;padding:0;margin:0;font-size:19px;line-height:1.14}.brief .main{display:grid;grid-template-columns:.8fr 1.2fr;gap:11px;margin-top:10px}.brief .card{padding:10px 12px;margin:0}.brief .meaning{margin-top:10px}.brief .action-block{margin-top:10px;border:1px solid #d7c49e;border-left:4px solid #b88a32;background:#fff;padding:10px 13px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.brief .verify{border-left:1px solid #ddd0b8;padding-left:12px}.brief .provenance{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:10px}.brief .note{background:#efe7d7;border-left:4px solid #b88a32;padding:8px 10px}.brief .secondary{margin-top:10px;border-top:1px solid #d7c49e;padding-top:8px}.brief .secondary ul{display:grid;grid-template-columns:1fr 1fr;gap:4px 22px}.brief .closing{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:10px}.brief .cta{margin:0;background:#111;color:white;border-top:4px solid #b88a32;padding:10px 12px}.brief .help{background:#fff;border:1px solid #d7c49e;border-top:4px solid #b88a32;padding:10px 12px}.brief footer{left:.43in;right:.43in}.assessment-section{font-size:16px;margin:16px 0 10px;padding-bottom:6px}.assessment-table{width:100%;border-collapse:collapse;margin:0 0 12px;table-layout:fixed}.assessment-table th{background:#111;color:#fff;text-transform:uppercase;letter-spacing:.55px;font-size:7.5px;text-align:left;padding:7px}.assessment-table td{border:1px solid #d7c49e;font-size:8.5px;line-height:1.32;padding:7px;vertical-align:top}.diagnostic{break-inside:avoid-page}.diagnostic .finding-head h2{border:0;margin:0;padding:0;font-size:23px;line-height:1.15}.diagnostic-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-bottom:12px}.diagnostic-grid>div{border-top:2px solid #b88a32;padding-top:8px}.diagnostic-grid p{font-size:9.5px}.trace-heading{margin:13px 0 7px}.assessment-note{background:#f1eadc;border-left:4px solid #b88a32;padding:9px 11px;font-size:9px;line-height:1.4}.assessment-note ul{margin:0}.assessment-close{margin-top:12px;padding:13px 15px}.assessment-close p{font-size:9.5px;margin-bottom:6px}.tiny{font-size:9px;color:#6d675e}.section-intro{margin-bottom:14px}.atomic{break-inside:avoid-page;page-break-inside:avoid}';
}

function goldStandardDocument_(pages) {
  const printColorCss = '.score,.brief .cta,.decision{color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.score strong,.brief .cta h3,.decision h3{color:#d2a33e!important}.score p,.brief .cta p,.decision p{color:#fff!important;opacity:1}';
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + goldStandardCss_() + printColorCss + '</style></head><body>' + pages.join('') + '</body></html>';
}
function goldStandardHeader_(title, page) { return '<div class="header">Rogers Holdings LLC <span>' + escapeHtml_(title) + ' · ' + escapeHtml_(page) + '</span></div>'; }
function goldStandardFooter_(title) { const contact = getRogersContactInfo_(); return '<footer>Rogers Holdings LLC <b>|</b> ' + escapeHtml_(title) + (contact.email ? ' <b>|</b> ' + escapeHtml_(contact.email) : '') + '</footer>'; }
function goldStandardCover_(input, title, descriptor) { return '<section class="page cover"><div class="rail"><div class="brand">Rogers Holdings LLC</div><div class="descriptor">' + escapeHtml_(descriptor) + '</div><div class="motto">Christ. Family. Business.</div></div><div class="cover-main"><div class="eyebrow">Prepared for</div><h1>' + escapeHtml_(title) + '</h1><div class="client">' + escapeHtml_(input.company) + '</div><div class="url">' + escapeHtml_(input.website) + '</div><div class="date">Prepared ' + escapeHtml_(input.preparedDate) + '</div></div></section>'; }
function goldStandardList_(items) { return '<ul>' + items.filter(Boolean).map(function(item) { return '<li>' + escapeHtml_(item) + '</li>'; }).join('') + '</ul>'; }

function buildGoldStandardExecutiveBriefContent_(input) {
  const primary = input.findings.filter(function(item) { return item.key === input.primaryFindingKey; })[0] || input.findings[0] || {};
  const recommendation = input.recommendations.filter(function(item) { return item.findingKey === primary.key; })[0] || {};
  const action = input.actions.filter(function(item) { return item.recommendationKey === recommendation.key; })[0] || input.actions[0] || {};
  const evidence = input.evidence.filter(function(item) { return (primary.evidenceKeys || []).indexOf(item.key) !== -1; }).map(function(item) {
    return String(item.label || '').split(/\s+[—-]\s+/).slice(-1)[0];
  }).filter(Boolean);
  const secondary = input.findings.filter(function(item) { return item.key !== primary.key && item.state === 'Actionable'; });
  const count = input.findings.filter(function(item) { return item.state === 'Actionable'; }).length;
  const plainFq1 = isPlainFq1RequestServiceFinding_(primary, recommendation, action);
  return deepFreezeGoldStandard_({
    summary: count === 1 ? 'This brief shows the main problem, the fix, and how to check the work.' : 'This brief shows the main problems, the fixes, and how to check the work.',
    clearFixLabel: count === 1 ? 'One Clear Fix' : 'Clear Fixes',
    clearFix: plainFq1 ? 'Add a Request Service link to the Services page menu.' : (recommendation.change || primary.recommendation),
    findingId: primary.key,
    title: primary.category,
    observation: primary.observation,
    synthesis: plainFq1 ? 'Your website helps people learn about your services. The missing link is the next step to ask for help.' : '',
    consequence: plainFq1 ? 'People can learn about your services, but they still have to search for the request form. That extra step makes asking for help harder. A clear Request Service link gives them one easy next step.' : primary.businessMeaning,
    recommendationId: recommendation.key,
    recommendation: recommendation.change || primary.recommendation,
    expectedResult: primary.intendedOutcome || action.outcome,
    completionTest: action.completionTest,
    evidenceReferences: evidence,
    limitations: input.limitations.slice(),
    secondaryPriorities: secondary.slice(0, 2).map(function(item) { return item.category; }),
    additionalPriorityCount: Math.max(0, secondary.length - 2),
    nextStep: input.nextStep,
    helpCta: 'Reply to this report. We can walk through the next steps with you.'
  });
}

function isPlainFq1RequestServiceFinding_(finding, recommendation, action) {
  return normalizeGoldStandardComparison_(finding && finding.category) === normalizeGoldStandardComparison_('The Services page menu needs a Request Service link') &&
    normalizeGoldStandardComparison_(finding && finding.observation) === normalizeGoldStandardComparison_('The Services page menu has no Request Service link.') &&
    normalizeGoldStandardComparison_(recommendation && recommendation.change) === normalizeGoldStandardComparison_('Add a Request Service link to the Services page menu. Point it to the approved request form.') &&
    normalizeGoldStandardComparison_(action && action.completionTest) === normalizeGoldStandardComparison_('Test the link on a phone and a computer. It should open the request form in one click.');
}

function buildGoldStandardExecutiveBriefHtml_(input, suppliedContent) {
  const content = suppliedContent || buildGoldStandardExecutiveBriefContent_(input);
  const secondary = content.secondaryPriorities.length ? '<div class="secondary"><div class="label">Other main problems</div>' + goldStandardList_(content.secondaryPriorities) + (content.additionalPriorityCount ? '<p class="tiny">' + content.additionalPriorityCount + ' more ' + (content.additionalPriorityCount === 1 ? 'problem appears' : 'problems appear') + ' in the Digital Business Assessment.</p>' : '') + '</div>' : '';
  const provenanceRows = (content.evidenceReferences.length ? content.evidenceReferences : ['Saved evidence']).map(function(reference) {
    return '<p><span class="check-badge">&#10003; Checked</span> ' + escapeHtml_(reference) + '</p>';
  }).join('');
  const limitation = content.limitations.length ? content.limitations.join(' · ') : 'No additional material limitation was recorded for this brief.';
  const meaning = content.synthesis ? '<div class="note meaning"><div class="label">What this means</div><p>' + escapeHtml_(content.synthesis) + '</p></div>' : '';
  // Exact website asset: Rogers Holdings Website/assets/images/brand/rogers-holdings-logo.png (160 x 160 PNG).
  // SHA-256: 242ea2b98cc1a67031840ee37bda6307b9c7c7ab6d357546988d1b31fdf6bef2. Embedded for offline PDF rendering.
  const logoHtml = '<img class="executive-brief-logo" src="data:image/png;base64,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" alt="Rogers Holdings LLC logo" width="44" height="44" style="display:block;flex:none;object-fit:contain;">';
  const page = '<section class="page brief"><div class="top"><div style="display:flex;align-items:center;gap:12px;">' + logoHtml + '<div><div class="eyebrow">Business Snapshot</div><h1>Executive Brief</h1></div></div><div class="meta">Prepared ' + escapeHtml_(input.preparedDate) + '<br>Rogers Holdings LLC</div></div><div class="summary"><div class="card"><div class="label">Prepared for</div><h2 style="font-size:22px;border:0;padding:0;margin:0 0 5px">' + escapeHtml_(input.company) + '</h2><div class="tiny">' + escapeHtml_(input.website) + '</div><div class="label" style="margin-top:8px">Quick summary</div><p>' + escapeHtml_(content.summary) + '</p></div><div class="scope"><strong>' + escapeHtml_(content.clearFixLabel) + '</strong><p>' + escapeHtml_(content.clearFix) + '</p></div></div><div class="priority"><div class="label">Main problem</div><h2>' + escapeHtml_(content.title) + '</h2></div><div class="main"><div class="card"><div class="label">What we saw</div><p>' + escapeHtml_(content.observation) + '</p></div><div class="card"><div class="label">Why this matters</div><p>' + escapeHtml_(content.consequence) + '</p></div></div>' + meaning + '<div class="action-block"><div><div class="label">What should happen</div><p>' + escapeHtml_(content.expectedResult) + '</p></div><div class="verify"><div class="label">How to check the fix</div><p>' + escapeHtml_(content.completionTest) + '</p></div></div><div class="provenance"><div class="note"><div class="label">Where we looked</div>' + provenanceRows + '</div><div class="note"><div class="label">What we did not test</div><p>' + escapeHtml_(limitation) + '</p></div></div>' + secondary + '<div class="closing"><div class="cta"><h3>Next step</h3><p>' + escapeHtml_(content.nextStep) + '</p></div><div class="help"><h3>Want help with this fix?</h3><p>' + escapeHtml_(content.helpCta) + '</p></div></div>' + goldStandardFooter_('Executive Brief') + '</section>';
  return goldStandardDocument_([page]);
}

function goldStandardFinding_(finding) {
  let rows;
  if (finding.state === 'Verified Strength') rows = [['Observation', finding.observation], ['Business Value', finding.businessMeaning], ['Maintain', finding.recommendation], ['Classification', finding.priority]];
  else if (finding.state === 'Not Verified') rows = [['Evidence Gap', finding.observation], ['Why Verification Matters', finding.businessMeaning], ['Verification Needed', finding.verificationNeeded], ['Classification', finding.priority]];
  else rows = [['Observation', finding.observation], ['Business Impact', finding.businessMeaning], ['Recommendation', finding.recommendation], ['Priority', finding.priority]];
  return '<article class="finding"><div class="finding-head"><strong>' + escapeHtml_(finding.category) + '</strong><span class="pill">' + escapeHtml_(finding.state === 'Actionable' ? finding.priority.split(' - ')[0] : finding.state) + '</span></div><dl>' + rows.map(function(row) { return '<dt>' + escapeHtml_(row[0]) + '</dt><dd>' + escapeHtml_(row[1]) + '</dd>'; }).join('') + '</dl></article>';
}

function goldStandardRecommendationCard_(item, index) { return '<div class="card"><h3>' + (index + 1) + '. ' + escapeHtml_(item.title) + '</h3><p><b>What should change:</b> ' + escapeHtml_(item.change) + '</p><p><b>Why it matters:</b> ' + escapeHtml_(item.why) + '</p><p><b>Dependency:</b> ' + escapeHtml_(item.dependency) + '</p></div>'; }
function goldStandardAction_(item) { return '<div class="action"><div class="action-head"><span class="seq">' + ('0' + item.sequence).slice(-2) + '</span><h3>' + escapeHtml_(item.title) + '</h3></div><table><tr><td><b>Owner/path</b><br>' + escapeHtml_(item.implementationPath) + '</td><td><b>Dependency</b><br>' + escapeHtml_(item.dependency) + '</td><td><b>Completion test</b><br>' + escapeHtml_(item.completionTest) + '</td></tr></table></div>'; }

function buildGoldStandardAssessmentContent_(input) {
  const context = input.businessContext || {};
  const evidenceByKey = {};
  input.evidence.forEach(function(item) { evidenceByKey[item.key] = item; });
  const recommendationsByFinding = {};
  input.recommendations.forEach(function(item) { recommendationsByFinding[item.findingKey] = item; });
  const actionsByRecommendation = {};
  input.actions.forEach(function(item) { actionsByRecommendation[item.recommendationKey] = item; });
  const findings = input.findings.map(function(item, index) {
    const recommendation = recommendationsByFinding[item.key] || {};
    const action = actionsByRecommendation[recommendation.key] || {};
    const linkedEvidence = (item.evidenceKeys || []).map(function(key) { return evidenceByKey[key]; }).filter(Boolean);
    const plainFq1 = isPlainFq1RequestServiceFinding_(item, recommendation, action);
    return {
      order: index + 1,
      findingId: item.key,
      title: item.category,
      state: item.state,
      channelType: item.channelType,
      customerJourneyStage: item.customerJourneyStage,
      observation: item.observation,
      expectedCondition: item.expectedCondition,
      consequence: plainFq1 ? 'A customer must search for the request form. That extra step makes asking for help harder.' : item.businessMeaning,
      consequenceBasis: item.consequenceBasis,
      showConsequenceBasis: !isRedundantAssessmentConsequenceBasis_(item, linkedEvidence),
      verificationNeeded: item.verificationNeeded,
      recommendationId: recommendation.key,
      recommendation: recommendation.change || item.recommendation,
      implementationLocation: item.implementationLocation,
      completionTest: action.completionTest || item.completionTest,
      confidence: item.evidenceConfidence,
      evidence: linkedEvidence.map(function(evidence) {
        return {
          evidenceId: evidence.key,
          channel: item.channelType || evidence.sourceType || evidence.label,
          location: plainGoldStandardEvidenceLocation_(evidence.evidenceLocation || evidence.pageTitle || evidence.pagePath || evidence.label),
          inspection: plainGoldStandardInspection_(evidence),
          observedResult: evidence.testResult,
          limitations: evidence.limitations.slice()
        };
      }),
      limitations: item.limitations.slice()
    };
  });
  const materialLimitations = input.limitations.slice();
  const findingLimitations = findings.reduce(function(all, item) { return all.concat(item.limitations || []); }, []);
  return deepFreezeGoldStandard_({
    overview: {
      company: input.company,
      preparedDate: input.preparedDate,
      purpose: 'We checked the saved pages for a clear way to ask for help. This report shows what we checked, what we found, and what to do next.',
      primaryService: context.primaryService,
      targetCustomer: context.targetCustomer,
      serviceArea: context.serviceArea,
      desiredCustomerAction: context.desiredCustomerAction,
      primaryBusinessObjective: context.primaryBusinessObjective,
      knownConstraints: context.knownConstraints
    },
    scope: input.presence.map(function(item) {
      const checked = item.presenceState === 'Verified Present' && item.applicability === 'Applicable';
      return { channel: plainGoldStandardChannel_(item.channelName || item.channelType), checked: checked, status: checked ? 'Checked' : (item.applicability === 'Not Applicable' ? plainGoldStandardApplicability_(item.applicability) : plainGoldStandardPresenceState_(item.presenceState)), presenceState: plainGoldStandardPresenceState_(item.presenceState), applicability: plainGoldStandardApplicability_(item.applicability), role: item.roleInCustomerJourney, limitation: item.limitations.join('; ') };
    }),
    methodology: input.evidence.map(function(item) {
      return {
        sourceValue: item.sourceType || item.label,
        locationValue: item.evidenceLocation || item.pageTitle || item.pagePath || item.label,
        captureMethodValue: item.captureMethod,
        desktopMobileContextValue: item.desktopMobileContext,
        testPerformedValue: item.testPerformed,
        resultValue: item.testResult || item.detail,
        whereChecked: plainGoldStandardEvidenceLocation_(item.evidenceLocation || item.pageTitle || item.pagePath || item.label),
        testRecord: plainGoldStandardTestRecord_(item.captureMethod || item.sourceType || item.label),
        whatChecked: plainGoldStandardWhatWasChecked_(item),
        whatDone: plainGoldStandardTestPerformed_(item.testPerformed || item.captureMethod),
        whatFound: item.testResult || item.detail
      };
    }),
    evidenceNotes: input.evidence.reduce(function(all, item) { return all.concat((item.limitations || []).map(plainGoldStandardEvidenceNote_)); }, []).filter(function(value, index, all) { return Boolean(value) && all.indexOf(value) === index; }),
    findings: findings,
    limitations: materialLimitations.filter(function(value, index, all) { return Boolean(value) && all.indexOf(value) === index && findingLimitations.indexOf(value) === -1; }),
    prioritization: findings.length > 1 ? findings.map(function(item) { return item.title; }) : [],
    conclusion: 'We found ' + findings.length + ' ' + (findings.length === 1 ? 'problem' : 'problems') + '. See the Improvement Plan for the ' + (findings.length === 1 ? 'fix' : 'fixes') + '.',
    nextStep: 'Read the Improvement Plan. Choose who will do the work.'
  });
}

function isRedundantAssessmentConsequenceBasis_(finding, evidence) {
  const basis = normalizeGoldStandardComparison_(finding && finding.consequenceBasis);
  const observed = (evidence || []).map(function(item) { return normalizeGoldStandardComparison_(item.testResult); });
  return basis === normalizeGoldStandardComparison_('The Services page menu has no direct link to the request form.') &&
    observed.indexOf(normalizeGoldStandardComparison_('No direct route to inquiry form')) !== -1;
}

function plainGoldStandardChannel_(value) {
  return String(value || '') === 'Google Business Profile' ? 'Google Business Profile (Google business listing)' : String(value || '');
}

function plainGoldStandardEvidenceSource_(value) {
  return /element inspection/i.test(String(value || '')) ? 'Page item check' : String(value || '');
}

function plainGoldStandardEvidenceLocation_(value) {
  return String(value || '').replace(/primary navigation/gi, 'menu');
}

function plainGoldStandardTestRecord_(value) {
  const text = String(value || '');
  return /^Controlled manual fixture$/i.test(text) ? text + ' (a test website checked by a person)' : text;
}

function plainGoldStandardWhatWasChecked_(item) {
  const context = /desktop and mobile|both/i.test(String(item.desktopMobileContext || '')) ? ' on a phone and computer' : '';
  const subject = /menu|navigation/i.test([item.elementLabel, item.evidenceLocation, item.pageTitle].join(' ')) && /link/i.test(String(item.elementType || '')) ? 'The menu link' : String(item.elementLabel || item.elementType || 'The saved item');
  return subject + context;
}

function plainGoldStandardTestPerformed_(value) {
  const text = String(value || '');
  return /non-submitting navigation review/i.test(text) ? 'We checked the menu without sending the form' : text;
}

function plainGoldStandardEvidenceNote_(value) {
  const text = String(value || '');
  return /^Fictional public-page evidence$/i.test(text) ? text + ' (a fictional public test page)' : text;
}

function plainGoldStandardInspection_(item) {
  const parts = [];
  if (item.captureMethod) parts.push(/element inspection/i.test(item.captureMethod) ? 'Checked the page item' : item.captureMethod);
  if (item.elementType) parts.push(/primary navigation/i.test(item.elementType) ? 'Main menu' : item.elementType);
  if (item.desktopMobileContext) parts.push(/desktop and mobile|both/i.test(item.desktopMobileContext) ? 'Phone and computer' : item.desktopMobileContext);
  if (item.testPerformed) parts.push(/non-submitting navigation review/i.test(item.testPerformed) ? 'Checked the menu without sending the form' : item.testPerformed);
  return parts.filter(Boolean).join(' · ') || 'Checked the saved proof';
}

function plainGoldStandardPresenceState_(value) {
  const labels = { 'Verified Present': 'Found and checked', 'Verified Absent': 'Not found after checking', 'Not Verified': 'Not checked' };
  return labels[String(value || '')] || String(value || '');
}

function plainGoldStandardApplicability_(value) {
  const labels = { 'Applicable': 'Used in this review', 'Needs Verification': 'Needs a check', 'Not Applicable': 'Not needed here' };
  return labels[String(value || '')] || String(value || '');
}

function goldStandardAssessmentTable_(headers, rows) {
  return '<table class="assessment-table"><thead><tr>' + headers.map(function(item) { return '<th>' + escapeHtml_(item) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function(row) { return '<tr>' + row.map(function(item) { return '<td>' + escapeHtml_(item || '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
}

function goldStandardAssessmentScopeTable_(items) {
  return '<table class="assessment-table"><thead><tr><th>Place</th><th>Status</th><th>How it helps customers</th></tr></thead><tbody>' + items.map(function(item) {
    const status = item.checked ? '<span class="check-badge">&#10003; Checked</span>' : escapeHtml_(item.status);
    return '<tr><td>' + escapeHtml_(item.channel) + '</td><td>' + status + '</td><td>' + escapeHtml_(item.role) + '</td></tr>';
  }).join('') + '</tbody></table>';
}

function goldStandardAssessmentMethodology_(items) {
  return items.map(function(item) {
    return '<div class="assessment-note assessment-method"><p><b>Where we checked:</b> ' + escapeHtml_(item.whereChecked) + '</p><p><b>Test record:</b> ' + escapeHtml_(item.testRecord) + '</p><p><b>What we checked:</b> ' + escapeHtml_(item.whatChecked) + '</p><p><b>What we did:</b> ' + escapeHtml_(item.whatDone) + '</p><p><b>What we found:</b> ' + escapeHtml_(item.whatFound) + '</p></div>';
  }).join('');
}

function goldStandardAssessmentFinding_(finding) {
  const confidence = finding.confidence ? Math.round(finding.confidence * 100) >= 85 ? 'Clear result' : 'Checked result' : '';
  const evidenceRows = finding.evidence.map(function(item) { return [item.channel, item.location, item.inspection, item.observedResult]; });
  if (finding.state === 'Not Verified') {
    return '<article class="diagnostic diagnostic-secondary"><div class="finding-head"><div><div class="label">What we could not check</div><h2>' + escapeHtml_(finding.title) + '</h2></div><span class="pill">Not checked</span></div><div class="diagnostic-grid"><div><h3>What is missing</h3><p>' + escapeHtml_(finding.observation) + '</p></div><div><h3>Why this matters</h3><p>' + escapeHtml_(finding.consequence) + '</p></div></div>' + (evidenceRows.length ? '<h3 class="trace-heading">What we checked</h3>' + goldStandardAssessmentTable_(['Place', 'Where', 'How we checked', 'What we found'], evidenceRows) : '') + (finding.verificationNeeded ? '<div class="assessment-note"><b>What to check next:</b> ' + escapeHtml_(finding.verificationNeeded) + '</div>' : '') + '</article>';
  }
  if (finding.state === 'Verified Strength') {
    return '<article class="diagnostic diagnostic-secondary"><div class="finding-head"><div><div class="label">What works well</div><h2>' + escapeHtml_(finding.title) + '</h2></div><span class="pill">Checked</span></div><div class="diagnostic-grid"><div><h3>What we saw</h3><p>' + escapeHtml_(finding.observation) + '</p></div><div><h3>Why this helps</h3><p>' + escapeHtml_(finding.consequence) + '</p></div></div>' + (finding.recommendation ? '<div class="card soft"><h3>Keep doing this</h3><p>' + escapeHtml_(finding.recommendation) + '</p></div>' : '') + (evidenceRows.length ? '<h3 class="trace-heading">What we checked</h3>' + goldStandardAssessmentTable_(['Place', 'Where', 'How we checked', 'What we found'], evidenceRows) : '') + '</article>';
  }
  const basis = finding.showConsequenceBasis ? '<div><h3>Why we know this</h3><p>' + escapeHtml_(finding.consequenceBasis) + '</p></div>' : '';
  return '<article class="diagnostic"><div class="finding-head"><div><div class="label">What we found ' + finding.order + '</div><h2>' + escapeHtml_(finding.title) + '</h2></div>' + (confidence ? '<span class="pill">' + escapeHtml_(confidence) + '</span>' : '') + '</div><div class="diagnostic-grid"><div><h3>What we saw</h3><p>' + escapeHtml_(finding.observation) + '</p></div><div><h3>What should happen</h3><p>' + escapeHtml_(finding.expectedCondition) + '</p></div><div><h3>Why this matters</h3><p>' + escapeHtml_(finding.consequence) + '</p></div>' + basis + '</div><div class="card soft"><h3>What to change</h3><p>' + escapeHtml_(finding.recommendation) + '</p>' + (finding.implementationLocation ? '<p><b>Where to change it:</b> ' + escapeHtml_(finding.implementationLocation) + '</p>' : '') + '<p><b>How to check the fix:</b> ' + escapeHtml_(finding.completionTest) + '</p></div>' + evidenceRows.map(function(row) { return '<div class="assessment-note"><b>Observed result:</b> ' + escapeHtml_(row[3]) + '</div>'; }).join('') + (finding.limitations.length ? '<div class="assessment-note"><b>What we did not test:</b> ' + escapeHtml_(finding.limitations.join('; ')) + '</div>' : '') + '</article>';
}

function buildGoldStandardAssessmentHtml_(input, suppliedContent) {
  const content = suppliedContent || buildGoldStandardAssessmentContent_(input);
  const pages = [goldStandardCover_(input, 'Digital Business Assessment', 'Detailed Business Check')];
  const overviewRows = [
    ['Main goal', content.overview.primaryBusinessObjective], ['What customers should do', content.overview.desiredCustomerAction],
    ['Main service', content.overview.primaryService], ['Who needs the service', content.overview.targetCustomer],
    ['Area served', content.overview.serviceArea], ['Rule to follow', content.overview.knownConstraints]
  ].filter(function(row) { return row[1]; });
  const channelScopeNotes = content.scope.filter(function(item) { return item.limitation; }).map(function(item) { return '<b>' + escapeHtml_(item.channel) + ':</b> ' + escapeHtml_(item.limitation); });
  pages.push('<section class="page content-page assessment-page">' + goldStandardHeader_('Digital Business Assessment', '02') + '<h2>What We Checked</h2><p class="section-intro">' + escapeHtml_(content.overview.purpose) + '</p>' + goldStandardAssessmentTable_(['Item', 'What we learned'], overviewRows) + (content.scope.length ? '<h2 class="assessment-section">Where We Looked</h2>' + goldStandardAssessmentScopeTable_(content.scope) + (channelScopeNotes.length ? '<div class="assessment-note"><b>What we did not check</b><br>' + channelScopeNotes.join('<br>') + '</div>' : '') : '') + (content.methodology.length ? '<h2 class="assessment-section">How We Checked</h2>' + goldStandardAssessmentMethodology_(content.methodology) : '') + (content.evidenceNotes.length ? '<h2 class="assessment-section">Important Evidence Note</h2><div class="assessment-note">' + goldStandardList_(content.evidenceNotes) + '</div>' : '') + goldStandardFooter_('Digital Business Assessment') + '</section>');
  const findingPages = [];
  content.findings.forEach(function(finding) {
    if (finding.state === 'Actionable' || !findingPages.length || findingPages[findingPages.length - 1][0].state === 'Actionable' || findingPages[findingPages.length - 1].length >= 2) findingPages.push([finding]);
    else findingPages[findingPages.length - 1].push(finding);
  });
  findingPages.forEach(function(pageFindings, index) {
    const isLast = index === findingPages.length - 1;
    const close = isLast ? (content.limitations.length ? '<h2 class="assessment-section">What We Did Not Check</h2><div class="assessment-note">' + goldStandardList_(content.limitations) + '</div>' : '') + '<div class="decision assessment-close"><h3>What Happens Next</h3><p>' + escapeHtml_(content.conclusion) + '</p><p>' + escapeHtml_(content.nextStep) + '</p></div>' : '';
    pages.push('<section class="page content-page assessment-page">' + goldStandardHeader_('Digital Business Assessment', ('0' + (index + 3)).slice(-2)) + pageFindings.map(goldStandardAssessmentFinding_).join('') + close + goldStandardFooter_('Digital Business Assessment') + '</section>');
  });
  return goldStandardDocument_(pages);
}

function buildGoldStandardImprovementPlanContent_(input) {
  const findingsByKey = {};
  const recommendationsByKey = {};
  input.findings.forEach(function(item) { findingsByKey[item.key] = item; });
  input.recommendations.forEach(function(item) { recommendationsByKey[item.key] = item; });
  const actions = input.actions.map(function(action) {
    const recommendation = recommendationsByKey[action.recommendationKey] || {};
    const finding = findingsByKey[recommendation.findingKey] || {};
    const limitationKeys = {};
    const authorityLimitations = [].concat(finding.limitations || []);
    const limitations = authorityLimitations.filter(function(value) {
      const key = normalizeGoldStandardComparison_(value);
      if (!key || limitationKeys[key]) return false;
      limitationKeys[key] = true;
      return true;
    });
    const dependencyKeys = {};
    const dependencies = [];
    if (/request form|inquiry form/i.test(recommendation.change || finding.recommendation || '')) dependencies.push('Confirmed web address for the request form.');
    if (finding.implementationLocation) dependencies.push('Access to the ' + finding.implementationLocation + '.');
    dependencies.push('A person chosen to make the change.');
    if (action.dependency) {
      const actionDependencyKey = normalizeGoldStandardComparison_(action.dependency);
      const isMaterialLimitation = Object.keys(limitationKeys).some(function(limitationKey) {
        return limitationKey === actionDependencyKey || limitationKey.indexOf(actionDependencyKey) !== -1;
      });
      if (!isMaterialLimitation) dependencies.push(action.dependency);
    }
    const uniqueDependencies = dependencies.map(function(value) {
      return sanitizeGoldStandardClientText_(value).replace(/[.;:,!?]+\s*$/, '');
    }).filter(function(value) {
      const key = normalizeGoldStandardComparison_(value);
      if (!key || dependencyKeys[key]) return false;
      dependencyKeys[key] = true;
      return true;
    });
    const implementationRepeatsChange = normalizeGoldStandardComparison_(action.implementationPath).indexOf(normalizeGoldStandardComparison_(recommendation.change || '')) !== -1;
    const implementationPath = implementationRepeatsChange
      ? 'The chosen person makes the change in the listed place.'
      : action.implementationPath;
    const focusedRequestServiceAction = isPlainFq1RequestServiceFinding_(finding, recommendation, action);
    return {
      sequence: action.sequence,
      actionId: action.key,
      title: action.title,
      implementationObjective: buildGoldStandardImprovementObjective_(action, finding, recommendation),
      exactChange: recommendation.change || finding.recommendation,
      implementationLocation: finding.implementationLocation,
      intendedOutcome: action.outcome,
      ownership: input.company + ' chooses who will make the change. Outside help needs separate approval.',
      implementationPath: implementationPath,
      showImplementationPath: !focusedRequestServiceAction && !implementationRepeatsChange,
      dependencies: uniqueDependencies,
      limitations: limitations,
      completionTest: action.completionTest,
      showCompletionTest: !focusedRequestServiceAction,
      showIntendedOutcome: true
    };
  });
  const actionLimitationValues = actions.reduce(function(all, item) { return all.concat(item.limitations); }, []).map(normalizeGoldStandardComparison_);
  const singleAction = actions.length === 1 ? actions[0] : null;
  if (singleAction && normalizeGoldStandardComparison_(singleAction.implementationObjective) === normalizeGoldStandardComparison_(singleAction.intendedOutcome)) {
    singleAction.showIntendedOutcome = false;
  }
  return deepFreezeGoldStandard_({
    subtitle: 'These steps show what to change, who will do it, and how to check the work.',
    objective: singleAction ? singleAction.implementationObjective : 'Complete the ' + actions.length + ' listed changes. Make each change in the listed place. Check each result.',
    actions: actions,
    planLimitations: input.limitations.filter(function(item) { return actionLimitationValues.indexOf(normalizeGoldStandardComparison_(item)) === -1; }),
    sequence: buildGoldStandardImprovementSequence_(actions),
    nextStep: buildGoldStandardImprovementNextStep_(actions)
  });
}

function isFq1NavigationImprovement_(action, finding, recommendation) {
  return normalizeGoldStandardComparison_(recommendation.change || finding.recommendation) === normalizeGoldStandardComparison_('Add a Request Service link targeting the approved inquiry form to the Services page primary navigation.') &&
    normalizeGoldStandardComparison_(finding.implementationLocation) === normalizeGoldStandardComparison_('Services page primary navigation template') &&
    normalizeGoldStandardComparison_(action.completionTest) === normalizeGoldStandardComparison_('Verify on desktop and mobile that the Services page Request Service link reaches the working inquiry form in one click.');
}

function buildGoldStandardImprovementObjective_(action, finding, recommendation) {
  if (isPlainFq1RequestServiceFinding_(finding, recommendation, action)) return 'Make it easy for customers to reach the request form from the Services page menu.';
  if (isFq1NavigationImprovement_(action, finding, recommendation)) return 'Add a Request Service link to the Services page menu. Test it on a phone and a computer. The link should open the request form in one click.';
  return action.outcome || recommendation.why || finding.intendedOutcome;
}

function buildGoldStandardImprovementSequence_(actions) {
  if (actions.length === 1 && /request service link/i.test(actions[0].exactChange || '')) {
    return ['Confirm the request form web address. Choose who will make the change.', 'Add the Request Service link to the Services page menu.', actions[0].showCompletionTest ? 'Test the link on a phone and a computer. It should open the form in one click.' : actions[0].completionTest, 'Write down the test result. Then close the task.'];
  }
  if (actions.length === 1) return [];
  return actions.reduce(function(steps, action) {
    steps.push('Complete Action ' + ('0' + action.sequence).slice(-2) + ' in the listed place.');
    steps.push('Run the listed test for Action ' + ('0' + action.sequence).slice(-2) + '.');
    return steps;
  }, []).concat(['Write down each test result. Then close the task.']);
}

function buildGoldStandardImprovementNextStep_(actions) {
  if (actions.length === 1 && /request service link/i.test(actions[0].exactChange || '')) return 'Choose who will make the change. Confirm the request form web address. Then approve the menu update.';
  return 'Choose who will make each change. Confirm what the work needs. Then approve the first task.';
}

function goldStandardImprovementAction_(item) {
  const dependencies = item.dependencies.length ? '<div class="card"><h3>What we need first</h3>' + goldStandardList_(item.dependencies) + '</div>' : '';
  const limitations = item.limitations.length ? '<div class="assessment-note"><b>What we did not test</b>' + goldStandardList_(item.limitations) + '</div>' : '';
  const implementationPath = item.showImplementationPath ? '<p>' + escapeHtml_(item.implementationPath) + '</p>' : '';
  const completion = item.showCompletionTest ? '<div class="card"><div class="label">How to check the fix</div><p>' + escapeHtml_(item.completionTest) + '</p></div>' : '';
  const outcome = item.showIntendedOutcome ? '<div class="card"><div class="label">What should happen</div><p>' + escapeHtml_(item.intendedOutcome) + '</p></div>' : '';
  const outcomeAndTest = item.showCompletionTest && outcome ? '<div class="grid2">' + outcome + completion + '</div>' : outcome + completion;
  return '<div class="action execution-action"><div class="action-head"><span class="seq">' + ('0' + item.sequence).slice(-2) + '</span><h3>' + escapeHtml_(item.title) + '</h3></div><div class="grid2"><div class="card"><div class="label">What to change</div><p>' + escapeHtml_(item.exactChange) + '</p></div><div class="card"><div class="label">Where to change it</div><p>' + escapeHtml_(item.implementationLocation) + '</p></div></div><div class="card"><h3>Who will do it</h3><p>' + escapeHtml_(item.ownership) + '</p>' + implementationPath + '</div>' + outcomeAndTest + dependencies + limitations + '</div>';
}

function buildGoldStandardImprovementPlanHtml_(input, suppliedContent) {
  const content = suppliedContent || buildGoldStandardImprovementPlanContent_(input);
  const pages = [goldStandardCover_(input, 'Improvement Plan', 'Steps to Make the Change')];
  content.actions.forEach(function(action, index) {
    const isFirst = index === 0;
    const isLast = index === content.actions.length - 1;
    const opening = isFirst ? '<p class="section-intro">' + escapeHtml_(content.subtitle) + '</p><h2>Goal</h2><p class="section-intro">' + escapeHtml_(content.objective) + '</p><h2 class="assessment-section">Steps to Fix It</h2>' : '<h2>More Steps to Fix It</h2>';
    const close = isLast ? (content.planLimitations.length ? '<div class="assessment-note"><b>What else we did not test</b>' + goldStandardList_(content.planLimitations) + '</div>' : '') + (content.sequence.length ? '<div class="card"><h3>Steps</h3>' + goldStandardList_(content.sequence) + '</div>' : '') + '<div class="decision"><h3>Next step</h3><p>' + escapeHtml_(content.nextStep) + '</p></div>' : '';
    pages.push('<section class="page content-page improvement-page">' + goldStandardHeader_('Improvement Plan', ('0' + (index + 2)).slice(-2)) + opening + goldStandardImprovementAction_(action) + close + goldStandardFooter_('Improvement Plan') + '</section>');
  });
  return goldStandardDocument_(pages);
}
