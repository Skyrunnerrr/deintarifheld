# A3-01 Business Qualification Policy V1

**Policy ID:** `B2BQualificationPolicyV1`  
**Version:** 1  
**Scope:** `INITIAL_B2B_CALL_READINESS`  
**Goal:** enough structure for a short online call — NOT final offer readiness.

## Field matrix (mandatory)

| FIELD | CURRENT_FORM_PRESENT | INTAKE_REQUIRED | CALL_READY_CLASS | CONDITIONAL_RULE | NORMALIZATION | AMBIGUITY_BEHAVIOR | MISSING_REASON | SOURCE_EVIDENCE |
|-------|---------------------|-----------------|------------------|------------------|---------------|--------------------|----------------|-----------------|
| firma | yes | yes | REQUIRED_FOR_CALL_READINESS | — | trim, len≥2 | n/a | REQUIRED_VALUE_MISSING | validate-unternehmen.js + BusinessForm |
| ansprechpartner | yes | yes | REQUIRED_FOR_CALL_READINESS | — | trim, len≥2 | n/a | REQUIRED_VALUE_MISSING | same |
| email | yes | yes | REQUIRED_FOR_CALL_READINESS | — | lower; contactability flag only in qual store | n/a | CONTACTABILITY_MISSING | same |
| telefon | yes | no | USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL | — | present flag | — | — | form optional; Owner CALL_READY |
| plz | yes (UI *) | no (server) | USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL | — | 5 digits if present | INVALID not blocking call | — | UI required; intake optional if empty |
| energieart | yes (UI *) | no (server) | REQUIRED_FOR_CALL_READINESS | Strom|Gas only | ELECTRICITY|GAS | UNKNOWN→HUMAN_REVIEW | REQUIRED_VALUE_MISSING / ENERGY_TYPE_UNKNOWN | BusinessForm `['Strom','Gas']` |
| verbrauchStrom | yes conditional | no | REQUIRED_FOR_CALL_READINESS | if ELECTRICITY | integer kWh digits-only | AMBIGUOUS_NUMBER | RELEVANT_CONSUMPTION_MISSING | form type=number label kWh |
| verbrauchGas | yes conditional | no | REQUIRED_FOR_CALL_READINESS | if GAS | integer kWh digits-only | AMBIGUOUS_NUMBER | RELEVANT_CONSUMPTION_MISSING | same |
| standorte | yes (UI *) | no (server) | REQUIRED_FOR_CALL_READINESS | exact `1`/`2–5`/`6+` | canonical bucket | SITE_COUNT_AMBIGUOUS | SITE_COUNT_MISSING | BusinessForm options (en-dash) |
| versorger | yes | no | USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL | — | UNSTRUCTURED text present | — | — | Owner: clarify in call |
| vertragslaufzeit | yes | no | USEFUL_BUT_CAN_BE_CLARIFIED_IN_CALL | — | UNSTRUCTURED; no date invent | — | — | Owner: no fabricated dates |
| nachricht | yes | no | LATER_STAGE_REQUIRED | never authority | unstructured_note_present only | — | — | Master prompt §25 |

## Unresolved Owner rules

None material for V1. PLZ kept clarifiable-in-call despite UI asterisk (intake does not require it; geographic eligibility is A7).

## Over-collection red team

Supplier/contract/phone/PLZ do not block CALL_READY. Consumption required only for selected energy type.
