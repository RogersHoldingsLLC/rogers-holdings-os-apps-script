# Project Memory

This document preserves the current operating knowledge for future Business Optimization Platform development. Legacy technical names remain where changing them would affect established behavior.

## Current Status

The Business Optimization Platform is at Version `1.0.0-rc` (build `2026.07.20-rc`). It is a release candidate, not production-ready or released. The target `1.0.0` release remains pending final live acceptance, final release sign-off, and production approval.

Feature development is frozen for V1.0. Current work should focus on release acceptance, bug fixes, documentation, and production readiness.

## Architecture

The system runs in Google Apps Script attached to a Google Sheet.

Primary services:

- Google Sheets
- Google Apps Script
- Gmail
- Google Calendar
- Google Drive
- GitHub/local filesystem
- Website Audit Tool API (optional acquisition dependency; required only for fresh real-audit retrieval)

## Audit Acquisition and Rendering

V1 separates audit acquisition from deliverable rendering. `runRealWebsiteAudit` requires an approved Website Audit Tool endpoint. `generateAuditPackage` and `runFullProspectPackage` use the same fail-closed local-rendering gate: `Audit Source` must equal `Website Audit Tool` exactly; Audit Score must be numeric from 0 through 100; Audit Outcome must equal `Strong Fit`, `Good Fit`, `Needs Nurture`, or `Poor Fit`; Priority Tier must equal `A - Hot`, `B - Good`, or `C - Later`; and Summary or Notes must supply PDF narrative. Blank, Quick Internal Audit, `D - Nurture`, `Authoritative Import`, arbitrary text, the general Source column, and inferred provenance do not qualify. Stored screenshot and evidence fields flow into the existing PDF renderer. The internal Inspection Engine remains developer-only and is not the production audit acquisition path.

Master Prospect Tracker startup repair ensures the required `Audit Source` header exists without moving an existing column or changing its cells. A missing header is placed immediately after `Priority Tier`, or appended if `Priority Tier` is itself missing so Health Check can report that separate defect. The column receives its own dropdown containing only `Website Audit Tool` and `Quick Internal Audit`; inherited or incorrect validation is replaced without changing existing cell contents. Legacy audit provenance is never inferred: existing values are preserved exactly, blank legacy values remain blank, and invalid legacy values remain visible but blocked from client-facing rendering.

`Generate Digital Business Assessment` creates `AuditReport.pdf`, `Proposal.pdf`, and `Outreach Email Draft.txt` in Drive. Audit-report regeneration treats canonical `AuditReport.pdf` and legacy `Audit Report.pdf` as one logical artifact within the resolved package folder, trashes every active copy of both names, creates one fresh canonical file, and reports canonical removals, legacy removals, and the created filename. Proposal regeneration still replaces exact-name predecessors, while the outreach text draft still updates in place and removes exact-name duplicates. It logs `Outreach Draft File Created` and does not create a Gmail draft. `Create Outreach Gmail Draft`, `Run Full Prospect Package`, and `Send Digital Business Assessment` retain their real Gmail-draft behavior and use Gmail-specific success wording only after Gmail creation or update succeeds.

All Gmail-producing workflows use one exact-match reconciliation rule within the current authenticated Gmail account: recipient email is trimmed and case-normalized, subject is trimmed and then matched exactly, one matching draft is refreshed, no match creates exactly one draft, and multiple matches fail safely without creating or updating another draft. Assessment attachment failures reconcile again before using the folder-link fallback so an ambiguously persisted attachment draft and a fallback draft cannot both be created. Activity Feed events distinguish Gmail drafts created from Gmail drafts updated and are written only after verified Gmail success.

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

## Known Validation Baseline

Recent local checks pass:

- `npm run status:acceptance`
- `npm run status:production`
- `npm run validate`
- duplicate function verification
- menu target verification

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

## Critical Guardrails

- Do not run destructive sheet migrations without explicit request.
- Do not delete user data.
- Do not rewrite stable workflows.
- Do not deploy unless validation passes.
- Do not rely on root `.js` files.
- Do not mark a feature complete until local validation and required live Google Sheets tests pass.

## Brand Standards

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
