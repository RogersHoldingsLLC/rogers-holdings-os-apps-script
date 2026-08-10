# First Client Runbook

Product: Business Optimization Platform

Candidate: `1.0.0-rc`

Build: `2026.08.10-rc`

Target release: `1.0.0`

Operator: Brian

Release date: `TBD — only after final acceptance and production approval`

Release state: release candidate; not production-ready or released

This runbook is a release-candidate operating procedure for Version 1.0 first-client acceptance. It is not production approval. Use it with a paying client only after the required release approval and deployment gates are complete. Review every customer-facing file and Gmail draft before sending it; generating a file or draft does not confirm that the customer received or reviewed it.

## Before Starting

1. Open the production Business Optimization Platform workbook.
2. Confirm the expected Google account is active for Sheets, Gmail, Calendar, and Drive.
3. Open **System → System Health Check**. Stop if any unexplained failure appears.
4. Confirm the client has authorized the engagement and that their contact details may be stored.
5. Collect the business name, website, primary contact, email, phone, service interest, and any discovery notes.

## 1. Create the Prospect

1. Open **Navigate → Open Master Prospect Tracker**.
2. Add one prospect row or use **Sales Workflow → Bulk Prospect Import** when appropriate.
3. Verify the business name, unique Prospect ID, website, contact, email, phone, owner, and service.
4. Set or verify the confirmed CRM Status is **Lead Found**.
5. Open **Workspaces → Open Prospect Workspace** and confirm the correct prospect is displayed.
6. If anything is duplicated or the wrong row opens, stop and correct the prospect record before continuing.

## 2. Run the Website Audit

1. Select the prospect row.
2. Run the approved real Website Audit Tool workflow.
3. Verify `Audit Source` is **Website Audit Tool**.
4. Review the Audit Score, Audit Outcome, Priority Tier, Summary/Notes, findings, and any stored visual evidence.
5. Do not use Quick Internal Audit or placeholder information for client-facing deliverables.
6. If the endpoint fails or required audit fields are incomplete, stop. Do not generate a client-facing assessment from unverified data.

## 3. Prepare and Send the Executive Snapshot

1. Select the prospect and choose **Sales Workflow → Generate Executive Snapshot**.
2. Open the resulting PDF and review the company name, score, observations, recommendations, branding, page layout, and contact information.
3. Choose **Sales Workflow → Create Outreach Gmail Draft**.
4. Review the recipient, subject, body, tone, links, and attachment before manually sending it.
5. Confirm there is only one matching draft for the recipient and subject.
6. After the snapshot has actually been sent, choose **Pipeline → Confirm Executive Snapshot Sent**.
7. Verify Status, Next Action, Activity Feed, Follow-Up, and Executive Dashboard reflect the confirmed event.

## 4. Schedule the Discovery Call

1. Select the prospect and choose **Sales Workflow → Create Discovery Call**.
2. Enter the agreed date, start time, and duration. Verify the timezone and attendee email.
3. Confirm the Calendar event exists once, has the correct guest, and matches the agreed time.
4. Verify the prospect advances to **Discovery Meeting Scheduled** only after the Calendar event is verified.
5. Review the Discovery Call Brief before the meeting.
6. Use the meeting to confirm the owner’s priorities, constraints, desired outcomes, decision process, and next step.

## 5. Present the Digital Business Assessment

1. Choose **Sales Workflow → Generate Digital Business Assessment**.
2. Review `AuditReport.pdf`, `Proposal.pdf`, and `Outreach Email Draft.txt` in the prospect package folder.
3. Inspect the Digital Business Assessment for accurate findings, evidence, business impact, recommendations, branding, and readable page layout.
4. Present the assessment during the discovery or assessment meeting.
5. Only after it has actually been presented, choose **Pipeline → Confirm Assessment Presented**.
6. Verify Status, Next Action, Activity Feed, Follow-Up, and dashboard values.

## 6. Prepare and Send the Improvement Plan

1. Choose **Sales Workflow → Generate Improvement Plan**.
2. Review the client name, problem statement, proposed scope, deliverables, timeline, investment, assumptions, and next step.
3. If using **Pipeline → Send Digital Business Assessment** or **Sales Workflow → Run Full Prospect Package**, review the resulting Gmail draft and attachments before sending.
4. Confirm the package folder contains one active canonical assessment, one proposal, and one outreach text file.
5. Confirm Gmail contains only one exact matching draft for the intended recipient and subject.
6. Send the approved Improvement Plan manually.
7. Only after it has actually been sent, choose **Pipeline → Confirm Improvement Plan Sent**.
8. Verify Status, Next Action, Follow-Up, Activity Feed, and dashboard values.

## 7. Record Acceptance and Create the Project

1. Obtain clear client approval for the Improvement Plan.
2. Select the prospect and choose **Pipeline → Record Improvement Plan Accepted / Start Project**.
3. Review the confirmation carefully before proceeding.
4. Verify the platform created or reconciled exactly one Client record and one linked Project record.
5. Verify the prospect Status is **Project Started** only after those records are persisted and verified.
6. Open **Workspaces → Open Client Workspace** and confirm the correct client, project, files, follow-ups, and activity are displayed.
7. Open the Drive client folder and verify the folder structure and existing prospect package files.
8. Open **Navigate → Open Projects** and confirm owner, service, status, dates, progress, and client linkage.
9. Open **Navigate → Open Follow-Ups** and confirm the Project Kickoff task exists once.

## 8. Complete Client Onboarding

1. Confirm the kickoff requirements, contacts, access, communication schedule, responsibilities, and initial milestones are complete.
2. Choose **Pipeline → Complete Client Onboarding** only after onboarding is actually complete.
3. Verify the prospect Status becomes **Client**, the Client record becomes active, and the Project remains correctly linked.
4. Verify the Client Welcome follow-up exists once and the obsolete kickoff follow-up is completed.
5. Refresh the Client Workspace and Executive Dashboard.

## 9. Final Record Check

Before beginning paid delivery, confirm all of the following:

- The Master Prospect Tracker shows the truthful confirmed stage and Next Action.
- The Client record is unique and active.
- The Project record is unique, linked to the correct client, and ready for delivery.
- Follow-Ups contain no unexplained duplicates or overdue setup tasks.
- Activity Feed records the meaningful actions once and in the correct order.
- Drive contains the approved deliverables in the correct client folder.
- Gmail contains no unsent duplicate drafts.
- Calendar contains no duplicate discovery or kickoff events.
- Client Workspace and Executive Dashboard agree with the underlying records.
- No lifecycle row is marked **Reconciliation Required**.

If any record is ambiguous, duplicated, incomplete, or marked for reconciliation, stop the workflow. Preserve the evidence, run System Health Check, and resolve the inconsistency before performing the next client action.
