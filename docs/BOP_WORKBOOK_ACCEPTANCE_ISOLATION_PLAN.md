# BOP Workbook Optimization Acceptance Isolation Plan

Status: prepared, not activated.

## Acceptance workbook

The acceptance workbook is a native Google Drive copy titled:

`NON-PRODUCTION — Rogers Holdings BOP — Workbook Optimization Acceptance`

Its Drive identity is distinct from the authoritative production workbook. The restricted Drive record is the source of truth for its identifier; the identifier is intentionally omitted from repository documentation.

## Current isolation

- The production `BOP_SPREADSHEET_ID` was not read, changed, or repointed.
- Authorized BOP Version 7 was not modified or republished.
- Replacement Production Receiver Version 2 was not modified.
- Cloudflare and the website were not modified.
- The public receiver remains pinned to Authorized BOP Version 7 and therefore continues resolving the production library's authoritative workbook mapping.
- The acceptance workbook has only the single owner permission returned for production and the copy.
- No public endpoint, receiver, deployment, trigger, or library mapping was created for the acceptance workbook.
- No Apps Script function was executed from the acceptance workbook during Phase 1A.

## Safe Apps Script test design

Do not test workbook automation by changing the production library property or receiver configuration.

Before any acceptance execution:

1. Inventory the Apps Script project associated with the copied workbook, including project ID, script properties, installable triggers, deployments, libraries, OAuth scopes, and bound-container behavior. Read only.
2. Confirm the copied project cannot call a production receiver and has no installable trigger that can mutate production or send external messages.
3. Prefer the existing disposable acceptance Apps Script target represented by `.clasp.json`, or create a separate acceptance-only Apps Script project if the copied container cannot be proven isolated.
4. Deploy the exact reviewed source to that acceptance project only after separate approval.
5. In the acceptance project only, set an acceptance-scoped workbook mapping to the acceptance workbook. Never edit the production project's `BOP_SPREADSHEET_ID`.
6. Do not expose an anonymous web deployment for workbook-optimization acceptance testing.
7. Stub, disable, or use test-only destinations for Gmail, Calendar, Drive deliverables, and any external API before running workflows that cause external side effects.
8. Use synthetic `.invalid` contact data and an acceptance-specific request namespace.
9. Run Business Snapshot intake through a private acceptance harness that calls the acceptance library/project directly; never route Website, Cloudflare, or Replacement Production Receiver Version 2 to acceptance.
10. Verify new-request and replay idempotency, lifecycle transitions, Follow-Ups, Activity Feed, Clients, Projects, dashboard refresh, and Client Workspace behavior.
11. Record project/version/property/trigger evidence and rollback steps before any Phase 1B workbook presentation change.

## Activation gate

Acceptance automation remains inactive until all project, property, trigger, external-side-effect, and destination checks above have evidence and explicit approval. Phase 1A authorizes only the file copy and governance documentation.
