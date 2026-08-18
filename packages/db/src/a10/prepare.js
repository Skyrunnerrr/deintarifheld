/**
 * A10 lifecycle prepare from confirmed A9 switch. No invented dates.
 */
import { createHash } from 'node:crypto';
import {
  KillDomain,
  SwitchAttemptState,
  LifecycleStatus,
  LifecycleException,
  A10_DATE_POLICY_ID,
  A10_DATE_POLICY_VERSION,
  A10_TEST_POLICY_MARKER,
  LIFECYCLE_ACTIVATE_DUE_CAPABILITY,
  RENEWAL_WINDOW_OPEN_CAPABILITY,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { hasTakeover, enqueueOfferJob, isCaseActive, resolveOfferContact } from '../a8/prepare.js';
import { getSwitchCase } from '../a9/prepare.js';
import { mergeLifecyclePolicy } from './policy.js';
import { addCalendarDays, addCalendarMonths, compareIsoDate, todayIso } from './dates.js';

export async function lifecycleControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'LIFECYCLE_DOMAIN_KILL',
        snap,
      };
    }
    return { ok: true, snap };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function fingerprintOf(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function deriveContractAnchors({ confirmedStart, termFacts, policy }) {
  const provenance = {
    confirmed_supply_start: { source: 'A9_PROVIDER_CONFIRMATION', value: confirmedStart },
  };
  let expectedEnd = null;
  let noticeDeadline = null;
  let guaranteeEnd = null;
  let minTermMonths = termFacts?.minTermMonths ?? null;
  let minTermDays = termFacts?.minTermDays ?? null;
  let noticeDays = termFacts?.noticePeriodDays ?? null;
  let termIncomplete = true;

  if (termFacts?.expectedContractEnd) {
    expectedEnd = isoDate(termFacts.expectedContractEnd);
    provenance.expected_contract_end = { source: termFacts.source || 'HUMAN_VERIFIED', value: expectedEnd };
    termIncomplete = false;
  } else if (policy.allowSyntheticTerms && (minTermDays || minTermMonths)) {
    if (minTermMonths) expectedEnd = addCalendarMonths(confirmedStart, minTermMonths);
    else expectedEnd = addCalendarDays(confirmedStart, minTermDays);
    provenance.expected_contract_end = {
      source: A10_TEST_POLICY_MARKER,
      value: expectedEnd,
      derivation: minTermMonths ? `addCalendarMonths(${minTermMonths})` : `addCalendarDays(${minTermDays})`,
    };
    termIncomplete = false;
  } else if (policy.allowSyntheticTerms) {
    minTermDays = policy.syntheticMinTermDays;
    expectedEnd = addCalendarDays(confirmedStart, minTermDays);
    provenance.expected_contract_end = {
      source: A10_TEST_POLICY_MARKER,
      value: expectedEnd,
      derivation: `addCalendarDays(${minTermDays})`,
    };
    termIncomplete = false;
  }

  if (termFacts?.noticePeriodDays != null) noticeDays = termFacts.noticePeriodDays;
  else if (policy.allowSyntheticTerms && !termIncomplete) noticeDays = policy.syntheticNoticeDays;

  if (expectedEnd && noticeDays != null) {
    noticeDeadline = addCalendarDays(expectedEnd, -Number(noticeDays));
    provenance.notice_deadline = {
      source: provenance.expected_contract_end?.source || A10_TEST_POLICY_MARKER,
      value: noticeDeadline,
      derivation: `expected_end - ${noticeDays} days`,
    };
  }

  if (termFacts?.priceGuaranteeEnd) {
    guaranteeEnd = isoDate(termFacts.priceGuaranteeEnd);
    provenance.price_guarantee_end = { source: termFacts.source || 'HUMAN_VERIFIED', value: guaranteeEnd };
  }

  return {
    contractStart: confirmedStart,
    expectedEnd,
    noticeDeadline,
    guaranteeEnd,
    minTermMonths,
    minTermDays,
    noticeDays,
    termIncomplete,
    provenance,
  };
}

export async function prepareLifecycle(pool, {
  switchAttemptId,
  asOf = new Date(),
  policy: policyOver = {},
  termFacts = null,
} = {}) {
  if (!switchAttemptId) return { ok: false, code: 'ATTEMPT_ID_REQUIRED' };
  const { rows: has } = await pool.query(`SELECT to_regclass('ops.customer_lifecycles') AS c`);
  if (!has[0]?.c) return { ok: false, code: 'A10_SCHEMA_MISSING' };

  const policy = mergeLifecyclePolicy(policyOver);
  const gate = await lifecycleControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };

  const { rows: ho } = await pool.query(
    `SELECT h.*, a.state AS attempt_state, a.requested_start
     FROM ops.lifecycle_handoffs h
     JOIN ops.switch_attempts a ON a.id = h.switch_attempt_id
     WHERE h.switch_attempt_id = $1`,
    [switchAttemptId],
  );
  const handoff = ho[0];
  if (!handoff) return { ok: false, code: 'HANDOFF_MISSING' };
  if (handoff.attempt_state !== SwitchAttemptState.CONFIRMED) {
    return { ok: false, code: 'SWITCH_NOT_CONFIRMED' };
  }
  const confirmedStart = isoDate(handoff.confirmed_start);
  if (!confirmedStart) return { ok: false, code: 'CONFIRMED_START_MISSING' };

  const sc = await getSwitchCase(pool, (await pool.query(
    `SELECT switch_case_id FROM ops.switch_attempts WHERE id=$1`,
    [switchAttemptId],
  )).rows[0].switch_case_id);

  const contact = await resolveOfferContact(pool, handoff.case_id);
  if (contact && !isCaseActive(contact.caseStatus)) return { ok: false, code: 'CASE_NOT_ACTIVE' };
  if (await hasTakeover(pool, handoff.case_id)) return { ok: false, code: 'TAKEOVER' };

  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.customer_lifecycles WHERE switch_attempt_id=$1`,
    [switchAttemptId],
  );
  if (existing[0]) {
    return { ok: true, reused: true, lifecycleId: existing[0].id, status: existing[0].status };
  }

  const asOfDate = todayIso(asOf);
  const anchors = deriveContractAnchors({ confirmedStart, termFacts, policy });
  const fp = fingerprintOf([
    confirmedStart,
    String(handoff.selected_tariff_version_id),
    handoff.energy_type || '',
    String(handoff.supply_point_count || 1),
    anchors.expectedEnd || '',
    anchors.noticeDeadline || '',
    anchors.guaranteeEnd || '',
  ]);

  const future = compareIsoDate(confirmedStart, asOfDate) > 0;
  const status = future ? LifecycleStatus.PRE_ACTIVE : LifecycleStatus.ACTIVE;

  const client = await pool.connect();
  let lifecycleId;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO ops.customer_lifecycles
        (case_id, switch_attempt_id, offer_revision_id, predecessor_lifecycle_id,
         energy_type, supply_point_count, tariff_version_id, provider_order_id,
         requested_start, confirmed_supply_start, status, exception_code, fingerprint,
         is_current, activated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14)
       ON CONFLICT (switch_attempt_id) DO NOTHING
       RETURNING *`,
      [
        handoff.case_id,
        switchAttemptId,
        handoff.offer_revision_id,
        policy.predecessorLifecycleId || null,
        handoff.energy_type || 'ELECTRICITY',
        handoff.supply_point_count || 1,
        handoff.selected_tariff_version_id,
        handoff.provider_order_id,
        isoDate(handoff.requested_start),
        confirmedStart,
        status,
        anchors.termIncomplete ? LifecycleException.TERM_DATA_INCOMPLETE : null,
        fp,
        future ? null : asOf.toISOString(),
      ],
    );
    const row = ins.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      const again = await pool.query(`SELECT * FROM ops.customer_lifecycles WHERE switch_attempt_id=$1`, [switchAttemptId]);
      return { ok: true, reused: true, lifecycleId: again.rows[0].id, status: again.rows[0].status };
    }
    lifecycleId = row.id;
    await client.query(
      `INSERT INTO ops.lifecycle_contract_snapshots
        (lifecycle_id, revision, supplier_name, product_code, energy_type, contract_start,
         expected_contract_end, min_term_months, min_term_days, notice_period_days, notice_deadline,
         price_guarantee_end, date_policy_id, date_policy_version, term_incomplete, provenance, fingerprint)
       VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
      [
        lifecycleId,
        sc?.payload ? null : null,
        null,
        handoff.energy_type || 'ELECTRICITY',
        confirmedStart,
        anchors.expectedEnd,
        anchors.minTermMonths,
        anchors.minTermDays,
        anchors.noticeDays,
        anchors.noticeDeadline,
        anchors.guaranteeEnd,
        A10_DATE_POLICY_ID,
        A10_DATE_POLICY_VERSION,
        anchors.termIncomplete,
        JSON.stringify(anchors.provenance),
        fp,
      ],
    );
    const { rows: opt } = await client.query(
      `SELECT supplier_name, product_code FROM ops.offer_options
       WHERE offer_revision_id=$1 AND tariff_version_id=$2 LIMIT 1`,
      [handoff.offer_revision_id, handoff.selected_tariff_version_id],
    );
    if (opt[0]) {
      await client.query(
        `UPDATE ops.lifecycle_contract_snapshots SET supplier_name=$2, product_code=$3 WHERE lifecycle_id=$1 AND revision=1`,
        [lifecycleId, opt[0].supplier_name, opt[0].product_code],
      );
    }
    await client.query(
      `INSERT INTO ops.lifecycle_events (lifecycle_id, event_type, detail)
       VALUES ($1,$2,$3::jsonb)`,
      [lifecycleId, future ? 'lifecycle.pre_active' : 'lifecycle.activated', JSON.stringify({ confirmed_supply_start: confirmedStart })],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  if (future) {
    await enqueueOfferJob(pool, {
      caseId: handoff.case_id,
      jobType: LIFECYCLE_ACTIVATE_DUE_CAPABILITY,
      idempotencyKey: `lifecycle-activate:${lifecycleId}:${fp}`,
      scheduledAt: `${confirmedStart}T00:00:00.000Z`,
      payload: { lifecycle_id: lifecycleId, fingerprint: fp, schema_version: 1 },
      priority: 75,
    });
  } else if (!anchors.termIncomplete && anchors.noticeDeadline) {
    const windowOpen = addCalendarDays(anchors.noticeDeadline, -Number(policy.renewalLeadDays || 0));
    await enqueueOfferJob(pool, {
      caseId: handoff.case_id,
      jobType: RENEWAL_WINDOW_OPEN_CAPABILITY,
      idempotencyKey: `renewal-window:${lifecycleId}:${fp}`,
      scheduledAt: `${windowOpen}T00:00:00.000Z`,
      payload: { lifecycle_id: lifecycleId, fingerprint: fp, schema_version: 1 },
      priority: 70,
    });
    await pool.query(
      `UPDATE ops.customer_lifecycles SET status='RENEWAL_MONITORING', updated_at=now() WHERE id=$1 AND status='ACTIVE'`,
      [lifecycleId],
    );
  }

  return {
    ok: true,
    lifecycleId,
    status,
    confirmedSupplyStart: confirmedStart,
    termIncomplete: anchors.termIncomplete,
    expectedContractEnd: anchors.expectedEnd,
    noticeDeadline: anchors.noticeDeadline,
    priceGuaranteeEnd: anchors.guaranteeEnd,
  };
}

export async function getLifecycle(pool, lifecycleId) {
  const { rows } = await pool.query(`SELECT * FROM ops.customer_lifecycles WHERE id=$1`, [lifecycleId]);
  return rows[0] || null;
}

export async function getCurrentContractSnapshot(pool, lifecycleId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.lifecycle_contract_snapshots WHERE lifecycle_id=$1 ORDER BY revision DESC LIMIT 1`,
    [lifecycleId],
  );
  return rows[0] || null;
}

export async function listA11LifecycleProjection(pool) {
  const { rows } = await pool.query(
    `SELECT l.id, l.case_id, l.status, l.energy_type, l.confirmed_supply_start, l.exception_code,
            s.expected_contract_end, s.notice_deadline, s.price_guarantee_end, s.term_incomplete,
            c.status AS renewal_status, c.window_open, c.target_action_date
     FROM ops.customer_lifecycles l
     LEFT JOIN LATERAL (
       SELECT * FROM ops.lifecycle_contract_snapshots s WHERE s.lifecycle_id=l.id ORDER BY revision DESC LIMIT 1
     ) s ON true
     LEFT JOIN ops.renewal_cycles c ON c.id = l.current_renewal_cycle_id
     WHERE l.is_current = true
     ORDER BY l.created_at DESC`,
  );
  return rows;
}
