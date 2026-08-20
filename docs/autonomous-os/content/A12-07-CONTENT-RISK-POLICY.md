# A12-07 Content Risk Policy

`ContentRiskPolicyV1`

| Class | Typical | Publication |
|---|---|---|
| LOW | supported educational process copy | E2 auto-approve only if test policy lists LOW |
| MEDIUM | review/unknown claims | APPROVAL_REQUIRED |
| HIGH | sourced process facts (`HIGH_RISK_SUPPORTED`) | APPROVAL_REQUIRED |
| BLOCKED | prohibited/unsupported/brand fail | never publishes |

Blocked never schedules. Production auto-publish policy is not frozen.
