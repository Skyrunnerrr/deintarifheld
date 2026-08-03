# P4-H0b3b — Passkey before local CC entry

## Enforcement

- Method: `EXPLICIT_PASSKEY_VERIFICATION_BEFORE_LOCAL_CC_ENTRY`
- Level: `LOCAL_CC_ENTRY_GATE_ONLY`
- Strong backend AuthZ: **no**
- Person mapping: **no**
- Operational API / writes after passkey: **still denied**

## Mechanism (evidence-supported)

1. Local CC serves `/auth/*` gate pages (loopback only).
2. Browser loads Clerk JS from the Development FAPI CDN path (no npm dependency).
3. Owner enrolls exactly one passkey via `user.createPasskey()`.
4. Owner signs in via passkey (`authenticateWithPasskey`).
5. Owner completes `session.verifyWithPasskey()` before local shell.
6. Only a non-operational local shell is shown.
7. Session JWT is never displayed, copied, logged, or written to disk by this flow.

## Routes

| Route | Purpose |
|---|---|
| `/auth` | Hub |
| `/auth/enroll` | Passkey enrollment |
| `/auth/signin` | Passkey sign-in |
| `/auth/entry` | Post-verification non-operational shell |
| `/inbox` (gate on) | Protected — gate page, not operational CC |

## Local origin (WebAuthn)

- Development CC origin: `http://localhost:3100` (not `127.0.0.1` — invalid WebAuthn RP ID)
- Development azp: `http://localhost:3100`
- Production azp / RP target unchanged: `https://cc.deintarifheld.de` / `cc.deintarifheld.de`
- Local enrollment does not pass a custom `rpId`; Clerk uses the browser hostname

## Runtime env (values never in evidence/chat)

- `DTH_CC_LOCAL_UI_ENABLED=true`
- `DTH_CC_PASSKEY_GATE_ENABLED=true`
- `DTH_CLERK_PUBLISHABLE_KEY=` (publishable only; secret key forbidden)
- `DTH_CLERK_FAPI_URL=https://sterling-husky-22.clerk.accounts.dev`

## Explicit non-claims

- Not H0b2b live JWKS token validation
- Not Strong AuthZ (H1)
- Not persistent mapping (H0b-MAP)
- Not production / staging / DNS
