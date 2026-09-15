# Processor / transfer evidence (official first-party sources only)

Technical inventory plus **public vendor document availability**. This file does
**not** invent signed contracts, account acceptance, production regions, TIAs, or
legal bases.

Inspected 2026-09-15 from official vendor URLs only. No customer-dashboard login.

```
PROCESSOR_INVENTORY_READY=YES
GDPR_PROCESSOR_EVIDENCE=PARTIAL
LEGAL_REVIEW_REQUIRED=YES
ACCOUNT_ACCEPTANCE_UNKNOWN=YES
TIA_UNKNOWN=YES
```

`PARTIAL` because public DPA/AVV **templates** exist for some vendors, but
**account acceptance**, **plan eligibility**, **signed copies**, **SCC modules in
force for this account**, **TIA**, and **production region/residency** remain
UNKNOWN unless independently evidenced.

Legend:

- `DOCUMENT_AVAILABLE` — official first-party text was retrieved
- `ACCOUNT_ACCEPTANCE_UNKNOWN` — no dashboard/contract evidence that this account accepted it
- `REGION_UNKNOWN` — no account-specific region evidence in this pass
- `TRANSFER_EVIDENCE_AVAILABLE` — vendor text mentions SCCs or similar; not proof they apply here
- `TIA_UNKNOWN` — no transfer-impact assessment evidence

| Processor | purpose | production_usage | DPA / AVV | SCC / transfer | TIA | Region | Notes (official sources only) |
|---|---|---|---|---|---|---|---|
| Checkdomain | Host public static site | YES (live `www.deintarifheld.de`) | DOCUMENT_AVAILABLE in customer area (`Meine Daten > Auftragsverarbeitung`); ACCOUNT_ACCEPTANCE_UNKNOWN | UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN (marketing pages mention DE hosting; not used as account proof) | Official how-to: https://www.checkdomain.de/support/dsgvo/wann-benoetige-ich-einen-auftragsverabeitungsvertrag/ . Subprocessor PDF exists at checkdomain.de; not treated as signed. |
| Vercel | Lead/Career API, ops inbox, retention cron | YES (`deintarifheld-leads-api.vercel.app`) | DOCUMENT_AVAILABLE https://vercel.com/legal/dpa — text states it applies to **Enterprise and Pro** plans; ACCOUNT_ACCEPTANCE_UNKNOWN; plan UNKNOWN | TRANSFER_EVIDENCE_AVAILABLE in that DPA text (EU SCCs / UK IDTA mentioned); ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN | Do not claim the DPA is in force for this account. |
| Supabase | Store leads, careers, audit, hashed rate-limit buckets | YES (human-named project `deintarifheld-phase-a`; migrations 003–005 independently verified PASS — not re-run here) | DOCUMENT_AVAILABLE https://supabase.com/legal/customer-resources/data-processing-addendum ; ACCOUNT_ACCEPTANCE_UNKNOWN | TRANSFER_EVIDENCE_AVAILABLE (DPA text includes UK/Swiss addenda / clauses); ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN (published Datenschutz names `eu-central-1`; not independently verified in this pass) | Subprocessor list: https://supabase.com/legal/customer-resources/subprocessor-list |
| Resend | Internal ops notification | YES intended (`LEADS_MAIL_MODE=internal_live`; domain deintarifheld.de human-verified). Customer mail remains OFF | DOCUMENT_AVAILABLE https://resend.com/legal/dpa (also https://www.resend.com/legal/dpa); text says binding on ToS acceptance or execution; ACCOUNT_ACCEPTANCE_UNKNOWN | TRANSFER_EVIDENCE_AVAILABLE (DPA attaches SCCs); ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN | Do not treat ToS wording as proof this account executed the DPA. |
| Google reCAPTCHA | Bot protection on forms | YES — **Standard reCAPTCHA v3** (human-verified). Enterprise is **not** used | Cloud DPA DOCUMENT_AVAILABLE https://cloud.google.com/terms/data-processing-addendum — that document is a **Google Cloud** customer DPA. Standard v3 account acceptance of that Cloud DPA is **UNKNOWN** and must **not** be assumed | TRANSFER_EVIDENCE_AVAILABLE for Google Cloud customers; **not** claimed for this Standard v3 setup | TIA_UNKNOWN | REGION_UNKNOWN (Google) | Official Standard FAQ (cookies / recaptcha.net): https://developers.google.com/recaptcha/docs/faq . Verify URL used by code: `https://www.google.com/recaptcha/api/siteverify`. Browser script: `https://www.google.com/recaptcha/api.js`. |
| ProvenExpert | Optional review widget | YES in code; network script only if `provenexpert: true` | No official DPA/AVV URL found in this pass. Privacy policy DOCUMENT_AVAILABLE https://www.provenexpert.com/de-de/datenschutzbestimmungen/ (Expert Systems AG). ACCOUNT_ACCEPTANCE_UNKNOWN | UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN | Do not invent a signed AVV. Local badge does not load `s.provenexpert.net`. |
| TELESON Vertriebs GmbH | Named Handelsvertreter / possible Tarifweitergabe | UNKNOWN (manual ops only; no automated repo path) | UNKNOWN | UNKNOWN | TIA_UNKNOWN | UNKNOWN | Not a hosting processor in this repo. |
| Energy providers | Liefervertrag if later vermittelt | UNKNOWN | UNKNOWN | UNKNOWN | TIA_UNKNOWN | UNKNOWN | No automated repo path. |

ProvenExpert network script is **not** loaded on essential-only consent. A local badge is shown instead.

No CRM / Averion processor row: not in this repository and not added here.

```
GDPR_PROCESSOR_EVIDENCE=PARTIAL
```
