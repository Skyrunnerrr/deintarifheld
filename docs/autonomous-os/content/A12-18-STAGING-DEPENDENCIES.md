# A12-18 Staging Dependencies

Not proven in A12 E2. Required before staging content autonomy:

- live content AI provider (if used) + secret custody
- publishing provider + channel API contract
- sandbox social account / page ids / OAuth
- posting limits and readback semantics
- production brand / claim / approval / cadence policy
- auto-publish decision (default: not approved)
- A11 real AuthN/AuthZ and M11 security gates
- monitoring + retention

A12 E2 does not mutate staging or production DBs.
