# A14 Reuse Register

Global register of approved upstream references and DTH reuse decisions. Update at each security gate; avoid duplicate research.

| AREA | REQUIREMENT | PREFERRED_SOURCE | SOURCE_TYPE | VERSION/COMMIT | LICENSE | STATUS | INTEGRATION_LOCATION | SECURITY_NOTES | LAST_REVIEWED |
|------|-------------|------------------|-------------|----------------|---------|--------|----------------------|----------------|---------------|
| Auth credentials | Operator login/MFA | Supabase Auth | OFFICIAL_VENDOR | dashboard + `@supabase/supabase-js@^2.111.0` | Apache-2.0 | APPROVED_REUSE | M11N `hosted-session.js` | TOTP/AAL2; no DTH credential storage | 2026-08-25 |
| Session transport | HttpOnly server cookies | `@supabase/ssr` | OFFICIAL_VENDOR | latest stable | Apache-2.0 | REVIEW_REQUIRED | Future CC Next host | ADAPT when wiring; M11N verify remains authority | 2026-08-25 |
| Postgres RLS | Operator/worker/intake isolation | PostgreSQL RLS | OFFICIAL_VENDOR | PG15+ | PostgreSQL | INTEGRATED | M11L/M migrations | Native; no custom policy engine | 2026-08-25 |
| DB roles/grants | Least privilege LOGIN roles | PostgreSQL roles | OFFICIAL_VENDOR | PG15+ | PostgreSQL | INTEGRATED | M11F/M11G | `dth_ops_api`, `dth_worker`, `dth_public_intake` | 2026-08-25 |
| Migrations | Schema apply | Supabase CLI | OFFICIAL_VENDOR | repo CLI pin | Apache-2.0 | APPROVED_REFERENCE | `supabase/migrations/` | Staging-only for M11P prep | 2026-08-25 |
| Test runner | Deterministic security tests | Node.js `node:test` | OFFICIAL_RUNTIME | Node 20+ | MIT | INTEGRATED | `packages/db/tests`, `ops-api` | No extra test framework | 2026-08-25 |
| Kill/control | Durable control plane | DTH `security.control_state` | CUSTOM_DTH | M11O E2 | — | INTEGRATED | `packages/db/src/workflow/control.js` | Reuse; do not rebuild | 2026-08-25 |
| Operator AuthZ | Capability model | DTH M11I/J | CUSTOM_DTH | M11I/J E2 | — | INTEGRATED | `packages/db`, `ops-api` | Server canonical | 2026-08-25 |
| DB context | Transaction-local GUC | DTH M11K + Postgres `set_config` | CUSTOM_DTH + OFFICIAL | M11K E2 | — | INTEGRATED | `packages/db` | Forgery risk OPEN — later gate | 2026-08-25 |
| Next.js auth starter | Full app template | supabase-community starters | OFFICIAL_EXAMPLE | various | MIT | REJECTED | — | Would replace DTH app | 2026-08-25 |
| Random auth snippets | Session handling | blogs/gists | UNTRUSTED | — | — | REJECTED | — | Source quality hierarchy rule | 2026-08-25 |
| E2E staging proof | M11P harness | DTH test profile + Supabase staging | CUSTOM_DTH + OFFICIAL | TBD M11P | — | REVIEW_REQUIRED | `test:dth:m11p` (planned) | E4 only; no prod | 2026-08-25 |
| GitHub Actions | CI security scans | `github/codeql-action` | OFFICIAL_VENDOR | pin in repo | MIT | APPROVED_REFERENCE | `.github/` if extended | Minimal permissions | 2026-08-25 |

## Review policy

1. Official vendor > official examples > standards > maintained OSS.
2. Never replace DTH domain security with generic templates.
3. Record rejections to prevent re-research.
4. Re-review when upgrading major Supabase/Next versions.
