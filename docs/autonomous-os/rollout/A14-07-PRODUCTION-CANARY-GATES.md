# A14-07 Production Canary Gates

Not started. Requires staging E2E + Owner approval.

## Philosophy

Smallest blast radius. Autonomy levels L0→L5; **no jump to L5**.

## Eligible first domains (recommended, not approved)

- A3 qualification (internal)
- A11 observe/control
- A4 draft-only / internal mail test
- Read-only provider checks

## High-risk deferred

- A8 live customer offers
- A9 real supplier switch
- A13 paid spend
- A12 live social publish
- A7 live tariffs feeding A8

## Required before PRODUCTION_CANARY_GO

STAGING_E2E · PROVIDER_READBACK · FAILURE_RECOVERY · KILL · TAKEOVER · AUDIT · MONITORING · CANARY_SCOPE_DEFINED · CANARY_ABORT_CRITERIA_DEFINED · OWNER_APPROVAL

## Abort examples

Duplicate external effect · wrong recipient/customer/tariff/account · AuthZ bypass · unexpected spend · privacy leak · unreconciled unknown beyond threshold
