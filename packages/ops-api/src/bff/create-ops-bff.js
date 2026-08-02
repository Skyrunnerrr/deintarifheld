/**
 * P3-F3 Ops BFF — internal /ops/v1 dispatch (local/dev).
 * Not registered on public intake routes.
 */
import { KillDomain, KillState, resolveSotAlias } from '@deintarifheld/shared';
import { createKillSwitchService } from '../kill/service.js';
import { gateOpsRequest } from './auth-gate.js';
import { INTERNAL_BFF_PREFIX, LimitedWriteOperation } from './constants.js';
import { createLocalDbPool } from './db.js';
import { createReadService } from './reads.js';
import { createWriteService } from './writes.js';

function json(status, body) {
  return { status, body };
}

function match(path, pattern) {
  // pattern like /ops/v1/cases/:id
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = ap[i];
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

export function createOpsBff({
  databaseUrl,
  pool: injectedPool,
  killService = createKillSwitchService(),
} = {}) {
  const pool = injectedPool || createLocalDbPool(databaseUrl);
  const reads = createReadService({ pool });
  const writes = createWriteService({ pool });

  function enforceWriteKill() {
    const state = killService.readOne(KillDomain.COMMAND_CENTER_WRITE_ACTIONS);
    if (state.ok && state.state === KillState.ACTIVE) {
      return json(423, {
        ok: false,
        code: 'COMMAND_CENTER_WRITE_ACTIONS_KILLED',
        killState: KillState.ACTIVE,
      });
    }
    return null;
  }

  async function dispatch(req = {}) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || '');
    const body = req.body || {};
    const query = req.query || {};

    if (!path.startsWith(INTERNAL_BFF_PREFIX)) {
      return json(404, { ok: false, code: 'NOT_INTERNAL_OPS_NAMESPACE' });
    }

    const auth = gateOpsRequest({
      principal: req.principal,
      session: req.session,
      sharedSecretContext: req.sharedSecretContext,
    });
    if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

    // Alias probe (validation helper)
    if (method === 'POST' && path === `${INTERNAL_BFF_PREFIX}/sot/resolve`) {
      const resolved = resolveSotAlias({
        alias: body.alias,
        canonicalResourceType: body.canonical_resource_type,
      });
      if (!resolved.ok) return json(resolved.status, resolved);
      return json(200, resolved);
    }

    // Kill status / control — always available to Owner (recovery path)
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/kill-status`) {
      const all = killService.readAll();
      return json(200, {
        ok: true,
        domains: all.domains,
        count: all.count,
        persistenceAdapter: killService.persistenceAdapter,
        killStatePersisted: false,
      });
    }

    const killAct = match(path, `${INTERNAL_BFF_PREFIX}/kill/:domain/activate`);
    if (method === 'POST' && killAct) {
      const result = killService.activateKill({
        domain: killAct.domain,
        reason: body.reason,
        principal: req.principal,
        session: req.session,
        sharedSecretContext: req.sharedSecretContext,
        correlationId: body.correlation_id || req.correlationId,
      });
      if (!result.ok) return json(403, result);
      return json(200, { ...result, killStatePersisted: false });
    }
    const killDeact = match(path, `${INTERNAL_BFF_PREFIX}/kill/:domain/deactivate`);
    if (method === 'POST' && killDeact) {
      const result = killService.deactivateKill({
        domain: killDeact.domain,
        reason: body.reason,
        principal: req.principal,
        session: req.session,
        sharedSecretContext: req.sharedSecretContext,
        correlationId: body.correlation_id || req.correlationId,
      });
      if (!result.ok) return json(403, result);
      return json(200, { ...result, killStatePersisted: false });
    }

    // Reads
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/inbox`) {
      return json(200, await reads.listInbox({ limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/cases`) {
      return json(200, await reads.listCases({ limit: query.limit }));
    }
    const caseDetail = match(path, `${INTERNAL_BFF_PREFIX}/cases/:id/detail`);
    if (method === 'GET' && caseDetail) {
      const r = await reads.getCaseDetail(caseDetail.id);
      return json(r.status, r);
    }
    const caseGet = match(path, `${INTERNAL_BFF_PREFIX}/cases/:id`);
    if (method === 'GET' && caseGet) {
      const r = await reads.getCase(caseGet.id);
      return json(r.status, r);
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/case-notes`) {
      return json(200, await reads.listCaseNotes({ caseId: query.case_id, limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/tasks`) {
      return json(200, await reads.listTasks({ caseId: query.case_id, limit: query.limit }));
    }
    const taskDetail = match(path, `${INTERNAL_BFF_PREFIX}/tasks/:id/detail`);
    if (method === 'GET' && taskDetail) {
      const r = await reads.getTaskDetail(taskDetail.id);
      return json(r.status, r);
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/reminders`) {
      return json(200, await reads.listReminders({ limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/assignments`) {
      return json(200, await reads.listAssignments({ caseId: query.case_id, limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/status-history`) {
      return json(
        200,
        await reads.listStatusHistory({
          caseId: query.case_id,
          targetType: query.target_type || 'case',
          limit: query.limit,
        }),
      );
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/communication-events`) {
      return json(
        200,
        await reads.listCommunicationEvents({
          caseId: query.case_id,
          limit: query.limit,
        }),
      );
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/ops-audit-events`) {
      return json(200, await reads.listOpsAuditEvents({ limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/approvals`) {
      return json(200, await reads.listApprovals({ limit: query.limit }));
    }
    if (method === 'GET' && path === `${INTERNAL_BFF_PREFIX}/outbox-health`) {
      return json(200, await reads.outboxHealth({ limit: query.limit }));
    }

    // Limited writes — kill gate (except kill control above)
    const writeMap = {
      [`${INTERNAL_BFF_PREFIX}/writes/internal-note`]: LimitedWriteOperation.INTERNAL_NOTE_CREATE,
      [`${INTERNAL_BFF_PREFIX}/writes/contact-attempt`]: LimitedWriteOperation.CONTACT_ATTEMPT_RECORD,
      [`${INTERNAL_BFF_PREFIX}/writes/tasks`]: LimitedWriteOperation.TASK_CREATE,
      [`${INTERNAL_BFF_PREFIX}/writes/task-status`]: LimitedWriteOperation.TASK_STATUS_UPDATE,
      [`${INTERNAL_BFF_PREFIX}/writes/assignments`]: LimitedWriteOperation.ASSIGNMENT_SET,
      [`${INTERNAL_BFF_PREFIX}/writes/case-status`]: LimitedWriteOperation.CASE_STATUS_APPEND,
      [`${INTERNAL_BFF_PREFIX}/writes/approval-requests`]: LimitedWriteOperation.APPROVAL_REQUEST_CREATE,
      [`${INTERNAL_BFF_PREFIX}/writes/approval-decisions`]: LimitedWriteOperation.APPROVAL_DECISION_OWNER_ONLY,
    };

    if (method === 'POST' && writeMap[path]) {
      const killed = enforceWriteKill();
      if (killed) return killed;
      const result = await writes.executeLimitedWrite({
        operation: writeMap[path],
        body,
        actor: auth,
        correlationId: body.correlation_id || req.correlationId,
        clientIdempotencyKey: body.idempotency_key || req.idempotencyKey,
      });
      return json(result.status || (result.ok ? 201 : 400), result);
    }

    // Explicitly reject unauthorized write surfaces
    if (method === 'POST' && path.startsWith(`${INTERNAL_BFF_PREFIX}/writes/`)) {
      return json(422, { ok: false, code: 'UNAUTHORIZED_WRITE_SURFACE' });
    }

    return json(404, { ok: false, code: 'ROUTE_NOT_FOUND' });
  }

  return {
    prefix: INTERNAL_BFF_PREFIX,
    dispatch,
    killService,
    pool,
    async close() {
      await pool.end();
    },
  };
}
