# A8-02 Offer readiness policy

Offerable only when A7 evaluation exists, `isTariffEvaluationCurrent`, readiness `READY_FOR_OFFER`, ≥1 ELIGIBLE ranked result, no pricing-critical conflict, TEST_FIXTURE source, E2 policy `allowLiveCustomerDelivery=false`.

`OfferPolicyV1` test defaults: auto-select rank 1, maxOptions=1, synthetic auto-approve unless `requireApproval`, validity 10 minutes (overridable). Owner selection/approval/follow-up remain unresolved.
