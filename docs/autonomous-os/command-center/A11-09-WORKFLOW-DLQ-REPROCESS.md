# A11-09 Workflow / DLQ / Reprocess

Jobs view: type, status, attempts, scheduled_at, lease_owner, error class/code, dead-letter flag, reprocess eligibility. `payloadExposed=false`.

Reprocess: `reprocessDeadLetter` — new job, history preserved. Not `UPDATE status='READY'`.
