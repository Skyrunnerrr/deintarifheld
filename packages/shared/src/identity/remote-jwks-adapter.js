/**
 * P4-H0b2a — public remote JWKS adapter (Development allowlisted endpoint only).
 * No Clerk SDK. No secret key. Fail-closed. Redirects disabled.
 */
import { jwkToPublicKeyPem } from './jwt-crypto.js';
import { validateExactDevelopmentJwksUrl } from './jwks-url-policy.js';

export const JWKS_CACHE_TTL_SECONDS = 300;
export const JWKS_TOTAL_TIMEOUT_MILLISECONDS = 5000;
export const JWKS_MAX_RESPONSE_BYTES = 262144;
export const JWKS_MAX_KEYS = 10;
export const UNKNOWN_KID_FORCED_REFRESH_COUNT = 1;
export const AUTOMATIC_RETRY_COUNT = 0;
export const STALE_JWKS_AFTER_TTL_ALLOWED = false;
export const REDIRECTS_ALLOWED = false;

/**
 * @param {object} opts
 * @param {string} opts.expectedIssuer — exact trusted issuer (injected)
 * @param {string} opts.jwksUrl — exact approved JWKS URL
 * @param {string} opts.approvedFrontendApiOrigin — exact FAPI origin for host check
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {() => number} [opts.nowMs]
 * @param {number} [opts.cacheTtlSeconds]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxResponseBytes]
 * @param {number} [opts.maxKeys]
 */
export function createRemoteJwksAdapter({
  expectedIssuer,
  jwksUrl,
  approvedFrontendApiOrigin,
  fetchImpl = globalThis.fetch,
  nowMs = () => Date.now(),
  cacheTtlSeconds = JWKS_CACHE_TTL_SECONDS,
  timeoutMs = JWKS_TOTAL_TIMEOUT_MILLISECONDS,
  maxResponseBytes = JWKS_MAX_RESPONSE_BYTES,
  maxKeys = JWKS_MAX_KEYS,
}) {
  if (!expectedIssuer || typeof expectedIssuer !== 'string') {
    throw new Error('REMOTE_JWKS_EXPECTED_ISSUER_REQUIRED');
  }
  if (!jwksUrl || !approvedFrontendApiOrigin) {
    throw new Error('REMOTE_JWKS_URL_AND_APPROVED_ORIGIN_REQUIRED');
  }
  const urlCheck = validateExactDevelopmentJwksUrl(jwksUrl, approvedFrontendApiOrigin);
  if (!urlCheck.ok) {
    throw new Error(`REMOTE_JWKS_URL_POLICY_${urlCheck.code}`);
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('REMOTE_JWKS_FETCH_IMPL_REQUIRED');
  }

  const cacheKey = `${expectedIssuer}\0${urlCheck.jwksUrl}`;
  /** @type {{ key: string, expiresAtMs: number, byKid: Map<string, object>, fetchedAtMs: number } | null} */
  let cache = null;
  let remoteCalls = 0;
  let forcedRefreshCalls = 0;

  async function fetchKeyset({ reason }) {
    remoteCalls += 1;
    if (reason === 'unknown_kid') forcedRefreshCalls += 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(urlCheck.jwksUrl, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      clearTimeout(timer);
      const name = err && err.name;
      if (name === 'AbortError') {
        return { ok: false, code: 'JWKS_NETWORK_TIMEOUT' };
      }
      // undici / fetch redirect errors vary by runtime
      const msg = String(err && err.message ? err.message : err);
      if (/redirect/i.test(msg)) {
        return { ok: false, code: 'JWKS_REDIRECT_REJECTED' };
      }
      return { ok: false, code: 'JWKS_NETWORK_FAILURE' };
    } finally {
      clearTimeout(timer);
    }

    if (response.type === 'opaqueredirect' || response.redirected) {
      return { ok: false, code: 'JWKS_REDIRECT_REJECTED' };
    }
    if (response.status !== 200) {
      return { ok: false, code: 'JWKS_HTTP_STATUS_INVALID' };
    }

    const buf = await readBoundedBody(response, maxResponseBytes);
    if (!buf.ok) return buf;

    let json;
    try {
      json = JSON.parse(buf.text);
    } catch {
      return { ok: false, code: 'JWKS_JSON_INVALID' };
    }
    const parsed = parseAndValidateJwks(json, maxKeys);
    if (!parsed.ok) return parsed;

    const expiresAtMs = nowMs() + cacheTtlSeconds * 1000;
    cache = {
      key: cacheKey,
      expiresAtMs,
      byKid: parsed.byKid,
      fetchedAtMs: nowMs(),
    };
    return { ok: true, byKid: parsed.byKid };
  }

  function getUnexpiredCache() {
    if (!cache) return null;
    if (cache.key !== cacheKey) return null;
    if (nowMs() >= cache.expiresAtMs) return null;
    return cache;
  }

  async function resolveKeysetForLookup({ forceRefresh }) {
    if (!forceRefresh) {
      const hit = getUnexpiredCache();
      if (hit) return { ok: true, byKid: hit.byKid, fromCache: true };
    }
    const fetched = await fetchKeyset({ reason: forceRefresh ? 'unknown_kid' : 'miss_or_expired' });
    if (fetched.ok) return { ok: true, byKid: fetched.byKid, fromCache: false };

    // Network failure: only unexpired cache may be used (not after TTL).
    if (!forceRefresh) {
      const hit = getUnexpiredCache();
      if (hit) return { ok: true, byKid: hit.byKid, fromCache: true, degraded: true };
    } else {
      // Forced refresh failed: fall back to unexpired cache for the re-lookup attempt
      // only if still unexpired; unknown kid path will still reject if kid absent.
      const hit = getUnexpiredCache();
      if (hit) return { ok: true, byKid: hit.byKid, fromCache: true, degraded: true, refreshFailed: true };
    }
    return fetched;
  }

  async function getKeyByKid(kid) {
    if (!kid || typeof kid !== 'string') {
      return { ok: false, code: 'TOKEN_KEY_UNKNOWN' };
    }

    let set = await resolveKeysetForLookup({ forceRefresh: false });
    if (!set.ok) {
      return { ok: false, code: set.code || 'TOKEN_KEY_UNKNOWN' };
    }

    let jwk = set.byKid.get(kid);
    if (!jwk) {
      // Exactly one forced refresh on unknown kid
      set = await resolveKeysetForLookup({ forceRefresh: true });
      if (!set.ok) {
        return { ok: false, code: set.code || 'TOKEN_KEY_UNKNOWN' };
      }
      jwk = set.byKid.get(kid);
      if (!jwk) {
        return { ok: false, code: 'TOKEN_KEY_UNKNOWN' };
      }
    }

    return materializeKey(jwk);
  }

  return {
    kind: 'REMOTE_PUBLIC_JWKS',
    expectedIssuer,
    jwksUrl: urlCheck.jwksUrl,
    cacheKey,
    get remoteCalls() {
      return remoteCalls;
    },
    get forcedRefreshCalls() {
      return forcedRefreshCalls;
    },
    get cacheExpiresAtMs() {
      return cache?.expiresAtMs ?? null;
    },
    /** test helper */
    _debugGetCache() {
      return cache;
    },
    async getKeyByKid(kid) {
      return getKeyByKid(kid);
    },
    async prefetch() {
      return resolveKeysetForLookup({ forceRefresh: false });
    },
  };
}

function materializeKey(jwk) {
  if (jwk.alg && jwk.alg !== 'RS256') {
    return { ok: false, code: 'TOKEN_ALG_UNSUPPORTED' };
  }
  try {
    const publicKeyPem = jwkToPublicKeyPem(jwk);
    return { ok: true, publicKeyPem, jwk, alg: jwk.alg || 'RS256' };
  } catch {
    return { ok: false, code: 'TOKEN_KEY_UNKNOWN' };
  }
}

/**
 * @param {Response} response
 * @param {number} maxBytes
 */
async function readBoundedBody(response, maxBytes) {
  // Prefer content-length pre-check when present
  const cl = response.headers?.get?.('content-length');
  if (cl != null && Number(cl) > maxBytes) {
    return { ok: false, code: 'JWKS_RESPONSE_OVERSIZED' };
  }

  if (typeof response.arrayBuffer === 'function') {
    const ab = await response.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      return { ok: false, code: 'JWKS_RESPONSE_OVERSIZED' };
    }
    return { ok: true, text: Buffer.from(ab).toString('utf8'), byteLength: ab.byteLength };
  }

  const text = await response.text();
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxBytes) {
    return { ok: false, code: 'JWKS_RESPONSE_OVERSIZED' };
  }
  return { ok: true, text, byteLength };
}

export function parseAndValidateJwks(json, maxKeys = JWKS_MAX_KEYS) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.keys)) {
    return { ok: false, code: 'JWKS_KEYS_ARRAY_MISSING' };
  }
  if (json.keys.length < 1) {
    return { ok: false, code: 'JWKS_KEYS_EMPTY' };
  }
  if (json.keys.length > maxKeys) {
    return { ok: false, code: 'JWKS_TOO_MANY_KEYS' };
  }

  const byKid = new Map();
  for (const k of json.keys) {
    if (!k || typeof k !== 'object') {
      return { ok: false, code: 'JWKS_MALFORMED_JWK' };
    }
    if (k.kty !== 'RSA') {
      return { ok: false, code: 'JWKS_UNSUPPORTED_KTY' };
    }
    if (k.use != null && k.use !== 'sig') {
      return { ok: false, code: 'JWKS_UNSUPPORTED_USE' };
    }
    if (k.alg != null && k.alg !== 'RS256') {
      return { ok: false, code: 'JWKS_UNSUPPORTED_ALG' };
    }
    if (!k.kid || typeof k.kid !== 'string') {
      return { ok: false, code: 'JWKS_KID_MISSING' };
    }
    if (!k.n || !k.e) {
      return { ok: false, code: 'JWKS_PUBLIC_COMPONENTS_MISSING' };
    }
    if (byKid.has(k.kid)) {
      return { ok: false, code: 'JWKS_DUPLICATE_KID' };
    }
    byKid.set(k.kid, k);
  }
  return { ok: true, byKid, keyCount: byKid.size };
}
