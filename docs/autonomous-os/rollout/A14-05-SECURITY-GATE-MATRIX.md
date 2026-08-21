# A14-05 Security Gate Matrix

| Gate | Required for | Current | Blocking |
|------|--------------|---------|----------|
| OD-A11-AUTH-PROVIDER | All staging CC | OPEN | YES |
| M11E private schemas (prod) | Prod | NOT_PROVEN | YES for prod |
| M11E private schemas (staging exposure) | Staging | R4 proven | Partial |
| M11F→P | Staging autonomy | NOT_STARTED | YES |
| M11O hosted controls | Staging | E2 only | YES |
| M11T hosted | Staging | E2 only | YES |
| M11Q/R/S | Production autonomy | PENDING | YES for prod autonomy |
| Anon/auth grants on ops | All | E2 migrations + tests | Re-prove hosted |
| Default privileges | All | M11E migrations | Re-prove hosted |
| No secrets in browser/repo | All | Policy | Continuous |
| Kill/takeover durable | Staging+ | E2 proven | Hosted prove |
| Webhook authenticity (A4+) | Staging providers | NOT_PROVEN | YES |
| Malware path (A6) | Customer upload | NOT_PROVEN | YES before upload |
| Tracking consent (A13) | Live tracking | NOT_PROVEN | YES |

Target architecture remains: Browser → authenticated server → verified operator → server AuthZ → narrow DB role → domain command → private schema.
