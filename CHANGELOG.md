# Changelog

All notable Rogers Holdings OS changes are tracked here.

## [1.0.0-rc] - 2026-07-10

### Fixed

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

- Added deterministic transition-matrix, lifecycle normalization, artifact-label preservation, and legacy Next Action compatibility tests via `npm run test:lifecycle`.
- Added deterministic manual restoration, Calendar identity/conflict, persisted Client/Project verification, ambiguity, and partial-retry regression coverage.

### Validation

- `npm run status` passed.
- `npm run validate` passed for 23 authoritative Apps Script files.

## [1.0.0-rc] - 2026-06-25

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
- Grouped Rogers Holdings OS menu.

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
- Reorganized the Rogers Holdings OS menu into logical submenus.

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

- Initial Rogers Holdings OS architecture and roadmap planning.
- Google Workspace operating system direction.
- Website Audit Tool integration path.
- Early prospect, proposal, Gmail, dashboard, client, and project automation.

### Notes

- Pre-1.0 work was iterative and consolidated into the current 1.0 release candidate baseline.
