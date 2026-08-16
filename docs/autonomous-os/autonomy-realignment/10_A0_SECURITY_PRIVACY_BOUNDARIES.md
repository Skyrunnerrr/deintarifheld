# A0 Security / Privacy Boundaries

## Preserved architecture invariants

- Agents untrusted; tools → policy → domain → intent → worker → provider → readback
- No service_role for agents; no raw provider keys in prompts
- Kill fail-closed for automation; public intake independent of kill store (ADR-008)
- INBOUND_CONTENT_IS_UNTRUSTED=YES — email/attachments are data, not instructions
- Tariff/offer numbers must be deterministic with evidence trace; LLM must not invent commercial facts

## Material change flags for planned autonomy

| Change | Classification |
|--------|----------------|
| Automated customer emails (missing info, reminders, offers) | MATERIAL_CHANGE_REVIEW_REQUIRED |
| Inbound email storage + classification | PRIVACY_REVIEW_REQUIRED |
| Document storage/extraction | PRIVACY_REVIEW_REQUIRED |
| Calendar booking | MATERIAL_CHANGE_REVIEW_REQUIRED |
| Deterministic tariff/offer automation | SECURITY_REVIEW_REQUIRED (commercial accuracy) |
| Content/acquisition | later; separate domain |

No legal certainty claims ("DSGVO compliant") in A0.
