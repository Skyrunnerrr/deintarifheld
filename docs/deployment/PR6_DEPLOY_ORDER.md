# PR #6 deployment order (binding)

```
AUTO_PRODUCTION_DEPLOY_ON_MAIN=UNKNOWN
PR6_DEPLOYMENT_SAFE=NO
PRODUCTION_E2E_READY=NO
```

Merging this PR must **not** be treated as a production cutover.

Whether `main` auto-deploys Vercel production and/or Checkdomain is **UNKNOWN** from this repository alone. Therefore `PR6_DEPLOYMENT_SAFE=NO` until a human confirms the deploy pipeline and the order below has been executed.

## Required order

1. Apply and verify on the **real** Supabase project (additive only): `003_leads_rate_limits.sql`, `004_consume_rate_limit.sql`, `005_legal_hold_and_rate_limit_invoker.sql`.
2. Verify production env (values never printed): rate-limit salt, captcha secret, service role, `AUDIT_EMAIL_HASH_SALT`, mail still `internal_live` / `ALLOW_CUSTOMER_MAIL=NO`, no smoke bypass.
3. **Then** deploy the Production Lead API.
4. **Then** deploy Checkdomain static (only after API + migrations are live).
5. **Then** a separately authorized controlled E2E. This PR does not authorize it.

If auto-deploy on main cannot be proven off: do not merge as if production were safe. Keep `PR6_MERGE_READY=NO`.

Never fail-open rate limit in production. Never enable customer mail from this PR.
