# Changelog

## 2026-08-27 — DE-002 Identity Exclusion Snapshot v1

- Added a separately versioned, BOP-owned prospect/client identity snapshot that binds to the configured authoritative workbook and exposes only record ID, lifecycle, business name, and canonical domain arrays.
- Added exact row-4 schema enforcement, matching initial full-source acquisitions plus a final complete fingerprint after snapshot construction, required-header/data formula rejection, case-insensitive global duplicate-ID rejection, fixed client-name compatibility precedence, and whole-snapshot fail-closed behavior.
- Added exact Headquarters ID/name validation, 100,000-entry and 512 KiB canonical-payload ceilings, and a pure strict domain parser without changing `normalizeWebsiteKey_()` semantics; blank websites emit no domain while malformed, credential-bearing, port-bearing, unsupported-scheme, and noncanonical repeated-`www` inputs are safely normalized or rejected.
- Added a separate Script Property token route with generic authentication/source failures and preserved Headquarters Sales Feed v1 response semantics.
- Added focused local coverage for exact Headquarters compatibility, normalization, source mutation through the final validation boundary, dense-array enforcement, completeness, privacy, authentication, size limits, and no-write boundaries. No token was created, no live BOP data or Apps Script endpoint was accessed, and nothing was deployed.

## 2026-08-12 — QA-2 Final Gold Standard Polish

- Consolidated the Executive Brief to one decisive closing action and clarified its qualitative review category as `Focused Priorities`.
- Separated Digital Business Assessment deficiencies from the verified credential strength while preserving evidence lineage.
- Reworded Assessment and Improvement Plan implementation paths to preserve the advisory boundary and optional separate implementation scope.
- Regenerated and visually verified the final Harbor Light package under `test-output/qa2-final-gold-standard`; no production change or deployment was performed.

## 2026-08-12 — QA-2 Gold Standard Package Refinement

- Refined Executive Brief labeling, repetition, and footer composition while preserving its one-page editorial design.
- Added evidence-state-specific finding language and print-safe atomic cards for Digital Business Assessment rendering.
- Reclassified the Harbor Light service-boundary issue as a Priority Improvement so severity and the primary conclusion remain coherent.
- Added a persistent 1/6/4-page Harbor Light acceptance package with explicit pagination, a consolidated Improvement Plan, extracted text, acceptance evidence, and rendered-page evidence.
- Preserved production, workbook, intake, lifecycle, Gmail, Calendar, Receiver, Website, Cloudflare, and Script Property boundaries.

## 2026-08-12 — Playground and Client Drive Root Isolation

- Added the durable Production + Playground workbook model and documented the temporary acceptance-checkpoint migration path.
- Added `BOP_CLIENT_DRIVE_ROOT_ID` so configured production artifact lookup and creation remain under the stable Rogers Holdings Clients folder instead of using global Drive name discovery.
- Added fail-closed duplicate/unavailable-root behavior and deterministic isolation tests while preserving legacy lookup only when the property is absent.
- Recorded the production workbook timezone mismatch as a separate controlled follow-up; no timezone was changed.

## 2026-08-10 — Phase 2B Next Action Synchronization (Acceptance Candidate)

- Added the controlled `Sync Prospect Next Action from Open Follow-Ups` action for an exact-ID selected Prospect or prospect-linked Follow-Up.
- Added deterministic primary open Follow-Up selection: valid dates before undated tasks, earliest due date first, then lexical Follow-Up ID.
- Added a fixed, validation-backed Follow-Up Type to Next Action mapping, an explicit unchanged-Status preview, document-locked re-read, stale-preview rejection, verified two-field Prospect writes, and compensating restoration.
- Added material-change-only Activity correlation through `FOLLOWUPSYNC:<Prospect ID>:<Follow-Up ID>:<transition hash>`, including duplicate-key rejection and retry reconciliation.
- Added focused coverage for exact identity, ineligible linkage, deterministic selection, preview cancellation, stale state, write boundaries, Activity failure recovery, idempotency, external-side-effect isolation, and Business Snapshot/lifecycle boundaries.
- Preserved workbook schemas, lifecycle vocabulary and transitions, Phase 2A completion, Business Snapshot intake, Gmail, Calendar, Drive, Dashboard, Client Workspace, Receiver Version 2, and immutable BOP Version 7.

## 2026-08-09 — Phase 2A Follow-Up Execution Improvements

- Advanced the release-candidate build identifier to `2026.08.10-rc` while retaining semantic product version `1.0.0-rc`.
- Added exact-ID selected Follow-Up context, fail-closed prospect/client navigation, safe opening of an already-correlated Client Workspace without refresh, and unique-company legacy fallback without changing workbook schema.
- Added a read-only Follow-Up review dialog with live prospect Status, live Next Action, due state, ownership, notes, and the five newest Prospect-ID-correlated Activity records.
- Added document-locked, exact-row Follow-Up completion with persisted verification and idempotent `FOLLOWUP:<Follow-Up ID>:COMPLETE` Activity correlation.
- Added focused regression coverage for exact linkage, ambiguity handling, sibling-task isolation, completion-field boundaries, Activity idempotency, recent context, Business Snapshot replay, and prohibited external/generated-surface actions.
- Preserved lifecycle state, Next Action, workbook headers/validations/formatting, Business Snapshot intake, Gmail, Calendar, Drive, Dashboard, and Client Workspace behavior.

## 2026-08-09 — Workbook Optimization Safety Foundation

- Captured a read-only production workbook baseline covering sheet structure, exact headers, populated row counts, validation rules, conditional formatting, entity counts, accepted Business Snapshot correlation evidence, and fixed Apps Script layout coordinates.
- Added a machine-readable, documentation-only workbook contract manifest.
- Created a separate owner-restricted workbook optimization acceptance copy with a distinct non-production title; no production mapping or public intake path was changed.
- Corrected current-state documentation to record the accepted production topology: Website -> Cloudflare -> Replacement Production Receiver Version 2 -> Authorized BOP Version 7 -> authoritative production workbook.
- Preserved prior receiver activation and release statements as historical evidence.

## [Unreleased]

### Gold Standard production-path integration

- Added one authoritative `buildGoldStandardDeliverableInput_()` boundary with immutable evidence, finding, recommendation, and Improvement Plan action lineage.
- Routed Executive Brief, Digital Business Assessment, Improvement Plan, and Prospect-to-Revenue Executive Brief rendering through the approved Gold Standard Apps Script renderers and canonical filenames.
- Corrected Generate Improvement Plan so the operator action creates or reconciles `Improvement Plan.pdf` while preserving its existing Activity, Next Action, Last Activity, and dashboard behavior.
- Refactored the Harbor Light QA generator to call the authoritative Apps Script model and HTML renderers instead of maintaining an independent layout implementation.
- Added deterministic authoritative integration, evidence-state, advisory-boundary, canonical-name, Drive-compatibility, and 1/6/4 visual regression coverage.

### Added

- Added the canonical `BusinessSnapshotIntake.gs` library boundary for Business Snapshot submissions, including explicit workbook resolution through `BOP_SPREADSHEET_ID`, normalized public input validation, duplicate company/email protection, and one Lead Found prospect plus linked Follow-Up per accepted request.
- Added durable `INTAKE:<requestId>` idempotency with exact Prospect ID, Activity Feed, and open Executive Brief Follow-Up verification so safe retries return the original prospect without duplicating records.
- Added compensating rollback and reconciliation-required failure handling for partial tracker, Activity Feed, and Follow-Up writes, including verification that pre-existing Follow-Ups remain unchanged.
- Added centralized literal-text protection at Business Snapshot tracker, Activity Feed, and Follow-Up write boundaries so leading `=` input cannot execute as a spreadsheet formula while legitimate values such as international `+` phone numbers remain unchanged.
- Added Rogers Holdings Naming Standard v1.0 documentation and regression coverage for the canonical customer and operator journey: Executive Brief, Digital Business Assessment, and Improvement Plan.
- Added the BOP-owned Headquarters Sales Feed v1 deterministic builder and authenticated, read-only Apps Script `doPost` endpoint.
- Added fixture-only coverage for contract semantics, privacy, authentication, freshness, partial behavior, and absence of workbook writes.
- Added deployment and consumption documentation in `HEADQUARTERS_SALES_FEED_V1.md`.
- Added Prospect-to-Revenue Workflow v1 for one selected prospect, with stable Prospect IDs, persistent validation, inspection, workflow, recovery, and Brian-review state.
- Added menu and Prospect Workspace actions to validate, prepare, resume, review, approve for manual outreach, or request changes.
- Added Activity Feed correlation by Prospect ID and workflow operation key.
- Added deterministic workflow safety coverage and operator documentation.
- Reconciled legacy Next Action validation with the canonical review and sent-confirmation actions so workflow state cannot fall back to `Send Intro Email`.
- Cleared stale approval notes whenever preparation re-enters `Needs Brian Review`.

### Safety

- Canonical lifecycle writes use `Lead Found -> Executive Brief Sent -> Discovery Meeting Scheduled -> Digital Business Assessment -> Improvement Plan Sent -> Project Started -> Client`; legacy stored lifecycle and Next Action values normalize to these names without rewriting historical records.
- `Website Audit Tool API` is the internal technical evidence-service identity. Historical `Website Audit Tool` and `Website Audit` evidence values, legacy lifecycle aliases, internal function/schema names, and legacy package filenames remain supported only where compatibility requires them.
- Prospect preparation reuses the established Website Audit Tool API, Drive/PDF, and exact-match Gmail draft engines.
- Added Script Property authentication through `HEADQUARTERS_SALES_FEED_TOKEN`, timing-resistant token comparison, generic failure responses, opaque action identifiers, and a no-write feed boundary.
- Preparation never sends email and never advances confirmed CRM Status.
- Explicit approval records Brian's decision but still requires manual Gmail sending and the existing sent-confirmation action.

### Acceptance

- Completed live disposable-workbook acceptance for Headquarters Sales Feed v1, covering authenticated web-app transport, exact contract and freshness, workbook reconciliation, privacy, repeated-request determinism, and source-range mutation safety. Production remained untouched.
- Reconciled the apparent disposable `BusinessSnapshotIntake.gs` source drift: the deployed acceptance source is byte-for-byte identical to current authoritative upstream, and the discrepancy was a stale local checkout rather than deployment divergence.
- Completed a live disposable-workbook one-prospect run covering validation, verified audit reuse, deliverable reconciliation, exact-match Gmail draft update, Prospect Workspace review visibility, explicit approval, Activity Feed correlation, and idempotent resume.
- Confirmed preparation and approval sent no email and did not advance CRM Status.
- Verified Gmail contains one exact canonical recipient/subject draft; a separate historical mixed-case `LLc` subject remains a distinct legacy draft and was not modified or deleted.

All notable Business Optimization Platform changes are tracked here.

## [1.0.0-rc] - Unreleased

Build `2026.07.20-rc`. This is a release candidate, not production-ready or released. Final live acceptance, release sign-off, and production approval remain required.

### Added

- Added a deterministic Executive Business Intelligence pipeline for business discovery, normalized evidence, contextual analysis, evidence-linked opportunity prioritization, rules-based editorial review, personalized narrative, and fail-safe consultant-review status.
- Connected grounded EBI output to existing Digital Business Assessment and Executive Snapshot sections and previews through the existing in-memory `prospect + reportFile` boundary without changing spreadsheet schemas, public APIs, lifecycle semantics, or deployment targets. Improvement Plan rendering remains on its legacy path until reviewed assessment evidence can be safely reused.
- Added four grounded industry fixtures, an insufficient-evidence fixture, a metadata-only guard, and regression tests for profile/narrative differentiation, evidence linkage, supported strengths, fallback behavior, adjacent-section duplication, internal terminology, focused priorities, generic filler, and consultant-review defaults.
- Added `npm run acceptance:ebi` to regenerate an inspectable synthetic fixture comparison under `test-output/` without treating fixture output as live acceptance evidence.
- Added `docs/EXECUTIVE_BUSINESS_INTELLIGENCE_ENGINE.md` with schemas, evidence/confidence rules, failure behavior, integration points, and the future approved-AI adapter boundary.

### Fixed

- Reconciled the production-only Headquarters Sales Feed and configured client-Drive-root/duplicate-folder protections into authoritative Git source, with an exact pre-Gold rollback snapshot retained separately.
- Added a Prospect-to-Revenue Gold Standard preflight that validates and builds all three client-facing document plans before validation state, Activity, Drive, Gmail, Dashboard, or workbook mutation.
- Added a production deployment inventory guard that clones the live Apps Script project read-only and refuses a push when remote-only source files are absent from Git.

- Added a fail-closed Gold Standard evidence gate at the authoritative client-deliverable boundary. Unstructured legacy Notes/Summary prose, numeric audit scores, score-derived opportunity labels, placeholder priority titles, duplicated observation/recommendation text, unsupported generic impacts, and findings without traceable evidence can no longer create client PDFs.
- Made Gold Standard finding, recommendation, and action counts evidence-driven; omitted unsupported Preserve What Works content; required every Improvement Plan action to retain exact recommendation lineage; and blocked operator generation before Drive or workbook mutation when reviewed evidence is insufficient.
- Forced solid print-color treatment for the Executive Brief Focused Priorities and Recommended Next Step surfaces while preserving the approved Gold Standard layout.

- Normalized client-visible business-name suffixes to `LLC` across the Executive Snapshot, Digital Business Assessment, Improvement Plan, and both outreach messages; unified Snapshot service terminology on `Digital Visibility & Conversion Improvement Package`; and made incomplete-evidence service language explicitly preliminary pending discovery.
- Reflowed the Digital Business Assessment so the Improvement Roadmap divider stays with Business Impact, heading keep rules no longer force unintended standalone pages, and Quick Wins, roadmap, checklist, and service-package sections use a more intentional page sequence.
- Completed live disposable-workbook artifact acceptance hardening: normalized structured screenshot evidence before filtering, removed unverified score/confidence/severity leakage from the Executive Snapshot, Assessment, and Improvement Plan, qualified unsupported findings as discovery items, and kept professional/B2B classification consistent across all four deliverables.
- Corrected Improvement Plan PDF pagination so the Timeline heading clears the repeating page header, remains with its first timeline item, and preserves the professional five-page layout without blank pages or orphaned headings.
- Added regression coverage for incomplete-evidence client language, structured screenshot evidence, unverified legacy summary metrics, discovery-qualified recommendations, duplicated final headings, and page-top-safe Timeline rendering.
- Expanded the production deployment gate to rerun the EBI regression and deployment-safety suites before any production push.
- Made evidence state item-specific across EBI, assessment findings, proof, recommendations, roadmap, Improvement Plan, and outreach; unknown or incomplete items are omitted from definitive client claims while explicitly verified siblings remain eligible.
- Added one shared business-classification context for professional/B2B, local-service, nonprofit, and neutral audience language across reports, packages, roadmaps, final steps, and outreach.
- Prevented low-confidence outreach and Improvement Plans from listing unsupported prospect-note findings, using a preliminary discovery-confirmation state when no verified findings exist.
- Forced the Improvement Roadmap section to a clean PDF page with heading/first-block keep rules, preventing orphan headings and clipped first cards, and removed repeated final discovery-action wording.
- Unified visible deliverable score handling through one report score-context helper so incomplete inspection data and unsupported zero scores render `Not verified` without critical severity in the Digital Business Assessment, Executive Snapshot PDF/preview, and Improvement Plan.
- Preserved the legacy Improvement Plan architecture while making its fallback language business-context safe for professional/B2B, supported local-service, nonprofit, and neutral records.

- Added an inspection-confidence safeguard that suppresses definitive scores and severity labels when execution is incomplete or an unsupported zero lacks structured evidence; the same safeguard now protects outreach copy.
- Replaced the Digital Trust Checklist's truthy default logic with explicit `PASS`, `FAIL`, `UNKNOWN`, and client-visible `Not Verified` states derived from a shared normalized evidence contract.
- Sanitized semantic EBI inputs so internal review markers cannot become audience, service, geography, strength, recommendation, or narrative content; low-confidence/review-required observations no longer create client opportunities.
- Added professional-services classification and buyer context for business consulting and digital optimization firms, preventing unsupported local SEO, phone-hours, and service-area assumptions.
- Tightened PDF keep-together rules so compact dividers and section headings stay with the first content block and roadmap/cards avoid cross-page clipping.
- Added the malformed Rogers Holdings LLC live-acceptance regression fixture with incomplete inspection, mixed missing/unknown signals, internal metadata, professional-services evidence, outreach, checklist, and pagination assertions.
- Kept Executive Business Intelligence workflow status and diagnostics internal, removed repeated finding/recommendation text from adjacent narrative sections, required observed report evidence before personalization, recognized common “does not” gap wording, added clean insufficient-evidence fallbacks, and preserved legacy Improvement Plan content until reviewed assessment evidence can be safely reused without a contract change.
- Restricted Reset Test Data and Reset Demo Data to Developer Mode in the System menu and added fail-closed runtime guards that block direct execution before destructive work when Developer Mode is disabled.
- Added a non-mutating Developer Mode read path for menu construction and reset authorization; it reads only the existing Settings sheet and never creates or repairs workbook content.
- Removed the unused anonymous web-app declaration from `appsscript.json`; no `doGet` or `doPost` handler exists in the authoritative Apps Script source.
- Reduced production diagnostic logging so Website Audit Tool responses, prospect contact details, Drive URLs, and Drive file identifiers are not written to execution logs; retained privacy-safe status and count diagnostics.

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

- Added the weak-evidence North Point Fitness regression, final-boundary score suppression, recommendation-integrity, placeholder-title, missing-lineage, variable-count, strength-omission, distinct action-mechanics, fail-closed operator-ordering, and authoritative print-style checks while retaining the Harbor Light 1/6/4 regression.

- Added deterministic validation for anonymous web-app removal, developer-only reset menu visibility, direct-execution reset guards, and non-mutating Developer Mode reads.
- Added deterministic deployment safety coverage for target rejection/selection, dirty-tree and confirmation rejection, configuration restoration after successful and failed pushes, and prevention of implicit production deployment.
- Expanded deterministic Gmail coverage for first-run creation, exact-match reuse across all three public workflows, ambiguous attachment persistence, single folder-link fallback, multiple-match rejection, and success-evidence ordering.
- Expanded deterministic audit rendering coverage for Audit Source validation repair, strict provenance eligibility, production field validation, narrative readiness, and Drive-file versus Gmail activity wording.
- Added deterministic audit acquisition/local rendering, evidence preservation, missing endpoint, placeholder rejection, Gmail draft retry, and Health Check warning coverage via `npm run test:audit-rendering`.
- Added deterministic transition-matrix, lifecycle normalization, artifact-label preservation, and legacy Next Action compatibility tests via `npm run test:lifecycle`.
- Added deterministic manual restoration, Calendar identity/conflict, persisted Client/Project verification, ambiguity, and partial-retry regression coverage.

### Validation

- `npm run status:acceptance` and `npm run status:production` passed.
- `npm run validate` passed for 24 authoritative Apps Script files.

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
