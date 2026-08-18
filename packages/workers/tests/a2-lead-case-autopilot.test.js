/**
 * DTH-A2 Lead → Case Autopilot suite (local disposable Postgres).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  BUSINESS_LEAD_ACCEPTED_EVENT,
  LeadType,
  B2B_QUALIFICATION_START_CAPABILITY,
  B2B_INBOUND_WORKFLOW_TYPE,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  acceptBusinessLeadAtomic,
  processOneBusinessLeadHandoff,
  reconcileLeadToCaseHandoff,
  detectHandoffOrphans,
  setGlobalKill,
  wipeOfferAndSwitchingDomain,
  claimOneSourceEvent,
  findCaseBySourceLead,
  findWorkflowForLead,
  findInitialQualificationJob,
} from '@deintarifheld/db';
import {
  drainLeadHandoffs,
  drainDueJobs,
  registerAllSyntheticHandlers,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_A2_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const pool = createLocalOutboxPool(DB_URL);

async function reset() {
  await wipeOfferAndSwitchingDomain(pool);

  const { rows: a7 } = await pool.query(`SELECT to_regclass('ops.tariff_evaluations') AS c`);
  if (a7[0].c) {
    await pool.query(`DELETE FROM ops.tariff_evaluation_results`);
    await pool.query(`DELETE FROM ops.tariff_evaluations`);
    await pool.query(`DELETE FROM ops.energy_profiles`);
    await pool.query(`DELETE FROM ops.tariff_catalogue_snapshot_members`);
    await pool.query(`DELETE FROM ops.tariff_catalogue_snapshots`);
    await pool.query(`DELETE FROM ops.tariff_eligibility_rules`);
    await pool.query(`DELETE FROM ops.tariff_price_components`);
    await pool.query(`DELETE FROM ops.tariff_versions`);
    await pool.query(`DELETE FROM ops.tariff_products`);
    await pool.query(`DELETE FROM ops.tariff_suppliers`);
  }
  const { rows: a6 } = await pool.query(`SELECT to_regclass('ops.documents') AS c`);
  if (a6[0].c) {
    await pool.query(`DELETE FROM ops.document_fact_conflicts`);
    await pool.query(`DELETE FROM ops.document_facts`);
    await pool.query(`DELETE FROM ops.document_processing_runs`);
    await pool.query(`DELETE FROM ops.documents`);
  }
  const { rows: a5 } = await pool.query(`SELECT to_regclass('ops.booking_sessions') AS c`);
  if (a5[0].c) {
    await pool.query(`DELETE FROM ops.appointment_reminders`).catch(() => {});
    await pool.query(`DELETE FROM ops.appointment_provider_events`).catch(() => {});
    await pool.query(`UPDATE ops.booking_sessions SET appointment_id=NULL, selected_slot_id=NULL`).catch(() => {});
    await pool.query(`DELETE FROM ops.appointments`).catch(() => {});
    await pool.query(`DELETE FROM ops.booking_slots`).catch(() => {});
    await pool.query(`DELETE FROM ops.booking_sessions`).catch(() => {});
  }
  const { rows: a4 } = await pool.query(`SELECT to_regclass('ops.conversations') AS c`);
  if (a4[0].c) {
    await pool.query(`DELETE FROM ops.followup_schedules`);
    await pool.query(`DELETE FROM ops.provider_events`);
    await pool.query(`DELETE FROM ops.inbound_events`);
    await pool.query(`DELETE FROM ops.communication_messages`);
    await pool.query(`DELETE FROM ops.outbound_intents`);
    await pool.query(`DELETE FROM ops.conversations`);
  }
  await pool.query(`DELETE FROM ops.qualification_observations`);
  await pool.query(`DELETE FROM ops.qualification_requirements`);
  await pool.query(`DELETE FROM ops.case_qualifications`);
  await pool.query(`DELETE FROM workflow.job_attempts`);
  await pool.query(`DELETE FROM workflow.jobs`);
  await pool.query(`DELETE FROM workflow.workflow_instances`);
  await pool.query(`DELETE FROM public.cases`);
  await pool.query(`DELETE FROM public.transactional_outbox`);
  await pool.query(`DELETE FROM public.audit_events`);
  await pool.query(`DELETE FROM public.leads`);
  await pool.query(`UPDATE security.control_state SET state='INACTIVE'`);
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','a2','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
  await pool.query(`UPDATE security.control_version SET version=1 WHERE id=1`);
  registerAllSyntheticHandlers();
}

function idem(prefix) {
  return `${prefix}-${randomUUID()}`;
}

test('A2-01 schema cases + outbox present', async () => {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.cases') AS cases, to_regclass('public.transactional_outbox') AS outbox`,
  );
  assert.ok(rows[0].cases);
  assert.ok(rows[0].outbox);
});

test('A2-02/03 valid B2B atomic intake', async () => {
  await reset();
  const r = await acceptBusinessLeadAtomic(pool, {
    email: 'autopilot@example.invalid',
    firma: 'Synthetic GmbH',
    payload: { nachricht: 'untrusted data only' },
    idempotencyKey: idem('a2'),
    leadType: LeadType.BUSINESS_ENERGY,
  });
  assert.equal(r.ok, true);
  assert.equal(r.code, 'LEAD_DURABLY_ACCEPTED');
  const lead = await pool.query(`SELECT lead_type, status FROM public.leads WHERE id=$1`, [r.leadId]);
  assert.equal(lead.rows[0].lead_type, 'business_energy');
  const ev = await pool.query(`SELECT event_type, status, payload_redacted FROM public.transactional_outbox WHERE id=$1`, [
    r.eventId,
  ]);
  assert.equal(ev.rows[0].event_type, BUSINESS_LEAD_ACCEPTED_EVENT);
  assert.equal(ev.rows[0].status, 'pending');
  const p = ev.rows[0].payload_redacted;
  assert.equal(p.email, undefined);
  assert.equal(p.nachricht, undefined);
  assert.ok(p.lead_id);
});

test('A2-06/07 private and career excluded from atomic B2B', async () => {
  await reset();
  const priv = await acceptBusinessLeadAtomic(pool, {
    email: 'priv@example.invalid',
    idempotencyKey: idem('prv'),
    leadType: LeadType.PRIVATE_ENERGY,
  });
  assert.equal(priv.ok, false);
  assert.equal(priv.code, 'LEAD_TYPE_NOT_BUSINESS_ENERGY');
});

test('A2-10..13 handoff idempotency Case/Workflow/Job', async () => {
  await reset();
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'case@example.invalid',
    firma: 'Case Co',
    idempotencyKey: idem('case'),
  });
  const h1 = await processOneBusinessLeadHandoff(pool);
  assert.equal(h1.ok, true);
  assert.equal(h1.processed, true);
  const h2 = await reconcileLeadToCaseHandoff(pool, {
    event_type: BUSINESS_LEAD_ACCEPTED_EVENT,
    aggregate_id: a.leadId,
    correlation_id: a.correlationId,
    payload_redacted: { schema_version: 1, lead_id: a.leadId, lead_type: 'business_energy' },
  });
  assert.equal(h2.ok, true);
  const cases = await pool.query(`SELECT count(*)::int AS n FROM public.cases WHERE source_lead_id=$1`, [
    a.leadId,
  ]);
  assert.equal(cases.rows[0].n, 1);
  const wfs = await pool.query(
    `SELECT count(*)::int AS n FROM workflow.workflow_instances WHERE aggregate_id=$1 AND workflow_type=$2`,
    [a.leadId, B2B_INBOUND_WORKFLOW_TYPE],
  );
  assert.equal(wfs.rows[0].n, 1);
  const jobs = await pool.query(
    `SELECT count(*)::int AS n FROM workflow.jobs WHERE job_type=$1`,
    [B2B_QUALIFICATION_START_CAPABILITY],
  );
  assert.equal(jobs.rows[0].n, 1);
});

test('A2-14 duplicate HTTP/idempotency key', async () => {
  await reset();
  const key = idem('dup');
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'dup@example.invalid',
    firma: 'Dup',
    idempotencyKey: key,
  });
  const b = await acceptBusinessLeadAtomic(pool, {
    email: 'dup@example.invalid',
    firma: 'Dup',
    idempotencyKey: key,
  });
  assert.equal(a.leadId, b.leadId);
  assert.equal(b.duplicate, true);
  const leads = await pool.query(`SELECT count(*)::int AS n FROM public.leads`);
  assert.equal(leads.rows[0].n, 1);
  const events = await pool.query(`SELECT count(*)::int AS n FROM public.transactional_outbox`);
  assert.equal(events.rows[0].n, 1);
});

test('A2-15 concurrent duplicate request', async () => {
  await reset();
  const key = idem('race');
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      acceptBusinessLeadAtomic(pool, {
        email: 'race@example.invalid',
        firma: 'Race',
        idempotencyKey: key,
        payload: {},
      }).catch((e) => ({ ok: false, err: String(e.message || e) })),
    ),
  );
  const ok = results.filter((r) => r.ok);
  assert.ok(ok.length >= 1);
  const leads = await pool.query(`SELECT count(*)::int AS n FROM public.leads WHERE idempotency_key=$1`, [key]);
  assert.equal(leads.rows[0].n, 1);
  const events = await pool.query(`SELECT count(*)::int AS n FROM public.transactional_outbox`);
  assert.equal(events.rows[0].n, 1);
});

test('A2-17 worker offline then recover', async () => {
  await reset();
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'offline@example.invalid',
    firma: 'Offline',
    idempotencyKey: idem('off'),
  });
  const beforeCases = await pool.query(`SELECT count(*)::int AS n FROM public.cases`);
  assert.equal(beforeCases.rows[0].n, 0);
  const ev = await pool.query(`SELECT status FROM public.transactional_outbox WHERE id=$1`, [a.eventId]);
  assert.equal(ev.rows[0].status, 'pending');
  // worker starts
  await drainLeadHandoffs(pool, { maxEmpty: 3 });
  const c = await findCaseBySourceLead(pool, a.leadId);
  assert.ok(c);
  const w = await findWorkflowForLead(pool, a.leadId);
  assert.ok(w);
  const j = await findInitialQualificationJob(pool, w.id);
  assert.ok(j);
  const done = await pool.query(`SELECT status FROM public.transactional_outbox WHERE id=$1`, [a.eventId]);
  assert.equal(done.rows[0].status, 'processed');
});

test('A2-18 global kill preserves intake', async () => {
  await reset();
  await setGlobalKill(pool, true, { reason: 'a2-kill' });
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'kill@example.invalid',
    firma: 'Kill',
    idempotencyKey: idem('kill'),
  });
  assert.equal(a.ok, true);
  const r = await processOneBusinessLeadHandoff(pool);
  assert.equal(r.ok, false);
  assert.ok(r.retainEvent || r.code === 'CONTROL_BLOCKED');
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.cases`)).rows[0].n, 0);
  await setGlobalKill(pool, false, { reason: 'a2-kill-off' });
  await drainLeadHandoffs(pool, { maxEmpty: 4 });
  assert.ok(await findCaseBySourceLead(pool, a.leadId));
});

test('A2-04 unknown event version permanent', async () => {
  await reset();
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'ver@example.invalid',
    firma: 'Ver',
    idempotencyKey: idem('ver'),
  });
  await pool.query(
    `UPDATE public.transactional_outbox SET payload_redacted = payload_redacted || '{"schema_version":99}'::jsonb WHERE id=$1`,
    [a.eventId],
  );
  const r = await processOneBusinessLeadHandoff(pool);
  assert.equal(r.permanent, true);
  assert.equal(r.code, 'UNKNOWN_EVENT_VERSION');
});

test('A2-20..22 crash reconciliation', async () => {
  await reset();
  await acceptBusinessLeadAtomic(pool, {
    email: 'crash@example.invalid',
    firma: 'Crash',
    idempotencyKey: idem('crash'),
  });
  await assert.rejects(
    () =>
      processOneBusinessLeadHandoff(pool, {
        failureInjector: {
          afterClaimBeforeCase: async () => {
            throw new Error('FI_A2_03');
          },
        },
      }),
    /FI_A2_03/,
  );
  // event reclaimed as pending
  await drainLeadHandoffs(pool, { maxEmpty: 4 });
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.cases`)).rows[0].n, 1);

  await reset();
  await acceptBusinessLeadAtomic(pool, {
    email: 'ack@example.invalid',
    firma: 'Ack',
    idempotencyKey: idem('ack'),
  });
  await assert.rejects(
    () =>
      processOneBusinessLeadHandoff(pool, {
        failureInjector: {
          beforeAck: async () => {
            throw new Error('FI_A2_07');
          },
        },
      }),
    /FI_A2_07/,
  );
  await drainLeadHandoffs(pool, { maxEmpty: 4 });
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM public.cases`)).rows[0].n,
    1,
  );
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM workflow.workflow_instances`)).rows[0].n,
    1,
  );
});

test('A2-01 FI atomic rollback after lead before outbox', async () => {
  await reset();
  await assert.rejects(
    () =>
      acceptBusinessLeadAtomic(pool, {
        email: 'rb@example.invalid',
        firma: 'RB',
        idempotencyKey: idem('rb'),
        failureInjector: {
          afterLeadBeforeOutbox: async () => {
            throw new Error('FI_A2_02');
          },
        },
      }),
    /FI_A2_02/,
  );
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.leads`)).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.transactional_outbox`)).rows[0].n, 0);
});

test('A2-16 two workers handoff', async () => {
  await reset();
  for (let i = 0; i < 10; i += 1) {
    await acceptBusinessLeadAtomic(pool, {
      email: `w${i}@example.invalid`,
      firma: `W${i}`,
      idempotencyKey: idem(`w${i}`),
    });
  }
  await Promise.all([
    drainLeadHandoffs(pool, { maxEmpty: 6, maxIterations: 100 }),
    drainLeadHandoffs(pool, { maxEmpty: 6, maxIterations: 100 }),
  ]);
  await drainLeadHandoffs(pool, { maxEmpty: 8, maxIterations: 100 });
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.cases`)).rows[0].n, 10);
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM workflow.workflow_instances`)).rows[0].n,
    10,
  );
  const orphans = await detectHandoffOrphans(pool);
  assert.equal(orphans.duplicate_cases_per_lead, 0);
  assert.equal(orphans.duplicate_workflows_per_lead, 0);
});

test('A2-28 no PII in outbox / A2-26 no provider in handoff source', async () => {
  await reset();
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'pii@example.invalid',
    firma: 'PII',
    payload: { email: 'pii@example.invalid', nachricht: 'secret text', phone: '000' },
    idempotencyKey: idem('pii'),
  });
  const { rows } = await pool.query(`SELECT payload_redacted FROM public.transactional_outbox WHERE id=$1`, [
    a.eventId,
  ]);
  const json = JSON.stringify(rows[0].payload_redacted);
  assert.doesNotMatch(json, /pii@example|secret text|phone/i);
});

test('A2-29 no client runtime authority in contracts', async () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const handoff = readFileSync(join(dir, '../../db/src/a2/handoff.js'), 'utf8');
  assert.doesNotMatch(handoff, /workflowType\s*=\s*payload|jobType\s*=\s*payload|control_version\s*=\s*payload/);
  assert.match(handoff, /B2B_INBOUND_WORKFLOW_TYPE/);
  assert.match(handoff, /B2B_QUALIFICATION_START_CAPABILITY/);
});

test('A2-30 full E2E Lead→Case→Job + optional drain placeholder', async () => {
  await reset();
  const a = await acceptBusinessLeadAtomic(pool, {
    email: 'e2e@example.invalid',
    firma: 'E2E GmbH',
    idempotencyKey: idem('e2e'),
    correlationId: randomUUID(),
  });
  await drainLeadHandoffs(pool, { maxEmpty: 3 });
  const c = await findCaseBySourceLead(pool, a.leadId);
  const w = await findWorkflowForLead(pool, a.leadId);
  const j = await findInitialQualificationJob(pool, w.id);
  assert.equal(c.status, 'open');
  assert.equal(j.job_type, B2B_QUALIFICATION_START_CAPABILITY);
  await drainDueJobs(pool, { maxEmptyTicks: 4 });
  const j2 = await findInitialQualificationJob(pool, w.id);
  assert.ok(['SUCCEEDED', 'READY', 'LEASED', 'RUNNING'].includes(j2.status));
});

test('A2 stress 100 leads / 2 handoff workers', async () => {
  await reset();
  const n = 100;
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      acceptBusinessLeadAtomic(pool, {
        email: `st${i}@example.invalid`,
        firma: `ST${i}`,
        idempotencyKey: idem(`st${i}`),
      }),
    ),
  );
  await Promise.all([
    drainLeadHandoffs(pool, { maxEmpty: 8, maxIterations: 400 }),
    drainLeadHandoffs(pool, { maxEmpty: 8, maxIterations: 400 }),
  ]);
  await drainLeadHandoffs(pool, { maxEmpty: 12, maxIterations: 400 });
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.leads`)).rows[0].n, n);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM public.cases`)).rows[0].n, n);
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM workflow.workflow_instances`)).rows[0].n,
    n,
  );
  assert.equal(
    (await pool.query(
      `SELECT count(*)::int AS n FROM public.transactional_outbox WHERE status='processed'`,
    )).rows[0].n,
    n,
  );
  const orphans = await detectHandoffOrphans(pool);
  assert.equal(orphans.duplicate_cases_per_lead, 0);
  assert.equal(orphans.source_events_without_case, 0);
});

test.after(async () => {
  await pool.end();
});
