# A11-18 Failure / Concurrency

| FI | Handling |
|---|---|
| FI-A11-01 read DB failure | query throws; UI/BFF shows failure, not zero-as-healthy |
| FI-A11-02 session missing | 401 SESSION_MISSING |
| FI-A11-03 forged role | ignored; server personId wins |
| FI-A11-04 stale approval | STALE_APPROVAL effect 0 |
| FI-A11-05 duplicate approval | idempotent replay |
| FI-A11-06 takeover after change | expectedRevision / current workflows |
| FI-A11-07 duplicate reprocess | operator_commands unique key |
| FI-A11-08 reconcile unknown twice | domain refuse blind submit |
| FI-A11-09 global kill double-submit | idempotent replay |
| FI-A11-10 control DB unavailable | CONTROL_UNAVAILABLE fail-closed |
| FI-A11-11 stale CONTROL_VERSION | STALE_OPERATOR_VIEW |
| FI-A11-12 audit commit failure | TX rollback of command log |
| FI-A11-13 lost HTTP after commit | retry same idempotency key |
| FI-A11-14 permission revoked | AuthZ rechecked each command |
| FI-A11-15 oversized body | 413 BODY_TOO_LARGE |
