# A1 ↔ M11O / M11V Mapping

| Requirement | A1 symbol | Maturity |
|-------------|-----------|----------|
| M11V workflow instances/jobs | `workflow.*` + db/workflow/* | E2_LOCAL |
| M11O durable kill | `security.control_state` GLOBAL | E2_LOCAL |
| M11O CONTROL_VERSION | `security.control_version` | E2_LOCAL |
| M11F–P AuthZ/RLS/session | unchanged gates | NOT_BYPASSED |
| Production complete | — | NO |

Labels: `PARTIALLY_CONSUMED_E2_LOCAL` / `IMPLEMENTED_E2_LOCAL` — never PRODUCTION_DONE.
