# A1 Security Review

| Topic | Result |
|-------|--------|
| SQL injection | Parameterized queries only |
| Dynamic code from payload | Blocked (registry allowlist) |
| Payload trust | DATA only; cannot mutate registry/controls |
| Secrets logging | Correlation IDs only; no full payloads |
| Client control_version | Not accepted; server increments |
| AuthZ | Activation gates + durable control; least-privilege role deferred to M11F/G (LOCAL_TEST_ONLY elevated creds) |
| TOCTOU controls | Fresh pre-effect check + claim-bound version |
