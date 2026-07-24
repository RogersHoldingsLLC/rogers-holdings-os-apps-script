# CRM Lifecycle Truthfulness Patch Review

Review date: 2026-07-10  
Scope: current uncommitted changes in the files requested by the release owner, plus callers of modified functions  
Reviewer role: independent senior Apps Script reviewer, QA director, and release engineer

## Executive verdict

**Reject**

The patch materially improves CRM truthfulness: artifact generation and Gmail draft creation no longer advance lifecycle Status, the happy-path lifecycle is explicit, static validation passes, and menu targets resolve. However, Release Blocker B1 is not safely resolved because runtime failure and retry paths can still produce false or incomplete lifecycle state.

Three defects are deployment blockers:

1. Calendar event creation has no durable idempotency key or reconciliation path. An event can be created while the subsequent sheet transition fails, and the next retry can create another event.
2. Client/project conversion and the shared transition helper write Status before all required downstream work is known to have succeeded. Later failures can leave Status advanced while the UI explicitly says it was not changed.
3. `onEdit(e)` does not safely handle pasted/multi-cell Status edits or edits where `e.oldValue` is unavailable. It can validate against a fabricated `Lead Found` prior state, allow an invalid jump, overwrite a multi-cell range with one value during rejection, or swallow a post-edit failure after Status has already changed.

Deployment should remain blocked until these defects are corrected and live Apps Script tests pass.

## Review method and local validation

Reviewed the uncommitted diff and relevant surrounding implementation in:

- `SheetHelpers.gs`
- `Menu.gs`
- `Config.gs`
- `AuditEngine.gs`
- `GmailEngine.gs`
- `PdfEngine.gs`
- `CalendarEngine.gs`
- `DriveEngine.gs`
- `DemoData.gs`
- `README.md`
- `PROJECT_MEMORY.md`
- `docs/SALES_JOURNEY.md`
- `CHANGELOG.md`

Also read the repository release context (`ROADMAP.md` and `VERSION.md`) and inspected all callers found for the modified lifecycle helpers and conversion functions.

Requested commands:

- `git diff --check`: **passed**
- `npm run status`: **passed** (`clasp` installed, `.clasp.json` present, authoritative source is `.gs`, subdirectories skipped)
- `npm run validate`: **passed** for 23 Apps Script files

Validation also reported the existing non-authoritative root `.js` pairs as different and correctly ignored by deployment. No duplicate public functions, duplicate top-level globals, parse errors, invalid menu targets, or broken static references were reported.

These checks are necessary but do not exercise Apps Script service failures, trigger event shapes, concurrent edits, or retry behavior.

## Changed-function inventory

### `SheetHelpers.gs`

- `runDefaultNextAction_`: rejects unknown/unapproved lifecycle stages instead of guessing an action.
- `promptFollowUpOutcome_`: routes confirmed Assessment, Improvement Plan, and Nurture outcomes through the guarded transition helper.
- `openOrCreateClientFromNextAction_`: opens onboarding confirmation for `Project Started`; opens Client Workspace for `Client`.
- `validateProspectStageTransition_`: new lifecycle transition validator and idempotency check.
- `setNextActionForConfirmedStage_`: new confirmed-stage-to-next-action mapping.
- `applyConfirmedProspectTransition_`: new shared transition writer, follow-up sync, activity logger, and idempotency gate.
- `confirmSelectedProspectTransition_`: new public-action confirmation wrapper.
- `confirmExecutiveSnapshotSent`: new public explicit confirmation.
- `confirmAssessmentPresented`: new public explicit confirmation.
- `confirmImprovementPlanSent`: new public explicit confirmation.
- `moveProspectToNurture`: new public explicit confirmation.
- `advanceProspectStage`: retained for compatibility but disables automatic advancement.
- `markProspectWon`: compatibility wrapper now starts accepted-plan/project workflow.
- `markProspectLost`: now uses explicit guarded confirmation.
- `markEmailSent`: compatibility wrapper now confirms Executive Snapshot sent.
- `markFollowUpComplete`: compatibility wrapper now calls `completeFollowUp`.
- `normalizeProspectStatus_`: removes artifact/draft/audit/proposal and broad terminal-state aliases.
- Removed `setSelectedProspectTerminalStage_`.
- `normalizePipelineStage_`: removes artifact/customer-event conflation aliases; retains discovery scheduling aliases.
- `setProspectStatus_`: now validates transitions and returns whether a change occurred.
- `setProspectStatusIfHeader_`: now validates transitions and returns whether a change occurred.
- `updatePipelineDashboardMetrics_`: counts confirmed lifecycle stages separately from generated artifacts/drafts.
- `updateExecutiveDashboardClientSummary_`: reports assessments presented rather than packages sent.

Relevant callers inspected include `runNextAction`, `scheduleNextActionFollowUp_`, `promptFollowUpOutcome_`, `promptImprovementPlanOutcome_`, the compatibility wrappers, `createDiscoveryCall`, `convertWonProspectToClient_`, dashboard builders, follow-up synchronization, Health Check, demo/import row creation, and dropdown repair/validation paths.

### `Menu.gs`

- `onOpen`: replaces ambiguous pipeline actions with explicit lifecycle confirmations.
- `onEdit`: adds transition validation, rollback attempt, next-action/follow-up updates, activity logging, and dashboard refresh for manual Status edits.

### `CalendarEngine.gs`

- `createDiscoveryCall`: pre-validates the transition, blocks already-confirmed retries, creates the Calendar event before confirming Status, and makes discovery-brief generation nonfatal.

### `DriveEngine.gs`

- `convertToClient`: compatibility router based on current confirmed stage.
- `recordImprovementPlanAccepted`: new public accepted-plan/project-start action.
- `completeClientOnboarding`: new public onboarding-completion action.
- `completeProspectClientOperation_`: new confirmation/error wrapper.
- `convertWonProspectToClient`: compatibility wrapper.
- `convertWonProspectToClient_`: creates/upserts client and project before applying the requested CRM transition.
- `upsertClientRecordFromProspect_`: accepts an explicit `Onboarding` or `Active` client status.

### Artifact and message workflows

- `generateAuditPackageForContext_`, `applyWebsiteAuditToolResults_`, `generateExecutiveSnapshot`, `updateFullPackageProspectFields_`, and `runWebsiteAudit` no longer advance lifecycle Status.
- `buildFullProspectPackageSummary_` now instructs the operator to confirm actual sending.
- `sendAuditPackage` logs Gmail draft creation and no longer marks the assessment presented or schedules a presentation follow-up.
- `createOutreachGmailDraft` no longer marks the snapshot sent.
- `generateProposal` and `logProposalGenerated_` no longer mark the Improvement Plan sent and instead point to explicit confirmation.

### Configuration, demo data, and documentation

- `PROSPECT_DROPDOWN_DEFAULTS['Next Action']` adds explicit confirmation/onboarding actions and removes ambiguous conversion actions.
- Demo Client next action changes from `Start Project` to `Follow Up`.
- README, project memory, sales journey, and changelog describe confirmed-event semantics.

## Confirmed acceptance criteria

### Confirmed by static inspection

1. **Artifact generation never changes CRM Status — confirmed for the modified artifact paths.** Executive Snapshot, audit/assessment generation, quick/website audit application, full package generation, proposal modal generation, and discovery brief generation do not intentionally advance Status.
2. **Gmail draft creation never counts as sent — confirmed.** Outreach and assessment draft workflows change operational fields/activity only. They no longer set sent/presented lifecycle stages.
3. **Assessment generation never counts as presented — confirmed.** Assessment generation paths leave Status unchanged and set a presentation-oriented Next Action.
4. **Proposal generation never counts as sent or accepted — confirmed.** Proposal generation sets `Confirm Improvement Plan Sent` and logs generation only.
5. **Primary happy-path transitions match the documented contract — confirmed.** `Lead Found -> Executive Snapshot Sent -> Discovery Meeting Scheduled -> Digital Business Assessment Presented -> Improvement Plan Sent -> Project Started -> Client`.
6. **Ordinary invalid single-step jumps through guarded functions are blocked — confirmed.** The validator returns clear messages and the shared setters enforce it.
8. **Repeated confirmation actions are idempotent after a fully successful transition — confirmed.** Same-stage confirmations return without duplicate activity; accepted-plan and onboarding wrappers also stop on same-stage state.
11. **Modified dashboard counters derive customer-event metrics from confirmed stages/activity — confirmed.** Artifact-generation metrics remain explicitly separate.
12. **Compatibility normalization no longer turns draft/generated/audit/proposal artifact labels into customer events — confirmed.** Removed aliases include `Draft Created`, `Gmail Draft Created`, `Audit Complete`, `Audit Package Sent`, and `Proposal Sent`.
13. **Existing menu actions point to valid functions — confirmed by inspection and validation.** Compatibility public functions remain available.
14. **No duplicate public functions, conflicting globals, parse errors, or statically broken references — confirmed by `npm run validate`.**
17. **No required existing header was renamed or removed — confirmed.** New behavior remains header-based; `Closed Date` and `Discovery Date` continue to be added through existing column helpers where needed.

### Not fully accepted

7, 9, 10, 15, and 16 are not accepted because of the defects and migration risks below. Criterion 8 is accepted only for completed happy-path calls, not ambiguous external-service failure/retry cases.

## Defects or regression risks

### B1-CRITICAL-01 — Calendar retries can duplicate events

`createDiscoveryCall` creates the external Calendar event before persisting `Discovery Meeting Scheduled`. The Calendar insert uses a fresh `Utilities.getUuid()` only for conference creation; it is not a durable business-operation idempotency key. No Calendar event ID is stored on the prospect row, and there is no lookup/reconciliation before retry.

Failure examples:

- Calendar insertion succeeds but Apps Script times out or loses the response.
- Calendar insertion succeeds, then `ensureSheetColumns_`, `applyConfirmedProspectTransition_`, follow-up synchronization, or Activity Feed logging fails.
- Another execution changes Status between pre-validation and transition application.

In these cases, the row can remain pre-discovery while the event exists. Retrying can create a second event and send another invitation. The same-stage check only prevents duplicates when Status was successfully persisted; it does not make event creation itself idempotent.

### B1-CRITICAL-02 — Status can advance before the operation reports failure

`setProspectStatus_` and `setProspectStatusIfHeader_` write Status and then call `syncFollowUpForProspectRow_`. `applyConfirmedProspectTransition_` then updates Next Action/Last Activity and logs Activity Feed. Any failure after the Status `setValue` leaves Status advanced.

This directly affects `completeProspectClientOperation_`: its catch alert says **“CRM Status was not changed”**, but Status may already be `Project Started` or `Client` if follow-up sync, activity logging, Closed Date, client follow-up creation, workspace refresh, or dashboard refresh fails. A retry then appears idempotent and exits, so missing downstream work is not repaired.

The same partial-write risk exists for ordinary confirmation actions: Status may advance without the matching Next Action, activity evidence, or follow-up state.

### B1-CRITICAL-03 — Manual Status edits can bypass or corrupt transition enforcement

`onEdit(e)` assumes one edited cell and uses `e.oldValue`. Google Sheets does not provide a reliable scalar `oldValue` for pasted/multi-cell edits. When absent, the code substitutes `Lead Found`.

Consequences:

- Pasting `Executive Snapshot Sent` over a later-stage row can be accepted as if the row had been `Lead Found`.
- A multi-row or multi-column paste is evaluated using only the range's top-left value.
- On rejection, `e.range.setValue(previousStatus)` can overwrite the entire edited range with a single status and corrupt adjacent or multiple rows.
- Errors after the user edit are only written to `console.error`; the already-entered Status is not restored and the operator gets no recovery message.

Therefore manual edits do not yet reliably enforce the lifecycle contract.

### B1-HIGH-04 — Client/project workflow is recoverable only in some failure orderings

Creating/upserting the Client and Project before advancing CRM Status is directionally correct: a client/project failure normally leaves the prospect stage unchanged, and retries use upsert behavior. However, the operation has no transaction marker or reconciliation routine. It can leave:

- an `Onboarding` client with a project while the prospect remains `Improvement Plan Sent`;
- an advanced prospect while Closed Date, Client follow-up, workspace refresh, or activity evidence is missing;
- a partially updated pre-existing client if project creation fails.

The first state is generally recoverable by retry; the latter states are not reliably repaired because same-stage idempotency exits early.

### B1-HIGH-05 — Side-transition contract is over-broad and undocumented

The validator allows any non-`Client` stage to move to `Nurture` or `Lost`. This includes `Project Started -> Nurture`, `Project Started -> Lost`, and `Lost -> Nurture`. The documentation says Nurture/Lost are confirmed operator outcomes but does not approve these specific edges. If the intended contract is “active prospect stages may exit to Nurture/Lost,” terminal and post-acceptance stages need an explicit edge table. Current logic can produce semantically contradictory client/project records.

### B1-MEDIUM-06 — Follow-up/dashboard updates can be inconsistent after failures

Follow-up synchronization completes existing tasks before creating/updating the new task. If creation fails after completion, the prospect may have no open follow-up. Dashboard refresh is not part of an atomic operation and can fail after lifecycle data changes. This does not necessarily falsify Status, but it can make operational queues temporarily wrong and requires a documented reconciliation action.

### B1-MEDIUM-07 — Next Action compatibility values are stale

`normalizeNextAction_` still maps legacy values to `Convert to Client` and `Start Project`, while those values were removed from the new default allowed list. Depending on the workbook's existing validation list, dropdown repair may leave these values invalid or fall back to a different allowed value. This is not a Status corruption path, but it weakens workbook compatibility and operator guidance.

### B1-LOW-08 — Documentation/version metadata is internally inconsistent

The new changelog entry is dated 2026-07-10 and claims the checks passed, but `VERSION.md` and `PROJECT_MEMORY.md` still describe the release candidate as of 2026-06-25. This does not block lifecycle correctness by itself, but release metadata should be reconciled once code corrections are complete.

## Data migration risks

1. **Legacy Status values are preserved but stranded.** Removing aliases avoids silent conversion of artifact states into customer events, which is correct. However, rows containing `Draft Created`, `Audit Complete`, `Audit Package Sent`, `Proposal Sent`, `Won`, `Active`, or similar values are now unrecognized by the validator and Next Action engine. There is no explicit, reviewed migration/reconciliation workflow for them.
2. **Dropdown repair does not truthfully resolve those legacy statuses.** `normalizeProspectStatus_` now returns the original unknown text when it has no approved mapping. `repairInvalidDropdownValues` can therefore report no change for an invalid legacy Status, while subsequent validation/Next Action behavior remains blocked. This is safer than guessing, but operators need an evidence-based migration queue.
3. **Applying strict validation may make legacy rows harder to edit.** Existing invalid cell contents may remain visible, but manual transition handling cannot infer their last confirmed customer event. They should not be automatically rewritten.
4. **Legacy Next Action values may remain invalid.** `Convert to Client` and `Start Project` are still present in normalization logic but absent from new defaults.
5. **Existing Client/Project rows may conflict with prospect stage.** Retrying a prior partial conversion will upsert by company/website/client/service, but no report identifies mismatched prospect/client/project lifecycle state before deployment.

Required migration behavior: inventory legacy values, classify them without mutation, and require operator confirmation/evidence to assign a confirmed lifecycle stage. Artifact states must never be bulk-mapped to sent/presented/accepted events.

## Error handling and recoverability assessment

Positive findings:

- Invalid guarded jumps generally produce clear operator-facing messages.
- Artifact generation no longer changes Status merely because a file/draft was created.
- Client and project writes are upserts, which improves retry recoverability.
- Discovery brief failure is correctly nonfatal after Calendar success.

Unacceptable findings:

- The client-operation error message can be factually false about whether Status changed.
- `onEdit` swallows failures without restoring state or notifying the operator.
- Calendar success cannot be reconciled when sheet persistence fails.
- Same-stage idempotency suppresses repair of partially completed downstream work.

Criterion 16 is therefore not met.

## Live-test requirements

After corrections, run these tests in a disposable copy of the production workbook with Apps Script advanced Calendar service enabled and disabled where applicable.

### Lifecycle and artifacts

1. For each confirmed stage, run Executive Snapshot, assessment/audit, full package, proposal, PDF regeneration, and Gmail draft workflows. Assert Status is byte-for-byte unchanged and Activity Feed describes generation/draft creation only.
2. Run every explicit confirmation from its valid predecessor; verify Status, Next Action, Last Activity, one Activity Feed entry, and the expected single open follow-up.
3. Repeat every confirmation. Verify no duplicate activity, follow-up, client, project, or external event.
4. Attempt every disallowed forward jump, backward jump, terminal jump, and Nurture/Lost recovery edge. Verify the exact approved transition matrix.

### Manual edit enforcement

5. Test single-cell typing, clearing, dropdown choice, paste into one cell, paste across multiple Status rows, paste across Status plus adjacent columns, autofill, and undo. Verify no bypass and no adjacent-cell corruption.
6. Test events where `oldValue` is absent. The handler must reject safely or compare against a separately persisted prior stage; it must never assume `Lead Found`.
7. Force Activity Feed/follow-up/dashboard errors during a manual edit. Verify Status is restored or the entire transition is recoverably completed, with a clear operator message.

### Calendar idempotency

8. Double-click/run concurrently for the same prospect and requested meeting.
9. Force failure immediately after Calendar insert and before Status write; retry and verify exactly one event/invitation.
10. Simulate timeout/ambiguous Calendar insert response; retry and verify reconciliation finds the existing event.
11. Force discovery-brief generation failure; verify one event, confirmed Status, and a clear nonfatal warning/log.
12. Verify Advanced Calendar and `CalendarApp` fallback paths use equivalent durable deduplication behavior.

### Client/project transaction and repair

13. Force failures at each boundary: client upsert, project upsert, transition validation, Status write, follow-up sync, activity log, Closed Date, client follow-up, workspace refresh, dashboard refresh.
14. After every forced failure, verify Status truthfulness, operator message accuracy, and that retry/reconciliation completes missing work without duplicates.
15. Test pre-existing matching and conflicting Client/Project rows.
16. Test concurrent accepted-plan/onboarding actions using `LockService` protection.

### Legacy/workbook compatibility

17. Copy representative legacy rows for every historical Status/Next Action value. Run Health Check, dropdown repair preview, dashboard refresh, Next Action, and manual edits. Verify no silent mutation.
18. Verify required headers in the current production workbook; test optional absence of `Closed Date` and `Discovery Date` and confirm controlled addition only.
19. Run the full menu smoke test and System Health Check.

## Exact corrections required before deployment

1. **Make discovery scheduling durably idempotent.**
   - Generate and persist a stable operation key for the prospect plus intended start time before external creation, or persist a pending operation record under a script/document lock.
   - Store the returned Calendar event ID and scheduled time in a durable sheet/property field.
   - On retry, reconcile by stored event ID/operation key before inserting.
   - Use `LockService` to prevent concurrent duplicate scheduling.
   - Handle ambiguous Calendar success by lookup/reconciliation, not blind reinsertion.

2. **Redesign transition writes so failure cannot leave a falsely advanced Status.**
   - Separate validation/preparation from commit.
   - Complete all fallible prerequisite work before the Status commit.
   - Commit Status, Next Action, Last Activity, and required lifecycle evidence as one controlled final phase under a document lock.
   - If a sheet write in that phase fails, restore the captured prior row values or mark a durable reconciliation record; do not claim rollback unless verified.
   - Ensure no required fallible work occurs after the final Status commit, or make same-stage retry explicitly reconcile missing work.

3. **Fix client/project conversion failure semantics.**
   - Add an operation/reconciliation marker spanning prospect, Client, and Project records.
   - Preserve upsert behavior, but verify each prerequisite result before advancing Status.
   - Move Closed Date, required activity evidence, follow-up, and other required lifecycle effects into the commit/reconciliation design.
   - Replace “CRM Status was not changed” with a message based on a verified post-failure read.
   - Same-stage retries must repair incomplete downstream state instead of returning immediately.

4. **Harden `onEdit(e)`.**
   - Process only a single Status cell, or explicitly iterate each edited Status cell with independently captured prior state.
   - Never substitute `Lead Found` when `e.oldValue` is unavailable for an existing row.
   - Reject unsupported multi-cell edits without overwriting adjacent cells; restore only known prior Status cells.
   - Re-read and verify the persisted value after handling.
   - On any post-edit failure, restore the prior Status/derived fields or create a clear reconciliation flag and notify the operator.
   - Add locking for concurrent lifecycle edits.

5. **Approve and encode the complete transition matrix.**
   - Explicitly define which stages may move to Nurture or Lost and whether/how Nurture may re-enter.
   - Disallow contradictory edges such as `Project Started -> Nurture/Lost` and `Lost -> Nurture` unless they are expressly approved business rules with matching Client/Project cleanup semantics.
   - Document the exact matrix in `docs/SALES_JOURNEY.md`.

6. **Provide a non-mutating legacy migration audit before any repair.**
   - Report every unrecognized legacy Status and affected row.
   - Do not infer sent/presented/accepted from generated/draft/audit/proposal labels.
   - Require explicit operator selection of the last confirmed real-world event.
   - Update Health Check/operator messaging so invalid legacy rows are visible and actionable.

7. **Align Next Action compatibility.**
   - Remove or intentionally remap legacy `Convert to Client` and `Start Project` normalization to the new explicit confirmation actions without advancing Status.
   - Verify current workbook validations and headers in a production-copy smoke test.

8. **Add deterministic regression tests where feasible.**
   - Unit-test the transition matrix and normalization table outside Apps Script services.
   - Add mocked failure-order tests for transition, Calendar, and conversion orchestration.
   - Keep the mandatory live tests above for service behavior that cannot be proven locally.

## Recommended deployment decision

**Do not deploy this patch in its current state.**

Keep the truthful artifact/draft separation and explicit confirmation design, correct the three critical defects and associated reconciliation behavior, rerun `git diff --check`, `npm run status`, and `npm run validate`, then execute the live-test matrix in a disposable production-copy workbook. Deployment approval should require zero duplicate Calendar events under retry, verified rollback/reconciliation at every forced failure boundary, safe multi-cell edit behavior, and a reviewed legacy-data inventory with no automatic artifact-to-customer-event conversion.
