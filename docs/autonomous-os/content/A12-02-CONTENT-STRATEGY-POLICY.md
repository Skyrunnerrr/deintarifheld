# A12-02 Content Strategy Policy

`ContentStrategyPolicyV1` is the E2 synthetic policy only.

- Environment: `E2_LOCAL_SYNTHETIC`
- Channels: `SYNTHETIC_LINKEDIN`, `SYNTHETIC_BLOG`
- Purposes: EDUCATION, PROBLEM_AWARENESS, ENERGY_COST_GUIDANCE, PROCESS_EXPLANATION, TRUST, PRODUCT_EXPLANATION, FAQ
- Audiences: SME_OWNER, OPERATIONS_MANAGER, MULTI_SITE_BUSINESS, ENERGY_COST_RESPONSIBLE
- `liveChannelsAllowed=false`
- `autoPublish=false`
- `aiIsCandidateOnly=true`
- Synthetic tariff-as-live forbidden; fake testimonials forbidden

`OWNER_CONTENT_STRATEGY_POLICY_REQUIRED=YES`. Merge rejects `liveChannelsAllowed=true` and `autoPublish=true`.
