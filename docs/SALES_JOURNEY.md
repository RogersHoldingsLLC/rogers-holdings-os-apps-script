# Rogers Holdings OS Sales Journey

Rogers Holdings OS uses three customer-facing deliverables with distinct roles in the sales process.

## 1. Executive Snapshot

Filename:

- `Executive Snapshot.pdf`

Purpose:

- Get the meeting.
- Give the business owner a fast, respectful summary of practical opportunities.
- Make the next step feel low-friction and useful.

Use when:

- Starting cold or warm outreach.
- Following up after a website review is complete.
- Asking for a short review conversation.

Recommended language:

- Executive Snapshot
- Practical opportunities
- Recommended first step
- Digital health score
- Customer trust
- Local visibility
- Inquiry path

Avoid:

- Your website is bad.
- You are doing this wrong.
- You need us.
- Internal CRM or audit workflow language.

Recommended outreach behavior:

- Cold outreach should attach or reference `Executive Snapshot.pdf` first.
- Do not lead with the full assessment and improvement plan unless the current workflow requires it or the prospect has requested more detail.

## 2. Digital Business Assessment

Current filename:

- `Audit Report.pdf`

Customer-facing name:

- Digital Business Assessment

Purpose:

- Build trust during the meeting.
- Walk through findings, evidence, business impact, and priorities.
- Confirm what matters to the owner before discussing scope.

Use when:

- A meeting is scheduled.
- The owner asks for details behind the snapshot.
- Rogers Holdings needs to demonstrate the reasoning behind recommendations.

Important:

- Do not rename the file yet. Existing workflows depend on `Audit Report.pdf`.
- Use “Digital Business Assessment” in customer-facing conversation where appropriate.

## 3. Improvement Plan

Current filename:

- `Proposal.pdf`

Customer-facing name:

- Improvement Plan

Purpose:

- Close the next step.
- Translate findings into scope, timeline, deliverables, and investment.
- Confirm the initial work path.

Use when:

- The assessment has been reviewed.
- Priorities are confirmed.
- The business owner is ready to evaluate scope.

Important:

- Do not rename the file yet. Existing workflows depend on `Proposal.pdf`.
- Use “Improvement Plan” in customer-facing conversation where appropriate.

## Standard Consulting Workflow

Rogers Holdings OS now aligns every prospect-facing action around one consulting process:

1. Lead Found
2. Executive Snapshot Sent
3. Discovery Meeting Scheduled
4. Digital Business Assessment Presented
5. Improvement Plan Sent
6. Project Started
7. Client

## Purpose of Each Step

Executive Snapshot:

- Get the meeting.
- Give the owner a concise, respectful reason to review the opportunity.
- Keep outreach focused on practical business value.

Discovery Meeting:

- Confirm the business context.
- Understand the owner’s priorities before discussing scope.
- Decide whether a deeper review is useful.

Digital Business Assessment:

- Build trust during the meeting.
- Explain findings, evidence, business impact, and priority.
- Align the owner around the highest-impact improvements.

Improvement Plan:

- Close the next step.
- Convert confirmed priorities into scope, timeline, deliverables, and investment.
- Keep the work path clear and practical.

Project Kickoff:

- Move from recommendation to execution.
- Confirm first milestones, communication expectations, and responsibilities.

Client:

- Maintain the relationship after conversion.
- Track follow-ups, project progress, deliverables, and ongoing value.

## Recommended Flow

1. Generate the Executive Snapshot.
2. Use the snapshot in outreach, then run **Confirm Executive Snapshot Sent** only after it is actually sent.
3. Create the discovery Calendar event; only successful Calendar creation confirms **Discovery Meeting Scheduled**.
4. During the meeting, review the Digital Business Assessment, then run **Confirm Assessment Presented**.
5. Generate the Improvement Plan, send it, then run **Confirm Improvement Plan Sent**.
6. When accepted, run **Record Improvement Plan Accepted / Start Project**.
7. After onboarding is complete, run **Complete Client Onboarding**.

Generating, regenerating, previewing, auditing, creating files, or creating a Gmail draft never changes CRM Status. Use **Move to Nurture** or **Mark Lost** only for confirmed operator outcomes. Invalid stage jumps are blocked.

## Approved CRM Transition Matrix

| Current Status | Allowed next Status |
| --- | --- |
| Lead Found | Executive Snapshot Sent, Nurture, Lost |
| Executive Snapshot Sent | Discovery Meeting Scheduled, Nurture, Lost |
| Discovery Meeting Scheduled | Digital Business Assessment Presented, Nurture, Lost |
| Digital Business Assessment Presented | Improvement Plan Sent, Nurture, Lost |
| Improvement Plan Sent | Project Started, Nurture, Lost |
| Project Started | Client only |
| Client | Client only |
| Lost | Lost only |
| Nurture | Nurture only, unless **Reactivate Nurtured Prospect** explicitly confirms re-entry at Lead Found |

Manual edits use the same matrix. Multi-cell Status edits are rejected by the lifecycle handler. Each affected Status cell is restored from independently verified prior evidence; if no prior evidence exists, only that Status cell is cleared and the row is quarantined as **Reconciliation Required**. Adjacent pasted columns are never rewritten by lifecycle recovery. Nurture re-entry cannot be performed by directly editing Status.

## Retry and Reconciliation Behavior

- Lifecycle operations use a document lock and a durable operation key.
- Status, Next Action, Last Activity, confirmation time, and lifecycle operation evidence are committed together on the prospect row.
- If the final row write fails, the prior row is restored and verified when possible. If restoration cannot be verified, the row is marked **Reconciliation Required**.
- Follow-up and Activity Feed effects are idempotently reconciled. Repeating a confirmation checks and repairs incomplete downstream work rather than duplicating it.
- Discovery scheduling stores a Calendar operation key bound to prospect identity, exact start, exact end, and calendar identity, plus the event ID. A stored event is reused only when its operation evidence and exact time both match. A different-time event requires explicit rescheduling, and ambiguous/conflicting results block new invitations until reconciled.
- Client/project operations upsert and then re-read their persisted records before Status advances. IDs, company/client linkage, status, and service identity are verified; missing, duplicate, or ambiguous matches stop the lifecycle commit and remain marked for reconciliation. Partial operations can be repaired by repeating the same explicit action.
- **Audit Legacy Lifecycle Values** is read-only. It inventories unrecognized Status and Next Action values without converting artifact labels into confirmed customer events.

## Future Visual Evidence Plan

Future versions should add real evidence to the Executive Snapshot when available:

- Desktop screenshot
- Mobile screenshot
- Annotated first-screen observation
- Google Business evidence
- PageSpeed or performance evidence
- OCR-supported screenshot notes

Do not use fake screenshots or placeholder screenshots.
