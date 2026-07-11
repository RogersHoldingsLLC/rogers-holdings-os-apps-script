# Rogers Holdings OS

Rogers Holdings OS is a Google Workspace-based business operating system for Rogers Holdings LLC. It runs primarily on Google Sheets, Google Apps Script, Gmail, Google Calendar, Google Drive, and GitHub-backed local development.

The system is designed to manage the complete small-business lifecycle:

```text
Lead Found -> Executive Snapshot Sent -> Discovery Meeting Scheduled -> Digital Business Assessment Presented -> Improvement Plan Sent -> Project Started -> Client
```

## Version

Current release candidate: `1.0.0-rc`

See:

- `VERSION.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PROJECT_MEMORY.md`
- `docs/ROGERS_HOLDINGS_OS_V2_PRODUCT_SPEC.md`

## Production Baseline

Version 1.0 includes:

- CRM: Master Prospect Tracker, Clients, Client Workspace, Projects, Follow-Ups, Activity Feed
- Sales workflow: Executive Snapshot, Digital Business Assessment, Improvement Plan, Gmail Draft Automation, Next Action Engine
- Client delivery: Client conversion, project creation, project status/progress tracking, deliverable tracking
- System: Executive Dashboard, Dashboard Metrics, Health Check, Reset Demo Data, Rogers Holdings navigation menu
- Deliverables: Executive Snapshot PDF, branded Digital Business Assessment PDF, Improvement Plan PDF, Discovery Call Brief PDF, outreach draft content
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

CRM lifecycle stages represent confirmed business events. Deliverable generation and Gmail draft creation do not advance CRM Status. Use the explicit Pipeline confirmation actions; Discovery Meeting Scheduled is the sole externally confirmed automatic transition and occurs only after Calendar event creation succeeds.

Lifecycle changes are serialized with a document lock and recorded with durable operation/reconciliation fields on the prospect row. Calendar scheduling stores an operation key and event ID so retries reconcile before inserting. Use **System -> Audit Legacy Lifecycle Values** for a read-only inventory of historical Status and Next Action values; the audit never migrates data.

## Menu Structure

The `Rogers Holdings OS` menu is organized into:

- `Navigate`
- `Sales Workflow`
- `Pipeline`
- `Workspaces`
- `Follow-Ups`
- `Clients & Projects`
- `System`

Menu functions are defined in `Menu.gs` and call existing public workflow functions.

## Source Files

Root `.gs` files are the authoritative Apps Script source:

- `Code.gs`
- `Config.gs`
- `Menu.gs`
- `SheetHelpers.gs`
- `AuditEngine.gs`
- `PdfEngine.gs`
- `GmailEngine.gs`
- `CalendarEngine.gs`
- `DriveEngine.gs`
- `DemoData.gs`
- `HealthCheck.gs`

Root `.js` files with the same basenames are non-authoritative duplicates and are ignored by deployment.

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
npm run status
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
backups/rogers-os-local-<timestamp>/
```

### Deploy

```bash
npm run deploy
```

Deployment flow:

1. Run validation.
2. Create a local backup.
3. Confirm `clasp` and `.clasp.json`.
4. Run `clasp push`.

Do not deploy unless validation passes.

## Production Safety Rules

- Do not rewrite stable functions.
- Do not duplicate workflow logic.
- Reuse existing helpers.
- Preserve menu items unless intentionally retired.
- Preserve sheet structures unless a migration is explicitly requested.
- Preserve Rogers Holdings branding.
- Run `npm run validate` before any deployment.
- Run `npm run backup` before significant changes.
- Do not edit root `.js` duplicates as source of truth.

## Required Script Properties

Common required or recommended Apps Script properties:

- `WEBSITE_AUDIT_TOOL_URL` or `WEBSITE_AUDIT_TOOL_ENDPOINT`
- `BRAND_ASSET_FOLDER_ID` or `ROGERS_BRAND_ASSET_FOLDER_ID`

Health Check reports missing configuration and service access issues.

## Health Check

Run from:

```text
Rogers Holdings OS -> System -> System Health Check
```

It verifies required sheets, headers, duplicate prospects, Gmail, Drive, PDF dependencies, configuration, Client Workspace, Follow-Ups, Projects, and Dashboard integration.

## Acceptance Status

Local acceptance status as of 2026-06-25:

- `npm run status`: passing
- `npm run validate`: passing
- duplicate function verification: passing
- menu target verification: passing
- deployment: not automatic; must be explicitly run

Live Google Sheets smoke tests should be run after deployment before declaring the release final.
