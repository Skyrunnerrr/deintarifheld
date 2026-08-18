/**
 * DTH-A3 Qualification + Missing Information suite (local disposable Postgres).
 * LIVE_AI_CALLS=0 LIVE_EMAIL_SENDS=0 LIVE_CALENDAR_WRITES=0
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LeadType,
  QualificationOutcome,
  FieldCode,
  B2B_QUALIFICATION_START_CAPABILITY,
  B2B_QUALIFICATION_REEVALUATE_CAPABILITY,
  ObservationSourceKind,
  WorkflowQualState,
  A3_POLICY_ID,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  acceptBusinessLeadAtomic,
  processOneBusinessLeadHandoff,
  findCaseBySourceLead,
  findWorkflowForLead,
  findInitialQualificationJob,
  evaluateQualification,
  applyQualificationObservation,
  getCurrentQualification,
  getOpenMissingRequirements,
  getQualificationRevision,
  isQualificationRevisionCurrent,
  parseConsumptionKwh,
  normalizeEnergyType,
  setGlobalKill,
  B2B_QUALIFICATION_POLICY_V1,
  createMockEmailProvider,
  createTestCalendarProvider,
  wipeOfferAndSwitchingDomain,
} from '@deintarifheld/db';
import {
  drainLeadHandoffs,
  drainDueJobs,
  registerAllSyntheticHandlers,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_A3_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const pool = createLocalOutboxPool(DB_URL);
const emailProvider = createMockEmailProvider();
const calendarProvider = createTestCalendarProvider();
registerAllSyntheticHandlers();

function idem(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function completePayload(over = {}) {
  return {
    firma: 'Complete GmbH',
    ansprechpartner: 'Ada Lovelace',
    email: 'complete@example.invalid',
    telefon: '',
    plz: '80331',
    energieart: 'Strom',
    verbrauchStrom: '80000',
    verbrauchGas: '',
    standorte: '1',
    versorger: '',
    vertragslaufzeit: '',
    nachricht: 'untrusted free text must not drive authority',
    dsgvo: true,
    ...over,
  };
}

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
    await pool.query(`DELETE FROM ops.appointment_reminders`);
    await pool.query(`DELETE FROM ops.appointment_provider_events`);
    await pool.query(`UPDATE ops.booking_sessions SET appointment_id=NULL, selected_slot_id=NULL`);
    await pool.query(`DELETE FROM ops.appointments`);
    await pool.query(`DELETE FROM ops.booking_slots`);
    await pool.query(`DELETE FROM ops.booking_sessions`);
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
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','a3','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
  await pool.query(`UPDATE security.control_version SET version=1 WHERE id=1`);
  registerAllSyntheticHandlers();
}

async function intakeAndHandoff(payload, keyPrefix = 'a3') {
  const email = payload.email || 'a3@example.invalid';
  const a = await acceptBusinessLeadAtomic(pool, {
    email,
    firma: payload.firma || 'A3 Firma',
    payload,
    idempotencyKey: idem(keyPrefix),
    leadType: LeadType.BUSINESS_ENERGY,
  });
  assert.equal(a.ok, true);
  await drainLeadHandoffs(pool, { maxEmpty: 4 });
  let c = await findCaseBySourceLead(pool, a.leadId);
  let w = await findWorkflowForLead(pool, a.leadId);
  if (!c || !w) {
    await drainLeadHandoffs(pool, { maxEmpty: 8 });
    c = await findCaseBySourceLead(pool, a.leadId);
    w = await findWorkflowForLead(pool, a.leadId);
  }
  assert.ok(c && w, 'handoff must produce case+workflow');
  const j = await findInitialQualificationJob(pool, w.id);
  return { a, c, w, j };
}

test('A3-01 schema ops qualification tables', async () => {
  const { rows } = await pool.query(
    `SELECT to_regclass('ops.case_qualifications') AS q,
            to_regclass('ops.qualification_requirements') AS r,
            to_regclass('ops.qualification_observations') AS o`,
  );
  assert.ok(rows[0].q);
  assert.ok(rows[0].r);
  assert.ok(rows[0].o);
});

test('A3-02 policy V1 CALL_READY frozen', () => {
  assert.equal(B2B_QUALIFICATION_POLICY_V1.policy_id, A3_POLICY_ID);
  assert.equal(B2B_QUALIFICATION_POLICY_V1.policy_version, 1);
  assert.equal(B2B_QUALIFICATION_POLICY_V1.scope, 'INITIAL_B2B_CALL_READINESS');
  assert.equal(normalizeEnergyType('Strom').canonical, 'ELECTRICITY');
  assert.equal(normalizeEnergyType('Gas').canonical, 'GAS');
  assert.equal(parseConsumptionKwh('80000').status, 'OK');
  assert.equal(parseConsumptionKwh('10,5').status, 'AMBIGUOUS');
  assert.equal(parseConsumptionKwh('10.000').status, 'AMBIGUOUS');
});

test('A3-03 complete qualification → QUALIFIED_FOR_CALL', async () => {
  await reset();
  const { c, w } = await intakeAndHandoff(completePayload());
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const q = await getCurrentQualification(pool, c.id);
  assert.equal(q.outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
  assert.equal(q.revision, 1);
  const open = await getOpenMissingRequirements(pool, c.id);
  assert.equal(open.length, 0);
  const wf = await pool.query(`SELECT current_state FROM workflow.workflow_instances WHERE id=$1`, [w.id]);
  assert.equal(wf.rows[0].current_state, WorkflowQualState.QUALIFIED_FOR_CALL);
});

test('A3-04 missing info → OPEN requirement', async () => {
  await reset();
  const { c } = await intakeAndHandoff(
    completePayload({ verbrauchStrom: '', energieart: 'Strom' }),
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const q = await getCurrentQualification(pool, c.id);
  assert.equal(q.outcome, QualificationOutcome.MISSING_INFORMATION);
  const open = await getOpenMissingRequirements(pool, c.id);
  assert.ok(open.some((r) => r.field_code === FieldCode.VERBRAUCH_STROM));
  const wfState = (
    await pool.query(
      `SELECT current_state FROM workflow.workflow_instances WHERE case_id=$1`,
      [c.id],
    )
  ).rows[0].current_state;
  // A4 may advance to WAITING_CUSTOMER_RESPONSE after autonomous missing-info send
  assert.ok(
    [
      WorkflowQualState.MISSING_INFO_COMMUNICATION_REQUIRED,
      'WAITING_CUSTOMER_RESPONSE',
      'COMMUNICATION_INTENT_READY',
    ].includes(wfState),
    `unexpected workflow state ${wfState}`,
  );
});

test('A3-05 conditional energy Strom vs Gas', async () => {
  await reset();
  const strom = await intakeAndHandoff(
    completePayload({ energieart: 'Strom', verbrauchStrom: '10000', verbrauchGas: '' }),
    'strom',
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  assert.equal((await getCurrentQualification(pool, strom.c.id)).outcome, QualificationOutcome.QUALIFIED_FOR_CALL);

  await reset();
  const gasMissing = await intakeAndHandoff(
    completePayload({
      energieart: 'Gas',
      verbrauchStrom: '99999',
      verbrauchGas: '',
      email: 'gas@example.invalid',
    }),
    'gas',
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const q = await getCurrentQualification(pool, gasMissing.c.id);
  assert.equal(q.outcome, QualificationOutcome.MISSING_INFORMATION);
  const open = await getOpenMissingRequirements(pool, gasMissing.c.id);
  assert.ok(open.every((r) => r.field_code !== FieldCode.VERBRAUCH_STROM));
  assert.ok(open.some((r) => r.field_code === FieldCode.VERBRAUCH_GAS));
});

test('A3-06/07 normalization + ambiguous number', async () => {
  await reset();
  const { c } = await intakeAndHandoff(completePayload({ verbrauchStrom: '10,5' }));
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const q = await getCurrentQualification(pool, c.id);
  assert.equal(q.outcome, QualificationOutcome.NEEDS_HUMAN_REVIEW);
  assert.notEqual(q.outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
  const facts = (
    await pool.query(`SELECT normalized_facts FROM ops.case_qualifications WHERE case_id=$1 AND is_current`, [c.id])
  ).rows[0].normalized_facts;
  assert.equal(facts.verbrauchStrom.status, 'AMBIGUOUS');
  assert.equal(facts.verbrauchStrom.valueKwh, null);
});

test('A3-09/11/12 persistence revision fingerprint idempotency', async () => {
  await reset();
  const { c } = await intakeAndHandoff(completePayload());
  const r1 = await evaluateQualification(pool, { caseId: c.id, trigger: 'START' });
  const r2 = await evaluateQualification(pool, { caseId: c.id, trigger: 'START' });
  assert.equal(r1.reused, false);
  assert.equal(r2.reused, true);
  assert.equal(r1.revision, r2.revision);
  assert.equal(r1.fingerprint, r2.fingerprint);
  const n = (
    await pool.query(`SELECT count(*)::int AS n FROM ops.case_qualifications WHERE case_id=$1`, [c.id])
  ).rows[0].n;
  assert.equal(n, 1);
});

test('A3-13 qualification job idempotency via drain', async () => {
  await reset();
  const { c, j } = await intakeAndHandoff(completePayload({ email: 'job@example.invalid' }));
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const j2 = await findInitialQualificationJob(pool, (await findWorkflowForLead(pool, (await findCaseBySourceLead(pool, (await pool.query(`SELECT source_lead_id FROM public.cases WHERE id=$1`, [c.id])).rows[0].source_lead_id))).id));
  void j2;
  const job = await pool.query(`SELECT status FROM workflow.jobs WHERE id=$1`, [j.id]);
  assert.equal(job.rows[0].status, 'SUCCEEDED');
  // second evaluate same fingerprint
  const again = await evaluateQualification(pool, { caseId: c.id });
  assert.equal(again.reused, true);
});

test('A3-14/15/16/17/18 observation partial then complete + reevaluate job', async () => {
  await reset();
  const { c } = await intakeAndHandoff(
    completePayload({
      verbrauchStrom: '',
      standorte: '',
      email: 'partial@example.invalid',
    }),
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  assert.equal((await getCurrentQualification(pool, c.id)).outcome, QualificationOutcome.MISSING_INFORMATION);
  const open1 = await getOpenMissingRequirements(pool, c.id);
  assert.ok(open1.length >= 2);

  const o1 = await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.VERBRAUCH_STROM,
    value: '50000',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: idem('obs-strom'),
  });
  assert.equal(o1.ok, true);
  assert.equal(o1.duplicate, false);
  const o1b = await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.VERBRAUCH_STROM,
    value: '50000',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: o1.observationId ? `replay-${o1.observationId}` : idem('x'),
  });
  // true idempotency: same key
  const o1c = await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.VERBRAUCH_STROM,
    value: '50000',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: o1.ok ? (await pool.query(`SELECT idempotency_key FROM ops.qualification_observations WHERE id=$1`, [o1.observationId])).rows[0].idempotency_key : idem('y'),
  });
  assert.equal(o1c.duplicate, true);

  await drainDueJobs(pool, { maxEmptyTicks: 8 });
  const mid = await getCurrentQualification(pool, c.id);
  assert.equal(mid.outcome, QualificationOutcome.MISSING_INFORMATION);
  const open2 = await getOpenMissingRequirements(pool, c.id);
  assert.ok(!open2.some((r) => r.field_code === FieldCode.VERBRAUCH_STROM && r.status === 'OPEN'));
  assert.ok(open2.some((r) => r.field_code === FieldCode.STANDORTE));
  assert.ok(mid.revision >= 2);

  await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.STANDORTE,
    value: '2–5',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: idem('obs-sites'),
  });
  await drainDueJobs(pool, { maxEmptyTicks: 8 });
  const done = await getCurrentQualification(pool, c.id);
  assert.equal(done.outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
  assert.equal((await getOpenMissingRequirements(pool, c.id)).length, 0);
  const reevalJobs = await pool.query(
    `SELECT count(*)::int AS n FROM workflow.jobs WHERE job_type=$1`,
    [B2B_QUALIFICATION_REEVALUATE_CAPABILITY],
  );
  assert.ok(reevalJobs.rows[0].n >= 1);
});

test('A3-19 concurrent observations', async () => {
  await reset();
  const { c } = await intakeAndHandoff(
    completePayload({ verbrauchStrom: '', standorte: '', email: 'conc@example.invalid' }),
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  await Promise.all([
    applyQualificationObservation(pool, {
      caseId: c.id,
      fieldCode: FieldCode.VERBRAUCH_STROM,
      value: '12000',
      sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
      idempotencyKey: idem('c-strom'),
    }),
    applyQualificationObservation(pool, {
      caseId: c.id,
      fieldCode: FieldCode.STANDORTE,
      value: '1',
      sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
      idempotencyKey: idem('c-sites'),
    }),
  ]);
  await drainDueJobs(pool, { maxEmptyTicks: 10 });
  const q = await getCurrentQualification(pool, c.id);
  assert.equal(q.outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
  const obsN = (
    await pool.query(`SELECT count(*)::int AS n FROM ops.qualification_observations WHERE case_id=$1`, [c.id])
  ).rows[0].n;
  assert.equal(obsN, 2);
});

test('A3-20 stale revision contract', async () => {
  await reset();
  const { c } = await intakeAndHandoff(completePayload({ verbrauchStrom: '', email: 'stale@example.invalid' }));
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const revN = await getQualificationRevision(pool, c.id);
  await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.VERBRAUCH_STROM,
    value: '90000',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: idem('stale-fix'),
  });
  await drainDueJobs(pool, { maxEmptyTicks: 8 });
  const check = await isQualificationRevisionCurrent(pool, c.id, revN);
  assert.equal(check.current, false);
  assert.equal(check.code, 'STALE_QUALIFICATION_REVISION');
});

test('A3-22 pre-commit crash leaves no partial qual', async () => {
  await reset();
  const { c } = await intakeAndHandoff(completePayload({ email: 'fi@example.invalid' }));
  await assert.rejects(
    () =>
      evaluateQualification(pool, {
        caseId: c.id,
        failureInjector: (stage) => {
          if (stage === 'a3_before_commit') throw new Error('FI_A3_PRECOMMIT');
        },
      }),
    /FI_A3_PRECOMMIT/,
  );
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM ops.case_qualifications WHERE case_id=$1`, [c.id])).rows[0].n,
    0,
  );
  const ok = await evaluateQualification(pool, { caseId: c.id });
  assert.equal(ok.outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
});

test('A3-24 global kill blocks then resumes', async () => {
  await reset();
  const { j } = await intakeAndHandoff(completePayload({ email: 'kill@example.invalid' }));
  await setGlobalKill(pool, true, { reason: 'a3-kill' });
  await drainDueJobs(pool, { maxEmptyTicks: 3 });
  const st = await pool.query(`SELECT status FROM workflow.jobs WHERE id=$1`, [j.id]);
  assert.ok(['READY', 'RETRY_SCHEDULED'].includes(st.rows[0].status) || st.rows[0].status === 'READY');
  assert.notEqual(st.rows[0].status, 'SUCCEEDED');
  await setGlobalKill(pool, false, { reason: 'a3-kill-off' });
  await drainDueJobs(pool, { maxEmptyTicks: 8 });
  const st2 = await pool.query(`SELECT status FROM workflow.jobs WHERE id=$1`, [j.id]);
  assert.equal(st2.rows[0].status, 'SUCCEEDED');
});

test('A3-26 purpose boundary private/career cannot B2B qualify via intake', async () => {
  await reset();
  const priv = await acceptBusinessLeadAtomic(pool, {
    email: 'p@example.invalid',
    firma: 'P',
    idempotencyKey: idem('priv'),
    leadType: LeadType.PRIVATE_ENERGY,
  });
  assert.equal(priv.ok, false);
});

test('A3-27/28/29 no AI provider PII in audit', async () => {
  await reset();
  const { c } = await intakeAndHandoff(completePayload({ email: 'audit@example.invalid', nachricht: 'SECRET_NOTE_XYZ' }));
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const audits = await pool.query(
    `SELECT event_type, detail::text AS d FROM public.audit_events WHERE event_type LIKE 'qualification%'`,
  );
  assert.ok(audits.rows.length >= 1);
  const blob = audits.rows.map((r) => r.d).join('|');
  assert.doesNotMatch(blob, /audit@example|SECRET_NOTE_XYZ|Ada Lovelace/i);
  const evalSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/src/a3/evaluate.js'), 'utf8');
  assert.doesNotMatch(evalSrc, /openai|anthropic|resend|calendar/i);
  assert.doesNotMatch(evalSrc, /fetch\(['"]https?:\/\//);
});

test('A3-30 A4 handoff contract stale detection', async () => {
  await reset();
  const { c } = await intakeAndHandoff(
    completePayload({ verbrauchStrom: '', email: 'a4@example.invalid' }),
  );
  await drainDueJobs(pool, { maxEmptyTicks: 6 });
  const q = await getCurrentQualification(pool, c.id);
  const open = await getOpenMissingRequirements(pool, c.id);
  assert.ok(open.length >= 1);
  const boundRevision = q.revision;
  const boundReqIds = open.map((r) => r.id);

  await applyQualificationObservation(pool, {
    caseId: c.id,
    fieldCode: FieldCode.VERBRAUCH_STROM,
    value: '77000',
    sourceKind: ObservationSourceKind.SYNTHETIC_TEST,
    idempotencyKey: idem('a4-fill'),
  });
  await drainDueJobs(pool, { maxEmptyTicks: 8 });
  const stale = await isQualificationRevisionCurrent(pool, c.id, boundRevision);
  assert.equal(stale.code, 'STALE_QUALIFICATION_REVISION');
  // previous requirement ids must not remain OPEN
  for (const id of boundReqIds) {
    const { rows } = await pool.query(`SELECT status FROM ops.qualification_requirements WHERE id=$1`, [id]);
    assert.notEqual(rows[0].status, 'OPEN');
  }
});

test('A3-31 stress mixed outcomes', async () => {
  await reset();
  const n = 40;
  for (let i = 0; i < n; i += 8) {
    const batch = [];
    for (let j = i; j < Math.min(i + 8, n); j += 1) {
      const kind = j % 4;
      let payload;
      if (kind === 0) payload = completePayload({ email: `s${j}@example.invalid`, firma: `S${j}` });
      else if (kind === 1)
        payload = completePayload({ email: `s${j}@example.invalid`, firma: `S${j}`, verbrauchStrom: '' });
      else if (kind === 2)
        payload = completePayload({ email: `s${j}@example.invalid`, firma: `S${j}`, verbrauchStrom: '1.5' });
      else
        payload = completePayload({
          email: `s${j}@example.invalid`,
          firma: `S${j}`,
          energieart: 'Gas',
          verbrauchStrom: '',
          verbrauchGas: '20000',
        });
      batch.push(intakeAndHandoff(payload, `st${j}`));
    }
    await Promise.all(batch);
  }
  // Single drain only: createLocalOutboxPool max=2 — parallel drains deadlock.
  await drainDueJobs(pool, {
    maxEmptyTicks: 15,
    maxIterations: 200,
    emailProvider,
    calendarProvider,
  });
  const counts = await pool.query(
    `SELECT outcome, count(*)::int AS n FROM ops.case_qualifications WHERE is_current GROUP BY outcome`,
  );
  const map = Object.fromEntries(counts.rows.map((r) => [r.outcome, r.n]));
  assert.ok((map.QUALIFIED_FOR_CALL || 0) >= 1);
  assert.ok((map.MISSING_INFORMATION || 0) >= 1);
  assert.ok((map.NEEDS_HUMAN_REVIEW || 0) >= 1);
  assert.equal(
    (
      await pool.query(
        `SELECT count(*)::int AS n FROM (
           SELECT case_id FROM ops.case_qualifications WHERE is_current GROUP BY case_id HAVING count(*)>1
         ) d`,
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query(
        `SELECT count(*)::int AS n FROM (
           SELECT case_id, field_code FROM ops.qualification_requirements WHERE status='OPEN'
           GROUP BY case_id, field_code HAVING count(*)>1
         ) d`,
      )
    ).rows[0].n,
    0,
  );
});

test('A3 grants: ops not granted to anon/authenticated', async () => {
  const { rows } = await pool.query(
    `SELECT grantee, table_name
     FROM information_schema.role_table_grants
     WHERE table_schema='ops'
       AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  assert.equal(rows.length, 0);
});

test.after(async () => {
  await pool.end();
});
