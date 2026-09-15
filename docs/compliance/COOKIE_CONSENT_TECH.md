# Cookie / consent — technical truthfulness

```
COOKIE_TECH_TRUTHFUL=PASS
PROVENEXPERT_CONSENT_TECH=PASS
LEGAL_REVIEW_REQUIRED=YES
```

Public `/datenschutz` and `/agb` were **not** rewritten. Legal copy alignment is LEGAL_REVIEW_REQUIRED.

## What the banner actually controls

| Category | Controlled by banner? | Effect |
|---|---|---|
| Cookie-Auswahl (`th_consent` in localStorage) | Yes | Remembers essential vs optional ProvenExpert |
| ProvenExpert **network** script (`s.provenexpert.net`) | Yes | Loads only when `provenexpert: true` |
| Google reCAPTCHA on forms | **No** | Loads when a form/captcha widget is shown; not gated by this banner |
| Fake “analytics” category | Removed | There is no analytics script to load |

There is no `loadExternalScripts()` placeholder that pretends to control third parties.

The banner does **not** claim “keine Daten ohne Zustimmung an Dritte”, because reCAPTCHA contacts Google when forms are used.

## Essential-only

`{ essential: true, provenexpert: false }` → `shouldLoadProvenExpertScript` is false → **zero** ProvenExpert network script injection.

## Residual (legal, not invented here)

Whether reCAPTCHA may run without a separate consent toggle is a Legal/TDDDG question. This change only stops the software from making a false “no third parties” claim.
