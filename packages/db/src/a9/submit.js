/**
 * A9 durable submission intent + provider call (outside long DB TX).
 */
import {
  SwitchAttemptState,
  SwitchCaseStatus,
  SwitchRejectionCategory,
  SWITCH_RECONCILE_CAPABILITY,
  SwitchStatusRank,
} from '@deintarifheld/shared';
import { enqueueOfferJob, hasTakeover, isCaseActive, resolveOfferContact } from '../a8/prepare.js';
import { switchControlGate, getCurrentSwitchAttempt, getSwitchCase } from './prepare.js';
import { createTestSwitchProvider } from './provider.js';
import { validateSwitchPayload } from './payload.js';
import { SwitchingPolicyV1 } from './policy.js';

export async function recordSyntheticSwitchApproval(pool, { attemptId, actorType = 'SYSTEM_TEST' } = {}) {
  if (!attemptId) return { ok: false, code: 'ATTEMPT_ID_REQUIRED' };
  const { rows } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [attemptId]);
  const att = rows[0];
  if (!att) return { ok: false, code: 'ATTEMPT_NOT_FOUND' };
  if (!att.is_current) return { ok: false, code: 'ATTEMPT_NOT_CURRENT' };
  const { rows: sc } = await pool.query(`SELECT * FROM ops.switch_cases WHERE id=$1`, [att.switch_case_id]);
  const gate = await switchControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  await pool.query(
    `UPDATE ops.switch_approvals
     SET decision='APPROVED', actor_type=$2, decided_at=now(), payload_hash=$3
     WHERE switch_attempt_id=$1`,
    [attemptId, actorType, att.payload_hash],
  );
  await pool.query(`UPDATE ops.switch_attempts SET state='READY', updated_at=now() WHERE id=$1`, [attemptId]);
  await pool.query(`UPDATE ops.switch_cases SET status='READY', updated_at=now() WHERE id=$1`, [att.switch_case_id]);
  await enqueueOfferJob(pool, {
    caseId: sc[0].case_id,
    jobType: 'SWITCH_SUBMIT',
    idempotencyKey: `switch-submit:${attemptId}`,
    payload: { case_id: sc[0].case_id, switch_attempt_id: attemptId, schema_version: 1 },
    priority: 90,
  });
  return { ok: true, attemptId };
}

export async function submitSwitchAttempt(pool, {
  switchAttemptId,
  switchProvider = null,
} = {}) {
  if (!switchAttemptId) return { ok: false, code: 'ATTEMPT_ID_REQUIRED', providerCalls: 0 };
  const provider = switchProvider || createTestSwitchProvider();
  const gate = await switchControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };

  const { rows: attRows } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [switchAttemptId]);
  const att = attRows[0];
  if (!att) return { ok: false, code: 'ATTEMPT_NOT_FOUND', providerCalls: 0 };
  if (!att.is_current) return { ok: false, code: 'ATTEMPT_NOT_CURRENT', providerCalls: 0 };
  if (['REOFFER_REQUIRED', 'CONFIRMED', 'REJECTED', 'REVIEW_REQUIRED'].includes(att.state)) {
    return { ok: false, code: att.state, providerCalls: 0 };
  }

  const sc = await getSwitchCase(pool, att.switch_case_id);
  if (!sc) return { ok: false, code: 'SWITCH_CASE_MISSING', providerCalls: 0 };
  if (await hasTakeover(pool, sc.case_id)) return { ok: false, code: 'TAKEOVER', providerCalls: 0 };
  const contact = await resolveOfferContact(pool, sc.case_id);
  if (!contact || !isCaseActive(contact.caseStatus)) {
    return { ok: false, code: 'CASE_NOT_ACTIVE', providerCalls: 0 };
  }

  const { rows: appr } = await pool.query(
    `SELECT * FROM ops.switch_approvals WHERE switch_attempt_id=$1`,
    [switchAttemptId],
  );
  if (!appr[0] || appr[0].decision !== 'APPROVED') {
    return { ok: false, code: 'APPROVAL_MISSING', providerCalls: 0 };
  }
  if (appr[0].payload_hash !== att.payload_hash) {
    return { ok: false, code: 'STALE_SWITCH_APPROVAL', providerCalls: 0 };
  }

  const payload = att.payload_snapshot;
  const v = validateSwitchPayload(payload, SwitchingPolicyV1.requiredFields);
  if (!v.ok) return { ok: false, code: v.code, missing: v.missing, providerCalls: 0 };

  const validation = await provider.validateSubmission(payload);
  if (!validation.ok) {
    if (validation.reasonCode === 'TARIFF_UNAVAILABLE') {
      await markReoffer(pool, att, sc, 'ACCEPTED_TARIFF_UNAVAILABLE');
      return { ok: false, code: 'REOFFER_REQUIRED', reasonCode: validation.reasonCode, providerCalls: 0 };
    }
    return { ok: false, code: 'VALIDATION_REJECT', reasonCode: validation.reasonCode, providerCalls: 0 };
  }

  // TX1: durable intent before provider write
  const client = await pool.connect();
  let intentId;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO ops.switch_submission_intents
        (switch_attempt_id, payload_hash, provider_code, provider_idempotency_key, state)
       VALUES ($1,$2,$3,$4,'CREATED')
       ON CONFLICT (provider_idempotency_key) DO UPDATE SET state = ops.switch_submission_intents.state
       RETURNING *`,
      [switchAttemptId, att.payload_hash, att.provider_code, att.idempotency_key],
    );
    intentId = ins.rows[0].id;
    await client.query(
      `UPDATE ops.switch_attempts SET state='INTENT_CREATED', updated_at=now() WHERE id=$1 AND state IN ('READY','DRAFT')`,
      [switchAttemptId],
    );
    await client.query(
      `UPDATE ops.switch_cases SET status='SUBMITTING', updated_at=now() WHERE id=$1`,
      [sc.id],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('switch.submission_intent_created',$1::jsonb)`,
      [JSON.stringify({ switch_attempt_id: switchAttemptId, intent_id: intentId })],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  // Fresh checks at provider boundary
  const gate2 = await switchControlGate(pool);
  if (!gate2.ok) return { ok: false, code: gate2.code, providerCalls: 0, intentId };
  if (await hasTakeover(pool, sc.case_id)) {
    return { ok: false, code: 'TAKEOVER', providerCalls: 0, intentId };
  }
  const { rows: att2 } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [switchAttemptId]);
  if (att2[0].payload_hash !== att.payload_hash) {
    return { ok: false, code: 'PAYLOAD_CHANGED', providerCalls: 0, intentId };
  }

  await pool.query(
    `UPDATE ops.switch_submission_intents SET state='ATTEMPTED', attempted_at=now() WHERE id=$1`,
    [intentId],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('switch.submission_attempted',$1::jsonb)`,
    [JSON.stringify({ switch_attempt_id: switchAttemptId, intent_id: intentId })],
  );

  // Provider call outside transaction
  const result = await provider.submitSwitch({
    payload,
    idempotencyKey: att.idempotency_key,
  });

  // TX2: persist result
  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    if (result.class === 'SUBMIT_TIMEOUT_UNKNOWN') {
      await client2.query(
        `UPDATE ops.switch_submission_intents SET state='OUTCOME_UNKNOWN' WHERE id=$1`,
        [intentId],
      );
      await client2.query(
        `UPDATE ops.switch_attempts SET state='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
        [switchAttemptId],
      );
      await client2.query(
        `UPDATE ops.switch_cases SET status='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
        [sc.id],
      );
      await client2.query(
        `INSERT INTO public.audit_events (event_type, detail)
         VALUES ('switch.outcome_unknown',$1::jsonb)`,
        [JSON.stringify({ switch_attempt_id: switchAttemptId })],
      );
      await client2.query('COMMIT');
      await enqueueOfferJob(pool, {
        caseId: sc.case_id,
        jobType: SWITCH_RECONCILE_CAPABILITY,
        idempotencyKey: `switch-reconcile:${switchAttemptId}`,
        payload: { switch_attempt_id: switchAttemptId, case_id: sc.case_id, schema_version: 1 },
        priority: 85,
      });
      return {
        ok: true,
        outcomeUnknown: true,
        providerCalls: result.providerCalls || 1,
        blindRetry: false,
        attemptId: switchAttemptId,
      };
    }
    if (result.class === 'SUBMIT_TRANSIENT_KNOWN_NOT_EXECUTED') {
      await client2.query(
        `UPDATE ops.switch_submission_intents SET state='FAILED' WHERE id=$1`,
        [intentId],
      );
      await client2.query(
        `UPDATE ops.switch_attempts SET state='READY', updated_at=now() WHERE id=$1`,
        [switchAttemptId],
      );
      await client2.query(
        `UPDATE ops.switch_cases SET status='READY', updated_at=now() WHERE id=$1`,
        [sc.id],
      );
      await client2.query('COMMIT');
      return {
        ok: false,
        code: 'TRANSIENT_KNOWN_NOT_EXECUTED',
        providerCalls: result.providerCalls || 1,
        retryEligible: true,
      };
    }
    if (!result.ok) {
      const cat = result.reasonCode || SwitchRejectionCategory.UNKNOWN;
      if (cat === 'TARIFF_UNAVAILABLE') {
        await client2.query(
          `UPDATE ops.switch_attempts SET state='REOFFER_REQUIRED', rejection_category=$2, reoffer_reason=$2, updated_at=now() WHERE id=$1`,
          [switchAttemptId, cat],
        );
        await client2.query(
          `UPDATE ops.switch_cases SET status='REOFFER_REQUIRED', updated_at=now() WHERE id=$1`,
          [sc.id],
        );
        await client2.query(
          `INSERT INTO public.audit_events (event_type, detail)
           VALUES ('switch.reoffer_required',$1::jsonb)`,
          [JSON.stringify({ switch_attempt_id: switchAttemptId, reason: cat })],
        );
        await client2.query('COMMIT');
        return { ok: false, code: 'REOFFER_REQUIRED', reasonCode: cat, providerCalls: result.providerCalls || 1 };
      }
      if (cat === 'DUPLICATE_ORDER') {
        await client2.query(
          `UPDATE ops.switch_attempts SET state='OUTCOME_UNKNOWN', rejection_category=$2, updated_at=now() WHERE id=$1`,
          [switchAttemptId, cat],
        );
        await client2.query(
          `UPDATE ops.switch_cases SET status='RECONCILIATION_REQUIRED', updated_at=now() WHERE id=$1`,
          [sc.id],
        );
        await client2.query('COMMIT');
        await enqueueOfferJob(pool, {
          caseId: sc.case_id,
          jobType: SWITCH_RECONCILE_CAPABILITY,
          idempotencyKey: `switch-reconcile:${switchAttemptId}:dup`,
          payload: { switch_attempt_id: switchAttemptId, case_id: sc.case_id, schema_version: 1 },
          priority: 85,
        });
        return { ok: true, duplicateOrder: true, reconcile: true, providerCalls: result.providerCalls || 1 };
      }
      await client2.query(
        `UPDATE ops.switch_attempts SET state='REJECTED', rejection_category=$2, updated_at=now() WHERE id=$1`,
        [switchAttemptId, cat],
      );
      await client2.query(
        `UPDATE ops.switch_cases SET status='REJECTED', updated_at=now() WHERE id=$1`,
        [sc.id],
      );
      await client2.query(
        `INSERT INTO public.audit_events (event_type, detail)
         VALUES ('switch.provider_rejected',$1::jsonb)`,
        [JSON.stringify({ switch_attempt_id: switchAttemptId, reason: cat })],
      );
      await client2.query('COMMIT');
      return { ok: false, code: 'PROVIDER_REJECTED', reasonCode: cat, providerCalls: result.providerCalls || 1 };
    }

    await client2.query(
      `UPDATE ops.switch_submission_intents SET state='PROVIDER_ACCEPTED' WHERE id=$1`,
      [intentId],
    );
    await client2.query(
      `UPDATE ops.switch_attempts
       SET state='SUPPLIER_PENDING', provider_order_id=$2, updated_at=now()
       WHERE id=$1`,
      [switchAttemptId, result.providerOrderId],
    );
    await client2.query(
      `UPDATE ops.switch_cases SET status='SUPPLIER_PENDING', updated_at=now() WHERE id=$1`,
      [sc.id],
    );
    await client2.query(
      `INSERT INTO ops.switch_provider_events
        (switch_attempt_id, replay_key, status, status_rank, product_ref)
       VALUES ($1,$2,'PENDING',$3,$4)
       ON CONFLICT (switch_attempt_id, replay_key) DO NOTHING`,
      [
        switchAttemptId,
        `accepted:${result.providerOrderId}`,
        SwitchStatusRank.SUPPLIER_PENDING,
        payload.tariff_version_id,
      ],
    );
    await client2.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('switch.provider_accepted',$1::jsonb)`,
      [JSON.stringify({
        switch_attempt_id: switchAttemptId,
        provider_order_id: result.providerOrderId,
      })],
    );
    await client2.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('switch.pending',$1::jsonb)`,
      [JSON.stringify({ switch_attempt_id: switchAttemptId })],
    );
    await client2.query('COMMIT');
  } catch (err) {
    try { await client2.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client2.release();
  }

  await enqueueOfferJob(pool, {
    caseId: sc.case_id,
    jobType: SWITCH_RECONCILE_CAPABILITY,
    idempotencyKey: `switch-reconcile:${switchAttemptId}`,
    payload: { switch_attempt_id: switchAttemptId, case_id: sc.case_id, schema_version: 1 },
    priority: 85,
  });

  return {
    ok: true,
    accepted: true,
    pending: true,
    confirmed: false,
    providerOrderId: result.providerOrderId,
    providerCalls: result.providerCalls || 1,
    attemptId: switchAttemptId,
  };
}

async function markReoffer(pool, att, sc, reason) {
  await pool.query(
    `UPDATE ops.switch_attempts SET state='REOFFER_REQUIRED', reoffer_reason=$2, updated_at=now() WHERE id=$1`,
    [att.id, reason],
  );
  await pool.query(
    `UPDATE ops.switch_cases SET status='REOFFER_REQUIRED', updated_at=now() WHERE id=$1`,
    [sc.id],
  );
}

export { getCurrentSwitchAttempt };
