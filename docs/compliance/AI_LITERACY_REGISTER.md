# AI literacy register (AI Act Art. 4)

Filling a row does **not** claim automatic legal compliance with Article 4 or any other AI Act duty.

```
ARTICLE4_AI_LITERACY_REGISTER=PARTIAL
CUSTOMER_FACING_AI=NO
INTERNAL_AI_USE=YES
TRAINING=UNKNOWN
LEGAL_REVIEW_REQUIRED=YES
```

`PARTIAL` because real internal use is recorded and `TRAINING` is honestly `UNKNOWN` (no evidenced literacy measure).

## How to use

Add one row when a system that meets the AI Act “AI system” definition is actually used. Never invent training that did not happen. Empty training cells are **UNKNOWN**, not a pass.

| Field | Meaning |
|---|---|
| system | Name / version of the AI system |
| purpose | What it is used for (factual) |
| operators | Roles who operate or oversee it |
| risks | Known misuse / error / rights-impact notes (factual) |
| human_control | How a human can stop or reject output |
| training | Literacy measures actually delivered (date, audience, material) or UNKNOWN |
| date | Date the row was opened |
| review | Next review date |
| owner | Named owner |

## Current rows

| class | system | purpose | operators | risks | human_control | training | date | review | owner |
|---|---|---|---|---|---|---|---|---|---|
| CUSTOMER_FACING_AI | — none — | No customer-facing or lead-scoring AI is in production. | — | Enabling career/partner AI selection is forbidden until a new classification gate. | N/A | UNKNOWN (not applicable while CUSTOMER_FACING_AI=NO) | 2026-09-15 | 2026-12-15 | Ops |
| INTERNAL_AI_USE | Cursor Cloud Agent (product version UNKNOWN) | Professional code, test, and documentation work on github.com/Skyrunnerrr/deintarifheld | Internal AI Operator / Human PR Reviewer | Incorrect or incomplete changes if merged without review; no production data writes from this agent | Human review of PR #6; no merge/E2E/production writes from the agent | UNKNOWN | 2026-09-15 | 2026-12-15 | Ops |

## Review rule

If `CUSTOMER_FACING_AI` becomes YES, this table must be updated in the same change set as the classification gate. `TRAINING=UNKNOWN` stays UNKNOWN until a real measure is evidenced.
