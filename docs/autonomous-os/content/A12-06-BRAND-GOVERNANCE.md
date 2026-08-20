# A12-06 Brand Governance

`BrandPolicyV1` from repository DeinTarifheld identity (not AVERION).

- Canonical name: DeinTarifheld
- Allowed CTA: Mehr zum Ablauf / Ablauf erfahren / Prozess erklären / FAQ lesen
- Forbidden CTA: Jetzt sparen / Garantiert wechseln / Sofort buchen / Live-Tarif abschließen
- Allowed domains: deintarifheld.de, www.deintarifheld.de
- Max hashtags: 3
- XSS markers (`<script`, `javascript:`, `onerror=`) fail brand
- Channel render escapes `& < > " '`

This is deterministic rule-checking, not a grammar engine.
