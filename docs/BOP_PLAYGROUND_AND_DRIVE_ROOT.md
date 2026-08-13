# BOP Playground and Client Drive Root

## Durable workbook model

- Production: `Rogers Holdings BOP — CRM & Delivery System`
- Playground: `Rogers Holdings BOP — Playground`
- Temporary acceptance: retained only while the paused acceptance checkpoint remains open
- Formal future acceptance runs: disposable copies derived from Playground, then recoverably retired after evidence is preserved

The Playground is a distinct spreadsheet copied from the empty post-reset production workbook. It preserves the authoritative 12-sheet structure and 47-column prospect schema. It must not carry production Script Properties, triggers, tokens, receiver mappings, Headquarters feed configuration, or production Workspace destinations.

Developer Mode may be enabled in Playground. Synthetic records must use test-only contact and destination values and must be removed after each bounded test.

## Production client Drive root

Production-generated prospect and client artifacts use Script Property:

`BOP_CLIENT_DRIVE_ROOT_ID`

The value must be the stable ID of `Rogers Holdings LLC/Clients`. When configured, BOP searches and creates company folders only as exact children of that folder. Duplicate exact child names fail closed. A missing property preserves legacy global Drive lookup for backward compatibility, but production should keep the property configured.

Nonproduction Apps Script projects must not use the production Clients folder ID. A Playground or disposable acceptance project may use a dedicated test root only.

## Acceptance checkpoint migration

Keep the current temporary acceptance workbook unchanged until its paused evidence checkpoint is closed. Afterward, future acceptance begins from a disposable copy of Playground. Preserve required evidence outside the disposable workbook before moving it to Trash.

## Timezone follow-up

Production workbook timezone remains `America/Los_Angeles` while Apps Script and business operations use `America/New_York`. Do not change this during consolidation. Plan a separately approved migration with date-boundary tests for follow-ups, dashboards, intake dates, Calendar operations, and Sales Feed due/overdue calculations.
