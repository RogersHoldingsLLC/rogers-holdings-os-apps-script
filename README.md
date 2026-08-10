# Business Optimization Platform

**Business Optimization Platform**<br>
**by Rogers Holdings LLC**

The Business Optimization Platform is the client delivery platform for the Rogers Holdings LLC consulting lifecycle. It runs on Google Sheets and Google Apps Script with Gmail, Google Calendar, Google Drive, and the shared Website Audit Tool API.

## Product Architecture

```text
Business Snapshot
-> acquires a prospect and creates the initial Executive Brief workflow input
-> Business Optimization Platform
-> delivers the Digital Business Assessment, Improvement Plan, projects, clients, and follow-up
```

Business Snapshot is the public acquisition product. The Website Audit Tool API is the internal technical evidence service used by Business Snapshot and Business Optimization Platform. Headquarters is the separate internal command center for Rogers Holdings LLC and is not part of this client delivery repository.

The accepted production acquisition topology is:

```text
Website
-> Cloudflare
-> Replacement Production Receiver Version 2
-> Authorized BOP Version 7
-> Rogers Holdings BOP — CRM & Delivery System
```

The receiver is pinned to the authorized BOP library version and the production library's `BOP_SPREADSHEET_ID` resolves only the authoritative workbook. Non-production copies must never reuse or replace that production mapping.

The system is designed to manage the complete small-business lifecycle:

```text
Lead Found -> Executive Brief Sent -> Discovery Meeting Scheduled -> Digital Business Assessment -> Improvement Plan Sent -> Project Started -> Client
```

## Version

Release candidate: `1.0.0-rc`

Build: `2026.08.10-rc`

Target release: `1.0.0` after final acceptance and production approval

Release state: release candidate; not production-ready or released

See:

- `VERSION.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PROJECT_MEMORY.md`
- `docs/BUSINESS_OPTIMIZATION_PLATFORM_V2_PRODUCT_SPEC.md`

## Release Candidate Baseline

The Version 1.0 release candidate includes:

- CRM: Master Prospect Tracker, Clients, Client Workspace, Projects, Follow-Ups, Activity Feed
- Sales workflow: Business Snapshot intake, Executive Brief, Digital Business Assessment, Improvement Plan, Gmail Draft Automation, Next Action Engine
- Client delivery: Client conversion, project creation, project status/progress tracking, deliverable tracking
- System: Executive Dashboard, Dashboard Metrics, Health Check, Reset Demo Data, Business Optimization Platform navigation menu
- Deliverables: `Executive Brief.pdf`, `Digital Business Assessment.pdf`, `Improvement Plan.pdf`, Discovery Call Brief PDF, outreach draft content
- Development: local `clasp` workflow, validation, backup, status checks, deployment script, duplicate function verification

## Core Google Sheets

Authoritative runtime sheets:

- `Master Prospect Tracker`
- `Clients`
- `Client Workspace`
- `Projects`
- `Follow-Ups`
- `Activity Feed`
- `Executive Dashboard`
- `Dashboard Metrics`
- `Settings`

The scripts create or verify required operational sheets when workflows run.

Prospect-to-Revenue Workflow v1 connects validation, verified website inspection, executive deliverable generation, exact-match Gmail draft reconciliation, Brian review, and recovery for one selected prospect. It never sends email or advances CRM Status during preparation. See `docs/PROSPECT_TO_REVENUE_WORKFLOW.md`.

EBI v1 is already production-released. Prospect-to-Revenue Workflow v1 has passed disposable-workbook acceptance, but its production deployment remains pending separate approval.

CRM lifecycle stages represent confirmed business events. Deliverable generation and Gmail draft creation do not advance CRM Status. Use the explicit Pipeline confirmation actions; Discovery Meeting Scheduled is the sole externally confirmed automatic transition and occurs only after Calendar event creation succeeds.

Lifecycle changes are serialized with a document lock and recorded with durable operation/reconciliation fields on the prospect row. Calendar scheduling stores an operation key and event ID so retries reconcile before inserting. Use **System -> Audit Legacy Lifecycle Values** for a read-only inventory of historical Status and Next Action values; the audit never migrates data.

## Menu Structure

The `Business Optimization Platform` menu is organized into:

- `Navigate`
- `Sales Workflow`
- `Pipeline`
- `Workspaces`
- `Follow-Ups`
- `Clients & Projects`
- `System`

The Product submenu includes an About dialog with the release version, build, deployment target, and Git commit metadata when configured.

Menu functions are defined in `Menu.gs` and call existing public workflow functions.

## Source Files

Root `.gs` files are the authoritative Apps Script source:

- `AuditEngine.gs`
- `BusinessSnapshotIntake.gs`
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
- `ProspectRevenueWorkflow.gs`
- `SheetHelpers.gs`
- `VisualEvidenceEngine.gs`
- `WebsiteFetchEngine.gs`

Root `.js` files with matching basenames are local-test mirrors only. Root `.gs` files remain authoritative, and `.js` mirrors are ignored by deployment.

## Local Development

### Install clasp

```bash
npm install -g @google/clasp
```

### Login

```bash
clasp login
```

### Check project status

```bash
npm run status:acceptance
npm run status:production
```

### Validate source

```bash
npm run validate
```

Validation checks:

- Required `.gs` files exist.
- Apps Script source parses as JavaScript.
- Duplicate function names are not present.
- Duplicate top-level globals are not present.
- `.clasp.json` deploys only authoritative `.gs` source.
- Non-authoritative root `.js` duplicates are reported and ignored.

### Create a local backup

```bash
npm run backup
```

Backups are written to:

```text
backups/business-optimization-platform-local-<timestamp>/
```

### Deploy

```bash
npm run deploy:acceptance
npm run deploy:production
```

`.clasp.json` always identifies the disposable acceptance project. `.clasp.production.json` identifies production. There is no default deployment target: running the deployment script without `acceptance` or `production` rejects the missing target.

Acceptance deployment displays the acceptance Script ID and requires the exact confirmation `DEPLOY ACCEPTANCE`, then validates, backs up, and pushes with `.clasp.json`.

Production deployment displays the production Script ID and requires the exact confirmation `DEPLOY PRODUCTION`. It then requires a clean working tree and the `main` branch, runs validation, lifecycle tests, audit-rendering tests, and `git diff --check`, and creates a backup. The production configuration is installed only for the duration of `clasp push`; the original `.clasp.json` is restored whether the push succeeds or fails. The workflow never adds `--force`.

To deploy from an intentional release branch, approve that exact current branch for one command:

```bash
APPROVED_RELEASE_BRANCH=release/v1.0 npm run deploy:production
```

Do not deploy unless validation passes.

## Production Safety Rules

- Do not rewrite stable functions.
- Do not duplicate workflow logic.
- Reuse existing helpers.
- Preserve menu items unless intentionally retired.
- Preserve sheet structures unless a migration is explicitly requested.
- Preserve the customer-facing standard: Business Optimization Platform by Rogers Holdings LLC.
- Run `npm run validate` before any deployment.
- Run `npm run backup` before significant changes.
- Do not edit root `.js` duplicates as source of truth.

## Required Script Properties

Common optional or recommended Apps Script properties:

- `BOP_SPREADSHEET_ID` — required by the Business Snapshot library intake path; identifies the intended BOP workbook and has no active-workbook fallback
- `WEBSITE_AUDIT_TOOL_URL` or `WEBSITE_AUDIT_TOOL_ENDPOINT` — required only to acquire fresh real-audit data from the approved Website Audit Tool API
- `BRAND_ASSET_FOLDER_ID` or `ROGERS_BRAND_ASSET_FOLDER_ID`

Audit acquisition and deliverable rendering are separate. Digital Business Assessment and Full Prospect Package rendering use the local PDF engine when the selected prospect already has Audit Score, Audit Outcome, Priority Tier, and a verified Audit Source. `Website Audit Tool API` is canonical; the historical `Website Audit Tool` value remains eligible for compatibility. Existing screenshot and evidence fields are reused; no evidence is invented. Quick Internal Audit data is not eligible for client-facing rendering. Health Check reports a missing Website Audit Tool API endpoint as a warning that blocks fresh audit acquisition, not as a platform-wide failure.

## Health Check

Run from:

```text
Business Optimization Platform -> System -> System Health Check
```

It verifies required sheets, headers, duplicate prospects, Gmail, Drive, PDF dependencies, configuration, Client Workspace, Follow-Ups, Projects, and Dashboard integration.

## Acceptance Status

Local release-candidate status as of 2026-07-20:

- `npm run status:acceptance`: available for the acceptance target
- `npm run status:production`: available for the production target
- `npm run validate`: passing
- `npm run test:lifecycle`: passing
- `npm run test:audit-rendering`: passing
- `npm run test:ebi`: deterministic business-profile, evidence, personalization, and review-gate coverage
- `npm run acceptance:ebi`: regenerates the synthetic EBI comparison artifact under `test-output/`; it does not replace live acceptance
- `npm test`: passing (deployment safety suite)
- duplicate function verification: passing
- menu target verification: passing
- deployment: not automatic; must be explicitly run

Prospect-to-Revenue Workflow v1 has passed disposable-workbook acceptance with recorded evidence. Final release sign-off and separate production approval are still required before production deployment or creation of `v1.0.0`. After an approved deployment, complete the documented production smoke tests before declaring the release final.
