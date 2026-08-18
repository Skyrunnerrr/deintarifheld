/**
 * A10 activation + provider lifecycle divergence. Stale if switch no longer confirmed.
 */
import { LifecycleStatus, LifecycleStatusRank, LifecycleException } from '@deintarifheld/shared';
import { SwitchAttemptState } from '@deintarifheld/shared';
import { hasTakeover } from '../a8/prepare.js';
import { lifecycleControlGate, getLifecycle, getCurrentContractSnapshot } from './prepare.js';
import { compareIsoDate, todayIso } from './dates.js';
import { createTestLifecycleProvider } from './provider.js';
import { enqueueOfferJob } from '../a8/prepare.js';
import { RENEWAL_WINDOW_OPEN_CAPABILITY } from '@deintarifheld/shared';
import { mergeLifecyclePolicy } from './policy.js';
import { addCalendarDays } from './dates.js';

export async function activateLifecycleDue(pool, {
  lifecycleId, asOf = new Date(), lifecycleProvider = null, policy: policyOver = {},
} = {}) {
  if (!lifecycleId) return { ok: false, code: 'LIFECYCLE_ID_REQUIRED' };
  const gate = await lifecycleControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  const lc = await getLifecycle(pool, lifecycleId);
  if (!lc) return { ok: false, code: 'LIFECYCLE_NOT_FOUND' };
  if (await hasTakeover(pool, lc.case_id)) return { ok: false, code: 'TAKEOVER' };
  if (['CANCELLED', 'ENDED'].includes(lc.status)) {
    return { ok: true, skipped: true, reason: 'TERMINAL', status: lc.status };
  }
  if (lc.status === LifecycleStatus.ACTIVE || LifecycleStatusRank[lc.status] >= LifecycleStatusRank.ACTIVE) {
    if (lc.status !== LifecycleStatus.PRE_ACTIVE) {
      return { ok: true, already: true, status: lc.status };
    }
  }

  const { rows: att } = await pool.query(`SELECT state FROM ops.switch_attempts WHERE id=$1`, [lc.switch_attempt_id]);
  if (!att[0] || att[0].state !== SwitchAttemptState.CONFIRMED) {
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='EXCEPTION', exception_code=$2, updated_at=now() WHERE id=$1`,
      [lifecycleId, LifecycleException.PROVIDER_DIVERGENCE],
    );
    await pool.query(
      `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail) VALUES ($1,'lifecycle.provider_divergence',$2::jsonb)`,
      [lifecycleId, JSON.stringify({ reason: 'SWITCH_NOT_CONFIRMED' })],
    );
    return { ok: false, code: 'STALE_ACTIVATION', activated: false };
  }

  const provider = lifecycleProvider || createTestLifecycleProvider();
  const st = await provider.getContractStatus({ lifecycleId });
  if (st.status === 'CANCELLED') {
    return cancelLifecycle(pool, { lifecycleId, reason: 'PROVIDER_CANCELLED' });
  }
  if (st.status === 'PRODUCT_MISMATCH') {
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='EXCEPTION', exception_code=$2, updated_at=now() WHERE id=$1`,
      [lifecycleId, LifecycleException.COMMERCIAL_MISMATCH],
    );
    return { ok: false, code: 'LIFECYCLE_COMMERCIAL_MISMATCH', activated: false };
  }

  const asOfDate = todayIso(asOf);
  if (compareIsoDate(isoDate(lc.confirmed_supply_start), asOfDate) > 0) {
    return { ok: true, activated: false, status: LifecycleStatus.PRE_ACTIVE };
  }

  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='ACTIVE', activated_at=now(), updated_at=now()
     WHERE id=$1 AND status='PRE_ACTIVE'`,
    [lifecycleId],
  );
  await pool.query(
    `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail)
     VALUES ($1,'lifecycle.activated',$2::jsonb)`,
    [lifecycleId, JSON.stringify({ as_of: asOfDate })],
  );

  const snap = await getCurrentContractSnapshot(pool, lifecycleId);
  const policy = mergeLifecyclePolicy(policyOver);
  if (snap && !snap.term_incomplete && snap.notice_deadline) {
    const windowOpen = addCalendarDays(isoDate(snap.notice_deadline), -Number(policy.renewalLeadDays || 0));
    await enqueueOfferJob(pool, {
      caseId: lc.case_id,
      jobType: RENEWAL_WINDOW_OPEN_CAPABILITY,
      idempotencyKey: `renewal-window:${lifecycleId}:${lc.fingerprint}`,
      scheduledAt: `${windowOpen}T00:00:00.000Z`,
      payload: { lifecycle_id: lifecycleId, fingerprint: lc.fingerprint, schema_version: 1 },
      priority: 70,
    });
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='RENEWAL_MONITORING', updated_at=now() WHERE id=$1 AND status='ACTIVE'`,
      [lifecycleId],
    );
  }
  return { ok: true, activated: true, status: LifecycleStatus.ACTIVE };
}

function isoDate(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function cancelLifecycle(pool, { lifecycleId, reason = 'CANCELLED' } = {}) {
  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='CANCELLED', ended_at=now(), updated_at=now() WHERE id=$1 AND status NOT IN ('ENDED','CANCELLED')`,
    [lifecycleId],
  );
  await pool.query(
    `UPDATE ops.renewal_cycles SET is_current=false, status='STALE' WHERE lifecycle_id=$1 AND is_current=true`,
    [lifecycleId],
  );
  await pool.query(
    `UPDATE workflow.jobs SET status='CANCELLED', updated_at=now()
     WHERE status IN ('READY','LEASED') AND payload_redacted->>'lifecycle_id'=$1`,
    [String(lifecycleId)],
  );
  await pool.query(
    `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail) VALUES ($1,'lifecycle.cancelled',$2::jsonb)`,
    [lifecycleId, JSON.stringify({ reason })],
  );
  return { ok: true, status: 'CANCELLED' };
}

export async function endLifecycle(pool, { lifecycleId, confirmedEnd } = {}) {
  await pool.query(
    `UPDATE ops.customer_lifecycles SET status='ENDED', ended_at=now(), updated_at=now() WHERE id=$1`,
    [lifecycleId],
  );
  if (confirmedEnd) {
    await pool.query(
      `UPDATE ops.lifecycle_contract_snapshots SET confirmed_contract_end=$2
       WHERE id=(SELECT id FROM ops.lifecycle_contract_snapshots WHERE lifecycle_id=$1 ORDER BY revision DESC LIMIT 1)`,
      [lifecycleId, confirmedEnd],
    );
  }
  await pool.query(
    `UPDATE ops.renewal_cycles SET is_current=false, status='STALE' WHERE lifecycle_id=$1 AND is_current=true`,
    [lifecycleId],
  );
  await pool.query(
    `UPDATE workflow.jobs SET status='CANCELLED', updated_at=now()
     WHERE status IN ('READY','LEASED') AND payload_redacted->>'lifecycle_id'=$1`,
    [String(lifecycleId)],
  );
  await pool.query(
    `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail) VALUES ($1,'lifecycle.ended',$2::jsonb)`,
    [lifecycleId, JSON.stringify({ confirmed_end: confirmedEnd || null })],
  );
  return { ok: true, status: 'ENDED' };
}

export async function applyLifecycleProviderEvent(pool, {
  lifecycleId, replayKey, status, productRef,
} = {}) {
  const rank = {
    PRE_ACTIVE: LifecycleStatusRank.PRE_ACTIVE,
    ACTIVE: LifecycleStatusRank.ACTIVE,
    CANCELLED: LifecycleStatusRank.CANCELLED,
    ENDED: LifecycleStatusRank.ENDED,
    PRODUCT_MISMATCH: LifecycleStatusRank.EXCEPTION,
  }[status] || 0;
  const { rows: last } = await pool.query(
    `SELECT COALESCE(MAX(status_rank),0)::int AS r FROM ops.lifecycle_provider_events WHERE lifecycle_id=$1`,
    [lifecycleId],
  );
  if (rank < last[0].r) {
    await pool.query(
      `INSERT INTO ops.lifecycle_provider_events (lifecycle_id, replay_key, status, status_rank, product_ref)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (lifecycle_id, replay_key) DO NOTHING`,
      [lifecycleId, replayKey, status, rank, productRef || null],
    );
    return { ok: true, ignored: true, reason: 'OUT_OF_ORDER' };
  }
  const ins = await pool.query(
    `INSERT INTO ops.lifecycle_provider_events (lifecycle_id, replay_key, status, status_rank, product_ref)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (lifecycle_id, replay_key) DO NOTHING RETURNING id`,
    [lifecycleId, replayKey, status, rank, productRef || null],
  );
  if (!ins.rows[0]) return { ok: true, replay: true };
  if (status === 'CANCELLED') return cancelLifecycle(pool, { lifecycleId, reason: 'PROVIDER' });
  if (status === 'ENDED') return endLifecycle(pool, { lifecycleId });
  if (status === 'PRODUCT_MISMATCH') {
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='EXCEPTION', exception_code=$2, updated_at=now() WHERE id=$1 AND status NOT IN ('CANCELLED','ENDED')`,
      [lifecycleId, LifecycleException.COMMERCIAL_MISMATCH],
    );
    return { ok: true, mismatch: true };
  }
  return { ok: true, applied: true };
}
