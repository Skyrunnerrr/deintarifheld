# A9 Switching Owner Decision Pack

| Decision | Evidence now | E2 default | BLOCKS_E2 | BLOCKS_STAGING | BLOCKS_PRODUCTION |
|---|---|---|---|---|---|
| Live switch provider | None in repo | TEST_SWITCH_V1 | NO | YES | YES |
| Switch types | SUPPLIER_CHANGE only | SUPPLIER_CHANGE | NO | YES | YES |
| Submission approval | Test auto vs required | AUTO_APPROVE_SYNTHETIC | NO | YES | YES |
| Required fields | Provider-declared | MaLo + identity + tariff | NO | YES | YES |
| Multi-supply | Preserve scope | PRESERVE_SCOPE | NO | YES | YES |
| Termination | Not generated | PROVIDER_HANDLES | NO | YES | YES |
| Start date | Not invented | Provider confirmed | NO | YES | YES |
| Bank/SEPA | Not in payload | omitted | NO | TBD | YES |
| Retention | Unresolved | n/a | NO | YES | YES |

Flags remain true: `OWNER_LIVE_SWITCH_PROVIDER_REQUIRED`, `OWNER_SWITCH_SUBMISSION_POLICY_REQUIRED`, `OWNER_MULTI_SUPPLY_SWITCH_POLICY_REQUIRED`, `SWITCH_RETENTION_POLICY_REQUIRED`, `OWNER_PAYMENT_DATA_HANDLING_REVIEW_REQUIRED`.
