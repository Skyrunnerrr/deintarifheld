# A4-09 Stale Message Prevention

Every missing-info intent stores `qualification_revision` and `requirement_fingerprint`.

Immediately before provider call A4 re-reads:

- current revision
- OPEN requirements
- authoritative recipient hash
- case/workflow/control/suppression
- intent still sendable

Mismatch → CANCELLED_STALE, provider calls 0.

New revision cancels READY intents for the old revision. Partial reply creates a new intent for the remaining field set only.
