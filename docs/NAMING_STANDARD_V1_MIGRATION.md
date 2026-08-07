# Rogers Holdings Naming Standard v1.0 migration

This migration classifies naming occurrences by role rather than applying a
global replacement.

| Classification | Treatment | Examples |
| --- | --- | --- |
| Customer-facing | Canonical language only | PDF titles and filenames, Gmail copy, previews |
| Operator-facing | Canonical language only | menus, next actions, statuses, dashboards, workspace, activity wording |
| Compatibility/internal | Preserve and normalize | legacy stored lifecycle values, function names, schema columns, operation keys, old Drive filenames, Website Audit Tool source values |
| Historical/documentation-only | Retain with explanation | receiver architecture references to the legacy Website Audit receiver |

The canonical active journey is: Lead Found → Executive Brief Sent → Discovery
Meeting Scheduled → Digital Business Assessment → Improvement Plan Sent →
Project Started → Client.

Compatibility retained:

- `Executive Snapshot Sent` normalizes to `Executive Brief Sent`.
- `Digital Business Assessment Presented` normalizes to `Digital Business Assessment`.
- `Generate Executive Snapshot` and `Confirm Executive Snapshot Sent` normalize
  to their Executive Brief equivalents.
- `Website Audit` remains accepted as an old Offer / Service value and normalizes
  to `Business Snapshot`.
- `Executive Snapshot` remains accepted for an existing intake Follow-Up.
- `AuditReport.pdf`, `Audit Report.pdf`, and `Proposal.pdf` remain discoverable
  when sending an existing package. New files use `Digital Business
  Assessment.pdf` and `Improvement Plan.pdf`.
- Internal function names such as `generateExecutiveSnapshot`,
  `buildProposal_`, and schema headers such as `Proposal Generated` are unchanged.
- `Website Audit Tool API` is the canonical integration and newly stored
  evidence-source name. Historical `Website Audit Tool` and `Website Audit`
  values remain accepted for compatibility and metric recognition. None of
  these technical names are used as the customer Offer / Service label.
