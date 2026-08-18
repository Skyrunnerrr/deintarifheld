/**
 * Local/dev Command Center HTTP server — loopback only, fail-closed in production.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderShell, renderStateBlock, countMutationControls } from './render.js';
import { renderPasskeyGatePage } from './render-passkey-gate.js';
import {
  validateLiveProviderSession,
  readAuthorizationHeader,
} from '../auth/live-session-validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DEV_FAPI = 'https://sterling-husky-22.clerk.accounts.dev';

function isProduction(env) {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

function viewFromPath(pathname) {
  if (pathname === '/' || pathname === '/overview') return 'overview';
  if (pathname === '/inbox') return 'inbox';
  if (pathname === '/vorgaenge' || pathname === '/cases') return 'cases';
  if (pathname === '/freigaben' || pathname === '/approvals') return 'approvals';
  if (pathname === '/aufgaben' || pathname === '/tasks') return 'tasks';
  if (pathname === '/workflows') return 'workflows';
  if (pathname === '/kunden' || pathname === '/lifecycle') return 'lifecycle';
  if (pathname === '/steuerung' || pathname === '/controls') return 'controls';
  if (pathname === '/audit') return 'audit';
  return null;
}

function authModeFromPath(pathname) {
  if (pathname === '/auth' || pathname === '/auth/') return 'hub';
  if (pathname === '/auth/enroll') return 'enroll';
  if (pathname === '/auth/signin') return 'signin';
  if (pathname === '/auth/entry') return 'entry';
  return null;
}

function passkeyGateEnabled(env) {
  return String(env.DTH_CC_PASSKEY_GATE_ENABLED || '').toLowerCase() === 'true';
}

export function createLocalCcServer({
  host = 'localhost',
  port = 3100,
  opsBaseUrl = 'http://127.0.0.1:3099',
  env = process.env,
} = {}) {
  if (isProduction(env)) {
    return {
      ok: false,
      code: 'PRODUCTION_CC_UI_REJECTED',
      listen() {
        throw new Error('PRODUCTION_CC_UI_REJECTED');
      },
      close: async () => {},
    };
  }
  if (env.DTH_CC_LOCAL_UI_ENABLED !== 'true' && (env.NODE_ENV || '').toLowerCase() !== 'test') {
    return {
      ok: false,
      code: 'LOCAL_CC_UI_DISABLED',
      listen() {
        throw new Error('LOCAL_CC_UI_DISABLED');
      },
      close: async () => {},
    };
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('LOOPBACK_BIND_REQUIRED');
  }

  const clientJs = readFileSync(join(__dirname, 'cc-client.js'), 'utf8');
  const passkeyGateClientJs = readFileSync(join(__dirname, 'passkey-gate-client.js'), 'utf8');
  const fapiUrl = String(env.DTH_CLERK_FAPI_URL || DEFAULT_DEV_FAPI).replace(/\/$/, '');
  const publishableKey = String(env.DTH_CLERK_PUBLISHABLE_KEY || '');
  const publishableKeyConfigured = publishableKey.length > 0;
  const gateOn = passkeyGateEnabled(env);

  function writeGatePage(res, mode) {
    const html = renderPasskeyGatePage({
      mode,
      publishableKey,
      fapiUrl,
      publishableKeyConfigured,
    });
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-dth-cc-mode': 'passkey-gate-local',
      'x-dth-passkey-gate': 'required',
    });
    res.end(html);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`);

    // P4-H0b2b — same-origin live session validation (POST only). Never log Authorization.
    if (url.pathname === '/auth/validate-provider-session') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json', allow: 'POST' });
        res.end(JSON.stringify({ ok: false, code: 'VALIDATE_POST_ONLY' }));
        return;
      }
      try {
        const result = await validateLiveProviderSession({
          authorizationHeader: readAuthorizationHeader(req),
        });
        const status =
          result.liveProviderAuthentication === 'PASS' && result.dthAuthorization === 'DENIED_EXPECTED'
            ? 200
            : result.code === 'MISSING_AUTHORIZATION' || result.code === 'AUTHORIZATION_SCHEME_REJECTED'
              ? 401
              : 401;
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-dth-h0b2b': 'live-session-validate',
        });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: false,
            liveProviderAuthentication: 'FAIL',
            code: 'VALIDATOR_INTERNAL_ERROR',
            dthAuthorization: 'DENIED',
            tokenBodyPresent: false,
            rawClaimsPresent: false,
            operationalApiAccessAllowed: false,
            operationalWritesAllowed: false,
          }),
        );
      }
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, code: 'CC_UI_GET_ONLY' }));
      return;
    }

    if (url.pathname === '/assets/cc-client.js') {
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(clientJs);
      return;
    }

    if (url.pathname === '/assets/passkey-gate-client.js') {
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(passkeyGateClientJs);
      return;
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          app: 'dth-cc-local',
          mode: gateOn ? 'passkey-gate-local' : 'read-only',
          passkeyGateEnabled: gateOn,
          publishableKeyConfigured,
          UI_MUTATION_CONTROLS_RENDERED: 0,
          OPERATIONAL_WRITES: false,
        }),
      );
      return;
    }

    const authMode = authModeFromPath(url.pathname);
    if (authMode) {
      writeGatePage(res, authMode);
      return;
    }

    const view = viewFromPath(url.pathname);
    if (!view) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="de"><body><h1>Nicht gefunden</h1></body></html>');
      return;
    }

    // When passkey gate is enabled, operational CC views are not served.
    // Client must complete explicit passkey verification via /auth/entry.
    if (gateOn) {
      writeGatePage(res, 'protected');
      return;
    }

    const html = renderShell({
      activeView: view,
      sessionLabel: 'Synthetische lokale Owner-Person (wird beim Laden geprüft)',
      connectionState: 'pending',
      connectionText: 'Ops-API: Prüfung…',
      mainHtml: renderStateBlock('loading', 'Bitte warten…'),
      opsBaseUrl,
    });

    if (countMutationControls(html) !== 0) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, code: 'MUTATION_CONTROL_LEAK' }));
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
      'x-dth-cc-mode': 'operator-local-e2',
    });
    res.end(html);
  });

  return {
    ok: true,
    host,
    port,
    server,
    passkeyGateEnabled: gateOn,
    publishableKeyConfigured,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve({ host, port }));
      });
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
