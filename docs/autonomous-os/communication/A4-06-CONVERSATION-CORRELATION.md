# A4-06 Conversation Correlation

Opaque `conversation_ref` (6 hex chars, non-PII, non-sequential) is shown as `[DTH-XXXXXX]` in subject/body.

## Tiers

| Tier | Evidence | Auto observation |
|---|---|---|
| STRONG | exact conversation_ref | only with matching sender |
| SUPPORTING | expected sender, reply subject ref | not sufficient alone |
| WEAK | sender only, company name, fuzzy subject | HUMAN_REVIEW |

Wrong sender + strong token → `CORRELATION_REVIEW`. No automatic observation.

No strong match → `UNMATCHED`. Persist. Do not attach to nearest Case.

Ambiguous multi-match: not implemented as auto-attach. Expected AMBIGUOUS_INBOUND_AUTO_ATTACHMENTS=0.

Plus-addressing is not used. INBOUND_REPLY_ADDRESS=PROVIDER_CONFIGURATION_PENDING. E2 uses `.invalid`.
