/**
 * Local/dev Command Center HTTP server — loopback only, fail-closed in production.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderShell, renderStateBlock, countMutationControls } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function isProduction(env) {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

function viewFromPath(pathname) {
  if (pathname === '/' || pathname === '/inbox') return 'inbox';
  if (pathname === '/vorgaenge' || pathname === '/cases') return 'cases';
  if (pathname === '/aufgaben' || pathname === '/tasks') return 'tasks';
  return null;
}

export function createLocalCcServer({
  host = '127.0.0.1',
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

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
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

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          app: 'dth-cc-local',
          mode: 'read-only',
          UI_MUTATION_CONTROLS_RENDERED: 0,
        }),
      );
      return;
    }

    const view = viewFromPath(url.pathname);
    if (!view) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="de"><body><h1>Nicht gefunden</h1></body></html>');
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
      'cache-control': 'no-store',
      'x-dth-cc-mode': 'read-only-local',
    });
    res.end(html);
  });

  return {
    ok: true,
    host,
    port,
    server,
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
