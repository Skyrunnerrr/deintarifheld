# P4-H0b2a — Development Clerk JWKS integration

Status: implementation tranche (live session-token evidence deferred to P4-H0b2b).

## Owner decisions

- `EXPECTED_AUDIENCE` = `urn:deintarifheld:ops-api` (Clerk custom session-token claim)
- `AUTHORIZED_PARTY_ALLOWLIST` (exact, no wildcards):
  - Development: `http://localhost:3100` (local CC; localhost required for WebAuthn)
  - Production target: `https://cc.deintarifheld.de`
- Remote JWKS: exact public Development Frontend API `/.well-known/jwks.json` only
- Cache TTL 300s; total timeout 5000ms; max 262144 bytes; max 10 keys
- No stale-after-TTL; unknown `kid` forces exactly one refresh; no retry loop; no redirects

## Runtime configuration (server-trusted only)

Inject exact values (never request-derived):

- `expectedIssuer` — Development Frontend API origin
- `jwksUrl` — `{frontendApiOrigin}/.well-known/jwks.json`
- `approvedFrontendApiOrigin` — same origin used for host checks

Use `createRemoteJwksAdapter` from `@deintarifheld/shared`. No Clerk SDK. No secret key.

## Explicitly out of scope

- Real user / invitation / OTP / passkey ceremony / real session token capture
- P4-H0b2b live token validation evidence (after H0b3)
- DNS / custom FAPI (`clerk.cc.deintarifheld.de` deferred)
- Database / migrations / Strong AuthZ / RLS
