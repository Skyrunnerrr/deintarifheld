# A11-10 Reconciliation

| Key | Domain function |
|---|---|
| COMMUNICATION | applyProviderDeliveryEvent or refuse send on OUTCOME_UNKNOWN |
| APPOINTMENT | reconcileAppointment |
| OFFER_DELIVERY | reconcileOfferDelivery |
| SWITCH | reconcileSwitchAttempt |
| LIFECYCLE | applyLifecycleProviderEvent if event supplied, else RECONCILIATION_REQUIRED |

No generic Retry. Unknown outcome: EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT RESUBMIT BLINDLY.
