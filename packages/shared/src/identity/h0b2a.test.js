/**
 * P4-H0b2a gates — remote JWKS policy/cache without real Clerk user/token.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  deriveDevelopmentJwksEndpoints,
  validateExactDevelopmentJwksUrl,
} from './jwks-url-policy.js';
import {
  createRemoteJwksAdapter,
  parseAndValidateJwks,
  JWKS_CACHE_TTL_SECONDS,
  JWKS_TOTAL_TIMEOUT_MILLISECONDS,
  JWKS_MAX_RESPONSE_BYTES,
  JWKS_MAX_KEYS,
  AUTOMATIC_RETRY_COUNT,
  UNKNOWN_KID_FORCED_REFRESH_COUNT,
  STALE_JWKS_AFTER_TTL_ALLOWED,
  REDIRECTS_ALLOWED,
} from './remote-jwks-adapter.js';
import { publicKeyPemToJwk, signRs256Jwt } from './jwt-crypto.js';
import { validateProviderToken } from './token-validator.js';
import { authenticateProviderTokenToPersonPrincipal } from './authenticate-provider-token.js';
import { createInMemoryPersonMappingAdapter } from './person-mapping.js';
import { createInMemoryActiveSessionAdapter } from './session-policy.js';
import {
  EXPECTED_AUDIENCE,
  AUTHORIZED_PARTY_ALLOWLIST,
  DEVELOPMENT_AUTHORIZED_PARTY,
  EXPECTED_AUTHORIZED_PARTY,
  IdentityProvider,
  LinkStatus,
  AuthAssuranceMethod,
  PRODUCTION_AUDIENCE_VALUE_DEFINED,
  AUTHORIZED_PARTY_WILDCARDS_ALLOWED,
} from './h0a-constants.js';

const FAPI = 'https://clerk-dev-example.clerk.accounts.dev';
const JWKS = `${FAPI}/.well-known/jwks.json`;
const FIXED_NOW = 1_700_000_000;

function makeRsaJwk(kid = 'kid-1') {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    jwk: publicKeyPemToJwk(publicKey, kid, 'RS256'),
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    kid,
  };
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: false,
    type: 'basic',
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        const map = Object.fromEntries(
          Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
        );
        return map[key] ?? null;
      },
    },
    async text() {
      return text;
    },
    async arrayBuffer() {
      return Buffer.from(text, 'utf8');
    },
  };
}

describe('P4-H0b2a constants', () => {
  it('EXPECTED_AUDIENCE_AND_AZP_ALLOWLIST', () => {
    assert.equal(EXPECTED_AUDIENCE, 'urn:deintarifheld:ops-api');
    assert.equal(PRODUCTION_AUDIENCE_VALUE_DEFINED, true);
    assert.equal(DEVELOPMENT_AUTHORIZED_PARTY, 'http://127.0.0.1:3100');
    assert.deepEqual([...AUTHORIZED_PARTY_ALLOWLIST], [
      'http://127.0.0.1:3100',
      'https://cc.deintarifheld.de',
    ]);
    assert.equal(AUTHORIZED_PARTY_WILDCARDS_ALLOWED, false);
    assert.equal(JWKS_CACHE_TTL_SECONDS, 300);
    assert.equal(JWKS_TOTAL_TIMEOUT_MILLISECONDS, 5000);
    assert.equal(JWKS_MAX_RESPONSE_BYTES, 262144);
    assert.equal(JWKS_MAX_KEYS, 10);
    assert.equal(AUTOMATIC_RETRY_COUNT, 0);
    assert.equal(UNKNOWN_KID_FORCED_REFRESH_COUNT, 1);
    assert.equal(STALE_JWKS_AFTER_TTL_ALLOWED, false);
    assert.equal(REDIRECTS_ALLOWED, false);
  });
});

describe('P4-H0b2a JWKS URL policy', () => {
  it('REMOTE_JWKS_ENDPOINT_HTTPS_ONLY / EXACT_HOST / EXACT_PATH', () => {
    const d = deriveDevelopmentJwksEndpoints(FAPI);
    assert.equal(d.ok, true);
    assert.equal(d.jwksUrl, JWKS);
    assert.equal(d.issuer, FAPI);
    const v = validateExactDevelopmentJwksUrl(d.jwksUrl, d.frontendApiOrigin);
    assert.equal(v.ok, true);
  });

  it('NON_HTTPS_JWKS_URL_REJECTED', () => {
    const d = deriveDevelopmentJwksEndpoints('http://evil.example');
    assert.equal(d.ok, false);
    assert.equal(d.code, 'JWKS_URL_NON_HTTPS');
  });

  it('HOST_MISMATCH_REJECTED', () => {
    const v = validateExactDevelopmentJwksUrl(
      'https://evil.example/.well-known/jwks.json',
      FAPI,
    );
    assert.equal(v.ok, false);
    assert.equal(v.code, 'JWKS_URL_HOST_MISMATCH');
  });

  it('QUERY_OR_FRAGMENT_REJECTED', () => {
    assert.equal(
      validateExactDevelopmentJwksUrl(`${JWKS}?x=1`, FAPI).code,
      'JWKS_URL_QUERY_OR_FRAGMENT',
    );
    assert.equal(
      validateExactDevelopmentJwksUrl(`${JWKS}#x`, FAPI).code,
      'JWKS_URL_QUERY_OR_FRAGMENT',
    );
  });

  it('IP_LITERAL_AND_CREDENTIALS_REJECTED', () => {
    assert.equal(
      deriveDevelopmentJwksEndpoints('https://127.0.0.1').code,
      'JWKS_URL_IP_LITERAL_HOST',
    );
    assert.equal(
      deriveDevelopmentJwksEndpoints('https://user:pass@clerk.example').code,
      'JWKS_URL_EMBEDDED_CREDENTIALS',
    );
  });
});

describe('P4-H0b2a JWKS schema', () => {
  it('REMOTE_JWKS_SCHEMA_VALID / RSA / DUPLICATE_KID', () => {
    const a = makeRsaJwk('a');
    const b = makeRsaJwk('b');
    const ok = parseAndValidateJwks({ keys: [a.jwk, b.jwk] });
    assert.equal(ok.ok, true);
    assert.equal(ok.keyCount, 2);

    const dup = parseAndValidateJwks({ keys: [a.jwk, { ...b.jwk, kid: 'a' }] });
    assert.equal(dup.ok, false);
    assert.equal(dup.code, 'JWKS_DUPLICATE_KID');

    const badAlg = parseAndValidateJwks({ keys: [{ ...a.jwk, alg: 'ES256' }] });
    assert.equal(badAlg.code, 'JWKS_UNSUPPORTED_ALG');

    const tooMany = parseAndValidateJwks({
      keys: Array.from({ length: 11 }, (_, i) => makeRsaJwk(`k${i}`).jwk),
    });
    assert.equal(tooMany.code, 'JWKS_TOO_MANY_KEYS');
  });
});

describe('P4-H0b2a remote adapter cache and network', () => {
  it('UNEXPIRED_CACHE_USED and HTTP_200 path', async () => {
    const { jwk } = makeRsaJwk('kid-1');
    let calls = 0;
    const fetchImpl = async (url, init) => {
      calls += 1;
      assert.equal(url, JWKS);
      assert.equal(init.redirect, 'error');
      return jsonResponse({ keys: [jwk] });
    };
    let now = 1_000_000;
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl,
      nowMs: () => now,
    });
    const r1 = await adapter.getKeyByKid('kid-1');
    assert.equal(r1.ok, true);
    const r2 = await adapter.getKeyByKid('kid-1');
    assert.equal(r2.ok, true);
    assert.equal(calls, 1);
    assert.equal(adapter.remoteCalls, 1);
  });

  it('CACHE_EXPIRY_REQUIRES_REFRESH / EXPIRED_STALE_CACHE_REJECTED on failure', async () => {
    const { jwk } = makeRsaJwk('kid-1');
    let calls = 0;
    let fail = false;
    const fetchImpl = async () => {
      calls += 1;
      if (fail) throw new Error('network down');
      return jsonResponse({ keys: [jwk] });
    };
    let now = 1_000_000;
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl,
      nowMs: () => now,
      cacheTtlSeconds: 300,
    });
    assert.equal((await adapter.getKeyByKid('kid-1')).ok, true);
    now += 301_000;
    fail = true;
    const r = await adapter.getKeyByKid('kid-1');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'JWKS_NETWORK_FAILURE');
    assert.ok(calls >= 2);
  });

  it('UNKNOWN_KID_FORCES_ONE_REFRESH then reject', async () => {
    const { jwk } = makeRsaJwk('kid-1');
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse({ keys: [jwk] });
    };
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl,
      nowMs: () => 1_000_000,
    });
    assert.equal((await adapter.getKeyByKid('kid-1')).ok, true);
    assert.equal(calls, 1);
    const unknown = await adapter.getKeyByKid('missing');
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, 'TOKEN_KEY_UNKNOWN');
    assert.equal(calls, 2);
    assert.equal(adapter.forcedRefreshCalls, 1);
  });

  it('NETWORK_FAILURE_WITHOUT_CACHE_REJECTED', async () => {
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl: async () => {
        throw new Error('boom');
      },
      nowMs: () => 1,
    });
    const r = await adapter.getKeyByKid('x');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'JWKS_NETWORK_FAILURE');
  });

  it('NETWORK_FAILURE_WITH_UNEXPIRED_CACHE', async () => {
    const { jwk } = makeRsaJwk('kid-1');
    let fail = false;
    const fetchImpl = async () => {
      if (fail) throw new Error('boom');
      return jsonResponse({ keys: [jwk] });
    };
    let now = 1_000_000;
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl,
      nowMs: () => now,
    });
    assert.equal((await adapter.getKeyByKid('kid-1')).ok, true);
    fail = true;
    // Unknown kid forces one refresh; network fails; unexpired cache retained for known kid.
    assert.equal((await adapter.getKeyByKid('missing')).ok, false);
    const still = await adapter.getKeyByKid('kid-1');
    assert.equal(still.ok, true);
  });

  it('REDIRECT_RESPONSE_REJECTED', async () => {
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl: async () => {
        throw new Error('unexpected redirect');
      },
      nowMs: () => 1,
    });
    const r = await adapter.getKeyByKid('x');
    assert.equal(r.code, 'JWKS_REDIRECT_REJECTED');
  });

  it('OVERSIZED_RESPONSE_REJECTED', async () => {
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      maxResponseBytes: 32,
      fetchImpl: async () => jsonResponse({ keys: [makeRsaJwk().jwk] }),
      nowMs: () => 1,
    });
    const r = await adapter.getKeyByKid('x');
    assert.equal(r.code, 'JWKS_RESPONSE_OVERSIZED');
  });

  it('NO_RETRY_LOOP', async () => {
    let calls = 0;
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('fail');
      },
      nowMs: () => 1,
    });
    await adapter.getKeyByKid('x');
    assert.equal(calls, 1);
    assert.equal(AUTOMATIC_RETRY_COUNT, 0);
  });

  it('MALFORMED_JWK_REJECTED', async () => {
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl: async () => jsonResponse({ keys: [{ kty: 'RSA', kid: 'x' }] }),
      nowMs: () => 1,
    });
    const r = await adapter.getKeyByKid('x');
    assert.equal(r.code, 'JWKS_PUBLIC_COMPONENTS_MISSING');
  });
});

describe('P4-H0b2a claim validation with remote JWKS', () => {
  async function setup() {
    const pair = makeRsaJwk('live-kid');
    const fetchImpl = async () => jsonResponse({ keys: [pair.jwk] });
    const adapter = createRemoteJwksAdapter({
      expectedIssuer: FAPI,
      jwksUrl: JWKS,
      approvedFrontendApiOrigin: FAPI,
      fetchImpl,
      nowMs: () => FIXED_NOW * 1000,
    });
    function mint(claims = {}, azp = DEVELOPMENT_AUTHORIZED_PARTY) {
      return signRs256Jwt({
        header: { alg: 'RS256', typ: 'JWT', kid: pair.kid },
        payload: {
          iss: FAPI,
          sub: 'user_real_shape_but_unmapped',
          aud: EXPECTED_AUDIENCE,
          azp,
          iat: FIXED_NOW,
          nbf: FIXED_NOW,
          exp: FIXED_NOW + 600,
          sid: 'sess_1',
          amr: AuthAssuranceMethod.PASSKEY,
          ...claims,
        },
        privateKeyPem: pair.privateKeyPem,
      });
    }
    return { adapter, mint, pair };
  }

  it('EXPECTED_AUDIENCE_ACCEPTED / AUTHORIZED_PARTY local and production', async () => {
    const { adapter, mint } = await setup();
    const okLocal = await validateProviderToken({
      token: mint(),
      jwksAdapter: adapter,
      expectedIssuer: FAPI,
      expectedAudience: EXPECTED_AUDIENCE,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(okLocal.ok, true);

    const okProd = await validateProviderToken({
      token: mint({}, EXPECTED_AUTHORIZED_PARTY),
      jwksAdapter: adapter,
      expectedIssuer: FAPI,
      expectedAudience: EXPECTED_AUDIENCE,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(okProd.ok, true);
  });

  it('MISSING_AND_WRONG_AUD_AZP_AND_UNKNOWN_SUBJECT', async () => {
    const { adapter, mint, pair } = await setup();

    const noAud = signRs256Jwt({
      header: { alg: 'RS256', typ: 'JWT', kid: pair.kid },
      payload: {
        iss: FAPI,
        sub: 'u',
        azp: DEVELOPMENT_AUTHORIZED_PARTY,
        iat: FIXED_NOW,
        nbf: FIXED_NOW,
        exp: FIXED_NOW + 600,
        sid: 's',
      },
      privateKeyPem: pair.privateKeyPem,
    });
    assert.equal(
      (
        await validateProviderToken({
          token: noAud,
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_AUDIENCE_INVALID',
    );

    assert.equal(
      (
        await validateProviderToken({
          token: mint({ aud: 'wrong' }),
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_AUDIENCE_INVALID',
    );

    const noAzp = signRs256Jwt({
      header: { alg: 'RS256', typ: 'JWT', kid: pair.kid },
      payload: {
        iss: FAPI,
        sub: 'u',
        aud: EXPECTED_AUDIENCE,
        iat: FIXED_NOW,
        nbf: FIXED_NOW,
        exp: FIXED_NOW + 600,
        sid: 's',
      },
      privateKeyPem: pair.privateKeyPem,
    });
    assert.equal(
      (
        await validateProviderToken({
          token: noAzp,
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_AUTHORIZED_PARTY_INVALID',
    );

    assert.equal(
      (
        await validateProviderToken({
          token: mint({}, 'https://evil.example'),
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_AUTHORIZED_PARTY_INVALID',
    );

    const mapping = createInMemoryPersonMappingAdapter([]);
    const auth = await authenticateProviderTokenToPersonPrincipal({
      token: mint(),
      jwksAdapter: adapter,
      mappingAdapter: mapping,
      expectedIssuer: FAPI,
      expectedAudience: EXPECTED_AUDIENCE,
      activeSessionAdapter: createInMemoryActiveSessionAdapter(),
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(auth.ok, false);
    assert.equal(auth.code, 'IDENTITY_MAPPING_NOT_FOUND');
  });

  it('INVALID_SIGNATURE_ISSUER_EXPIRED', async () => {
    const { adapter, mint, pair } = await setup();
    const other = makeRsaJwk('live-kid');
    const badSig = signRs256Jwt({
      header: { alg: 'RS256', typ: 'JWT', kid: pair.kid },
      payload: {
        iss: FAPI,
        sub: 'u',
        aud: EXPECTED_AUDIENCE,
        azp: DEVELOPMENT_AUTHORIZED_PARTY,
        iat: FIXED_NOW,
        nbf: FIXED_NOW,
        exp: FIXED_NOW + 600,
        sid: 's',
      },
      privateKeyPem: other.privateKeyPem,
    });
    assert.equal(
      (
        await validateProviderToken({
          token: badSig,
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_SIGNATURE_INVALID',
    );

    assert.equal(
      (
        await validateProviderToken({
          token: mint({ iss: 'https://evil.clerk.accounts.dev' }),
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_ISSUER_INVALID',
    );

    assert.equal(
      (
        await validateProviderToken({
          token: mint({ exp: FIXED_NOW - 1 }),
          jwksAdapter: adapter,
          expectedIssuer: FAPI,
          expectedAudience: EXPECTED_AUDIENCE,
          nowSeconds: () => FIXED_NOW,
        })
      ).code,
      'TOKEN_EXPIRED',
    );
  });
});

describe('P4-H0b2a real-token deferral', () => {
  it('LIVE_CLERK_TOKEN_VALIDATION_PENDING', () => {
    assert.equal(true, true); // documented in evidence — no real token captured
  });
});
