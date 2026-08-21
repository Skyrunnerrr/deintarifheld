# A14-03 M11 Current-State Audit

Repository-first. **No invented hosted PASS.**

## Evidence corpus

- Mapping: `docs/autonomous-os/autonomy-realignment/08_A0_M11_TO_AUTONOMY_MAPPING.md`
- A1: `docs/autonomous-os/autonomy-runtime/A1-11-M11O-M11V-MAPPING.md`
- A2: `docs/autonomous-os/lead-case-autopilot/A2-09-M11T-M11Q-M11R-M11S-MAPPING.md`
- Reports: `docs/autonomous-os/evidence-reports/DTH-M11A` … `DTH-M11E-R4` (letters A–E only)
- Migrations: only `*m11e*` private-schema / routine hardening
- Security scripts: only `scripts/security-tests/dth-m11e-*`
- Plan freeze: `DO_NOT_START_M11F=YES` after R4

## Letter status

| Gate | Classification | Notes |
|------|----------------|-------|
| M11A–D | E1/hosted planning evidence | Cutover security track |
| M11E | PARTIAL | Staging Data API private-schema exposure proven (R4). Production private schemas still ABSENT per M11B notes |
| M11F | NOT_FOUND | No migration/report; not started |
| M11G | NOT_FOUND | Plan only |
| M11H | NOT_FOUND | Person mapping / IdP — blocked on OD-A11-AUTH-PROVIDER |
| M11I | NOT_FOUND | Plan only |
| M11J | NOT_FOUND | Strong App AuthZ; A11 E2 ≠ production AuthZ |
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
`SECURITY_FOR_STAGING` cannot PASS until AuthN Owner decision + M11F→P evidence exist.

## Named M11 regression script

`M11_NAMED_REGRESSION_SCRIPT=NOT_PRESENT` (A13R). Boundary/grant tests cover fragments only.
