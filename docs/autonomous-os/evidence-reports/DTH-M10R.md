# DTH-M10R — Principal Data / Security / Privacy Architecture Review

```text
TRANCHE=DTH-M10R
DATE=2026-08-13
BASELINE_HEAD=0702fab0a00a6dde24b88963b78cf6f0d16590c4
M10_STATUS_BEFORE=PROVISIONAL_PASS
M10R=PASS
SELECTED_TOPOLOGY=DTH-DT-A
DATA_TOPOLOGY_DECISION_ROBUST=YES
IMPLEMENTATION_EXECUTED=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
```

## 1. Pre-flight

```text
HEAD=0702fab0a00a6dde24b88963b78cf6f0d16590c4
BRANCH=feat/deintarifheld-production-cutover-001
DIRTY=docs only (M10 + M10R)
SOURCE_CODE_CHANGED=NO
CONFIG_CHANGED=NO
M10R_PRE_FLIGHT=PASS
```

## 2. Executive verdict

```text
M10R=PASS
SELECTED_TOPOLOGY=DTH-DT-A
DATA_TOPOLOGY_DECISION_ROBUST=YES
```

DTH-DT-A survives. Material **documentation hardenings** required and applied (not topology rejection):

1. Runtime DB identity = **DIRECT_POSTGRES_LOGIN_ROLE** (not `service_role` Data API).
2. **PHYSICAL_SCHEMA_ISOLATION=REQUIRED**; ops/security/workflow/audit **not** Data-API-exposed.
3. Atomic intake = **SERVER_DIRECT_POSTGRES_TRANSACTION**.
4. Human DB context = Ops API request-scoped `set_config`; never client `person_id`.
5. **OPERATOR_PERSON ≠ EXTERNAL_PARTY**.
6. Kill/takeover = dispatch-authorization linearization (honest about in-flight).
7. Post-restore = privacy_ops ledger + quarantine replay.
8. Security-critical audit = same DB transaction INSERT.

## 3. Critical / High findings

| ID | SEV | Description | Resolved by |
|---|---|---|---|
| F-01 | CRITICAL | Conceptual PUBLIC_INTAKE without assumption mechanism; service_role BYPASSRLS | ADR-033 direct LOGIN |
| F-02 | CRITICAL | Optional physical schemas → Data API exposure risk | REQUIRED private schemas |
| F-03 | CRITICAL | Dual Data API inserts ≠ atomic outbox | Server direct txn |
| F-04 | HIGH | Identity spoof via body person_id / wrong auth.uid assumption | set_config from mapped session |
| F-05 | HIGH | PERSON overloaded operator+customer | EXTERNAL_PARTY |
| F-06 | HIGH | Backup restore reanimates deleted PII / opt-out | privacy ledger + quarantine |
| F-07 | HIGH | Table owner / BYPASSRLS unspoken | ownership + FORCE RLS class |
| F-08 | HIGH | Kill stronger than cross-system reality | linearization honesty |

## 4–11. Binding answers

```text
CANONICAL_ROLE_ASSUMPTION_PATTERN=DIRECT_POSTGRES_LOGIN_ROLE
PUBLIC_INTAKE_PRINCIPAL_FEASIBLE=YES
PHYSICAL_SCHEMA_ISOLATION=REQUIRED
HUMAN_DB_CONTEXT_PATTERN=OPS_API_SET_REQUEST_SCOPED_DB_CONTEXT
PUBLIC_INTAKE_ATOMIC_TRANSACTION_PATTERN=SERVER_DIRECT_POSTGRES_TRANSACTION
INTERNAL_IDENTITY_ENTITY=OPERATOR_PERSON
EXTERNAL_DATA_SUBJECT_ENTITY=EXTERNAL_PARTY
SECURITY_CRITICAL_AUDIT_ATOMICITY_PATTERN=SAME_DATABASE_TRANSACTION_INSERT
KILL_SWITCH_LINEARIZATION_POINT=DISPATCH_AUTHORIZATION_RESERVATION
HUMAN_TAKEOVER_LINEARIZATION_POINT=CONTROL_VERSION_INCREMENT_IN_DB_TXN
POST_RESTORE_PRIVACY_RECONCILIATION=PRIVACY_OPS_LEDGER_PLUS_QUARANTINE_REPLAY
PUBLIC_ACCEPTANCE_COMMIT_POINT=AFTER_DURABLE_INTAKE_TXN_COMMIT
```

Identity spoofing review: PASS (client/agent-supplied actor ids denied).

## 12–26. Additional hardenings recorded

- Transport idempotency ≠ business matching
- Intake vs lead confirmed (no spam-as-normal-lead; telemetry separate)
- Career purpose boundary invariant
- Lightweight EXTERNAL_PARTY (not giant CRM)
- Raw jsonb not long-lived SoT
- Outbox binds versioned intent + hash
- DELIVERY_UNKNOWN + adapter capability flags
- In-flight visibility states
- FK vs retention: hard FK where integrity needed; nullable/tombstone for audit after delete
- Marketing suppression restore safety required
- DSR via EXTERNAL_PARTY linkage index (not log scan)
- AI precedence formalized
- Migration runner offline-only; never in app
- SECURITY DEFINER exceptional
- Default-deny future object tests defined

## 27–33. Blast radius / sensitivity / failures / PII

Single-project blast radius acceptable **with** LOGIN least privilege + private schemas; Option B not required. Score sensitivity: A remains first.

Failure walkthrough A–L controlled (see §48 prompt cases) — no silent unrecoverable corruption class remaining as architecture reject.

PII copies: lead, career, EXTERNAL_PARTY, case/comms (minimize), outbox/DLQ/traces (refs), audit (ids), provider refs — all have delete/anonymize path class; raw jsonb transition-only.

## 34. Finding register

See §3 plus MED/LOW in review prompt coverage (async audit, outbox drift, jsonb, career bleed, provenance limits, definer policy) — all doc-hardened; none architecture-rejecting after fix.

## 35. Required M10 corrections

Applied in `06_DATA_ARCHITECTURE.md`, ADR-033/034, patches to ADR-017/021/023/024/031, gov docs, this report.

## 36. M10 decisions still final

DTH-DT-A; SoT model; evolutionary migration; Postgres-first workflow/control; one migration authority; grants≠RLS; no agent/CC DB; service_role not target.

## 37. M10 decisions changed / sharpened by review

- Physical schema isolation: optional → **REQUIRED**
- Role assumption: unspecified → **DIRECT_POSTGRES_LOGIN_ROLE**
- Atomicity mechanism: asserted → **SERVER_DIRECT_POSTGRES_TRANSACTION**
- PERSON → split OPERATOR_PERSON / EXTERNAL_PARTY
- Kill semantics honesty + in-flight model
- Restore privacy process mandatory
- Audit critical path same-txn

## 38. Gate

```text
M10R=PASS
REASON=All acceptance gates in §58 met via architecture decisions + doc hardenings; DTH-DT-A retained; no implementation/commit.
```

## 39. Repository state

```text
SOURCE_CODE_CHANGED=NO
CONFIG_CHANGED=NO
SQL_CREATED=NO
MIGRATION_EXECUTED=NO
DB_MUTATION=NO
COMMIT_CREATED=NO
PUSH_EXECUTED=NO
MERGE_EXECUTED=NO
DEPLOY_EXECUTED=NO
```

## 40. Next

```text
RECOMMENDED_NEXT_ACTION=DTH-M10F_CANONICAL_DATA_ARCHITECTURE_FREEZE
```
EOF

## M10F FREEZE NOTE

STATUS remains PASS. Frozen by DTH-M10F. No reinterpretation. Implementation gaps remain OPEN until authorized later tranches.
