# A4-04 Provider Adapter

Resend SDK `6.18.1` (unchanged).  
E2: `createMockEmailProvider` only. Live `createResendEmailProvider` gated, unused in tests.  
DTH idempotency key canonical; provider key ≤24h defense-in-depth.  
OUTCOME_UNKNOWN → no blind retry.
