/**
 * P3-F5 local outbox claim / bookkeeping adapter.
 * Consumes existing transactional_outbox schema only — no writer, no migration.
 */
import pg from 'pg';
import { SYNTHETIC_NOOP_EVENT_TYPE } from '@deintarifheld/shared';

const { Pool } = pg;

export function createLocalOutboxPool(connectionString) {
  if (!connectionString) throw new Error('LOCAL_DATABASE_URL_REQUIRED');
  if (/supabase\.co|aws\.|azure\.|gcp\./i.test(connectionString)) {
    throw new Error('REMOTE_DATABASE_URL_FORBIDDEN');
  }
  return new Pool({ connectionString, max: 2, idleTimeoutMillis: 5_000 });
}

/**
 * Atomically claim at most one pending synthetic noop row.
 */
export async function claimOneSyntheticNoop(pool, { eventType = SYNTHETIC_NOOP_EVENT_TYPE } = {}) {
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
       RETURNING o.id, o.event_type, o.aggregate_type, o.aggregate_id,
                 o.payload_redacted, o.idempotency_key, o.status,
                 o.attempt_count, o.correlation_id, o.locked_at`,
      [eventType],
    );
    await client.query('COMMIT');
    return rows[0] || null;
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

export async function markOutboxProcessed(pool, id) {
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

export async function markOutboxFailed(pool, id, errorClass) {
  const { rowCount } = await pool.query(
    `UPDATE public.transactional_outbox
     SET status = 'failed',
         locked_at = NULL,
         last_error_class = $2,
         updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [id, errorClass],
  );
  return rowCount === 1;
}
