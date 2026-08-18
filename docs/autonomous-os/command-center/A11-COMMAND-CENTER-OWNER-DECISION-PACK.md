# A11 Command Center Owner Decision Pack

| Topic | DECISION | CURRENT EVIDENCE | RECOMMENDED DEFAULT | BLOCKS_E2 | BLOCKS_STAGING | BLOCKS_PRODUCTION |
|---|---|---|---|---|---|---|
| Auth provider | UNRESOLVED | E2 test identity only | Pick IdP + MFA | NO | YES | YES |
| Role/capability policy | E2 matrix | VIEWER/OPERATOR/APPROVER/OWNER | Keep capability model | NO | YES until M11 mapping | YES |
| Who may global kill | E2 OWNER only | capability GLOBAL_KILL_MANAGE | Owner + break-glass | NO | YES | YES |
| Offer approval | E2 APPROVER+OWNER | A8 revision-bound | Same | NO | policy | YES |
| Switch approval | E2 APPROVER+OWNER | A9 payload hash | Same | NO | policy | YES |
| Takeover | E2 OPERATOR+ | A1 workflow | Same | NO | confirm | YES |
| Reprocess | E2 OPERATOR+ | A1 DLQ | Same | NO | confirm | YES |
| Reconcile | E2 OPERATOR+ | domain registry | Same | NO | confirm | YES |
| Deployment | UNRESOLVED | loopback Node adapter | Dynamic private server | NO | YES | YES |
| Audit retention | UNRESOLVED | unbounded local | Owner policy | NO | YES | YES |
| Monitoring | UNRESOLVED | no fake heartbeat | LAST_JOB_ACTIVITY until heartbeat exists | NO | YES | YES |
