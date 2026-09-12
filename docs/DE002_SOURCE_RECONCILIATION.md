# DE-002 local production-source reconciliation

This is a local candidate, not a production release. Upload, Apps Script versioning/deployment, Script Property changes, live acceptance, and business workflow execution are not authorized. Independent review is deferred to a separate read-only milestone.

## Provenance and exact boundary

- Canonical base: `537800f3b8440725939928eaf13df0d6ec0034d2`; tree `c3abd53fc7eb145839daa79ed8cb5821b7810882`.
- Production-matching private Git source: `9bca6d62ffcd610b1875634252ec213bfe999311`; tree `736097a4bd77779bb1a9fc6509abd1f07f580b0c`.
- Source-only commit: `621d8848a39fb3eb54231d82d4725dbaee6bf465` (`reconcile(bop): restore production workflow source`).
- Prior read-only review matched all 46 editable-production files to that private commit. Immutable web-app version 9 is older and contains none of the 17 restored modules. This implementation made no Apps Script requests and does not claim a new live comparison.

The source commit changes exactly 26 production paths: 17 new workflow modules, eight shared modules, and the manifest. The 25 workflow files are exact Git bytes, not copied working-tree files. No semantic overlap required changing them. `HeadquartersIdentityExport.gs` and `HeadquartersSalesFeed.gs` remain byte-identical to canonical main.

The expected runtime inventory is 46 `.gs` files plus `appsscript.json` (47 files). Relative to the production-matching commit, only these differ:

1. `HeadquartersIdentityExport.gs` is added from reviewed main.
2. `HeadquartersSalesFeed.gs` retains reviewed main's distinct-token identity-export dispatcher and hardening.
3. `appsscript.json` combines the existing Advanced Gmail v1 dependency with main's `USER_DEPLOYING` / `ANYONE_ANONYMOUS` web-app policy.

Timezone, V8 runtime and STACKDRIVER exception logging are unchanged. No explicit OAuth scopes or other service dependencies were added. This local manifest does not enable a Google API or alter a deployment.

`tests/fixtures/de002-reconciliation-provenance.json` records exact SHA-256 values for the production source and reviewed main modules. `tests/reconciled-source.test.js` verifies the runtime inventory, preservation, manifest, full-source load, menu resolution, and both dispatchers with all business functions/services forbidden in the synthetic request harness.

## Execution authority

The acceptance-fixture command in `DraftSuccessorEngine.gs` and acceptance-workbook/historical-orphan gates in `RealProspectWorkflowEngine.gs` are preserved exactly for review. No changes make them generally production-ready, and no owner authorization to execute them is implied.

Finding approval, evidence fetching, prospect/activity/follow-up creation, Drive persistence, Gmail drafts, sent reconciliation and document generation remain separate business actions. Tests execute only synthetic/mocked code. No live workbook, Apps Script execution, Gmail, Drive, Calendar, external evidence site, DE-002/DE-003/DE-004 workflow or Google Places operation is permitted by this candidate.

## Local validation safety

Use the existing Node, Chrome and Swift installations; no dependency installation is needed. All test commands below must run under a macOS sandbox that denies IP network access and confines writes to this candidate and fresh temporary directories. Local Unix IPC is permitted for the isolated renderer. The following is the profile used on RCS-01; copy it only into a new temporary evidence directory when rerunning:

```scheme
(version 1)
(allow default)
(deny network*)
(allow network* (local unix-socket))
(deny file-write*)
(allow file-write*
 (subpath "/Users/rogersadmin/Workspace/Rogers Holdings LLC/Products/Business Optimization Platform Worktrees/de002-source-reconciliation")
 (subpath "/private/tmp")
 (subpath "/private/var/folders/hx/0p4t91y50x902svlk2dj6yt40000gn/T")
 (literal "/dev/null"))
```

The renderer's `BOP_LOCAL_NETWORK_SANDBOX=1` value acknowledges this outer sandbox; it does not enforce network denial itself. Chrome uses fresh test profiles and mock keychain, with a bounded process lifetime. Only that spawned test process group is terminated after PDF completion. Swift caches and PDFs remain temporary. No operator browser or service is restarted.

The generator accepts saved fixtures `fq1-plain-v2` and `rogers-approved-v1`, using a fingerprint-checked immutable storage mock and the unchanged production document plans. A raw `reviewedInput` or mismatched fingerprint is rejected. Actual production snapshot-loader behavior is tested separately by the foundation/authority suites. QA2 uses fresh artifacts, so stale output cannot mask a generator failure.

## Regression disposition and final validation

The final complete local run passed: 456 tests, zero failures, zero cancelled, zero skipped, across 34 test files (239.59 seconds). The nine historical failures were reproduced first, without skips: Gold Standard 3 failures/17 tests, PDF text 2 failures/2 tests, QA2 4 failures/4 tests. Production source remained unchanged while adapting established test contracts.


| Historical regression | Disposition | Preserved check in the candidate |
|---|---|---|
| Gold Standard: Generate Improvement Plan creates the Drive PDF without sent or accepted effects | TEST HARNESS / ENVIRONMENT LIMITATION — resolved | Actual preview → confirmed callback → transactional PDF/receipt; no send/accept effects |
| Gold Standard: variable priority counts are evidence-driven and omit unsupported strength sections | TEST HARNESS / ENVIRONMENT LIMITATION — resolved | Seeded immutable snapshot, current diagnostic/action structure, variable finding counts |
| Gold Standard: every plan action retains exact recommendation lineage and distinct mechanics | TEST HARNESS / ENVIRONMENT LIMITATION — resolved | Complete synthetic finding authority; exact action/recommendation lineage and distinct mechanics |
| PDF: plain-language Draft v2 package preserves authority, meaning, page counts, and readable text | TEST HARNESS / ENVIRONMENT LIMITATION | Generator now honors the named saved fixture and verified-storage boundary; actual PDF assertions retained |
| PDF: approved Rogers Improvement Plan extracts a complete balanced two-page execution document | TEST HARNESS / ENVIRONMENT LIMITATION | Correct saved fixture and immutable date; actual PDF text/page assertions retained |
| QA2: package content and pagination safeguards | TEST HARNESS / ENVIRONMENT LIMITATION | Fresh approved fixture output, exact authority, actual 1/3/2 pages; extracted date comparison allows CSS uppercase |
| QA2: assessment recommendation and roadmap serve distinct purposes | TEST HARNESS / ENVIRONMENT LIMITATION | Current diagnostic evidence/limitations separated from supported action; no invented claims |
| QA2: Improvement Plan actions stay within repetition boundary | TEST HARNESS / ENVIRONMENT LIMITATION | Exact saved action lineage, complete steps and nonrepetition; variable-count coverage also retained in Gold Standard/audit suites |
| QA2: final owner polish preserves one CTA and the advisory commercial boundary | TEST HARNESS / ENVIRONMENT LIMITATION | Current approved CTA and separate implementation-approval copy; no price/commercial commitment fabrication |

These are test-only adaptations to existing source contracts, not production bug fixes or exclusions. The original failures were not dismissed based on bounded feature results. Fresh Swift SDK-cache compilation also exceeded the historical 60-second limit; the shared isolated PDF harness permits a bounded 120 seconds for Swift, 30 seconds for Chrome, and 300 seconds for a fixture subprocess. Only temporary test children are terminated. No tests are intentionally skipped.

## Global and dependency closure

All 46 Apps Script modules parse and load together in a Node VM without Apps Script services. All 95 literal Menu targets and the three preview-generation callbacks resolve. Duplicate function/top-level-var tests pass. A separate local AST/scope analysis using already-installed Acorn 8.17.0 and eslint-scope found no missing required application globals. `Calendar` is an explicitly typeof-guarded optional Advanced Service, and `getCustomInspectionInspectors_` is an explicitly typeof-guarded extension hook; neither was treated as a missing required implementation.

An in-memory comparison using only the 17 additions on canonical main leaves these five unresolved application globals: `assertApprovedFindingSetReference_`, `buildGoldStandardDocumentPlan_`, `buildGoldStandardPdfBlobFromPlan_`, `ingestBusinessSnapshotWithOptions_`, and `isRecognizedBusinessSnapshotSyntheticQaRow_`. The eight shared-file updates close these dependencies and preserve their semantics. The AST check read existing installed parser packages only; no Headquarters or dependency files were modified.

## Required commands

Run from the candidate under the profile above. `RECONCILIATION_SANDBOX` must name that temporary profile; it is a test-process variable, not a production setting.

```sh
sandbox-exec -f "$RECONCILIATION_SANDBOX" env BOP_LOCAL_NETWORK_SANDBOX=1 node --test --test-concurrency=1 --test-reporter=tap tests/*.test.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/validate.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-crm-lifecycle.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-prospect-revenue-workflow.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-audit-rendering.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-executive-business-intelligence.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-headquarters-identity-export.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-headquarters-sales-feed.js
sandbox-exec -f "$RECONCILIATION_SANDBOX" node scripts/test-deploy.js
git diff --check
```

The all-tests command covers every root `tests/*.test.js`, including PDF suites and all restored finding/workflow families. `scripts/test-deploy.js` is the existing `npm test` command and mocks deployment operations; it does not upload. Do not run status/deploy/production-acceptance commands during local certification. Full checks must have no unresolved blocking regression before the second commit. Independent review and any later publication/deployment remain separate milestones.

## Exact candidate file scope

Production paths (source commit only):

```text
AuditEngine.gs
BusinessSnapshotIntake.gs
ClientPackageDraftEngine.gs
DeliverablePreviewEngine.gs
DocumentCorrectionEngine.gs
DocumentGenerationEngine.gs
DraftFindingWithdrawalEngine.gs
DraftSuccessorEngine.gs
DriveEngine.gs
EvidenceDraftEngine.gs
ExecutiveBriefDeliveryEngine.gs
FindingApprovalEngine.gs
FindingDraftEngine.gs
FindingQualityEngine.gs
FindingSetApprovalEngine.gs
FindingSetCorrectionEngine.gs
GoldStandardDeliverables.gs
Menu.gs
PdfEngine.gs
PreSnapshotRecoveryEngine.gs
PresenceInventoryEngine.gs
RealProspectWorkflowEngine.gs
RecommendationDraftEngine.gs
RecommendationReviewEngine.gs
SheetHelpers.gs
appsscript.json
```

Test/support/documentation paths:

```text
CHANGELOG.md
PROJECT_MEMORY.md
docs/DE002_SOURCE_RECONCILIATION.md
scripts/generate-qa2-gold-standard.js
scripts/local-pdf-test-harness.js
scripts/test-audit-rendering.js
scripts/test-executive-business-intelligence.js
tests/apps-script-global-symbols.test.js
tests/client-package-gmail-draft.test.js
tests/client-package-sent-reconciliation.test.js
tests/client-project-partial-retry.test.js
tests/executive-brief-checked-rows-pdf.test.js
tests/executive-brief-delivery.test.js
tests/executive-brief-pdf-correction.test.js
tests/finding-quality-evidence-seed.test.js
tests/finding-quality-finding-approval.test.js
tests/finding-quality-finding-seed.test.js
tests/finding-quality-finding-set-approval.test.js
tests/finding-quality-finding-set-review.test.js
tests/finding-quality-foundation.test.js
tests/finding-quality-pre-snapshot-recovery.test.js
tests/finding-quality-presence-seed.test.js
tests/finding-quality-recommendation-review.test.js
tests/finding-quality-recommendation-seed.test.js
tests/finding-quality-selected-prospect.test.js
tests/finding-quality-set-correction.test.js
tests/finding-quality-successor-chain-identity.test.js
tests/fixtures/de002-reconciliation-provenance.json
tests/fixtures/fq1-plain-draft-v2.json
tests/fixtures/rogers-approved-v1-renderer.json
tests/fq1-assessment-pdf-text.test.js
tests/fq1-document-generation-transaction.test.js
tests/fq1-draft-finding-withdrawal.test.js
tests/fq1-draft-successor-transaction.test.js
tests/fq1-preview-authority.test.js
tests/gold-standard-authoritative.test.js
tests/qa2-gold-standard.test.js
tests/real-prospect-workflows.test.js
tests/reconciled-source.test.js
```

## Final certification result

- Complete serial `node --test` inventory: **456 passed / 0 failed / 0 cancelled / 0 skipped**, across all 34 test files.
- All nine original regression cases are resolved. Classification: **TEST HARNESS / ENVIRONMENT LIMITATION**, corrected through the documented test-only adaptations. No unexplained or blocking relevant regression remains.
- All eight standalone commands listed above passed. Deployment-safety script: **42 tests passed**; EBI: **7 fixtures passed**; syntax/static validator: **46 authoritative `.gs` files passed**. Other standalone contract/lifecycle scripts use assertions without reporting a case count; no invented aggregate is claimed.
- Actual saved-fixture PDF coverage passed, including one-page checked URL rows, exact 1/3/2 package pagination, complete text, authority/date/lineage and readability. No live render, workbook, Gmail or Drive service was used.
- Local clasp file selection, without credentials or network calls: exactly **47 files**. There are no extra runtime paths.
- All existing workflow/runtime bytes match the production-matching Git commit except the three explicitly documented exporter/dispatcher/manifest differences. The 25 restored production files and both reviewed main modules remain exact; no production source changed after the first commit.
- Existing worktree bytes, HEADs, statuses and prior refs remained unchanged. The sole added branch/worktree is this authorized local candidate. No production access, upload, deployment, Script Property change, business action, Git push/merge, Headquarters modification, control enablement or dependency installation occurred.
- Independent review was **not performed** in this implementation pass. It is the next separate read-only milestone; no publication or production action is authorized.

Detailed run evidence was retained outside repositories in `/var/folders/hx/0p4t91y50x902svlk2dj6yt40000gn/T/bop-reconciliation-build-my03vj6l/`, including `full-validation.tap`, the command/count summary, original nine-failure logs, standalone script results, PDF verification logs, static global-closure comparison and original worktree preservation baseline.
