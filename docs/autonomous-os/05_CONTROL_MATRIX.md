# Control Matrix (baseline skeleton)

STATUS=E0_FOUNDATION  
RULE=Never emit GDPR_COMPLIANT=true. Track controls individually.

| CONTROL | STATUS | EVIDENCE |
|---|---|---|
| Data Inventory | OPEN | M12 |
| Purpose Mapping | OPEN | M12 |
| Legal Basis | LEGAL_REVIEW_REQUIRED | Owner/legal |
| Retention | OPEN | M12 |
| AVV Supabase | OPEN | Provider register |
| AVV LLM Provider | OPEN | No production LLM yet |
| Third-country review | OPEN | Legal |
| DSFA Screening | OPEN | M12 |
| DSFA Required | TBD | Legal |
| TOM Review | PARTIAL | Local security proofs E2 |
| DSR Workflow | OPEN | Staging later |
| Breach Runbook | OPEN | Incident docs |
| Production AuthZ | FAIL/OPEN | R-006 |
| Production RLS | FAIL/OPEN | R-007 |
| Kill switches | PARTIAL | Local design E1 |
| Audit trail | PARTIAL | Local schemas E1 |
