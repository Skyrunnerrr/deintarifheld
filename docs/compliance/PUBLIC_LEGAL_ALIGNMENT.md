# Public legal alignment — facts for Legal (not a legal opinion)

Repo public pages `app/datenschutz/page.js` and `app/agb/page.js` were aligned to
implemented production behavior on 2026-09-15. This file is not a substitute for
qualified legal review.

Live Checkdomain `/datenschutz` and `/agb` were **not** redeployed in this pass
(`LIVE_SITE_LEGAL_TEXT=STALE`).

```
PUBLIC_LEGAL_ALIGNMENT=PASS
LEGAL_TEXT_CODE_MISMATCH=NO
TECHNICAL_FACTUAL_PRIVACY_REVIEW=PASS
LEGAL_REVIEW_REQUIRED=YES
EXTERNAL_LEGAL_REVIEW_REQUIRED_FOR_MERGE=NO
LEGAL_ESCALATION_IF_SPECIFIC_ISSUE=YES
TDDDG_NOTE=AGB §6 now names TDDDG (zuvor TTDSG).
LIVE_SITE_LEGAL_TEXT=STALE
```

`PUBLIC_LEGAL_ALIGNMENT=PASS` means the **repo** public texts no longer contain the
previously recorded factual mismatches versus code. It is **not** counsel approval
and **not** evidence that the live website already shows the new text.

`LEGAL_REVIEW_REQUIRED=YES` means no qualified counsel sign-off is recorded and
none is invented. It is **optional escalation** if a concrete legal question
appears. It is **not** a merge blocker (`EXTERNAL_LEGAL_REVIEW_REQUIRED_FOR_MERGE=NO`).

## Closed factual mismatches (repo vs code)

| Real flow | In repo `/datenschutz`? | Technical evidence |
|---|---|---|
| Google reCAPTCHA on forms (enterprise.js + Enterprise Assessment; v3) | YES (9.4) | `docs/compliance/RECAPTCHA_DATA_FLOW.md`, `lib/leads/captcha.js`, `lib/security.js` |
| ProvenExpert network script after optional consent; local badge otherwise | YES (9.5) | `lib/consent/third-party.js`, `components/ui/ProSealWidget.js` |
| `localStorage th_consent` / `sessionStorage dth_pe_withdraw_reload` | YES (12) | `CookieBanner.jsx`, `provenexpert-runtime.js` |
| Retention redacts/minimises; `legal_hold` skipped; not legal anonymisation | YES (13) | `app/api/cron/retention/route.js`, `lib/leads/retention-privacy.js` |
| Post-redaction lookup by original email not available | YES (15) | `lib/leads/admin-erase.js`, `docs/compliance/DELETION_RETENTION_MODES.md` |

## AGB vs code

| Claim | Code / ops truth | Repo AGB |
|---|---|---|
| Automatic transactional acknowledgement | Current production flow can send a short customer/partner confirmation when `LEADS_MAIL_MODE=live` and `ALLOW_CUSTOMER_MAIL=YES`. | §5(2): no contractual entitlement to an automatic confirmation; this remains compatible with a voluntarily sent transactional acknowledgement |
| Statutory short name for cookie/telemedia law | Factual federal short name is TDDDG | §6(1): TDDDG (zuvor TTDSG) |

```
LEGAL_TEXT_CODE_MISMATCH=NO
```

## What software may say on public non-legal pages

Neutral facts only, e.g. `SSL-verschlüsselt`, `Datenschutzinformationen verfügbar`. Absolute marketing claims (`DSGVO-konform`, `Keine Weitergabe an Dritte`, `100% DSGVO`) remain forbidden on public non-legal surfaces.
