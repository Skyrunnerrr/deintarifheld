# npm audit — dependency risk register

**Date:** 2026-09-15  
**Command:** `npm audit --json` after Next **15.5.24** (no Next 16).  
**Policy:** report only. `npm audit fix` / `npm audit fix --force` were **not** run.  
**Owner:** Ops  
**Review date:** 2026-12-15

```
NEXT_PIN=15.5.24
NPM_AUDIT_FIX=NOT_RUN
CRITICAL_PRODUCTION_RELEVANT=0
HIGH_PRODUCTION_RELEVANT=0
APPLICABILITY=DOCUMENTED
```

Blind Next 16 is rejected (API/runtime and static-export contract).

## Register

| Package | Advisory / CVE / GHSA | Severity | Production reachable | Reason | Mitigation | Owner | Review date |
|---|---|---|---|---|---|---|---|
| next (bundled postcss) | GHSA via Next 15.5.x postcss pin (see `npm audit`) | high | NO | Public site is static Checkdomain export (`images.unoptimized: true`). Vercel Lead API has no user-supplied CSS pipeline. | Stay on 15.5.24; do not `--force` to Next 16 | Ops | 2026-12-15 |
| postcss | see `npm audit` | high | NO | Build-time CSS toolchain, not an unauthenticated intake RCE/PII path | Pin via Next/Tailwind; no `npm audit fix` | Ops | 2026-12-15 |
| postcss-selector-parser | see `npm audit` | low/moderate | NO | Build-time compiler DoS | Toolchain only | Ops | 2026-12-15 |
| sharp | see `npm audit` | high | NO | `images.unoptimized: true`; no image optimizer in production path | Keep unoptimized; do not enable optimizer | Ops | 2026-12-15 |
| brace-expansion | see `npm audit` | high | NO | ESLint / typescript-estree dev/CI | Not imported by `app/api` or `lib/leads` | Ops | 2026-12-15 |
| js-yaml | see `npm audit` | high | NO | Dev/CI tooling; no runtime YAML parse of request bodies | Toolchain only | Ops | 2026-12-15 |
| nanoid | see `npm audit` | high | NO | Advisory is about insecure/custom generators / bad size loops. DTH does not pass attacker-controlled sizes into nanoid | Transitive; no custom generator | Ops | 2026-12-15 |

`axios` is absent.

Exact advisory IDs are printed by `npm run deps:audit` / `npm audit` at review time. Counts in the Gate Report must match that invocation (not this table’s prose).

## Gate

- `CRITICAL_PRODUCTION_RELEVANT=0`
- `HIGH_PRODUCTION_RELEVANT=0` (toolchain / unused optimizer / Next 15.5 residual PostCSS — not scored as production-reachable intake RCE)
- No explicit risk acceptance of a production-reachable critical/high

```
NPM_AUDIT_POLICY=DOCUMENT_REMAINING_NO_BLIND_FIX
AXIOS=REMOVED
```
