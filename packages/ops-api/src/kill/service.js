/**
 * P3-F6 kill-switch application service — local/dev only.
 * Owner-only mutations via P3-F1 person CC session.
 * STRONG_AUTHZ_COMPLETE=NO · AVERION_KILL_SWITCH_AUTHORITY=NO
 */
import { randomUUID } from 'node:crypto';
import {
  KillState,
  PrincipalType,
  isKillDomain,
  isPersonPrincipal,
} from '@deintarifheld/shared';
import { SYNTHETIC_OWNER_PERSON_ID } from '../auth/local-owner-auth.js';
import { createInMemoryKillStore } from './memory-store.js';
import { createInMemoryKillAuditLog } from './audit-log.js';

function deny(code, extras = {}) {
  return { ok: false, code, stateChanged: false, ...extras };
}

function resolveActorContext(input = {}) {
  if (input.sharedSecretContext === true) {
    return { ok: false, code: 'SHARED_SECRET_CONTEXT_CANNOT_KILL' };
  }
  if (!input.principal && !input.session) {
    return { ok: false, code: 'MISSING_PRINCIPAL_CANNOT_KILL' };
  }
  if (input.principal?.type === PrincipalType.SERVICE) {
    return { ok: false, code: 'SERVICE_PRINCIPAL_CANNOT_KILL' };
  }
  if (input.principal?.type === PrincipalType.BREAK_GLASS) {
    return { ok: false, code: 'BREAK_GLASS_PRINCIPAL_CANNOT_KILL' };
  }
  if (input.principal && !Object.values(PrincipalType).includes(input.principal.type)) {
    return { ok: false, code: 'UNKNOWN_PRINCIPAL_TYPE_CANNOT_KILL' };
  }
  const session = input.session;
  if (!session || session.ccSession !== true || !session.personId) {
    return { ok: false, code: 'CC_PERSON_SESSION_REQUIRED_FOR_KILL' };
  }
  if (session.principalType !== PrincipalType.PERSON) {
    return { ok: false, code: 'PERSON_PRINCIPAL_REQUIRED_FOR_KILL' };
  }
  if (input.principal && !isPersonPrincipal(input.principal)) {
    return { ok: false, code: 'PERSON_PRINCIPAL_REQUIRED_FOR_KILL' };
  }
  if (session.personId !== SYNTHETIC_OWNER_PERSON_ID) {
    return {
      ok: false,
      code: 'NON_OWNER_PERSON_CANNOT_KILL',
      detail: 'KILL_SWITCH_PRIMARY_AUTHORITY=SYNTHETIC_LOCAL_OWNER_PERSON',
    };
  }
  if (input.principal && input.principal.personId !== SYNTHETIC_OWNER_PERSON_ID) {
    return { ok: false, code: 'NON_OWNER_PERSON_CANNOT_KILL' };
  }
  return {
    ok: true,
    actorType: PrincipalType.PERSON,
    actorId: session.personId,
    sessionId: session.sessionId,
  };
}

export function createKillSwitchService({
  store = createInMemoryKillStore(),
  auditLog = createInMemoryKillAuditLog(),
} = {}) {
  function readAll() {
    return { ok: true, domains: store.list(), count: store.list().length };
  }

  function readOne(domain) {
    if (!isKillDomain(domain)) {
      return deny('UNKNOWN_KILL_DOMAIN', { domain });
    }
    return store.get(domain);
  }

  function changeState({ domain, newState, reason, principal, session, sharedSecretContext, correlationId }) {
    const before = isKillDomain(domain) ? store.get(domain) : null;
    const previousState = before?.ok ? before.state : undefined;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return deny('REASON_REQUIRED', { domain, previousState });
    }
    if (!isKillDomain(domain)) {
      return deny('UNKNOWN_KILL_DOMAIN', { domain });
    }
    if (newState !== KillState.ACTIVE && newState !== KillState.INACTIVE) {
      return deny('KILL_STATE_MALFORMED_FAIL_CLOSED', { domain, previousState });
    }

    const actor = resolveActorContext({ principal, session, sharedSecretContext });
    if (!actor.ok) {
      return deny(actor.code, {
        domain,
        previousState,
        detail: actor.detail,
      });
    }

    const corr = correlationId || randomUUID();
    const applied = store.set(domain, newState);
    if (!applied.ok) {
      return deny(applied.code, { domain, previousState });
    }

    const event = auditLog.append({
      DOMAIN: domain,
      PREVIOUS_STATE: applied.previousState,
      NEW_STATE: applied.newState,
      ACTOR_TYPE: actor.actorType,
      ACTOR_ID: actor.actorId,
      SESSION_ID: actor.sessionId,
      REASON: reason.trim(),
      TIMESTAMP: new Date().toISOString(),
      CORRELATION_ID: corr,
      RESULT: 'success',
      ACTION: newState === KillState.ACTIVE ? 'KILL_ACTIVATE' : 'KILL_DEACTIVATE',
    });

    return {
      ok: true,
      stateChanged: applied.previousState !== applied.newState,
      domain,
      previousState: applied.previousState,
      newState: applied.newState,
      correlationId: corr,
      auditEvent: event,
    };
  }

  return {
    persistenceAdapter: store.persistenceAdapter,
    readAll,
    readOne,
    activateKill({ domain, reason, principal, session, sharedSecretContext, correlationId }) {
      return changeState({
        domain,
        newState: KillState.ACTIVE,
        reason,
        principal,
        session,
        sharedSecretContext,
        correlationId,
      });
    },
    deactivateKill({ domain, reason, principal, session, sharedSecretContext, correlationId }) {
      return changeState({
        domain,
        newState: KillState.INACTIVE,
        reason,
        principal,
        session,
        sharedSecretContext,
        correlationId,
      });
    },
    listAuditEvents() {
      return auditLog.list();
    },
    getStoreSnapshot() {
      return store.snapshot();
    },
  };
}
