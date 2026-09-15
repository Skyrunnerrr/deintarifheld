# Legal alignment matrix (facts only)

Inspected: repo HEAD of this legal-alignment pass (PR #6) against implemented
code on 2026-09-15. This file does **not** invent privacy-policy or AGB wording
beyond recording what `app/datenschutz/page.js` and `app/agb/page.js` now say.

Live Checkdomain pages were **not** redeployed in this pass. Repo text is the
source of truth for the next authorized static publish.

```
LEGAL_ALIGNMENT_MATRIX_READY=YES
PUBLIC_LEGAL_ALIGNMENT=PASS
LEGAL_TEXT_CODE_MISMATCH=NO
TECHNICAL_FACTUAL_PRIVACY_REVIEW=PASS
LEGAL_REVIEW_REQUIRED=YES
EXTERNAL_LEGAL_REVIEW_REQUIRED_FOR_MERGE=NO
LEGAL_ESCALATION_IF_SPECIFIC_ISSUE=YES
GDPR_PROCESSOR_EVIDENCE=PARTIAL
LIVE_SITE_LEGAL_TEXT=STALE
```

`MATCH` / `MISMATCH` / `UNKNOWN` / `PARTIAL` only. No legal-basis assessment.
`LEGAL_REVIEW_REQUIRED=YES` remains because no counsel sign-off is recorded and
none is invented. External counsel is **optional escalation**, not a merge
blocker. `GDPR_PROCESSOR_EVIDENCE=PARTIAL` is ongoing governance.

| Item | TECH_FLOW_PRESENT | PUBLIC_DISCLOSED | PROCESSOR_EVIDENCE | LEGAL_REVIEW_REQUIRED | Verdict |
|---|---|---|---|---|---|
| Google reCAPTCHA (form script + classic siteverify; Standard v3 in production) | YES | YES (`/datenschutz` 9.4 + Dienstleisterliste) | DOCUMENT_AVAILABLE / ACCOUNT_ACCEPTANCE_UNKNOWN | YES | MATCH (disclosure). DPA/SCC/TIA still UNKNOWN for this account |
| ProvenExpert (optional network script after consent; local badge otherwise) | YES | YES (`/datenschutz` 9.5) | PRIVACY_POLICY_AVAILABLE / DPA_UNKNOWN / ACCOUNT_ACCEPTANCE_UNKNOWN | YES | MATCH (disclosure) |
| Browser storage: `localStorage th_consent`; `sessionStorage dth_pe_withdraw_reload` (not HTTP-cookies of this site) | YES | YES (`/datenschutz` 12) | N/A | YES | MATCH |
| Checkdomain static hosting | YES | YES | DOCUMENT_AVAILABLE (AVV in customer area) / ACCOUNT_ACCEPTANCE_UNKNOWN / REGION_UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (account AVV) |
| Vercel Lead API | YES | YES | DOCUMENT_AVAILABLE (Pro/Enterprise DPA template) / ACCOUNT_ACCEPTANCE_UNKNOWN / REGION_UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (account DPA/SCC/TIA) |
| Supabase Postgres | YES | YES (text names `eu-central-1`; not independently re-verified here) | DOCUMENT_AVAILABLE / ACCOUNT_ACCEPTANCE_UNKNOWN / REGION_UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (account DPA/region evidence) |
| Resend internal ops mail | YES (`internal_live`; customer mail dual-guard closed) | YES | DOCUMENT_AVAILABLE / ACCOUNT_ACCEPTANCE_UNKNOWN / REGION_UNKNOWN | YES | MATCH (disclosure) / UNKNOWN (account DPA/SCC/TIA) |
| TELESON / energy providers | NO automated integration in this repo. Footer/legal mention only. Manual ops forwarding UNKNOWN | YES (conditional) | UNKNOWN | YES | UNKNOWN (no code path; human process not evidenced) |
| Form processing (POST `/api/leads/` `/api/careers/`) | YES | YES | N/A (controller processing) | YES | MATCH |
| Retention cron (redact/minimise after configured days; skips `legal_hold`) | YES (defaults 90 / 90 / 183) | YES (redigiert/minimiert; not “als gelöscht gekennzeichnet”) | UNKNOWN | YES | MATCH (mechanism wording) |
| Audit logs (`audit_events`; delete audits omit plaintext email) | YES | PARTIAL (“technische Ereignisse”) | UNKNOWN | YES | PARTIAL (disclosure sufficient for this pass; Legal may want more detail) |
| Career/Partner form | YES (no file upload) | YES | N/A | YES | MATCH |
| AI use (customer-facing) | NO | YES (“kein KI-gestütztes Lead-Scoring”) | N/A | YES | MATCH |
| Automated decisions with legal effect | NO | YES | N/A | YES | MATCH |
| Customer mail | NO (`CUSTOMER_MAIL_ENABLED=NO`; dual guard) | YES in Datenschutz §10; AGB §5(2) no automatic-confirmation promise | N/A | YES | MATCH |
| Post-redaction rights lookup by original email | NOT_AVAILABLE (email replaced by shared placeholder) | YES (`/datenschutz` §15: assignment by original email no longer technically possible) | N/A | YES | MATCH |
| AGB §5 (2) automatic Eingangsbestätigung + order number + data summary | NO | NO (text now: no contractual promise of automatic confirmation) | N/A | YES | MATCH |
| AGB §6 (1) TDDDG (zuvor TTDSG) | N/A (wording only) | YES (TDDDG named; TTDSG only as prior short name) | N/A | YES | MATCH (factual naming) |

Do **not** enable customer mail. Do **not** treat this matrix as legal release approval.
