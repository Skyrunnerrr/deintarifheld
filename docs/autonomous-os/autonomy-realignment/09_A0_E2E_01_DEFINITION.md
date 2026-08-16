# DTH-AUTONOMY-E2E-01 Definition

## Goal

Synthetic business customer completes, **without human domain clicks**:

```text
Public B2B form
→ lead persisted
→ durable event / source outbox
→ case created
→ qualification job runs
→ missing consumption detected
→ customer question intent
→ mail via safe test/staging adapter
→ synthetic customer reply
→ reply correlated to case
→ data updated
→ qualification re-run → QUALIFIED
→ appointment options
→ synthetic booking
→ case reaches OFFER_INPUT_READY
```

## Non-goals for E2E-01

Documents, tariff math, offer PDF, switching, content, acquisition, production autonomy unlock.

## Dependencies

A1, A2, A3, A4, A5 + for staging: M11F–P/O as mapped.

## Proof

E2 local executable with DENY_ALL/safe adapters first; then staging with isolated project. No production mutation.
