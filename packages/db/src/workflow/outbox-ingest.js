/**
 * Synthetic outbox → workflow ingestion (idempotent).
 * Does not replace transactional_outbox; converts eligible synthetic events to jobs.
 *
 * OUTBOX = durable domain/event handoff
 * WORKFLOW = durable orchestration state
 * JOB = durable executable unit
 */
import { SYNTHETIC_NOOP_EVENT_TYPE } from '@deintarifheld/shared';
import { startWorkflowIdempotent } from './instances.js';

export const A1_SYNTHETIC_OUTBOX_EVENT = 'DTH_A1_SYNTHETIC_WORKFLOW_START';

/**
 * Ingest one outbox-shaped event into a workflow+job.
 * Duplicate idempotency_key / correlation → one logical workflow.
 */
export async function ingestSyntheticOutboxEvent(pool, event) {
  const eventType = event.event_type || event.eventType;
  const allowed =
    eventType === A1_SYNTHETIC_OUTBOX_EVENT || eventType === SYNTHETIC_NOOP_EVENT_TYPE;
  if (!allowed) {
    return { ok: false, code: 'EVENT_TYPE_NOT_AUTHORIZED_FOR_A1_INGEST' };
  }

  const aggregateType = event.aggregate_type || event.aggregateType || 'synthetic';
  const aggregateId = String(event.aggregate_id || event.aggregateId);
  const correlationId = String(event.correlation_id || event.correlationId);
  const idempotencyKey = String(event.idempotency_key || event.idempotencyKey);

  const result = await startWorkflowIdempotent(pool, {
    aggregateType,
    aggregateId,
    correlationId,
    jobType: 'SYNTHETIC_NOOP',
    jobIdempotencyKey: `outbox:${idempotencyKey}`,
    payloadRedacted: event.payload_redacted || event.payloadRedacted || {},
    metadataRedacted: { source: 'outbox_ingest', event_type: eventType },
  });

  return {
    ok: true,
    code: result.duplicate ? 'IDEMPOTENT_REPLAY' : 'INGESTED',
    ...result,
  };
}
