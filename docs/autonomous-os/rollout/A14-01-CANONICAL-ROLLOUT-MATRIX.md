# A14-01 Canonical Rollout Matrix

Evidence levels: E0 claimed · E1 static · E2 local · E3 sandbox · E4 staging · E5 prod readback · E6 stable prod.

Status values: OPEN · E2_PROVEN · OWNER_REQUIRED · PROVIDER_REQUIRED · SECURITY_REQUIRED · NOT_STARTED · NOT_PROVEN · PARTIAL.

| ID | Domain | Dependency | Current State | Evidence | Blocking Stage | Owner Decision | Provider | Security | Legal/Privacy | Impl Required | Staging | Canary | Readback | Rollback | Monitoring | Gate | Status |
|----|--------|------------|---------------|----------|----------------|----------------|----------|----------|---------------|---------------|---------|--------|----------|----------|------------|------|--------|
| A4-P01 | A4 | Live email provider | Test adapter only | E2 | Staging | OD-A4-RESEND-INBOUND | YES | | | Adapter bind | YES | YES | YES | Provider disable | Bounce/unknown | PROVIDER | PROVIDER_REQUIRED |
| A4-P02 | A4 | Sender/domain verify | Not proven | E0 | Staging | OD-A4-RESEND-INBOUND | YES | | | Config | YES | | YES | | | PROVIDER | PROVIDER_REQUIRED |
| A4-P03 | A4 | Webhook authenticity | Not proven | E0 | Staging | | YES | YES | | Verify impl | YES | | YES | | | SECURITY | SECURITY_REQUIRED |
| A4-O01 | A4 | Follow-up cadence | Synthetic policy | E2 | Staging | OD-A4-FOLLOWUP-CADENCE | | | | Policy freeze | YES | | | | | OWNER | OWNER_REQUIRED |
| A5-P01 | A5 | Calendar provider | test_calendar | E2 | Provider | OD-A5-CALENDAR-PROVIDER | YES | | YES DPA | Adapter | YES | YES | YES | Cancel/disable | | PROVIDER | PROVIDER_REQUIRED |
| A5-O01 | A5 | TZ/hours/lead/horizon | Test policy | E2 | Staging | OD-A5-BOOKING-POLICY | | | | Policy | YES | | | | | OWNER | OWNER_REQUIRED |
| A6-P01 | A6 | Object storage | LocalTestDocumentStorage | E2 | Provider | OD-A6-STORAGE | YES | YES | YES | Adapter | YES | YES | | Delete path | | PROVIDER | PROVIDER_REQUIRED |
| A6-P02 | A6 | OCR | Local extract | E2 | Provider | OD-A6-OCR | YES | | YES residency | Adapter | YES | | | | | PROVIDER | PROVIDER_REQUIRED |
| A6-P03 | A6 | Malware scan | None | E0 | Security | OD-A6-MALWARE | YES | YES | | Scanner path | YES | | | | | SECURITY | SECURITY_REQUIRED |
| A6-O01 | A6 | Retention/DSR | Unresolved | E0 | Production | OD-A6-RETENTION | | | YES | Policy | | | | | | OWNER | OWNER_REQUIRED |
| A7-P01 | A7 | Live tariff source | Synthetic catalogue | E2 | Provider | OD-A7-LIVE-TARIFF-SOURCE | YES | | | Import/version | YES | YES | YES | Stale block | Freshness | PROVIDER | PROVIDER_REQUIRED |
| A7-O01 | A7 | Ranking/VAT/commission | Test policy | E2 | Staging | OD-A7-COMMERCIAL-POLICY | | | YES | Policy | YES | | | | | OWNER | OWNER_REQUIRED |
| A8-O01 | A8 | Selection/approval/legal | Synthetic | E2 | Staging/Canary | OD-A8-COMMERCIAL | | | YES | Templates | YES | YES | | | | OWNER | OWNER_REQUIRED |
| A8-G01 | A8 | No synthetic tariffs in prod offers | Enforced E2 | E2 | Canary | | A7 live | | | Gate | YES | YES | | | | CANARY | OPEN |
| A9-P01 | A9 | Live switch provider | TEST_SWITCH_V1 | E2 | Provider | OD-A9-LIVE-SWITCH-PROVIDER | YES | | YES | Adapter | YES | YES | YES | Pause/disable | Mismatch | PROVIDER | PROVIDER_REQUIRED |
| A9-O01 | A9 | Submission/payment/multi-supply | Partial E2 | E2 | Staging/Canary | OD-A9-SWITCH-POLICY | | YES SEPA | YES | Policy | YES | YES | YES | | | OWNER | OWNER_REQUIRED |
| A10-P01 | A10 | Lifecycle provider/readback | Test adapter | E2 | Provider | OD-A10-LIFECYCLE-PROVIDER | YES | | | Adapter | YES | YES | YES | | | PROVIDER | PROVIDER_REQUIRED |
| A10-O01 | A10 | Renewal timing/comms | Test policy | E2 | Staging | OD-A10-RENEWAL-POLICY | | | | Policy | YES | | | | | OWNER | OWNER_REQUIRED |
| A11-S01 | A11 | Auth provider decision | **SUPABASE_AUTH approved** | E1 Owner | Security impl | OD-A11-AUTH-PROVIDER | Supabase Auth | YES | | Implement AuthN+MFA | YES | | | | | SECURITY | PASS_OWNER_APPROVED |
| A11-S02 | A11 | Strong AuthZ/roles | E2 matrix | E2 | Security | OD-A11-ROLE-CAPABILITY | | YES M11J | | M11J | YES | | | | | SECURITY | SECURITY_REQUIRED |
| A11-D01 | A11 | CC deployment model | Loopback | E2 | Staging | OD-A11-DEPLOYMENT | | YES | | Hosted server | YES | | | Deploy RB | | OWNER | OWNER_REQUIRED |
| A12-P01 | A12 | Content AI provider | DeterministicTest | E2 | Provider | OD-A12-AI | YES | | YES | Adapter | YES | | | | | PROVIDER | PROVIDER_REQUIRED |
| A12-P02 | A12 | Publishing provider/accounts | DeterministicTest | E2 | Provider | OD-A12-PUBLISHING | YES | | | Adapter | YES | YES | YES | | | PROVIDER | PROVIDER_REQUIRED |
| A12-O01 | A12 | Autopublish/strategy/claims | E2 policies | E2 | Staging | OD-A12-CONTENT-POLICY | | | YES claims | Policy | YES | | | | | OWNER | OWNER_REQUIRED |
| A13-P01 | A13 | Paid acquisition provider | DeterministicTest | E2 | Provider | OD-A13-PROVIDER | YES | | YES | Adapter | YES | YES late | YES | Pause | Spend alerts | PROVIDER | PROVIDER_REQUIRED |
| A13-O01 | A13 | Budget/attribution/tracking | Test policies | E2 | Staging/Canary | OD-A13-ACQUISITION-POLICY | | YES consent | YES | Policy | YES | YES | YES | Cap/pause | | OWNER | OWNER_REQUIRED |
| M11-E | M11 | Private schema exposure | Staging R4 proven; prod schemas absent | E4 staging / E0 prod | Staging/Prod | | | YES | | Continue F+ | YES | | Hosted | | | SECURITY | PARTIAL |
| M11-F-P | M11 | AuthZ/runtime/session/pooler | **M11F–I E2 proven**; J–P open | E2/E0 | Staging | | | YES | | M11J next | YES | | | | | SECURITY | PARTIAL |
| M11-O | M11 | Durable controls | E2 local control_state | E2 | Staging | | | YES | | Hosted prove | YES | | | Kill | | SECURITY | E2_PROVEN |
| M11-T | M11 | Intake AuthZ mapping | E2 local | E2 | Staging | | | YES | | Hosted | YES | | | | | SECURITY | E2_PROVEN |
| M11-QRS | M11 | service_role retirement | PENDING | E0 | Production | | | YES | | Cutover | | | | | | SECURITY | NOT_STARTED |
| CONV-01 | Platform | Autonomy↔cutover merge | Lines diverge 87/1 | E1 | Integration | OD-A14-BRANCH-CONVERGENCE | | | | Strategy only | Later | | | | | OWNER | OWNER_REQUIRED |
| HARNESS-01 | Platform | A1–A3 isolation for release | Isolated green; sequential flake | E2 | Staging CI | | | | | test:dth:release | YES | | | | | RELEASE | OPEN |
| MON-01 | Platform | Ops monitoring/alerting | Requirements only | E0 | Canary | | | | | Implement | YES | YES | | | YES | MONITORING | NOT_STARTED |
| RB-01 | Platform | Deploy/migration rollback | Requirements only | E0 | Staging | | | | | Plans | YES | YES | | YES | | ROLLBACK | NOT_STARTED |

## Counts

- Matrix rows above: 34 gate rows
- Owner decision IDs: see A14-02 (~35 normalized)
- Provider gates: ≥12
- Security: M11F+M11G+M11H+M11I PROVEN_E2_LOCAL; M11J–P NOT_STARTED; M11E PARTIAL (staging exposure only)


## Auth decision status (post OD-A11-AUTH-PROVIDER)

| Key | Status |
|-----|--------|
| AUTH_PROVIDER_DECISION | PASS_OWNER_APPROVED |
| AUTH_IMPLEMENTATION | NOT_PROVEN |
| MFA_IMPLEMENTATION | NOT_PROVEN |
| STAGING_AUTH | NOT_PROVEN |
| PRODUCTION_AUTH | NOT_PROVEN |
| STRONG_AUTHZ | NOT_PROVEN |
| SECURITY_FOR_STAGING | NOT_PASS |

Next gate: `M11J` strong application AuthZ (then K request DB context).


## M11F–I status

| Key | Status |
|-----|--------|
| M11F_RUNTIME_LOGIN_ROLES | PROVEN_E2_LOCAL |
| M11G_RUNTIME_LEAST_PRIVILEGE | PROVEN_E2_LOCAL |
| M11H_OPERATOR_IDENTITY | PROVEN_E2_LOCAL |
| M11H_HOSTED_AUTH_BINDING | NOT_PROVEN |
| M11I_ROLE_CAPABILITY_MAPPING | PROVEN_E2_LOCAL |
| M11J | NEXT |
| AUTH_IMPLEMENTATION | NOT_STARTED |
| STAGING_SECURITY | NOT_PROVEN |
