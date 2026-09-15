# Public legal alignment — facts for Legal (not a legal opinion)

Repo public pages `app/datenschutz/page.js` and `app/agb/page.js` were aligned to
implemented production behavior on 2026-09-15. This file is not a substitute for
qualified legal review.

Live Checkdomain `/datenschutz` and `/agb` were **not** redeployed in this pass
(`LIVE_SITE_LEGAL_TEXT=STALE`).

```
PUBLIC_LEGAL_ALIGNMENT=PASS
LEGAL_TEXT_CODE_MISMATCH=NO
LEGAL_REVIEW_REQUIRED=YES
TDDDG_NOTE=AGB §6 now names TDDDG (zuvor TTDSG). Legal still reviews published wording.
LIVE_SITE_LEGAL_TEXT=STALE
```

`PUBLIC_LEGAL_ALIGNMENT=PASS` means the **repo** public texts no longer contain the
previously recorded factual mismatches versus code. It is **not** legal-release
approval and **not** evidence that the live website already shows the new text.

## Closed factual mismatches (repo vs code)

| Real flow | In repo `/datenschutz`? | Technical evidence |
|---|---|---|
| Google reCAPTCHA on forms (script + classic siteverify; Standard v3; not Enterprise) | YES (9.4) | `docs/compliance/RECAPTCHA_DATA_FLOW.md`, `lib/leads/captcha.js`, `lib/security.js` |
| ProvenExpert network script after optional consent; local badge otherwise | YES (9.5) | `lib/consent/third-party.js`, `components/ui/ProSealWidget.js` |
| `localStorage th_consent` / `sessionStorage dth_pe_withdraw_reload` | YES (12) | `CookieBanner.jsx`, `provenexpert-runtime.js` |
| Retention redacts/minimises; `legal_hold` skipped; not legal anonymisation | YES (13) | `app/api/cron/retention/route.js`, `lib/leads/retention-privacy.js` |
| Post-redaction lookup by original email not available | YES (15) | `lib/leads/admin-erase.js`, `docs/compliance/DELETION_RETENTION_MODES.md` |

## AGB vs code

| Claim | Code / ops truth | Repo AGB |
|---|---|---|
| Automatic customer confirmation email with order number and data summary | `CUSTOMER_MAIL_ENABLED=NO`. Dual guard closed. Do not enable mail. | §5(2): no contractual promise of automatic confirmation; contact may follow via supplied contact data |
| Statutory short name for cookie/telemedia law | Factual federal short name is TDDDG | §6(1): TDDDG (zuvor TTDSG) |

```
LEGAL_TEXT_CODE_MISMATCH=NO
```

## What software may say on public non-legal pages

Neutral facts only, e.g. `SSL-verschlüsselt`, `Datenschutzinformationen verfügbar`. Absolute marketing claims (`DSGVO-konform`, `Keine Weitergabe an Dritte`, `100% DSGVO`) remain forbidden on public non-legal surfaces.
