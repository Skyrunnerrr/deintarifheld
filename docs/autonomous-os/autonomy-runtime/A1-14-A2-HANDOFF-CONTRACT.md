# A2 Handoff Contract

```js
import { enqueueLeadAcceptedWorkflowStart } from '@deintarifheld/db';

await enqueueLeadAcceptedWorkflowStart(pool, {
  leadId,
  correlationId,
  caseId,       // optional
  scheduledAt,  // optional
});
```

Idempotent on `(workflow_type=LEAD_TO_CASE, aggregate leadId, correlationId)` + job idempotency key `lead-accepted:{leadId}:{correlationId}`.

A2 owns real Lead→Case business transitions; A1 only provides the durable start surface.

A4 reuses the same A1 job surface for `B2B_MISSING_INFO_COMMUNICATE`, `B2B_COMMUNICATION_SEND`, `B2B_MISSING_INFO_FOLLOWUP_DUE`, and `B2B_INBOUND_EMAIL_PROCESS`. No second queue.
