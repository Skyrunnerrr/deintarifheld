# M11P E4 Test Plan (Prepare Only — Do Not Execute)

**Gate:** `M11_SECURITY_GATE:M11P`  
**Evidence target:** E4 (hosted staging readback)  
**Execution:** BLOCKED until `HOSTED_AUTH_PREREQUISITES=PROVEN` AND `STAGING_SECURITY_RUNTIME=READY`

## E4 chain under test

```text
HTTPS staging request
→ real hosted Supabase Auth session (cookie or server-extracted bearer)
→ AAL2 verified (provider evidence)
→ auth.users.id
→ M11H resolveOperatorByVerifiedAuthSubject
→ M11I authority (fresh)
→ M11J capability check
→ M11K transaction-local DB context
→ M11M RLS
→ Ops read or command
→ database readback (effect + audit)
```

## Positive scenarios

| ID | Scenario | Readback assertion |
|----|----------|-------------------|
| M11P-E4-01 | STAGING_OPERATOR AAL2 + CASE_VIEW | Protected read returns 200 + expected shape |
| M11P-E4-02 | Authorized command (e.g. low-risk ops) | `ops.operator_commands` row inserted once; `operator_id` matches M11H |
| M11P-E4-03 | Kill/control readable | `security.control_state` SELECT succeeds for worker/ops per policy |
| M11P-E4-04 | Audit trail | `public.audit_events` row with `operator_id`, capability, no tokens |

## Negative scenarios (effect must be zero)

| ID | Scenario | HTTP | DB effect |
|----|----------|------|-----------|
| M11P-E4-N01 | No session | 401 | 0 rows changed |
| M11P-E4-N02 | Invalid/expired JWT | 401 | 0 |
| M11P-E4-N03 | AAL1 only | 403 AAL2_REQUIRED | 0 |
| M11P-E4-N04 | Unprovisioned auth user | 403 OPERATOR_NOT_PROVISIONED | 0 |
| M11P-E4-N05 | DISABLED operator | 403 OPERATOR_DISABLED | 0 |
| M11P-E4-N06 | Wrong capability | 403 | 0 |
| M11P-E4-N07 | Stale authority_version | 403 | 0 |
| M11P-E4-N08 | Missing M11K context (direct SQL as ops) | RLS deny | 0 |
| M11P-E4-N09 | Cross-domain RLS (e.g. worker→ops table) | deny | 0 |
| M11P-E4-N10 | TEST_OWNER in hosted staging env | deny | 0 |
| M11P-E4-N11 | Body `authUserId` spoof | ignored; deny without valid session | 0 |
| M11P-E4-N12 | `user_metadata.role=OWNER` | no authority | 0 |
| M11P-E4-N13 | Kill active → high-impact command | deny | 0 |
| M11P-E4-N14 | Provider outage simulation | fail closed | 0 |

## Readback rules (not HTTP-only)

1. **Commands:** Count affected rows before/after; unauthorized attempts Δ=0  
2. **Idempotency:** Duplicate command id → no double effect  
3. **Actor binding:** `operator_id` in DB = M11H mapped id, not client-supplied  
4. **Authority version:** Recorded version matches fresh M11I resolution  
5. **No tokens in audit:** Scan audit payload for JWT/refresh/password patterns  

## Kill / control

| ID | Scenario |
|----|----------|
| M11P-E4-K01 | GLOBAL kill ACTIVE → protected command deny |
| M11P-E4-K02 | CONTROL_VERSION bump → stale worker job rejected (if in scope) |

## Observability (staging diagnostics)

Log / trace fields allowed:
- `request_id`, `operator_id`, `capability`, `authority_version`, command id, result class

Never log:
- JWT, refresh token, password, TOTP secret, full customer documents

## Test harness (future)

```text
npm run test:dth:m11p -- --profile=staging-e4
```

Reuse:
- M11N hosted session adapters (inject real `getUser` / `getAuthenticatorAssuranceLevel`)
- Existing ops BFF integration patterns (`ops:bff:tg04`, `cc:ui:tg05`)
- Supabase CLI for migration preflight only

Do **not** create parallel AuthZ framework.

## Go / no-go before execution

```text
M11P_READY_FOR_E4_EXECUTION=NO

Required:
HOSTED_AUTH_PREREQUISITES=PROVEN
STAGING_SECURITY_RUNTIME=READY
OWNER_CONFIGURATION_BLOCKERS=0
M11P_ENTRY_CRITERIA_ALL_PASS=YES
Explicit Owner go for E4 mutation/testing
```

## GDPR technical evidence (staging)

Supports: minimization, environment separation, least privilege, auditability.  
Does **not** claim DSGVO compliance.
