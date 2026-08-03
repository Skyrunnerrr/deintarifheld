/**
 * Ephemeral RSA key material for tests only — never commit/log private keys.
 */
import { generateKeyPairSync } from 'node:crypto';
import { publicKeyPemToJwk, signRs256Jwt } from './jwt-crypto.js';
import { createStaticJwksAdapter } from './jwks-adapter.js';
import {
  EXPECTED_AUTHORIZED_PARTY,
  AuthAssuranceMethod,
  IdentityProvider,
} from './h0a-constants.js';

export const SYNTHETIC_ISSUER = 'https://synthetic-clerk.invalid/dth-h0a-test';
export const SYNTHETIC_AUDIENCE = 'dth-ops-cc-synthetic-audience';

export function createEphemeralRs256TestFixture({ kid = 'h0a-test-kid-1' } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const jwk = publicKeyPemToJwk(publicKey, kid, 'RS256');
  const jwksAdapter = createStaticJwksAdapter({ keys: [jwk] });

  function mintToken(claimsOverrides = {}, headerOverrides = {}) {
    const now = claimsOverrides._now ?? Math.floor(Date.now() / 1000);
    const {
      _now: _ignored,
      amr = AuthAssuranceMethod.PASSKEY,
      ...rest
    } = claimsOverrides;
    const payload = {
      iss: SYNTHETIC_ISSUER,
      sub: 'user_synth_clerk_001',
      aud: SYNTHETIC_AUDIENCE,
      azp: EXPECTED_AUTHORIZED_PARTY,
      iat: now,
      nbf: now,
      exp: now + 3600,
      sid: 'sess_synth_001',
      amr,
      ...rest,
    };
    // Remove undefined
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }
    const header = { alg: 'RS256', typ: 'JWT', kid, ...headerOverrides };
    return signRs256Jwt({ header, payload, privateKeyPem: privateKey });
  }

  return {
    kid,
    publicKeyPem: publicKey,
    // privateKeyPem intentionally not returned on the public fixture object
    // for normal use — mintToken closes over it.
    mintToken,
    jwksAdapter,
    expectedIssuer: SYNTHETIC_ISSUER,
    expectedAudience: SYNTHETIC_AUDIENCE,
    expectedAuthorizedParty: EXPECTED_AUTHORIZED_PARTY,
    provider: IdentityProvider.CLERK,
    /** Test-only escape hatch; callers must not log. */
    _privateKeyPemForNegativeTests: privateKey,
  };
}
