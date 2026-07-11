# CRM Lifecycle B1 Correction Summary

Date: 2026-07-10  
Scope: focused pre-deployment corrections required by `CRM_LIFECYCLE_PATCH_REVIEW.md`  
Deployment: not performed  
Commit: not performed

## Readiness statement

The correction pass is **ready for another independent review**. Local static validation and deterministic lifecycle tests pass. Live Google Sheets, Calendar, Drive, and failure-injection tests are still required before deployment approval.

## Changed files

Lifecycle correction implementation:

- `CalendarEngine.gs`
- `Config.gs`
- `DriveEngine.gs`
- `Menu.gs`
- `SheetHelpers.gs`
- `package.json`
- `scripts/test-crm-lifecycle.js` (new)

Documentation and release continuity:

- `README.md`
- `PROJECT_MEMORY.md`
- `docs/SALES_JOURNEY.md`
- `CHANGELOG.md`
- `CRM_LIFECYCLE_CORRECTION_SUMMARY.md` (new)

The earlier truthfulness patch remains present in `AuditEngine.gs`, `GmailEngine.gs`, `PdfEngine.gs`, `DemoData.gs`, and the documentation above. Its artifact-versus-confirmed-event separation was preserved.

## Exact defects corrected

### Discovery scheduling idempotency

- Added a document lock around Calendar reconciliation, creation, event persistence, and lifecycle confirmation.
- Added durable prospect-row fields for Calendar operation key, Calendar event ID, and Calendar operation state.
- Calendar operations use a deterministic prospect/date-time operation key.
- Advanced Calendar events carry the operation key as a private extended property; fallback Calendar events carry it in the description.
- Retries look up the stored event ID and operation key before insertion.
- A verified or ambiguous prior operation blocks a different invitation until reconciled.
- If Calendar creation throws after a potentially successful insert, the workflow searches for the matching event. If none can be verified, it marks the result ambiguous and does not blindly insert again.
- Discovery Date is included in the controlled lifecycle row commit.

### Failure-safe lifecycle transitions

- Replaced direct transition orchestration with validation, final row commit, and downstream reconciliation phases.
- Added durable lifecycle operation key, state, details, and confirmation timestamp fields.
- Status, Next Action, Last Activity, lifecycle evidence, and operation state are written together in one prospect-row `setValues` call.
- The persisted Status is re-read and verified.
- A failed final write attempts to restore the captured prior row and verifies the restored Status.
- If restoration cannot be verified, the row is marked `Reconciliation Required`; messages do not claim rollback unless it was verified.
- Follow-up and primary lifecycle Activity Feed effects are reconciled idempotently.
- Same-stage confirmation retries inspect the operation marker and repair incomplete effects instead of always exiting.
- Lifecycle Activity Feed evidence carries the operation key and is checked before logging again.
- Expected open follow-ups are detected before older tasks are completed, preventing retry-driven completion/recreation loops.

### Client/project conversion recovery

- Client and Project records remain upserts.
- Client ID and Project ID are verified before prospect Status advances.
- Client/project operations write a durable `Preparing Prerequisites` marker before cross-sheet work and a reconciliation marker on failure.
- Required Client follow-up and Client Workspace state are prepared before the final prospect lifecycle commit.
- Closed Date is included in the final `Client` row commit.
- Repeating a `Project Started` or `Client` action reruns idempotent prerequisite preparation and lifecycle reconciliation.
- Failure alerts re-read and report the actual current CRM Status instead of claiming it was unchanged.

### Manual Status edit enforcement

- Added document locking around supported manual Status edits.
- Only single-cell Status edits are processed as transitions.
- Multi-cell edits restore only known prior Status snapshots, never overwrite adjacent cells, and flag rows without a known snapshot for reconciliation.
- Missing `e.oldValue` never defaults to `Lead Found`; a durable Status snapshot is used when available, otherwise reconciliation is required.
- The transition uses the approved validator and controlled lifecycle commit.
- The persisted Status is re-read and verified after handling.
- Operator-facing messages identify unsupported edits, unavailable prior state, failed verification, and reconciliation requirements.

### Strict transition matrix

- Encoded the approved edges exactly:
  - active stages through `Improvement Plan Sent` may move to their next stage, Nurture, or Lost;
  - `Project Started` may move only to `Client`;
  - `Client` and `Lost` are terminal/idempotent;
  - direct Nurture re-entry is blocked.
- Added **Reactivate Nurtured Prospect**, which requires explicit operator confirmation and re-enters at `Lead Found` only.
- `Project Started -> Nurture/Lost` and `Lost -> Nurture` are blocked.

### Legacy lifecycle safety and compatibility

- Added **System -> Audit Legacy Lifecycle Values**.
- The audit inventories row number, company, field, and unrecognized Status/Next Action value in a read-only modal.
- The audit does not modify the workbook or Activity Feed.
- Artifact/customer-event aliases remain removed.
- Corrected `normalizeProspectStatus_` so unknown legacy values remain unchanged instead of falling back to the first allowed value (`Lead Found`).
- Legacy `Convert to Client` and `Start Project` Next Actions now normalize to `Record Improvement Plan Outcome`, which is an explicit confirmation action and does not change Status.

## New reconciliation behavior

Lifecycle rows now expose these additive fields:

- Lifecycle Operation Key
- Lifecycle Operation State
- Lifecycle Operation Details
- Lifecycle Confirmed At
- Calendar Operation Key
- Calendar Event ID
- Calendar Operation State

Normal lifecycle completion ends with `Lifecycle Operation State = Complete`. A committed Status whose downstream follow-up/activity effect failed is retained truthfully and marked `Reconciliation Required`; repeating the same explicit action repairs the missing effect. A failed final row commit restores and verifies prior values where possible. Calendar ambiguity is recorded separately and prevents another invitation until the existing operation is found or manually reconciled.

Client/project partial work is intentionally recoverable: prerequisite records can exist before prospect Status advances, but the durable marker identifies the incomplete operation and the same action upserts and verifies those records on retry.

## Test coverage added

`npm run test:lifecycle` executes deterministic Node tests against the authoritative Apps Script functions for:

- every pair in the strict transition matrix;
- same-stage idempotency;
- blocked Nurture re-entry and explicitly authorized Nurture-to-Lead re-entry;
- blocked Project Started-to-Nurture/Lost edges;
- removal of artifact/draft/audit/proposal/legacy terminal aliases from pipeline normalization;
- preservation of unknown legacy Status values without mutation;
- legacy `Convert to Client` and `Start Project` Next Action remapping;
- Calendar retry decisions for new, verified, ambiguous, and conflicting operations.

The tests passed locally. Apps Script service behavior and physical sheet rollback cannot be fully simulated by the local test harness and remain live-test requirements.

## Validation results

Final requested commands:

- `git diff --check`: **passed**
- `npm run status`: **passed**
  - `clasp` installed
  - `.clasp.json` present
  - authoritative source `.gs`
  - subdirectories skipped
- `npm run validate`: **passed for 23 Apps Script files**
  - source parsing passed
  - duplicate function/global validation passed
  - menu-target validation passed
  - non-authoritative root `.js` differences were reported and ignored as expected

Additional deterministic command:

- `npm run test:lifecycle`: **passed**

## Remaining runtime risks

1. Advanced Calendar and `CalendarApp` reconciliation must be verified live, including event-ID formats, private extended-property queries, invitation behavior, and ambiguous timeout behavior.
2. Apps Script simple-trigger UI and authorization behavior for `onEdit(e)` must be verified in the bound production-copy workbook.
3. `DocumentProperties` Status snapshots exist after controlled lifecycle commits. Pre-existing rows without a snapshot cannot have an unknown multi-cell prior state reconstructed; they are deliberately marked for operator reconciliation instead of guessed.
4. Google Sheets has no cross-sheet transaction. Durable operation markers and idempotent retry reduce this risk, but live failure injection must verify every Client, Project, Follow-Up, Activity Feed, workspace, and final-row boundary.
5. The additive reconciliation headers must be tested against the production workbook's exact protected ranges, filters, formulas, formatting, and column permissions.
6. Activity and follow-up idempotency depends on operation-key text and existing record matching; live tests should cover operator-edited/deleted reconciliation records.
7. Calendar operations deliberately fail closed after an unresolved ambiguous result. Manual reconciliation may be required rather than automatic recovery when Google services cannot confirm whether an invitation was sent.

## Recommended next step

Perform another independent code review, followed by the live test matrix from `CRM_LIFECYCLE_PATCH_REVIEW.md` in a disposable production-copy workbook. Do not deploy until Calendar retry tests, manual edit tests, and forced client/project failure-order tests pass with no duplicate invitations and no unmarked partial lifecycle state.
