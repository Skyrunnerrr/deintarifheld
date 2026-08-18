# A11-13 Operator Command Registry

`executeOperatorCommand` accepts only `OperatorCommandType` values. Envelope: command type, target ID, idempotency key, correlation ID, expected revision, reason (high-impact), confirm (high-risk). Unknown command rejected. No PATCH of Case status to ACTIVE.
