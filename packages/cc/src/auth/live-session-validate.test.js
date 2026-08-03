import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEphemeralRs256TestFixture,
  AuthAssuranceMethod,
  EXPECTED_AUDIENCE,
  DEVELOPMENT_AUTHORIZED_PARTY,
} from '@deintarifheld/shared';
import {
  validateLiveProviderSession,
  createEmptyPersonMappingAdapter,
  DEVELOPMENT_CLERK_ISSUER,
} from './live-session-validate.js';

const FIXED_NOW = 1_700_000_000;

function fixtureForDevShape() {
  // Synthetic fixture with H0a issuer; adapter overridden — claim tests use fixture issuer.
  return createEphemeralRs256TestFixture();
}

describe('P4-H0b2b live session validate (synthetic)', () => {
  it('MISSING_SESSION_REJECTED / SIGNED_OUT', async () => {
    const r = await validateLiveProviderSession({ authorizationHeader: null });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.liveTokenReceivedTransiently, false);
    assert.equal(r.code, 'MISSING_AUTHORIZATION');
    assert.equal(r.tokenBodyPresent, false);
    assert.equal(r.operationalApiAccessAllowed, false);
  });

  it('valid signature+claims with empty mapping → AuthN PASS, DTH DENIED_EXPECTED', async () => {
    const fx = fixtureForDevShape();
    const token = fx.mintToken({
      _now: FIXED_NOW,
      amr: AuthAssuranceMethod.PASSKEY,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
      aud: fx.expectedAudience,
    });
    // Override expected issuer to synthetic fixture issuer for unit test.
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      mappingAdapter: createEmptyPersonMappingAdapter(),
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: [DEVELOPMENT_AUTHORIZED_PARTY, 'https://cc.deintarifheld.de'],
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'PASS');
    assert.equal(r.liveTokenReceivedTransiently, true);
    assert.equal(r.liveTokenSignatureValid, true);
    assert.equal(r.liveTokenIssuerValid, true);
    assert.equal(r.liveTokenAudienceValid, true);
    assert.equal(r.liveTokenAuthorizedPartyValid, true);
    assert.equal(r.liveTokenExpiryValid, true);
    assert.equal(r.liveTokenRequiredClaimsValid, true);
    assert.equal(r.externalProviderIdentityCreated, true);
    assert.equal(r.realSubjectHasDthPersonMapping, false);
    assert.equal(r.unknownRealSubjectRejected, true);
    assert.equal(r.dthAuthorization, 'DENIED_EXPECTED');
    assert.equal(r.operationalApiAccessAllowed, false);
    assert.equal(r.tokenBodyPresent, false);
    assert.equal(r.rawClaimsPresent, false);
    assert.doesNotMatch(JSON.stringify(r), /eyJ/);
  });

  it('WRONG_AUDIENCE_REJECTED', async () => {
    const fx = fixtureForDevShape();
    const token = fx.mintToken({
      _now: FIXED_NOW,
      aud: 'wrong-audience',
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.code, 'TOKEN_AUDIENCE_INVALID');
    assert.equal(r.dthAuthorization, 'DENIED');
  });

  it('WRONG_AUTHORIZED_PARTY_REJECTED', async () => {
    const fx = fixtureForDevShape();
    const token = fx.mintToken({
      _now: FIXED_NOW,
      aud: fx.expectedAudience,
      azp: 'https://evil.example',
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.code, 'TOKEN_AUTHORIZED_PARTY_INVALID');
  });

  it('WRONG_ISSUER_REJECTED', async () => {
    const fx = fixtureForDevShape();
    const token = fx.mintToken({
      _now: FIXED_NOW,
      iss: 'https://evil.example',
      aud: fx.expectedAudience,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.code, 'TOKEN_ISSUER_INVALID');
  });

  it('INVALID_SIGNATURE_REJECTED', async () => {
    const fx = fixtureForDevShape();
    const fx2 = createEphemeralRs256TestFixture({ kid: 'other-kid' });
    const token = fx2.mintToken({
      _now: FIXED_NOW,
      iss: fx.expectedIssuer,
      aud: fx.expectedAudience,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.ok(
      ['TOKEN_SIGNATURE_INVALID', 'TOKEN_KEY_UNKNOWN'].includes(r.code),
      r.code,
    );
  });

  it('EXPIRED_TOKEN_REJECTED', async () => {
    const fx = fixtureForDevShape();
    const token = fx.mintToken({
      _now: FIXED_NOW - 10_000,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
      aud: fx.expectedAudience,
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      jwksAdapter: fx.jwksAdapter,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.code, 'TOKEN_EXPIRED');
  });

  it('development constants are pinned', () => {
    assert.equal(DEVELOPMENT_CLERK_ISSUER, 'https://sterling-husky-22.clerk.accounts.dev');
    assert.equal(EXPECTED_AUDIENCE, 'urn:deintarifheld:ops-api');
    assert.equal(DEVELOPMENT_AUTHORIZED_PARTY, 'http://localhost:3100');
  });
});
