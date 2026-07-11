# Business Optimization Platform V1.0 Acceptance Test Runbook

Operator: Brian Rogers  
Environment: disposable copy of the production Google Sheet only  
Companion documents: `BUSINESS_OPTIMIZATION_PLATFORM_ACCEPTANCE_TEST_PLAN.md` and `ACCEPTANCE_TEST_EXECUTION_LOG.md`  
Production deployment authorized: no

Follow this runbook from top to bottom. Do not skip ahead. Enter every result and evidence link in the execution log before starting the next test. If a release-blocking failure occurs, capture evidence, stop the affected phase, restore permissions/protections, and do not improvise a repair.

## Before you start

### Total estimated testing time

- Active operator time: 10–14 hours.
- Recommended schedule: two working days, plus one hour for final evidence review.
- Phase estimates: Setup 60 min; CRM 150 min; Manual Editing 60 min; Calendar 90 min; Gmail 35 min; PDFs 60 min; Drive 70 min; Dashboard 45 min; Follow-Ups 40 min; Legacy Data 35 min; Failure Injection 90 min; Final Gate 45 min.

### Required Google accounts

- Primary operator: Brian’s authorized Rogers Holdings Google Workspace account.
- Tester guest mailbox: a second Brian-controlled address that can receive invitations and manually sent test messages.
- Secondary concurrent tester: a separate authorized account/browser profile for CAL-14, FAIL-06, and FAIL-07. If unavailable, record those tests `Blocked`; do not simulate two users in one session.
- Never use a real prospect or client address.

### Required permissions

- Edit access to the disposable workbook and its bound Apps Script project.
- Permission to authorize Google Sheets/Apps Script, Gmail draft creation, Google Calendar read/write, and Google Drive file/folder access.
- Advanced Calendar service enabled for the primary Calendar run and permission to disable/re-enable it in the disposable script project for fallback testing.
- Owner/editor access to the isolated Drive test root and tester Calendar.
- Permission to add/remove test-only sheet protections and revoke/re-authorize Brian’s own test access during failure injection.

### Required test data

Use these exact synthetic values. Replace `TEST_GUEST_EMAIL` with the tester guest mailbox and `YYYYMMDD` with the run date.

| Field | Standard value |
| --- | --- |
| Contact | Brian Acceptance Tester |
| Email | `TEST_GUEST_EMAIL` |
| Phone | 555-010-2026 |
| Website | `https://example.com/acceptance/YYYYMMDD` |
| Industry | Professional Services |
| Offer / Service | Google Business Optimization |
| Priority Tier | A - Hot |
| Notes | V1.0 disposable acceptance test; no production contact |
| Discovery date | Tomorrow in the test timezone |
| Discovery time | 2:00 PM |
| Discovery duration | 30 |

Create all company rows named in the Acceptance Test Plan: `AT Lead Alpha`, `AT Branch Nurture 1` through `5`, `AT Branch Lost 1` through `5`, `AT Reactivate`, `AT Manual Known`, `AT Manual Unknown`, `AT Calendar Exact`, `AT Calendar Conflict`, `AT Conversion Retry`, `AT Duplicate Identity`, `AT Legacy Unknown`, and the artifact fixtures. Give every normal record a unique Prospect ID such as `AT-YYYYMMDD-001`.

### Evidence naming

Save evidence in the isolated test Drive root under `Acceptance Evidence/YYYYMMDD` using:

`<TEST-ID>-<before|after|error|recovery>-<short-description>`

For each test capture the prospect row including lifecycle/Calendar marker columns, relevant Activity Feed and Follow-Up rows, applicable Dashboard panel, and external Gmail/Calendar/Drive artifact. Paste evidence links into the execution log immediately.

### Required cleanup afterward

1. Delete all test Gmail drafts and manually sent test messages.
2. Delete/cancel every test Calendar event and verify the guest calendar/inbox is clear.
3. Remove test-only sheet protections and restore Advanced Calendar/service settings.
4. Delete the disposable workbook and isolated Drive test artifacts only after evidence review/sign-off permits cleanup.
5. Revoke temporary secondary-account access.
6. Retain the execution log, evidence package, defect log, and sign-off record according to Rogers Holdings release records policy.

## Standard execution rules used below

- Select a test prospect by clicking any cell in its row on `Master Prospect Tracker` before using a menu action.
- “Confirm” means click `Yes` in the confirmation dialog. “Dismiss” means click `OK` after reading and screenshotting the result.
- After every state-changing action: wait for completion, screenshot the row, select `Rogers Holdings OS → System → Refresh Executive Dashboard`, then inspect Activity Feed and Follow-Ups using `Rogers Holdings OS → Navigate`.
- Workbook expectation (WB): exact Status/Next Action/markers/timestamps stated; no unrelated row mutation.
- Gmail expectation (GM): no Gmail change unless explicitly stated.
- Calendar expectation (CAL): no Calendar change unless explicitly stated.
- Drive expectation (DRV): no Drive change unless explicitly stated.
- Dashboard expectation (DSH): source stage −1 and destination +1 when a stage changes; total unchanged; refresh must agree with sheets.
- Universal pass: all stated expectations match, timestamps are within five minutes, keyed effects occur once, and evidence is captured.
- Universal fail: false Status advancement, duplicate invitation/client/project/keyed activity/follow-up, adjacent-cell corruption, missing/untruthful reconciliation, wrong recipient/client/evidence, or unexplained mutation.
- Standard recovery: capture error and persisted state first; record `Fail`/`Blocked`; do not manually force Status. Restore the test dependency, repeat the same supported action once, and capture recovery. A recovered release blocker remains a failed original test requiring review.

# Phase 1 — Environment Setup

| ID | Purpose / time | Exact actions and data | Expected behavior (WB / GM / CAL / DRV / DSH) | Evidence, pass/fail, recovery |
| --- | --- | --- | --- | --- |
| ENV-01 | Prove isolation; 10 min | In Drive open production workbook → `File → Make a copy`; name it `DISPOSABLE V1.0 ACCEPTANCE - YYYY-MM-DD`; open the copy; copy its URL to the log. | WB structure visually matches production and title says DISPOSABLE. GM/CAL/DRV no side effects except workbook copy. DSH matches copied baseline. | Capture both workbook titles/IDs and copy timestamp. Fail if IDs match or real production is open. Recovery: close all tabs and make a new copy. |
| ENV-02 | Identify candidate; 10 min | In disposable workbook click `Extensions → Apps Script`; record project ID. Compare bound `.gs` files/version fingerprint with the candidate recorded by engineering; do not save or deploy. | WB unchanged; services unchanged. | Screenshot project ID and reviewer comparison. Fail on mismatch. Recovery: stop; engineering must provide the correct disposable candidate. |
| ENV-03 | Verify menu/indexing; 5 min | Reload the workbook. Wait for load. Click `Rogers Holdings OS` and expand each submenu without selecting an action. | WB menu shows Navigate, Sales Workflow, Pipeline, Workspaces, Follow-Ups, Clients & Projects, Product, System. | Capture open menu. Fail if missing/broken. Recovery: reload once; if still absent stop. |
| ENV-04 | Health gate; 10 min | `Rogers Holdings OS → System → System Health Check`; authorize requested scopes; click `Allow`; wait; click `OK` after capture. | WB health results have no unexplained failure. GM/CAL/DRV permissions resolve. DSH remains usable. | Capture full result and authorization scopes. Fail on unexplained red/error. Recovery: correct only environment configuration, rerun once. |
| ENV-05 | Verify timezones; 10 min | Workbook `File → Settings` record timezone. Apps Script `Project Settings` record timezone. Google Calendar `Settings → General → Time zone` record timezone. | All intended test times resolve consistently; no workbook change. | Three screenshots. Fail if different without documented conversion. Recovery: align disposable settings, then restart baseline. |
| ENV-06 | Verify schema; 15 min | Open Master Prospect Tracker; locate `Lifecycle Operation Key`, `Lifecycle Operation State`, `Lifecycle Operation Details`, `Lifecycle Confirmed At`, `Calendar Operation Key`, `Calendar Event ID`, `Calendar Operation State`. Check filters/protections/formulas around them. | Headers exist once; no overwritten formula/protection/filter. | Wide header screenshot and production-copy comparison. Fail on duplicates/damage. Recovery: stop; do not rearrange schema. |

After ENV-06, create the required synthetic rows using the Standard values. Capture baseline counts for all core sheets and Dashboard. Clear pre-existing test-name drafts/events/folders.

# Phase 2 — CRM Lifecycle

## Happy path

| ID | Purpose / time | Exact menu, buttons, and data | Expected behavior | Evidence, pass/fail, recovery |
| --- | --- | --- | --- | --- |
| CRM-01 | Confirm sent snapshot; 8 min | Select `AT Lead Alpha`. First use `Sales Workflow → Generate Executive Snapshot`; verify Status stays Lead Found. Manually send only to test guest if required for real-world evidence. Then `Pipeline → Confirm Executive Snapshot Sent → Yes`; dismiss `OK`. | WB Status `Executive Snapshot Sent`; Next Action `Schedule Discovery Meeting`; Complete marker; Last Activity/Confirmed At set. Activity `Executive Snapshot Sent` once; open Discovery Meeting follow-up. GM only manual tester send/draft evidence. CAL none. DRV snapshot may exist. DSH Lead −1/Snapshot Sent +1. | Capture artifact isolation before confirmation and full after set. Fail on generation advancing Status or wrong downstream effects. Recovery standard. |
| CRM-02 | Schedule verified discovery; 12 min | Select `AT Lead Alpha`; `Sales Workflow → Create Discovery Call`. Date prompt: tomorrow `YYYY-MM-DD` → `OK`; time: `2:00 PM` → `OK`; duration: `30` → `OK`; authorize/Allow if prompted; dismiss success `OK`. | WB `Discovery Meeting Scheduled`; Next Action `Present Digital Business Assessment`; Discovery Date exact; Calendar key/ID and `Event Verified`. Activity once; Discovery Reminder follow-up. CAL one 2:00–2:30 event, one tester guest invitation. DRV Discovery Call Brief may be created. GM invitation only. DSH stages and meeting metric +1. | Capture all surfaces and guest inbox. Fail if more than one event/invitation or row/event times differ. Recovery: do not rerun until CAL evidence captured; follow Calendar phase recovery. |
| CRM-03 | Confirm assessment presentation; 8 min | Select row; `Sales Workflow → Generate Digital Business Assessment`; verify Status unchanged. Treat tester review as presentation. `Pipeline → Confirm Assessment Presented → Yes → OK`. | WB `Digital Business Assessment Presented`; Next Action `Generate Improvement Plan`; Discovery Date preserved. Activity once; Improvement Plan follow-up. GM/CAL unchanged. DRV Audit Report exists. DSH discovery −1/presented +1. | Capture before confirmation proving generation isolation and after. Standard fail/recovery. |
| CRM-04 | Confirm sent plan; 8 min | Select row; `Sales Workflow → Generate Improvement Plan`; verify Status unchanged. If using a test draft/manual send, send only to guest. `Pipeline → Confirm Improvement Plan Sent → Yes → OK`. | WB `Improvement Plan Sent`; Next Action `Record Improvement Plan Outcome`. Activity once; open Follow-Up. DRV Proposal exists; generation did not advance. GM only tester-controlled behavior. CAL unchanged. DSH presented −1/plan sent +1. | Capture PDF/draft and row before/after. Standard fail/recovery. |
| CRM-05 | Start verified project; 12 min | Select row; `Pipeline → Record Improvement Plan Accepted / Start Project → Yes`; wait; dismiss `OK`. | WB `Project Started`; Next Action `Complete Client Onboarding`; no Closed Date. Client row unique, ID present, company/site linked, Status `Onboarding`; Project unique, ID/client/service/status linked. Activity and Project Kickoff follow-up once. DRV workspace/folders correct. GM/CAL unchanged. DSH plan −1/project +1 and client/project widgets agree. | Capture prospect, Client, Project, workspace/folder IDs, activity/follow-up/dashboard. Fail on ambiguity, missing verification, duplicate, or premature Status. Recovery standard using same action only after evidence. |
| CRM-06 | Complete onboarding; 10 min | Select row; `Pipeline → Complete Client Onboarding → Yes`; wait; dismiss `OK`. | WB `Client`; Next Action `Follow Up`; Closed Date/confirmation timestamps set. Client unique and Active; Project linkage retained; one Client Welcome Task. Activity once. DRV workspace intact. GM/CAL unchanged. DSH project −1/client +1; revenue matches Client. | Capture all linked records. Standard fail/recovery. |

## Branch transitions

For CRM-07–17 use a separate fixture at the exact source stage. Before each action capture the row/counts. After each action run Dashboard refresh and capture Activity/Follow-Up. Estimated time: 5 minutes each.

| ID | Fixture/source | Exact action | Expected WB / services / DSH | Evidence, failure, recovery |
| --- | --- | --- | --- | --- |
| CRM-07 | `AT Branch Nurture 1`; Lead Found | `Pipeline → Move to Nurture → Yes → OK` | Nurture; Next Action Follow Up; keyed Prospect Nurture; no duplicate follow-up. GM/CAL/DRV unchanged. DSH Lead −1/Nurture +1. | Common transition evidence. Fail on any mismatch; standard recovery. |
| CRM-08 | Nurture 2; Executive Snapshot Sent | Same clicks | Nurture/Follow Up; prior task reconciled once; services unchanged; source −1/Nurture +1. | Common evidence; standard recovery. |
| CRM-09 | Nurture 3; Discovery Scheduled | Same clicks | Nurture/Follow Up; Discovery Date/event preserved; reminder reconciled; CAL event not deleted; DSH source −1/Nurture +1. | Include Calendar evidence. Fail if event silently changes/deletes. |
| CRM-10 | Nurture 4; Assessment Presented | Same clicks | Nurture/Follow Up; one activity/effect; external services unchanged; DSH source −1/Nurture +1. | Common evidence; standard recovery. |
| CRM-11 | Nurture 5; Improvement Plan Sent | Same clicks | Nurture/Follow Up; prior plan task reconciled; services unchanged; DSH source −1/Nurture +1. | Common evidence; standard recovery. |
| CRM-12 | `AT Branch Lost 1`; Lead Found | `Pipeline → Mark Lost → Yes → OK` | Lost; Next Action Archived; Deal Lost activity; all open follow-ups archived once. External services unchanged. DSH Lead −1/Lost +1. | Common evidence. Fail if open task remains/duplicate activity. |
| CRM-13 | Lost 2; Executive Snapshot Sent | Same clicks | Lost/Archived; source task archived once; DSH source −1/Lost +1. | Common evidence; standard recovery. |
| CRM-14 | Lost 3; Discovery Scheduled | Same clicks | Lost/Archived; Discovery Date/event preserved; CAL event not deleted; DSH source −1/Lost +1. | Calendar plus common evidence. |
| CRM-15 | Lost 4; Assessment Presented | Same clicks | Lost/Archived; external services unchanged; DSH source −1/Lost +1. | Common evidence. |
| CRM-16 | Lost 5; Improvement Plan Sent | Same clicks | Lost/Archived; external services unchanged; DSH source −1/Lost +1. | Common evidence. |
| CRM-17 | `AT Reactivate`; Nurture | `Pipeline → Reactivate Nurtured Prospect → Yes`; after completion refresh Dashboard | Lead Found; Next Action Generate Executive Snapshot; keyed Reactivated activity; one Executive Snapshot follow-up. Services unchanged. DSH Nurture −1/Lead +1. | Common evidence. Fail if direct re-entry skips Lead Found. |

## Invalid, terminal, and retry tests

| ID | Purpose / time | Exact actions | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| CRM-18 | Block Project→Nurture; 3 min | Select Project Started fixture; `Pipeline → Move to Nurture`; click `OK` on invalid-transition alert. | WB unchanged; no service/dashboard/count change. | Before/after and alert. Fail if changed; stop lifecycle phase. |
| CRM-19 | Block Project→Lost; 3 min | Same fixture; `Pipeline → Mark Lost`; `OK`. | Unchanged everywhere. | Same. |
| CRM-20 | Client terminal; 5 min | On Client fixture try `Pipeline → Move to Nurture`, `Mark Lost`, and `Confirm Improvement Plan Sent`; dismiss each alert. | Client remains; no new effects. | Three alerts and counts. |
| CRM-21 | Lost terminal; 5 min | On Lost fixture try Move to Nurture, Reactivate, and a Status dropdown change to Lead Found. | Lost remains/restores; no effects. | Alerts/row. |
| CRM-22 | Nurture direct re-entry blocked; 4 min | On fresh Nurture fixture use Status dropdown to Executive Snapshot Sent; then try `Pipeline → Confirm Executive Snapshot Sent`. | Direct change restored/blocked; only CRM-17 path works. | Row/alert/reconciliation. |
| CRM-23 | Skip stage; 5 min | On Lead Found choose Status `Digital Business Assessment Presented`, then try `Pipeline → Confirm Assessment Presented`. | Both blocked/restored; no effects. | Before/after counts. |
| CRM-24 | Idempotency; 15 min | Repeat each applicable explicit confirmation on its already-confirmed fixture. For Project Started/Client repeat conversion/onboarding actions. For Discovery use CAL-02 exact retry procedure. | Status same; Complete marker; no duplicate keyed activity, follow-up, Client, Project, folder, event, invitation; missing effect repairs if deliberately removed in later tests. | Count IDs before/after. Fail on any duplicate. Do not delete duplicate before evidence. |

# Phase 3 — Manual Editing

| ID | Purpose / time | Exact actions/data | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| MAN-01 | Valid dropdown; 5 min | On `AT Manual Known` at Lead Found click Status dropdown → `Executive Snapshot Sent`. | WB controlled transition, keyed manual-change activity, Discovery Meeting follow-up, timestamps/Complete marker; DSH moves; GM/CAL/DRV unchanged. | Full transition evidence. Standard recovery. |
| MAN-02 | Valid branches; 8 min | On two known-snapshot fixtures choose `Nurture` and `Lost` from Status dropdown. | Same results as CRM-07/12; no duplicates. | Both rows/effects. |
| MAN-03 | Invalid jump; 4 min | On Lead Found choose `Improvement Plan Sent`. Click `OK` on alert. | Prior Status restored; no other change. | Before/after grid and counts. |
| MAN-04 | Backward/terminal invalid; 6 min | On Project Started choose Nurture then Lost; on Client choose Lead Found; on Lost choose Nurture. | Every value restored; adjacent fields/effects unchanged. | All attempts. |
| MAN-05 | Single-cell paste; 4 min | Copy text `Executive Snapshot Sent`; double-click only the Status cell of a fresh Lead Found known-snapshot row; paste; press Enter. | Accepted exactly as MAN-01. | Row/effects. |
| MAN-06 | Same-value paste; 3 min | Copy current Status and paste into same cell. | Idempotent; no new effect/count. | Counts/marker. |
| MAN-07 | Multi-row paste with snapshots; 6 min | Select two Status cells on rows with durable snapshots. Paste two lines: `Client` newline `Lost`. | Both pasted values rejected; each prior snapshot restored and verified; each row Reconciliation Required; adjacent cells unchanged. | Before/paste/after screenshot or recording. |
| MAN-08 | Multi-row paste without snapshots; 6 min | On two freshly copied legacy rows with no controlled transition, paste the same two-line values into Status. | Both Status cells blank; rows Reconciliation Required; no fabricated stage/effects. | Cells and details. |
| MAN-09 | Adjacent-column paste; 6 min | Copy a 2×2 block containing Status=`Client` and adjacent field=`ADJACENT-KEEP-1/2`; paste across Status plus adjacent column on two fixtures. | Status restores/clears per evidence; adjacent cells remain `ADJACENT-KEEP-1/2`; no other mutation. | Before/source/after grid. Fail immediately on adjacent overwrite. |
| MAN-10 | Missing oldValue with snapshot; 5 min | Clear a known-snapshot Status cell, then paste an allowed value so Sheets event omits oldValue where supported. If browser still supplies oldValue, record `Blocked` rather than guessing. | Durable snapshot supplies prior proof; allowed transition succeeds or invalid restores. | Trigger execution/row. |
| MAN-11 | Missing oldValue without snapshot; 5 min | On `AT Manual Unknown`, clear Status, then paste `Client`. | Unverified Status cleared, Reconciliation Required, clear notice; no effects. | Alert/row/counts. |
| MAN-12 | Downstream failure; 8 min | Protect Activity Feed rows from Brian: Activity Feed → `Data → Protect sheets and ranges` → Sheet → `Set permissions` → restrict. Perform valid dropdown transition. | Either prior state restored or truthful confirmed state with Reconciliation Required; no false Complete. After unprotecting, repeat matching explicit action once; one activity/follow-up. | Error, marker, recovery. Restore protection immediately after capture. |
| MAN-13 | Restoration failure; 6 min | Protect only fixture Status cell against Brian; from a second authorized account perform an invalid edit if feasible. If permissions prevent the edit itself, record `Blocked`. | No adjacent mutation; clear failure; persisted value documented; no false success. | Protection/error/row. Remove protection. |
| MAN-14 | Undo/autofill; 6 min | Drag fill handle across two Status rows, then use browser/Sheets Undo once. | Multi-cell operation fails closed; no matrix bypass; rows reconciled; adjacent fields safe. | Screen recording and final rows. |

# Phase 4 — Calendar

Use `AT Calendar Exact` at Executive Snapshot Sent. Search Calendar for the company before and after each case.

| ID | Purpose / time | Exact actions/data | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| CAL-01 | Initial event; 8 min | `Sales Workflow → Create Discovery Call`; tomorrow, `2:00 PM`, `30`; click OK for each prompt. | One exact event/invitation; WB Event Verified and Discovery Scheduled; GM invitation; DRV brief; DSH +1. | Event ID/time/guest plus row. |
| CAL-02 | Exact retry; 6 min | Using a disposable copy/fixture where event exists but lifecycle reconciliation is incomplete, rerun with the exact same date/time/duration. | Reuse one event; no second invitation; missing effects repaired. | Calendar and guest counts. |
| CAL-03 | Rapid double invocation; 5 min | Double-click Create Discovery Call menu item or have secondary session trigger immediately; enter identical values. | Lock produces at most one event/invitation. | Execution timestamps/search counts. |
| CAL-04 | Different time; 5 min | On existing operation rerun and enter same date, `3:00 PM`, `30`. | Rejected; original event/key/date retained; explicit reschedule required. | Alert and Calendar. |
| CAL-05 | Stored-ID time mismatch; 7 min | In Calendar edit verified event start to 3:00 PM, save and send update. Retry original exact 2:00 operation. | Mismatch not reused; reconciliation required; no new invitation. | Before/after event and row. Restore event after capture. |
| CAL-06 | Stored-ID key mismatch; 7 min | Edit event description and remove/change `Lifecycle Operation:` text; save. Retry. | Event rejected; reconciliation required; no new event. | Description and marker. Restore description only after evidence. |
| CAL-07 | Duplicate exact marked event; 8 min | Duplicate the verified test event manually, preserving exact time/description. Retry exact operation. | Conflict/ambiguity; no third event. | Search showing two and error marker. Delete manual duplicate after capture. |
| CAL-08 | Reschedule; 8 min | Cancel/delete old test event and preserve evidence. Clear/reconcile old operation only through an approved operator procedure; if no explicit reschedule UI exists, record `Blocked` and do not edit marker fields. | No old event treated as current; no silent key rewrite. | Audit trail. Do not invent workflow. |
| CAL-09 | Cancellation; 5 min | Cancel verified event in Calendar; retry same operation. | Cancelled event not valid/reused; fail closed/reconcile; no blind duplicate. | Cancelled event and row. |
| CAL-10 | API failure before insert; 6 min | Apps Script → Services → Calendar API → remove/disable in disposable project; revoke Calendar authorization if needed. On fresh fixture schedule. | No event/invitation/Status advancement; truthful error. | Error/search/row. Re-enable service. |
| CAL-11 | Ambiguous post-insert; 10 min | Use only an existing approved test harness/service interruption capable of failing after insert. If none exists, record `Blocked`; do not edit code. | Exact event reconciled or Ambiguous/Reconciliation Required; no blind retry. | Harness log/event/row. |
| CAL-12 | Permission failure; 6 min | Revoke Apps Script Calendar access from Google Account permissions; run scheduling on fresh fixture. | No advancement/event; actionable authorization failure. | Permission/error/search. Re-authorize through normal prompt. |
| CAL-13 | CalendarApp fallback; 8 min | Disable Advanced Calendar service only; use fresh fixture; schedule tomorrow 2:00/30; retry exact operation. | One fallback event with operation in description; exact retry reuses; no Meet requirement assumed; no duplicate. | Event description/counts. Re-enable Advanced service. |
| CAL-14 | Concurrent users; 10 min | Primary and secondary browsers select same fresh fixture. Count down and both click Create Discovery Call, enter identical values, submit. | At most one event/invitation and one durable operation; other session safely reconciles/fails. | Both recordings/logs and Calendar search. |

# Phase 5 — Gmail

| ID | Purpose / time | Exact actions/data | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| GML-01 | Snapshot draft; 5 min | Select fresh Lead Found row; `Sales Workflow → Create Outreach Gmail Draft`; authorize/Allow; open Gmail Drafts. | One correct tester draft; Status unchanged; Next Action Confirm Executive Snapshot Sent; DRV/CAL unchanged; DSH lifecycle unchanged. | Draft ID/content/attachments and row. |
| GML-02 | Assessment draft; 6 min | On eligible fixture `Pipeline → Send Digital Business Assessment`; open Drafts. | Draft only, correct guest/company, PDFs or documented link fallback; Status unchanged. | Draft/attachments/row. |
| GML-03 | Proposal path; 5 min | `Sales Workflow → Generate Improvement Plan`, then use applicable draft/package action documented by UI. Do not claim a separate proposal-draft menu if none appears. | Improvement Plan content correct; no Status change until explicit confirmation. | Modal/PDF/draft and row. |
| GML-04 | Regeneration; 5 min | Repeat GML-01 and GML-02 once on same fixtures. | Behavior consistent; lifecycle unchanged; Activity Feed truthful. Any second draft count documented. | Draft IDs/counts. |
| GML-05 | Failed draft; 5 min | Blank tester Email on fresh fixture; run Create Outreach Gmail Draft. Then restore email, revoke Gmail permission, rerun. | No false success/send/Status advancement; actionable error. | Error, Drafts/Sent search, row. Re-authorize. |
| GML-06 | Duplicate prevention; 5 min | After GML-05 restore dependency and repeat once. | No misleading duplicate evidence; any duplicate draft behavior exactly documented. | IDs/counts/activity. |
| GML-07 | No automatic send; 4 min | Open Gmail Sent and guest inbox after all draft actions. | No message sent by draft workflow; only manually sent test mail/invitations present. | Sent/Drafts/inbox screenshots. Fail on automatic send. |

# Phase 6 — PDF Generation

Run PDF-01–05 once for each: Executive Snapshot, Audit Report, Proposal, Discovery Call Brief. Use menu paths: `Sales Workflow → Generate Executive Snapshot`, `Generate Digital Business Assessment`, `Generate Improvement Plan`, and `Create Discovery Call` for the brief.

| ID | Purpose / time | Exact actions | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| PDF-01 | Generate all; 12 min | Select correct fixture and invoke each menu path; open each Drive PDF. | Correct synthetic company/contact/site/service/evidence; WB artifact fields update but lifecycle Status does not advance from generation. | PDFs plus source rows. |
| PDF-02 | Brand/layout; 8 min | Review every page at 100% and mobile/fit-width view. | Black/white/gold, readable, no clipping/overlap/blank critical page. | Page screenshots. Fail on client-facing defect. |
| PDF-03 | Evidence truthfulness; 10 min | Compare scores/findings/recommendations/dates/meeting details to source row and Calendar. | Exact match; no fabricated/placeholder evidence. | Side-by-side captures. |
| PDF-04 | Filenames; 5 min | Inspect Drive metadata. | Exact `Executive Snapshot.pdf`, `Audit Report.pdf`, `Proposal.pdf`, `Discovery Call Brief.pdf` in correct company test folder. | Folder/file metadata. |
| PDF-05 | Regeneration; 8 min | Record IDs/counts, rerun each generator, inspect folder. | Intentional update/replacement; no uncontrolled duplicates. | Before/after IDs/counts. |
| PDF-06 | Lifecycle isolation; 7 min | Compare Status before/after every generation and regeneration; inspect Activity Feed. | Byte-for-byte Status unchanged; activities say generated/created only. DSH confirmed metrics unchanged. | Rows/activity/dashboard. |
| PDF-07 | Failure; 8 min | Temporarily remove Brian’s access to test brand asset/folder or blank required field; generate on fresh fixture. | Controlled fallback/error; no false Status advancement. | Error/output/row. Restore access/data. |

# Phase 7 — Drive Operations

| ID | Purpose / time | Exact actions/data | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| DRV-01 | New folder; 5 min | Fresh unique company; `Sales Workflow → Run Full Prospect Package`. | One company root/expected artifacts; WB Status unchanged; GM draft behavior documented; CAL none; DSH lifecycle unchanged. | Folder tree/IDs and row. |
| DRV-02 | Existing folder; 5 min | Repeat DRV-01. | Same root reused; no duplicate child/root. | Before/after folder IDs. |
| DRV-03 | Duplicate folder conflict; 6 min | Manually create two same-name test roots; run package. | Deterministic safe choice or controlled failure; no unverified destination mutation. | Both folder IDs/result. Clean manual duplicates after evidence. |
| DRV-04 | Client verification; 7 min | Fresh Improvement Plan Sent fixture; `Pipeline → Record Improvement Plan Accepted / Start Project → Yes`. | Unique persisted Client ID/company/site/Onboarding verified before Project Started. | Client/prospect markers. |
| DRV-05 | Project verification; 7 min | Continue DRV-04. | Unique Project ID/client/company/service/status verified before advancement. | Project/prospect. |
| DRV-06 | Duplicate Client; 7 min | Copy matching Client row to create two matches; use `AT Duplicate Identity` and start project. | Prospect unchanged; Reconciliation Required; no false success. | Duplicates/error/prospect. Remove manual duplicate after capture. |
| DRV-07 | Duplicate Project; 7 min | Copy matching active Project row; repeat supported action. | No advancement/third Project; reconciliation truthful. | Rows/count/error. |
| DRV-08 | Partial Client; 8 min | Protect Projects sheet before starting fresh conversion so Client can write but Project cannot. | Prospect unchanged; Client partial marked; retry after unprotect reuses one Client and completes. | Failure/recovery counts. |
| DRV-09 | Partial Project; 8 min | Protect prospect Status/full row after prerequisites where permissions permit; start conversion. If pre-protection prevents all operation, record Blocked. | Prior Status unchanged/restored; Project partial identified; retry reuses one Project. | Failure/recovery evidence. |
| DRV-10 | Workspace failure; 6 min | Remove access to isolated client folder/root before conversion. | No false advancement; actionable reconciliation. | Error/folder/row. Restore access. |
| DRV-11 | Same-stage recovery; 8 min | On disposable fixture delete one expected test follow-up/activity or make workspace incomplete; repeat matching explicit action once. | Missing effect repaired once; no duplicate Client/Project/folder/event. | IDs/counts before/after. |

# Phase 8 — Dashboard

For every DSH test: first `Rogers Holdings OS → System → Refresh Executive Dashboard`, then `Navigate → Open Executive Dashboard`; manually count source sheets and record the calculation.

| ID | Purpose / time | Exact verification | Expected / evidence / recovery |
| --- | --- | --- | --- |
| DSH-01 | Total leads; 3 min | Count nonblank prospect rows under documented rule. | Widget equals count. Capture count formula/range and widget. Fail → refresh once, then log defect. |
| DSH-02 | Pipeline; 4 min | Count every approved Status plus unknown legacy fixtures. | Each stage exact; unknown not silently promoted. Capture filtered rows/widget. |
| DSH-03 | Snapshots Sent; 3 min | Compare confirmed Snapshot Sent rows versus generated-only rows. | Metric uses confirmed events, not artifacts. |
| DSH-04 | Discovery; 3 min | Compare scheduled rows/keyed activities/events. | No retry inflation. |
| DSH-05 | Assessments; 3 min | Compare generated activities and presented Status separately. | Semantics remain separate. |
| DSH-06 | Plans Sent; 3 min | Compare confirmed rows versus generated PDFs. | Only confirmed sent count. |
| DSH-07 | Clients/Lost/win rate; 4 min | Manually calculate Client ÷ (Client+Lost). | Counts/formula exact. |
| DSH-08 | Client/revenue; 4 min | Sum unique verified Clients/contract values. | Summary exact. |
| DSH-09 | Projects; 3 min | Count Projects by status/progress. | Widgets exact. |
| DSH-10 | Follow-Up queue; 4 min | Count open/overdue/completed rows. | Counts/order exact. |
| DSH-11 | Activity/recent; 3 min | Compare latest Activity Feed rows. | Correct company/date/type once. |
| DSH-12 | Next Actions; 3 min | Compare sample rows at every stage. | Exact stage-to-action mapping. |
| DSH-13 | Health; 4 min | Run Health Check healthy, then during one revoked-service failure. | Indicator reflects real state and clears after recovery. |
| DSH-14 | Reconciliation; 3 min | Filter Lifecycle Operation State=`Reconciliation Required`. | All failure fixtures discoverable with actionable Details. |
| DSH-15 | Empty state; 5 min | In a separate disposable copy use `System → Reset Test Data` only after confirming copy; refresh dashboard. | No error/stale sample/misleading layout. Capture before reset and empty dashboard. Never run on primary acceptance fixture. |

# Phase 9 — Follow-Ups

| ID | Purpose / time | Exact actions | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| FUP-01 | Stage creation; 8 min | Review Follow-Ups after CRM-01–06 and branches via `Navigate → Open Follow-Ups`. | Exactly one open expected type/date/IDs/priority/owner per stage. | Rows linked to prospects. |
| FUP-02 | Prior completion; 5 min | Inspect prior task after a transition. | Completed=true and date once; not deleted. | Before/after task IDs. |
| FUP-03 | Manual completion; 5 min | Select open test follow-up row; `Follow-Ups → Complete Follow-Up`; follow prompts/confirm button shown. | Completion fields/activity accurate. | Row/activity. |
| FUP-04 | Reopen/new; 5 min | Select prospect/client row as required; `Follow-Ups → Create Follow-Up`; enter prompted tester values/due date; confirm. | New intentional open task; completed history preserved. | Both rows. |
| FUP-05 | Retry dedupe; 4 min | Repeat matching lifecycle confirmation. | Existing expected open task remains; not completed/recreated. | IDs/counts. |
| FUP-06 | Failure retry; 7 min | Protect Follow-Ups sheet; perform valid transition; capture; unprotect; repeat matching explicit action. | Reconciliation Required then exactly one repaired task. | Marker and counts. |
| FUP-07 | Client welcome; 4 min | Repeat Complete Client Onboarding on Client fixture. | Exactly one open Client Welcome Task. | Follow-Up IDs. |
| FUP-08 | Lost archival; 4 min | Move fixture with open task to Lost. | All open tasks completed/archived once; none new. | Rows/activity. |
| FUP-09 | Same-company isolation; 5 min | Create two same-company prospects with unique IDs; trigger same follow-up stage. | Tasks retain correct related Prospect IDs; no suppression. | Prospect/Follow-Up IDs. |

# Phase 10 — Legacy Data

| ID | Purpose / time | Exact actions/data | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| LEG-01 | Unknown Status; 4 min | Set fixture Status text to `Legacy Review Pending` before trigger/snapshot setup; run `Pipeline → Run Next Action`. | Error/controlled prompt; value unchanged; no confirmed stage/effect. | Row/alert/counts. |
| LEG-02 | Unknown Next Action; 3 min | Set Next Action `Legacy Telephone Review`; do not change Status; run audit in LEG-05. | Value retained/inventoried; no lifecycle write. | Row/audit. |
| LEG-03 | Artifact values; 6 min | Seed separate rows with Draft Created, Gmail Draft Created, Executive Snapshot Generated, Audit Complete, Audit Package Sent, Proposal Sent, Won, Active. Run audit and Dashboard refresh. | Byte-for-byte preserved; not counted/promoted as confirmed stages. | Fixture grid/audit/dashboard. |
| LEG-04 | Legacy actions; 5 min | Put `Convert to Client` and `Start Project` in Next Action on Improvement Plan Sent fixtures; select row; `Pipeline → Run Next Action`; review prompt and cancel once, then confirm on separate fixture. | Routes to explicit Record Improvement Plan Outcome; no advancement without confirmation. | Prompts/rows. |
| LEG-05 | Audit accuracy; 5 min | `System → Audit Legacy Lifecycle Values`; wait; screenshot modal; click close/X. | Correct row/company/field/value list. | Modal/source comparison. |
| LEG-06 | Audit nonmutation; 4 min | Record row timestamps/activity count before and after LEG-05. | No cell/timestamp/activity/marker change. | Before/after exports. |
| LEG-07 | No-snapshot edit; 4 min | On copied legacy fixture paste `Client` into Status. | Status clears; Reconciliation Required; no effects. | Alert/row. |
| LEG-08 | Evidence-based reconciliation; 6 min | Review synthetic proof; manually restore only last verifiable raw Status or leave blank; then use the correct explicit menu action from a valid state. Never infer from artifact label. | Full audit trail; confirmed stage only after explicit action. | Proof/before/after/activity. |

# Phase 11 — Failure Injection

Only use the disposable workbook/project and Brian-controlled permissions. Record last verified state before every injection. After evidence capture, restore the dependency and perform the stated recovery. If the checkpoint cannot be produced without editing implementation code, mark `Blocked`.

| ID | Purpose / time | Exact injection and action | Expected behavior | Evidence, fail, recovery |
| --- | --- | --- | --- | --- |
| FAIL-01 | Calendar outage; 6 min | Disable Advanced Calendar and revoke Calendar authorization; schedule fresh fixture. | No event/Status advancement; truthful error. Restore/re-authorize; retry creates one. | Error/search/row/recovery. |
| FAIL-02 | Post-insert ambiguity; 8 min | Use approved existing harness only. Trigger failure after insert/before lifecycle commit; retry exact operation. | One event reconciled or Ambiguous marker; no duplicate. | Harness/executions/event count. If no harness, Blocked. |
| FAIL-03 | Gmail failure; 5 min | Revoke Gmail authorization; create fresh outreach draft. | No send/false advancement; actionable failure. Re-authorize and retry once. | Permission/error/Drafts/Sent/row. |
| FAIL-04 | Drive failure; 6 min | Remove Brian access to test root; generate package/PDF. | No false success/advancement; partial artifact clear. Restore and retry upsert. | Error/folder counts/row. |
| FAIL-05 | Trigger interruption; 7 min | Protect Activity Feed or Follow-Ups; perform valid manual Status transition. | Restored or truthful confirmed Status with Reconciliation Required; adjacent safe. Unprotect/repeat explicit action repairs once. | Error/marker/recovery. |
| FAIL-06 | Concurrent edits; 8 min | Two browsers edit same fixture Status to different allowed/invalid destinations on countdown. | Lock produces one valid truthful result; other fails safely; no duplicate effects. | Both recordings/executions/row. |
| FAIL-07 | Concurrent scheduling; 8 min | Repeat CAL-14 with fresh fixture. | One event/invitation/operation. | Both sessions and Calendar. |
| FAIL-08 | Client re-read failure; 7 min | Protect Clients sheet or seed duplicate matches; start project. | Prospect unchanged; Reconciliation Required; truthful message. Restore/remove duplicate; retry reuses/repairs. | Client/prospect/counts. |
| FAIL-09 | Project re-read failure; 7 min | Protect Projects sheet or seed duplicate active matches; start project. | Prospect unchanged; no duplicate; reconciliation. Restore and retry. | Project/prospect/counts. |
| FAIL-10 | Final commit failure; 8 min | Use approved harness or permission timing to block prospect write after prerequisites. Do not edit code. | Prior Status restored and verified or explicit Reconciliation Required; no unverified rollback claim. | Execution/row/prerequisites. Blocked if checkpoint unavailable. |
| FAIL-11 | Activity failure; 6 min | Protect Activity Feed; valid explicit transition. | Status truthfully marked Reconciliation Required if committed; after unprotect same action creates one keyed activity. | Marker/count/recovery. |
| FAIL-12 | Follow-Up failure; 6 min | Protect Follow-Ups; valid explicit transition. | Reconciliation Required; after unprotect same action repairs once. | Marker/task IDs. |
| FAIL-13 | Dashboard failure; 5 min | Protect/temporarily hide required dashboard range/sheet from operator where feasible; complete core action. | Core records remain truthful; refresh after restoration repairs display without duplicates. | Core rows/error/recovered dashboard. |
| FAIL-14 | Recovery audit; 8 min | For FAIL-01–13, verify dependencies restored; repeat only supported same action once; search all external/sheet effects. | Operation Complete or documented blocked state; exactly one intended side effect; truthful timestamps/messages. | Consolidated before/after count sheet. |

# Phase 12 — Final Release Gate

Estimated time: 45 minutes.

1. Confirm every test ID in the execution log has `Pass`, `Fail`, `Blocked`, or `Not Run` and evidence.
2. Re-run locally against the exact candidate: `git diff --check`, `npm run status`, `npm run validate`, `npm run test:lifecycle`. Paste outputs into evidence.
3. In the disposable workbook run `Rogers Holdings OS → System → System Health Check`, capture, then `Refresh Executive Dashboard`, capture.
4. Reconcile Gmail Drafts/Sent, Calendar events/invitations, Drive folders/files, Clients, Projects, Follow-Ups, Activity Feed, and lifecycle markers. Record duplicate counts.
5. Complete every Final Release Gate row in the official plan and execution log with result, evidence, reviewer, and date.
6. Any false lifecycle advancement, external duplicate, adjacent-cell corruption, unexplained data loss, missing reconciliation marker, real-recipient exposure, or unresolved `Fail`/`Blocked` means `Not Ready`.
7. Brian signs only the Product Owner/assigned roles he is authorized to sign. Independent sign-offs must be completed by the named reviewer, not on their behalf.
8. Do not deploy from this runbook. A separate explicit production authorization is required after approval.

## Final decision procedure

- `Ready for Production`: every mandatory test passed, no unresolved blocker, all evidence reviewed, all required sign-offs complete.
- `Ready after listed corrections`: only explicitly documented non-blocking corrections remain and Release Manager/Product Owner accept them in writing.
- `Not Ready`: any blocker, unresolved failed/blocked mandatory test, missing evidence, or incomplete sign-off.

# Quick Acceptance Checklist

Print this page. The execution log remains the authoritative evidence record.

## Setup

- □ Disposable workbook ID differs from production.
- □ Test-only accounts, guest email, Calendar, and Drive root confirmed.
- □ Candidate/project ID and source fingerprint recorded.
- □ Menu loads; Health Check passes; timezones agree.
- □ Reconciliation headers and workbook structure verified.
- □ Synthetic fixtures created; baseline counts/screenshots captured.

## Core workflow

- □ CRM-01 Snapshot Sent passed; generation alone did not advance Status.
- □ CRM-02 Discovery Scheduled passed with exactly one invitation/event.
- □ CRM-03 Assessment Presented passed; generation alone did not advance.
- □ CRM-04 Improvement Plan Sent passed; PDF/draft alone did not advance.
- □ CRM-05 Project Started passed after unique persisted Client/Project verification.
- □ CRM-06 Client passed with Closed Date, Active Client, linked Project, one welcome task.
- □ Nurture/Lost branches and explicit Nurture reactivation passed.
- □ Project Started, Client, and Lost terminal restrictions passed.
- □ Same-stage retries repaired effects without duplicates.

## Safety and services

- □ Valid/invalid manual edits passed.
- □ Multi-row and adjacent-column pastes failed closed without adjacent corruption.
- □ Missing prior state cleared Status and marked reconciliation.
- □ Calendar exact retry, mismatch, conflict, cancellation, fallback, permission, and concurrency passed.
- □ Gmail drafts used test recipients only; nothing sent automatically.
- □ All PDFs passed branding, content, filenames, regeneration, and lifecycle isolation.
- □ Drive folder, Client, Project, ambiguity, partial failure, and recovery passed.
- □ Follow-Up creation/completion/retry/deduplication passed.
- □ Legacy audit was accurate and non-mutating; no artifact value promoted.
- □ Failure injections produced truthful state and safe recovery.

## Verification and sign-off

- □ Every Dashboard widget reconciles to source sheets; empty state passed.
- □ `git diff --check` passed.
- □ `npm run status` passed.
- □ `npm run validate` passed.
- □ `npm run test:lifecycle` passed.
- □ Final Health Check passed.
- □ No unexpected duplicates, data loss, real recipients, privacy exposure, or unresolved reconciliation.
- □ Every test has result, evidence, reviewer, and date.
- □ All defects are severity-assigned and retested or explicitly accepted.
- □ QA Director signed.
- □ Principal Apps Script Engineer signed.
- □ Product Owner signed.
- □ Release Manager signed and recorded rollback/deployment plan.

Final decision: □ Ready for Production  □ Ready after listed corrections  □ Not Ready

Brian Rogers signature/date: _________________________________________________
