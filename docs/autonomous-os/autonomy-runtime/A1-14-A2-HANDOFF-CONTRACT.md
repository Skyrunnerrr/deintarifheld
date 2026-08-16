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
