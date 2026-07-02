# Rogers Holdings Visual Evidence Engine

## Purpose

The Visual Evidence Engine is the foundation for adding real visual proof to Rogers Holdings customer-facing deliverables.

Phase 1 does not capture screenshots, call external APIs, or create fake placeholder images. It defines a reusable evidence image object and safe PDF rendering hooks so future screenshot, OCR, and annotation modules can populate evidence without changing the report renderer.

## VisualEvidence Schema

```js
{
  evidenceId: 'VE-20260628120000-12345',
  findingId: 'finding-contact-visibility',
  evidenceType: 'desktop-screenshot',
  imageUrl: 'data:image/png;base64,...',
  imageBlobId: '',
  sourceUrl: 'https://example.com',
  title: 'Current Digital Presence',
  caption: 'Phone number not visible above the fold.',
  issueLabel: 'Contact visibility',
  annotationType: 'highlight',
  highlightBox: {
    x: 8,
    y: 12,
    width: 34,
    height: 10
  },
  arrow: {
    x: 44,
    y: 18,
    length: 16,
    angle: 0
  },
  calloutText: 'Primary contact path',
  severity: 'Medium',
  confidence: 0.86,
  createdAt: Date,
  metadata: {
    category: 'Contact Information',
    featured: true
  }
}
```

## Core Functions

- `createVisualEvidence_(input)`
- `normalizeVisualEvidence_(input)`
- `renderVisualEvidenceHtml_(visualEvidence, options)`
- `renderEvidenceCaptionHtml_(visualEvidence)`
- `renderEvidencePlaceholderHtml_(visualEvidence)`
- `getBestVisualEvidenceForFinding_(finding, evidenceSource)`
- `getFeaturedVisualEvidence_(evidenceSource)`

## PDF Rendering Behavior

Executive Snapshot:

- If real visual evidence exists, the snapshot renders one featured visual evidence block.
- If no visual evidence image exists, the snapshot keeps the current Key Observation block.
- No fake screenshots or placeholder screenshots are generated.

Digital Business Assessment:

- If a finding has matching visual evidence, the evidence block renders near that finding.
- If no visual evidence exists, the report keeps the existing text-based evidence.
- Existing proof-of-findings behavior remains intact.

## Evidence Sources

The engine can consume:

- `visualEvidence` arrays
- `evidence.visualEvidence` arrays
- Existing `website.screenshotDataUri` / `website.screenshotUrl`
- Existing `mobile.screenshotDataUri` / `mobile.screenshotUrl`

This lets current screenshot data render as visual evidence while keeping the engine ready for richer future evidence objects.

## Future Screenshot Capture

Future modules should populate `VisualEvidence` objects instead of changing PDF code.

Planned sources:

- Desktop website screenshot
- Mobile website screenshot
- Google Business Profile screenshot
- Search result screenshot
- PageSpeed/technical screenshot
- Competitor comparison screenshot

## Future Annotation Support

Future annotation modules should populate:

- `highlightBox`
- `arrow`
- `calloutText`
- `annotationType`
- `confidence`
- `metadata.category`

The PDF renderer already supports basic gold highlight boxes, arrows, and callout labels when those values exist.

## Guardrails

- Do not use fake screenshots.
- Do not show image placeholders in customer-facing PDFs.
- Do not call external screenshot APIs from Phase 1.
- Keep report generation functional when no visual evidence exists.
- Treat the PDF renderer as a presentation layer only.
