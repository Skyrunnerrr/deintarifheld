# npm audit — Phase 2 P0 applicability

**Date:** 2026-09-15  
**Command:** `npm audit` after Next 15.5.24 + axios removal  
**Policy:** report only. `npm audit fix` / `npm audit fix --force` were **not** run.

## Counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 5 |
| Moderate | 1 |
| Low | 1 |

`axios` is gone (F-21 / F-25). Next.js is pinned to **15.5.24** (August 2026 security release: GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4).

## Remaining advisories

| Package | Severity | Where | Applicability to DTH production |
|---|---|---|---|
| `next` via bundled `postcss` | High | `node_modules/next` | **Partial.** Next 15.5.24 still depends on an older PostCSS. Public site is static Checkdomain export (`images.unoptimized: true`). Vercel API has no user-supplied CSS pipeline. Forced fix wants Next 16 (out of scope). |
| `postcss` | High | Next + Tailwind build | **Build-time.** CSS stringify / source map reads are not an unauthenticated Lead-API RCE/PII path. |
| `postcss-selector-parser` | Low/Moderate | Tailwind toolchain | **Build-time DoS** of the local/CI compiler, not the production intake API. |
| `sharp` | High | Next optional image optimizer | **Reduced.** Repo sets `images.unoptimized: true`. No middleware. Static export for Checkdomain. Residual if someone later enables optimization. |
| `brace-expansion` | High | ESLint / typescript-estree | **Dev/CI only.** Not imported by `app/api` or `lib/leads`. |
| `js-yaml` | High | Tooling | **Dev/CI only.** No runtime YAML parse of request bodies. |
| `nanoid` | High | Transitive | **Low.** Advisories are about custom/non-secure generators looping on bad size. We do not pass attacker-controlled sizes into nanoid. |

## Gate decision

- Critical: none remaining after the targeted Next patch.
- High leftovers are toolchain / unused image optimizer / PostCSS in Next 15.5.x.
- Blind `npm audit fix --force` would jump to Next 16 and is rejected.

```
NPM_AUDIT=0_CRITICAL_5_HIGH_1_MODERATE_1_LOW
NPM_AUDIT_FIX=NOT_RUN
NEXT_PIN=15.5.24
AXIOS=REMOVED
APPLICABILITY=NO_UNAUTHENTICATED_LEAD_API_RCE_DEMONSTRATED
```
