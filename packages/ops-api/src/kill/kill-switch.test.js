/**
 * TG-02 — kill-switch control foundation tests (local only, no DB).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KillDomain,
  KillState,
  KILL_DOMAIN_COUNT,
  createPersonPrincipal,
  createServicePrincipal,
  createBreakGlassPrincipal,
  issueCcSession,
} from '@deintarifheld/shared';
import { SYNTHETIC_OWNER_PERSON_ID, authenticateLocalOwner } from '../auth/local-owner-auth.js';
import { createKillSwitchService } from './service.js';
import { createInMemoryKillStore } from './memory-store.js';
import { createInMemoryKillAuditLog } from './audit-log.js';

function ownerSession() {
  const auth = authenticateLocalOwner({
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(auth.ok, true);
  return auth;
}

function nonOwnerSession() {
  const principal = createPersonPrincipal({ personId: 'person_synth_other_dth_local_002' });
  const issued = issueCcSession(principal, { authenticationMethod: 'local_dev_other' });
  assert.equal(issued.ok, true);
  return { principal, session: issued.session };
}

function freshService() {
  return createKillSwitchService({
    store: createInMemoryKillStore(),
    auditLog: createInMemoryKillAuditLog(),
  });
}

test('KILL_DOMAINS_REGISTERED_EXACTLY=8 and readable', () => {
  const svc = freshService();
  const all = svc.readAll();
  assert.equal(all.ok, true);
  assert.equal(all.count, KILL_DOMAIN_COUNT);
  assert.equal(all.domains.length, 8);
  const one = svc.readOne(KillDomain.AUTOMATION_ENGINE);
  assert.equal(one.ok, true);
  assert.equal(one.state, KillState.ACTIVE);
});

test('OWNER_CAN_ACTIVATE_KILL and DEACTIVATE with audit + correlation', () => {
  const svc = freshService();
  const { principal, session } = ownerSession();
  const corr = 'corr-kill-001';
  const act = svc.activateKill({
    domain: KillDomain.PUBLIC_INTAKE,
    reason: 'owner emergency pause test',
    principal,
    session,
    correlationId: corr,
  });
  assert.equal(act.ok, true);
  assert.equal(act.newState, KillState.ACTIVE);
  assert.equal(act.correlationId, corr);
  assert.equal(act.auditEvent.ACTOR_ID, SYNTHETIC_OWNER_PERSON_ID);
  assert.equal(act.auditEvent.ACTOR_TYPE, 'PERSON_PRINCIPAL');
  assert.equal(act.auditEvent.CORRELATION_ID, corr);
  assert.equal(act.auditEvent.REASON, 'owner emergency pause test');

  const deact = svc.deactivateKill({
    domain: KillDomain.PUBLIC_INTAKE,
    reason: 'owner reenable after test',
    principal,
    session,
    correlationId: 'corr-kill-002',
  });
  assert.equal(deact.ok, true);
  assert.equal(deact.newState, KillState.INACTIVE);
  assert.equal(deact.auditEvent.ACTION, 'KILL_DEACTIVATE');
  assert.equal(svc.listAuditEvents().length, 2);
});

test('NON_OWNER / SERVICE / BREAK_GLASS / SHARED_SECRET / MISSING rejected; state unchanged', () => {
  const svc = freshService();
  const before = svc.getStoreSnapshot();

  const other = nonOwnerSession();
  const r1 = svc.activateKill({
    domain: KillDomain.API_PROCESSING,
    reason: 'should fail',
    principal: other.principal,
    session: other.session,
  });
  assert.equal(r1.ok, false);
  assert.equal(r1.code, 'NON_OWNER_PERSON_CANNOT_KILL');
  assert.equal(r1.stateChanged, false);

  const service = createServicePrincipal({ serviceId: 'svc_cron' });
  const r2 = svc.activateKill({
    domain: KillDomain.API_PROCESSING,
    reason: 'should fail',
    principal: service,
    session: { ccSession: true, personId: SYNTHETIC_OWNER_PERSON_ID, principalType: 'PERSON_PRINCIPAL', sessionId: 'x' },
  });
  // principal SERVICE rejected before trusting forged session person id
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'SERVICE_PRINCIPAL_CANNOT_KILL');

  const bg = createBreakGlassPrincipal();
  const r3 = svc.activateKill({
    domain: KillDomain.API_PROCESSING,
    reason: 'should fail',
    principal: bg,
    session: { ccSession: true, personId: SYNTHETIC_OWNER_PERSON_ID, principalType: 'PERSON_PRINCIPAL', sessionId: 'x' },
  });
  assert.equal(r3.ok, false);
  assert.equal(r3.code, 'BREAK_GLASS_PRINCIPAL_CANNOT_KILL');

  const r4 = svc.activateKill({
    domain: KillDomain.API_PROCESSING,
    reason: 'should fail',
    sharedSecretContext: true,
    session: ownerSession().session,
    principal: ownerSession().principal,
  });
  assert.equal(r4.ok, false);
  assert.equal(r4.code, 'SHARED_SECRET_CONTEXT_CANNOT_KILL');

  const r5 = svc.activateKill({
    domain: KillDomain.API_PROCESSING,
    reason: 'should fail',
  });
  assert.equal(r5.ok, false);
  assert.equal(r5.code, 'MISSING_PRINCIPAL_CANNOT_KILL');

  assert.deepEqual(svc.getStoreSnapshot(), before);
  assert.equal(svc.listAuditEvents().length, 0);
});

test('UNKNOWN_DOMAIN_REJECTED and REASON_REQUIRED', () => {
  const svc = freshService();
  const { principal, session } = ownerSession();
  const unknown = svc.activateKill({
    domain: 'NINTH_DOMAIN',
    reason: 'x',
    principal,
    session,
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'UNKNOWN_KILL_DOMAIN');

  const noReason = svc.activateKill({
    domain: KillDomain.DATA_IMPORT,
    reason: '   ',
    principal,
    session,
  });
  assert.equal(noReason.ok, false);
  assert.equal(noReason.code, 'REASON_REQUIRED');
  assert.equal(svc.readOne(KillDomain.DATA_IMPORT).state, KillState.ACTIVE);
});

test('safe defaults: marketing/automation/import/partner/cc-writes killed by default', () => {
  const snap = freshService().getStoreSnapshot();
  assert.equal(snap.MARKETING_MAIL, KillState.ACTIVE);
  assert.equal(snap.AUTOMATION_ENGINE, KillState.ACTIVE);
  assert.equal(snap.DATA_IMPORT, KillState.ACTIVE);
  assert.equal(snap.PARTNER_ACCESS, KillState.ACTIVE);
  assert.equal(snap.COMMAND_CENTER_WRITE_ACTIONS, KillState.ACTIVE);
  assert.equal(snap.PUBLIC_INTAKE, KillState.INACTIVE);
  assert.equal(snap.API_PROCESSING, KillState.INACTIVE);
  assert.equal(snap.INTERNAL_MAIL, KillState.INACTIVE);
});

test('persistence adapter is local-dev only; no DB claims', () => {
  const svc = freshService();
  assert.equal(svc.persistenceAdapter, 'LOCAL_DEV_ONLY');
});
