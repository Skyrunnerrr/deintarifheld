# M11P Reuse and Implementation Decision

**Gate:** `M11_SECURITY_GATE:M11P`  
**Status:** DISCOVERY_COMPLETE — implementation **NOT AUTHORIZED** (hosted configuration + staging security runtime pending)  
**M11N base:** `9bed163ba5aee288be7ba1dd4c72ae1528a28f1c`  
**Date:** 2026-08-25

## Canonical definition (repository evidence)

| Field | Value | Primary evidence |
|-------|-------|------------------|
| **Name** | Staging E2E AuthZ→RLS→Ops | `07_IMPLEMENTATION_PLAN.md` tranche 15; `A14-01-CANONICAL-ROLLOUT-MATRIX.md` |
| **Purpose** | End-to-end proof that a real hosted operator request traverses verified auth → M11H/I/J → M11K DB context → RLS → Ops command/read | `A14-05-SECURITY-GATE-MATRIX.md` |
| **Entry criteria** | M11F–N E2 proven; M11O E2 proven; hosted Supabase Auth configured; staging security runtime ready | `A14-03`, `A14-06`, `A1-13-STAGING-DEPENDENCY-REGISTER.md` |
| **Exit criteria** | **E4** staging readback: protected operator path succeeds; negative cases fail closed | `07_IMPLEMENTATION_PLAN.md` MIN_EVIDENCE=E4 |
| **Dependencies** | M11O (durable kill/CONTROL_VERSION); M11N hosted session foundation; M11C staging project; M11D–M migrations on staging | `A1-11-M11O-M11V-MAPPING.md`, rollout matrix |
| **Owner decisions** | Hosted Auth Dashboard (invite-only, email/password, TOTP/AAL2, JWT/session, redirects) | `A14-00`, `M11N-HOSTED-OPERATOR-SESSION-SECURITY.md` |
| **Production blockers addressed** | **None** — M11P does not close context forgery, runtime DB identity, or service_role retirement | explicit in A14-05 |
| **Next gate** | M11Q (PUBLIC_INTAKE LOGIN + atomic txn) | `07_IMPLEMENTATION_PLAN.md` tranche 16 |

### Naming note (not a scope conflict)

`08_A0_M11_TO_AUTONOMY_MAPPING.md` still labels historical M11N as “durable session registry.” A14 execution redefined **M11N = hosted operator session security** (closed E2 local). M11P scope is unchanged: staging E2E AuthZ→Ops.

## M11O dependency status

| Item | Status |
|------|--------|
| `security.control_state` / CONTROL_VERSION | IMPLEMENTED_E2_LOCAL |
| `packages/db/src/workflow/control.js` | REUSE_EXISTING_DTH |
| M11L RLS on control tables | PROVEN_E2_LOCAL |
| Hosted prove | NOT_PROVEN |
| **Reuse** | YES — do not rebuild M11O |
| **Regression** | Include kill/control tests in M11P E2E harness only |

## M11P gap matrix

| Requirement | Current state | Evidence | Reuse class | Upstream option | DTH change | Security impact | Test required | Owner action | Blocker |
|-------------|---------------|----------|-------------|-----------------|------------|-----------------|---------------|--------------|---------|
| Staging project exists | PASS (M11C historical) | `DTH-M11C.md`, `01_CURRENT_STATE.md` | REUSE_EXISTING_DTH | Supabase dedicated project | None | Low | Read-only probe | None | — |
| M11F–M migrations on staging | NOT applied | `A14-06` STAGING_RUNTIME=NOT_STARTED | DEFER_CANONICAL_LATER_GATE | Supabase CLI `db push` / CI | Apply migrations staging-only | High | Pre/post grant/RLS probes | Staging DDL custody | YES |
| Hosted Supabase Auth config | NOT_PROVEN | `HOSTED_AUTH_CONFIGURATION=NOT_YET_PROVEN` | OWNER_CONFIGURATION | Supabase Auth dashboard | None (config) | Critical | Hosted login/MFA readback | Apply session policy checklist | **YES** |
| Server session verification | E2 local | `hosted-session.js`, `test:dth:m11n` | REUSE_EXISTING_DTH | `@supabase/ssr` (future CC wiring) | ADAPT when CC host ready | Critical | M11N regression + staging probe | Cookie/host wiring later | — |
| AAL2 enforcement | E2 local | M11N tests | REUSE_EXISTING_DTH | Supabase MFA/TOTP | Verify hosted | Critical | Staging MFA challenge | Enable TOTP + AAL2 | YES |
| M11H operator mapping | E2 local | `test:dth:m11h` | REUSE_EXISTING_DTH | — | Seed staging operators | High | Positive/negative mapping | Staging data seed | YES |
| M11J capability AuthZ | E2 local | `test:dth:m11j` | REUSE_EXISTING_DTH | — | None | Critical | Staging command matrix | — | — |
| M11K DB request context | E2 local | `test:dth:m11k` | REUSE_EXISTING_DTH | Postgres `set_config` txn-local | Runtime `dth_ops_api` wiring on staging | Critical | Pool leak + context tests | Runtime identity gate | PARTIAL |
| M11L/M RLS | E2 local | `test:dth:m11l/m11m` | REUSE_EXISTING_DTH | Postgres RLS (native) | Re-prove on staging | Critical | Cross-role deny tests | Migrations on staging | YES |
| Ops BFF protected path | E2 local | `create-ops-bff.js`, ops tests | REUSE_EXISTING_DTH | — | Point BFF at staging | High | E2E HTTP tests | Staging secrets | YES |
| Kill / CONTROL_VERSION | E2 local | `kill-switch.test.js`, M11O | REUSE_EXISTING_DTH | — | Re-prove hosted | Med | Kill deny during E2E | — | — |
| E2E harness | Partial | A11/CC/ops integration scripts | ADAPT_OFFICIAL | Node test runner (existing) | `test:dth:m11p` staging profile | Med | New M11P suite | Staging env vars | YES |
| Context forgery closure | OPEN | `M11-OPEN-DB-CONTEXT-FORGERY` | DEFER_CANONICAL_LATER_GATE | — | Not M11P scope | Critical | — | Later gate | NO (document only) |
| Runtime DB identity alignment | OPEN | `M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT` | DEFER_CANONICAL_LATER_GATE | Supabase pooler + PG roles | Explicit later gate | Critical | — | Later gate | NO (document only) |
| service_role retirement | NOT complete | A14-result | DEFER_CANONICAL_LATER_GATE | — | M11S | Critical | — | M11S | NO |

**M11P_REQUIREMENTS_WITHOUT_DECISION=0** (all classified)

## Open security risk ownership

| Risk | Owner gate | M11P closes? |
|------|------------|--------------|
| M11-OPEN-DB-CONTEXT-FORGERY | Explicit later gate (not M11P) | **NO** |
| M11-OPEN-RUNTIME-DATABASE-IDENTITY-ALIGNMENT | Explicit later gate | **NO** |
| SERVICE_ROLE_RETIREMENT | M11S | **NO** |
| HOSTED_AUTH_CONFIGURATION | Owner + M11P prerequisite | **Partial** (M11P proves after config) |

## Reuse decisions

### REUSE_EXISTING_DTH (do not rebuild)

- Full M11F→M11N chain (roles, grants, mapping, AuthZ, context, RLS, session verify)
- M11O durable control (`security.control_state`, CONTROL_VERSION)
- Ops BFF + `gateA11Request` / `gateHostedA11Request` boundary
- Existing integration runners: `ops:bff:tg04`, `cc:ui:tg05`, `workers:tg06`

### ADAPT_OFFICIAL (when CC hosted wiring proceeds)

| Area | Official source | Adaptation |
|------|-----------------|--------------|
| Cookie session transport | `@supabase/ssr` + Supabase Auth docs | Wire Next.js server client; keep M11N server verify as authority |
| Staging migration apply | Supabase CLI | CI job with staging credentials; no prod |
| E2E HTTP checks | Node `--test` (already used) | Staging profile env gate |

### OWNER_CONFIGURATION (before M11P implementation)

See hosted checklist in `M11N-HOSTED-OPERATOR-SESSION-SECURITY.md` § Hosted configuration register.

### CUSTOM_DTH (M11P-specific new work when authorized)

- `test:dth:m11p` staging E2E profile (read-only + controlled synthetic commands)
- Staging evidence report `DTH-M11P.md`
- No parallel AuthZ system

### Rejected upstream

| Candidate | Reason |
|-----------|--------|
| Full Supabase Next.js starter replacement | Would replace DTH app — violates architecture |
| Third-party auth boilerplate repos | Duplicate Supabase + existing M11N |
| Custom JWT/session DB | Supabase Auth remains credential authority |

## Implementation order (when authorized)

1. Owner applies hosted Auth configuration checklist
2. Staging security runtime: apply M11F–M migrations + secrets (M11C–M track on staging)
3. Seed synthetic staging operators (M11H/I)
4. Add `test:dth:m11p` staging profile (E4 probes)
5. Run M11P E2E → evidence report → commit
6. Full regression per gate matrix

## Rollback plan

- Disable staging BFF hosted mode (`DTH_AUTH_MODE=local_test` only in staging if needed)
- Revoke staging operator seeds
- No production mutation in M11P scope

## Authorization

```text
M11P_IMPLEMENTATION_AUTHORIZED=NO
STOP=M11P_HOSTED_CONFIGURATION_REQUIRED
```

Secondary dependency (documented, not primary stop): staging security runtime + M11F–M staging apply (`A14-06`).

## Test plan (draft)

| ID | Scenario |
|----|----------|
| M11P-01 | Hosted AAL2 session → protected read succeeds |
| M11P-02 | AAL1 → deny |
| M11P-03 | Unprovisioned auth user → deny |
| M11P-04 | Disabled operator → deny |
| M11P-05 | Missing capability → deny |
| M11P-06 | RLS cross-domain deny |
| M11P-07 | Kill active → high-impact deny |
| M11P-08 | TEST_* cannot enter staging hosted path |
| M11P-09 | No service_role in browser bundle (scan) |
| M11P-10 | Provider outage → fail closed |

Evidence target: **E4** (hosted staging readback).
