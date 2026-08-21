# A14-10 Rollback Requirements

Rollback ≠ `git revert` alone.

| Capability | E2 status | Staging/Prod requirement |
|------------|-----------|--------------------------|
| Global kill | Proven E2 | Hosted prove |
| Domain kill (8 domains) | Proven E2 | Hosted prove |
| Takeover | Proven E2 | Hosted prove |
| Provider disable | Ports exist; live N/A | Per-provider switch |
| Deploy rollback | NOT_STARTED | Artifact + prior SHA |
| Migration strategy | Prefer additive forward-fix | Document destructive limits |
| Secret revoke | NOT_STARTED | Fail-closed + no retry storm |
| Incident runbook | NOT written yet | Required before canary (`A14-INCIDENT-RUNBOOK.md` later phase) |

Every staging/prod deploy candidate needs a rollback target in the release manifest.
