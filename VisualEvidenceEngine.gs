/**
 * Business Optimization Platform - Visual Evidence Engine.
 * Phase 1 creates the shared image-evidence model used by future screenshot and annotation modules.
 */

function createVisualEvidence_(input) {
  const now = new Date();
  const data = input || {};
  return normalizeVisualEvidence_({
    evidenceId: data.evidenceId || generateVisualEvidenceId_(),
    findingId: data.findingId || '',
    evidenceType: data.evidenceType || 'website-screenshot',
    imageUrl: data.imageUrl || data.screenshotUrl || data.imageDataUri || data.screenshotDataUri || '',
    imageBlobId: data.imageBlobId || '',
    sourceUrl: data.sourceUrl || '',
    title: data.title || 'Visual Evidence',
    caption: data.caption || '',
    issueLabel: data.issueLabel || '',
    annotationType: data.annotationType || '',
    highlightBox: data.highlightBox || null,
    arrow: data.arrow || null,
    calloutText: data.calloutText || '',
    severity: data.severity || '',
    confidence: data.confidence || '',
    createdAt: data.createdAt || now,
    metadata: data.metadata || {}
  });
}

function normalizeVisualEvidence_(input) {
  const data = typeof input === 'string' ? parseVisualEvidenceJson_(input) : (input || {});
  const evidence = {
    evidenceId: String(data.evidenceId || generateVisualEvidenceId_()).trim(),
    findingId: String(data.findingId || '').trim(),
    evidenceType: String(data.evidenceType || 'website-screenshot').trim(),
    imageUrl: String(data.imageUrl || data.imageDataUri || data.screenshotUrl || data.screenshotDataUri || '').trim(),
    imageBlobId: String(data.imageBlobId || '').trim(),
    sourceUrl: String(data.sourceUrl || '').trim(),
    title: String(data.title || 'Visual Evidence').trim(),
    caption: String(data.caption || '').trim(),
    issueLabel: String(data.issueLabel || '').trim(),
    annotationType: String(data.annotationType || '').trim(),
    highlightBox: normalizeVisualEvidenceBox_(data.highlightBox),
    arrow: normalizeVisualEvidenceArrow_(data.arrow),
    calloutText: String(data.calloutText || '').trim(),
    severity: String(data.severity || '').trim(),
    confidence: normalizeVisualEvidenceConfidence_(data.confidence),
    createdAt: data.createdAt || new Date(),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {}
  };

  if (!evidence.caption) {
    evidence.caption = evidence.issueLabel || evidence.sourceUrl || evidence.evidenceType;
  }

  return evidence;
}

function renderVisualEvidenceHtml_(visualEvidence, options) {
  const evidence = normalizeVisualEvidence_(visualEvidence);
  const config = options || {};
  const imageUrl = getVisualEvidenceImageUrl_(evidence);

  if (!imageUrl) {
    return config.allowPlaceholder ? renderEvidencePlaceholderHtml_(evidence) : '';
  }

  return [
    '<div class="visual-evidence-card">',
    '<div class="visual-evidence-head">',
    `<span>${escapeHtml_(evidence.title || 'Visual Evidence')}</span>`,
    evidence.severity ? `<span class="visual-evidence-severity">${escapeHtml_(evidence.severity)}</span>` : '',
    '</div>',
    '<div class="visual-evidence-frame">',
    `<img class="visual-evidence-image" src="${escapeHtml_(imageUrl)}" alt="${escapeHtml_(evidence.title || 'Visual evidence')}">`,
    renderVisualEvidenceAnnotationHtml_(evidence),
    '</div>',
    renderEvidenceCaptionHtml_(evidence),
    '</div>'
  ].join('');
}

function renderEvidenceCaptionHtml_(visualEvidence) {
  const evidence = normalizeVisualEvidence_(visualEvidence);
  const captionParts = [
    evidence.issueLabel,
    evidence.caption,
    evidence.calloutText
  ].filter(function(value, index, values) {
    const text = String(value || '').trim();
    return text && values.indexOf(value) === index;
  });

  if (!captionParts.length) {
    return '';
  }

  return `<div class="visual-evidence-caption">${escapeHtml_(captionParts.join(' '))}</div>`;
}

function renderEvidencePlaceholderHtml_(visualEvidence) {
  const evidence = normalizeVisualEvidence_(visualEvidence || {});
  return [
    '<div class="visual-evidence-placeholder">',
    `<strong>${escapeHtml_(evidence.title || 'Visual evidence unavailable')}</strong>`,
    '<p>No visual evidence image is available for this item yet.</p>',
    '</div>'
  ].join('');
}

function getBestVisualEvidenceForFinding_(finding, evidenceSource) {
  const findingId = String(finding && (finding.findingId || finding.id || finding.ID) || '').trim();
  const category = String(finding && finding.category || '').toLowerCase();
  const candidates = collectVisualEvidence_(evidenceSource).filter(function(evidence) {
    if (!getVisualEvidenceImageUrl_(evidence)) {
      return false;
    }
    if (findingId && String(evidence.findingId || '').trim() === findingId) {
      return true;
    }
    const metadataCategory = String(evidence.metadata && evidence.metadata.category || '').toLowerCase();
    const issue = String(evidence.issueLabel || evidence.title || evidence.caption || '').toLowerCase();
    return category && (metadataCategory === category || issue.indexOf(category) !== -1);
  });

  return candidates.length ? candidates[0] : null;
}

function getFeaturedVisualEvidence_(evidenceSource) {
  const candidates = collectVisualEvidence_(evidenceSource).filter(function(evidence) {
    return !!getVisualEvidenceImageUrl_(evidence);
  });
  if (!candidates.length) {
    return null;
  }

  const featured = candidates.filter(function(evidence) {
    return evidence.metadata && evidence.metadata.featured;
  })[0];
  return featured || candidates[0];
}

function collectVisualEvidence_(evidenceSource) {
  const sources = Array.isArray(evidenceSource) ? evidenceSource : [evidenceSource || {}];
  const items = [];

  sources.forEach(function(source) {
    const data = typeof source === 'string' ? parseVisualEvidenceJson_(source) : source;
    if (!data) {
      return;
    }
    if (Array.isArray(data)) {
      data.forEach(function(item) {
        items.push(normalizeVisualEvidence_(item));
      });
      return;
    }
    if (Array.isArray(data.visualEvidence)) {
      data.visualEvidence.forEach(function(item) {
        items.push(normalizeVisualEvidence_(item));
      });
    }
    if (data.evidence && Array.isArray(data.evidence.visualEvidence)) {
      data.evidence.visualEvidence.forEach(function(item) {
        items.push(normalizeVisualEvidence_(item));
      });
    }
    if (data.website && (data.website.screenshotDataUri || data.website.screenshotUrl)) {
      items.push(createVisualEvidence_({
        evidenceType: 'desktop-screenshot',
        imageUrl: data.website.screenshotDataUri || data.website.screenshotUrl,
        sourceUrl: data.website.sourceUrl || data.sourceUrl || '',
        title: 'Current Digital Presence',
        caption: data.website.evidenceText || 'Website screenshot evidence.',
        metadata: { featured: true, category: 'Homepage' }
      }));
    }
    if (data.mobile && (data.mobile.screenshotDataUri || data.mobile.screenshotUrl)) {
      items.push(createVisualEvidence_({
        evidenceType: 'mobile-screenshot',
        imageUrl: data.mobile.screenshotDataUri || data.mobile.screenshotUrl,
        sourceUrl: data.mobile.sourceUrl || data.sourceUrl || '',
        title: 'Mobile Digital Presence',
        caption: data.mobile.notes || 'Mobile screenshot evidence.',
        metadata: { category: 'Mobile Usability' }
      }));
    }
  });

  return items;
}

function getVisualEvidenceImageUrl_(evidence) {
  return String(evidence && evidence.imageUrl || '').trim();
}

function renderVisualEvidenceAnnotationHtml_(evidence) {
  const box = evidence && evidence.highlightBox;
  const arrow = evidence && evidence.arrow;
  const parts = [];

  if (box) {
    parts.push(
      '<div class="visual-evidence-highlight" style="' +
      'left:' + numberToPercent_(box.x) + ';' +
      'top:' + numberToPercent_(box.y) + ';' +
      'width:' + numberToPercent_(box.width) + ';' +
      'height:' + numberToPercent_(box.height) + ';' +
      '"></div>'
    );
  }

  if (arrow) {
    parts.push(
      '<div class="visual-evidence-arrow" style="' +
      'left:' + numberToPercent_(arrow.x) + ';' +
      'top:' + numberToPercent_(arrow.y) + ';' +
      'width:' + numberToPercent_(arrow.length || 16) + ';' +
      'transform:rotate(' + Number(arrow.angle || 0) + 'deg);' +
      '"></div>'
    );
  }

  if (evidence && evidence.calloutText) {
    parts.push(`<div class="visual-evidence-callout">${escapeHtml_(evidence.calloutText)}</div>`);
  }

  return parts.join('');
}

function normalizeVisualEvidenceBox_(box) {
  if (!box || typeof box !== 'object') {
    return null;
  }
  return {
    x: clampVisualEvidenceNumber_(box.x, 0, 100),
    y: clampVisualEvidenceNumber_(box.y, 0, 100),
    width: clampVisualEvidenceNumber_(box.width, 1, 100),
    height: clampVisualEvidenceNumber_(box.height, 1, 100)
  };
}

function normalizeVisualEvidenceArrow_(arrow) {
  if (!arrow || typeof arrow !== 'object') {
    return null;
  }
  return {
    x: clampVisualEvidenceNumber_(arrow.x, 0, 100),
    y: clampVisualEvidenceNumber_(arrow.y, 0, 100),
    length: clampVisualEvidenceNumber_(arrow.length || 16, 1, 100),
    angle: Number(arrow.angle || 0)
  };
}

function normalizeVisualEvidenceConfidence_(confidence) {
  if (confidence === '' || confidence === null || confidence === undefined) {
    return '';
  }
  const numeric = Number(confidence);
  if (isNaN(numeric)) {
    return String(confidence || '').trim();
  }
  return Math.max(0, Math.min(1, numeric));
}

function clampVisualEvidenceNumber_(value, min, max) {
  const numeric = Number(value);
  if (isNaN(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, numeric));
}

function numberToPercent_(value) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, '') + '%';
}

function parseVisualEvidenceJson_(value) {
  if (!value) {
    return {};
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}

function generateVisualEvidenceId_() {
  return 'VE-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 100000);
}
