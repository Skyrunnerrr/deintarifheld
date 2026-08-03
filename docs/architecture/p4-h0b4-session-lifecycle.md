# P4-H0b4 — Session lifecycle controls

## Policy (Owner)

- Inactivity: 30 minutes (Clerk Development + local evaluator)
- Absolute maximum: 12 hours (Clerk Development + local evaluator)
- Max active sessions: 1
- Concurrent conflict: `REVOKE_OLD_ALLOW_NEW`
- Multi-session handling (Clerk multi-account-in-browser): OFF

## Enforcement split

| Control | Provider-native | DTH local |
|---|---|---|
| 30m inactivity | Sessions page | `evaluateSessionPolicy` / provider registry |
| 12h absolute max | Sessions page | same |
| Max 1 + revoke-old | not a Clerk Dashboard setting | `applyProviderSessionLifecycle` |
| Manual revoke / disable | Dashboard | local rejection after provider action |

## Safe path

Reuse H0b2b: browser `getToken()` → `POST /auth/validate-provider-session` → redacted result only.
No token disclosure. No person mapping. No operational access.
