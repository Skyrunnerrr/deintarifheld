# P4-H0b2b — Live Clerk session validation via remote JWKS

## Safe path

Browser-managed Clerk session (localhost CC)
→ `session.getToken()` transient in browser runtime
→ `POST /auth/validate-provider-session` with `Authorization: Bearer …`
→ server-trusted Development issuer / JWKS / audience / azp
→ H0b2a remote JWKS adapter + H0a `validateProviderToken`
→ empty person-mapping adapter
→ AuthN PASS + mapping deny (`DENIED_EXPECTED`)

## Nondisclosure

- No token rendering, copy, logging, disk, evidence, or chat
- Response contains only boolean/result fields and public policy hosts
- No raw claims dump

## Non-claims

- Not Strong AuthZ / RLS / persistent mapping
- Not operational API access
- Not H0b3d cleanup
