/**
 * P3-F4 minimal local/dev HTTP read adapter for /ops/v1.
 * - Loopback bind only
 * - Fail-closed in production
 * - GET reads only (F3 write paths not exposed)
 * - Person session required via Authorization: DTH-Local <base64url(json)>
 */

import http from 'node:http';
import { URL } from 'node:url';
import { authenticateLocalOwner } from '../auth/local-owner-auth.js';
import { INTERNAL_BFF_PREFIX } from './constants.js';

const READ_PATH_ALLOW = new Set([
  `${INTERNAL_BFF_PREFIX}/inbox`,
  `${INTERNAL_BFF_PREFIX}/cases`,
  `${INTERNAL_BFF_PREFIX}/case-notes`,
  `${INTERNAL_BFF_PREFIX}/tasks`,
  `${INTERNAL_BFF_PREFIX}/reminders`,
  `${INTERNAL_BFF_PREFIX}/assignments`,
  `${INTERNAL_BFF_PREFIX}/status-history`,
  `${INTERNAL_BFF_PREFIX}/communication-events`,
  `${INTERNAL_BFF_PREFIX}/dev/session`,
  `${INTERNAL_BFF_PREFIX}/dev/health`,
]);

function isProduction(env) {
  return (env.NODE_ENV || '').toLowerCase() === 'production';
}

function adapterAllowed(env) {
  if (isProduction(env)) return false;
  return (
    env.DTH_OPS_HTTP_ADAPTER_ENABLED === 'true' ||
    (env.NODE_ENV || '').toLowerCase() === 'test'
  );
}

function decodeLocalAuth(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const m = headerValue.match(/^DTH-Local\s+(\S+)$/i);
  if (!m) return null;
  try {
    const json = Buffer.from(m[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed?.principal || !parsed?.session) return null;
    return { principal: parsed.principal, session: parsed.session };
  } catch {
    return null;
  }
}

export function encodeLocalAuthToken({ principal, session }) {
  return Buffer.from(JSON.stringify({ principal, session }), 'utf8').toString('base64url');
}

function isReadPath(pathname) {
  if (READ_PATH_ALLOW.has(pathname)) return true;
  if (/^\/ops\/v1\/cases\/[^/]+$/.test(pathname)) return true;
  if (/^\/ops\/v1\/cases\/[^/]+\/detail$/.test(pathname)) return true;
  if (/^\/ops\/v1\/tasks\/[^/]+\/detail$/.test(pathname)) return true;
  return false;
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-dth-ops-adapter': 'local-dev-read-only',
    ...extraHeaders,
  });
  res.end(payload);
}

/**
 * @param {{ bff: { dispatch: Function }, host?: string, port?: number, env?: NodeJS.ProcessEnv, corsOrigin?: string }} opts
 */
export function createLocalOpsHttpReadAdapter({
  bff,
  host = '127.0.0.1',
  port = 3099,
  env = process.env,
  corsOrigin = 'http://localhost:3100',
} = {}) {
  if (isProduction(env)) {
    return {
      ok: false,
      code: 'PRODUCTION_HTTP_ADAPTER_REJECTED',
      PRODUCTION_HTTP_ADAPTER: 'REJECTED',
      listen() {
        throw new Error('PRODUCTION_HTTP_ADAPTER_REJECTED');
      },
      close: async () => {},
    };
  }
  if (!adapterAllowed(env)) {
    return {
      ok: false,
      code: 'LOCAL_HTTP_ADAPTER_DISABLED',
      LOCAL_HTTP_READ_ADAPTER: 'DISABLED',
      listen() {
        throw new Error('LOCAL_HTTP_ADAPTER_DISABLED');
      },
      close: async () => {},
    };
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('LOOPBACK_BIND_REQUIRED');
  }

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const corsHeaders = {};
    if (origin && (origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://localhost:'))) {
      if (!corsOrigin || origin === corsOrigin || origin.startsWith('http://127.0.0.1:')) {
        corsHeaders['access-control-allow-origin'] = origin;
        corsHeaders['access-control-allow-headers'] = 'authorization, content-type';
        corsHeaders['access-control-allow-methods'] = 'GET, OPTIONS';
        corsHeaders.vary = 'Origin';
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(
        res,
        405,
        {
          ok: false,
          code: 'HTTP_WRITE_OR_NON_GET_REJECTED',
          HTTP_WRITE_ROUTES_EXPOSED: 0,
        },
        corsHeaders,
      );
      return;
    }

    const url = new URL(req.url || '/', `http://${host}:${port}`);
    const pathname = url.pathname;

    if (!pathname.startsWith(INTERNAL_BFF_PREFIX)) {
      sendJson(res, 404, { ok: false, code: 'NOT_INTERNAL_OPS_NAMESPACE' }, corsHeaders);
      return;
    }

    if (!isReadPath(pathname)) {
      sendJson(
        res,
        404,
        { ok: false, code: 'READ_ROUTE_NOT_EXPOSED', path: pathname },
        corsHeaders,
      );
      return;
    }

    // Local session bootstrap — AuthN only, not an F3 limited-write surface
    if (pathname === `${INTERNAL_BFF_PREFIX}/dev/session`) {
      const auth = authenticateLocalOwner({ env });
      if (!auth.ok) {
        sendJson(res, 401, { ok: false, ...auth }, corsHeaders);
        return;
      }
      const token = encodeLocalAuthToken({
        principal: auth.principal,
        session: auth.session,
      });
      sendJson(
        res,
        200,
        {
          ok: true,
          token,
          principal: auth.principal,
          session: auth.session,
          LOCAL_DEV_ONLY: true,
        },
        corsHeaders,
      );
      return;
    }

    if (pathname === `${INTERNAL_BFF_PREFIX}/dev/health`) {
      sendJson(
        res,
        200,
        {
          ok: true,
          adapter: 'local-dev-read-only',
          namespace: INTERNAL_BFF_PREFIX,
          HTTP_WRITE_ROUTES_EXPOSED: 0,
        },
        corsHeaders,
      );
      return;
    }

    if (req.headers['x-dth-shared-secret-context'] === 'true') {
      sendJson(
        res,
        401,
        { ok: false, code: 'SHARED_SECRET_CC_PATH_REJECTED' },
        corsHeaders,
      );
      return;
    }

    const decoded = decodeLocalAuth(req.headers.authorization);
    if (!decoded) {
      sendJson(res, 401, { ok: false, code: 'CC_PERSON_SESSION_REQUIRED' }, corsHeaders);
      return;
    }

    const query = Object.fromEntries(url.searchParams.entries());
    const result = await bff.dispatch({
      method: 'GET',
      path: pathname,
      query,
      principal: decoded.principal,
      session: decoded.session,
      sharedSecretContext: false,
    });
    sendJson(res, result.status || 500, result.body || { ok: false }, corsHeaders);
  });

  return {
    ok: true,
    LOCAL_HTTP_READ_ADAPTER: 'PASS',
    PRODUCTION_HTTP_ADAPTER: 'REJECTED',
    HTTP_WRITE_ROUTES_EXPOSED: 0,
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
