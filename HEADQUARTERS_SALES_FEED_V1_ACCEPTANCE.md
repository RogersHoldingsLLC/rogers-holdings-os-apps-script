# Headquarters Sales Feed v1 — Acceptance Evidence

## Decision

Accepted for the disposable Business Optimization Platform acceptance environment on 2026-08-11. Production was not accessed, configured, or deployed.

## Target

- Workbook: `DISPOSABLE V1.0 ACCEPTANCE - 2026-07-10`
- Apps Script project: disposable acceptance project configured by `.clasp.json`
- Deployment description: `Headquarters Sales Feed v1 - disposable acceptance only`
- Deployment version: `5`
- Deployment ID: `AKfycbzeunHI13v5ab_Tv-uYkfxwSJZ2FDfeAGsuKERrrm7QvkCymJP-Y-3zQ023e2RzLyWrCA`
- Web-app URL: `https://script.google.com/macros/s/AKfycbzeunHI13v5ab_Tv-uYkfxwSJZ2FDfeAGsuKERrrm7QvkCymJP-Y-3zQ023e2RzLyWrCA/exec`
- Request version: `1.0`
- Evidence timestamp: `2026-08-11T16:06:48.373Z`

The acceptance token remains only in the disposable project's `HEADQUARTERS_SALES_FEED_TOKEN` Script Property. It is not recorded here.

## Authentication results

| Case | Result |
|---|---|
| Missing token | Rejected with generic `{ "error": "unauthorized" }` |
| Incorrect token | Rejected with generic `{ "error": "unauthorized" }` |
| Incorrect version with correct token | Rejected with generic `{ "error": "unauthorized" }` |
| Correct acceptance token and version | HTTP 200 with the v1 feed |

Apps Script `ContentService` returned HTTP 200 for the generic application-level unauthorized responses. No authentication detail, configured secret, or implementation detail was returned.

## Redacted response evidence

```json
{
  "version": "1.0",
  "generatedAt": "2026-08-11T16:06:48.373Z",
  "expiresAt": "2026-08-11T16:11:48.373Z",
  "source": {
    "system": "business-optimization-platform",
    "environment": "production"
  },
  "status": {
    "healthy": true,
    "partial": false
  },
  "sales": {
    "prospects": 14,
    "followUpsDue": 0,
    "overdueFollowUps": 13,
    "meetingsScheduled": 0,
    "assessmentsPresented": 0,
    "plansSent": 0,
    "clients": 0,
    "activeProjects": 0,
    "lostOpportunities": 0
  },
  "actions": "[13 privacy-verified action objects redacted]",
  "delivery": {
    "activeClients": 0,
    "activeProjects": 0,
    "dueSoon": 0,
    "overdue": 0
  },
  "revenue": {
    "connected": false
  }
}
```

The freshness interval was exactly 300,000 milliseconds (five minutes).

## Workbook reconciliation

Independent named-header inspection of the disposable workbook matched the response exactly:

| Metric | Workbook | Feed |
|---|---:|---:|
| Prospects | 14 | 14 |
| Follow-ups due today | 0 | 0 |
| Overdue follow-ups | 13 | 13 |
| Discovery meetings scheduled | 0 | 0 |
| Assessments presented | 0 | 0 |
| Improvement plans sent | 0 | 0 |
| Active clients | 0 | 0 |
| Active projects | 0 | 0 |
| Lost opportunities | 0 | 0 |
| Delivery due soon | 0 | 0 |
| Delivery overdue | 0 | 0 |

The workbook contained 13 incomplete follow-ups requiring attention, matching the 13 exported actions and making `status.partial: false` accurate.

## Privacy verification

- Every action used the exact v1 action schema.
- Every action ID matched the opaque `hq_` identifier format.
- No prohibited action keys were present.
- No exact company, client, contact, email, phone, notes, website, URL, folder, Drive ID, or Calendar ID value from the inspected source rows appeared in the response.
- No email, URL, or phone-number pattern appeared in the actions.
- No row numbers, secrets, stack traces, or debug details appeared.
- Revenue contained only `{ "connected": false }`.

## Determinism and mutation safety

- Two consecutive authenticated requests against unchanged workbook state produced identical business data and actions; only `generatedAt` and `expiresAt` changed.
- A third authenticated request was bracketed by direct reads of the authoritative ranges in `Master Prospect Tracker`, `Follow-Ups`, `Clients`, and `Projects`.
- All four copied ranges were byte-for-byte unchanged after the request.
- Static and fixture validation confirmed the feed module contains no sheet write operations.

## Validation

Passed:

- `npm run test:headquarters-sales-feed`
- `npm run validate` — 26 authoritative Apps Script files
- `npm run test:lifecycle`
- `npm run test:audit-rendering`
- `npm run test:ebi` — 7 fixtures
- `npm run test:prospect-revenue`
- `npm test` — 10 deployment-safety tests
- `git diff --check`

## Discrepancies and operational notes

- The first attempted correct-token test used an isolated browser clipboard that did not reach the system clipboard and was rejected. The transport harness was corrected to use a permission-restricted, non-persistent FIFO; the actual configured acceptance token then passed. This was a test-harness issue, not an endpoint defect.
- The local `PROJECT_MEMORY.md` previously stated that no acceptance deployment had occurred. It was corrected with this acceptance result.
- Source reconciliation confirmed the disposable project's `BusinessSnapshotIntake.gs` is byte-for-byte identical to the authoritative file on current `origin/main` (SHA-256 `9cef901b0c7837783a3d8b48bba300e89c74da3e233a649f7f5b5db16e855fe1`). The earlier apparent acceptance-only drift was caused by a stale local checkout, not divergent deployment code or a source-integrity defect.
- The local branch was fast-forwarded to the authoritative upstream baseline while preserving the Sales Feed work. The disposable deployment was not changed or redeployed, so its approved transport, workbook-reconciliation, privacy, determinism, and mutation-safety evidence remains the evidence for deployment version 5.
- Reconciliation exposed one uncommitted Sales Feed compatibility correction: assessment counts now target the canonical `Digital Business Assessment` state produced by lifecycle normalization instead of its historical alias. Deployment version 5 still contains the historical target; because the accepted workbook had zero assessment-stage prospects, this does not change any recorded acceptance count or conclusion. The corrected source is covered by deterministic tests but has not been redeployed.
- No production deployment or production token exists as part of this work.
