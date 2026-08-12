# Stop Conditions

Cursor / any builder stops immediately and reports `STOPPED_SAFE` when:

- unexpected production write
- secret detected in commit/log/evidence
- baseline test fails unexpectedly
- repository state differs from assumed freeze
- unknown migration state
- dependency assumption unverified
- production data encountered unexpectedly
- architecture conflict discovered without ADR
- required external configuration unknown
- scope expansion required
- rollback impossible
- security control fails

Do not improvise past stop conditions.
