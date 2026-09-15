# Public legal alignment — facts for Legal (not published copy)

This file does **not** invent privacy-policy or AGB wording. Public `/datenschutz` and `/agb` were **not** rewritten in PR #6.

```
PUBLIC_LEGAL_ALIGNMENT=FAIL
LEGAL_TEXT_CODE_MISMATCH=YES
LEGAL_REVIEW_REQUIRED=YES
TDDDG_NOTE=published AGB still says TTDSG; current federal short name is TDDDG. Factual note only.
```

`PUBLIC_LEGAL_ALIGNMENT=FAIL` until the **published** `/datenschutz` text describes the real third-party flows below. A draft in `docs/legal/` is not publication.

## Missing from published `/datenschutz` (do not invent replacement copy here)

| Real flow | In published `/datenschutz`? | Technical evidence |
|---|---|---|
| Google reCAPTCHA on forms (script + classic siteverify; IP / token / action / hostname / score may be involved) | NO | `docs/compliance/RECAPTCHA_DATA_FLOW.md` |
| ProvenExpert network script after optional consent; local badge otherwise | NO | `lib/consent/third-party.js`, `components/ui/ProSealWidget.js` |

## Code vs published AGB

| Published claim | Code / ops truth |
|---|---|
| AGB § 5 (2): automatic customer confirmation email with order number and data summary | `CUSTOMER_MAIL_ENABLED=NO`. Customer confirmation stays off. Do not enable mail to close this gap. |
| AGB § 6 (1): “TTDSG” | Factual: the federal short name is now TDDDG. Legal must decide published wording. |

```
LEGAL_TEXT_CODE_MISMATCH=YES
```

## What software may say on public non-legal pages

Neutral facts only, e.g. `SSL-verschlüsselt`, `Datenschutzinformationen verfügbar`. Absolute marketing claims (`DSGVO-konform`, `Keine Weitergabe an Dritte`, `100% DSGVO`) are forbidden on public non-legal surfaces.
