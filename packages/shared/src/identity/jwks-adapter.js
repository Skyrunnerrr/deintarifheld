/**
 * JWKS provider interface + static in-memory adapter.
 * REMOTE_JWKS_CALLS must remain 0 — no HTTP.
 */
import { jwkToPublicKeyPem } from './jwt-crypto.js';

export function createStaticJwksAdapter(jwks) {
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const byKid = new Map();
  for (const k of keys) {
    if (k && k.kid) byKid.set(k.kid, k);
  }
  return {
    kind: 'STATIC_IN_MEMORY_JWKS',
    remoteCalls: 0,
    async getKeyByKid(kid) {
      if (!kid || !byKid.has(kid)) {
        return { ok: false, code: 'TOKEN_KEY_UNKNOWN' };
      }
      const jwk = byKid.get(kid);
      if (jwk.alg && jwk.alg !== 'RS256') {
        return { ok: false, code: 'TOKEN_ALG_UNSUPPORTED' };
      }
      try {
        const publicKeyPem = jwkToPublicKeyPem(jwk);
        return { ok: true, publicKeyPem, jwk, alg: jwk.alg || 'RS256' };
      } catch {
        return { ok: false, code: 'TOKEN_KEY_UNKNOWN' };
      }
    },
  };
}
