# A11-01 Control Plane Architecture

```
BROWSER → CC UI → OPS BFF /ops/v1 → AuthN session → AuthZ capabilities
  → registered command OR read projection → domain TX (A1–A10) → audit
```

Never: browser → Postgres, browser → provider, browser → service_role.

Automation plane = A1–A10. Control plane = A11. Dual-plane preserved.

P3 memory kill (`killStatePersisted: false`) is **not** automation authority. A11 kill/takeover use A1 durable control + `CONTROL_VERSION`.
