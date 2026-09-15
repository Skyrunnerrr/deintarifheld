# EU AI Act guardrails — DeinTarifheld

Technical classification of **current** behaviour. This file does **not** constitute legal advice or an AI Act conformity assessment.

```
CUSTOMER_FACING_AI=NO
INTERNAL_AI_USE=YES
CURRENT_CUSTOMER_AI=NO
CURRENT_AI_LEAD_SCORING=NO
CURRENT_AUTOMATED_LEGAL_DECISIONS=NO
CAREER_AI_SELECTION_ALLOWED=NO
ARTICLE50_FUTURE_AI_GATE=PASS
LEGAL_REVIEW_REQUIRED=YES
```

`INTERNAL_AI_USE=YES` records professional development / audit / automation use (Cursor Cloud Agent). It is **not** customer-facing AI.

## Customer-facing (evidence)

- Public forms collect structured fields and send them to `/api/leads/` or `/api/careers/`.
- Server validation is deterministic (schema, honeypot, timing, captcha, rate limit).
- No model is invoked to analyse, filter, rank, score, accept, or reject leads or career/partner requests.
- No customer-facing chatbot, recommender, or automated legal/eligibility decision exists on the site.
- Therefore the site must **not** show fake “AI disclosure” copy. Article 50 transparency is a **future** gate, not a current UI claim.

`ARTICLE50_FUTURE_AI_GATE=PASS` means the future-gate stop-line is documented and no customer-facing AI is enabled. It is not an Article 50 conformity certificate.

## Internal professional use (factual)

See `docs/compliance/AI_LITERACY_REGISTER.md`.

| Field | Value |
|---|---|
| system | Cursor Cloud Agent (this repository’s professional setup) |
| version | UNKNOWN (product version not pinned in-repo) |
| purpose | Code change, test, and documentation work on this repository |
| operator | Repository owner / agent operator recorded in the literacy register |
| risks | Incorrect code or docs if accepted without human review |
| human control | Human review of PR #6 required; no autonomous production deploy from this file |
| literacy | TRAINING=UNKNOWN |

Do **not** record “none” for internal AI while this professional agent setup is used.

## Career / partner path (binding)

`CAREER_AI_SELECTION_ALLOWED=NO`

The career/partner path must **not**:

- AI-analyse applications
- AI-filter or rank candidates
- AI-score motivation or “fit”
- AI-accept or AI-reject
- affect access to self-employment via an automated AI system

without a **new** AI Act classification gate (risk class, provider/deployer role, documentation, human oversight) signed off outside this file.

Deterministic validation (required fields, honeypot, captcha) is not AI selection.

## Future customer AI (Article 50)

Any future **direct customer AI communication** (chat, generated advice, automated explanations that appear to be AI) requires an Article 50 transparency gate **before** release:

- LEGAL_REVIEW_REQUIRED=YES
- No production enablement from this repository alone
- No silent model swap behind the current forms

## GDPR / AI automation boundary

No **solely automated decision with legal or similarly significant effect** may be enabled without a separate Legal/DSGVO gate.

Examples that must **not** be autonomously enabled:

- contract reject
- person exclude / denylist by algorithm
- career/partner reject
- other legally significant access decisions

Internal categorise / task / reminder / prioritise helpers may be assessed **separately later**. They are not enabled here and are not pre-approved.

## Owner

Ops + Legal review. This document records a **technical** stop-line, not compliance certification.
