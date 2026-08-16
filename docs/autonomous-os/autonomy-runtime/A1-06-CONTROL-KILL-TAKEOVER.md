# A1 Control / Kill / Takeover

- GLOBAL AUTOMATION ACTIVE = kill on (no claims; workers stay alive)
- DOMAIN keys constrained to KillDomain registry
- WORKFLOW PAUSED / TAKEOVER durable
- CONTROL_VERSION increments on every control mutation
- Fresh control read before effect boundary
- CONTROL_STATE_UNAVAILABLE → no autonomous execution
- PROCESS_RUNNING ≠ AUTOMATION_ENABLED
