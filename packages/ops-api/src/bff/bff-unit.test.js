/**
 * P3-F3 unit tests without database (alias lock, auth, kill gate surface).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSotAlias,
  SotResourceType,
  createPersonPrincipal,
  createServicePrincipal,
  createBreakGlassPrincipal,
  issueCcSession,
  KillDomain,
  KillState,
} from '@deintarifheld/shared';
import { authenticateLocalOwner } from '../auth/local-owner-auth.js';
import { createKillSwitchService } from '../kill/service.js';
import { gateOpsRequest } from './auth-gate.js';
import { INTERNAL_BFF_PREFIX } from './constants.js';
import { createOpsBff } from './create-ops-bff.js';

function owner() {
  return authenticateLocalOwner({
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
}

test('SoT alias remap INTERNAL_NOTE and CONTACT_ATTEMPT', () => {
  const n = resolveSotAlias({ alias: 'INTERNAL_NOTE' });
  assert.equal(n.ok, true);
  assert.equal(n.canonicalResourceType, SotResourceType.CASE_NOTE);
  assert.equal(n.persistenceTarget, 'case_notes');
  const c = resolveSotAlias({ alias: 'CONTACT_ATTEMPT' });
  assert.equal(c.ok, true);
  assert.equal(c.canonicalResourceType, SotResourceType.COMMUNICATION_EVENT);
  assert.equal(c.persistenceTarget, 'communication_events');
});

test('unknown and conflicting aliases rejected', () => {
  const u = resolveSotAlias({ alias: 'FIRST_RESPONSE' });
  assert.equal(u.ok, false);
  assert.equal(u.status, 422);
  const conflict = resolveSotAlias({
    alias: 'INTERNAL_NOTE',
    canonicalResourceType: SotResourceType.COMMUNICATION_EVENT,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'CONFLICTING_ALIAS_AND_CANONICAL');
});

test('person session required; shared secret / service / break-glass rejected', () => {
  assert.equal(gateOpsRequest({}).code, 'MISSING_PRINCIPAL');
  assert.equal(gateOpsRequest({ sharedSecretContext: true, ...owner() }).code, 'SHARED_SECRET_CC_PATH_REJECTED');
  const svc = createServicePrincipal({ serviceId: 'x' });
  assert.equal(gateOpsRequest({ principal: svc, session: owner().session }).code, 'SERVICE_PRINCIPAL_REJECTED');
  const bg = createBreakGlassPrincipal();
  assert.equal(gateOpsRequest({ principal: bg, session: owner().session }).code, 'BREAK_GLASS_PRINCIPAL_REJECTED');
  const other = createPersonPrincipal({ personId: 'person_other' });
  const sess = issueCcSession(other, { authenticationMethod: 'x' }).session;
  assert.equal(gateOpsRequest({ principal: other, session: sess }).code, 'SYNTHETIC_OWNER_ONLY_DEV_GATE');
  const o = owner();
  assert.equal(gateOpsRequest({ principal: o.principal, session: o.session }).ok, true);
});

test('kill control remains available when COMMAND_CENTER_WRITE_ACTIONS is ACTIVE', async () => {
  const kill = createKillSwitchService();
  const o = owner();
  // Activate CC write kill
  const act = kill.activateKill({
    domain: KillDomain.COMMAND_CENTER_WRITE_ACTIONS,
    reason: 'unit test lock',
    principal: o.principal,
    session: o.session,
  });
  assert.equal(act.ok, true);
  assert.equal(act.newState, KillState.ACTIVE);

  // Fake pool not needed for kill routes
  const bff = createOpsBff({
    killService: kill,
    pool: {
      query: async () => ({ rows: [] }),
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release() {},
      }),
      end: async () => {},
    },
  });

  const status = await bff.dispatch({
    method: 'GET',
    path: `${INTERNAL_BFF_PREFIX}/kill-status`,
    principal: o.principal,
    session: o.session,
  });
  assert.equal(status.status, 200);

  const deact = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/kill/${KillDomain.COMMAND_CENTER_WRITE_ACTIONS}/deactivate`,
    principal: o.principal,
    session: o.session,
    body: { reason: 'unit recovery' },
  });
  assert.equal(deact.status, 200);
  assert.equal(deact.body.killStatePersisted, false);

  // Write path should have been blocked while ACTIVE — re-activate and probe
  kill.activateKill({
    domain: KillDomain.COMMAND_CENTER_WRITE_ACTIONS,
    reason: 'lock again',
    principal: o.principal,
    session: o.session,
  });
  const blocked = await bff.dispatch({
    method: 'POST',
    path: `${INTERNAL_BFF_PREFIX}/writes/internal-note`,
    principal: o.principal,
    session: o.session,
    body: { case_id: 'x', body: 'n', idempotency_key: 'k', correlation_id: 'c' },
  });
  assert.equal(blocked.status, 423);
  await bff.close();
});

test('internal BFF prefix constant', () => {
  assert.equal(INTERNAL_BFF_PREFIX, '/ops/v1');
});
