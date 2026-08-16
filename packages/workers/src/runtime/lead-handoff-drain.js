/**
 * Drain BUSINESS_LEAD_ACCEPTED source events into Case+Workflow via A2 handoff.
 */
import { processOneBusinessLeadHandoff } from '@deintarifheld/db';

export async function drainLeadHandoffs(pool, {
  maxEmpty = 5,
  maxIterations = 500,
  failureInjector = null,
} = {}) {
  let empty = 0;
  const stats = {
    iterations: 0,
    processed: 0,
    blocked: 0,
    failed: 0,
    retained: 0,
  };

  while (empty < maxEmpty && stats.iterations < maxIterations) {
    stats.iterations += 1;
    const r = await processOneBusinessLeadHandoff(pool, { failureInjector });
    if (r.code === 'NO_ELIGIBLE_EVENT') {
      empty += 1;
      continue;
    }
    empty = 0;
    if (r.processed) stats.processed += 1;
    else if (r.retainEvent || r.code === 'CONTROL_BLOCKED') stats.retained += 1;
    else if (!r.ok) stats.failed += 1;
  }
  return stats;
}
