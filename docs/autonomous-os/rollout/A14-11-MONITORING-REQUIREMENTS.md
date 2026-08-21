# A14-11 Monitoring Requirements

Implement only when needed for staging/canary. No fake heartbeat.

## Must cover

- Job failures / DLQ
- Unknown provider outcomes
- Provider auth failures / rate limits
- Kill state / takeovers
- Stale approvals
- Switch mismatches
- Renewal failures
- Content publish failures
- Campaign spend anomalies
- Operator command failures
- Private-schema / privilege alarms (critical)

## Alerting

Severity-based. Critical: duplicate external-effect risk, wrong provider mismatch, unexpected spend, AuthZ failure, privilege exposure, kill control unavailable.

## Ownership

On-call/operator, incident channel, provider contacts, credential/billing ownership — **OWNER_REQUIRED** before canary.
