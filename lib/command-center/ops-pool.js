/**
 * Staging Ops DB pool — separate from local-only createLocalDbPool.
 * M11P auth transport may run before dth_ops_api wiring; returns null when unset.
 */
import pg from 'pg';

const PRODUCTION_DB_REF = 'ylvczlldcgaxyadlawtb';

export function createHostedOpsPool(env = process.env) {
  const url = String(env.DTH_STAGING_OPS_DATABASE_URL || '').trim();
  if (!url) return null;
  if (/ylvczlldcgaxyadlawtb/.test(url)) {
    throw new Error('PRODUCTION_DB_URL_FORBIDDEN');
  }
  return new pg.Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 10_000,
  });
}
