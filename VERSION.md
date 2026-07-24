# Version

## Current Version

`1.0.0-rc`

Build: `2026.07.20-rc`

Product: Business Optimization Platform

Owner: Rogers Holdings LLC

Customer-facing brand: `Business Optimization Platform by Rogers Holdings LLC`

Target release: `1.0.0` after final acceptance and production approval

## Release State

Version 1.0 implementation is in release-candidate validation. The candidate is not production-ready or released. Promotion to `1.0.0` remains gated by the documented live Google Workspace acceptance run, final sign-off, a clean release branch, and the guarded production deployment workflow.

## Required Local Checks

Run against the exact candidate:

```bash
git diff --check
npm run status:acceptance
npm run status:production
npm run validate
npm run test:lifecycle
npm run test:audit-rendering
npm test
```

Before production deployment, verify that the working tree is clean and the current branch is `main` or an explicitly approved release branch.

## Deployment Commands

Acceptance target:

```bash
npm run deploy:acceptance
```

Production target:

```bash
npm run deploy:production
```

There is no default deployment target. Production deployment requires the exact confirmation `DEPLOY PRODUCTION`, runs the complete release gate, creates a backup, and restores the acceptance `.clasp.json` after the push attempt.

## Final Release Gates

- Live System Health Check has no unexplained failures.
- Complete prospect-to-client acceptance workflow passes in a disposable production-workbook copy.
- Gmail, Calendar, Drive, PDFs, Activity Feed, Follow-Ups, Projects, Client Workspace, and Executive Dashboard agree with the recorded evidence.
- Customer-facing deliverables receive visual approval.
- Acceptance sign-off is recorded.
- Production deployment and post-deployment verification complete successfully.
