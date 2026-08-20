# A13-02 Repository Audit

| Area | Finding |
|------|---------|
| Existing acquisition engine | None prior to A13 |
| Live ads SDK | None |
| Analytics/fingerprinting | Not introduced |
| Public B2B intake | Reused `acceptBusinessLeadAtomic` |
| Lead source fields | Extended via `lead_attributions` only |
| Provider | Synthetic test adapter only |

Reused: A2 intake, A7 micro-EUR, A11 commands/capabilities, A12 claim/content binding, A9 wipe hook.
Deferred: live provider, OAuth, billing custody, consent cookies.
