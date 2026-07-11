# Business Optimization Platform V1.0 Acceptance Test Plan

Document owner: Rogers Holdings LLC  
Release: `1.0.0-rc`  
Test environment: disposable copy of the production Google Sheet  
Production data permitted: no  
Production deployment authorized by this document: no

This is the official V1.0 live acceptance checklist. Record execution in `ACCEPTANCE_TEST_EXECUTION_LOG.md`. A test passes only when the observable workbook, Google Workspace side effects, durable operation evidence, and captured evidence all agree. Never infer success from a toast or modal alone.

## Acceptance rules

- Use synthetic businesses, tester-controlled email addresses, and a tester-controlled Calendar.
- Never send invitations or drafts to a real prospect or client.
- Record workbook copy ID, Apps Script version/source fingerprint, tester, date, timezone, and service configuration.
- Capture before-and-after evidence for Status, Next Action, Follow-Up, Activity Feed, dashboard, timestamps, operation markers, and external artifacts.
- Mark any unexpected duplicate, false lifecycle advancement, unexplained mutation, missing reconciliation marker, or untruthful operator message as a release blocker.
- Do not repair failed test data until its evidence is captured.
- Use a fresh sample row or restore the disposable workbook between destructive scenarios.
- Results: `Pass`, `Fail`, `Blocked`, or `Not Run`. A blank result is not a pass.

# 1. Environment Preparation

## 1.1 Required Google Workspace services

| ID | Test | Expected result | Evidence |
| --- | --- | --- | --- |
| ENV-01 | Confirm the workbook is a disposable copy of production | Workbook structure, formulas, protections, filters, validations, named ranges, and formatting match production; title clearly says TEST/DISPOSABLE | Workbook URL and copy timestamp |
| ENV-02 | Confirm bound Apps Script source | Candidate source matches the locally validated uncommitted release candidate; no production deployment is performed | Script project ID, source fingerprint, reviewer note |
| ENV-03 | Reload workbook and run `onOpen` | Grouped Rogers Holdings OS menu appears with Navigate, Sales Workflow, Pipeline, Workspaces, Follow-Ups, Clients & Projects, and System targets | Menu screenshot |
| ENV-04 | Run System Health Check | Required Sheets, Gmail, Calendar/Drive/PDF dependencies, configuration, Clients, Projects, Follow-Ups, Client Workspace, and dashboard checks have no unexplained failure | Health Check screenshot/export |
| ENV-05 | Verify timezone | Workbook, Apps Script, Calendar, and tester expectations use the documented timezone; displayed and stored times agree | Settings screenshots |
| ENV-06 | Verify reconciliation columns | Lifecycle Operation Key/State/Details/Confirmed At and Calendar Operation Key/Event ID/State exist without structural damage | Header screenshot and structural comparison |

Required services:

- Google Sheets and bound Google Apps Script.
- Gmail for tester-owned draft creation.
- Google Calendar, including Advanced Calendar service for the primary path and `CalendarApp` for fallback testing.
- Google Drive for folders, text artifacts, PDFs, and client workspace artifacts.
- PDF generation dependencies used by Apps Script.
- Website Audit Tool endpoint only when exercising real audit retrieval; use approved non-production inputs.

## 1.2 Permissions

### Calendar

- Tester can create, read, update, and delete events on the test calendar.
- Advanced Calendar service is enabled for the primary-path run.
- A separate run disables/unavailable Advanced Calendar to exercise fallback.
- Invitations target only a tester-controlled guest mailbox.
- Capture the authorization prompt/scopes on first use.

### Gmail

- Tester can create, locate, inspect, and delete drafts.
- No workflow may send mail automatically during acceptance.
- Recipient addresses and attachments must be tester-controlled.
- Capture the authorization prompt/scopes on first use.

### Drive

- Tester can create, read, update, move, and delete files/folders in the designated test root.
- Brand asset access is configured without using confidential client folders.
- Test root is isolated and can be deleted after sign-off.
- Capture the authorization prompt/scopes on first use.

## 1.3 Test workbook setup

1. Copy the current production workbook; do not use the production workbook.
2. Label the copy `DISPOSABLE V1.0 ACCEPTANCE - YYYY-MM-DD`.
3. Record workbook ID, bound script project ID, timezone, tester accounts, and Calendar ID.
4. Remove or replace all real prospect/client email addresses before authorizing scripts.
5. Preserve production-like formulas, validation, filters, formatting, protections, and sheet order.
6. Create a dedicated Drive test root and tester Calendar.
7. Empty tester Gmail drafts and Calendar search results for the synthetic company names.
8. Capture baseline row counts for Master Prospect Tracker, Clients, Projects, Follow-Ups, and Activity Feed.
9. Run the local gates against the exact candidate: `git diff --check`, `npm run status`, `npm run validate`, and `npm run test:lifecycle`.
10. Run System Health Check and capture the baseline dashboard.

## 1.4 Required sample data

Create uniquely named records so searches cannot overlap:

| Record | Required state/purpose |
| --- | --- |
| `AT Lead Alpha` | Complete happy path from Lead Found to Client; valid tester email, website, contact, service, Prospect ID |
| `AT Branch Nurture 1–5` | One row at each active stage through Improvement Plan Sent for Nurture transitions |
| `AT Branch Lost 1–5` | One row at each active stage through Improvement Plan Sent for Lost transitions |
| `AT Reactivate` | Nurture row for explicit reactivation |
| `AT Manual Known` | Controlled transition completed so a durable Status snapshot exists |
| `AT Manual Unknown` | Legacy/copied row with no durable prior snapshot |
| `AT Calendar Exact` | Executive Snapshot Sent; valid tester guest |
| `AT Calendar Conflict` | Executive Snapshot Sent; used for different-time/conflict tests |
| `AT Conversion Retry` | Improvement Plan Sent; unique company, website, service, and IDs |
| `AT Duplicate Identity` | Deliberately duplicated Client/Project identity for ambiguity tests |
| `AT Legacy Unknown` | Unknown Status and unknown Next Action |
| `AT Legacy Artifacts` | Draft Created, Audit Complete, Proposal Sent, Convert to Client, Start Project variants |
| Blank workbook fixture | Empty-state dashboard and sheet behavior |

For each synthetic record capture the starting row, Prospect ID, company, email, website, current Status, and expected operation identity.

# 2. CRM Lifecycle

## 2.1 Common assertions for every transition

For each transition below, the execution record must contain:

- Preconditions: source Status is exact, required fields exist, no unresolved reconciliation marker, and baseline downstream row counts are captured.
- Operator action: use the named explicit menu action unless the test specifically covers manual editing. Calendar scheduling is the only automatic confirmed transition.
- Expected Status and Next Action: exact values listed below.
- Expected Activity Feed: one primary lifecycle entry with the correct company, activity type, timestamp, notes, and operation key; retries must not duplicate it.
- Expected Follow-Up: exactly one appropriate open follow-up for the destination stage; obsolete open follow-ups are completed once.
- Expected Dashboard: source/destination pipeline counts move by one where applicable; total prospects is unchanged; Activity/Next Action widgets agree after refresh.
- Expected timestamps: Last Activity and Lifecycle Confirmed At are populated with the test time within a five-minute tolerance; Closed Date is populated only for Client; Discovery Date matches the Calendar event only for Discovery Meeting Scheduled.
- Pass/Fail: record `Pass`, `Fail`, `Blocked`, or `Not Run`.
- Evidence required: before/after prospect row, operation columns, Activity Feed row, Follow-Up row, relevant dashboard widget, and external Calendar/Client/Project evidence where applicable.

## 2.2 Forward lifecycle transitions

### CRM-01 — Lead Found → Executive Snapshot Sent

- Preconditions: `AT Lead Alpha` is Lead Found; Executive Snapshot has actually been sent to the tester by the operator; generated artifacts alone have not changed Status.
- Operator actions: Pipeline → Confirm Executive Snapshot Sent; confirm the real-world event.
- Expected Status: `Executive Snapshot Sent`.
- Expected Next Action: `Schedule Discovery Meeting`.
- Expected Activity Feed: one `Executive Snapshot Sent` lifecycle entry with operation key.
- Expected Follow-Up: one open `Discovery Meeting` follow-up; prior Executive Snapshot task completed.
- Expected Dashboard metrics: Lead Found −1; Executive Snapshot Sent +1; total unchanged.
- Expected timestamps: Last Activity and Lifecycle Confirmed At updated; no Discovery Date or Closed Date.
- Pass/Fail: □
- Evidence required: row before/after, sent-message evidence or tester attestation, activity, follow-up, dashboard.

### CRM-02 — Executive Snapshot Sent → Discovery Meeting Scheduled

- Preconditions: valid contact/tester email; no existing event for the operation; source Status is Executive Snapshot Sent.
- Operator actions: Sales Workflow → Create Discovery Call; enter exact date, time, and duration; authorize Calendar if prompted.
- Expected Status: `Discovery Meeting Scheduled` only after the event is re-read and verified.
- Expected Next Action: `Present Digital Business Assessment`.
- Expected Activity Feed: one `Discovery Meeting Scheduled` keyed entry; optional brief-generation entry is separate.
- Expected Follow-Up: one open `Discovery Reminder` based on Discovery Date; prior task completed.
- Expected Dashboard metrics: Executive Snapshot Sent −1; Discovery Meeting Scheduled +1; scheduled-meeting metric +1.
- Expected timestamps: Last Activity/Lifecycle Confirmed At updated; Discovery Date equals event start; Calendar key/event ID/state are populated and state is Event Verified.
- Pass/Fail: □
- Evidence required: row, Calendar event and guest, operation key/event ID, activity, follow-up, dashboard.

### CRM-03 — Discovery Meeting Scheduled → Digital Business Assessment Presented

- Preconditions: assessment exists and was actually presented to the tester; source Status is Discovery Meeting Scheduled.
- Operator actions: Pipeline → Confirm Assessment Presented.
- Expected Status: `Digital Business Assessment Presented`.
- Expected Next Action: `Generate Improvement Plan`.
- Expected Activity Feed: one keyed `Digital Business Assessment Presented` entry.
- Expected Follow-Up: one open `Improvement Plan` follow-up; Discovery Reminder completed.
- Expected Dashboard metrics: Discovery Meeting Scheduled −1; Digital Business Assessment Presented +1; presented metric agrees.
- Expected timestamps: Last Activity/Lifecycle Confirmed At updated; Discovery Date preserved; no Closed Date.
- Pass/Fail: □
- Evidence required: presentation attestation, row, activity, follow-up, dashboard.

### CRM-04 — Digital Business Assessment Presented → Improvement Plan Sent

- Preconditions: Improvement Plan generated and actually sent to tester; source Status is Digital Business Assessment Presented.
- Operator actions: Pipeline → Confirm Improvement Plan Sent.
- Expected Status: `Improvement Plan Sent`.
- Expected Next Action: `Record Improvement Plan Outcome`.
- Expected Activity Feed: one keyed `Improvement Plan Sent` entry.
- Expected Follow-Up: one open `Follow-Up` due according to the stage rule; Improvement Plan generation task completed.
- Expected Dashboard metrics: Assessment Presented −1; Improvement Plan Sent +1.
- Expected timestamps: Last Activity/Lifecycle Confirmed At updated; no Closed Date.
- Pass/Fail: □
- Evidence required: tester receipt/attestation, row, activity, follow-up, dashboard.

### CRM-05 — Improvement Plan Sent → Project Started

- Preconditions: tester has explicitly accepted the plan; no ambiguous Client/Project identity; source Status is Improvement Plan Sent.
- Operator actions: Pipeline → Record Improvement Plan Accepted / Start Project; confirm.
- Expected Status: `Project Started` only after persisted Client and Project records verify.
- Expected Next Action: `Complete Client Onboarding`.
- Expected Activity Feed: one keyed `Improvement Plan Accepted` lifecycle entry; project creation evidence appears once.
- Expected Follow-Up: one open `Project Kickoff` follow-up; prior plan follow-up completed.
- Expected Dashboard metrics: Improvement Plan Sent −1; Project Started +1; project/client-onboarding widgets reflect one verified record.
- Expected timestamps: Last Activity/Lifecycle Confirmed At updated; Client and Project timestamps populated; no prospect Closed Date.
- Pass/Fail: □
- Evidence required: prospect row, Client row (`Onboarding`), Project row/ID/linkage/status, activity, follow-up, workspace, dashboard.

### CRM-06 — Project Started → Client

- Preconditions: onboarding is actually complete; verified Client and Project exist; source Status is Project Started.
- Operator actions: Pipeline → Complete Client Onboarding; confirm.
- Expected Status: `Client`.
- Expected Next Action: `Follow Up`.
- Expected Activity Feed: one keyed `Client Onboarding Completed` entry.
- Expected Follow-Up: one open Client Welcome Task; Project Kickoff task completed without duplicate welcome tasks.
- Expected Dashboard metrics: Project Started −1; Client +1; client and revenue metrics agree with verified Client record.
- Expected timestamps: Last Activity/Lifecycle Confirmed At and Closed Date populated; Client status is Active; Project remains correctly linked.
- Pass/Fail: □
- Evidence required: prospect, Client, Project, workspace, activity, follow-up, dashboard.

## 2.3 Nurture, Lost, and reactivation transitions

Execute the following matrix. Apply all common assertions in §2.1.

| ID | Preconditions | Operator actions | Expected Status | Expected Next Action | Expected Activity Feed | Expected Follow-Up | Expected Dashboard metrics | Expected timestamps | Pass/Fail | Evidence required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CRM-07 | Lead Found | Move to Nurture; confirm | Nurture | Follow Up | One keyed Prospect Nurture | No duplicate; follow-up behavior matches Nurture rule/operator workflow | Lead −1, Nurture +1 | Last Activity/Confirmed At updated | □ | Common evidence set |
| CRM-08 | Executive Snapshot Sent | Move to Nurture; confirm | Nurture | Follow Up | One keyed Prospect Nurture | Prior stage task reconciled; no duplicate | Source −1, Nurture +1 | Updated | □ | Common evidence set |
| CRM-09 | Discovery Meeting Scheduled | Move to Nurture; confirm | Nurture | Follow Up | One keyed Prospect Nurture | Discovery reminder reconciled; Calendar event is not silently deleted | Source −1, Nurture +1 | Updated; Discovery Date preserved | □ | Common plus Calendar evidence |
| CRM-10 | Assessment Presented | Move to Nurture; confirm | Nurture | Follow Up | One keyed Prospect Nurture | Prior task reconciled | Source −1, Nurture +1 | Updated | □ | Common evidence set |
| CRM-11 | Improvement Plan Sent | Move to Nurture; confirm | Nurture | Follow Up | One keyed Prospect Nurture | Prior task reconciled | Source −1, Nurture +1 | Updated | □ | Common evidence set |
| CRM-12 | Lead Found | Mark Lost; confirm | Lost | Archived | One keyed Deal Lost | All open follow-ups completed/archived once | Lead −1, Lost +1 | Updated; no Client Closed Date semantics inferred | □ | Common evidence set |
| CRM-13 | Executive Snapshot Sent | Mark Lost; confirm | Lost | Archived | One keyed Deal Lost | Archived once | Source −1, Lost +1 | Updated | □ | Common evidence set |
| CRM-14 | Discovery Meeting Scheduled | Mark Lost; confirm | Lost | Archived | One keyed Deal Lost | Archived once; Calendar not silently deleted | Source −1, Lost +1 | Updated; Discovery Date preserved | □ | Common plus Calendar evidence |
| CRM-15 | Assessment Presented | Mark Lost; confirm | Lost | Archived | One keyed Deal Lost | Archived once | Source −1, Lost +1 | Updated | □ | Common evidence set |
| CRM-16 | Improvement Plan Sent | Mark Lost; confirm | Lost | Archived | One keyed Deal Lost | Archived once | Source −1, Lost +1 | Updated | □ | Common evidence set |
| CRM-17 | Nurture | Reactivate Nurtured Prospect; confirm | Lead Found | Generate Executive Snapshot | One keyed Nurtured Prospect Reactivated | One Executive Snapshot task, no duplicate | Nurture −1, Lead +1 | Updated | □ | Common evidence set |

## 2.4 Terminal, invalid, and idempotent cases

| ID | Test | Expected result | Evidence |
| --- | --- | --- | --- |
| CRM-18 | Project Started → Nurture | Blocked; Status/derived fields unchanged; no downstream side effect | Alert and before/after row |
| CRM-19 | Project Started → Lost | Blocked; unchanged | Alert and row |
| CRM-20 | Client → any different stage | Blocked; Client is terminal | Matrix attempts and row |
| CRM-21 | Lost → any different stage, including Nurture | Blocked; Lost is terminal | Matrix attempts and row |
| CRM-22 | Nurture → active stage by direct edit/menu other than Reactivate | Blocked or restored; only explicit Reactivate can return to Lead Found | Alert, row, reconciliation evidence |
| CRM-23 | Skip one or more forward stages | Blocked; no activity/follow-up/dashboard change | Attempt matrix |
| CRM-24 | Repeat every explicit confirmation at the same stage | Same Status; operation remains Complete; missing downstream effects repaired; no duplicate keyed activity/follow-up/client/project/event | Counts before/after |

# 3. Manual Status Editing

| ID | Test | Procedure | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| MAN-01 | Valid dropdown edit | Change one Status cell to the single allowed next stage | Same controlled commit/reconciliation semantics as explicit action; value re-read; snapshot updated only after success | Before/after row, operation fields, activity/follow-up |
| MAN-02 | Valid branch edit | From each eligible active stage choose Nurture and Lost on separate rows | Accepted; exact branch expectations from CRM-07–16 | Evidence set per transition |
| MAN-03 | Invalid forward jump | Choose a later non-adjacent stage | Prior value restored and verified; no downstream effects | Alert, row, counts |
| MAN-04 | Invalid backward/terminal edit | Attempt backward, Client/Lost exit, Project Started→Nurture/Lost | Prior value restored and verified | Alert and row |
| MAN-05 | Single-cell paste | Paste one allowed Status with known old value | Validated as one transition; accepted only if allowed | Event behavior, row, effects |
| MAN-06 | Copy/paste same value | Paste current Status into same cell | Idempotent; no duplicate side effect | Counts and marker |
| MAN-07 | Multi-row Status paste with snapshots | Paste several statuses vertically | No pasted lifecycle value remains; every Status restored independently and verified; each row marked Reconciliation Required as unsupported | All affected Status cells and details |
| MAN-08 | Multi-row paste without snapshots | Paste into legacy rows lacking snapshots | Only affected Status cells are cleared; rows marked Reconciliation Required; no fabricated prior stage | Cells and operation details |
| MAN-09 | Paste across Status and adjacent columns | Paste rectangular data covering Status plus adjacent fields | Lifecycle recovery writes only Status cells; adjacent pasted cells remain exactly as pasted; Status cells restore/clear safely | Before/paste/after grid screenshots |
| MAN-10 | Missing `oldValue`, valid snapshot | Produce an edit event without oldValue on a row with durable snapshot | Snapshot used as prior proof; transition validated; accepted or restored according to matrix | Trigger log and row |
| MAN-11 | Missing `oldValue`, no snapshot | Produce event on legacy/copied row | Unverified Status cleared and verified; row Reconciliation Required; clear operator notice | Row and alert/log |
| MAN-12 | Post-edit downstream failure | Interrupt Activity Feed or Follow-Up effect after Status commit | Truthful confirmed Status may remain only with Reconciliation Required; repeat explicit action repairs effect without duplication | Marker, retry evidence |
| MAN-13 | Status restoration write failure | Protect Status cell or otherwise cause controlled restoration failure | Failure is reported; no adjacent mutation; capture exact persisted value and treat as release blocker unless safely quarantined | Protection, alert, row |
| MAN-14 | Undo/autofill | Exercise undo and fill handle across Status | No matrix bypass; unsupported range behavior fails closed | Screen recording and rows |

# 4. Calendar Testing

| ID | Test | Procedure | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| CAL-01 | Initial scheduling | Schedule exact start/end with Advanced Calendar enabled | One event/invitation; exact guest/time; stored key/ID; Event Verified; Status advances once | Calendar event, inbox, row |
| CAL-02 | Exact retry | Retry same operation after simulating incomplete lifecycle/downstream state | Existing exact event reused; no second invitation; missing effects repaired | Event/search counts and row |
| CAL-03 | Double-click retry | Invoke scheduling twice rapidly | Document lock serializes; no more than one exact invitation | Execution logs and Calendar count |
| CAL-04 | Different-time retry | After an operation exists, request a different start/end | Rejected as different operation; original evidence retained; explicit reschedule required | Alert, row, Calendar |
| CAL-05 | Stored-ID time mismatch | Alter/move stored event, then retry original operation | Event is not reused; reconciliation required; no new blind invitation | Event and marker |
| CAL-06 | Stored-ID key mismatch | Remove/change operation evidence on event | Event rejected; reconciliation required | Event details and marker |
| CAL-07 | Duplicate matching events | Deliberately create two exact matching marked events, then retry | Ambiguous/conflicting result; no third event; reconciliation required | Calendar search and marker |
| CAL-08 | Reschedule | Reconcile/cancel old test operation, then follow the approved explicit reschedule process | New operation only after old evidence is intentionally resolved; row/event agree | Full audit trail |
| CAL-09 | Cancellation | Cancel verified event externally | Retry does not treat cancelled event as valid; fail closed/reconcile; Status is not silently rewritten | Cancelled event and row |
| CAL-10 | API failure before insert | Disable service or deny request before event creation | Status unchanged; no event; truthful error/state | Row, error, Calendar search |
| CAL-11 | Ambiguous failure after insert | Interrupt/throw after insert but before sheet commit | Reconciliation finds exact event or marks ambiguous; retry never blindly inserts | One-event proof and marker |
| CAL-12 | Permission failure | Revoke Calendar permission | No Status advancement or invitation; actionable error | Authorization/error evidence |
| CAL-13 | CalendarApp fallback | Disable Advanced Calendar and schedule | One fallback event with description operation key; exact retry finds it; no duplicate | Event details and logs |
| CAL-14 | Concurrent users | Two authorized testers schedule same prospect/time concurrently | At most one matching invitation; one durable operation | Both execution logs and Calendar |

# 5. Gmail Testing

Gmail workflows create drafts; they do not confirm that anything was sent and must not advance lifecycle Status.

| ID | Test | Procedure | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| GML-01 | Executive Snapshot draft | Create outreach draft for Lead Found | Correct tester recipient, subject/body, company, links/attachments; Status unchanged; Next Action requests explicit sent confirmation | Draft and row |
| GML-02 | Assessment draft | Run Send Digital Business Assessment | Draft only; correct assessment/proposal attachments or documented link fallback; Status unchanged | Draft, attachments, row |
| GML-03 | Proposal draft/path | Generate plan and exercise applicable draft workflow | Draft/content identifies Improvement Plan; Status unchanged until explicit sent confirmation | Draft/artifact and row |
| GML-04 | Regeneration | Repeat draft action | Behavior is intentional and understandable; no lifecycle advancement; record whether draft is updated or a second draft is created | Draft counts and Activity Feed |
| GML-05 | Failed draft | Remove recipient or revoke Gmail permission | No false success, no lifecycle advancement; actionable error; partial draft behavior documented | Error, draft search, row |
| GML-06 | Duplicate prevention | Retry after ambiguous/partial draft failure | No misleading Activity Feed evidence; any duplicate behavior is identified and accepted or filed as defect | Draft IDs/counts |
| GML-07 | No automatic send | Inspect Sent and tester inbox after draft workflows | No message sent until operator manually sends | Sent/Drafts screenshots |

# 6. PDF Generation

Execute PDF-01 through PDF-05 for each generated document: `Executive Snapshot.pdf`, `Audit Report.pdf` (Digital Business Assessment), `Proposal.pdf` (Improvement Plan), and `Discovery Call Brief.pdf`.

| ID | Test | Expected result | Evidence |
| --- | --- | --- | --- |
| PDF-01 | Generate document | Opens successfully; correct synthetic company/contact/website/service and source evidence | PDF and source row |
| PDF-02 | Branding/layout | Rogers Holdings black/white/gold presentation, readable typography, no clipping/overlap/blank critical page | Rendered page screenshots |
| PDF-03 | Evidence truthfulness | Scores, findings, screenshots/text, recommendations, dates, and meeting details match the selected row; no placeholder/fabricated evidence | Side-by-side comparison |
| PDF-04 | Filename/location | Exact expected legacy-compatible filename in correct test folder | Drive path and file metadata |
| PDF-05 | Regeneration | Existing artifact is intentionally updated/replaced according to workflow; no uncontrolled duplicates | Before/after file IDs/counts |
| PDF-06 | Lifecycle isolation | Generate/regenerate every document at multiple stages | Status byte-for-byte unchanged; Activity Feed says generated/created, not sent/presented/accepted | Rows and activities |
| PDF-07 | Failure | Remove brand asset/folder access or use incomplete data | Controlled fallback/error; no false lifecycle advancement | Error/PDF/row |

# 7. Drive Operations

| ID | Test | Procedure | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| DRV-01 | Folder creation | Run package/client workflow for new company | One correctly named root and expected child structure | Folder tree |
| DRV-02 | Existing folder | Repeat against existing exact folder | Existing folder reused; no duplicate root/children | Folder IDs/counts |
| DRV-03 | Duplicate folders | Seed same-name duplicates | Workflow behavior is deterministic or fails safely; no data written to an unverified destination | Folder IDs and result |
| DRV-04 | Client creation | Accept plan | Persisted Client re-read verifies unique ID, company/website linkage, Onboarding status before Project Started | Client row and operation marker |
| DRV-05 | Project creation | Accept plan | Persisted Project re-read verifies unique ID, client/company/service linkage, expected status before advancement | Project row and marker |
| DRV-06 | Duplicate Client identity | Seed two matching Client rows | Prospect Status unchanged; Reconciliation Required; truthful operator message | Duplicate rows and prospect |
| DRV-07 | Duplicate Project identity | Seed two matching active Project rows | Status unchanged; Reconciliation Required; no third Project | Rows/counts and alert |
| DRV-08 | Partial Client failure | Interrupt after Client write/before Project verification | Status unchanged; durable marker; retry repairs/reuses one Client | Before/failure/retry counts |
| DRV-09 | Partial Project failure | Interrupt after Project write/before final Status commit | Status unchanged or restored; durable marker; retry reuses/repairs one Project | Rows and retry evidence |
| DRV-10 | Workspace failure | Deny workspace/folder preparation | No false advancement; reconciliation state is actionable | Error, row, folders |
| DRV-11 | Same-stage recovery | Remove an expected downstream effect and repeat explicit action | Missing effect repaired; no duplicate Client/Project/folder/activity/follow-up | Counts before/after |

# 8. Dashboard Verification

Verify after baseline, every lifecycle transition family, client conversion, failure/reconciliation, follow-up completion, and empty-state fixture.

| ID | Widget/area | Expected result | Evidence |
| --- | --- | --- | --- |
| DSH-01 | Total leads/prospects | Matches nonblank prospect records under documented counting rule | Manual count and widget |
| DSH-02 | Pipeline stage counts | Exact counts for every approved Status; unknown legacy values are not silently counted as confirmed stages | Pivot/manual count comparison |
| DSH-03 | Executive Snapshots Sent | Reflects confirmed Status, not generated artifacts/drafts | Controlled records and metric |
| DSH-04 | Discovery Meetings Scheduled | Matches confirmed rows/keyed activities; no retry inflation | Rows/activity/metric |
| DSH-05 | Assessments Generated/Presented | Generated and presented measures remain semantically separate | Activities/status/widget |
| DSH-06 | Improvement Plans Sent | Matches confirmed Status, not generated PDFs | Rows and metric |
| DSH-07 | Clients/Lost/Win Rate | Counts and formula agree with terminal confirmed states | Manual calculation |
| DSH-08 | Client/revenue summary | Matches verified Client records and contract values | Client table reconciliation |
| DSH-09 | Projects | Counts/status/progress agree with Projects sheet | Project reconciliation |
| DSH-10 | Follow-Up queue | Open/overdue/completed counts and ordering agree with Follow-Ups | Manual reconciliation |
| DSH-11 | Activity Feed/recent activity | Latest meaningful activities, dates, and companies appear once | Activity comparison |
| DSH-12 | Next Actions | Exact Next Action agrees with confirmed Status | Row/widget comparison |
| DSH-13 | Health indicators | Reflect actual service/configuration failures and recovery | Toggle service/config evidence |
| DSH-14 | Reconciliation visibility | Rows requiring reconciliation are operationally discoverable through documented columns/workflow | Screenshot and operator walkthrough |
| DSH-15 | Empty states | Empty workbook fixtures render without errors, misleading zeros, broken ranges, or stale sample data | Empty dashboard screenshots |

# 9. Follow-Up Engine

| ID | Test | Expected result | Evidence |
| --- | --- | --- | --- |
| FUP-01 | Creation per stage | Exactly one open follow-up with correct company, related ID, type, due date, priority, owner, and notes | Prospect and Follow-Up row |
| FUP-02 | Prior completion | Transition completes obsolete open task once with Completed Date | Before/after rows |
| FUP-03 | Manual completion | Complete Follow-Up updates completion fields and Activity Feed accurately | Row and activity |
| FUP-04 | Reopen/new follow-up | Use supported creation workflow after completion | New/open task is intentional; historical completed task preserved | Both rows |
| FUP-05 | Same-stage retry | Repeat lifecycle confirmation | Existing expected open task found; not completed/recreated | IDs/counts |
| FUP-06 | Failure and retry | Interrupt after Status commit before follow-up completion/creation | Reconciliation Required; repeat explicit action repairs exactly once | Marker and counts |
| FUP-07 | Client welcome | Complete onboarding twice | Exactly one open Client Welcome Task | Client/Follow-Up rows |
| FUP-08 | Lost archival | Move active record to Lost | All open tasks archived/completed once; no new open task | Rows and activity |
| FUP-09 | Company collision | Use two same-company prospects with unique Prospect IDs | Follow-ups remain correctly related; no cross-record suppression | IDs and rows |

# 10. Legacy Data

| ID | Test | Expected result | Evidence |
| --- | --- | --- | --- |
| LEG-01 | Unknown Status | Value remains byte-for-byte unchanged until explicit operator reconciliation; Next Action does not silently advance it | Before/after row |
| LEG-02 | Unknown Next Action | Value is inventoried; no lifecycle write | Row and audit |
| LEG-03 | Artifact Status values | Draft Created, Gmail Draft Created, Executive Snapshot Generated, Audit Complete, Audit Package Sent, Proposal Sent, Won, and Active are not silently converted | Fixture rows before/after |
| LEG-04 | Legacy Next Actions | Convert to Client and Start Project route to Record Improvement Plan Outcome; opening/running Next Action does not itself advance Status without confirmation | Prompt and row |
| LEG-05 | Migration audit | System → Audit Legacy Lifecycle Values lists row/company/field/value accurately | Modal and source rows |
| LEG-06 | Audit non-mutation | Compare workbook/activity counts before and after audit | No cell, timestamp, Activity Feed, or operation-marker change | Diff/count evidence |
| LEG-07 | Manual edit without snapshot | Unverified pasted Status clears; row marked Reconciliation Required | Row and operator notice |
| LEG-08 | Reconciliation workflow | Operator reviews evidence, restores/selects only a confirmed real-world stage using approved procedure, then completes explicit action | Full audit trail; no inferred artifact promotion | Before/evidence/after |

# 11. Failure Injection

Use reversible test-only controls: revoke tester permission, temporarily disable an Advanced service in the disposable script project, protect a test range, seed deliberate duplicates, or use a reviewed temporary failure-injection switch only if already present. Do not edit production implementation merely to run this plan.

| ID | Failure | Injection and checkpoint | Expected recovery |
| --- | --- | --- | --- |
| FAIL-01 | Calendar outage | Disable service/network access before insert | No event or Status advancement; actionable error; retry succeeds once after restoration |
| FAIL-02 | Ambiguous Calendar insert | Interrupt immediately after event creation/before lifecycle commit using an available test harness or controlled service failure | Exact event reconciled or operation marked ambiguous; no duplicate on retry |
| FAIL-03 | Gmail permission failure | Revoke Gmail authorization before draft | No draft/sent message and no lifecycle advancement; retry works after authorization |
| FAIL-04 | Drive permission failure | Remove access to test root before PDF/client workspace write | No false success/advancement; partial artifacts identifiable; retry upserts safely |
| FAIL-05 | Trigger interruption | Cause onEdit downstream service failure or execution timeout | Status restored or truthfully confirmed with Reconciliation Required; adjacent cells safe |
| FAIL-06 | Concurrent Status edits | Two testers edit same prospect simultaneously | Lock serializes; one valid final state; loser receives safe failure; no duplicate effects |
| FAIL-07 | Concurrent scheduling | Two testers schedule same exact time | One event/invitation and one operation |
| FAIL-08 | Client partial write | Make Client row unavailable/mismatched on re-read | Prospect unchanged; Reconciliation Required; truthful message |
| FAIL-09 | Project partial write | Make Project row unavailable/mismatched on re-read | Prospect unchanged; Reconciliation Required; no duplicate on recovery |
| FAIL-10 | Final prospect commit failure | Protect prospect row after prerequisites but before commit where test harness permits | Prior Status restored and verified or explicit reconciliation marker; no rollback claim without proof |
| FAIL-11 | Activity Feed failure | Protect Activity Feed during transition | Confirmed Status has Reconciliation Required; retry creates one keyed activity |
| FAIL-12 | Follow-Up failure | Protect Follow-Ups during transition | Confirmed Status has Reconciliation Required; retry creates/completes exactly once |
| FAIL-13 | Dashboard refresh failure | Make dashboard temporarily unavailable after core commit | Core truth remains correct; retry/refresh repairs display without duplicate business records |
| FAIL-14 | Recovery after interruption | Restore each failed dependency and repeat the same explicit action | Operation reaches Complete; no duplicate external or sheet side effects; timestamps/messages truthful |

For every failure capture the last verified state before injection, exact error shown, execution log, persisted row after failure, operation marker, external side-effect search, and recovery result.

# 12. Final Release Gate

No production deployment may proceed until every required row below has a result, evidence, reviewer, and date. Any `Fail` or unresolved `Blocked` item prevents release.

| □ | Test | Result | Evidence | Reviewer | Date |
| --- | --- | --- | --- | --- | --- |
| □ | Exact candidate passed `git diff --check` |  |  |  |  |
| □ | Exact candidate passed `npm run status` |  |  |  |  |
| □ | Exact candidate passed `npm run validate` |  |  |  |  |
| □ | Exact candidate passed `npm run test:lifecycle` |  |  |  |  |
| □ | Disposable workbook identity and production isolation verified |  |  |  |  |
| □ | System Health Check passed with no unexplained failure |  |  |  |  |
| □ | All forward lifecycle transitions passed |  |  |  |  |
| □ | All Nurture, Lost, reactivation, terminal, and invalid transitions passed |  |  |  |  |
| □ | Same-stage retries repaired effects without duplication |  |  |  |  |
| □ | Manual edit, paste, missing-prior-state, and reconciliation tests passed |  |  |  |  |
| □ | Advanced Calendar and CalendarApp fallback tests passed |  |  |  |  |
| □ | Calendar ambiguity, exact-time retry, reschedule, cancellation, permission, and concurrency tests passed |  |  |  |  |
| □ | Gmail draft and failure tests passed with no lifecycle advancement |  |  |  |  |
| □ | Every PDF passed content, branding, filename, regeneration, and lifecycle-isolation checks |  |  |  |  |
| □ | Drive folder, Client, Project, ambiguity, partial-failure, and recovery tests passed |  |  |  |  |
| □ | Every dashboard widget and empty state reconciled to source data |  |  |  |  |
| □ | Follow-Up creation, completion, reopen, retry, and deduplication passed |  |  |  |  |
| □ | Legacy audit and reconciliation passed without silent mutation |  |  |  |  |
| □ | All required failure-injection scenarios recovered truthfully |  |  |  |  |
| □ | No unexpected security, privacy, permission, recipient, or logging exposure found |  |  |  |  |
| □ | All acceptance defects are documented, severity-assigned, and resolved or explicitly accepted by Product Owner |  |  |  |  |
| □ | QA Director sign-off |  |  |  |  |
| □ | Principal Apps Script Engineer sign-off |  |  |  |  |
| □ | Product Owner sign-off |  |  |  |  |
| □ | Release Manager confirms backup, rollback plan, deployment window, and production smoke-test owner |  |  |  |  |

## Release recommendation

**Not Ready**
