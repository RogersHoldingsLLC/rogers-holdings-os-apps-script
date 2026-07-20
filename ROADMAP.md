# Roadmap

Business Optimization Platform Version 1.0 is feature-frozen. Future work should not begin until V1.0 receives a live Google Sheets release approval.

## Version 1.0 Release Criteria

Required before final release:

- Deploy current `.gs` source to the production Apps Script project.
- Reload the Google Sheet and confirm the grouped Business Optimization Platform menu appears.
- Run System Health Check with no unexpected failures.
- Run one complete smoke test:
  - Add or select a prospect.
  - Run Next Action through Executive Snapshot, Discovery Meeting, Digital Business Assessment, and Improvement Plan steps where practical.
  - Generate Digital Business Assessment PDF and Improvement Plan PDF.
  - Create a Gmail draft.
  - Convert an accepted Improvement Plan prospect to Client.
  - Confirm Client Workspace updates.
  - Confirm Project is created.
  - Confirm Follow-Up is created/completed as status changes.
  - Refresh Executive Dashboard.
- Verify Activity Feed entries for meaningful actions.
- Verify branded PDF appearance and Gmail copy quality.

## Version 1.0 Patch Scope

Allowed:

- Bug fixes.
- Validation fixes.
- Runtime error fixes.
- Health Check accuracy improvements.
- Small copy or visual polish fixes.
- Documentation updates.

Not allowed:

- New major modules.
- New external services.
- Major sheet schema rewrites.
- Large architectural refactors.
- New sales/client lifecycle stages unless required to fix V1.0.

## Version 1.1 Candidate Work

Only after V1.0 release:

- Performance tuning for `refreshSalesOperatingSystem_()`.
- Split `SheetHelpers.gs` into more focused files if Apps Script indexing remains stable.
- Add regression test fixtures for PDF generation.
- Add explicit dashboard refresh caching where safe.
- Improve project deliverable granularity.
- Add lightweight client reporting views.
- Add more robust Drive folder indexing for large client folders.
- Create onboarding docs for small business client deployments.
- Create a reusable installation checklist for future Business Optimization Platform clients.

## Version 2.0 Possibilities

Potential larger future direction:

- Full v2 planning is captured in `docs/BUSINESS_OPTIMIZATION_PLATFORM_V2_PRODUCT_SPEC.md`.
- Multi-client/template deployment model.
- Admin setup wizard.
- Advanced permission model.
- More formal recurring billing/revenue tracking.
- Client portal or read-only deliverable portal.
- AI-assisted proposal customization.
- Cross-workbook reporting.

## Maintenance Policy

- Keep `.gs` files authoritative.
- Keep validation passing before deployment.
- Back up before every deployment.
- Keep Health Check aligned with production modules.
- Update `CHANGELOG.md`, `VERSION.md`, and `PROJECT_MEMORY.md` after meaningful changes.
