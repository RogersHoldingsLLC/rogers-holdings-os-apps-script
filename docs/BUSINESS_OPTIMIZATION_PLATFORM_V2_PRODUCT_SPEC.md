# Business Optimization Platform v2 Product Specification

Status: Draft for planning
Date: 2026-06-25
Owner: Rogers Holdings LLC
Current baseline: Business Optimization Platform v1.0 release candidate

## 1. Purpose

Business Optimization Platform v2 should evolve the v1 Google Workspace operating system into a more scalable, repeatable, client-ready business platform.

The goal is not to replace the v1 system. The goal is to make it easier to operate, easier to deploy for future small business clients, easier to trust, and easier to extend without destabilizing production workflows.

v2 must preserve the current lifecycle:

```text
Prospect -> Audit -> Proposal -> Follow-Up -> Client -> Project -> Completed -> Maintenance
```

## 2. Product Vision

Business Optimization Platform is a lightweight business operating system for local and small business growth operations.

It should help Rogers Holdings LLC and future client implementations:

- Find and manage prospects.
- Review website and digital presence opportunities.
- Generate premium audit and proposal deliverables.
- Create outreach drafts and sales follow-ups.
- Convert won prospects into clients.
- Manage projects, deliverables, and client activity.
- Surface daily priorities from one executive dashboard.
- Maintain reliable operational health through built-in checks.

v2 should feel like a cohesive business application built on Google Workspace, not a collection of scripts attached to a spreadsheet.

## 3. v2 Product Principles

- Preserve v1 production stability.
- Prefer incremental migrations over disruptive rewrites.
- Keep Google Sheets as the operating database unless a specific limitation requires an extension.
- Keep Apps Script as the main workflow runtime.
- Reuse existing helpers and workflow entry points.
- Use named headers instead of fixed column indexes.
- Keep the Activity Feed as the system log.
- Keep Health Check as the readiness gate.
- Keep Executive Dashboard as the primary home screen.
- Keep customer-facing deliverables polished, plain-English, and Rogers Holdings branded.
- Design future client deployments as configurable copies, not one-off forks.

## 4. Target Users

### Primary User

Brian Keith Rogers / Rogers Holdings LLC operator.

Needs:

- Daily command center.
- Fast prospect workflows.
- Reliable audit-package generation.
- Follow-up visibility.
- Client/project management.
- Low-maintenance system administration.

### Secondary User

Future small business client or internal team member.

Needs:

- Clear dashboards.
- Simple navigation.
- Limited-risk workflows.
- Client/project visibility.
- Less exposure to technical internals.

### Administrator

System owner or implementation lead.

Needs:

- Setup checklist.
- Script property validation.
- Deployment workflow.
- Backup/restore confidence.
- Version tracking.
- Configurable branding and sheet setup.

## 5. v1 Baseline To Preserve

v2 must preserve these v1 capabilities unless a migration plan explicitly replaces them:

- Master Prospect Tracker
- Clients
- Client Workspace
- Projects
- Follow-Ups
- Activity Feed
- Executive Dashboard
- Dashboard Metrics
- Settings
- Website Audit Tool integration
- Real Website Audit workflow
- Quick Internal Audit workflow
- Audit Package generation
- Audit Report PDF
- Proposal PDF
- Gmail draft creation
- Send Audit Package workflow
- Discovery Call workflow
- Next Action Engine
- Full Prospect Package workflow
- Client conversion
- Project creation and status updates
- Follow-Up Engine
- System Health Check
- Reset Demo Data
- Reset Test Data
- Local validation, backup, status, and deploy scripts
- Root `.gs` files as authoritative Apps Script source

## 6. v2 Scope

### In Scope

- Better setup and configuration.
- Better multi-business deployment readiness.
- Better dashboard consistency and performance.
- Better user roles and operator guidance.
- Stronger data hygiene and duplicate prevention.
- Improved activity timeline and audit trail quality.
- Better project/deliverable management.
- Improved recurring follow-up and maintenance workflows.
- Better PDF/Gmail deliverable templates.
- More robust integrations with Website Audit Tool, Gmail, Calendar, and Drive.
- Clearer system health, diagnostics, and recovery tooling.
- Documentation and onboarding improvements.

### Out Of Scope For Initial v2

- Replacing Google Sheets with a separate database.
- Rebuilding the system as a standalone SaaS app.
- Public client portal unless separately approved.
- Payment processing unless separately approved.
- Complex multi-user permission architecture beyond practical Google Workspace controls.
- AI-generated legal, tax, or financial advice.
- Automated email sending without explicit user approval.

## 7. v2 Release Themes

### Theme 1: Configuration And Deployment

Make the OS easier to set up, brand, validate, and copy for future deployments.

Capabilities:

- Setup Wizard for required script properties.
- Brand Asset Folder validation and preview.
- Required sheet/header installer.
- Deployment checklist sheet or modal.
- Environment summary in Health Check.
- Version stamp visible in Settings and Health Check.
- Client implementation checklist for future small business deployments.

### Theme 2: Command Center UX

Make Executive Dashboard the daily operating home screen.

Capabilities:

- Cleaner KPI hierarchy.
- Daily priority queue.
- Follow-ups, overdue work, and active project risks.
- Recent client/project activity.
- System status card.
- Fast navigation to selected records.
- Clear empty states.
- Better refresh behavior and visible last-refresh time.

### Theme 3: Workflow Reliability

Make every major workflow safe, explainable, and recoverable.

Capabilities:

- Standard workflow result object pattern.
- Consistent success/failure dialogs.
- Step-by-step workflow logging for long operations.
- Idempotent Drive file generation.
- Duplicate prevention for prospects, clients, projects, and follow-ups.
- Recovery guidance when Website Audit Tool or Gmail fails.
- Health Check coverage for all required dependencies.

### Theme 4: Client Delivery

Make post-sale delivery stronger.

Capabilities:

- Project deliverable checklist.
- Project phase history.
- Client workspace activity timeline improvements.
- Client document index.
- Maintenance status.
- Upcoming client tasks.
- Internal notes separated from customer-facing copy where practical.

### Theme 5: Repeatable Client Deployments

Prepare Business Optimization Platform to become a reusable operating system for future small business clients.

Capabilities:

- Configurable business name, contact info, logo folder, and brand colors.
- Setup guide for copying the workbook.
- Client-specific Settings validation.
- Script property setup instructions.
- Future-safe naming standards.
- Documentation package per deployment.

## 8. Core Data Model

v2 should continue to use sheets as tables. Each table should have:

- Stable headers.
- Header validation in Health Check.
- Named helper access.
- Duplicate prevention rules.
- Activity Feed logging where meaningful.

### Master Prospect Tracker

Purpose: Sales and prospect lifecycle.

Key data:

- Company
- Contact
- Email
- Phone
- Website
- City
- State
- Industry
- Source
- Audit Score
- Audit Outcome
- Priority Tier / Opportunity Level
- Status
- Next Action
- Follow-Up Date
- Offer / Service
- Notes
- Summary
- Audit Package Generated
- Proposal Generated
- Gmail Draft Created
- Last Activity

v2 improvements:

- Clearer separation between internal status and customer-facing opportunity language.
- Better duplicate detection by company, website, and email.
- Optional record ID standardization if not already present.

### Clients

Purpose: Active or former customer records.

Key data:

- Client ID
- Company
- Contact
- Email
- Phone
- Website
- Industry
- Service Package
- Start Date
- Renewal Date
- Status
- Assigned To
- Current Project
- Project Status
- Due Date
- Last Activity
- Notes

v2 improvements:

- Stronger client status definitions.
- Client document index.
- Better project linkage.
- Renewal/maintenance visibility.

### Projects

Purpose: Delivery management after conversion.

Key data:

- Project ID
- Client ID
- Client
- Service
- Package
- Status
- Priority
- Start Date
- Due Date
- Progress %
- Assigned To
- Current Phase
- Deliverables
- Folder
- Notes
- Last Updated

v2 improvements:

- Deliverable-level checklist.
- Phase change activity logging.
- Project risk indicator.
- Maintenance handoff state.

### Follow-Ups

Purpose: Prevent missed sales/client actions.

Key data:

- Follow-Up ID
- Company
- Contact
- Email
- Related Prospect ID
- Related Client ID
- Current Status
- Follow-Up Type
- Due Date
- Days Until Due
- Priority
- Assigned To
- Notes
- Completed
- Completed Date

v2 improvements:

- Better completed/open filtering.
- Automatic stale follow-up detection.
- Client follow-up distinction from prospect follow-up.
- Follow-up outcome tracking.

### Activity Feed

Purpose: System audit trail.

Key data:

- Date
- Company
- Activity Type
- Activity Notes
- Related Prospect ID
- Related Client ID
- User, if available

v2 improvements:

- Standard activity type taxonomy.
- Avoid duplicate logs for chained workflows.
- Optional severity/category.
- Better timeline rendering in workspaces.

### Settings

Purpose: Configuration surface.

v2 should formalize Settings around:

- Company name
- Contact name
- Email
- Phone
- Brand asset folder ID
- Website Audit Tool endpoint
- Default follow-up rules
- Default service packages
- Default proposal terms
- Version
- Environment notes

## 9. Workflow Specifications

### Next Action Engine v2

Purpose: One-button workflow routing.

Inputs:

- Selected prospect row.
- Current status.
- Existing generated assets.
- Follow-up/project/client state.

Expected behavior:

- Validate active sheet and selected row.
- Determine current lifecycle state.
- Avoid duplicate work.
- Run the safest next workflow.
- Log the action.
- Refresh dashboard/workspaces.
- Show clear result.

v2 improvements:

- Return structured action result.
- Display skipped/completed prerequisites.
- Provide recovery action if a dependency fails.
- Include manual next step when automation cannot continue.

### Full Prospect Package v2

Purpose: Generate core prospect deliverables from one action.

Expected steps:

1. Validate Company and Website.
2. Run real Website Audit if audit data is missing.
3. Generate or update Audit Report PDF.
4. Generate or update Proposal PDF.
5. Generate Outreach Email Draft text.
6. Create Gmail draft if email exists.
7. Update tracker fields.
8. Log start, major steps, and completion.
9. Refresh dashboard.

v2 improvements:

- Stronger progress dialog or status output.
- More explicit partial-failure recovery.
- Better Drive folder link in final result.

### Website Audit Integration v2

Purpose: Keep Website Audit Tool as the audit engine while Business Optimization Platform acts as control center.

Requirements:

- Do not duplicate audit scoring logic inside Apps Script.
- Send required payload fields.
- Store accepted response fields by header.
- Preserve real audit results from accidental placeholder overwrite.
- Log API response failures clearly.

v2 improvements:

- Endpoint configuration validation.
- Response schema validation.
- Better screenshot/file handling.
- Retry guidance, not blind retries.

### Audit Package v2

Purpose: Create premium customer-facing deliverables.

Expected outputs:

- `Audit Report.pdf`
- `Proposal.pdf`
- `Outreach Email Draft.txt`

Requirements:

- Reuse Drive folder.
- Overwrite/update files with same name instead of duplicating.
- Preserve filenames used by Gmail attachment logic.
- Use dynamic brand assets.
- Use customer-facing language.

v2 improvements:

- Template version stamp.
- PDF generation diagnostics.
- Visual regression checklist.
- Better screenshot evidence when available.

### Gmail Draft v2

Purpose: Create reviewable Gmail drafts, not automatically sent email.

Requirements:

- Email recipient optional where Gmail allows.
- Clear message if recipient is required.
- Subject includes company.
- Body uses Rogers Holdings tone.
- Do not mark package/email as sent unless user actually marks sent or workflow sends email by explicit future design.

v2 improvements:

- Centralized draft copy templates.
- More consistent subject naming.
- Better folder/package link placement.
- Optional attachment fallback logic when Gmail is slow.

### Follow-Up Engine v2

Purpose: Ensure no prospect or client is forgotten.

Requirements:

- Auto-create follow-up when status changes.
- Complete previous follow-up when action is taken.
- Avoid duplicate open follow-ups.
- Surface due/overdue follow-ups on dashboard and workspace.

v2 improvements:

- Configurable follow-up intervals in Settings.
- Outcome categories.
- Separate prospect/client follow-up views.
- Recurring maintenance follow-ups for active clients.

### Client And Project v2

Purpose: Make post-sale delivery operational.

Requirements:

- Convert Won prospect to Client.
- Avoid duplicate clients.
- Create or update Project for active client.
- Link Client Workspace to project and follow-up data.
- Log key delivery events.

v2 improvements:

- Project deliverable checklist.
- Project completion summary.
- Maintenance transition.
- Client health status.

## 10. User Experience Requirements

### Navigation

The menu should remain grouped:

- Navigate
- Sales Workflow
- Pipeline
- Workspaces
- Follow-Ups
- Clients & Projects
- System

v2 may improve naming or grouping only if:

- Existing functions remain callable.
- User-facing workflow behavior is preserved.
- Documentation is updated.

### Visual Design

Brand:

- Black
- White
- Gold
- Soft neutrals
- Professional, executive, minimal

Daily-use sheets should:

- Keep premium headers.
- Avoid harsh black fills in high-use data areas.
- Use readable row heights.
- Use wrapped notes where appropriate.
- Use clean date, money, score, and status formatting.
- Preserve data validation and formulas.

### Empty States

Empty sections should show professional placeholders:

- No recent activity yet.
- No open follow-ups.
- No active project found.
- Select a client row to populate this workspace.

Do not leave major workspace sections blank.

## 11. Customer-Facing Deliverables

### Audit Report PDF

Required qualities:

- Premium cover page.
- Rogers Holdings branding.
- Executive summary.
- Score and assessment.
- Plain-English business impact.
- Evidence-based findings where data exists.
- Prioritized recommendations.
- Quick wins.
- Recommended next step.
- Contact/footer consistency.

Avoid:

- Internal pipeline language.
- Prospecting language.
- Robotic audit phrasing.
- Unsupported claims.

### Proposal PDF

Required qualities:

- Premium cover page.
- Thank-you / intro section.
- What We Found.
- Recommended Solution.
- Deliverables.
- Timeline.
- Investment.
- Next steps.
- Acceptance-style closing.

Avoid:

- Confusing multiple package options unless explicitly requested.
- Repeating investment/timeline details across pages.
- Internal status labels.

### Gmail Drafts

Required qualities:

- Local-business friendly.
- Simple.
- Practical.
- Helpful.
- Not too salesy.
- Rogers Holdings branded.
- Clear next step.

## 12. Integrations

### Website Audit Tool

Current role: external audit engine.

v2 requirement:

- Business Optimization Platform controls workflow.
- Website Audit Tool produces audit data.
- Apps Script stores and packages results.
- Apps Script does not duplicate scoring logic.

### Gmail

Current role: draft creation.

v2 requirement:

- Continue draft-first model.
- Do not auto-send unless a future explicit approval workflow is designed.

### Google Calendar

Current role: discovery call scheduling.

v2 requirement:

- Preserve Meet link creation.
- Improve event description consistency.
- Add better activity logging.

### Google Drive

Current role: folders and deliverables.

v2 requirement:

- Reuse folders.
- Avoid duplicate generated files.
- Maintain predictable file names.
- Improve folder indexing only if performance requires it.

## 13. Health Check v2

Health Check should remain the readiness gate.

v2 checks should include:

- Required sheets.
- Required headers.
- Required script properties.
- Brand asset folder reachability.
- Website Audit Tool endpoint configuration.
- Gmail access.
- Drive access.
- Calendar access.
- PDF generation dependencies.
- Duplicate prospects.
- Duplicate clients.
- Duplicate open follow-ups.
- Duplicate active projects.
- Won prospects missing clients.
- Active clients missing projects.
- Overdue follow-ups.
- Dashboard integration.
- Client Workspace integration.
- Project integration.
- Version stamp.

Health Check output should:

- Use Pass / Warning / Fail.
- Explain impact.
- Suggest fix.
- Store last result in Script Properties.

## 14. Performance Requirements

Target performance:

- Executive Dashboard refresh under 5 seconds for 1,000 prospects where practical.
- Follow-Up refresh under 5 seconds for 1,000 follow-ups where practical.
- System Health Check under 15 seconds for normal workbook size.
- Long-running workflows should provide visible status or clear final diagnostics.

Performance rules:

- Batch reads and writes.
- Avoid repeated full-sheet scans inside loops.
- Cache header maps inside workflow functions.
- Avoid unnecessary dashboard refreshes when no data changed.
- Keep Drive searches bounded.
- Prefer idempotent file updates over duplicate creation.

## 15. Security And Safety

Safety requirements:

- Confirmation prompts for destructive actions.
- No data deletion without explicit confirmation.
- Preserve formulas, validations, formatting, and headers during resets.
- Do not expose API keys in logs or UI.
- Do not print sensitive script properties.
- Do not auto-send emails without explicit future approval.
- Do not overwrite real Website Audit Tool results with Quick Internal Audit results.
- Do not deploy automatically from local scripts without validation and backup.

## 16. Configuration Requirements

Required or recommended Script Properties:

- `WEBSITE_AUDIT_TOOL_URL` or `WEBSITE_AUDIT_TOOL_ENDPOINT`
- `BRAND_ASSET_FOLDER_ID` or `ROGERS_BRAND_ASSET_FOLDER_ID`

Potential v2 properties:

- `ROGERS_OS_ENVIRONMENT`
- `ROGERS_OS_VERSION`
- `DEFAULT_ASSIGNED_TO`
- `DEFAULT_FOLLOW_UP_DAYS`
- `BUSINESS_NAME`
- `BUSINESS_CONTACT_NAME`
- `BUSINESS_CONTACT_EMAIL`
- `BUSINESS_CONTACT_PHONE`

Settings sheet should mirror safe, non-secret configuration where appropriate.

## 17. Migration Strategy

v2 should use safe migrations:

1. Validate current workbook.
2. Back up locally.
3. Back up Apps Script project.
4. Add new columns only when required.
5. Move existing columns by header only when required.
6. Preserve data, formatting, formulas, and validation.
7. Run Health Check.
8. Run acceptance smoke test.

No migration should:

- Delete user sheets.
- Delete Settings.
- Delete Activity Feed.
- Delete generated Drive folders.
- Remove v1 public menu functions without a compatibility wrapper.

## 18. Development Standards

Before any v2 feature:

- Read current `.gs` source.
- Confirm no duplicate function names.
- Reuse existing helpers.
- Keep root `.gs` files authoritative.
- Do not edit root `.js` duplicates.
- Run `npm run status`.
- Run `npm run validate`.
- Run duplicate-function verification.
- Run `npm run backup`.
- Do not deploy unless explicitly requested.

After any v2 feature:

- Update documentation.
- Update Health Check if new dependency or sheet behavior is added.
- Update dashboard/workspace integration if relevant.
- Document manual Google Sheets tests.

## 19. Acceptance Criteria For v2 Release

v2 cannot be considered release-ready until all items pass:

- `npm run status` passes.
- `npm run validate` passes.
- duplicate-function verification passes.
- local backup is created.
- Apps Script indexes functions after deployment.
- Business Optimization Platform menu loads.
- System Health Check passes or shows only known accepted warnings.
- Executive Dashboard refreshes.
- Next Action Engine routes a test prospect correctly.
- Full Prospect Package works for a new prospect.
- Audit Report PDF generates.
- Proposal PDF generates.
- Gmail draft creates.
- Send Audit Package attaches PDFs.
- Follow-Up Engine creates and completes follow-ups.
- Won prospect converts to client.
- Project is created for active client.
- Client Workspace displays client, project, follow-up, document, and activity data.
- Reset Test Data preserves structure.
- Activity Feed logs meaningful events.
- Customer-facing copy is reviewed for professionalism.

## 20. v2 Candidate Backlog

### Priority 1: Stabilization And Setup

- Setup Wizard.
- Version stamp and environment display.
- Expanded Health Check.
- Dashboard refresh optimization.
- Standard workflow result pattern.

### Priority 2: Daily Operator Experience

- Better daily priority queue.
- Better follow-up outcome handling.
- Better activity timeline display.
- Better client/project empty states.
- Better dashboard drill-down links.

### Priority 3: Client Delivery

- Project deliverable checklist.
- Maintenance handoff.
- Client document index.
- Client health indicator.
- Project completion summary.

### Priority 4: Deployment Packaging

- Future client implementation checklist.
- Configurable brand/contact settings.
- Copy/setup guide.
- Deployment validation checklist.

### Priority 5: Advanced Enhancements

- AI-assisted proposal copy customization.
- Client reporting view.
- Recurring maintenance workflows.
- Cross-workbook reporting.
- Read-only client portal exploration.

## 21. Non-Goals

v2 should not:

- Become a broad SaaS rebuild.
- Add complexity before daily workflows are reliable.
- Replace stable v1 functions unnecessarily.
- Introduce new integrations without operational justification.
- Add hidden automation that changes sales/client state without logging.
- Blur the boundary between Quick Internal Audit and real Website Audit Tool results.

## 22. Open Product Questions

Before v2 implementation begins, decide:

- Is v2 primarily for Rogers Holdings internal use, future client deployments, or both equally?
- Should each future client get a separate workbook, or should Rogers Holdings manage multiple clients in one master workbook?
- Should client-facing deliverables remain generated from Apps Script HTML/PDF, or should Google Docs templates be introduced?
- Should settings be managed primarily through Script Properties, Settings sheet rows, or a setup modal?
- What level of user permission control is required for future operators?
- What parts of the system should be configurable for client deployments versus fixed Rogers Holdings standards?

## 23. Recommended v2 Build Order

1. Finalize v1 release.
2. Confirm v2 product decisions from Open Product Questions.
3. Build Setup Wizard and version/environment display.
4. Expand Health Check for v2 dependencies.
5. Standardize workflow result handling.
6. Optimize Executive Dashboard refresh.
7. Improve daily priority queue.
8. Improve project deliverable checklist.
9. Improve client deployment packaging.
10. Re-run full acceptance testing before release.

## 24. Definition Of Done For v2 Features

Every v2 feature must include:

- Clear user-facing requirement.
- Minimal code changes.
- No duplicate functions.
- Existing workflows preserved.
- Health Check updated if needed.
- Dashboard/workspace integration updated if needed.
- Activity logging where meaningful.
- `npm run status` pass.
- `npm run validate` pass.
- duplicate-function verification pass.
- backup created.
- manual Google Sheets test plan documented.
