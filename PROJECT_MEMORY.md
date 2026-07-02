# Project Memory

This document preserves the current operating knowledge for future Rogers Holdings OS development.

## Current Status

Rogers Holdings OS is a Version 1.0 release candidate as of 2026-06-25.

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
- Website Audit Tool API

## Authoritative Source

Root `.gs` files are authoritative:

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

Root `.js` files are non-authoritative duplicates and must not be edited as source.

## Key Design Decisions

- Use Google Sheets as the operating database.
- Use Apps Script menus for user workflows.
- Use named headers instead of fixed column indexes wherever possible.
- Preserve workbook structure unless explicitly requested.
- Prefer helper reuse over duplicate workflow logic.
- Treat Activity Feed as the system log.
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

- `npm run status`
- `npm run validate`
- duplicate function verification
- menu target verification

Deployment is manual and must be explicitly run with:

```bash
npm run deploy
```

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

Rogers Holdings OS should feel:

- Professional
- Executive
- Minimal
- Black / white / gold
- Practical
- Small-business focused

Avoid customer-facing language that sounds internal, robotic, or prospecting-oriented.
