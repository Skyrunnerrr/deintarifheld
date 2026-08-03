# @deintarifheld/cc

DeinTarifHeld Command Center package.

## P3-F4 (current)

Local/dev **read-only** UI for:

- Inbox
- Vorgänge (Cases)
- Aufgaben (Tasks)

Consumes `/ops/v1` via the local HTTP read adapter in `@deintarifheld/ops-api`.

### Local run (dev only)

```bash
# Terminal A — Ops HTTP read adapter (requires local DB URL)
DTH_LOCAL_DATABASE_URL=... DTH_LOCAL_AUTH_ENABLED=true npm run dev:http-read -w @deintarifheld/ops-api

# Terminal B — CC UI
DTH_CC_LOCAL_UI_ENABLED=true npm run dev:local -w @deintarifheld/cc
```

Open `http://localhost:3100/inbox` (use `localhost`, not `127.0.0.1`, for passkey/WebAuthn).

### Boundaries

- No production deployment
- No write UI
- No Averion dependencies
- `COMMAND_CENTER_WRITE_ACTIONS` may remain `ACTIVE` during F4 tests
