import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEphemeralRs256TestFixture,
  AuthAssuranceMethod,
  EXPECTED_AUDIENCE,
  DEVELOPMENT_AUTHORIZED_PARTY,
  createInMemoryProviderSessionRegistry,
} from '@deintarifheld/shared';
import {
  validateLiveProviderSession,
  createEmptyPersonMappingAdapter,
  DEVELOPMENT_CLERK_ISSUER,
} from './live-session-validate.js';

const FIXED_NOW = 1_700_000_000;

function fixtureForDevShape() {
  return createEphemeralRs256TestFixture();
}

function baseOpts(fx, registry) {
  return {
    jwksAdapter: fx.jwksAdapter,
    mappingAdapter: createEmptyPersonMappingAdapter(),
    sessionRegistry: registry,
    expectedIssuer: fx.expectedIssuer,
    expectedAudience: fx.expectedAudience,
    expectedAuthorizedParty: [DEVELOPMENT_AUTHORIZED_PARTY, 'https://cc.deintarifheld.de'],
    nowSeconds: () => FIXED_NOW,
  };
}

describe('P4-H0b2b live session validate (synthetic)', () => {
  it('MISSING_SESSION_REJECTED / SIGNED_OUT', async () => {
    const r = await validateLiveProviderSession({
      authorizationHeader: null,
      sessionRegistry: createInMemoryProviderSessionRegistry(),
    });
    assert.equal(r.liveProviderAuthentication, 'FAIL');
    assert.equal(r.liveTokenReceivedTransiently, false);
    assert.equal(r.code, 'MISSING_AUTHORIZATION');
    assert.equal(r.tokenBodyPresent, false);
    assert.equal(r.operationalApiAccessAllowed, false);
  });

  it('valid signature+claims with empty mapping → AuthN PASS, DTH DENIED_EXPECTED', async () => {
    const fx = fixtureForDevShape();
    const registry = createInMemoryProviderSessionRegistry();
    const token = fx.mintToken({
      _now: FIXED_NOW,
      amr: AuthAssuranceMethod.PASSKEY,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
      aud: fx.expectedAudience,
      sid: 'sess_a',
    });
    const r = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${token}`,
      ...baseOpts(fx, registry),
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
    assert.equal(r.sessionLifecycleOk, true);
    assert.equal(r.activeSessionCount, 1);
    assert.equal(r.operationalApiAccessAllowed, false);
    assert.equal(r.tokenBodyPresent, false);
    assert.equal(r.rawClaimsPresent, false);
    assert.doesNotMatch(JSON.stringify(r), /eyJ/);
  });

  it('H0b4 REVOKE_OLD_ALLOW_NEW: session B accepts; session A rejected', async () => {
    const fx = fixtureForDevShape();
    const registry = createInMemoryProviderSessionRegistry();
    const tokenA = fx.mintToken({
      _now: FIXED_NOW,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
      aud: fx.expectedAudience,
      sid: 'sess_a',
      sub: 'user_same',
    });
    const tokenB = fx.mintToken({
      _now: FIXED_NOW + 5,
      azp: DEVELOPMENT_AUTHORIZED_PARTY,
      aud: fx.expectedAudience,
      sid: 'sess_b',
      sub: 'user_same',
    });
    const a = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${tokenA}`,
      ...baseOpts(fx, registry),
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(a.liveProviderAuthentication, 'PASS');
    assert.equal(a.activeSessionCount, 1);

    const b = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${tokenB}`,
      ...baseOpts(fx, registry),
      nowSeconds: () => FIXED_NOW + 5,
    });
    assert.equal(b.liveProviderAuthentication, 'PASS');
    assert.equal(b.priorSessionRevokedCount, 1);
    assert.equal(b.activeSessionCount, 1);

    const aAgain = await validateLiveProviderSession({
      authorizationHeader: `Bearer ${tokenA}`,
      ...baseOpts(fx, registry),
      nowSeconds: () => FIXED_NOW + 10,
    });
    assert.equal(aAgain.liveProviderAuthentication, 'FAIL');
    assert.equal(aAgain.code, 'SESSION_REVOKED');
    assert.equal(aAgain.sessionLifecycleOk, false);
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
      ...baseOpts(fx, createInMemoryProviderSessionRegistry()),
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
      ...baseOpts(fx, createInMemoryProviderSessionRegistry()),
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
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
      ...baseOpts(fx, createInMemoryProviderSessionRegistry()),
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
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
      ...baseOpts(fx, createInMemoryProviderSessionRegistry()),
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
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
      ...baseOpts(fx, createInMemoryProviderSessionRegistry()),
      expectedAuthorizedParty: DEVELOPMENT_AUTHORIZED_PARTY,
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
