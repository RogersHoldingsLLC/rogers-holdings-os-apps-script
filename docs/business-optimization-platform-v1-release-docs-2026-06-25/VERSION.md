# Version

## Current Version

`1.0.0-rc`

Release candidate date: `2026-06-25`

## Release State

Feature development is frozen for Version 1.0.

Current recommendation from local acceptance testing:

`Ready with minor issues`

The codebase is locally release-ready. Final release approval requires live Google Sheets smoke testing after deployment.

## Version Meaning

- `1.0.0-rc`: Version 1.0 release candidate.
- `1.0.0`: First production release after live acceptance testing passes.
- `1.0.x`: Patch release for V1 production fixes.
- `1.1.0`: First post-release feature iteration.

## Required Checks Before Release

Run locally:

```bash
npm run status
npm run validate
npm run backup
```

Also verify:

- duplicate function check passes
- menu target check passes
- live System Health Check passes
- live workflow smoke test passes

## Deployment

Do not deploy automatically. Use:

```bash
npm run deploy
```

Only deploy after validation passes and a backup exists.
