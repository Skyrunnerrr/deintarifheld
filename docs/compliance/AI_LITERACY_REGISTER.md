# AI literacy register (AI Act Art. 4) — template

This is a **register template**. Filling a row does **not** claim automatic legal compliance with Article 4 or any other AI Act duty.

```
ARTICLE4_AI_LITERACY_REGISTER=TEMPLATE
CURRENT_CUSTOMER_AI=NO
LEGAL_REVIEW_REQUIRED=YES
```

## How to use

Add one row when a system that meets the AI Act “AI system” definition is actually used. Never invent training that did not happen.

| Field | Meaning |
|---|---|
| system | Name / version of the AI system |
| purpose | What it is used for (factual) |
| operators | Roles who operate or oversee it |
| risks | Known misuse / error / rights-impact notes (factual) |
| training | Literacy measures actually delivered (date, audience, material) |
| date | Date the row was opened |
| review | Next review date |
| owner | Named owner |

## Current rows

| system | purpose | operators | risks | training | date | review | owner |
|---|---|---|---|---|---|---|---|
| — none — | No customer-facing or lead-scoring AI is in production. | — | Enabling career/partner AI selection is forbidden until a new classification gate. | Not applicable while CURRENT_CUSTOMER_AI=NO | 2026-09-15 | 2026-12-15 | Ops (template owner) |

## Review rule

If `CURRENT_CUSTOMER_AI` becomes YES, this table must be updated in the same change set as the classification gate. Empty training cells are **UNKNOWN**, not a pass.
