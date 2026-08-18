# A11-06 Approvals

One queue: `ops.offer_approvals` + `ops.switch_approvals`.

Approve/reject: server command, current-revision recheck, `expectedRevision` = commercial_snapshot_hash (A8) or payload_hash (A9). Stale → `STALE_APPROVAL`, effect 0. Idempotency via `ops.operator_commands`.
