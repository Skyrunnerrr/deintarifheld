/**
 * A11 operator command registry. Bounded commands only.
 * Identity comes from server session. Client role is ignored as authority.
 */
import { createHash } from 'node:crypto';
import {
  OperatorCommandType,
  COMMANDS_REQUIRING_REASON,
  HIGH_RISK_COMMANDS,
  A11ErrorCode,
  isOperatorCommandType,
  isKillDomain,
} from '@deintarifheld/shared';
import {
  activateTakeover,
  resumeWorkflowControl,
  setGlobalKill,
  setDomainKill,
  readFreshControlSnapshot,
} from '../workflow/control.js';
import { reprocessDeadLetter as reprocessJob } from '../workflow/transitions.js';
import { recordSyntheticOfferApproval, recordOfferApprovalRejection } from '../a8/approval.js';
import { recordSyntheticSwitchApproval, recordSwitchApprovalRejection } from '../a9/submit.js';
import { applyProviderDeliveryEvent, executeCommunicationSend } from '../a4/communicate.js';
import { reconcileAppointment } from '../a5/booking.js';
import { reconcileOfferDelivery } from '../a8/deliver.js';
import { reconcileSwitchAttempt } from '../a9/reconcile.js';
import { applyLifecycleProviderEvent } from '../a10/activate.js';
import { approveContentRevision, rejectContentRevision } from '../a12/approval.js';
import { cancelContentPublication, reconcileContentPublication } from '../a12/publish.js';
import { approveAcquisitionCampaign, rejectAcquisitionCampaign } from '../a13/approval.js';
import {
  activateAcquisitionCampaign,
  pauseAcquisitionCampaign,
  reconcileAcquisitionCampaign,
  cancelAcquisitionCampaign,
} from '../a13/activate.js';
import { authorizeOperatorCommand } from './operator-authz.js';
import { withAuthorizedOperatorTransaction } from './operator-db-context.js';

function payloadHash(commandType, targetId, expectedRevision, extra) {
  return createHash('sha256')
    .update(JSON.stringify({ commandType, targetId, expectedRevision, extra: extra || {} }))
    .digest('hex');
}

async function hasRel(pool, name) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS c`, [name]);
  return Boolean(rows[0]?.c);
}

async function loadCommandLog(client, key) {
  const { rows } = await client.query(
    `SELECT * FROM ops.operator_commands WHERE idempotency_key=$1 FOR UPDATE`,
    [key],
  );
  return rows[0] || null;
}

async function insertCommandLog(client, row) {
  const { rows } = await client.query(
    `INSERT INTO ops.operator_commands
      (command_type, idempotency_key, operator_person_id, operator_role, operator_id,
       authority_version, required_capability, target_type, target_id,
       correlation_id, expected_revision, reason, payload_hash, result_code, result_json, control_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
     RETURNING *`,
    [
      row.commandType,
      row.idempotencyKey,
      row.operatorPersonId,
      row.operatorRole,
      row.operatorId || null,
      row.authorityVersion ?? null,
      row.requiredCapability || null,
      row.targetType,
      row.targetId,
      row.correlationId,
      row.expectedRevision || null,
      row.reason || null,
      row.payloadHash,
      row.resultCode,
      JSON.stringify(row.resultJson),
      row.controlVersion || null,
    ],
  );
  return rows[0];
}

async function auditWrite(poolOrClient, { eventType, detail }) {
  await poolOrClient.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ($1,$2::jsonb)`,
    [eventType, JSON.stringify(detail)],
  );
}

async function workflowsForCase(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT id, status FROM workflow.workflow_instances WHERE case_id=$1 AND status NOT IN ('COMPLETED','CANCELLED')`,
    [String(caseId)],
  );
  return rows;
}

export async function executeOperatorCommand(pool, envelope = {}, identity) {
  if (!identity?.operatorId) {
    return { ok: false, status: 403, code: A11ErrorCode.NOT_AUTHORIZED };
  }

  const commandType = envelope.commandType;
  if (!isOperatorCommandType(commandType)) {
    return { ok: false, status: 422, code: A11ErrorCode.UNKNOWN_COMMAND };
  }

  const auth = await authorizeOperatorCommand(pool, {
    operatorId: identity.operatorId,
    commandType,
    expectedAuthorityVersion: envelope.expectedAuthorityVersion,
    clientRole: envelope.role || envelope.operatorRole,
    clientCapabilities: envelope.capabilities,
    clientOperatorId: envelope.operatorId,
    clientAuthUserId: envelope.authUserId,
    clientPersonId: envelope.personId,
  });
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status || 403,
      code: auth.a11Code || A11ErrorCode.NOT_AUTHORIZED,
      authzCode: auth.code,
    };
  }

  const trustedIdentity = {
    ...identity,
    role: auth.role,
    authorityVersion: auth.authorityVersion,
    requiredCapability: auth.requiredCapability,
  };

  const idempotencyKey = String(envelope.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    return { ok: false, status: 422, code: A11ErrorCode.IDEMPOTENCY_KEY_REQUIRED };
  }
  const correlationId = envelope.correlationId || idempotencyKey;
  const targetId = envelope.targetId;
  const expectedRevision = envelope.expectedRevision || envelope.expectedControlVersion || null;
  const reason = envelope.reason ? String(envelope.reason).slice(0, 500) : '';
  if (COMMANDS_REQUIRING_REASON.includes(commandType) && !reason.trim()) {
    return { ok: false, status: 422, code: A11ErrorCode.REASON_REQUIRED };
  }
  if (HIGH_RISK_COMMANDS.includes(commandType) && envelope.confirm !== true) {
    return { ok: false, status: 422, code: A11ErrorCode.CONFIRMATION_REQUIRED };
  }

  if (!(await hasRel(pool, 'ops.operator_commands'))) {
    return { ok: false, status: 503, code: 'OPERATOR_COMMAND_SCHEMA_MISSING' };
  }

  const hash = payloadHash(commandType, targetId, expectedRevision, {
    active: envelope.active,
    domain: envelope.domain,
    toStatus: envelope.toStatus,
    title: envelope.title,
  });

  return withAuthorizedOperatorTransaction(
    pool,
    { authzEvidence: auth, requestId: correlationId, verifyFreshness: true },
    async (client) => {
      const replay = await loadCommandLog(client, idempotencyKey);
      if (replay) {
        if (replay.payload_hash !== hash) {
          return { ok: false, status: 409, code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' };
        }
        return {
          ok: true,
          idempotentReplay: true,
          status: 200,
          ...(replay.result_json || {}),
        };
      }

      let result;
      await client.query('SAVEPOINT m11k_operator_dispatch');
      try {
        result = await dispatchCommand(client, {
          commandType,
          targetId,
          expectedRevision,
          reason,
          envelope,
          identity: trustedIdentity,
          correlationId,
        });
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT m11k_operator_dispatch');
        if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || err?.message === 'CONTROL_STATE_UNAVAILABLE') {
          result = { ok: false, status: 503, code: A11ErrorCode.CONTROL_UNAVAILABLE };
        } else {
          result = {
            ok: false,
            status: 500,
            code: 'COMMAND_FAILED',
            detail: err?.code || err?.message || 'unknown',
          };
        }
      }

      const snap = await readFreshControlSnapshot(client).catch(() => ({ controlVersion: null }));
      const stored = {
        ok: result.ok === true,
        code: result.code || (result.ok ? 'OK' : 'FAILED'),
        ...result,
      };
      await insertCommandLog(client, {
        commandType,
        idempotencyKey,
        operatorPersonId: trustedIdentity.personId,
        operatorRole: trustedIdentity.role,
        operatorId: trustedIdentity.operatorId,
        authorityVersion: trustedIdentity.authorityVersion,
        requiredCapability: trustedIdentity.requiredCapability,
        targetType: commandType,
        targetId: targetId ? String(targetId) : null,
        correlationId,
        expectedRevision: expectedRevision ? String(expectedRevision) : null,
        reason,
        payloadHash: hash,
        resultCode: stored.code,
        resultJson: stored,
        controlVersion: snap.controlVersion,
      });
      if (result.ok) {
        await auditWrite(client, {
          eventType: `a11.command.${commandType}`,
          detail: {
            actor: trustedIdentity.personId,
            operator_id: trustedIdentity.operatorId,
            actor_type: 'PERSON_PRINCIPAL',
            role: trustedIdentity.role,
            authority_version: trustedIdentity.authorityVersion,
            required_capability: trustedIdentity.requiredCapability,
            command_type: commandType,
            target_id: targetId,
            correlation_id: correlationId,
            request_id: correlationId,
            control_version: snap.controlVersion,
            result: stored.code,
          },
        });
      }

      return { ...result, idempotentReplay: false, status: result.ok ? 200 : result.status || 400 };
    },
  ).catch(async (err) => {
    if (err?.code === '23505') {
      const again = await pool.query(
        `SELECT result_json FROM ops.operator_commands WHERE idempotency_key=$1`,
        [idempotencyKey],
      );
      if (again.rows[0]) {
        return { ok: true, idempotentReplay: true, status: 200, ...(again.rows[0].result_json || {}) };
      }
    }
    throw err;
  });
}

async function dispatchCommand(pool, ctx) {
  const { commandType, targetId, expectedRevision, reason, identity, correlationId } = ctx;
  const envelope = ctx.envelope || {};
  switch (commandType) {
    case OperatorCommandType.TAKEOVER_CASE:
      return takeoverCase(pool, { caseId: targetId, reason, actor: identity.personId, correlationId, expectedRevision });
    case OperatorCommandType.RESUME_CASE:
      return resumeCase(pool, { caseId: targetId, reason, actor: identity.personId, correlationId, expectedRevision });
    case OperatorCommandType.APPROVE_OFFER:
      return decideOffer(pool, { revisionId: targetId, expectedRevision, approve: true, actorType: 'HUMAN' });
    case OperatorCommandType.REJECT_OFFER_APPROVAL:
      return decideOffer(pool, { revisionId: targetId, expectedRevision, approve: false, actorType: 'HUMAN', reason });
    case OperatorCommandType.APPROVE_SWITCH_SUBMISSION:
      return decideSwitch(pool, { attemptId: targetId, expectedRevision, approve: true, actorType: 'HUMAN' });
    case OperatorCommandType.REJECT_SWITCH_SUBMISSION:
      return decideSwitch(pool, { attemptId: targetId, expectedRevision, approve: false, actorType: 'HUMAN', reason });
    case OperatorCommandType.REPROCESS_JOB:
      return reprocess(pool, { jobId: targetId, actor: identity.personId, correlationId });
    case OperatorCommandType.RECONCILE_COMMUNICATION:
      return reconcileCommunication(pool, envelope);
    case OperatorCommandType.RECONCILE_APPOINTMENT:
      return reconcileAppointment(pool, { appointmentId: targetId });
    case OperatorCommandType.RECONCILE_OFFER_DELIVERY:
      return reconcileOfferDelivery(pool, { offerRevisionId: targetId });
    case OperatorCommandType.RECONCILE_SWITCH:
      return reconcileSwitchAttempt(pool, { switchAttemptId: targetId });
    case OperatorCommandType.RECONCILE_LIFECYCLE:
      return reconcileLifecycle(pool, envelope);
    case OperatorCommandType.APPROVE_CONTENT:
      return approveContentRevision(pool, {
        revisionId: targetId,
        expectedHash: expectedRevision || envelope.contentHash || null,
        actorType: 'HUMAN',
      });
    case OperatorCommandType.REJECT_CONTENT:
      return rejectContentRevision(pool, {
        revisionId: targetId,
        actorType: 'HUMAN',
        reasonCode: reason || 'OPERATOR_REJECTED',
      });
    case OperatorCommandType.CANCEL_CONTENT_PUBLICATION:
      return cancelContentPublication(pool, {
        intentId: envelope.intentId || targetId,
        contentItemId: envelope.contentItemId || null,
        reason: reason || 'OPERATOR_CANCEL',
      });
    case OperatorCommandType.RECONCILE_CONTENT_PUBLICATION:
      return reconcileContentPublication(pool, { intentId: targetId });
    case OperatorCommandType.APPROVE_ACQUISITION_CAMPAIGN:
      return approveAcquisitionCampaign(pool, {
        revisionId: targetId,
        expectedBudgetHash: expectedRevision || envelope.budgetHash || null,
        actorType: 'HUMAN',
      });
    case OperatorCommandType.REJECT_ACQUISITION_CAMPAIGN:
      return rejectAcquisitionCampaign(pool, {
        revisionId: targetId,
        actorType: 'HUMAN',
        reasonCode: reason || 'OPERATOR_REJECTED',
      });
    case OperatorCommandType.ACTIVATE_ACQUISITION_CAMPAIGN:
      return activateAcquisitionCampaign(pool, { campaignId: targetId });
    case OperatorCommandType.PAUSE_ACQUISITION_CAMPAIGN:
      return pauseAcquisitionCampaign(pool, {
        campaignId: targetId,
        reason: reason || 'OPERATOR_PAUSE',
      });
    case OperatorCommandType.CANCEL_ACQUISITION_CAMPAIGN:
      return cancelAcquisitionCampaign(pool, {
        campaignId: targetId,
        reason: reason || 'OPERATOR_CANCEL',
      });
    case OperatorCommandType.RECONCILE_ACQUISITION_CAMPAIGN:
      return reconcileAcquisitionCampaign(pool, {
        intentId: envelope.intentId || null,
        campaignId: targetId,
      });
    case OperatorCommandType.SET_GLOBAL_KILL:
      return setKillGlobal(pool, envelope, identity, reason, correlationId, expectedRevision);
    case OperatorCommandType.SET_DOMAIN_KILL:
      return setKillDomain(pool, envelope, identity, reason, correlationId, expectedRevision);
    case OperatorCommandType.CREATE_TASK:
      return createTask(pool, envelope, identity, correlationId);
    case OperatorCommandType.UPDATE_TASK:
      return updateTask(pool, envelope, identity, correlationId);
    case OperatorCommandType.ADD_NOTE:
      return addNote(pool, envelope, identity, correlationId);
    default:
      return { ok: false, status: 422, code: A11ErrorCode.UNKNOWN_COMMAND };
  }
}

async function takeoverCase(pool, { caseId, reason, actor, correlationId, expectedRevision }) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };
  const wfs = await workflowsForCase(pool, caseId);
  if (expectedRevision) {
    const snap = await readFreshControlSnapshot(pool, { workflowId: wfs[0]?.id });
    if (String(snap.controlVersion) !== String(expectedRevision)) {
      return { ok: false, status: 409, code: A11ErrorCode.STALE_OPERATOR_VIEW, controlVersion: snap.controlVersion };
    }
  }
  const results = [];
  for (const wf of wfs) {
    results.push(await activateTakeover(pool, wf.id, { reason, actor, correlationId }));
  }
  const snap = await readFreshControlSnapshot(pool, { workflowId: wfs[0]?.id });
  return { ok: true, takeoverActive: true, workflows: results.length, controlVersion: snap.controlVersion };
}

async function resumeCase(pool, { caseId, reason, actor, correlationId, expectedRevision }) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT w.id FROM workflow.workflow_instances w
     JOIN security.control_state cs ON cs.scope='WORKFLOW' AND cs.scope_key=w.id::text
     WHERE w.case_id=$1 AND cs.state='TAKEOVER'`,
    [String(caseId)],
  );
  if (expectedRevision && rows[0]) {
    const snap = await readFreshControlSnapshot(pool, { workflowId: rows[0].id });
    if (String(snap.controlVersion) !== String(expectedRevision)) {
      return { ok: false, status: 409, code: A11ErrorCode.STALE_OPERATOR_VIEW, controlVersion: snap.controlVersion };
    }
  }
  for (const wf of rows) {
    await resumeWorkflowControl(pool, wf.id, { reason, actor, correlationId });
  }
  return { ok: true, takeoverActive: false, resumed: rows.length };
}

async function decideOffer(pool, { revisionId, expectedRevision, approve, actorType, reason }) {
  if (!revisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT r.id, r.is_current, r.commercial_snapshot_hash, a.decision
     FROM ops.offer_revisions r
     LEFT JOIN ops.offer_approvals a ON a.offer_revision_id=r.id
     WHERE r.id=$1`,
    [revisionId],
  );
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, status: 409, code: A11ErrorCode.STALE_APPROVAL };
  if (expectedRevision && expectedRevision !== rev.commercial_snapshot_hash && expectedRevision !== String(rev.id)) {
    return { ok: false, status: 409, code: A11ErrorCode.STALE_APPROVAL };
  }
  if (approve) {
    const r = await recordSyntheticOfferApproval(pool, { revisionId, actorType });
    if (r.duplicate) return { ok: true, duplicate: true, ...r };
    return r;
  }
  return recordOfferApprovalRejection(pool, { revisionId, actorType, reasonCode: reason || 'OPERATOR_REJECTED' });
}

async function decideSwitch(pool, { attemptId, expectedRevision, approve, actorType, reason }) {
  if (!attemptId) return { ok: false, code: 'ATTEMPT_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT t.id, t.is_current, t.payload_hash, a.decision, a.payload_hash AS approval_hash
     FROM ops.switch_attempts t
     LEFT JOIN ops.switch_approvals a ON a.switch_attempt_id=t.id
     WHERE t.id=$1`,
    [attemptId],
  );
  const att = rows[0];
  if (!att) return { ok: false, code: 'ATTEMPT_NOT_FOUND' };
  if (!att.is_current) return { ok: false, status: 409, code: A11ErrorCode.STALE_APPROVAL };
  if (expectedRevision && expectedRevision !== att.payload_hash) {
    return { ok: false, status: 409, code: A11ErrorCode.STALE_APPROVAL };
  }
  if (att.approval_hash && att.payload_hash && att.approval_hash !== att.payload_hash) {
    return { ok: false, status: 409, code: A11ErrorCode.STALE_APPROVAL };
  }
  if (approve) return recordSyntheticSwitchApproval(pool, { attemptId, actorType });
  return recordSwitchApprovalRejection(pool, { attemptId, actorType, reasonCode: reason || 'OPERATOR_REJECTED' });
}

async function reprocess(pool, { jobId, actor, correlationId }) {
  if (!jobId) return { ok: false, code: 'JOB_ID_REQUIRED' };
  const r = await reprocessJob(pool, jobId, { actor, correlationId });
  if (!r.ok) return { ok: false, status: 422, code: r.code || A11ErrorCode.NOT_REPROCESSABLE };
  return r;
}

async function reconcileCommunication(pool, envelope) {
  const intentId = envelope.targetId;
  if (!intentId) return { ok: false, code: 'INTENT_ID_REQUIRED' };
  const { rows } = await pool.query(`SELECT * FROM ops.outbound_intents WHERE id=$1`, [intentId]);
  const intent = rows[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND' };
  if (['OUTCOME_UNKNOWN', 'RECONCILIATION_REQUIRED'].includes(intent.state)) {
    if (envelope.providerEventId && envelope.eventType && envelope.providerMessageId) {
      return applyProviderDeliveryEvent(pool, {
        providerEventId: envelope.providerEventId,
        eventType: envelope.eventType,
        providerMessageId: envelope.providerMessageId,
      });
    }
    const blocked = await executeCommunicationSend(pool, { intentId });
    return {
      ok: true,
      code: A11ErrorCode.RECONCILIATION_REQUIRED,
      blindRetry: false,
      providerCalls: blocked.providerCalls || 0,
      explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT RESUBMIT BLINDLY.',
    };
  }
  return { ok: false, code: 'NOT_RECONCILABLE', state: intent.state };
}

async function reconcileLifecycle(pool, envelope) {
  if (!envelope.targetId) return { ok: false, code: 'LIFECYCLE_ID_REQUIRED' };
  if (!envelope.replayKey || !envelope.providerStatus) {
    return {
      ok: true,
      code: A11ErrorCode.RECONCILIATION_REQUIRED,
      explanation: 'Lifecycle provider event required. No invented status.',
    };
  }
  return applyLifecycleProviderEvent(pool, {
    lifecycleId: envelope.targetId,
    replayKey: envelope.replayKey,
    status: envelope.providerStatus,
    productRef: envelope.productRef,
  });
}

async function setKillGlobal(pool, envelope, identity, reason, correlationId, expectedRevision) {
  const snap = await readFreshControlSnapshot(pool);
  if (expectedRevision && String(expectedRevision) !== String(snap.controlVersion)) {
    return { ok: false, status: 409, code: A11ErrorCode.STALE_OPERATOR_VIEW, controlVersion: snap.controlVersion };
  }
  const active = envelope.active === true;
  const r = await setGlobalKill(pool, active, { reason, actor: identity.personId, correlationId });
  const after = await readFreshControlSnapshot(pool);
  return { ok: true, globalKillActive: after.globalKillActive, controlVersion: after.controlVersion, previous: r };
}

async function setKillDomain(pool, envelope, identity, reason, correlationId, expectedRevision) {
  const domain = envelope.domain;
  if (!isKillDomain(domain)) {
    return { ok: false, status: 422, code: 'UNKNOWN_CONTROL_DOMAIN' };
  }
  const snap = await readFreshControlSnapshot(pool, { domain });
  if (expectedRevision && String(expectedRevision) !== String(snap.controlVersion)) {
    return { ok: false, status: 409, code: A11ErrorCode.STALE_OPERATOR_VIEW, controlVersion: snap.controlVersion };
  }
  const r = await setDomainKill(pool, domain, envelope.active === true, {
    reason,
    actor: identity.personId,
    correlationId,
  });
  const after = await readFreshControlSnapshot(pool, { domain });
  return { ok: true, domain, domainKillActive: after.domainKillActive, controlVersion: after.controlVersion, previous: r };
}

async function createTask(pool, envelope, identity, correlationId) {
  if (!(await hasRel(pool, 'public.tasks'))) {
    return { ok: false, code: 'TASK_SCHEMA_MISSING' };
  }
  if (!envelope.caseId || !envelope.title) return { ok: false, status: 422, code: A11ErrorCode.VALIDATION_FAILED };
  const { rows } = await pool.query(
    `INSERT INTO public.tasks
      (case_id, title, description, status, assigned_person_id,
       created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
     VALUES ($1,$2,$3,'open',$4,$5,'PERSON_PRINCIPAL',$5,$6)
     RETURNING id, status`,
    [envelope.caseId, String(envelope.title).slice(0, 200), envelope.description || null, envelope.assignedPersonId || identity.personId, identity.personId, correlationId],
  );
  return { ok: true, taskId: rows[0].id, status: rows[0].status, domainAuthorityChanged: false };
}

async function updateTask(pool, envelope, identity, correlationId) {
  if (!(await hasRel(pool, 'public.tasks'))) return { ok: false, code: 'TASK_SCHEMA_MISSING' };
  const allowed = ['open', 'in_progress', 'waiting', 'done', 'cancelled'];
  if (!envelope.targetId || !allowed.includes(envelope.toStatus)) {
    return { ok: false, status: 422, code: A11ErrorCode.VALIDATION_FAILED };
  }
  const { rows } = await pool.query(
    `UPDATE public.tasks SET status=$2, updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id, status`,
    [envelope.targetId, envelope.toStatus],
  );
  if (!rows[0]) return { ok: false, status: 404, code: 'TASK_NOT_FOUND' };
  return { ok: true, taskId: rows[0].id, status: rows[0].status, domainAuthorityChanged: false, correlationId };
}

async function addNote(pool, envelope, identity, correlationId) {
  if (!(await hasRel(pool, 'public.case_notes'))) return { ok: false, code: 'NOTE_SCHEMA_MISSING' };
  if (!envelope.caseId || !envelope.body) return { ok: false, status: 422, code: A11ErrorCode.VALIDATION_FAILED };
  const { rows } = await pool.query(
    `INSERT INTO public.case_notes
      (case_id, body, sot_event_type, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
     VALUES ($1,$2,'CASE_NOTE',$3,'PERSON_PRINCIPAL',$3,$4)
     RETURNING id`,
    [envelope.caseId, String(envelope.body).slice(0, 4000), identity.personId, correlationId],
  );
  return { ok: true, noteId: rows[0].id, domainAuthorityChanged: false };
}
