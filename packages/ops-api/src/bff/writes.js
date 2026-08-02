/**
 * P3-F3 limited writes — atomic domain + ops_audit + transactional_outbox.
 * No schema changes. No worker dispatch.
 */
import { createHash } from 'node:crypto';
import {
  CASE_NOTE_SOT_TYPE,
  COMMUNICATION_EVENT_SOT_TYPE,
  SotResourceType,
  resolveSotAlias,
} from '@deintarifheld/shared';
import { CASE_STATUSES, LimitedWriteOperation, TASK_STATUSES } from './constants.js';
import { withTransaction } from './db.js';

function payloadHash(operation, body) {
  // correlation_id / idempotency_key are transport metadata, not semantic payload
  const { correlation_id: _c, idempotency_key: _i, ...semantic } = body || {};
  return createHash('sha256')
    .update(JSON.stringify({ operation, semantic }))
    .digest('hex');
}

function outboxKey(operation, clientKey) {
  return `bff:${operation}:${clientKey}`;
}

async function findIdempotent(client, key) {
  const { rows } = await client.query(
    `SELECT id, event_type, aggregate_type, aggregate_id, payload_redacted, status
     FROM public.transactional_outbox WHERE idempotency_key = $1`,
    [key],
  );
  return rows[0] || null;
}

async function insertAudit(client, { actor, action, targetType, targetId, result, correlationId, metadata = {} }) {
  const { rows } = await client.query(
    `INSERT INTO public.ops_audit_events
      (actor_type, actor_id, session_id, action, target_type, target_id, result, source, correlation_id, metadata_redacted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'ops_api',$8,$9::jsonb)
     RETURNING id`,
    [
      actor.actorType,
      actor.actorId,
      actor.sessionId,
      action,
      targetType,
      targetId,
      result,
      correlationId,
      JSON.stringify(metadata),
    ],
  );
  return rows[0].id;
}

async function insertOutbox(client, {
  eventType,
  aggregateType,
  aggregateId,
  idempotencyKey,
  correlationId,
  payloadRedacted,
}) {
  const { rows } = await client.query(
    `INSERT INTO public.transactional_outbox
      (event_type, aggregate_type, aggregate_id, payload_redacted, idempotency_key, correlation_id, status)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,'pending')
     RETURNING id`,
    [eventType, aggregateType, aggregateId, JSON.stringify(payloadRedacted), idempotencyKey, correlationId],
  );
  return rows[0].id;
}

function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] == null || (typeof body[f] === 'string' && body[f].trim() === '')) {
      return { ok: false, status: 422, code: 'VALIDATION_FAILED', field: f };
    }
  }
  return { ok: true };
}

export function createWriteService({ pool }) {
  async function executeLimitedWrite({
    operation,
    body = {},
    actor,
    correlationId,
    clientIdempotencyKey,
  }) {
    if (!clientIdempotencyKey || String(clientIdempotencyKey).trim() === '') {
      return { ok: false, status: 422, code: 'IDEMPOTENCY_KEY_REQUIRED' };
    }
    if (!correlationId || String(correlationId).trim() === '') {
      return { ok: false, status: 422, code: 'CORRELATION_ID_REQUIRED' };
    }

    const key = outboxKey(operation, String(clientIdempotencyKey).trim());
    const hash = payloadHash(operation, body);

    try {
      return await withTransaction(pool, async (client) => {
        const existing = await findIdempotent(client, key);
        if (existing) {
          const prevHash = existing.payload_redacted?.payload_hash;
          if (prevHash && prevHash !== hash) {
            return { ok: false, status: 409, code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' };
          }
          await insertAudit(client, {
            actor,
            action: `${operation}:IDEMPOTENT_REPLAY`,
            targetType: existing.aggregate_type,
            targetId: existing.aggregate_id,
            result: 'noop',
            correlationId,
            metadata: { idempotency_key: key },
          });
          return {
            ok: true,
            status: 200,
            idempotentReplay: true,
            canonical_resource_type: existing.aggregate_type,
            canonical_resource_id: existing.aggregate_id,
            alias_resolution: existing.payload_redacted?.alias_resolution || null,
          };
        }

        let result;
        switch (operation) {
          case LimitedWriteOperation.INTERNAL_NOTE_CREATE:
            result = await writeInternalNote(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.CONTACT_ATTEMPT_RECORD:
            result = await writeContactAttempt(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.TASK_CREATE:
            result = await writeTaskCreate(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.TASK_STATUS_UPDATE:
            result = await writeTaskStatus(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.ASSIGNMENT_SET:
            result = await writeAssignment(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.CASE_STATUS_APPEND:
            result = await writeCaseStatusAppend(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.APPROVAL_REQUEST_CREATE:
            result = await writeApprovalRequest(client, { body, actor, correlationId });
            break;
          case LimitedWriteOperation.APPROVAL_DECISION_OWNER_ONLY:
            result = await writeApprovalDecision(client, { body, actor, correlationId });
            break;
          default:
            return { ok: false, status: 422, code: 'UNAUTHORIZED_WRITE_OPERATION' };
        }
        if (!result.ok) return result;

        await insertAudit(client, {
          actor,
          action: operation,
          targetType: result.canonical_resource_type,
          targetId: result.canonical_resource_id,
          result: 'success',
          correlationId,
          metadata: { idempotency_key: key },
        });
        await insertOutbox(client, {
          eventType: operation,
          aggregateType: result.canonical_resource_type,
          aggregateId: result.canonical_resource_id,
          idempotencyKey: key,
          correlationId,
          payloadRedacted: {
            payload_hash: hash,
            alias_resolution: result.alias_resolution,
          },
        });

        return {
          ok: true,
          status: 201,
          idempotentReplay: false,
          canonical_resource_type: result.canonical_resource_type,
          canonical_resource_id: result.canonical_resource_id,
          alias_resolution: result.alias_resolution,
        };
      });
    } catch (err) {
      return {
        ok: false,
        status: 500,
        code: 'TRANSACTION_FAILED',
        detail: err?.code || err?.message || 'unknown',
      };
    }
  }

  return { executeLimitedWrite };
}

async function writeInternalNote(client, { body, actor, correlationId }) {
  const aliasRes = resolveSotAlias({
    alias: body.alias || 'INTERNAL_NOTE',
    canonicalResourceType: body.canonical_resource_type || SotResourceType.CASE_NOTE,
  });
  if (!aliasRes.ok) return { ...aliasRes, ok: false };
  if (aliasRes.canonicalResourceType !== SotResourceType.CASE_NOTE) {
    return { ok: false, status: 422, code: 'CANONICAL_MISMATCH' };
  }
  const v = requireFields(body, ['case_id', 'body']);
  if (!v.ok) return v;

  const { rows } = await client.query(
    `INSERT INTO public.case_notes
      (case_id, body, sot_event_type, created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      body.case_id,
      body.body,
      CASE_NOTE_SOT_TYPE,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.CASE_NOTE,
    canonical_resource_id: rows[0].id,
    alias_resolution: aliasRes.aliasResolution,
  };
}

async function writeContactAttempt(client, { body, actor, correlationId }) {
  const aliasRes = resolveSotAlias({
    alias: body.alias || 'CONTACT_ATTEMPT',
    canonicalResourceType: body.canonical_resource_type || SotResourceType.COMMUNICATION_EVENT,
  });
  if (!aliasRes.ok) return { ...aliasRes, ok: false };
  if (aliasRes.canonicalResourceType !== SotResourceType.COMMUNICATION_EVENT) {
    return { ok: false, status: 422, code: 'CANONICAL_MISMATCH' };
  }
  const v = requireFields(body, ['case_id']);
  if (!v.ok) return v;

  const { rows } = await client.query(
    `INSERT INTO public.communication_events
      (case_id, sot_event_type, channel, direction, metadata_redacted,
       created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
     RETURNING id`,
    [
      body.case_id,
      COMMUNICATION_EVENT_SOT_TYPE.CONTACT_ATTEMPT,
      body.channel || 'other_ops',
      body.direction || 'outbound',
      JSON.stringify(body.metadata_redacted || {}),
      actor.actorId,
      actor.actorType,
      actor.actorId,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.COMMUNICATION_EVENT,
    canonical_resource_id: rows[0].id,
    alias_resolution: aliasRes.aliasResolution,
  };
}

async function writeTaskCreate(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['case_id', 'title']);
  if (!v.ok) return v;
  const { rows } = await client.query(
    `INSERT INTO public.tasks
      (case_id, title, description, status, assigned_person_id,
       created_by_person_id, created_by_actor_type, created_by_actor_id, correlation_id)
     VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      body.case_id,
      body.title,
      body.description || null,
      body.assigned_person_id || actor.actorId,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.TASK,
    canonical_resource_id: rows[0].id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}

async function writeTaskStatus(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['task_id', 'to_status']);
  if (!v.ok) return v;
  if (!TASK_STATUSES.includes(body.to_status)) {
    return { ok: false, status: 422, code: 'UNKNOWN_TASK_STATUS' };
  }
  const cur = await client.query(`SELECT id, status FROM public.tasks WHERE id = $1 AND deleted_at IS NULL`, [
    body.task_id,
  ]);
  if (!cur.rows[0]) return { ok: false, status: 404, code: 'TASK_NOT_FOUND' };
  const from = cur.rows[0].status;
  await client.query(
    `UPDATE public.tasks SET status = $1, updated_at = now() WHERE id = $2`,
    [body.to_status, body.task_id],
  );
  await client.query(
    `INSERT INTO public.status_history
      (target_type, target_id, from_status, to_status, changed_by_person_id, changed_by_actor_type, changed_by_actor_id, reason, correlation_id)
     VALUES ('task',$1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      body.task_id,
      from,
      body.to_status,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      body.reason || null,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.TASK,
    canonical_resource_id: body.task_id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}

async function writeAssignment(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['case_id', 'assigned_person_id']);
  if (!v.ok) return v;
  // end previous open assignments
  await client.query(
    `UPDATE public.case_assignments SET ended_at = now()
     WHERE case_id = $1 AND ended_at IS NULL AND deleted_at IS NULL`,
    [body.case_id],
  );
  const { rows } = await client.query(
    `INSERT INTO public.case_assignments
      (case_id, assigned_person_id, assigned_by_person_id, assigned_by_actor_type, assigned_by_actor_id, reason, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      body.case_id,
      body.assigned_person_id,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      body.reason || null,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.ASSIGNMENT,
    canonical_resource_id: rows[0].id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}

async function writeCaseStatusAppend(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['case_id', 'to_status']);
  if (!v.ok) return v;
  if (!CASE_STATUSES.includes(body.to_status)) {
    return { ok: false, status: 422, code: 'UNKNOWN_CASE_STATUS' };
  }
  const cur = await client.query(`SELECT id, status FROM public.cases WHERE id = $1 AND deleted_at IS NULL`, [
    body.case_id,
  ]);
  if (!cur.rows[0]) return { ok: false, status: 404, code: 'CASE_NOT_FOUND' };
  const from = cur.rows[0].status;
  await client.query(`UPDATE public.cases SET status = $1, updated_at = now() WHERE id = $2`, [
    body.to_status,
    body.case_id,
  ]);
  const { rows } = await client.query(
    `INSERT INTO public.status_history
      (target_type, target_id, from_status, to_status, changed_by_person_id, changed_by_actor_type, changed_by_actor_id, reason, correlation_id)
     VALUES ('case',$1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      body.case_id,
      from,
      body.to_status,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      body.reason || null,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.CASE_STATUS,
    canonical_resource_id: rows[0].id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}

async function writeApprovalRequest(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['requested_action', 'target_type']);
  if (!v.ok) return v;
  const { rows } = await client.query(
    `INSERT INTO public.approval_requests
      (requested_action, target_type, target_id, requester_person_id, requester_actor_type, requester_actor_id, reason, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      body.requested_action,
      body.target_type,
      body.target_id || null,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      body.reason || null,
      correlationId,
    ],
  );
  return {
    ok: true,
    canonical_resource_type: SotResourceType.APPROVAL_REQUEST,
    canonical_resource_id: rows[0].id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}

async function writeApprovalDecision(client, { body, actor, correlationId }) {
  const v = requireFields(body, ['approval_request_id', 'decision']);
  if (!v.ok) return v;
  if (!['approved', 'rejected'].includes(body.decision)) {
    return { ok: false, status: 422, code: 'UNKNOWN_DECISION' };
  }
  const req = await client.query(`SELECT id, status FROM public.approval_requests WHERE id = $1`, [
    body.approval_request_id,
  ]);
  if (!req.rows[0]) return { ok: false, status: 404, code: 'APPROVAL_REQUEST_NOT_FOUND' };
  const { rows } = await client.query(
    `INSERT INTO public.approval_decisions
      (approval_request_id, decision, decided_by_person_id, decided_by_actor_type, decided_by_actor_id, reason, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      body.approval_request_id,
      body.decision,
      actor.actorId,
      actor.actorType,
      actor.actorId,
      body.reason || null,
      correlationId,
    ],
  );
  await client.query(`UPDATE public.approval_requests SET status = $1 WHERE id = $2`, [
    body.decision === 'approved' ? 'approved' : 'rejected',
    body.approval_request_id,
  ]);
  return {
    ok: true,
    canonical_resource_type: SotResourceType.APPROVAL_DECISION,
    canonical_resource_id: rows[0].id,
    alias_resolution: 'CANONICAL_DIRECT',
  };
}
