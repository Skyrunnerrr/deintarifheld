# @deintarifheld/ops-api

DeinTarifHeld Ops/CC BFF.

## Surfaces

- **P3-F1** Person AuthN (synthetic local Owner)
- **P3-F6** Kill-switch (in-memory, Owner-only mutate)
- **P3-F3** In-process `/ops/v1` BFF (reads + limited writes)
- **P3-F4** Minimal local/dev **HTTP read adapter** (GET only, loopback, fail-closed in production)

### HTTP read adapter

Enabled only when:

- `NODE_ENV` is not `production`
- `DTH_OPS_HTTP_ADAPTER_ENABLED=true` (or `NODE_ENV=test`)

Binds to `127.0.0.1` only. Exposes read routes under `/ops/v1`. Rejects POST/PUT/PATCH/DELETE with 405.

Session bootstrap: `GET /ops/v1/dev/session` (AuthN only; not an F3 limited write).
