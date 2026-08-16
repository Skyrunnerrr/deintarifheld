# A0 Autonomy Gap Matrix

| GAP_ID | Group | Description | Blocks E2E? | Tranche |
|--------|-------|-------------|-------------|---------|
| G-A1-01 | G2/G3 | No continuous worker loop | YES | A1 |
| G-A1-02 | G2/G3 | No scheduler/delayed jobs | YES | A1 |
| G-A1-03 | G2/G3 | No retry/backoff/DLQ/reprocess | YES | A1 |
| G-A1-04 | G2/G3 | No durable workflow/job tables in apply root | YES | A1 / M11V |
| G-A1-05 | G4 | Kill switch not durable; no CONTROL_VERSION | Staging YES | A1 embeds M11O |
| G-A2-01 | G1 | No Public→Ops source outbox handoff | YES | A2 / M11T |
| G-A2-02 | G1 | No automatic case creation from lead | YES | A2 |
| G-A3-01 | G1 | No qualification / missing-info detection | YES | A3 |
| G-A4-01 | G1 | No inbound email correlation | YES | A4 |
| G-A4-02 | G1 | No follow-up cancel-on-reply | YES | A4 |
| G-A5-01 | G1 | No calendar booking loop | YES for E2E-01 | A5 |
| G-A6-01 | G1 | No document extraction | Later for E2E-01 | A6 |
| G-A7-01 | G1 | No deterministic tariff engine | Later | A7 |
| G-A8-01 | G1 | No offer engine | Later | A8 |
| G-A9-01 | G1 | No switching workflow | Later | A9 |
| G-A10-01 | G1 | No renewal loop | Later | A10 |
| G-A11-01 | G6 | CC not production / not exception cockpit | Soft | A11 |
| G-SEC-01 | G4 | Runtime LOGIN roles / grants (ACL-02) open | Staging YES | M11F/G inside A1 staging gate |
| G-SEC-02 | G4 | Strong AuthZ + RLS waves incomplete | Staging YES | M11H–M |
| G-MKT-01 | G7 | Content/acquisition absent | NO for revenue E2E | A12/A13 |
