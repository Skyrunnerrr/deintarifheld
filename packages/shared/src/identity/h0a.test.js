/**
 * P4-H0a gates — synthetic provider evidence only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEphemeralRs256TestFixture, SYNTHETIC_ISSUER, SYNTHETIC_AUDIENCE } from './synthetic-test-keys.js';
import { validateProviderToken } from './token-validator.js';
import { createInMemoryPersonMappingAdapter, rejectEmailBasedAutoMapping, rejectAutomaticPersonCreation } from './person-mapping.js';
import { createInMemoryActiveSessionAdapter, evaluateSessionPolicy, PRODUCTION_CONCURRENT_SESSION_RESOLUTION } from './session-policy.js';
import { authenticateProviderTokenToPersonPrincipal, rejectNonPersonAsPersonSession } from './authenticate-provider-token.js';
import { getPasskeyEnrollmentPolicyContract, evaluateOperationalPasskeyAssurance } from './passkey-policy.js';
import { AuthAssuranceMethod, IdentityProvider, LinkStatus, EXPECTED_AUTHORIZED_PARTY, SESSION_INACTIVITY_TIMEOUT_MINUTES, SESSION_MAXIMUM_LIFETIME_HOURS, MAX_ACTIVE_SESSIONS_PER_DTH_PERSON } from './h0a-constants.js';
import { encodeJwtPart, base64UrlEncode } from './jwt-crypto.js';
import { createStaticJwksAdapter } from './jwks-adapter.js';
import { PrincipalType, isPersonPrincipal } from '../principal.js';

const FIXED_NOW = 1_700_000_000;

function clock(n = FIXED_NOW) {
  return () => n;
}

describe('P4-H0a token validation', () => {
  it('VALID_SYNTHETIC_TOKEN_ACCEPTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.identity.provider, IdentityProvider.CLERK);
    assert.equal(r.identity.issuer, SYNTHETIC_ISSUER);
  });

  it('INVALID_SIGNATURE_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW });
    const messed = token.slice(0, -4) + 'aaaa';
    const r = await validateProviderToken({
      token: messed,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_SIGNATURE_INVALID');
  });

  it('UNSIGNED_TOKEN_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const header = encodeJwtPart({ alg: 'RS256', typ: 'JWT', kid: fx.kid });
    const payload = encodeJwtPart({ iss: SYNTHETIC_ISSUER, sub: 'x', aud: SYNTHETIC_AUDIENCE, azp: EXPECTED_AUTHORIZED_PARTY, iat: FIXED_NOW, nbf: FIXED_NOW, exp: FIXED_NOW + 100, sid: 's' });
    const token = `${header}.${payload}.`;
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.ok(['TOKEN_UNSIGNED', 'TOKEN_SIGNATURE_INVALID', 'TOKEN_MALFORMED'].includes(r.code));
  });

  it('ALG_NONE_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const header = encodeJwtPart({ alg: 'none', typ: 'JWT', kid: fx.kid });
    const payload = encodeJwtPart({ iss: SYNTHETIC_ISSUER, sub: 'x', aud: SYNTHETIC_AUDIENCE, azp: EXPECTED_AUTHORIZED_PARTY, iat: FIXED_NOW, exp: FIXED_NOW + 100, sid: 's' });
    const token = `${header}.${payload}.${base64UrlEncode(Buffer.from('x'))}`;
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_ALG_NONE_REJECTED');
  });

  it('UNKNOWN_KEY_ID_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW }, { kid: 'unknown-kid' });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_KEY_UNKNOWN');
  });

  it('INVALID_ISSUER_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, iss: 'https://evil.example' });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_ISSUER_INVALID');
  });

  it('INVALID_AUDIENCE_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, aud: 'wrong-aud' });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_AUDIENCE_INVALID');
  });

  it('INVALID_AUTHORIZED_PARTY_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, azp: 'https://evil.example' });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_AUTHORIZED_PARTY_INVALID');
  });

  it('EXPIRED_TOKEN_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, exp: FIXED_NOW - 1 });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_EXPIRED');
  });

  it('NOT_BEFORE_VIOLATION_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, nbf: FIXED_NOW + 100 });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_NOT_YET_VALID');
  });

  it('FUTURE_ISSUED_AT_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, iat: FIXED_NOW + 3600, nbf: FIXED_NOW, exp: FIXED_NOW + 7200 });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_IAT_IN_FUTURE');
  });

  it('MISSING_SUBJECT_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, sub: undefined });
    // mintToken may still include sub from defaults — force empty via override empty string then delete
    const token2 = fx.mintToken({ _now: FIXED_NOW, sub: '' });
    const r = await validateProviderToken({
      token: token2,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_SUBJECT_MISSING');
  });

  it('MISSING_SESSION_ID_REJECTED', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, sid: '' });
    const r = await validateProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOKEN_SESSION_ID_MISSING');
  });

  it('REMOTE_JWKS_ADAPTER_NOT_USED', () => {
    const adapter = createStaticJwksAdapter({ keys: [] });
    assert.equal(adapter.kind, 'STATIC_IN_MEMORY_JWKS');
    assert.equal(adapter.remoteCalls, 0);
  });
});

describe('P4-H0a person mapping', () => {
  it('ACTIVE_MAPPING_RESOLVED', () => {
    const m = createInMemoryPersonMappingAdapter([
      {
        provider: IdentityProvider.CLERK,
        issuer: SYNTHETIC_ISSUER,
        subject: 'user_synth_clerk_001',
        dthPersonId: 'person_dth_001',
        linkStatus: LinkStatus.ACTIVE,
      },
    ]);
    const r = m.resolve({
      provider: IdentityProvider.CLERK,
      issuer: SYNTHETIC_ISSUER,
      subject: 'user_synth_clerk_001',
    });
    assert.equal(r.ok, true);
    assert.equal(r.dthPersonId, 'person_dth_001');
  });

  it('UNKNOWN_MAPPING_REJECTED', () => {
    const m = createInMemoryPersonMappingAdapter([]);
    const r = m.resolve({
      provider: IdentityProvider.CLERK,
      issuer: SYNTHETIC_ISSUER,
      subject: 'unknown',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'IDENTITY_MAPPING_NOT_FOUND');
  });

  it('DISABLED_MAPPING_REJECTED', () => {
    const m = createInMemoryPersonMappingAdapter([
      {
        provider: IdentityProvider.CLERK,
        issuer: SYNTHETIC_ISSUER,
        subject: 'user_x',
        dthPersonId: 'person_dth_001',
        linkStatus: LinkStatus.DISABLED,
      },
    ]);
    const r = m.resolve({
      provider: IdentityProvider.CLERK,
      issuer: SYNTHETIC_ISSUER,
      subject: 'user_x',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'IDENTITY_MAPPING_DISABLED');
  });

  it('AMBIGUOUS_MAPPING_REJECTED', () => {
    const m = createInMemoryPersonMappingAdapter([
      {
        provider: IdentityProvider.CLERK,
        issuer: SYNTHETIC_ISSUER,
        subject: 'user_x',
        dthPersonId: 'person_a',
        linkStatus: LinkStatus.ACTIVE,
      },
      {
        provider: IdentityProvider.CLERK,
        issuer: SYNTHETIC_ISSUER,
        subject: 'user_x',
        dthPersonId: 'person_b',
        linkStatus: LinkStatus.ACTIVE,
      },
    ]);
    const r = m.resolve({
      provider: IdentityProvider.CLERK,
      issuer: SYNTHETIC_ISSUER,
      subject: 'user_x',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'IDENTITY_MAPPING_AMBIGUOUS');
  });

  it('EMAIL_BASED_AUTO_MAPPING rejected', () => {
    const r = rejectEmailBasedAutoMapping();
    assert.equal(r.ok, false);
  });

  it('AUTOMATIC_PERSON_CREATION rejected', () => {
    const r = rejectAutomaticPersonCreation();
    assert.equal(r.ok, false);
  });
});

describe('P4-H0a principal boundary', () => {
  it('VALID_IDENTITY_TO_PERSON_PRINCIPAL', async () => {
    const fx = createEphemeralRs256TestFixture();
    const token = fx.mintToken({ _now: FIXED_NOW, amr: AuthAssuranceMethod.PASSKEY });
    const mapping = createInMemoryPersonMappingAdapter([
      {
        provider: IdentityProvider.CLERK,
        issuer: SYNTHETIC_ISSUER,
        subject: 'user_synth_clerk_001',
        dthPersonId: 'person_dth_001',
        linkStatus: LinkStatus.ACTIVE,
      },
    ]);
    const sessions = createInMemoryActiveSessionAdapter();
    const r = await authenticateProviderTokenToPersonPrincipal({
      token,
      jwksAdapter: fx.jwksAdapter,
      mappingAdapter: mapping,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      activeSessionAdapter: sessions,
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, true);
    assert.equal(isPersonPrincipal(r.principal), true);
    assert.equal(r.principal.type, PrincipalType.PERSON);
    assert.equal(r.principal.personId, 'person_dth_001');
    assert.notEqual(r.identity.subject, r.principal.personId);
  });

  it('SERVICE_PRINCIPAL_AS_PERSON rejected', () => {
    const r = rejectNonPersonAsPersonSession('SERVICE');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PRINCIPAL_TYPE_REJECTED');
  });

  it('BREAK_GLASS_AS_NORMAL_PERSON rejected', () => {
    const r = rejectNonPersonAsPersonSession('BREAK_GLASS');
    assert.equal(r.ok, false);
  });

  it('SHARED_SECRET_AS_PERSON rejected', () => {
    const r = rejectNonPersonAsPersonSession('SHARED_SECRET');
    assert.equal(r.ok, false);
  });
});

describe('P4-H0a session policy', () => {
  it('INACTIVITY_UNDER_30_MINUTES pass', () => {
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW - 100,
      lastActivityAtSeconds: FIXED_NOW - 60,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, true);
    assert.equal(SESSION_INACTIVITY_TIMEOUT_MINUTES, 30);
  });

  it('INACTIVITY_OVER_30_MINUTES rejected', () => {
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW - 100,
      lastActivityAtSeconds: FIXED_NOW - (30 * 60 + 1),
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SESSION_INACTIVITY_EXCEEDED');
  });

  it('SESSION_AGE_UNDER_12_HOURS pass', () => {
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW - 3600,
      lastActivityAtSeconds: FIXED_NOW,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, true);
    assert.equal(SESSION_MAXIMUM_LIFETIME_HOURS, 12);
  });

  it('SESSION_AGE_OVER_12_HOURS rejected', () => {
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW - (12 * 3600 + 1),
      lastActivityAtSeconds: FIXED_NOW,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SESSION_MAX_LIFETIME_EXCEEDED');
  });

  it('ONE_ACTIVE_SESSION pass', () => {
    const adapter = createInMemoryActiveSessionAdapter();
    adapter.setActive('p1', [{ sessionId: 's1', dthPersonId: 'p1' }]);
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      activeSessionAdapter: adapter,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, true);
    assert.equal(MAX_ACTIVE_SESSIONS_PER_DTH_PERSON, 1);
  });

  it('MULTIPLE_ACTIVE_SESSIONS rejected', () => {
    const adapter = createInMemoryActiveSessionAdapter();
    adapter.setActive('p1', [{ sessionId: 's1', dthPersonId: 'p1' }]);
    const r = evaluateSessionPolicy({
      sessionId: 's2',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.ACTIVE,
      activeSessionAdapter: adapter,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SESSION_MULTI_ACTIVE_REJECTED');
    assert.equal(PRODUCTION_CONCURRENT_SESSION_RESOLUTION, 'NOT_IMPLEMENTED_IN_H0A');
  });

  it('DISABLED_MAPPING_INVALIDATES_SESSION', () => {
    const r = evaluateSessionPolicy({
      sessionId: 's1',
      dthPersonId: 'p1',
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      tokenExpiresAtSeconds: FIXED_NOW + 1000,
      linkStatus: LinkStatus.DISABLED,
      nowSeconds: clock(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'IDENTITY_MAPPING_DISABLED');
  });
});

describe('P4-H0a passkey policy contract', () => {
  it('PASSKEY_ASSURANCE_POLICY_ACCEPTED', () => {
    const r = evaluateOperationalPasskeyAssurance(AuthAssuranceMethod.PASSKEY);
    assert.equal(r.ok, true);
    const c = getPasskeyEnrollmentPolicyContract();
    assert.equal(c.PASSKEY_POLICY_CONTRACT_DEFINED, true);
    assert.equal(c.PASSKEY_POLICY_LIVE_VALIDATED, false);
    assert.equal(c.CLERK_PASSKEY_ENFORCEMENT_PROVEN, false);
    assert.equal(c.LIVE_WEBAUTHN_IMPLEMENTED, false);
  });

  it('MISSING_REQUIRED_PASSKEY_ASSURANCE rejected', () => {
    const r = evaluateOperationalPasskeyAssurance(null);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PASSKEY_ASSURANCE_REQUIRED');
  });

  it('EMAIL_OTP_NORMAL_OPERATIONAL_ACCESS rejected', () => {
    const r = evaluateOperationalPasskeyAssurance(AuthAssuranceMethod.EMAIL_OTP_ENROLLMENT);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'EMAIL_OTP_OPERATIONAL_ACCESS_REJECTED');
  });
});
