# npm audit — dependency risk register

**Date:** 2026-09-15  
**Command:** `npm audit --json` after Next **15.5.24** (no Next 16).  
**Policy:** allowlist of assessed High/Critical GHSA IDs. Unknown new Critical or High → CI FAIL. `npm audit fix` / `--force` were **not** run.  
**Owner:** Ops  
**Review / expiry:** 2026-12-15  

```
NEXT_PIN=15.5.24
NPM_AUDIT_FIX=NOT_RUN
NPM_CRITICAL=0
NPM_HIGH=5
NPM_ADVISORY_REGISTER=PASS
NPM_UNKNOWN_HIGH_CRITICAL_CI_GATE=PASS
APPLICABILITY=DOCUMENTED
```

Package-level High count from `npm audit` metadata on this date: **5** (`brace-expansion`, `js-yaml`, `nanoid`, `postcss`, `sharp`). Moderate: `next` (via postcss). Low: `postcss-selector-parser`. Critical: **0**.

Blind Next 16 is rejected (API/runtime and static-export contract).

## Allowlisted High / Critical IDs

Machine file: `docs/audit/NPM_ADVISORY_ALLOWLIST.json`.

| Package | Advisory | CVE | Severity | URL | Production reachable | Reason | Owner | Expires |
|---|---|---|---|---|---|---|---|---|
| brace-expansion | GHSA-3jxr-9vmj-r5cp | | high | https://github.com/advisories/GHSA-3jxr-9vmj-r5cp | NO | ESLint / typescript-estree toolchain | Ops | 2026-12-15 |
| brace-expansion | GHSA-mh99-v99m-4gvg | | high | https://github.com/advisories/GHSA-mh99-v99m-4gvg | NO | Dev/CI toolchain | Ops | 2026-12-15 |
| brace-expansion | GHSA-rgw5-rvv9-x895 | CVE-2026-14257 | high | https://github.com/advisories/GHSA-rgw5-rvv9-x895 | NO | Dev/CI toolchain | Ops | 2026-12-15 |
| js-yaml | GHSA-52cp-r559-cp3m | | high | https://github.com/advisories/GHSA-52cp-r559-cp3m | NO | No request-body YAML parse | Ops | 2026-12-15 |
| js-yaml | GHSA-5p4m-2wfm-xmqj | CVE-2026-59870 | high | https://github.com/advisories/GHSA-5p4m-2wfm-xmqj | NO | Dev/CI toolchain | Ops | 2026-12-15 |
| js-yaml | GHSA-2883-xcg3-v3hh | | high | https://github.com/advisories/GHSA-2883-xcg3-v3hh | NO | Dev/CI toolchain | Ops | 2026-12-15 |
| nanoid | GHSA-28wg-ghj8-5hjv | | high | https://github.com/advisories/GHSA-28wg-ghj8-5hjv | NO | No attacker-controlled nanoid size | Ops | 2026-12-15 |
| nanoid | GHSA-2v37-7h3g-55p8 | | high | https://github.com/advisories/GHSA-2v37-7h3g-55p8 | NO | No custom generator | Ops | 2026-12-15 |
| nanoid | GHSA-xwg4-73v4-xw9w | | high | https://github.com/advisories/GHSA-xwg4-73v4-xw9w | NO | Transitive | Ops | 2026-12-15 |
| postcss | GHSA-6g55-p6wh-862q | | high | https://github.com/advisories/GHSA-6g55-p6wh-862q | NO | Build-time CSS; static export | Ops | 2026-12-15 |
| postcss | GHSA-r28c-9q8g-f849 | | high | https://github.com/advisories/GHSA-r28c-9q8g-f849 | NO | Build-time source maps | Ops | 2026-12-15 |
| sharp | GHSA-f88m-g3jw-g9cj | CVE-2026-33327 | high | https://github.com/advisories/GHSA-f88m-g3jw-g9cj | NO | `images.unoptimized: true` | Ops | 2026-12-15 |
| sharp | GHSA-rgj7-g3m4-5g8c | | high | https://github.com/advisories/GHSA-rgj7-g3m4-5g8c | NO | `images.unoptimized: true` | Ops | 2026-12-15 |

Documented non-gating advisories (not High/Critical unknown): GHSA-f886-m6hf-6m8v, GHSA-jxxr-4gwj-5jf2 (brace-expansion moderate); GHSA-h67p-54hq-rp68 (js-yaml moderate); GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp (postcss moderate); GHSA-w9m9-85wc-3x92 (postcss-selector-parser low). `next` is moderate via postcss.

`axios` is absent.

## Gate

- Unknown new Critical → CI FAIL
- Unknown new High → CI FAIL
- Expired allowlist row → CI FAIL
- No `npm audit fix`
- No Next 16

```
NPM_AUDIT_POLICY=ALLOWLIST_UNKNOWN_HIGH_CRITICAL_FAIL
AXIOS=REMOVED
```
