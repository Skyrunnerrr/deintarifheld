/**
 * Durable control plane — global/domain kill, pause, takeover, CONTROL_VERSION.
 * Fail-closed: unreadability blocks autonomous execution.
 */
import {
  ControlScope,
  ControlStateValue,
  isKillDomain,
} from '@deintarifheld/shared';
import { isPgPool } from '../pg-pool-or-client.js';

const GLOBAL_KEY = 'AUTOMATION';

export async function readControlVersion(client) {
  const { rows } = await client.query(
    `SELECT version FROM security.control_version WHERE id = 1`,
  );
  if (!rows[0]) {
    const err = new Error('CONTROL_STATE_UNAVAILABLE');
    err.code = 'CONTROL_STATE_UNAVAILABLE';
    throw err;
  }
  return Number(rows[0].version);
}

export async function bumpControlVersion(client, { reason, actor, correlationId, scope, scopeKey, fromState, toState }) {
  const { rows } = await client.query(
    `UPDATE security.control_version
     SET version = version + 1, updated_at = now()
     WHERE id = 1
     RETURNING version`,
  );
  const version = Number(rows[0].version);
  await client.query(
    `INSERT INTO security.control_audit
      (scope, scope_key, from_state, to_state, control_version, reason, actor, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      scope,
      scopeKey,
      fromState ?? null,
      toState,
      version,
      reason ?? null,
      actor ?? 'SYSTEM',
      correlationId ?? null,
    ],
  );
  return version;
}

async function upsertControl(client, { scope, scopeKey, state, reason, actor, correlationId }) {
  const existing = await client.query(
    `SELECT state FROM security.control_state WHERE scope = $1 AND scope_key = $2`,
    [scope, scopeKey],
  );
  const fromState = existing.rows[0]?.state ?? null;
  await client.query(
    `INSERT INTO security.control_state (scope, scope_key, state, reason, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (scope, scope_key) DO UPDATE
       SET state = EXCLUDED.state,
           reason = EXCLUDED.reason,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [scope, scopeKey, state, reason ?? null, actor ?? 'SYSTEM'],
  );
  const version = await bumpControlVersion(client, {
    scope,
    scopeKey,
    fromState,
    toState: state,
    reason,
    actor,
    correlationId,
  });
  return { version, fromState, state };
}

export async function withControlTx(poolOrClient, fn) {
  if (!isPgPool(poolOrClient)) {
    return fn(poolOrClient);
  }
  const client = await poolOrClient.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function setGlobalKill(pool, active, { reason, actor, correlationId } = {}) {
  return withControlTx(pool, (client) =>
    upsertControl(client, {
      scope: ControlScope.GLOBAL,
      scopeKey: GLOBAL_KEY,
      state: active ? ControlStateValue.ACTIVE : ControlStateValue.INACTIVE,
      reason,
      actor,
      correlationId,
    }),
  );
}

export async function setDomainKill(pool, domain, active, { reason, actor, correlationId } = {}) {
  if (!isKillDomain(domain)) {
    throw new Error(`UNKNOWN_CONTROL_DOMAIN:${domain}`);
  }
  return withControlTx(pool, (client) =>
    upsertControl(client, {
      scope: ControlScope.DOMAIN,
      scopeKey: domain,
      state: active ? ControlStateValue.ACTIVE : ControlStateValue.INACTIVE,
      reason,
      actor,
      correlationId,
    }),
  );
}

export async function pauseWorkflowControl(pool, workflowId, { reason, actor, correlationId } = {}) {
  return withControlTx(pool, async (client) => {
    await client.query(
      `UPDATE workflow.workflow_instances
       SET status = 'PAUSED', paused_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('RUNNING','WAITING','BLOCKED_EXCEPTION')`,
      [workflowId],
    );
    return upsertControl(client, {
      scope: ControlScope.WORKFLOW,
      scopeKey: String(workflowId),
      state: ControlStateValue.PAUSED,
      reason,
      actor,
      correlationId,
    });
  });
}

export async function resumeWorkflowControl(pool, workflowId, { reason, actor, correlationId } = {}) {
  return withControlTx(pool, async (client) => {
    await client.query(
      `UPDATE workflow.workflow_instances
       SET status = 'RUNNING', paused_at = NULL, updated_at = now()
       WHERE id = $1 AND status = 'PAUSED'`,
      [workflowId],
    );
    return upsertControl(client, {
      scope: ControlScope.WORKFLOW,
      scopeKey: String(workflowId),
      state: ControlStateValue.INACTIVE,
      reason,
      actor,
      correlationId,
    });
  });
}

export async function activateTakeover(pool, workflowId, { reason, actor, correlationId } = {}) {
  return withControlTx(pool, async (client) => {
    await client.query(
      `UPDATE workflow.workflow_instances
       SET status = 'PAUSED', paused_at = now(), updated_at = now()
       WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')`,
      [workflowId],
    );
    return upsertControl(client, {
      scope: ControlScope.WORKFLOW,
      scopeKey: String(workflowId),
      state: ControlStateValue.TAKEOVER,
      reason: reason ?? 'HUMAN_TAKEOVER',
      actor,
      correlationId,
    });
  });
}

/**
 * Fresh control snapshot for claim / pre-effect checks.
 * Throws CONTROL_STATE_UNAVAILABLE on any read failure.
 */
export async function readFreshControlSnapshot(poolOrClient, { workflowId, domain } = {}) {
  const q = async (sql, params) => {
    if (typeof poolOrClient.query === 'function' && !poolOrClient.connect) {
      return poolOrClient.query(sql, params);
    }
    return poolOrClient.query(sql, params);
  };

  try {
    const versionRes = await q(`SELECT version FROM security.control_version WHERE id = 1`);
    if (!versionRes.rows[0]) {
      const err = new Error('CONTROL_STATE_UNAVAILABLE');
      err.code = 'CONTROL_STATE_UNAVAILABLE';
      throw err;
    }
    const controlVersion = Number(versionRes.rows[0].version);

    const globalRes = await q(
      `SELECT state FROM security.control_state WHERE scope = 'GLOBAL' AND scope_key = $1`,
      [GLOBAL_KEY],
    );
    if (!globalRes.rows[0]) {
      const err = new Error('CONTROL_STATE_UNAVAILABLE');
      err.code = 'CONTROL_STATE_UNAVAILABLE';
      throw err;
    }
    const globalKillActive = globalRes.rows[0].state === ControlStateValue.ACTIVE;

    let domainKillActive = false;
    if (domain) {
      const d = await q(
        `SELECT state FROM security.control_state WHERE scope = 'DOMAIN' AND scope_key = $1`,
        [domain],
      );
      domainKillActive = d.rows[0]?.state === ControlStateValue.ACTIVE;
    }

    let workflowPaused = false;
    let takeoverActive = false;
    if (workflowId) {
      const w = await q(
        `SELECT state FROM security.control_state WHERE scope = 'WORKFLOW' AND scope_key = $1`,
        [String(workflowId)],
      );
      const st = w.rows[0]?.state;
      workflowPaused = st === ControlStateValue.PAUSED || st === ControlStateValue.TAKEOVER;
      takeoverActive = st === ControlStateValue.TAKEOVER;

      const wi = await q(
        `SELECT status FROM workflow.workflow_instances WHERE id = $1`,
        [workflowId],
      );
      if (wi.rows[0]?.status === 'PAUSED') workflowPaused = true;
    }

    return {
      controlVersion,
      globalKillActive,
      domainKillActive,
      workflowPaused,
      takeoverActive,
      mayClaim: !globalKillActive && !domainKillActive && !workflowPaused,
      mayExecuteEffect: !globalKillActive && !domainKillActive && !workflowPaused && !takeoverActive,
    };
  } catch (err) {
    if (err.code === 'CONTROL_STATE_UNAVAILABLE') throw err;
    const wrapped = new Error('CONTROL_STATE_UNAVAILABLE');
    wrapped.code = 'CONTROL_STATE_UNAVAILABLE';
    wrapped.cause = err;
    throw wrapped;
  }
}

export async function evaluatePreEffectControl(pool, job) {
  const snap = await readFreshControlSnapshot(pool, {
    workflowId: job.workflow_instance_id,
    domain: job.control_domain || null,
  });
  if (snap.globalKillActive) {
    return { allowed: false, code: 'GLOBAL_KILL_ACTIVE', snap };
  }
  if (snap.domainKillActive) {
    return { allowed: false, code: 'DOMAIN_KILL_ACTIVE', snap };
  }
  if (snap.takeoverActive) {
    return { allowed: false, code: 'TAKEOVER_ACTIVE', snap };
  }
  if (snap.workflowPaused) {
    return { allowed: false, code: 'WORKFLOW_PAUSED', snap };
  }
  if (Number(job.control_version) < snap.controlVersion) {
    return { allowed: false, code: 'STALE_CONTROL_VERSION', snap };
  }
  return { allowed: true, code: 'OK', snap };
}
