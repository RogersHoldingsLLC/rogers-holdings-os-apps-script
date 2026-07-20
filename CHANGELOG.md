# Changelog

All notable Business Optimization Platform changes are tracked here.

## [1.0.0-rc] - Unreleased

Build `2026.07.20-rc`. This is a release candidate, not production-ready or released. Final live acceptance, release sign-off, and production approval remain required.

### Fixed

- Completed the repository-wide product naming cleanup for Business Optimization Platform by Rogers Holdings LLC, including source comments, operator surfaces, reports, Health Check copy, Gmail copy, deployment output, backups, package metadata, acceptance documentation, and legacy-named documentation paths.
- Documented the product hierarchy: Business Snapshot supplies prospect or assessment input to Business Optimization Platform, while Website Audit Tool API powers audit acquisition for both systems and Headquarters remains the separate internal command center.
- Preserved existing API contract fields, Google resource identifiers, URLs, Script Properties, deployment targets, and runtime integrations.

- Polished release-candidate menus, completion dialogs, empty states, and Health Check presentation without changing workflow or validation behavior.
- Added a lightweight About dialog for product version, build, deployment target, and optional Git commit information.

- Unified Activity Feed header resolution across Health Check, assessment/full-package logging, lifecycle logging, and existing readers/writers; row-4 headers are preserved and ambiguous duplicate header rows now fail safely without writes.

- Made Apps Script deployment target selection explicit: acceptance and production now have separate deploy/status commands, visible Script IDs, exact confirmations, and no default target.
- Added production deployment gates for the full release test set, clean working tree, approved branch, backup, and guaranteed restoration of the acceptance `.clasp.json` after either push success or failure.

- Standardized operator-facing Follow-Up terminology and aligned Prospect Workspace actions with canonical workflow language.
- Replaced Website Audit Tool and Drive raw-error alerts with concise recovery guidance while preserving technical diagnostics in logs.
- Added action-specific Deliverable Preview progress/success states and consistent asynchronous failure handling.
- Polished Bulk Prospect Import capitalization, ellipses, loading states, action hierarchy, and completion messaging.
- Presented business-friendly Health Check names while retaining the existing technical report data and diagnostics.

- Removed a duplicate client-conversion menu entry while preserving the existing conversion workflow entry point.
- Limited developer-only website audit controls in Prospect Workspace to developer mode so production workspaces present only operator-facing actions.
- Removed non-persistent Edit and Save controls from deliverable previews so every visible action has a real, durable outcome.
- Unified Gmail draft reconciliation across Create Outreach Gmail Draft, Send Digital Business Assessment, and Run Full Prospect Package using the current authenticated account, normalized recipient email, and exact normalized subject; one match is refreshed, no match creates one draft, and multiple matches fail safely.
- Prevented attachment-error fallback from creating a second assessment draft after an ambiguous Gmail result by reconciling the exact recipient/subject before creating the folder-link fallback.
- Made Gmail Activity Feed events distinguish created drafts from updated drafts and occur only after verified Gmail success.
- Reconciled canonical `AuditReport.pdf` and legacy `Audit Report.pdf` as one package artifact, trashing every active copy of both names before creating exactly one fresh canonical report and returning per-name removal counts.
- Made package artifact reconciliation deterministic: repeated generation now leaves exactly one active `AuditReport.pdf`, `Proposal.pdf`, and `Outreach Email Draft.txt` in the resolved package folder and returns explicit replacement/update/duplicate-removal results.
- Added explicit Audit Source validation for `Website Audit Tool` and `Quick Internal Audit`, repairing inherited Priority Tier validation without changing existing provenance cells.
- Restricted verified client-facing rendering to exact Website Audit Tool provenance, valid production score/outcome/tier values, and existing PDF narrative; blank, placeholder, inferred, and arbitrary provenance now fail closed with field-specific guidance.
- Distinguished the Drive artifact `Outreach Email Draft.txt` from a real Gmail draft in Activity Feed events while preserving the existing Gmail workflows.
- Added an idempotent Master Prospect Tracker schema repair for the required `Audit Source` field, preserving existing columns and values, placing a missing field after `Priority Tier`, and never inferring provenance for legacy audit rows.
- Separated fresh website-audit acquisition from local Digital Business Assessment rendering so complete, verified prospect audit data no longer requires `WEBSITE_AUDIT_TOOL_URL` to generate package files.
- Preserved stored screenshot and evidence fields in locally rendered audit reports, blocked Quick Internal Audit placeholders from client-facing rendering, and clarified missing-endpoint errors for fresh audit acquisition.
- Changed a missing Website Audit Tool endpoint from a platform health failure to an acquisition warning and made Full Prospect Package retries reuse an exact existing Gmail draft instead of creating a duplicate.
- Separated deliverable generation, preview, audit completion, file creation, and Gmail draft creation from confirmed CRM lifecycle stages.
- Added guarded lifecycle transitions with clear invalid-jump messages and idempotent repeated confirmations.
- Replaced ambiguous automatic stage actions with explicit confirmations for sent, presented, accepted, onboarding, nurture, and lost outcomes.
- Kept Discovery Meeting Scheduled tied to successful Google Calendar event creation.
- Added attributable Activity Feed logging and validation for manual CRM Status edits.
- Updated Next Action, follow-up, and dashboard behavior to reflect confirmed events only.
- Added document locking and durable reconciliation markers for lifecycle transitions, manual edits, Calendar scheduling, and client/project conversion.
- Added Calendar operation-key and event-ID reconciliation so ambiguous or repeated scheduling attempts do not blindly send another invitation.
- Made repeated lifecycle confirmations repair incomplete downstream work instead of exiting without reconciliation.
- Enforced the approved strict transition matrix, including explicit Nurture re-entry and terminal Project Started, Client, and Lost rules.
- Hardened manual Status edits against missing prior values, unsupported multi-cell changes, concurrency, and unverifiable writes.
- Added a read-only legacy lifecycle audit and removed silent artifact-label fallback to Lead Found.
- Remapped legacy Convert to Client and Start Project Next Actions to the explicit Improvement Plan outcome confirmation.
- Made unsupported manual Status edits fail closed by restoring verified prior values or clearing only an unverifiable Status cell before marking reconciliation.
- Bound Calendar reconciliation to prospect, exact start/end time, calendar identity, operation evidence, and event ID; conflicting or different-time events now fail closed.
- Added persisted Client and Project re-read verification, including duplicate and ambiguous identity rejection, before CRM Status advancement.
- Made operation-key fallback identity row-specific when Prospect ID is unavailable.

### Tests

- Added deterministic deployment safety coverage for target rejection/selection, dirty-tree and confirmation rejection, configuration restoration after successful and failed pushes, and prevention of implicit production deployment.
- Expanded deterministic Gmail coverage for first-run creation, exact-match reuse across all three public workflows, ambiguous attachment persistence, single folder-link fallback, multiple-match rejection, and success-evidence ordering.
- Expanded deterministic audit rendering coverage for Audit Source validation repair, strict provenance eligibility, production field validation, narrative readiness, and Drive-file versus Gmail activity wording.
- Added deterministic audit acquisition/local rendering, evidence preservation, missing endpoint, placeholder rejection, Gmail draft retry, and Health Check warning coverage via `npm run test:audit-rendering`.
- Added deterministic transition-matrix, lifecycle normalization, artifact-label preservation, and legacy Next Action compatibility tests via `npm run test:lifecycle`.
- Added deterministic manual restoration, Calendar identity/conflict, persisted Client/Project verification, ambiguity, and partial-retry regression coverage.

### Validation

- `npm run status:acceptance` and `npm run status:production` passed.
- `npm run validate` passed for 23 authoritative Apps Script files.

## [1.0.0-rc.0] - 2026-06-25

### Added

- Master Prospect Tracker CRM workflow.
- Activity Feed logging system.
- Executive Dashboard and Dashboard Metrics.
- Website Audit Tool integration.
- Quick Internal Audit guardrails.
- Audit Package generation.
- Branded Audit Report PDF.
- Branded Proposal PDF.
- Discovery Call Brief PDF.
- Gmail draft automation.
- Send Audit Package workflow.
- Full Prospect Package workflow.
- Next Action Engine.
- Follow-Up Engine.
- Client Management Engine.
- Client Workspace.
- Project Delivery Engine.
- Reset Demo Data workflow.
- System Health Check.
- Local `clasp` deployment workflow.
- Local validation, status, backup, and deployment scripts.
- Root `.gs` authoritative source policy.
- Rogers Holdings black/gold visual polish.
- Grouped Business Optimization Platform menu.

### Changed

- Relaxed audit receiver/header requirements where optional fields are missing.
- Updated Website Audit Tool payload mapping.
- Removed duplicate user-facing outreach email action while preserving shared helpers.
- Improved Gmail draft validation for missing website/email cases.
- Reworked PDF output into a more premium, customer-facing consulting deliverable.
- Added dynamic brand asset loading for PDF deliverables.
- Added defensive visual formatting around merged cells.
- Split the original monolithic Apps Script into responsibility-based `.gs` files.
- Restored Apps Script indexing after modular split by using Apps Script-safe globals.
- Updated dashboard layouts and metrics to include clients, follow-ups, and projects.
- Reorganized the Business Optimization Platform menu into logical submenus.

### Fixed

- Master Prospect Tracker audit upsert failures from overly strict required headers.
- Activity Feed field placement for website audit entries.
- Copy Proposal modal button behavior.
- Gmail draft cleanup using supported `draft.getMessage().getThread().moveToTrash()`.
- Audit package duplicate file creation by updating existing files.
- Audit package report text fallback to prefer full API report text.
- Send Audit Package timeout risk with safer file lookup and attachment fallback.
- Demo data dropdown validation issues.
- Follow-Up and Project sheet creation edge cases on blank sheets.
- Apps Script indexing failures caused by duplicate declarations after modular split.

### Validation

- Local validation passes for 11 authoritative Apps Script files.
- Duplicate function verification passes.
- Menu target verification passes.
- Deployment remains manual through `npm run deploy`.

## [Pre-1.0] - 2026-06-10 to 2026-06-24

### Added

- Initial Business Optimization Platform architecture and roadmap planning.
- Google Workspace operating system direction.
- Website Audit Tool integration path.
- Early prospect, proposal, Gmail, dashboard, client, and project automation.

### Notes

- Pre-1.0 work was iterative and consolidated into the current 1.0 release candidate baseline.
