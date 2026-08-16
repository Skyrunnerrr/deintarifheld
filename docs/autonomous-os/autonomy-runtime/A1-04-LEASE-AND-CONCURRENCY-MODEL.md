# A1 Lease and Concurrency

- Claim: `FOR UPDATE SKIP LOCKED`, order `priority DESC, scheduled_at ASC, created_at ASC, id ASC`
- Lease owner + generation; expiry reclaim automatic
- Completion requires matching lease_owner + generation + unexpired lease
- Default concurrency: sequential per worker; multi-worker claim-safe (proven)
- Claim refreshes `control_version` to current (binding for pre-effect stale check)
- JOB_DELIVERY_SEMANTICS=`AT_LEAST_ONCE`
