# BOP Workbook Production Baseline — 2026-08-09

Classification: restricted internal production evidence. Do not publish outside Rogers Holdings LLC.

## Scope and safety boundary

This baseline was captured read-only from the authoritative workbook before Phase 1A created an acceptance copy. No workbook cell, formula, validation, format, protection, sheet, Apps Script source, Script Property, deployment, receiver, Cloudflare configuration, website asset, or production record was changed.

Sensitive Drive, spreadsheet, deployment, library, request, correlation, and entity identifiers are deliberately omitted from this version-controlled report. The restricted Google Drive records and revision history remain the authority for those identifiers.

## Workbook identity

- Title: `Rogers Holdings BOP — CRM & Delivery System`
- Type: native Google Sheets spreadsheet
- Locale: `en_US`
- Spreadsheet timezone: `America/Los_Angeles`
- Sharing observed: owner-only; no additional file permission was returned
- Current revision at capture: recorded in restricted Drive revision history
- Named ranges returned by the metadata inspection: none
- Protected ranges returned by the metadata inspection: none
- Formula count in populated inspected ranges: `0`

The absence of named/protected ranges above means none were returned by the available Google Sheets metadata surface. It is not permission to assume protection. Phase 1B must independently confirm protection state before adding or changing protections.

## Sheet inventory

Sheet IDs are captured in the restricted connector evidence and intentionally excluded here.

| Order | Sheet | Hidden | Grid | Frozen rows | Frozen columns | Header row | Last populated row |
|---:|---|---:|---|---:|---:|---:|---:|
| 0 | Executive Dashboard | No | 1000 × 12 | 2 | 0 | Generated layout | 61 |
| 1 | Brian's Daily Friction Log | No | 1000 × 10 | 1 | 0 | 1 | 1 |
| 2 | Product Feedback | No | 1000 × 26 | 1 | 0 | 1 | 1 |
| 3 | Client Workspace | No | 1000 × 26 | 3 | 0 | Generated layout | 40 |
| 4 | Follow-Ups | No | 1000 × 26 | 1 | 0 | 1 | 3 |
| 5 | Dashboard Metrics | No | 1000 × 26 | 1 | 0 | 1 | 30 |
| 6 | Master Prospect Tracker | No | 1000 × 47 | 4 | 0 | 4 | 14 |
| 7 | Clients | No | 1000 × 25 | 4 | 0 | 4 | 6 |
| 8 | Activity Feed | No | 1000 × 9 | 4 | 0 | 4 | 58 |
| 9 | Settings | No | 1001 × 7 | 5 | 0 | 2 and 5 | 42 |
| 10 | Inspection Playground | Yes | 1000 × 26 | 3 | 0 | Fixed developer layout | 60 |
| 11 | Projects | No | 1000 × 26 | 1 | 0 | 1 | 3 |

## Production entity counts

Counts were read directly from identity-bearing rows rather than inferred from dashboard cards.

| Entity | Count |
|---|---:|
| Prospects | 10 |
| Follow-Ups | 2 |
| Open Follow-Ups | 2 |
| Activity records | 54 |
| Clients | 2 |
| Projects | 2 |
| Business Snapshot intake activities | 2 |

## Accepted synthetic Business Snapshot evidence

The accepted synthetic Business Snapshot record was present and internally consistent at capture:

- exactly one matching Prospect
- `Offer / Service = Business Snapshot`
- `Status = Lead Found`
- `Next Action = Generate Executive Brief`
- exactly one open Executive Brief Follow-Up linked by the same Prospect ID
- exactly two correlated Activity records
- correlated Activity types: `Business Snapshot Intake` and `Follow-Up Created`
- both Activity operation keys use the `INTAKE:` contract

Full request, correlation, operation, and entity identifiers are retained only in the restricted production systems and are not copied into this document.

## Exact headers

### Master Prospect Tracker — row 4

`Company`, `Contact`, `Email`, `Phone`, `Website`, `City`, `State`, `Industry`, `Source`, `Audit Score`, `Audit Outcome`, `Priority Tier`, `Audit Source`, `Status`, `Next Action`, `Follow-Up Date`, `Last Activity`, `Opportunity Value`, `Offer / Service`, `Moved to CRM`, `Notes`, `Closed Date`, `Audit Package Generated`, `Audit Package Date`, `Discovery Date`, `Summary`, `Lifecycle Operation Key`, `Lifecycle Operation State`, `Lifecycle Operation Details`, `Lifecycle Confirmed At`, `Calendar Operation Key`, `Calendar Event ID`, `Calendar Operation State`, `Prospect ID`, `Validation Status`, `Validation Details`, `Inspection Status`, `Inspection Attempted At`, `Inspection Completed At`, `Workflow Status`, `Workflow Operation Key`, `Workflow Details`, `Review Status`, `Reviewed At`, `Review Notes`, `Proposal Generated`, `Gmail Draft Created`

### Follow-Ups — row 1

`Follow-Up ID`, `Company`, `Contact`, `Email`, `Related Prospect ID`, `Related Client ID`, `Current Status`, `Follow-Up Type`, `Due Date`, `Days Until Due`, `Priority`, `Assigned To`, `Notes`, `Completed`, `Completed Date`

### Clients — row 4

`Client`, `Service`, `Monthly Value`, `Start Date`, `Status`, `Next Review`, `Notes`, `Client Name`, `Contact`, `Email`, `Phone`, `Website`, `Priority Tier`, `Contract Value`, `Client Since`, `Last Activity`, `Client ID`, `Company`, `Industry`, `Service Package`, `Renewal Date`, `Assigned To`, `Current Project`, `Project Status`, `Due Date`

### Activity Feed — row 4

`Date`, `Company`, `Activity Type`, `Activity Notes`, `Next Action`, `Follow-Up Date`, `Prospect ID`, `Operation Key`

### Projects — row 1

`Project ID`, `Client ID`, `Client`, `Service`, `Package`, `Status`, `Priority`, `Start Date`, `Due Date`, `Progress %`, `Assigned To`, `Current Phase`, `Deliverables`, `Folder`, `Notes`, `Last Updated`

## Validation baseline

- Master Prospect Tracker:
  - `I5:I203` Source compatibility list
  - `K5:K203` Audit Outcome list
  - `L5:L203` Priority Tier list
  - `M5:M1000` strict Audit Source list
  - `N5:N1000` strict canonical lifecycle list
  - `O5:O1000` strict Next Action list
  - `S5:S203` Offer / Service compatibility list
  - `T5:T203` Moved to CRM list
- Clients: `E5:E104` client status list
- Projects: `F2:F1000` strict project status list; `M2:M1000` deliverable type list
- Settings: `B3` strict `FALSE`/`TRUE` list
- Activity Feed: `C5:C202` activity type compatibility list; `E5:E202` next-action compatibility list
- Brian's Daily Friction Log: strict Type, Priority, and Status lists through row 1000
- Product Feedback: strict Priority, Type, and Status lists through row 1000
- Follow-Ups: no data validation was returned

Exact allowed values are governed by `docs/BOP_WORKBOOK_CONTRACT_MANIFEST.json`.

## Conditional-formatting baseline

The metadata surface returned 11 rules, all on Master Prospect Tracker:

- one `A - Hot` rule across the priority/audit area for rows 5–204
- one `Poor Fit` rule on Audit Outcome for rows 5–204
- one exact-text Status rule for each of the nine canonical lifecycle values across `N5:N1000`

No other sheet returned conditional-formatting rules.

## Representative formulas

No formulas were present in the populated ranges inspected. Executive Dashboard, Dashboard Metrics, and Client Workspace values are materialized by Apps Script and must be treated as generated output contracts, not formula-driven reports.

## Fixed Apps Script layout contracts

### Executive Dashboard

- preparation/clear/format boundary: `A1:L80`
- KPI cards: `A1:L12`
- pipeline: `A14:C24`
- recent activity: `E14:H30`
- follow-up queue: `A34:G47`
- top opportunities: `H34:L45`
- quick actions: `A56:C58`; action cells are `A57:C58`
- system status: `E56:G61`

### Client Workspace

- preparation/clear/format boundary: `A1:J70`
- title: `A1:J1`
- selected client: `A2:J2`
- overview: starts `A4`
- contact: starts `D4`
- current project: starts `G4`
- timeline: starts `A13`
- documents: starts `G13`
- project delivery: starts `A22`
- quick actions: starts `A28`
- next steps: starts `E28`
- upcoming tasks: starts `A39`

## Acceptance-copy fingerprint

The Phase 1A copy has a distinct spreadsheet identity and an explicit `NON-PRODUCTION` title. Post-copy comparison found identical values in all 12 bounded populated ranges, identical sheet order, sheet IDs, dimensions, hidden state, frozen rows, timezone, and conditional-formatting metadata. The copy has only the same single owner permission observed on production.

The copy has not been connected to the production receiver, Cloudflare, website, BOP Version 7, or the production `BOP_SPREADSHEET_ID`. No Apps Script execution was run in the copy during Phase 1A.
