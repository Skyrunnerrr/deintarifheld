# A3-02 Field and Normalization Matrix

See A3-01 table. Parser rules:

- Consumption: digits-only integer → OK kWh; any comma/dot/letters → AMBIGUOUS; no unit inference beyond form label.
- Energy: exact `Strom`/`Gas` only.
- Sites: exact UI tokens including Unicode en-dash `2–5`; ASCII `2-5` → AMBIGUOUS.
