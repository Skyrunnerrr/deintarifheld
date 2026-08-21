# A14-05 Security Gate Matrix

| Gate | Required for | Current | Blocking |
|------|--------------|---------|----------|
| OD-A11-AUTH-PROVIDER | All staging CC | **APPROVED SUPABASE_AUTH** | Decision cleared; impl still required |
| M11E private schemas (prod) | Prod | NOT_PROVEN | YES for prod |
| M11E private schemas (staging exposure) | Staging | R4 proven | Partial |
| M11F→P | Staging autonomy | NOT_STARTED — **next=M11F** | YES |
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


## Next single gate

`M11_SECURITY_GATE:M11F_RUNTIME_LOGIN_ROLES`

Reason: repository order is M11F→G→H→…; Auth provider is chosen so M11H can later map `auth.users.id`→operator, but F/G least-privilege LOGIN roles remain the first unimplemented staging AuthZ prerequisite (`DO_NOT_START_M11F` freeze lifts only under A14 security execution with Owner awareness).
