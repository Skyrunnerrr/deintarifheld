# EU AI Act guardrails — DeinTarifheld

Technical classification of **current** production behaviour. This file does **not** constitute legal advice or an AI Act conformity assessment.

```
CURRENT_CUSTOMER_AI=NO
CURRENT_AI_LEAD_SCORING=NO
CURRENT_AUTOMATED_LEGAL_DECISIONS=NO
CAREER_AI_SELECTION_ALLOWED=NO
ARTICLE50_FUTURE_AI_GATE=DOCUMENTED
LEGAL_REVIEW_REQUIRED=YES
```

## Current state (evidence)

- Public forms collect structured fields and send them to `/api/leads/` or `/api/careers/`.
- Server validation is deterministic (schema, honeypot, timing, captcha, rate limit).
- No model is invoked to analyse, filter, rank, score, accept, or reject leads or career/partner requests.
- No customer-facing chatbot, recommender, or automated legal/eligibility decision exists on the site.
- Therefore the site must **not** show fake “AI disclosure” copy. Article 50 transparency is a **future** gate, not a current UI claim.

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
