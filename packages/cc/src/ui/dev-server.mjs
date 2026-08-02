#!/usr/bin/env node
/**
 * Local/dev launcher for P3-F4 Command Center UI (loopback only).
 */
import { createLocalCcServer } from './create-local-cc-server.js';

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DTH_CC_LOCAL_UI_ENABLED: 'true',
};

if ((env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('PRODUCTION_CC_UI_REJECTED');
  process.exit(1);
}

const server = createLocalCcServer({
  host: '127.0.0.1',
  port: Number(process.env.DTH_CC_PORT || 3100),
  opsBaseUrl: process.env.DTH_OPS_HTTP_URL || 'http://127.0.0.1:3099',
  env,
});

const addr = await server.listen();
console.log(`LOCAL_CC_UI listening on http://${addr.host}:${addr.port}/inbox`);
