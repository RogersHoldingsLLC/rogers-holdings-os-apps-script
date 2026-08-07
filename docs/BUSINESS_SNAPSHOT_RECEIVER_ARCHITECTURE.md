# Business Snapshot Receiver Architecture

Status: local proposal only. No receiver, deployment, library version, or live
workbook change has been created.

## Boundary

The BOP-bound project owns the canonical `ingestBusinessSnapshot(input)`
function. It intentionally contains no `doGet` or `doPost`. A future standalone
Apps Script receiver will be the only anonymous HTTP surface.

The receiver calls the canonical function through a fixed, numbered Apps Script
library version. Library execution has no bound-container or active-spreadsheet
context. The intake path therefore never uses an active spreadsheet, active
sheet, selected row, UI, or container state. The BOP `Spreadsheet` object is
opened once and passed through all intake helpers, including Follow-Up
synchronization.

The receiver must depend on an immutable, numbered BOP library version. It must
never depend on development mode or `@HEAD`. The two existing BOP deployments,
including the legacy version 5 Website Audit receiver, remain unchanged.

## BOP library configuration and concurrency

The BOP library project must define `BOP_SPREADSHEET_ID` in its own Script
Properties. The value is required, must be a syntactically valid spreadsheet
ID, and must identify the intended BOP workbook. Intake resolves only this
property and opens the workbook with `SpreadsheetApp.openById()`. A missing,
blank, malformed, inaccessible, or incorrect value prevents intake; there is no
fallback to an active workbook.

Intake serializes duplicate checks and writes with a script lock, which is
available when the code executes as a library from a standalone receiver. The
lock timeout is controlled by `BUSINESS_SNAPSHOT_LOCK_TIMEOUT_MS`. The lock is
released only after successful acquisition. The operation key and lock together
preserve safe retry behavior. Business Snapshot intake uses an append-only
Follow-Up path keyed by the exact generated Prospect ID; it never completes,
replaces, or updates a pre-existing Follow-Up. Compensation locates
intake-created rows by Prospect ID, Follow-Up ID, and operation key and verifies
that the pre-existing Follow-Up cell values are unchanged. Any ambiguous
identifier, unexpected mutation, or cleanup that cannot be proven complete
requires reconciliation.

## Browser-to-receiver contract

Submit `application/x-www-form-urlencoded` with:

- `schemaVersion=business-snapshot.v1`
- `requestId`: browser-generated UUID v4, retained for retries
- `fullName`: required, maximum 120 characters
- `businessName`: required, maximum 140 characters
- `email`: required, maximum 254 characters
- `phone`: optional, maximum 30 characters
- `website`: optional absolute HTTP(S) URL, maximum 2048 characters
- `primaryChallenge`: required, 20–2000 characters
- `consent=business-snapshot-contact-consent-v1`
- `formStartedAt`: ISO-8601 UTC timestamp
- `company`: honeypot; must be empty
- `turnstileToken`: required once Turnstile is configured

Whitespace and control characters are normalized before validation. Normalized
values are never silently truncated: values outside their configured minimum or
maximum length are rejected. The canonical limits live in
`BUSINESS_SNAPSHOT_FIELD_LENGTHS`.

All public strings pass through `literalizeBusinessSnapshotSheetRow_()` at the
tracker, Activity Feed, and Follow-Up write boundaries. A leading `=` is
prefixed with the Google Sheets literal-text marker before `setValues()`, so the
cell displays the submitted text but does not execute it as a formula. Other
prefixes are unchanged, including the legitimate `+` prefix on international
phone numbers.

The receiver validates the public payload, verifies Turnstile using a secret
stored only in receiver Script Properties, generates the required `acceptedAt`
timestamp immediately before calling the library, and calls the fixed-version
library function. `acceptedAt` must parse as a valid date, must not be older
than `BUSINESS_SNAPSHOT_ACCEPTED_AT_MAXIMUM_AGE_MS`, and may be ahead of the
library clock only by `BUSINESS_SNAPSHOT_ACCEPTED_AT_FUTURE_TOLERANCE_MS`.
Secrets must never be present in browser code, URLs, Git, logs, or responses.

Validation is deliberately sequenced for durable idempotency. Every call first
normalizes the payload and validates only `schemaVersion` and the UUID v4
`requestId`. Intake then acquires the script lock, opens the configured
workbook, and looks up `INTAKE:<requestId>`. An existing operation returns its
original Prospect ID regardless of the age of the original `acceptedAt`, but
only after verifying exactly one tracker row and exactly one open Lead Found
Executive Brief Follow-Up linked to that exact Prospect ID. Legacy Executive
Snapshot Follow-Ups remain valid for idempotent retries. Missing,
mismatched, completed, or duplicate Follow-Up evidence requires reconciliation;
retry never silently recreates or repairs it.
Complete field, consent, URL, email, length, freshness, and duplicate-entity
validation applies only when the operation key does not already exist. A retry
therefore remains valid for as long as its canonical workbook records remain
reconcilable.

## Internal error contract

The library throws `BusinessSnapshotError` with a machine-readable `code`,
human-readable `message`, optional structured `diagnostics`, preserved `cause`,
and stack trace. The receiver maps codes directly and must never parse message
text:

- `BUSINESS_SNAPSHOT_VALIDATION`
- `BUSINESS_SNAPSHOT_DUPLICATE_ENTITY`
- `BUSINESS_SNAPSHOT_LOCK_TIMEOUT`
- `BUSINESS_SNAPSHOT_CONFIGURATION`
- `BUSINESS_SNAPSHOT_TEMPORARY_FAILURE`
- `BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED`

Diagnostics and reconciliation details are for restricted operational logging;
they must not be returned to an anonymous caller. A receiver must call
`ingestBusinessSnapshotPublic(input, environment)` as its library boundary.
That mapper reconstructs, rather than copies, its output. Success contains only
`ok`, `environment`, `requestId`, `prospectId`, and `retry`. Failure contains
only `ok`, `environment`, `requestId`, and an allowlisted `code`. Internal
messages, diagnostics, causes, stacks, operation keys, row numbers, personal
data, and Apps Script or workbook identifiers cannot cross that boundary.

The public library boundary preserves existing `BusinessSnapshotError`
instances and wraps unexpected normalization, workbook read/write, sheet,
header, Prospect ID, activity, Follow-Up, and helper failures as
`BUSINESS_SNAPSHOT_TEMPORARY_FAILURE`, retaining the original exception as the
internal cause. Rollback failures remain
`BUSINESS_SNAPSHOT_RECONCILIATION_REQUIRED`. A lock-release failure after an
otherwise successful operation is also a typed temporary failure; if processing
has already failed, release diagnostics are attached without replacing the
original typed processing error.

## Canonical result

The canonical function stores `INTAKE:<requestId>` in Activity Feed `Operation
Key`. Exactly one matching intake activity is required; duplicate operation-key
rows require reconciliation. A retry with that key returns the
already-associated `PROS-…` Prospect ID without creating another tracker,
intake activity, or Follow-Up row. New submission freshness limits never expire
an existing operation key.

The receiver returns the allowlisted public result described above. Internal row
numbers, duplicate state, workbook identifiers, and reconciliation details must
not be disclosed publicly.

Follow-Up IDs retain the established `FU-<COMPANY>-<timestamp>` prefix and add
an eight-character UUID suffix. The suffix removes the previous same-company,
same-second collision risk while keeping IDs recognizable. UUID collision risk
is non-zero but operationally negligible; workbook-level uniqueness should
still be monitored during future migrations or bulk imports.

## Activation requirements

Before production activation:

1. Review and merge the BOP library source.
2. Set and independently verify `BOP_SPREADSHEET_ID` in the BOP library
   project's Script Properties.
3. Create a numbered BOP Apps Script version only after approval.
4. Create the separate private receiver and pin it to that exact library
   version, never development mode.
5. Configure receiver-only secrets and make the receiver generate `acceptedAt`.
6. Test the complete flow against a non-production workbook or isolated test
   project, including retries, contention, failures, rollback, and error-code
   mapping.
7. Review OAuth scopes, execution identity, access controls, logs, monitoring,
   and rollback procedures before any production deployment decision.

## Release sequence

1. Review and test the BOP-side change locally.
2. Commit the reviewed BOP source.
3. Configure Turnstile and create the separate private receiver project.
4. Create a numbered BOP script version for library use.
5. Pin the receiver to that exact library version.
6. Test against a non-production workbook or an isolated test project.
7. Review permissions and logs before any production deployment decision.

No `clasp push` or deployment command belongs in the local implementation
phase.
