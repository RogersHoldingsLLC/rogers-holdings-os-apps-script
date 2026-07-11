# Executive Verdict

**Reject**

The patch is materially safer and more truthful than the original implementation, and all four required local commands pass. However, it is not yet safe enough to proceed to controlled live acceptance testing because a manual Status paste can leave an unverified, falsely advanced lifecycle state, and Calendar retry reconciliation can associate a prior event with a different requested meeting time. Client and Project writes are also not actually re-read and verified before Status advancement.

The deterministic suite validates the transition matrix, normalization rules, and a pure Calendar decision helper, but it does not exercise lifecycle commit/restore behavior, manual-edit recovery, Calendar event reconciliation, client/project persistence verification, or failure-order retries. Live testing should validate corrected runtime behavior; it should not be used to discover already-demonstrable state-integrity defects.

Required command results on 2026-07-10:

- `git diff --check`: passed.
- `npm run status`: passed.
- `npm run validate`: passed for 23 authoritative Apps Script files; menu targets, duplicate functions, and duplicate globals passed. Non-authoritative root `.js` differences were reported and correctly ignored.
- `npm run test:lifecycle`: passed.

# Confirmed Corrections

## Prior blocker: artifact and draft workflows falsely advanced lifecycle Status

**Fully corrected in the reviewed callers.** Executive Snapshot generation, audit generation/application, full-package generation, Gmail draft creation, assessment-package draft creation, and Improvement Plan generation no longer write confirmed lifecycle stages. They now update artifact evidence and/or the next explicit confirmation action. Evidence: `AuditEngine.gs`, `GmailEngine.gs`, and `PdfEngine.gs`.

## Prior blocker: Calendar creation had no durable idempotency evidence

**Partially corrected.** The patch adds a document lock, deterministic operation key, Calendar operation state, stored event ID, Advanced Calendar private extended property, fallback description marker, and a fail-closed ambiguous state. Those are substantive corrections. It is not fully corrected because stored-ID reconciliation does not verify that the found event belongs to the current operation key or requested time; see Remaining Defect D2.

## Prior blocker: Status could be committed before Client and Project prerequisites

**Partially corrected.** Client and Project upserts, workspace preparation, and the Client welcome follow-up occur before the final prospect lifecycle commit. Closed Date is included in the final row write. However, the upserts are trusted from locally constructed return values rather than re-read and verified from persisted rows; see D3.

## Prior blocker: final lifecycle commit could leave falsely advanced Status and make an unverified rollback claim

**Corrected for the controlled commit helper.** `commitProspectLifecycleRow_` writes the full prospect row once, re-reads Status, attempts restoration on failure, re-reads the restored Status, and claims restoration only when that read matches the prior stage. If restoration cannot be verified it records `Reconciliation Required`.

This correction does not make manual edits safe when the prior value is unavailable, because the edit has already been applied before `onEdit(e)` runs; see D1.

## Prior blocker: reconciliation markers were absent or transient

**Fully corrected at the prospect-row level.** Additive Lifecycle and Calendar operation fields persist keys, state, details, confirmation time, and event ID. `Reconciliation Required` includes an operator-readable reason. These markers are durable sheet data and are visible without inspecting logs.

## Prior blocker: same-stage retry exited without repairing downstream effects

**Corrected for explicit lifecycle actions.** `applyConfirmedProspectTransition_` checks the operation marker and reruns follow-up/activity reconciliation unless the matching operation is already complete. Client/project explicit actions rerun prerequisite upserts before same-stage reconciliation. Manual same-value edits still return before reconciliation, so operators must use the matching explicit action rather than edit Status again.

## Prior blocker: rollback and failure messages were factually unsafe

**Fully corrected in the reviewed controlled-operation paths.** The commit helper distinguishes verified restoration from unverified restoration. Client/project failure handling re-reads and reports the actual prospect Status.

## Prior blocker: manual Status editing fabricated `Lead Found`, corrupted pasted ranges, or swallowed failures

**Partially corrected.** Single-cell changes use the strict validator and locking. Adjacent columns are not overwritten. Known snapshots are restored one Status cell at a time for multi-cell edits. Missing `oldValue` no longer defaults to `Lead Found`, and failures are surfaced through an operator notification plus reconciliation details. Rows without snapshots are not restored, however, leaving the pasted Status in place; see D1.

## Prior blocker: transition rules were contradictory or incomplete

**Fully corrected.** The encoded matrix and `docs/SALES_JOURNEY.md` agree: active stages through Improvement Plan Sent may advance one stage or move to Nurture/Lost; Project Started may move only to Client; Client and Lost are terminal; and Nurture re-entry requires the explicit reactivation option and returns to Lead Found. Project Started cannot move to Nurture or Lost.

## Prior blocker: legacy values could be silently normalized into confirmed events

**Fully corrected.** Unknown legacy Status values remain unchanged. Artifact/draft/audit/proposal aliases no longer normalize into confirmed stages. Legacy `Convert to Client` and `Start Project` Next Action values map to `Record Improvement Plan Outcome`, an explicit confirmation workflow rather than a lifecycle write.

## Prior blocker: no non-mutating legacy inventory

**Fully corrected.** `auditLegacyLifecycleValues` reads Status and Next Action values and displays findings without sheet writes or Activity Feed logging.

## Prior blocker: no deterministic regression suite

**Partially corrected.** The new suite exhaustively checks all pairs in the transition matrix, explicit Nurture re-entry, artifact-label preservation, legacy Next Action mapping, and basic Calendar decision states. It is useful but does not meaningfully exercise commit/rollback, onEdit, persisted upsert verification, keyed Activity Feed/follow-up behavior, or retry orchestration; see D4.

# Remaining Defects

## D1 — Critical — unsupported manual edits can leave Status falsely advanced

**Evidence:** In `Menu.gs`, `onEdit(e)` runs after Sheets has applied the edit. For a single-cell edit with no `oldValue` and no Document Properties snapshot, the handler marks reconciliation and returns without restoring or clearing the new Status. For a multi-cell paste, rows with no snapshot are likewise marked but their newly pasted Status values remain. This directly violates the requirement that lifecycle Status cannot remain falsely advanced and affects new/legacy rows that have never passed through a controlled lifecycle commit.

**Affected file:** `Menu.gs`.

**Exact correction required:** Before accepting manual Status editing, maintain a durable prior-stage source that exists for every legacy/current row, or reject Status edits at the sheet-protection/UI layer. When prior state is unavailable, restore only the Status cell to a demonstrably safe captured value; if no prior value can be demonstrated, do not leave the requested confirmed stage in place. For multi-cell edits, restore every affected Status cell from a pre-existing durable row snapshot and leave adjacent columns untouched. Add deterministic tests for single-cell missing `oldValue`, vertical paste, Status-plus-adjacent-column paste, and rows without snapshots.

## D2 — High — Calendar stored-ID reconciliation can bind the wrong event to a new operation

**Evidence:** `createDiscoveryCall` calculates the newly requested operation key, then calls `reconcileDiscoveryCalendarEvent_` with the previously stored event ID. The stored-ID branch returns any non-cancelled event without checking its private operation property, description marker, start time, end time, attendee, or requested operation key. Because `getDiscoverySchedulingDecision_` returns `use-existing` whenever `matchedEvent` is true, it does so before checking for a different stored key. A retry after event creation but failed lifecycle commit can therefore enter a different date/time, reuse the old event, overwrite the Calendar operation key with the new key, and commit the new Discovery Date even though the actual event is at the old time.

**Affected files:** `CalendarEngine.gs`, `scripts/test-crm-lifecycle.js`.

**Exact correction required:** Reconcile a stored event ID only after verifying it belongs to the stored/current operation and matches the intended start/end (and prospect/guest where practical). Evaluate operation-key conflict before treating an event-ID lookup as a match. If the stored key differs from the requested key, fail closed and require reconciliation or explicit rescheduling; never rewrite the key or Discovery Date around the old event. Add a deterministic case where `matchedEvent=true` but the stored key differs, plus live tests for failed post-insert commit followed by same-time and different-time retries.

## D3 — High — Client and Project upserts are not verified before Status advancement

**Evidence:** `upsertClientRecordFromProspect_` and `upsertProjectFromClient_` return IDs constructed from their in-memory row arrays immediately after `setValues`. `convertWonProspectToClient_` checks only that those returned strings are nonblank. It re-reads the Client row to build the Project model, but does not verify the persisted Client ID/identity/status against the requested record, and it does not re-read the Project row at all. Thus the code does not meet the stated correction claim that both upserts are verified before Status advances.

**Affected files:** `DriveEngine.gs`, `SheetHelpers.gs`.

**Exact correction required:** After each upsert, re-read the target row and verify the persisted ID plus stable identity fields (Client: Client ID and company/website; Project: Project ID, Client ID/company, service, and nonterminal intended record). Throw and retain `Preparing Prerequisites`/`Reconciliation Required` before lifecycle commit if verification fails. Tests must simulate a write that returns without persisting the expected ID/value.

## D4 — Medium — deterministic tests do not cover the advertised retry and failure semantics

**Evidence:** `scripts/test-crm-lifecycle.js` loads production functions but asserts only the transition matrix, normalization, and `getDiscoverySchedulingDecision_`. It has no mocks or assertions for lifecycle row commit/restoration, reconciliation markers, same-stage follow-up/activity repair, manual-edit restoration, Calendar reconciliation identity, Client/Project persisted verification, or partial-operation retry deduplication.

**Affected files:** `scripts/test-crm-lifecycle.js`, `package.json`.

**Exact correction required:** Add service-light orchestration tests with fake ranges/sheets/properties for the failure boundaries above, or extract pure planning/verification helpers that can be exhaustively tested. At minimum, reproduce D1–D3 and prove their corrections. Keep live Apps Script tests for service behavior that cannot be represented locally.

## D5 — Medium — operation/activity identity can collide when Prospect ID is blank

**Evidence:** `buildLifecycleOperationKey_` and `buildDiscoveryCalendarOperationKey_` fall back to a normalized company name before row identity. Two prospect rows for the same company with blank Prospect IDs therefore receive the same lifecycle-stage and Calendar-time keys. `lifecycleActivityExists_` searches the entire Activity Feed by that key, so one row can suppress the other row's evidence.

**Affected files:** `SheetHelpers.gs`, `CalendarEngine.gs`.

**Exact correction required:** Ensure every prospect has a durable unique Prospect ID before creating operation keys, or include immutable sheet/row identity in the fallback and persist it. Do not rely on company alone. Add a test with two same-company rows lacking IDs.

# Runtime Risks That Require Live Testing

These are expected live-test risks, not additional proven code defects:

- Advanced Calendar event ID formats and `Calendar.Events.get/list` behavior versus `CalendarApp.getId()` and fallback search behavior.
- Private extended-property query support, CalendarApp description search behavior, invitation count, and ambiguous timeout behavior.
- Simple/installable trigger authorization and UI-notification behavior for `onEdit(e)` in the bound workbook.
- Apps Script lock timing and concurrent double invocation.
- Physical Sheets behavior when a full-row `setValues` fails and restoration is attempted.
- Protected ranges, filters, formulas, formatting, validations, and column permissions after additive headers are appended.
- Cross-sheet failure injection across Clients, Projects, Follow-Ups, Activity Feed, Client Workspace, and dashboard refreshes.
- Drive folder/workspace preparation latency and idempotency.

The fail-closed Calendar ambiguous state is an expected operational tradeoff: when neither API can prove whether an invitation exists, manual reconciliation is safer than automatic reinsertion.

# Data and Migration Risk

Unknown legacy Status values are preserved by normalization and surfaced by the read-only audit. Legacy artifact labels are not silently promoted to confirmed customer events. Legacy `Convert to Client` and `Start Project` values lead to an explicit outcome action and do not themselves advance Status.

The seven additive lifecycle/Calendar headers are appended through named-header helpers, which is structurally compatible with ordinary tables and avoids fixed-position writes. Their compatibility with production-copy filters, array formulas, protected ranges, named ranges, formatting, and integrations remains a live-test requirement.

Document Properties snapshots are not a migration strategy: existing rows generally lack snapshots until a controlled lifecycle commit occurs. That gap causes D1. Snapshots are also keyed by sheet ID and row number, so row insertion, sorting that moves record contents, deletion, or reuse can detach a snapshot from the prospect it was intended to describe. A durable snapshot should be tied to Prospect ID in sheet data or another identity-stable store.

Lifecycle markers are readable and actionable, but a single set of marker fields represents only the latest operation. This is adequate for a serialized forward lifecycle if operation identity is unique; D5 must be corrected for blank Prospect IDs. Calendar operation evidence is sufficient in shape but not yet sufficient in verification logic because of D2.

Client/project partial operations are designed to recover through upsert rather than duplicate creation. Matching by company/website and client/company/service substantially reduces duplication risk, but persisted identity verification is still missing (D3), and conflicting pre-existing records require live testing.

Follow-up idempotency matches an open item by prospect/client/company plus follow-up type and checks the expected item before completing older open items. Primary lifecycle Activity Feed idempotency is keyed by operation text. Those approaches are reasonable once operation identity is unique. Ancillary log entries remain less strictly keyed, so live failure injection should confirm that retries do not create misleading duplicate operational activity.

No new external service, credential store, secret, email recipient expansion, or OAuth scope change was found in the patch. The new operation details and Calendar description contain operational identifiers and prospect context already used by the workflow. Console error/warning output may contain service error messages but no newly introduced deliberate secret logging was found. The principal permissions risk is runtime trigger/service authorization, which requires live verification.

# Live Acceptance Gate

Do not begin this gate until D1–D3 are corrected and deterministic regression coverage for those corrections passes.

Minimum disposable-workbook acceptance tests:

1. Run System Health Check and verify the seven additive headers appear without breaking formulas, formatting, filters, protections, validation, named ranges, dashboards, or integrations.
2. Inventory representative legacy Status and Next Action values. Verify the audit performs no writes and no Activity Feed entry, unknown values remain byte-for-byte unchanged, and legacy Next Actions do not advance Status.
3. For every matrix edge, execute each allowed transition and representative disallowed jump. Verify Project Started cannot move to Nurture/Lost, Client/Lost are terminal, and Nurture re-entry occurs only through explicit Reactivate to Lead Found.
4. Generate/regenerate every artifact and Gmail draft. Verify Status is unchanged and Activity Feed wording describes generation/draft creation rather than a confirmed customer event.
5. Repeat every explicit confirmation. Verify one expected open follow-up, one keyed primary lifecycle activity, correct Next Action/Last Activity/confirmation evidence, and no duplicate downstream records.
6. Test manual Status typing, clearing, single-cell paste with and without `oldValue`, vertical multi-row paste, autofill, undo, and a paste spanning Status plus adjacent columns. Verify invalid/unverifiable changes never remain in Status, adjacent cells are untouched, and post-effect failures are restored or durably repairable.
7. Schedule Discovery through Advanced Calendar and CalendarApp fallback. Test concurrent/double invocation, failure immediately after insert, ambiguous insert response, same-time retry, and different-time retry. Verify exactly one invitation and that stored key, event ID, Discovery Date, actual event time, attendee, and Status agree.
8. Force failure at every client/project boundary: Client write and verification, Project write and verification, workspace preparation, client follow-up, final prospect commit, lifecycle follow-up, lifecycle activity, ancillary activity, and refresh. After retry, verify one Client, one active Project, correct Client status, correct prospect Status/Closed Date, one required follow-up/activity effect, and no unmarked partial state.
9. Test matching and conflicting pre-existing Client/Project rows, plus two same-company prospects. Verify no cross-row operation collision or duplicate record.
10. Run every menu target and public compatibility entry point, then refresh dashboards and verify metrics reflect confirmed events only.
11. Re-run `git diff --check`, `npm run status`, `npm run validate`, and `npm run test:lifecycle`; all must pass on the exact candidate tested.

# Deployment Recommendation

**Is the patch ready for a disposable workbook test?** No. Correct D1–D3 first. A narrowly scoped developer reproduction may be used to validate those fixes, but the formal controlled live acceptance run should not start with known state-integrity defects.

**Is it ready for production deployment?** No.

**Single next action:** Correct manual-edit restoration, Calendar event-to-operation verification, and persisted Client/Project verification; extend deterministic tests to prove those corrections; then submit the unchanged candidate for a fresh independent review before disposable-workbook acceptance testing.
