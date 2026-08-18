# A11-04 Overview / Inbox

Overview: open cases, waiting customer/provider, approvals, exceptions, switches, active customers, renewals, DLQ, takeovers, global kill, CONTROL_VERSION, freshness, worker = LAST_JOB_ACTIVITY (no fake heartbeat).

Inbox aggregates durable domain states (A1 DLQ, A3 human review, A4/A5/A9 unknown outcomes, A6 conflicts, A8/A9 pending approvals, A10 renewal/exception). Severity is machine-fixed: INFO / ACTION_REQUIRED / HIGH / CRITICAL. Sort: severity then oldest. No independent exception database.
