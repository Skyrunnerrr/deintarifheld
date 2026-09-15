# Processor / data-flow inventory

Technical inventory only. **UNKNOWN stays UNKNOWN.** This file does not invent DPAs, SCCs, TIAs, legal bases, or regions.

```
PROCESSOR_INVENTORY_READY=YES
GDPR_PROCESSOR_EVIDENCE=PARTIAL
LEGAL_REVIEW_REQUIRED=YES
```

`PARTIAL` because DPA / SCC / TIA / retention-legal facts are UNKNOWN until Legal/ops supply evidence. This is not a transfer impact assessment.

| Processor | purpose | data_categories | direction | production_usage | DPA_STATUS | DATA_REGION | SCC_STATUS | TIA_STATUS | RETENTION_EVIDENCE |
|---|---|---|---|---|---|---|---|---|---|
| Checkdomain | Host public static site (HTML/assets); HTTPS/www redirects | Site assets; host access logs (not inspected) | Browser → Checkdomain | YES (live `www.deintarifheld.de` fetched 2026-09-15) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Vercel | Run Lead/Career API, ops inbox, retention cron | Request metadata, lead/career JSON, admin cookie, platform logs | Browser → `deintarifheld-leads-api.vercel.app` → Vercel | YES (hostname used by live Datenschutz + in-repo browser API contract) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Supabase | Store leads, careers, audit events, hashed rate-limit buckets | Email, payload/PII, refs, mail_status, redaction/hold flags | Vercel API → Supabase (service role, server only) | UNKNOWN whether 003–005 applied; intake storage assumed if live API works — not inspected | UNKNOWN | Published text says `eu-central-1`; not independently verified in this pass | UNKNOWN | UNKNOWN | App cutoffs exist (`LEADS_*_RETENTION_DAYS`); legal retention UNKNOWN |
| Resend | Internal ops notification | Enquiry PII in ops mail body; From/To operational addresses | Vercel API → Resend → ops inbox | UNKNOWN (depends on production `LEADS_MAIL_MODE` / API key / domain verify) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Google reCAPTCHA | Bot protection on forms | Token; optional IP on siteverify; action; hostname; score | Browser → Google; API → `siteverify` | YES in code/CSP; production keys UNKNOWN | UNKNOWN | UNKNOWN (Google) | UNKNOWN | UNKNOWN | UNKNOWN |
| ProvenExpert | Optional review widget | Script/widget traffic if `provenexpert: true` | Browser → `s.provenexpert.net` after optional consent | YES in code; live consent state UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| TELESON Vertriebs GmbH | Named as Handelsvertreter / possible Tarifweitergabe | Would be enquiry/contact data if a human forwards | No automated repo path | UNKNOWN (manual ops only) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Energy providers | Liefervertrag if later vermittelt | Would be switch/enquiry data if a human process exists | No automated repo path | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

ProvenExpert network script is **not** loaded on essential-only consent. A local badge is shown instead.

No CRM / Averion processor row: not in this repository and not added here.
