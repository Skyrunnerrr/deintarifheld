import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditActorFromCcSession } from '@deintarifheld/shared';
import {
  SYNTHETIC_OWNER_PERSON_ID,
  authenticateLocalOwner,
  authenticateSharedSecretAsOwner,
  attemptSharedSecretCcSession,
  attemptServiceCcSession,
  attemptBreakGlassCcSession,
} from './index.js';

test('local owner login path works in local/dev', () => {
  const result = authenticateLocalOwner({
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.LOCAL_DEV_OWNER_AUTH, 'PASS');
  assert.equal(result.session.personId, SYNTHETIC_OWNER_PERSON_ID);
  const actor = auditActorFromCcSession(result.session);
  assert.equal(actor.ACTOR_ID, SYNTHETIC_OWNER_PERSON_ID);
});

test('production mode local auth is denied', () => {
  const result = authenticateLocalOwner({
    env: { NODE_ENV: 'production', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PRODUCTION_MODE_LOCAL_AUTH_DENIED');
  assert.equal(result.PRODUCTION_MODE_LOCAL_AUTH, 'DENIED');
});

test('shared secret as owner login forbidden', () => {
  const result = authenticateSharedSecretAsOwner();
  assert.equal(result.ok, false);
});

test('shared secret CC session rejected', () => {
  const result = attemptSharedSecretCcSession();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SHARED_SECRET_CC_SESSION_FORBIDDEN');
});

test('service principal CC session rejected', () => {
  const result = attemptServiceCcSession();
  assert.equal(result.ok, false);
});

test('break-glass CC session rejected', () => {
  const result = attemptBreakGlassCcSession();
  assert.equal(result.ok, false);
});
