# Control Matrix (Phase-4 reconciled — M8/M8C)

STATUS=E1_FROM_M8_RECONCILIATION  
RULE=Never emit GDPR_COMPLIANT=true.  
SOURCE=evidence-reports/DTH-M8.md + DTH-M8C.md

| CONTROL | STATUS | EVIDENCE |
|---|---|---|
| Authentication JWT (local) | PASS_LOCAL E2 | M7/M8 |
| Remote JWKS (public) | PASS_LOCAL E2; Clerk Secret NOT_REQUIRED | H0b2a |
| Live authenticated Dev session proof | UNAVAILABLE / PARTIAL hist. | H0b2b gap |
| Passkey local CC gate | PASS_LOCAL E2 DEV_ONLY | H0b3b |
| Session policy 30m/12h/max1 | PASS_LOCAL E2 | H0b4 |
| Session registry persistence | LOCAL_DEVELOPMENT_ONLY (in-memory) | R-SESS |
| Provider live revoke/disable | UNAVAILABLE | G-H0B4-01 |
| Persistent person mapping | NOT_IMPLEMENTED | R-MAP |
| Strong AuthZ / RBAC | NOT_IMPLEMENTED | R-AUTHZ |
| Synthetic owner local gate | LOCAL_ONLY | ops-api |
| RLS enable default-deny | PARTIAL | migrations |
| RLS CREATE POLICY | NOT_IMPLEMENTED | count=0 |
| Service-role / privileged DB boundary | RISK OPEN — RLS does not contain it | R-SVC |
| Production RLS | NOT_IMPLEMENTED | PRODUCTION_RLS_READY=NO |
| Kill switch persistence | LOCAL_DEVELOPMENT_ONLY | R-KILL |
| H0b3d cleanup proof | UNPROVEN | M6 OPEN |
| Recovery H0b3c | DEFERRED | R-REC |
| Custom FAPI/DNS H0b5 | DEFERRED | R-IDP |
| Staging environment | NOT_IMPLEMENTED | R-STG |
| Monitoring | UNKNOWN | R-MON |
| Data Inventory / Legal | OPEN / LEGAL_REVIEW | M12+ |
