# A4-03 Missing-Info Message Contract

## Policy

- Policy: `CommunicationPolicyV1` version 1
- Template: `B2B_MISSING_INFO_DE_V1` version 1
- Allowed purposes: `MISSING_INFORMATION_REQUEST`, `MISSING_INFORMATION_FOLLOWUP`
- Unknown purpose: BLOCK
- Recipient: server-resolved Case→Lead contact only
- Content: current qualification revision + OPEN requirement labels only
- Language: German B2B, no internal codes / UUIDs / policy versions

## Grouping

One intent per Case + qualification revision + requirement fingerprint + purpose + follow-up generation.

Idempotency key:

`missing-info/{caseId}/{revision}/{fingerprint}/{purpose}/{generation}`

## Eligibility

Automatic send only if purpose allowlisted, outcome still MISSING_INFORMATION, requirements still OPEN, recipient current, no suppression, no kill/takeover, intent still sendable.
