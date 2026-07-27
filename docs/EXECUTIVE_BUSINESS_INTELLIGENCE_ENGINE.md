# Executive Business Intelligence Engine

Release state: EBI v1 is production-released.

## Purpose

The Executive Business Intelligence (EBI) Engine turns verified business and website evidence into a deterministic, business-specific consultation layer. It is designed to make each Business Snapshot, Executive Brief, and Digital Business Assessment reflect the business being reviewed rather than a universal checklist. Improvement Plan personalization remains deferred for the lifecycle reason documented below.

The engine does not change audit acquisition, scoring, spreadsheet headers, public workflow functions, lifecycle semantics, or deployment targets. It does not call an AI service.

## Architecture

```text
prospect + reportFile + inspection result
  -> business discovery
  -> evidence normalization
  -> executive analysis
  -> opportunity prioritization
  -> rules-based consultant review
  -> personalized narrative
  -> existing PDF and preview renderers
```

`ExecutiveBusinessIntelligenceEngine.gs` is the authoritative module. `getExecutiveBusinessIntelligenceForReport_(prospect, reportFile)` is the backward-compatible adapter used by `PdfEngine.gs` and `DeliverablePreviewEngine.gs`.

When evidence is insufficient, the EBI result returns `Insufficient Evidence`, creates no opportunities, and provides a discovery-oriented narrative. Existing rendering remains available through its established gates; EBI never invents missing findings.

## Schemas

### Business profile

The profile contains company name, website, industry, business model, customer type, geographic market, primary and secondary services, target customer, likely customer needs, buying context, conversion goal, differentiators, trust signals, brand position, strengths, uncertainties, and evidence references.

Unknown fields are represented as `Unknown`, an empty list, or `Requires consultant review`. Inference is limited to deterministic industry rules supported by evidence text.

### Evidence

Every normalized item contains:

- `id`, `source`, `pageUrl`, `pageType`, and `category`
- `observation` and `rawValue`
- `claimType: Observed Fact`, separating captured evidence from later interpretation
- normalized `confidence` from 0 through 1
- `observedAt`
- `supportsStrength`, `supportsOpportunity`, and `requiresReview`

Inputs may come from explicit EBI evidence, `InspectionResult.evidence`, finding evidence, Website Audit Tool report evidence/findings, and existing prospect fields. Duplicate observations from the same source/page/category are collapsed.

### Executive analysis

Analysis contains a business and customer description, strengths, friction points, missed opportunities, credibility signals, messaging gaps, conversion gaps, customer-journey observations, strategic themes, and consultant-review items.

### Opportunities

Every retained opportunity contains a personalized observation, business reason, one or more valid evidence IDs, an allowed impact area, qualitative impact and effort, priority, confidence, a specific action, timing context, a consultant note, and a review flag.

Opportunity observations are labeled `Observed Fact`; business reasons are labeled `Reasonable Interpretation`; uncertain items are separately listed for consultant review.

Allowed impact areas are Revenue, Trust, Conversion, Customer Experience, Visibility, Operations, Brand, and Risk. The engine does not make exact financial projections.

## Evidence and Confidence Rules

- Client-facing assessment signals use `PASS`, `FAIL`, `UNKNOWN`, or `NOT_APPLICABLE`; missing information never defaults to PASS.
- Incomplete/failed inspector execution or an unsupported zero score produces insufficient score confidence, suppressing definitive scores and severity claims in assessment and outreach output.
- Internal workflow markers are rejected before field discovery and cannot supply services, audiences, geography, strengths, opportunities, or narrative.
- Evidence marked for review or below 0.65 confidence may be retained for internal traceability but cannot create a client-facing opportunity.
- Recommendations without a valid normalized evidence ID are rejected.
- Missing, unclear, weak, broken, or inconsistent observations may support an opportunity; positive observations do not become criticism.
- Confidence may be supplied as 0–1 or 0–100 and is normalized to 0–1.
- Evidence below 0.65 or explicitly marked `requiresReview` is surfaced for consultant review.
- At least three reliable evidence items, including one observed report item, plus company identity and industry are required for a grounded draft. Prospect metadata alone never enables personalized client narrative.
- Strengths appear only when supported by positive evidence or verified profile fields.

## Personalization Rules

Narratives combine verified service, market, target-customer, buying-context, strength, and opportunity facts. Wording selection is deterministic; no random variants are used.

The editorial layer:

- favors the simplest effective change and improvement before replacement
- limits priorities to four
- removes duplicate opportunities
- rejects unsupported and generic recommendations
- connects each recommendation to the business’s buying context
- uses plain-English qualitative impact rather than unsupported ROI claims

The prohibited generic recommendation detector covers exact filler such as “improve your website,” “improve SEO,” and “optimize digital presence.” Tests also reject generic narrative phrases.

## Consultant Review

Supported statuses are:

- `Draft`
- `Needs Consultant Review`
- `Approved for Client`
- `Insufficient Evidence`

Generated grounded results default to `Needs Consultant Review`. Insufficient results default to `Insufficient Evidence`. `clientDeliveryAllowed` remains `false`; this implementation intentionally creates no approval action and does not infer approval from CRM state. Review state remains available only in the structured result and developer diagnostics. Client PDFs and previews never render the status, delivery flags, evidence identifiers, confidence values, review flags, or engine terminology.

When the result is `Insufficient Evidence`, client renderers ignore its narrative and recommendations and preserve their established legacy output without displaying a warning or creating personalized claims.

## Improvement Plan Limitation

The standalone Improvement Plan workflow rebuilds its content from the selected prospect row. It does not retain a durable reference to the assessment report object or a persisted consultant-approval record. Reusing personalized assessment intelligence there would therefore be inconsistent and could produce prospect-only claims. V1 keeps the established Improvement Plan content unchanged. Safe personalization requires an approved future lifecycle design that makes the reviewed assessment evidence available without changing the current spreadsheet, API, or deployment contracts.

## Failure Behavior

Missing evidence produces no invented strengths, opportunities, competitor claims, or financial returns. Low-confidence statements are flagged. If EBI cannot support personalized content, existing legacy report helpers remain the compatible rendering fallback.

## Integration Points

- `PdfEngine.gs`: assessment and Executive Snapshot rendering through established report sections; Improvement Plan retains legacy content
- `DeliverablePreviewEngine.gs`: Executive Snapshot and assessment previews; Improvement Plan retains legacy content
- `InspectionEngine.gs` and `InspectionIntelligenceEngine.gs`: existing structured findings and evidence
- `AuditEngine.gs`: unchanged Website Audit Tool contract and local-rendering eligibility gate

No spreadsheet schema, API field, Script Property, resource identifier, URL, public function, or lifecycle transition was added or changed.

## Test Fixtures

`scripts/fixtures/executive-business-intelligence-fixtures.js` contains deterministic fixtures for emergency plumbing, family roofing, B2B logistics/industrial services, a church/nonprofit, and insufficient evidence.

Run:

```bash
npm run test:ebi
npm run acceptance:ebi
```

The suite verifies distinct profiles and narratives, evidence-linked recommendations, supported strengths, safe insufficient-evidence and metadata-only behavior, adjacent-section deduplication, internal-term exclusion, focused priorities, generic-filler rejection, consultant-review status, and cross-fixture narrative/recommendation divergence. `npm run acceptance:ebi` also regenerates `test-output/EXECUTIVE_BUSINESS_INTELLIGENCE_ACCEPTANCE_COMPARISON.md` with inspectable synthetic client-content projections and internal evidence traceability. These fixtures prepare repeatable review but do not replace live acceptance. The existing `test:audit-rendering` suite remains the legacy workflow regression gate.

## Future AI Adapter Boundary

An approved future adapter may accept the completed EBI result and propose editorial refinements. It must not add facts, change evidence references, self-approve a report, or bypass deterministic review rules. No external provider, paid dependency, secret, or model configuration is included in v1.
