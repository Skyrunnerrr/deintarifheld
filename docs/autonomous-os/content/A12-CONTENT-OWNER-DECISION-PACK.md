# A12 Content Owner Decision Pack

| Decision | CURRENT EVIDENCE | RECOMMENDED DEFAULT | BLOCKS_E2 | BLOCKS_STAGING | BLOCKS_PRODUCTION |
|---|---|---|---|---|---|
| Channels | E2 synthetic LinkedIn/blog only | freeze live mix later | NO | YES | YES |
| Publishing provider | test adapter | owner pick (no Meta/LinkedIn freeze) | NO | YES | YES |
| AI provider | deterministic fixtures | owner pick; candidate-only | NO | if live gen used | YES |
| Social accounts | none | server-configured sandbox | NO | YES | YES |
| Cadence | unset | owner policy | NO | YES | YES |
| Content mix | E2 education-heavy | owner mix | NO | YES | YES |
| Audience | bounded SME segments | keep bounded; no PII profiling | NO | policy | YES |
| CTA | four educational CTAs | keep claim-safe | NO | policy | YES |
| Brand tone | BrandPolicyV1 | extend, do not import AVERION | NO | policy | YES |
| Claim policy | forbidden patterns v1 | owner legal review | NO | YES | YES |
| Approval | HIGH requires human; LOW test auto | production auto-publish not assumed | NO | YES | YES |
| Auto-publish | OWNER flag true | default off | NO | YES | YES |
| Links | deintarifheld.de only | allowlist expansion is owner | NO | policy | YES |
| Media / image gen | not implemented | defer; no auto image provider | NO | if media live | YES |
| Metrics provider | test getPostMetrics | publisher metrics, not revenue | NO | YES | YES |
| Retention | unresolved | owner | NO | YES | YES |

Flags remain true: `OWNER_CONTENT_STRATEGY_POLICY_REQUIRED`, `OWNER_CONTENT_PUBLISHING_PROVIDER_REQUIRED`, `OWNER_CONTENT_AI_PROVIDER_REQUIRED`, `OWNER_CONTENT_AUTOPUBLISH_POLICY_REQUIRED`.
