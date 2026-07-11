# CRM Lifecycle Final B1 Correction Summary

Date: 2026-07-10  
Scope: focused corrections required by `CRM_LIFECYCLE_FINAL_REVIEW.md`  
Deployment: not performed  
Commit: not performed

## Readiness statement

The final focused correction pass is **ready for another independent review**. The required local commands pass. This statement does not approve production deployment: live Apps Script, Google Sheets, Calendar, Drive, trigger, concurrency, and failure-injection acceptance tests remain mandatory in a disposable production-workbook copy.

## Changed files

Files changed in this final correction pass:

- `Menu.gs`
- `CalendarEngine.gs`
- `DriveEngine.gs`
- `SheetHelpers.gs`
- `scripts/test-crm-lifecycle.js`
- `docs/SALES_JOURNEY.md`
- `CHANGELOG.md`
- `PROJECT_MEMORY.md`
- `CRM_LIFECYCLE_FINAL_CORRECTION_SUMMARY.md` (new)

The earlier uncommitted truthfulness and correction-pass changes remain present and were not reverted.

## Exact blockers corrected

### Manual Status edits without reliable prior state

- Unsupported manual edits now fail closed.
- A single Status edit with neither `e.oldValue` nor a durable snapshot clears only the unverified Status cell, re-reads it, and verifies that it is blank.
- A multi-row or adjacent-column paste restores each affected Status cell from that row's verified snapshot. If a row has no snapshot, only its Status cell is cleared.
- Adjacent non-Status cells are never written by lifecycle recovery.
- Every restored or cleared value is re-read and compared with the intended recovery value; verification failure throws and is reported.
- Each unsupported affected row is marked `Reconciliation Required` with details that distinguish verified restoration from cleared/unverifiable prior state.
- Durable snapshots continue to update only after `commitProspectLifecycleRow_` has written and re-read a confirmed transition successfully.

Evidence: `onEdit(e)` and `restoreManualStatusCell_` in `Menu.gs`; snapshot update remains after persisted Status verification in `commitProspectLifecycleRow_` in `SheetHelpers.gs`.

### Exact Calendar meeting identity

- Calendar operation keys now bind prospect identity, requested start, requested end, and calendar identity.
- Blank Prospect ID fallback uses sheet ID plus row identity rather than company name, preventing same-company operation-key collisions.
- A stored event ID is reusable only when the event is non-cancelled, contains the exact lifecycle operation evidence, and has the exact requested start and end timestamps.
- Advanced Calendar private-property matches and CalendarApp description matches are also filtered by exact timestamps.
- Multiple matching events are treated as conflicting evidence and fail closed.
- A stored operation for a different key/time is rejected before event reuse and requires an explicit reschedule/reconciliation workflow.
- Newly created events are re-read and exactly verified before Calendar state becomes `Event Verified` or CRM Status advances.
- Ambiguous or conflicting reconciliation records `Ambiguous; Reconciliation Required`; no blind retry insertion occurs.

Evidence: `buildDiscoveryCalendarOperationKey_`, `reconcileDiscoveryCalendarEvent_`, `calendarEventMatchesOperation_`, `calendarAppEventMatchesOperation_`, `calendarTimesMatch_`, and `getDiscoverySchedulingDecision_` in `CalendarEngine.gs`.

### Persisted Client and Project verification before Status advancement

- Client upserts are followed by a full persisted-table re-read.
- Client verification requires exactly one identity match and verifies Client ID, normalized company, website when present, and expected `Onboarding` or `Active` status.
- Project upserts are followed by a full persisted-table re-read.
- Project verification requires exactly one identity match and verifies Project ID, Client ID/company linkage, service, and expected persisted project status.
- Zero matches, duplicates, ambiguous matches, or field mismatches throw before `applyConfirmedProspectTransition_` is called.
- The surrounding client/project operation handler records `Reconciliation Required` and truthfully reports the prospect's re-read Status.
- Same-stage retries still rerun idempotent upserts and both verification gates, allowing incomplete records to be repaired without bypassing persistence checks or intentionally creating duplicates.

Evidence: `verifyPersistedClientRecord_` and `evaluatePersistedClientMatches_` in `DriveEngine.gs`; `verifyPersistedProjectRecord_` and `evaluatePersistedProjectMatches_` in `SheetHelpers.gs`; both gates run in `convertWonProspectToClient_` before the lifecycle commit.

### Durable operation identity

- Lifecycle and Calendar operation-key fallback identity now uses sheet ID plus row number when Prospect ID is blank instead of company alone.
- This prevents two same-company rows without Prospect IDs from sharing keyed lifecycle/activity evidence during the current serialized workflow.

Evidence: `buildLifecycleOperationKey_` in `SheetHelpers.gs` and `buildDiscoveryCalendarOperationKey_` in `CalendarEngine.gs`.

## Deterministic regression tests added

`npm run test:lifecycle` now additionally covers:

- missing prior Status recovery by clearing the unverified cell;
- restoration from a valid durable snapshot;
- failed post-restoration verification;
- multi-row Status restoration behavior;
- adjacent-column preservation;
- stored Calendar operation with a different key even when an event was found;
- exact start/end/key Calendar matching;
- mismatched Calendar start;
- mismatched Calendar end;
- conflicting Calendar operation key;
- exact-time Calendar retry reuse;
- missing Client persisted re-read;
- duplicate/ambiguous Client lookup;
- verified Client identity/status;
- missing Project persisted re-read;
- duplicate/ambiguous Project lookup;
- verified Project linkage/status;
- partial Project verification failure followed by successful retry verification.

The suite continues to exhaustively test the approved transition matrix, Nurture reactivation exception, terminal stages, artifact-label preservation, legacy Next Action remapping, and Calendar scheduling decisions.

## Validation results

Final commands run against the current uncommitted candidate:

- `git diff --check`: **passed**.
- `npm run status`: **passed**; clasp and `.clasp.json` detected, authoritative source remains `.gs`, and subdirectories remain skipped.
- `npm run validate`: **passed for 23 Apps Script files**; parsing, duplicate function/global checks, and menu-target validation passed. Non-authoritative root `.js` differences were reported and ignored as designed.
- `npm run test:lifecycle`: **passed**.

## Remaining live-service risks

- Advanced Calendar and CalendarApp event-ID interoperability, private extended-property queries, exact timestamp serialization, invitation delivery, and ambiguous timeout recovery must be verified live.
- Concurrent scheduling must prove that the document lock plus exact reconciliation produces no more than one invitation.
- Simple/installable `onEdit(e)` trigger permissions, UI notification availability, undo/autofill event shapes, and physical restoration behavior must be tested in the bound workbook.
- Document Properties snapshots remain keyed by sheet ID and row number; row movement/sorting behavior and the production workbook's operating practices require live validation.
- Google Sheets has no cross-sheet transaction. Failure injection must verify Client/Project partial-write repair, duplicate detection, workspace/follow-up preparation, final prospect commit restoration, and same-stage retries.
- Existing duplicate or conflicting Client/Project data will now deliberately block conversion and require operator reconciliation; representative production-copy data must be tested.
- Added reconciliation headers must be checked against protected ranges, filters, formulas, formatting, validation, named ranges, and external integrations.
- Drive workspace creation, Activity Feed/follow-up idempotency, dashboard refresh behavior, and service quotas remain live acceptance concerns.

## Independent review recommendation

**Yes — the patch is ready for another independent code review.**

It is not yet approved for production deployment. If independent review confirms these controls, the next step is the exact disposable-workbook live acceptance gate in `CRM_LIFECYCLE_FINAL_REVIEW.md`, with particular emphasis on manual paste recovery, exact-time Calendar retries, concurrent invitations, and forced Client/Project persistence failures.
