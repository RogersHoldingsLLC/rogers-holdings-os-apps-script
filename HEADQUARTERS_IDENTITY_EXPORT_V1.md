# Headquarters Identity Exclusion Snapshot v1

## Purpose

This BOP-owned, strictly read-only endpoint supplies DE-002 with the complete set of existing Business Optimization Platform prospect and client identities required for exclusion. It is a separate versioned route from Headquarters Sales Feed v1 and does not change Sales Feed v1 fields or meanings.

The implementation is local-only in this milestone. No token was created, no live workbook was accessed, no Apps Script call was made, and nothing was deployed.

## Request

Send an HTTPS JSON `POST` body. Authentication material must never appear in a URL:

```json
{
  "version": "rh-bop-identity-exclusion-snapshot-v1",
  "token": "<shared secret>"
}
```

The route reads its secret from the `HEADQUARTERS_IDENTITY_EXPORT_TOKEN` Apps Script Script Property. This is intentionally separate from `HEADQUARTERS_SALES_FEED_TOKEN`, allowing independent rotation and least-privilege enablement. Missing configuration, malformed JSON, an unsupported version, a missing token, and an incorrect token return only:

```json
{ "error": "unauthorized" }
```

The token is compared with the existing digest-based constant-time helper. The request, token, and exception details are never logged.

## Successful response contract

```json
{
  "version": "rh-bop-identity-exclusion-snapshot-v1",
  "source": "business-optimization-platform",
  "complete": true,
  "generatedAt": "2026-08-27T16:00:00.000Z",
  "expiresAt": "2026-08-27T16:05:00.000Z",
  "entries": [
    {
      "recordId": "PRO-EXAMPLE",
      "lifecycle": "prospect",
      "businessName": "Example Company",
      "domains": ["example.com"]
    }
  ]
}
```

`expiresAt` is exactly five minutes after `generatedAt`. Entries are deterministically sorted by lifecycle and case-normalized record ID. Headquarters must require the exact version, `complete === true`, unexpired freshness, and the documented entry schema before replacing its prior accepted snapshot.

The top-level fields are exact. No completeness-count extension is included because the current Headquarters validator rejects additional fields. Any nonblank value anywhere in either complete used-row span makes that row a source record that must validate; it cannot be silently skipped.

## Authoritative source binding

The exporter never calls `getActiveSpreadsheet()`. It requires both `BOP_SPREADSHEET_ID` and `HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE` as explicit Script Properties, validates both values, opens exactly the configured ID with `SpreadsheetApp.openById()`, verifies the opened ID, and requires the opened workbook title to exactly equal the configured expected title. Missing, blank, malformed, changed, or mismatched configuration fails closed. There is no default, production-title fallback, disposable-title fallback, active-workbook fallback, or substring matching.

Production must configure the expected title as `Rogers Holdings BOP — CRM & Delivery System` while mapping `BOP_SPREADSHEET_ID` to the production workbook. Disposable acceptance must configure the expected title as `NON-PRODUCTION — Rogers Holdings BOP — Workbook Optimization Acceptance` while mapping `BOP_SPREADSHEET_ID` to that approved disposable workbook. Both environments use the same exact ID-and-title verification path.

Both mandatory sources are read from that workbook:

- `Master Prospect Tracker`, exact header row 4: `Prospect ID`, `Status`, `Company`, `Website`.
- `Clients`, exact header row 4: `Client ID`, `Status`, `Company`, `Client Name`, `Website`.

`Status` is required as source-schema evidence but does not filter the export: every existing identity is required for exclusion regardless of lifecycle status. Duplicate required headers, a displaced row-4 contract, missing sheets, missing headers, formula-bearing required headers, formula-bearing source rows, or a workbook identity mismatch fail the whole snapshot.

The exporter acquires two complete consecutive read-only snapshots of both sheets. Each sheet read captures sheet identity, name, last row, last column, maximum rows, displayed values, and formulas, with metadata checked before and after its range read. The first two complete workbook snapshots must serialize identically. The second snapshot is parsed and the exact final response object is fully validated and size-checked; only then does the exporter perform a third complete acquisition as its final source operation. That final acquisition must have the same complete fingerprint as the parsed second snapshot before the already-fixed response object can be returned. Appended/removed rows, range-size changes, identity or Website changes, business-name changes, header changes, and formula changes through that final validation boundary therefore return unavailable rather than `complete: true`. A later source edit cannot alter the fixed in-memory point-in-time response.

## Prospect rules

Every nonblank prospect source row must have a usable `Prospect ID` and `Company`. IDs must be 1–160 characters, start alphanumeric, and otherwise contain only alphanumeric, `.`, `_`, `:`, or `-`; surrounding whitespace is rejected. Lifecycle is always the literal `prospect`. Website is used only by the strict domain parser. No missing ID is generated or repaired.

## Client rules

Every nonblank client source row must have a usable `Client ID` under the same ID grammar. The established client-name compatibility precedence is `Company`, then `Client Name`; the first usable value becomes `businessName`. Record IDs are globally unique across both lifecycles using case-insensitive comparison. Lifecycle is always the literal `client`. Website is used only by the strict domain parser. No missing ID is generated or repaired.

Business names must already be trimmed, contain 1–300 control-free characters, and canonicalize to a nonempty name using the same lowercase/alphanumeric/legal-suffix semantics as Headquarters. Punctuation-only and legal-suffix-only names fail closed rather than being rewritten.

## Domain rules

Blank Website produces `domains: []`. A nonblank Website must produce exactly one canonical ASCII hostname or the entire export fails:

- Only `http` and `https` schemes are accepted; a scheme may also be omitted.
- Scheme and leading `www.` are removed.
- Path, query, and fragment are removed.
- Output is lowercase.
- Repeated leading `www.` labels are removed so emitted output is already canonical under Headquarters.
- Credentials, ports, protocol-relative input, whitespace, backslashes, percent encoding, IP-style/numeric top-level input, single-label hosts, empty labels, oversized labels, and malformed hostname characters are rejected.

This parser is new, pure, and export-specific. It does not call or change `normalizeWebsiteKey_()`.

## Privacy and write boundary

Successful entries expose only record ID, literal lifecycle, business name, and a zero-or-one canonical domain array. The response never includes contact names, email, phone, notes, workbook row numbers, Drive IDs, internal evidence, financial data, documents, or unrelated BOP fields.

At most 100,000 entries are accepted. Prospect and client entry arrays must be dense: every own integer index from zero through `length - 1` is explicitly checked and validated, so holes, `null`, and `undefined` cannot bypass entry validation. The newly constructed final entries array is checked for the same dense-object invariant. Before success, the exact canonical JSON payload is measured as UTF-8 and must not exceed 512 KiB. Any invariant or limit failure occurs before `complete: true` is returned.

`HeadquartersIdentityExport.gs` calls only Script Property reads, `SpreadsheetApp.openById()`, workbook identity reads, sheet lookup, range reads, and pure transformation functions. It does not call schema helpers, ID generators, workflow functions, Activity Feed functions, audit functions, Drive, Gmail, Calendar, URL fetch, locks, logs, or any spreadsheet/Script Property write API.

## Failure contract

An authenticated source or validation failure returns only:

```json
{
  "version": "rh-bop-identity-exclusion-snapshot-v1",
  "complete": false,
  "error": "unavailable"
}
```

Partial identity snapshots are never returned. Internal errors use a fixed message without IDs, business names, websites, workbook IDs, row numbers, or source values, and the public dispatcher does not log exception details.

## Remaining acquisition gates

Before Headquarters can acquire a snapshot, separately authorize and complete disposable-workbook acceptance, configure the acceptance-only `BOP_SPREADSHEET_ID` and exact `HEADQUARTERS_IDENTITY_EXPORT_EXPECTED_WORKBOOK_TITLE`, create an approved secret in `HEADQUARTERS_IDENTITY_EXPORT_TOKEN`, deploy an approved Apps Script web-app version, validate the full response and mutation safety against the disposable workbook, then separately approve production deployment and production Script Property configuration. None of those actions is part of this milestone.
