# Processor / transfer evidence tracker

Technical inventory only. **UNKNOWN stays UNKNOWN.** This file does not invent DPAs, SCCs, TIAs, or legal bases.

```
GDPR_PROCESSOR_EVIDENCE=PARTIAL
LEGAL_REVIEW_REQUIRED=YES
```

| Processor | DPA | Data categories (technical) | Purpose | Region | Third-country possible | SCC checked | TIA checked | Retention known |
|---|---|---|---|---|---|---|---|---|
| Checkdomain (public static host) | UNKNOWN | Published site HTML/assets; access logs (host-side, not inspected here) | Host public website | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Vercel (Lead API / inbox / cron) | UNKNOWN | Request metadata, lead/career JSON, admin session cookie, logs | Run intake API and ops inbox | UNKNOWN (platform regions) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Supabase (Postgres) | UNKNOWN | Lead/career rows, payloads, emails, audit events, hashed rate-limit buckets | Store intake + audit + rate limits | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN (app cutoffs exist; legal retention not asserted) |
| Resend | UNKNOWN | Internal ops mail content (PII of the enquiry) | Transactional/ops notification | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Google / reCAPTCHA | UNKNOWN | Token, optional IP, site key, action, hostname/score (see RECAPTCHA_DATA_FLOW.md) | Bot protection on forms | UNKNOWN | YES (Google) | UNKNOWN | UNKNOWN | UNKNOWN |
| ProvenExpert | UNKNOWN | If optional consent loads the widget: script + widget traffic to ProvenExpert | Optional review badge | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

ProvenExpert network script is **not** loaded on essential-only consent. A local badge is shown instead. If the widget stays in product after consent, it remains a processor row.

`PARTIAL` because DPA / SCC / TIA / retention legal facts are UNKNOWN until Legal supplies evidence. Do not treat this table as a transfer impact assessment.
