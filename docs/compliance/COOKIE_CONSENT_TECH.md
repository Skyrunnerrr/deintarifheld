# Cookie / consent — technical truthfulness

```
COOKIE_TECH_TRUTHFUL=PASS
PROVENEXPERT_INITIAL_CONSENT=PASS
PROVENEXPERT_WITHDRAWAL=PASS
LEGAL_REVIEW_REQUIRED=YES
```

Repo `/datenschutz` now discloses `th_consent`, the PE reload flag, reCAPTCHA, and optional ProvenExpert. Live Checkdomain pages were not republished in this pass. Legal review remains required.

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

## Withdrawal (`provenexpert` true → false)

`script.remove()` alone is not enough after the widget has run. Runtime plan (`lib/consent/provenexpert-runtime.js`):

- do not load the network script again
- strip `.pe-pro-seal` / provider DOM and PE scripts
- no further PE requests
- show the local badge
- persist the withdrawn consent, strip script and provider DOM, then **always** one controlled full-page reload (`sessionStorage` flag `dth_pe_withdraw_reload` prevents a loop). No provider destroy-API shortcut.

Covered transition: `false → true → false`.

## Residual (legal, not invented here)

Whether reCAPTCHA may run without a separate consent toggle is a Legal/TDDDG question. This change only stops the software from making a false “no third parties” claim.
