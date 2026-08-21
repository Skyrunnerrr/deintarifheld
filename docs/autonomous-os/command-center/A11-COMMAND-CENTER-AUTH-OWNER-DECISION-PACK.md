# A11 Command Center Auth Owner Decision Pack

## OD-A11-AUTH-PROVIDER

```text
STATUS=APPROVED
DECISION=SUPABASE_AUTH
```

Freeze (AuthN architecture only — not staging-proven):

- Scope: Command Center operators only
- Provisioning: invite-only; public signup disabled
- Primary: email/password
- MFA: TOTP required; minimum AAL2 for Command Center
- Social / magic-link / SMS MFA: DISABLED_V1
- Session transport: server-side cookie session + server verification
- Authentication authority: Supabase Auth
- Authorization authority: DTH server-side capability model (M11/A11)
- Client / JWT metadata role authority: NONE

## Still open

| ID | Status |
|----|--------|
| OD-A11-SESSION-POLICY | OPEN (lifetimes, inactivity, concurrency, step-up) |
| OD-A11-ROLE-POLICY | OPEN (capability freeze / M11J alignment) |
| OD-A11-DEPLOYMENT | OPEN (hosted CC runtime) |

## Explicit non-claims

```text
AUTH_PROVIDER_DECISION_READY=YES
AUTH_IMPLEMENTATION_READY=NO
MFA_READY=NO
STRONG_AUTHZ_READY=NO
STAGING_AUTH_READY=NO
PRODUCTION_AUTH_READY=NO
```

E2 `TEST_*` identities remain for local tests only.
