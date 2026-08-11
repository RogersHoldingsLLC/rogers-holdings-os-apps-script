# Headquarters Sales Feed v1

## Purpose

The Headquarters Sales Feed is a read-only, privacy-minimized integration boundary from Business Optimization Platform (BOP) to Rogers Holdings Headquarters. BOP owns every field definition and aggregation. Headquarters does not read arbitrary workbook cells and cannot write to BOP.

## Contract

An authenticated `POST` returns:

```json
{
  "version": "1.0",
  "generatedAt": "2026-08-11T14:00:00.000Z",
  "expiresAt": "2026-08-11T14:05:00.000Z",
  "source": {
    "system": "business-optimization-platform",
    "environment": "production"
  },
  "status": {
    "healthy": true,
    "partial": false
  },
  "sales": {
    "prospects": 0,
    "followUpsDue": 0,
    "overdueFollowUps": 0,
    "meetingsScheduled": 0,
    "assessmentsPresented": 0,
    "plansSent": 0,
    "clients": 0,
    "activeProjects": 0,
    "lostOpportunities": 0
  },
  "actions": [],
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

Action objects contain exactly `id`, `kind`, `stage`, `nextAction`, `dueAt`, `waitingDays`, `needsBrian`, and `lastActivityAt`.

## Field definitions and data sources

- `sales.prospects`: nonblank company rows in `Master Prospect Tracker`, matching the existing authoritative prospect-count rule.
- `sales.followUpsDue`: incomplete records in `Follow-Ups` whose `Due Date` is today in the script time zone.
- `sales.overdueFollowUps`: incomplete records whose `Due Date` is before today.
- `sales.meetingsScheduled`: prospects whose confirmed `Status` is `Discovery Meeting Scheduled`.
- `sales.assessmentsPresented`: prospects whose confirmed canonical `Status` is `Digital Business Assessment`. Historical `Digital Business Assessment Presented` values normalize to this canonical state before counting.
- `sales.plansSent`: prospects whose confirmed `Status` is `Improvement Plan Sent`. Generated documents and drafts do not count.
- `sales.clients` and `delivery.activeClients`: `Clients` records with a stable Client ID, a company identity, and exact `Active` status.
- `sales.activeProjects` and `delivery.activeProjects`: identified `Projects` records with a nonblank status other than `Completed`, `Cancelled`, or `Maintenance`.
- `sales.lostOpportunities`: prospects whose confirmed `Status` is `Lost`.
- `delivery.dueSoon`: active projects due today through seven days from today.
- `delivery.overdue`: active projects due before today.
- `actions`: overdue follow-ups first, follow-ups due today second, then confirmed prospect next actions. Prospect actions must match the authoritative `Next Action` dropdown, preventing arbitrary cell text from crossing the boundary. A prospect action is suppressed when its related due/overdue follow-up is already exported.

All reads use named headers. No column position is part of the contract.

## Authentication

The endpoint accepts only a JSON POST body:

```json
{
  "version": "1.0",
  "token": "<shared secret>"
}
```

Store the shared secret in Apps Script Script Properties under:

```text
HEADQUARTERS_SALES_FEED_TOKEN
```

The secret is not present in source, responses, logs, or query strings. Missing configuration, missing authentication, an incorrect token, malformed JSON, and an unsupported request version fail closed. Unauthorized responses are deliberately generic. Generate and install the production secret manually through an approved secure process; this repository does not generate it.

## Freshness

`generatedAt` is the feed build time. `expiresAt` is five minutes later. Headquarters must treat an expired response as stale and must not present it as current owner-dashboard data.

## Privacy rules

The feed never includes customer or prospect names, email addresses, phone numbers, notes, URLs, Drive IDs, Calendar IDs, workbook row numbers, internal evidence, or debug information. Free-form Follow-Up Type and Current Status text do not cross the boundary: follow-up action wording is fixed and stages are allowlisted. Prospect actions must use the authoritative dropdown. Action IDs are stable opaque SHA-256-derived identifiers based on existing record IDs; the source identifier is not recoverable from the feed value in ordinary use.

## Failure behavior

Core source sheets and required named headers are mandatory. If they cannot be read authoritatively, feed construction throws and the endpoint returns a generic unavailable response with `status.healthy` set to `false` rather than fabricated zeroes. If optional action construction fails while core counts remain authoritative, the response remains healthy, sets `status.partial` to `true`, emits no actions, and records only the unavailable section name internally without source data or error details.

## Deployment procedure

1. Run `npm run validate`, `npm run test:headquarters-sales-feed`, and the existing regression suites.
2. Deploy first to the disposable acceptance Apps Script project through the approved manual deployment workflow.
3. In Apps Script Project Settings, add the Script Property `HEADQUARTERS_SALES_FEED_TOKEN` with a manually generated long random secret. Do not store the value in this repository.
4. Deploy the Apps Script project as a web app executing as the deployment owner. Restrict access as far as the Headquarters integration permits; application authentication remains mandatory.
5. Send a test JSON POST in the request body and verify the schema, five-minute freshness, and read-only behavior against fixture or disposable-workbook data.
6. After acceptance approval, repeat the explicit production deployment procedure and configure the production Script Property manually.

No deployment or token creation is automatic.

## Headquarters consumption

Headquarters should POST the exact v1 request body over HTTPS, keep the secret in its server-side secret store, validate `version`, require `status.healthy === true`, surface `status.partial`, reject stale data after `expiresAt`, and consume only documented fields. It must not infer missing metrics or attempt workbook access. The token must never be sent from browser-side code.

## Versioning

Version `1.0` field names and meanings are stable. Additive or semantic changes require a reviewed contract version. Breaking changes require a new version and an explicit migration period; do not silently reinterpret v1 fields.

## Explicitly unsupported fields

- Qualified prospects
- Pipeline value
- Recognized revenue

Booked, invoiced, and collected revenue are also unavailable. V1 always returns only `{ "connected": false }` for revenue.
