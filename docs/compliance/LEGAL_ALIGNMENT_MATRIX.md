# Legal alignment matrix (facts only)

Inspected: repo HEAD `231321e8e1d7d6d301b016ae7a0ace956716e8ba` plus live fetch of
`https://www.deintarifheld.de/datenschutz` and `https://www.deintarifheld.de/agb`
on 2026-09-15. This file does **not** invent privacy-policy or AGB wording.

```
LEGAL_ALIGNMENT_MATRIX_READY=YES
PUBLIC_LEGAL_ALIGNMENT=FAIL
LEGAL_TEXT_CODE_MISMATCH=YES
LEGAL_REVIEW_REQUIRED=YES
```

`MATCH` / `MISMATCH` / `UNKNOWN` only. No legal-basis assessment.

Published `/datenschutz` (live, 2026-09-15) matches `app/datenschutz/page.js` on this SHA
for Checkdomain / Vercel / Supabase / Resend / TELESON / “keine Kundenbestätigung” /
no AI lead-scoring. It still omits reCAPTCHA, ProvenExpert, and the cookie/localStorage
banner. Published AGB matches `app/agb/page.js` (§5 automatic confirmation; §6 TTDSG).

| Item | TECH_FLOW_PRESENT | PUBLIC_DISCLOSED | PROCESSOR_EVIDENCE | LEGAL_REVIEW_REQUIRED | Verdict |
|---|---|---|---|---|---|
| Google reCAPTCHA (form script + classic siteverify) | YES | NO | UNKNOWN | YES | MISMATCH |
| ProvenExpert (optional network script after consent; local badge otherwise) | YES | NO | UNKNOWN | YES | MISMATCH |
| Cookies / `localStorage` (`th_consent`) / `sessionStorage` PE reload flag | YES | NO | UNKNOWN | YES | MISMATCH |
| Checkdomain static hosting | YES | YES | UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (DPA) |
| Vercel Lead API | YES | YES | UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (DPA/SCC/TIA) |
| Supabase Postgres | YES | YES (text names `eu-central-1`; not independently verified here) | UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (DPA/region evidence) |
| Resend internal ops mail | YES (when `internal_live` or `live`) | YES | UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (DPA/SCC/TIA) |
| TELESON / energy providers | NO automated integration in this repo. Footer/legal mention only. Manual ops forwarding UNKNOWN | YES (conditional) | UNKNOWN | YES | UNKNOWN (no code path; human process not evidenced) |
| Form processing (POST `/api/leads/` `/api/careers/`) | YES | YES | N/A (controller processing) | YES | MATCH |
| Retention cron (redact/minimise after configured days; skips `legal_hold`) | YES | PARTIAL (90/183 days named; text says “als gelöscht gekennzeichnet”, code redacts PII) | UNKNOWN | YES | MISMATCH (mechanism wording) |
| Audit logs (`audit_events`; delete audits omit plaintext email) | YES | PARTIAL (“technische Ereignisse”) | UNKNOWN | YES | PARTIAL |
| Career/Partner form | YES (no file upload) | YES | N/A | YES | MATCH |
| AI use (customer-facing) | NO | YES (“kein KI-gestütztes Lead-Scoring”) | N/A | YES | MATCH |
| Automated decisions with legal effect | NO | YES | N/A | YES | MATCH |
| Customer mail | NO (`CUSTOMER_MAIL_ENABLED=NO`; dual guard) | Datenschutz YES (“keine Bestätigung”); AGB §5 YES (promises confirmation) | N/A | YES | MATCH vs Datenschutz / MISMATCH vs AGB |
| Post-redaction rights lookup by original email | NOT_AVAILABLE (email replaced by shared placeholder) | NO (text still says removal by email/channel) | N/A | YES | MISMATCH |
| AGB §5 (2) automatic Eingangsbestätigung + order number + data summary | NO | YES | N/A | YES | MISMATCH |
| AGB §6 (1) “TTDSG” vs current federal short name TDDDG | N/A (wording only) | YES (TTDSG) | N/A | YES | UNKNOWN (Legal chooses published short name; factual note only) |

Do **not** enable customer mail to close the AGB gap. Do **not** invent replacement legal copy in this PR.
