# A8 Offer Owner Decision Pack

| Decision | Evidence now | E2 default | BLOCKS_E2 | BLOCKS_STAGING | BLOCKS_PRODUCTION |
|---|---|---|---|---|---|
| Offer selection | Rank-1 test policy only | TEST_AUTO_SELECT_RANK_1 | NO | YES | YES |
| Top-N options | maxOptions=1 | 1 | NO | YES | YES |
| Approval | Synthetic auto vs required path | AUTO_APPROVE_SYNTHETIC | NO | YES | YES |
| Validity | 10 min test | synthetic | NO | YES | YES |
| Follow-up | 1 × 50ms | synthetic | NO | YES | YES |
| Net/gross presentation | Copied from A7 | label only | NO | YES | YES |
| Savings unknown | OMIT | OMIT | NO | YES | YES |
| Negative savings | Honest additional cost | HONEST | NO | YES | YES |
| PDF | Not implemented | HTML/text | NO | TBD | TBD |
| Legal copy | Synthetic non-binding | TEST wording | NO | YES | YES |
| Acceptance legal effect | Digital event ≠ QES | offer-page | NO | YES | YES |
| Retention | Unresolved | n/a | NO | YES | YES |

Flags remain true: `OWNER_OFFER_SELECTION_POLICY_REQUIRED`, `OWNER_OFFER_APPROVAL_POLICY_REQUIRED`, `OWNER_OFFER_FOLLOWUP_POLICY_REQUIRED`, `OWNER_OFFER_LEGAL_TEXT_REQUIRED`, `OFFER_RETENTION_POLICY_REQUIRED`.

A6 document OWNER_* and A7 live-tariff/ranking/VAT/import/commission OWNER_* stay open.
