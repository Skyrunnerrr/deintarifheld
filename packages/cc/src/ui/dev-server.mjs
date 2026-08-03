#!/usr/bin/env node
/**
 * Local/dev launcher for P3-F4 Command Center UI (loopback only).
 * Loads repo-root .env.local for DTH_* keys without logging values.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalCcServer } from './create-local-cc-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../../..');

function loadEnvLocal(env) {
  const path = join(repoRoot, '.env.local');
  if (!existsSync(path)) return { loaded: false, keysApplied: 0 };
  const text = readFileSync(path, 'utf8');
  let keysApplied = 0;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const eq = s.indexOf('=');
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Prefer explicit process env; fill missing from .env.local.
    if (env[key] == null || env[key] === '') {
      env[key] = val;
      keysApplied += 1;
    }
  }
  return { loaded: true, keysApplied };
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

const localEnv = loadEnvLocal(env);
if (!env.DTH_CC_LOCAL_UI_ENABLED) {
  env.DTH_CC_LOCAL_UI_ENABLED = 'true';
}

if ((env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('PRODUCTION_CC_UI_REJECTED');
  process.exit(1);
}

console.log(
  `ENV_LOCAL_LOADED=${localEnv.loaded ? 'YES' : 'NO'} PUBLISHABLE_KEY_SET=${
    env.DTH_CLERK_PUBLISHABLE_KEY ? 'YES' : 'NO'
  } PASSKEY_GATE=${env.DTH_CC_PASSKEY_GATE_ENABLED || 'unset'}`,
);

const server = createLocalCcServer({
  // localhost (not 127.0.0.1) — required for WebAuthn/passkey RP ID in Development
  host: 'localhost',
  port: Number(env.DTH_CC_PORT || 3100),
  opsBaseUrl: env.DTH_OPS_HTTP_URL || 'http://127.0.0.1:3099',
  env,
});

const addr = await server.listen();
console.log(`LOCAL_CC_UI listening on http://localhost:${addr.port}/auth/enroll`);
