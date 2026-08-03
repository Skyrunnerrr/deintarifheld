# P4-H0a — Local Production-Identity Contract and Token-Validation Foundation

TRANCHE=P4-H0A  
CLASSIFICATION=LOCAL_IMPLEMENTATION_WITH_SYNTHETIC_PROVIDER_EVIDENCE_ONLY  
P4_H0B_AUTHORIZED=NO  

## Purpose

Local, fail-closed identity foundation that can later attach to Clerk (P4-H0b) without changing the DTH person model.

## Frozen origins / RP ID

- PRODUCTION_CC_ORIGIN=`https://cc.deintarifheld.de`
- PRODUCTION_AUTH_UI_ORIGIN=`https://cc.deintarifheld.de`
- PASSKEY_RP_ID=`cc.deintarifheld.de`
- AUTH_UI_AND_CC_SAME_ORIGIN=YES

## Delivered

- Clerk-shaped JWT validation (RS256) via Node `crypto` only — no new packages
- Static in-memory JWKS adapter (no remote fetch)
- External subject → DTH person mapping **interface** + in-memory adapter
- Session policy: 30 minutes inactivity / 12 hours max / max 1 active session
- Passkey policy **contract** (not live Clerk enforcement)
- Conversion to existing P3-F1 `PERSON_PRINCIPAL`

## Explicit non-claims

- PRODUCTION_IDP_READY=NO
- PASSKEY_POLICY_LIVE_VALIDATED=NO
- CLERK_PASSKEY_ENFORCEMENT_PROVEN=NO
- STRONG_AUTHZ_COMPLETE=NO
- PRODUCTION_RLS_READY=NO
- PERSISTENT_PERSON_MAPPING=NO
- CLERK_TENANT_CREATED=NO
- PRODUCTION_AUDIENCE_VALUE_DEFINED=YES (`EXPECTED_AUDIENCE=urn:deintarifheld:ops-api` via P4-H0b2a)
- Remote Development JWKS adapter: see `p4-h0b2a-development-jwks.md` (live session-token evidence deferred to H0b2b)

## AuthZ ownership

Clerk is identity only. DTH AuthZ SoT remains person-role assignments and capability policy (P4-H1).

## Split

- **P4-H0a** — this local foundation (authorized)
- **P4-H0b** — Clerk development-instance / live validation (not authorized)

## Packages

- `packages/shared/src/identity/**`
- `packages/ops-api/src/auth/provider-token-auth.js`
- `packages/cc/src/auth/contracts.js` (typed status only)
