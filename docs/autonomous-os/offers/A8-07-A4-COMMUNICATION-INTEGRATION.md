# A8-07 A4 communication integration

New purposes: `OFFER_DELIVERY`, `OFFER_FOLLOWUP`, `OFFER_ACCEPTANCE_CONFIRMATION`. `isOfferMessagePurpose` skips missing-info pre-send shape (otherwise QUALIFIED cases fail with NOW_QUALIFIED). Offer-specific `assertOfferIntentSendable`. SENT logged only after A4 `PROVIDER_ACCEPTED`. OUTCOME_UNKNOWN does not mark offer SENT. No direct Resend. Kill: INTERNAL_MAIL for send + AUTOMATION_ENGINE for prepare.
