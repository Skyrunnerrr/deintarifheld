# A13-00 Executive Summary

DTH-A13 Acquisition Autopilot closes the governed growth loop in E2 local synthetic mode:

A12 published content → A13 campaign → opaque `acq_ref` → public B2B intake (`acceptBusinessLeadAtomic`) → soft attribution → A2 Case path → metrics.

Plus a separate synthetic paid path with durable create/activate intents and `DeterministicTestAcquisitionProvider` (no network, no live spend).

## Result

`A13_RESULT=CLOSED_E2_LOCAL_ACQUISITION_PROVIDERS_STAGING_PENDING`

## Hard guarantees (E2)

- `LIVE_AD_SPEND_EUR=0`
- `LIVE_AD_PROVIDER_CALLS=0`
- `VALID_LEADS_LOST_DUE_TO_ATTRIBUTION_FAILURE=0`
- `ACQUISITION_DIRECT_CASE_CREATIONS=0`
- Kill maps to `AUTOMATION_ENGINE` (no 9th KillDomain)
- Attribution soft-fails; forged refs never credit
- CPL/ROAS never fabricated without exact spend+revenue

## Not proven

Live ad provider, live spend, production attribution/consent policy, staging autonomy.
