# A7-07 Money Precision & Rounding

Authority unit: integer micro-EUR (`MICRO_EUR_SCALE=1_000_000`). Unit prices: microEUR/kWh.

No binary float commercial authority. Central `TariffCalculationPolicyV1`: round **only final annual totals** (identity on integer micro). Component math exact BigInt.

