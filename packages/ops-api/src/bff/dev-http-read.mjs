#!/usr/bin/env node
/**
 * Local/dev launcher for P3-F4 HTTP read adapter (loopback only).
 */
import { createOpsBff, createLocalOpsHttpReadAdapter } from '../index.js';

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DTH_OPS_HTTP_ADAPTER_ENABLED: 'true',
  DTH_LOCAL_AUTH_ENABLED: process.env.DTH_LOCAL_AUTH_ENABLED || 'true',
};

if ((env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('PRODUCTION_HTTP_ADAPTER_REJECTED');
  process.exit(1);
}

const databaseUrl = process.env.DTH_LOCAL_DATABASE_URL;
if (!databaseUrl) {
  console.error('DTH_LOCAL_DATABASE_URL required');
  process.exit(1);
}

const bff = createOpsBff({ databaseUrl });
const adapter = createLocalOpsHttpReadAdapter({
  bff,
  host: '127.0.0.1',
  port: Number(process.env.DTH_OPS_HTTP_PORT || 3099),
  env,
});

const addr = await adapter.listen();
console.log(`LOCAL_HTTP_READ_ADAPTER listening on http://${addr.host}:${addr.port}/ops/v1`);

async function shutdown() {
  await adapter.close();
  await bff.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
