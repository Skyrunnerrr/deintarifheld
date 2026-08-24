# A14-03 M11 Current-State Audit

Repository-first. **No invented hosted PASS.**

## Evidence corpus

- Mapping: `docs/autonomous-os/autonomy-realignment/08_A0_M11_TO_AUTONOMY_MAPPING.md`
- A1: `docs/autonomous-os/autonomy-runtime/A1-11-M11O-M11V-MAPPING.md`
- A2: `docs/autonomous-os/lead-case-autopilot/A2-09-M11T-M11Q-M11R-M11S-MAPPING.md`
- Reports: `docs/autonomous-os/evidence-reports/DTH-M11A` … `DTH-M11E-R4` (letters A–E only)
- Migrations: only `*m11e*` private-schema / routine hardening
- Security scripts: only `scripts/security-tests/dth-m11e-*`
- Plan freeze `DO_NOT_START_M11F` lifted under A14 security execution; M11F CLOSED_E2_LOCAL

## Letter status

| Gate | Classification | Notes |
|------|----------------|-------|
| M11A–D | E1/hosted planning evidence | Cutover security track |
| M11E | PARTIAL | Staging Data API private-schema exposure proven (R4). Production private schemas still ABSENT per M11B notes |
| M11F | IMPLEMENTED_E2_LOCAL | Migration + test:dth:m11f; hosted NOT_PROVEN |
| M11G | IMPLEMENTED_E2_LOCAL | Workload groups + grants + ACL-02 + test:dth:m11g 18/18; hosted NOT_PROVEN |
| M11H | IMPLEMENTED_E2_LOCAL | `security.operators` + auth binding + `test:dth:m11h` 17/17; hosted NOT_PROVEN |
| M11I | IMPLEMENTED_E2_LOCAL | Role/capability catalog + assignments + `test:dth:m11i` 29/29; hosted NOT_PROVEN |
| M11J | NOT_STARTED | Strong App AuthZ next; A11 E2 ≠ production AuthZ |
| M11K | NOT_FOUND | Pooler proof |
| M11L | NOT_FOUND | Plan only |
| M11M | NOT_FOUND | Plan only |
| M11N | NOT_FOUND | Durable session hosted |
| M11O | IMPLEMENTED_E2_LOCAL | `security.control_state` / CONTROL_VERSION; hosted NOT_PROVEN |
| M11P | NOT_FOUND | Staging E2E AuthZ→Ops |
| M11Q | PENDING | Staging cutover |
| M11R | PENDING | |
| M11S | PENDING | service_role retirement before production autonomy |
| M11T | IMPLEMENTED_E2_LOCAL | Intake AuthZ mapping |
| M11U | CAN_DEFER (A0) | |
| M11V | IMPLEMENTED_E2_LOCAL | Runtime control mapping |

## Runtime posture (E2 local)

- Kill domains registered: **exactly 8**
- ops/security/workflow/audit: revoked from anon/authenticated in migrations; RLS enabled on many ops tables
- Production Data API still historically tied to service_role until M11Q/S
- Public runtime must not gain unrestricted service_role for autonomous paths

## Staging security readiness

`M11_STAGING_SECURITY=NOT_PROVEN`  
`SECURITY_FOR_STAGING` cannot PASS until M11J→P evidence exist (M11F–I E2 local closed). Auth provider Owner decision is **APPROVED (SUPABASE_AUTH)**; AuthN/MFA/AuthZ implementation remain NOT_PROVEN.

## Named M11 regression script

`M11_NAMED_REGRESSION_SCRIPT=NOT_PRESENT` (A13R). Boundary/grant tests cover fragments only.


## Post OD-A11-AUTH-PROVIDER

Identity path (planned, not implemented):

```text
Supabase Auth (email/password + TOTP aal2)
→ verified server session
→ auth.users.id
→ security operator mapping (M11H)
→ capabilities (M11I)
→ strong App AuthZ (M11J)
→ request DB context / roles (M11K + M11G grants on M11F LOGINs)
```

Do **not** skip to M11H implementation before M11G (closed).
