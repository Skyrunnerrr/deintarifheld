# Public Intake Atomicity

Local canonical path: acceptBusinessLeadAtomic — BEGIN lead + outbox + audit COMMIT.

HTTP success semantics (local): LEAD_DURABLY_ACCEPTED + DURABLE_HANDOFF_INTENT_RECORDED.

Current production path: still service_role Data API (unchanged). Gap owned by M11Q.

Labels: ATOMIC_INTAKE_TARGET=PROVEN_E2_LOCAL, PRODUCTION_ATOMIC_INTAKE=NOT_YET_CUT_OVER.
