/**
 * Local/dev Postgres client factory for disposable Supabase stack only.
 * PRODUCTION_PERSISTENCE_READY=NO
 */
import pg from 'pg';

const { Pool } = pg;

export function createLocalDbPool(connectionString) {
  if (!connectionString) {
    throw new Error('LOCAL_DATABASE_URL_REQUIRED');
  }
  // Refuse obvious remote hosts (fail-closed)
  if (/supabase\.co|aws\.|azure\.|gcp\./i.test(connectionString)) {
    throw new Error('REMOTE_DATABASE_URL_FORBIDDEN');
  }
  return new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 5_000,
  });
}

export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  } finally {
    client.release();
  }
}
