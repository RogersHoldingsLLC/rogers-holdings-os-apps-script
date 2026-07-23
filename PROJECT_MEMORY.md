# Project Memory

This document preserves the current operating knowledge for future Business Optimization Platform development.

## Current Status

The Business Optimization Platform is at Version `1.0.0-rc` (build `2026.07.20-rc`). It is a release candidate, not production-ready or released. The target `1.0.0` release remains pending final live acceptance, final release sign-off, and production approval.

Feature development is frozen for V1.0. Current work should focus on release acceptance, bug fixes, documentation, and production readiness.

## Architecture

The system runs in Google Apps Script attached to a Google Sheet.

Product hierarchy:

```text
Business Snapshot
-> creates a prospect or assessment input
-> Business Optimization Platform
-> manages consulting, proposals, projects, clients, and follow-up
```

Rogers Holdings LLC is the company. Headquarters is its separate internal command center. Business Optimization Platform is the client delivery platform. Website Audit Tool API is the shared audit-acquisition service used by Business Snapshot and Business Optimization Platform.

Primary services:

- Google Sheets
- Google Apps Script
- Gmail
- Google Calendar
- Google Drive
- GitHub/local filesystem
- Website Audit Tool API (optional acquisition dependency; required only for fresh real-audit retrieval)

## Audit Acquisition and Rendering

Client-facing PDF and preview rendering now has an in-memory Executive Business Intelligence layer at the existing `prospect + reportFile` boundary. `ExecutiveBusinessIntelligenceEngine.gs` normalizes available evidence, builds a business profile, performs contextual analysis, prioritizes no more than four evidence-linked opportunities, applies deterministic editorial rules, and generates business-specific narrative. Grounded output defaults to `Needs Consultant Review`; insufficient evidence creates no recommendations and returns `Insufficient Evidence`. The implementation adds no spreadsheet fields, approval action, external AI dependency, or audit/API contract change. See `docs/EXECUTIVE_BUSINESS_INTELLIGENCE_ENGINE.md`.

Executive Business Intelligence review state remains internal and is never rendered in client PDFs or previews. Insufficient-evidence results fall back to established client content without warnings or personalized claims. Assessment intelligence is integrated into existing briefing, strength, opportunity, journey, and recommendation paths rather than a duplicate consultation section. The standalone Improvement Plan remains on legacy content because its lifecycle does not persist or reload the reviewed assessment evidence; changing that requires a separately approved lifecycle design.

Local EBI acceptance uses `npm run acceptance:ebi` to test four grounded industry fixtures plus insufficient-evidence and metadata-only guards, then regenerate `test-output/EXECUTIVE_BUSINESS_INTELLIGENCE_ACCEPTANCE_COMPARISON.md`. The artifact separates client-visible projections from internal evidence traceability and is synthetic preparation only; verified live workbook acceptance remains required.

The live-acceptance hardening adds a normalized assessment evidence contract with explicit `PASS`, `FAIL`, `UNKNOWN`, and `NOT_APPLICABLE` vocabulary plus inspection confidence. Incomplete inspector execution and unsupported zero scores suppress client-facing scores and severity claims in reports, previews, and outreach. Checklist states default to `Not Verified`, never PASS. Internal review markers are rejected as semantic business evidence, and low-confidence or review-required observations cannot generate client recommendations. Professional-services classification covers business consulting and digital optimization without applying local-service recommendations unless supported. The Improvement Plan remains on its approved legacy path.

All visible score summaries in the Digital Business Assessment, Executive Snapshot PDF and preview, and Improvement Plan now use `getReportScoreContext_()`. The helper returns the display score, verification state, severity label, safe fallback language, and confidence/completeness state. Incomplete inspection data and unsupported zero scores render `Not verified` with no critical-severity claim. The Improvement Plan still does not consume EBI evidence; a narrow deterministic audience-context helper selects local-service, professional/B2B, nonprofit, or neutral legacy wording so unsupported local-commercial language does not leak into other business types.

The normalized evidence contract now evaluates each item independently. Every item carries `PASS`, `FAIL`, `UNKNOWN`, or `NOT_APPLICABLE`, normalized confidence, source, explanation, observation state, and separate eligibility for client findings, recommendations, and outreach. Aggregate notes and incomplete report text cannot convert unknown items into verified failures. Client-safe report projections retain only eligible evidence; an incomplete report may still retain an explicitly observed, sufficiently confident item while omitting unknown siblings. When no verified finding exists, reports and plans show a preliminary discovery-confirmation state instead of synthetic findings.

`getBusinessClassificationContext_()` is the shared downstream language authority for professional/B2B, local-service, nonprofit, and neutral records. It controls audience perspective, priorities, first steps, roadmap framing, service-package language, Improvement Plan wording, and outreach. PDF roadmap pagination uses an explicit kept section with a forced clean-page start so the heading and first roadmap card cannot separate in Google HTML-to-PDF conversion.

Final artifact acceptance was performed in the bound disposable workbook `DISPOSABLE V1.0 ACCEPTANCE - 2026-07-10`. The Executive Snapshot, Digital Business Assessment, Improvement Plan, and Outreach Email were regenerated and visually reviewed in Chrome. Live defects found during that cycle were limited to structured screenshot-evidence normalization, unverified legacy summary/metric leakage, unsupported generic findings, a duplicated final-page heading, and page-top Timeline clearance. The corrected Improvement Plan remains five pages; its Timeline heading is visible and attached to the first item. The artifact set contains no score/confidence leakage, presents incomplete evidence as discovery work rather than verified fact, and consistently uses professional/B2B audience language. Changes were deployed only to the disposable acceptance Apps Script project; production was not modified.

V1 separates audit acquisition from deliverable rendering. `runRealWebsiteAudit` requires an approved Website Audit Tool endpoint. `generateAuditPackage` and `runFullProspectPackage` use the same fail-closed local-rendering gate: `Audit Source` must equal `Website Audit Tool` exactly; Audit Score must be numeric from 0 through 100; Audit Outcome must equal `Strong Fit`, `Good Fit`, `Needs Nurture`, or `Poor Fit`; Priority Tier must equal `A - Hot`, `B - Good`, or `C - Later`; and Summary or Notes must supply PDF narrative. Blank, Quick Internal Audit, `D - Nurture`, `Authoritative Import`, arbitrary text, the general Source column, and inferred provenance do not qualify. Stored screenshot and evidence fields flow into the existing PDF renderer. The internal Inspection Engine remains developer-only and is not the production audit acquisition path.

Master Prospect Tracker startup repair ensures the required `Audit Source` header exists without moving an existing column or changing its cells. A missing header is placed immediately after `Priority Tier`, or appended if `Priority Tier` is itself missing so Health Check can report that separate defect. The column receives its own dropdown containing only `Website Audit Tool` and `Quick Internal Audit`; inherited or incorrect validation is replaced without changing existing cell contents. Legacy audit provenance is never inferred: existing values are preserved exactly, blank legacy values remain blank, and invalid legacy values remain visible but blocked from client-facing rendering.

`Generate Digital Business Assessment` creates `AuditReport.pdf`, `Proposal.pdf`, and `Outreach Email Draft.txt` in Drive. Audit-report regeneration treats canonical `AuditReport.pdf` and legacy `Audit Report.pdf` as one logical artifact within the resolved package folder, trashes every active copy of both names, creates one fresh canonical file, and reports canonical removals, legacy removals, and the created filename. Proposal regeneration still replaces exact-name predecessors, while the outreach text draft still updates in place and removes exact-name duplicates. It logs `Outreach Draft File Created` and does not create a Gmail draft. `Create Outreach Gmail Draft`, `Run Full Prospect Package`, and `Send Digital Business Assessment` retain their real Gmail-draft behavior and use Gmail-specific success wording only after Gmail creation or update succeeds.

All Gmail-producing workflows use one exact-match reconciliation rule within the current authenticated Gmail account: recipient email is trimmed and case-normalized, subject is trimmed and then matched exactly, one matching draft is refreshed, no match creates exactly one draft, and multiple matches fail safely without creating or updating another draft. Assessment attachment failures reconcile again before using the folder-link fallback so an ambiguously persisted attachment draft and a fallback draft cannot both be created. Activity Feed events distinguish Gmail drafts created from Gmail drafts updated and are written only after verified Gmail success.

Production diagnostics must remain privacy-safe: log workflow state, counts, durations, and outcomes, but do not log prospect contact data, full Website Audit Tool response bodies, Drive URLs, or file identifiers by default.

## Authoritative Source

Root `.gs` files are authoritative:

- `AuditEngine.gs`
- `BusinessInterpretationEngine.gs`
- `CalendarEngine.gs`
- `Code.gs`
- `Config.gs`
- `ContactInformationInspector.gs`
- `DeliverablePreviewEngine.gs`
- `DemoData.gs`
- `DigitalPresenceAssessmentEngine.gs`
- `ExecutiveBusinessIntelligenceEngine.gs`
- `DriveEngine.gs`
- `GmailEngine.gs`
- `HealthCheck.gs`
- `HomepageInspector.gs`
- `InspectionEngine.gs`
- `InspectionIntelligenceEngine.gs`
- `InspectionOrchestrator.gs`
- `InspectionPlayground.gs`
- `InspectionRulesRegistry.gs`
- `Menu.gs`
- `PdfEngine.gs`
- `SheetHelpers.gs`
- `VisualEvidenceEngine.gs`
- `WebsiteFetchEngine.gs`

Root `.js` files are non-authoritative duplicates and must not be edited as source.

## Key Design Decisions

- Use Google Sheets as the operating database.
- Use Apps Script menus for user workflows.
- Use named headers instead of fixed column indexes wherever possible.
- Preserve workbook structure unless explicitly requested.
- Prefer helper reuse over duplicate workflow logic.
- Treat Activity Feed as the system log.
- Resolve the Activity Feed through the shared strict header resolver. Its valid header remains on row 4; all readers, writers, lifecycle logging, and Health Check use that same row, and duplicate valid header rows fail safely rather than creating or shifting data.
- Treat Health Check as the operational readiness gate.
- Treat Executive Dashboard as the command center.

## Core Lifecycle

```text
Lead Found
Executive Snapshot Sent
Discovery Meeting Scheduled
Digital Business Assessment Presented
Improvement Plan Sent
Project Started
Client
Lost
```

Business lifecycle:

```text
Lead Found -> Executive Snapshot Sent -> Discovery Meeting Scheduled -> Digital Business Assessment Presented -> Improvement Plan Sent -> Project Started -> Client
```

CRM Status is a confirmed-event field. Generating or previewing artifacts, completing an audit, creating files, and creating Gmail drafts do not advance it. Operators use explicit confirmation actions for sent/presented/accepted/onboarded outcomes; successful Calendar event creation may confirm Discovery Meeting Scheduled. Invalid stage jumps are blocked, and repeated confirmations are idempotent.

Lifecycle writes use document locking, durable operation markers, and retry reconciliation. The final prospect-row commit includes Status, Next Action, Last Activity, confirmation time, and operation evidence. Calendar retries reconcile a stored operation key/event ID before any insertion. Client/project retries upsert prerequisites and repair incomplete follow-up, Activity Feed, Closed Date, and workspace effects. Nurture can re-enter only through the explicit reactivation action at Lead Found; Project Started can move only to Client.

Manual Status edits fail closed when prior confirmed state cannot be proven: the handler restores a verified snapshot or clears only the Status cell and marks reconciliation. Calendar event reuse requires the same prospect-bound operation key and exact start/end time. Client and Project prerequisite records are re-read and identity/status/linkage verified before CRM Status advances. These controls still require live Apps Script and disposable-workbook acceptance testing before production deployment.

## Important Public Entry Points

Menu and user-facing workflows include:

- `runNextAction`
- `runFullProspectPackage`
- `runRealWebsiteAudit`
- `generateAuditPackage`
- `createOutreachGmailDraft`
- `sendAuditPackage`
- `generateProposal`
- `createDiscoveryCall`
- `openProspectWorkspace`
- `openClientWorkspace`
- `refreshClientWorkspace`
- `createFollowUp`
- `completeFollowUp`
- `refreshFollowUps`
- `convertToClient`
- `convertWonProspectToClient`
- `createProject`
- `updateProjectStatus`
- `completeProject`
- `refreshProjects`
- `refreshExecutiveDashboard`
- `runSystemHealthCheck`
- `resetDemoData`

Do not rename these without updating `Menu.gs` and validating menu targets.

Destructive reset controls are restricted to Developer Mode. Menu construction uses `isDeveloperModeEnabledReadOnly_()`, which reads only an existing Settings sheet and returns false when the spreadsheet or sheet is unavailable. `resetTestData()` and `resetDemoData()` repeat that read-only check at runtime and return before confirmation or destructive work when Developer Mode is disabled, protecting direct Apps Script editor execution. The unused anonymous `webapp` manifest declaration was removed because the authoritative source has no `doGet` or `doPost` handler. `npm run validate` contains deterministic regression checks for these controls.

## Known Validation Baseline

Recent local checks pass:

- `npm run status:acceptance`
- `npm run status:production`
- `npm run validate`
- duplicate function verification
- menu target verification
- reset/menu/manifest security hardening checks

Deployment has no default target. The disposable acceptance project and production project must be selected explicitly:

```bash
npm run deploy:acceptance
npm run deploy:production
```

Acceptance uses `.clasp.json` and requires `DEPLOY ACCEPTANCE`. Production uses `.clasp.production.json`, requires exact typed `DEPLOY PRODUCTION`, all release checks, a clean tree, and `main` (or an exact branch explicitly approved with `APPROVED_RELEASE_BRANCH`). Production temporarily swaps the clasp configuration only around the push and restores `.clasp.json` after success or failure. Neither workflow uses `--force`.

## Known Technical Debt

- `SheetHelpers.gs` is large and may eventually need another careful split.
- `refreshSalesOperatingSystem_()` performs several expensive operations and may need a lighter startup path.
- Root `.js` duplicate files are ignored by deployment but create validation noise.
- PDF generation should eventually have visual regression fixtures.
- Live Apps Script workflows still require manual smoke testing after deployment.
- The security hardening patch still requires live disposable-workbook acceptance; it does not make the release production-ready by itself.

## Critical Guardrails

- Do not run destructive sheet migrations without explicit request.
- Do not delete user data.
- Do not rewrite stable workflows.
- Do not deploy unless validation passes.
- Do not rely on root `.js` files.
- Do not mark a feature complete until local validation and required live Google Sheets tests pass.

## Brand Standards

The customer-facing signature is:

```text
Business Optimization Platform
by Rogers Holdings LLC
```

Business Optimization Platform should feel:

- Professional
- Executive
- Minimal
- Black / white / gold
- Practical
- Small-business focused

Avoid customer-facing language that sounds internal, robotic, or prospecting-oriented.

V1 operator surfaces use consistent `Follow-Up` terminology, canonical workflow labels, concise recovery guidance, and business-friendly Health Check names. Technical exception detail remains available in logs and the underlying Health Check report rather than being exposed as raw operator copy.

Production UI polish also requires that developer-only audit controls remain behind developer mode, duplicate menu commands are not displayed, and preview dialogs do not present editing or saving controls unless those controls persist changes.

The Version 1.0 operator menu uses the Business Optimization Platform product name. The Product submenu includes a lightweight About dialog with release constants and optional deployment metadata supplied through Apps Script properties; no deployment metadata service or new infrastructure is required.
