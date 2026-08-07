# Prospect-to-Revenue Workflow v1

## Purpose

Prospect-to-Revenue Workflow v1 connects the existing prospect, Website Audit Tool API, Executive Brief, Gmail-draft, Follow-Up, Activity Feed, and lifecycle capabilities for one selected prospect.

Google Sheets remains the operational source of truth and Google Apps Script remains the automation layer. The workflow does not introduce a service, database, framework, or automatic email sending.

## Operator Flow

1. Select a row in `Master Prospect Tracker`.
2. Run **Validate Selected Prospect**.
3. Correct any fields reported as missing or invalid.
4. Run **Prepare Prospect for Outreach**.
5. The workflow reuses verified Website Audit Tool API evidence or acquires it, reconciles the Executive Brief and Digital Business Assessment package, and creates or updates one exact-match Gmail draft.
6. Review the Prospect Workspace, deliverables, evidence, recipient, subject, and Gmail draft.
7. Run **Approve for Manual Outreach** or **Request Changes**.
8. After approval, send the Gmail draft manually.
9. Run **Confirm Executive Brief Sent** only after the message was actually sent.

If preparation stops, correct the reported issue and run **Resume Prospect Workflow**. Previous successful work is preserved.

## State Model

CRM `Status` continues to represent confirmed external business events. Preparation state is kept separately:

- `Validation Status` and `Validation Details`
- `Inspection Status`, `Inspection Attempted At`, and `Inspection Completed At`
- `Workflow Status`, `Workflow Operation Key`, and `Workflow Details`
- `Review Status`, `Reviewed At`, and `Review Notes`

Every coordinated operation uses `PTR:<Prospect ID>:V1`. Activity Feed rows store both Prospect ID and Operation Key.

## Safety Boundaries

- Preparation never advances CRM Status.
- Apps Script never sends a prospect email.
- Gmail operations use the established exact recipient/subject reconciliation.
- `Approved` records Brian's decision; it does not send email.
- Calendar invitations remain a separate, explicit Brian-initiated action.
- Canonical `Website Audit Tool API` provenance qualifies for verified client-facing rendering; historical `Website Audit Tool` provenance remains accepted for compatibility.
- Failures persist recovery details and preserve successful prior work.

## Public Entry Points

- `validateSelectedProspectForRevenue()`
- `prepareProspectForOutreach()`
- `resumeProspectRevenueWorkflow()`
- `openProspectRevenueReview()`
- `approveProspectForManualOutreach()`
- `requestProspectRevenueChanges()`

The implementation is in `ProspectRevenueWorkflow.gs`.

## Verification

Run:

```bash
npm run validate
npm run test:prospect-revenue
npm run test:lifecycle
npm run test:audit-rendering
npm run test:ebi
npm test
```

Disposable-workbook acceptance has passed. Production deployment remains pending separate approval.
