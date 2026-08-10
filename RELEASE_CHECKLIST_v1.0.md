# Business Optimization Platform Version 1.0 Release Checklist

Candidate: `1.0.0-rc`

Build: `2026.08.10-rc`

Target release: `1.0.0`

Owner: Rogers Holdings LLC

Release date: `TBD — only after final acceptance and production approval`

Release state: release candidate; not production-ready or released

This checklist is the release-control record for Version 1.0. Check an item only when its evidence is recorded in `ACCEPTANCE_TEST_EXECUTION_LOG.md` or linked from the release record.

## Release Prerequisites

- [ ] Confirm the release candidate is on `main` or an explicitly approved release branch.
- [ ] Confirm the working tree is clean.
- [ ] Record the candidate Git commit and source fingerprint.
- [ ] Confirm `VERSION.md`, `CHANGELOG.md`, `README.md`, and `PROJECT_MEMORY.md` identify candidate `1.0.0-rc`, build `2026.08.10-rc`, target release `1.0.0`, release-candidate status, and Business Optimization Platform. Preserve dated acceptance documents as historical evidence of the build they validated.
- [ ] Confirm `.clasp.json` identifies the disposable acceptance project.
- [ ] Confirm `.clasp.production.json` identifies the intended production project.
- [ ] Confirm no real prospect or client data is present in the disposable acceptance workbook.
- [ ] Record tester accounts, workbook ID, Apps Script project ID, test Calendar, test Drive root, and timezones.
- [ ] Confirm Gmail, Calendar, Drive, Sheets, Apps Script, and Website Audit Tool permissions/configuration needed for the selected tests.
- [ ] Run and record:

```bash
git diff --check
npm run status:acceptance
npm run status:production
npm run validate
npm run test:lifecycle
npm run test:audit-rendering
npm test
```

## Acceptance Tests

- [ ] Deploy the exact candidate to the disposable acceptance project with `npm run deploy:acceptance`.
- [ ] Reload the acceptance workbook and verify the Business Optimization Platform menu.
- [ ] Run System Health Check and resolve every unexplained failure.
- [ ] Complete the happy-path prospect lifecycle from Lead Found through Client.
- [ ] Verify artifact generation and Gmail drafts never falsely advance confirmed CRM stages.
- [ ] Verify Activity Feed entries, Follow-Ups, timestamps, operation keys, and dashboard metrics after each transition.
- [ ] Exercise Website Audit Tool acquisition with approved synthetic input, or record why acquisition is outside the release environment.
- [ ] Generate and visually approve Executive Snapshot, Digital Business Assessment, Improvement Plan, and Discovery Call Brief PDFs.
- [ ] Run Full Prospect Package twice and verify one active canonical artifact set and one exact Gmail draft.
- [ ] Verify Gmail creation, update, attachment failure fallback, and duplicate-draft rejection.
- [ ] Verify Drive folder creation, artifact replacement, deduplication, ownership, and access.
- [ ] Verify Calendar event creation, guest, timezone, retry, exact-time reconciliation, and fallback path.
- [ ] Verify Client, Project, Follow-Up, Client Workspace, Activity Feed, and Executive Dashboard synchronization.
- [ ] Complete required failure-injection, reconciliation, legacy-data, and empty-state tests.
- [ ] Enter evidence links/IDs and reviewer decisions in `ACCEPTANCE_TEST_EXECUTION_LOG.md`.
- [ ] Obtain QA Director, Release Manager, Principal Apps Script Engineer, and Product Owner sign-off.

## Production Deployment

- [ ] Confirm all acceptance blockers are closed.
- [ ] Confirm the release commit is immutable and the working tree is clean.
- [ ] Confirm the production Script ID displayed by the deployment command is correct.
- [ ] Record a pre-deployment backup reference.
- [ ] Run `npm run deploy:production`.
- [ ] Enter the exact confirmation `DEPLOY PRODUCTION` only after verifying the target.
- [ ] Record deployment date/time, operator, commit, Script ID, command result, and backup path.
- [ ] Confirm `.clasp.json` was restored to the acceptance configuration after the push attempt.

## Post-Deployment Verification

- [ ] Reload the production workbook and verify the Business Optimization Platform menu.
- [ ] After the separately approved promotion from `1.0.0-rc` to `1.0.0`, verify About displays Version `1.0.0` and the expected deployment metadata.
- [ ] Run System Health Check and save the report.
- [ ] Run a controlled synthetic prospect smoke test without contacting a real customer.
- [ ] Verify one Executive Snapshot, Digital Business Assessment, Improvement Plan, Gmail draft, and Drive package.
- [ ] Verify Activity Feed, Follow-Ups, Projects, Client Workspace, and Executive Dashboard agree.
- [ ] Verify no duplicate Gmail drafts, Drive artifacts, Client records, Project records, or lifecycle entries were created.
- [ ] Record post-deployment approval and release date.

## Rollback Plan

1. Stop operator use and record the failure, affected workflow, time, prospect/client IDs, and external artifact IDs.
2. Do not delete or rewrite customer data while diagnosing the failure.
3. Preserve the failed state, Apps Script logs, Health Check report, Activity Feed evidence, and screenshots.
4. Identify the last approved production commit and its backup created by the deployment workflow.
5. Restore the last approved source through the guarded production deployment process; do not bypass validation or use `--force`.
6. Reconcile any Gmail drafts, Calendar events, Drive files, Clients, Projects, Follow-Ups, and lifecycle markers created before the failure.
7. Run System Health Check and the affected smoke tests again.
8. Record the rollback commit, operator, time, reason, evidence, and approval in the release record.

## Git Tag

- [ ] Confirm production deployment and post-deployment verification passed.
- [ ] Confirm the release commit matches the deployed source.
- [ ] Create annotated tag `v1.0.0` with the approved release date and release summary.
- [ ] Push the tag only after release approval.
- [ ] Record the tag commit and remote confirmation.

## Merge Checklist

- [ ] Review the final documentation-only diff separately from application changes.
- [ ] Confirm no unapproved business logic, workflow, Apps Script behavior, or schema changes are included.
- [ ] Confirm CI/local validation passes on the merge commit.
- [ ] Confirm release notes match the merge commit.
- [ ] Confirm required reviewers approved.
- [ ] Merge through the approved repository process.
- [ ] Verify `main` contains the exact accepted candidate.

## First Client Checklist

- [ ] Confirm the client engagement, authorized contacts, scope, and communication expectations.
- [ ] Confirm consent before storing client information or creating external artifacts.
- [ ] Add and verify the prospect record, unique Prospect ID, website, email, contact, service, and owner.
- [ ] Run Website Audit Tool acquisition and review the findings before generating client-facing material.
- [ ] Generate and review the Executive Snapshot before outreach.
- [ ] Send the approved snapshot manually, then confirm Executive Snapshot Sent.
- [ ] Schedule and verify the discovery meeting.
- [ ] Generate and review the Digital Business Assessment; confirm Presented only after the meeting.
- [ ] Generate and review the Improvement Plan; confirm Sent only after delivery.
- [ ] Record acceptance and start the project only after client approval.
- [ ] Verify Client, Project, Follow-Up, workspace, Drive, Activity Feed, and dashboard records.
- [ ] Complete client onboarding only after onboarding is actually complete.
- [ ] Preserve client evidence and resolve every reconciliation warning before continuing.
