import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPersonPrincipal,
  createServicePrincipal,
} from '@deintarifheld/shared';
import { CcAuthContract, acceptCcAuthSession } from './index.js';
import { acceptProtectedRouteSession } from './auth/contracts.js';

test('CC contract forbids UI and strong authz claims', () => {
  assert.equal(CcAuthContract.uiIncluded, false);
  assert.equal(CcAuthContract.strongAuthzComplete, false);
  assert.equal(CcAuthContract.productionIdentityReady, false);
  assert.equal(CcAuthContract.productionLoginUiAuthorized, false);
  assert.equal(CcAuthContract.clerkSdkInitialized, false);
  assert.equal(CcAuthContract.authUiAndCcSameOrigin, true);
  assert.equal(CcAuthContract.passkeyRpId, 'cc.deintarifheld.de');
  assert.equal(CcAuthContract.passkeyPolicy.PASSKEY_POLICY_LIVE_VALIDATED, false);
});

test('CC accepts only person principal sessions', () => {
  const person = createPersonPrincipal({ personId: 'person_synth_owner_dth_local_001' });
  const ok = acceptCcAuthSession(person, 'local_dev_owner');
  assert.equal(ok.ok, true);
  const bad = acceptCcAuthSession(createServicePrincipal({ serviceId: 'x' }), 'shared_secret');
  assert.equal(bad.ok, false);
  const route = acceptProtectedRouteSession(ok.session);
  assert.equal(route.ok, true);
});
