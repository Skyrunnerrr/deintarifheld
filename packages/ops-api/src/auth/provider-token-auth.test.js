import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEphemeralRs256TestFixture,
  createInMemoryPersonMappingAdapter,
  createInMemoryActiveSessionAdapter,
  IdentityProvider,
  LinkStatus,
  AuthAssuranceMethod,
  SYNTHETIC_ISSUER,
} from '@deintarifheld/shared';
import {
  authenticateOpsPersonFromProviderToken,
  assertProductionLocalAuthRejected,
  assertSharedSecretRejectedAsPerson,
} from './provider-token-auth.js';

const FIXED_NOW = 1_700_000_000;

describe('ops-api P4-H0a provider token auth', () => {
  it('token path yields person principal', async () => {
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
    const r = await authenticateOpsPersonFromProviderToken({
      token,
      jwksAdapter: fx.jwksAdapter,
      mappingAdapter: mapping,
      expectedIssuer: fx.expectedIssuer,
      expectedAudience: fx.expectedAudience,
      activeSessionAdapter: createInMemoryActiveSessionAdapter(),
      sessionStartedAtSeconds: FIXED_NOW,
      lastActivityAtSeconds: FIXED_NOW,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(r.ok, true);
    assert.equal(r.principal.personId, 'person_dth_001');
    assert.equal(r.PRODUCTION_IDP_READY, false);
    assert.equal(r.STRONG_AUTHZ_COMPLETE, false);
  });

  it('PRODUCTION_LOCAL_AUTH_BYPASS rejected', () => {
    const r = assertProductionLocalAuthRejected();
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PRODUCTION_MODE_LOCAL_AUTH_DENIED');
  });

  it('SHARED_SECRET_AS_PERSON rejected', () => {
    const r = assertSharedSecretRejectedAsPerson();
    assert.equal(r.sharedSecretOwner.ok, false);
    assert.equal(r.sharedSecretAsPerson.ok, false);
  });
});
