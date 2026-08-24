/**
 * Distinguish pg.Pool from pg.PoolClient for transaction propagation (M11K).
 */
/**
 * pg.Pool exposes connect(); pg.PoolClient exposes connect() AND release().
 */
export function isPgPool(poolOrClient) {
  return (
    poolOrClient != null &&
    typeof poolOrClient.connect === 'function' &&
    typeof poolOrClient.release !== 'function'
  );
}

/**
 * Run fn(client). Opens a transaction only when given a Pool.
 */
export async function withOptionalTransaction(poolOrClient, fn) {
  if (!isPgPool(poolOrClient)) {
    return fn(poolOrClient);
  }
  const client = await poolOrClient.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
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
