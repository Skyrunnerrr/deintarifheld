import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PrincipalType,
  createPersonPrincipal,
  createServicePrincipal,
  createBreakGlassPrincipal,
  issueCcSession,
  rejectSharedSecretAsCcSession,
  auditActorFromCcSession,
} from './index.js';

const SYNTH_OWNER = 'person_synth_owner_dth_local_001';

test('person principal can receive CC session', () => {
  const person = createPersonPrincipal({ personId: SYNTH_OWNER });
  const result = issueCcSession(person, { authenticationMethod: 'local_dev_owner' });
  assert.equal(result.ok, true);
  assert.equal(result.session.personId, SYNTH_OWNER);
});

test('audit actor equals person id', () => {
  const person = createPersonPrincipal({ personId: SYNTH_OWNER });
  const { session } = issueCcSession(person, { authenticationMethod: 'local_dev_owner' });
  const actor = auditActorFromCcSession(session);
  assert.equal(actor.ACTOR_TYPE, PrincipalType.PERSON);
  assert.equal(actor.ACTOR_ID, SYNTH_OWNER);
  assert.equal(actor.SESSION_ID, session.sessionId);
  assert.ok(actor.CORRELATION_ID);
});

test('shared secret cannot create CC session', () => {
  const rejected = rejectSharedSecretAsCcSession();
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'SHARED_SECRET_CC_SESSION_FORBIDDEN');
});

test('service principal rejected for CC session', () => {
  const service = createServicePrincipal({ serviceId: 'svc_cron' });
  const result = issueCcSession(service, { authenticationMethod: 'shared_secret' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CC_SESSION_PERSON_PRINCIPAL_REQUIRED');
});

test('break-glass principal rejected for CC session', () => {
  const bg = createBreakGlassPrincipal();
  const result = issueCcSession(bg, { authenticationMethod: 'shared_secret' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CC_SESSION_PERSON_PRINCIPAL_REQUIRED');
});

test('missing person id rejected', () => {
  assert.throws(() => createPersonPrincipal({ personId: '' }), /PERSON_ID_REQUIRED/);
});

test('unknown principal type rejected', () => {
  const result = issueCcSession({ type: 'ALIEN' }, { authenticationMethod: 'x' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_PRINCIPAL_TYPE');
});
