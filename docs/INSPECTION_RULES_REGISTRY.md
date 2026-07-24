# Rogers Holdings Inspection Rules Registry

## Purpose

The Inspection Rules Registry centralizes rule metadata for Business Optimization Platform inspectors.

Inspectors remain responsible for detection. The registry is responsible for the shared business definition of a rule:

- what the rule means
- how severe it is
- what evidence should support it
- why it matters to the business
- how customers experience the issue
- what action should be recommended

This keeps current and future inspectors consistent without changing existing audit scoring, PDF rendering, Gmail workflows, Drive routing, dashboards, CRM logic, or report layouts.

## Module

`InspectionRulesRegistry.gs`

Primary entrypoint:

```js
getInspectionRulesRegistry_()
```

This returns rules grouped by category.

Supporting helpers:

```js
getInspectionRuleDefinition_(ruleId)
getInspectionRulesByCategory_(category)
flattenInspectionRulesRegistry_()
mergeInspectionRuleMetadata_(target, ruleId)
```

## Rule Schema

Each rule supports:

| Field | Purpose |
| --- | --- |
| `ruleId` | Stable unique rule identifier. |
| `category` | Inspection category. |
| `title` | Human-readable rule title. |
| `description` | Plain-English explanation of what the rule checks. |
| `severity` | Default impact severity. |
| `priority` | Default remediation priority. |
| `enabled` | Whether the rule should be considered active. |
| `industry` | `All` by default; supports future industry-specific rule packs. |
| `minimumConfidence` | Minimum confidence needed before a finding should be trusted. |
| `expectedEvidence` | Evidence sources expected to support the rule. |
| `businessReason` | Why the issue matters to the business. |
| `customerReason` | Why customers notice or care. |
| `recommendedAction` | Default recommended fix. |
| `estimatedEffort` | Default implementation effort. |
| `expectedROI` | Default expected return. |
| `tags` | Searchable metadata for grouping/reporting. |
| `version` | Rule version for future governance. |

The implementation also supports an internal `aliases` field so existing inspector keys can map to stable registry IDs without renaming current detections.

## Category Structure

The registry initializes these standard categories:

- Homepage
- Navigation
- Contact Information
- Calls To Action
- Trust Signals
- Reviews
- Google Business
- Local SEO
- Performance
- Accessibility
- Brand Consistency
- Lead Generation
- Content Quality
- Analytics
- Security
- Mobile Experience

Categories may be empty until inspectors or rule packs are added.

## Current Rule Set

The initial registry includes metadata for rules covering:

- Missing phone number
- Phone below first screen
- Missing click-to-call
- Missing email
- Missing contact page
- Missing contact form
- Missing reviews
- Missing testimonials
- Missing service area
- Missing hours
- Missing address
- Missing header/footer contact information
- No CTA
- Weak CTA wording
- Missing H1
- Poor page title
- Missing meta description
- Broken navigation
- Missing FAQ
- Missing About page
- Missing Services page
- Missing Privacy Policy
- Missing Terms
- Missing Google Map
- Missing Google Business link
- Missing social links
- Missing trust badges
- Weak branding consistency
- Broken internal links

## How Inspectors Consume Rules

Inspectors should keep detection logic local and retrieve rule metadata from the registry.

Recommended pattern:

```js
const rule = mergeInspectionRuleMetadata_(localRule, localRule.ruleId || localRule.key);
```

This preserves existing inspector behavior while filling in centralized metadata such as priority, expected evidence, rule version, tags, and default business reasons.

For new inspectors:

1. Add the rule metadata to `InspectionRulesRegistry.gs`.
2. Keep the detection predicate in the inspector module.
3. Use `getInspectionRuleDefinition_(ruleId)` or `mergeInspectionRuleMetadata_()`.
4. Include `ruleId` and `ruleVersion` in finding metadata.

## Industry-Specific Rule Packs

The `industry` field is reserved for future rule packs.

Examples:

- Roofing
- Dental
- HVAC
- Plumbing
- Logistics
- Fitness
- Restaurant

Future industry-specific rules should keep the same schema and use a more specific `industry` value. The orchestrator or inspector can later filter rules by prospect industry without changing the client-facing PDF renderer.

## Future Expansion

Planned extensions:

- Inspector-specific rule packs
- Industry-specific rule severity overrides
- Evidence quality scoring
- Rule version migration notes
- Disabled/deprecated rule handling
- Rule coverage reports in the Inspection Playground
- AI-assisted evidence population using the same rule schema

The registry is intentionally metadata-only. It should not fetch websites, inspect HTML, score reports, render PDFs, or write to sheets.
