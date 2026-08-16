/**
 * A2 outbox claim helpers for BUSINESS_LEAD_ACCEPTED.
 */
import { BUSINESS_LEAD_ACCEPTED_EVENT } from '@deintarifheld/shared';

export async function claimOneSourceEvent(pool, {
  eventType = BUSINESS_LEAD_ACCEPTED_EVENT,
  workerId,
} = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE public.transactional_outbox AS o
       SET status = 'processing',
           locked_at = now(),
           attempt_count = o.attempt_count + 1,
           updated_at = now()
       FROM (
         SELECT id
         FROM public.transactional_outbox
         WHERE status = 'pending'
           AND event_type = $1
           AND available_at <= now()
         ORDER BY available_at ASC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       ) AS pick
       WHERE o.id = pick.id
       RETURNING o.*`,
      [eventType],
    );
    await client.query('COMMIT');
    const row = rows[0] || null;
    if (row && workerId) {
      row._claimed_by = workerId;
    }
    return row;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function markSourceEventProcessed(pool, id) {
  const { rowCount } = await pool.query(
    `UPDATE public.transactional_outbox
     SET status = 'processed',
         processed_at = now(),
         locked_at = NULL,
         last_error_class = NULL,
         updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [id],
  );
  return rowCount === 1;
}

export async function markSourceEventFailed(pool, id, errorClass, { retryDelayMs = 200 } = {}) {
  const { rowCount } = await pool.query(
    `UPDATE public.transactional_outbox
     SET status = 'pending',
         locked_at = NULL,
         available_at = now() + ($3::text || ' milliseconds')::interval,
         last_error_class = $2,
         updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [id, errorClass, String(retryDelayMs)],
  );
  return rowCount === 1;
}

export async function markSourceEventPermanentFailed(pool, id, errorClass) {
  const { rowCount } = await pool.query(
    `UPDATE public.transactional_outbox
     SET status = 'failed',
         locked_at = NULL,
         last_error_class = $2,
         updated_at = now()
     WHERE id = $1 AND status IN ('processing','pending')`,
    [id, errorClass],
  );
  return rowCount === 1;
}
