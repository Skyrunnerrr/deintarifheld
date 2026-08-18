/**
 * A9 provider readback / reconciliation / confirmation / A10 handoff.
 */
import {
  SwitchAttemptState,
  SwitchCaseStatus,
  SwitchStatusRank,
  CUSTOMER_LIFECYCLE_PREPARE_CAPABILITY,
  SwitchFactSource,
  SwitchFieldCode,
} from '@deintarifheld/shared';
import { enqueueOfferJob } from '../a8/prepare.js';
import { switchControlGate, getSwitchCase } from './prepare.js';
import { createTestSwitchProvider } from './provider.js';
import { requestSwitchConfirmation } from './communicate-switch.js';

function rankOf(status) {
  const map = {
    PENDING: SwitchStatusRank.SUPPLIER_PENDING,
    ACCEPTED: SwitchStatusRank.SUBMISSION_ACCEPTED,
    REJECTED: SwitchStatusRank.REJECTED,
    CONFIRMED: SwitchStatusRank.CONFIRMED,
    MISMATCH: SwitchStatusRank.REVIEW_REQUIRED,
  };
  return map[status] ?? 0;
}

export async function applyProviderEvent(pool, {
  attemptId, replayKey, status, productRef, confirmedStart, reasonCode,
} = {}) {
  const { rows: attRows } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [attemptId]);
  const att = attRows[0];
  if (!att) return { ok: false, code: 'ATTEMPT_NOT_FOUND' };
  const incomingRank = rankOf(status);
  const { rows: last } = await pool.query(
    `SELECT COALESCE(MAX(status_rank),0)::int AS r FROM ops.switch_provider_events WHERE switch_attempt_id=$1`,
    [attemptId],
  );
  const currentRank = last[0].r;
  if (incomingRank < currentRank) {
    await pool.query(
      `INSERT INTO ops.switch_provider_events
        (switch_attempt_id, replay_key, status, status_rank, reason_code, product_ref, confirmed_start)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (switch_attempt_id, replay_key) DO NOTHING`,
      [attemptId, replayKey, status, incomingRank, reasonCode || null, productRef || null, confirmedStart || null],
    );
    return { ok: true, ignored: true, reason: 'OUT_OF_ORDER' };
  }
  const ins = await pool.query(
    `INSERT INTO ops.switch_provider_events
      (switch_attempt_id, replay_key, status, status_rank, reason_code, product_ref, confirmed_start)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (switch_attempt_id, replay_key) DO NOTHING
     RETURNING id`,
    [attemptId, replayKey, status, incomingRank, reasonCode || null, productRef || null, confirmedStart || null],
  );
  if (!ins.rows[0]) return { ok: true, replay: true };
  return { ok: true, applied: true, rank: incomingRank };
}

export async function createLifecycleHandoff(pool, { attemptId } = {}) {
  const { rows: attRows } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [attemptId]);
  const att = attRows[0];
  if (!att || att.state !== SwitchAttemptState.CONFIRMED) {
    return { ok: false, code: 'NOT_CONFIRMED' };
  }
  const sc = await getSwitchCase(pool, att.switch_case_id);
  const payload = att.payload_snapshot || {};
  const ins = await pool.query(
    `INSERT INTO ops.lifecycle_handoffs
      (case_id, offer_revision_id, switch_attempt_id, provider_order_id,
       selected_tariff_version_id, confirmed_start, energy_type, supply_point_count, renewal_scheduled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
     ON CONFLICT (switch_attempt_id) DO NOTHING
     RETURNING id`,
    [
      sc.case_id,
      sc.offer_revision_id,
      att.id,
      att.provider_order_id,
      sc.selected_tariff_version_id,
      att.confirmed_start,
      payload.energy_type,
      att.supply_point_count,
    ],
  );
  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.lifecycle_handoffs WHERE switch_attempt_id=$1`,
    [attemptId],
  );
  await enqueueOfferJob(pool, {
    caseId: sc.case_id,
    jobType: CUSTOMER_LIFECYCLE_PREPARE_CAPABILITY,
    idempotencyKey: `a10-lifecycle:${attemptId}`,
    payload: {
      case_id: sc.case_id,
      switch_attempt_id: attemptId,
      offer_revision_id: sc.offer_revision_id,
      schema_version: 1,
    },
    priority: 70,
  });
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('switch.a10_handoff_created',$1::jsonb)`,
    [JSON.stringify({ switch_attempt_id: attemptId, inserted: Boolean(ins.rows[0]) })],
  );
  return {
    ok: true,
    inserted: Boolean(ins.rows[0]),
    handoffId: existing[0]?.id,
    renewalScheduled: false,
    nextCapability: CUSTOMER_LIFECYCLE_PREPARE_CAPABILITY,
  };
}

export async function ackCustomerLifecyclePrepare(pool, { switchAttemptId } = {}) {
  const { rows } = await pool.query(
    `SELECT id FROM ops.lifecycle_handoffs WHERE switch_attempt_id=$1`,
    [switchAttemptId],
  );
  if (!rows[0]) {
    return createLifecycleHandoff(pool, { attemptId: switchAttemptId });
  }
  return { ok: true, handoffId: rows[0].id, duplicate: true, renewalScheduled: false };
}

export async function reconcileSwitchAttempt(pool, {
  switchAttemptId,
  switchProvider = null,
} = {}) {
  if (!switchAttemptId) return { ok: false, code: 'ATTEMPT_ID_REQUIRED' };
  const gate = await switchControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  const { rows: attRows } = await pool.query(`SELECT * FROM ops.switch_attempts WHERE id=$1`, [switchAttemptId]);
  const att = attRows[0];
  if (!att) return { ok: false, code: 'ATTEMPT_NOT_FOUND' };
  const sc = await getSwitchCase(pool, att.switch_case_id);
  const provider = switchProvider || createTestSwitchProvider();
  const rb = await provider.getSubmission({
    idempotencyKey: att.idempotency_key,
    providerOrderId: att.provider_order_id,
  });

  if (rb.class === 'READBACK_NOT_FOUND') {
    if (att.state === SwitchAttemptState.OUTCOME_UNKNOWN) {
      await pool.query(
        `UPDATE ops.switch_cases SET status='RECONCILIATION_REQUIRED', updated_at=now() WHERE id=$1`,
        [sc.id],
      );
      await pool.query(
        `INSERT INTO public.audit_events (event_type, detail)
         VALUES ('switch.reconciliation_required',$1::jsonb)`,
        [JSON.stringify({ switch_attempt_id: switchAttemptId, class: 'ABSENT' })],
      );
      return { ok: true, absent: true, retryEligible: true, blindRetry: false };
    }
    return { ok: true, absent: true };
  }

  const order = rb.order || {};
  const payload = att.payload_snapshot || {};

  if (rb.class === 'READBACK_MISMATCH' || (order.productRef && order.productRef !== payload.tariff_version_id)) {
    await applyProviderEvent(pool, {
      attemptId: switchAttemptId,
      replayKey: `mismatch:${order.providerOrderId || att.idempotency_key}`,
      status: 'MISMATCH',
      productRef: order.productRef,
    });
    await pool.query(
      `UPDATE ops.switch_attempts SET state='REVIEW_REQUIRED', updated_at=now() WHERE id=$1 AND state <> 'CONFIRMED'`,
      [switchAttemptId],
    );
    await pool.query(
      `UPDATE ops.switch_cases SET status='REVIEW_REQUIRED', updated_at=now() WHERE id=$1 AND status <> 'CONFIRMED'`,
      [sc.id],
    );
    return { ok: true, mismatch: true, code: 'PROVIDER_COMMERCIAL_MISMATCH', confirmed: false };
  }

  if (rb.class === 'READBACK_REJECTED' || order.status === 'REJECTED') {
    await applyProviderEvent(pool, {
      attemptId: switchAttemptId,
      replayKey: `rejected:${order.providerOrderId || att.id}`,
      status: 'REJECTED',
      reasonCode: order.reasonCode,
    });
    await pool.query(
      `UPDATE ops.switch_attempts SET state='REJECTED', rejection_category=$2, updated_at=now()
       WHERE id=$1 AND state <> 'CONFIRMED'`,
      [switchAttemptId, order.reasonCode || 'UNKNOWN'],
    );
    await pool.query(
      `UPDATE ops.switch_cases SET status='REJECTED', updated_at=now() WHERE id=$1 AND status <> 'CONFIRMED'`,
      [sc.id],
    );
    return { ok: true, rejected: true, confirmed: false };
  }

  if (rb.class === 'READBACK_PENDING' || order.status === 'PENDING') {
    await applyProviderEvent(pool, {
      attemptId: switchAttemptId,
      replayKey: `pending:${order.providerOrderId || att.idempotency_key}`,
      status: 'PENDING',
      productRef: order.productRef,
    });
    return { ok: true, pending: true, confirmed: false };
  }

  if (rb.class === 'READBACK_CONFIRMED' || order.status === 'CONFIRMED') {
    const ev = await applyProviderEvent(pool, {
      attemptId: switchAttemptId,
      replayKey: `confirmed:${order.providerOrderId || att.idempotency_key}`,
      status: 'CONFIRMED',
      productRef: order.productRef,
      confirmedStart: order.confirmedStart,
    });
    if (ev.ignored) {
      return { ok: true, confirmed: true, already: true };
    }
    await pool.query(
      `UPDATE ops.switch_attempts
       SET state='CONFIRMED', provider_order_id=COALESCE(provider_order_id,$2),
           confirmed_start=$3, updated_at=now()
       WHERE id=$1`,
      [switchAttemptId, order.providerOrderId || att.provider_order_id, order.confirmedStart || null],
    );
    await pool.query(
      `UPDATE ops.switch_cases SET status='CONFIRMED', updated_at=now() WHERE id=$1`,
      [sc.id],
    );
    if (order.confirmedStart) {
      await pool.query(
        `INSERT INTO ops.switch_facts (switch_case_id, field_code, value_text, source, commercial_relevant)
         VALUES ($1,$2,$3,$4,false)`,
        [sc.id, SwitchFieldCode.REQUESTED_START, String(order.confirmedStart), SwitchFactSource.PROVIDER_RETURNED],
      );
    }
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('switch.confirmed',$1::jsonb)`,
      [JSON.stringify({
        switch_attempt_id: switchAttemptId,
        provider_order_id: order.providerOrderId || att.provider_order_id,
      })],
    );
    const handoff = await createLifecycleHandoff(pool, { attemptId: switchAttemptId });
    await requestSwitchConfirmation(pool, {
      caseId: sc.case_id,
      confirmedStart: order.confirmedStart,
      productCode: payload.product_code,
      supplierName: payload.supplier_name,
    }).catch(() => ({ ok: false }));
    return { ok: true, confirmed: true, handoff };
  }

  return { ok: true, found: true, class: rb.class };
}
