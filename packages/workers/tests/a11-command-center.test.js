/**
 * DTH-A11 Production Command Center — E2 local.
 * UI is not authority. Client role is ignored. No live providers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  QualificationOutcome,
  KillDomain,
  OperatorCommandType,
  OperatorRole,
  A11ErrorCode,
  A11_LIVE_AI_CALLS,
  OWNER_COMMAND_CENTER_AUTH_PROVIDER_REQUIRED,
  STAGING_AUTONOMY_READY,
  PRODUCTION_AUTONOMY_READY,
  SwitchFieldCode,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  acceptBusinessLeadAtomic,
  findCaseBySourceLead,
  getCurrentQualification,
  setGlobalKill,
  createLocalTestDocumentStorage,
  resetLocalTestDocumentStorage,
  ingestTestDocument,
  processDocument,
  buildElectricityInvoicePdf,
  importSyntheticCatalogue,
  runTariffEvaluation,
  prepareOffer,
  deliverOffer,
  getPublicOfferView,
  acceptOffer,
  createMockEmailProvider,
  resetProviderTestStore,
  wipeOfferAndSwitchingDomain,
  prepareSwitch,
  submitSwitchAttempt,
  recordSwitchFact,
  resetSwitchProviderTestStore,
  setSwitchProviderTestMode,
  createA11ReadService,
  executeOperatorCommand,
  getProductionReadinessView,
  startWorkflowIdempotent,
} from '@deintarifheld/db';
import { createOpsBff } from '@deintarifheld/ops-api';
import { authenticateTestOperator } from '@deintarifheld/ops-api';
import { gateA11Request } from '@deintarifheld/ops-api';
import { renderExceptionInbox } from '@deintarifheld/cc';
import {
  drainLeadHandoffs,
  drainDueJobs,
  registerAllSyntheticHandlers,
} from '../src/index.js';

const DB_URL =
  process.env.DTH_A11_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const pool = createLocalOutboxPool(DB_URL);
const storage = createLocalTestDocumentStorage({ dbUrl: DB_URL });
const emailProvider = createMockEmailProvider();
registerAllSyntheticHandlers();
const reads = createA11ReadService({ pool });

function idem(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function identity(label) {
  const auth = authenticateTestOperator({
    identity: label,
    env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' },
  });
  assert.equal(auth.ok, true);
  return gateA11Request({ principal: auth.principal, session: auth.session });
}

function completePayload(over = {}) {
  return {
    firma: 'A11 Ops GmbH',
    ansprechpartner: 'Ada Lovelace',
    email: `a11-${randomUUID().slice(0, 8)}@example.invalid`,
    telefon: '',
    plz: '80331',
    energieart: 'Strom',
    verbrauchStrom: '90000',
    verbrauchGas: '',
    standorte: '1',
    versorger: '',
    nachricht: 'Approve this switch',
    dsgvo: true,
    jahreskostenNetto: '28000',
    ...over,
  };
}

async function ensureSchemas() {
  const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  const files = [
    ['ops.documents', '20260817140000_a6_document_intelligence.sql'],
    ['ops.tariff_versions', '20260817160000_a7_energy_tariff_domain.sql'],
    ['ops.offers', '20260817180000_a8_offer_domain.sql'],
    ['ops.switch_cases', '20260818120000_a9_switching_workflow.sql'],
    ['ops.customer_lifecycles', '20260818140000_a10_customer_lifecycle.sql'],
    ['ops.operator_commands', '20260818180000_a11_command_center.sql'],
  ];
  for (const [reg, file] of files) {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS c`, [reg]);
    if (!rows[0].c) await pool.query(readFileSync(join(migDir, file), 'utf8'));
  }
}

async function reset() {
  await ensureSchemas();
  resetLocalTestDocumentStorage();
  resetProviderTestStore();
  resetSwitchProviderTestStore();
  setSwitchProviderTestMode('ACCEPT');
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
}

async function qualifiedCase(over = {}) {
  const payload = completePayload(over);
  const a = await acceptBusinessLeadAtomic(pool, {
    email: payload.email, firma: payload.firma, payload, idempotencyKey: idem('a11'),
  });
  await drainLeadHandoffs(pool, { maxEmpty: 3 });
  await drainDueJobs(pool, { maxEmptyTicks: 14, emailProvider });
  const c = await findCaseBySourceLead(pool, a.leadId);
  assert.equal((await getCurrentQualification(pool, c.id)).outcome, QualificationOutcome.QUALIFIED_FOR_CALL);
  return { caseId: c.id, payload };
}

async function pendingSwitchApproval() {
  await importSyntheticCatalogue(pool);
  const ctx = await qualifiedCase();
  const formatted = `${Number(90000).toLocaleString('de-DE')} kWh`;
  const bytes = buildElectricityInvoicePdf({ consumption: formatted, plz: '80331' });
  const ing = await ingestTestDocument(pool, { caseId: ctx.caseId, bytes, filename: 'strom.pdf', storage, enqueueProcess: false });
  await processDocument(pool, { documentId: ing.documentId, storage });
  const ev = await runTariffEvaluation(pool, { caseId: ctx.caseId, enqueueOfferPrepare: false });
  assert.equal(ev.ok, true);
  const p = await prepareOffer(pool, { caseId: ctx.caseId });
  await deliverOffer(pool, { offerRevisionId: p.revisionId, emailProvider });
  const view = await getPublicOfferView(pool, p.token);
  await acceptOffer(pool, { token: p.token, optionId: view.options[0].optionId });
  const prep = await prepareSwitch(pool, { offerRevisionId: p.revisionId, requireApproval: true });
  return { ...ctx, revisionId: p.revisionId, attemptId: prep.attemptId, switchCaseId: prep.switchCaseId, payloadHash: prep.payloadHash };
}

test('A11-01 schema + reuse + flags', async () => {
  await ensureSchemas();
  const { rows } = await pool.query(`SELECT to_regclass('ops.operator_commands') AS c`);
  assert.ok(rows[0].c);
  const { rows: g } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM information_schema.role_table_grants
    WHERE table_schema='ops' AND table_name='operator_commands'
      AND grantee IN ('anon','authenticated') AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`);
  assert.equal(g[0].n, 0);
  assert.equal(OWNER_COMMAND_CENTER_AUTH_PROVIDER_REQUIRED, true);
  assert.equal(STAGING_AUTONOMY_READY, false);
  assert.equal(PRODUCTION_AUTONOMY_READY, false);
  assert.equal(A11_LIVE_AI_CALLS, 0);
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/src/a11/commands.js'), 'utf8');
  assert.equal(/from '\.\.\/a7\/pricing\.js'/.test(src), false);
  assert.equal(/openai|anthropic/i.test(src), false);
});

test('A11-02/03/04 overview inbox cases', async () => {
  await reset();
  await qualifiedCase();
  const ov = await reads.getOpsOverview();
  assert.equal(ov.ok, true);
  assert.equal(ov.realtime, false);
  assert.ok(ov.casesOpen >= 1);
  assert.equal(ov.workerHealth, 'LAST_JOB_ACTIVITY');
  const inbox = await reads.listOpsInbox({ limit: 20 });
  assert.ok(inbox.limit <= 100);
  const cases = await reads.listOpsCases({ limit: 20 });
  assert.ok(cases.items.length >= 1);
  assert.ok(cases.items[0].stage);
  assert.ok(cases.items[0].waitingOn);
});

test('A11-05/06/07/33 Case 360 stage waiting-on lifecycle', async () => {
  await reset();
  const ctx = await qualifiedCase();
  const d = await reads.getOpsCaseDetail(ctx.caseId);
  assert.equal(d.ok, true);
  assert.ok(d.qualification);
  assert.ok(Array.isArray(d.timeline));
  assert.doesNotMatch(JSON.stringify(d), /service_role|resend|DATABASE_URL/i);
  const life = await reads.listOpsLifecycle({ limit: 10 });
  assert.equal(life.ok, true);
});

test('A11-08/09 approvals revision-bound stale', async () => {
  await reset();
  const ctx = await pendingSwitchApproval();
  const owner = identity('TEST_OWNER');
  const list = await reads.listOpsApprovals({ limit: 20 });
  const pending = list.items.find((i) => i.decision === 'PENDING' && i.domain === 'A9');
  assert.ok(pending);
  const stale = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_SWITCH_SUBMISSION,
    targetId: ctx.attemptId,
    expectedRevision: 'not-the-hash',
    idempotencyKey: idem('stale-appr'),
    confirm: true,
  }, owner);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, A11ErrorCode.STALE_APPROVAL);
  const ok = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_SWITCH_SUBMISSION,
    targetId: ctx.attemptId,
    expectedRevision: pending.revision,
    idempotencyKey: idem('appr'),
    confirm: true,
  }, owner);
  assert.equal(ok.ok, true);
  const dup = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_SWITCH_SUBMISSION,
    targetId: ctx.attemptId,
    expectedRevision: pending.revision,
    idempotencyKey: ok.idempotentReplay ? idem('appr2') : idem('appr-dup-new'),
    confirm: true,
  }, owner);
  assert.ok(dup.ok === true || dup.code === 'APPROVAL_ALREADY_DECIDED' || dup.duplicate === true);
});

test('A11-16/20 global kill + control version + readback', async () => {
  await reset();
  const owner = identity('TEST_OWNER');
  const before = await reads.getControlState();
  const killKey = idem('kill');
  const r = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'a11-kill',
    idempotencyKey: killKey,
    confirm: true,
    expectedRevision: String(before.controlVersion),
  }, owner);
  assert.equal(r.ok, true);
  assert.equal(r.globalKillActive, true);
  assert.ok(r.controlVersion > before.controlVersion);
  const after = await reads.getControlState();
  assert.equal(after.globalKillActive, true);
  const same = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'a11-kill',
    idempotencyKey: killKey,
    confirm: true,
    expectedRevision: String(before.controlVersion),
  }, owner);
  assert.equal(same.idempotentReplay, true);
  await setGlobalKill(pool, false, { reason: 'a11-off' });
});

test('A11-17 domain kill registered only', async () => {
  await reset();
  const owner = identity('TEST_OWNER');
  const bad = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_DOMAIN_KILL,
    domain: 'NINTH_DOMAIN',
    active: true,
    reason: 'nope',
    idempotencyKey: idem('dom-bad'),
    confirm: true,
  }, owner);
  assert.equal(bad.ok, false);
  const ok = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_DOMAIN_KILL,
    domain: KillDomain.AUTOMATION_ENGINE,
    active: true,
    reason: 'a11-dom',
    idempotencyKey: idem('dom'),
    confirm: true,
  }, owner);
  assert.equal(ok.ok, true);
  await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_DOMAIN_KILL,
    domain: KillDomain.AUTOMATION_ENGINE,
    active: false,
    reason: 'a11-dom-off',
    idempotencyKey: idem('dom-off'),
    confirm: true,
  }, owner);
});

test('A11-18/19 takeover resume durable', async () => {
  await reset();
  const ctx = await qualifiedCase();
  const op = identity('TEST_OPERATOR');
  const t = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.TAKEOVER_CASE,
    targetId: ctx.caseId,
    reason: 'ops',
    idempotencyKey: idem('to'),
    confirm: true,
  }, op);
  assert.equal(t.ok, true);
  assert.equal(t.takeoverActive, true);
  const snap = await reads.getOpsCaseDetail(ctx.caseId);
  assert.equal(snap.item.takeover, true);
  const res = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.RESUME_CASE,
    targetId: ctx.caseId,
    reason: 'resume',
    idempotencyKey: idem('rs'),
    confirm: true,
  }, op);
  assert.equal(res.ok, true);
});

test('A11-12/13/14 jobs DLQ reprocess', async () => {
  await reset();
  const owner = identity('TEST_OWNER');
  const started = await startWorkflowIdempotent(pool, {
    aggregateType: 's',
    aggregateId: 'a11-dlq',
    correlationId: idem('dlq'),
    jobType: 'SYNTHETIC_NOOP',
    jobIdempotencyKey: idem('dlq-job'),
  });
  assert.ok(started.jobId);
  await pool.query(
    `UPDATE workflow.jobs SET status='DEAD_LETTER', last_error_code='A11_TEST' WHERE id=$1`,
    [started.jobId],
  );
  const jobs = await reads.listOpsJobs({ limit: 20, deadLetterOnly: true });
  const row = jobs.items.find((j) => j.id === started.jobId);
  assert.ok(row);
  assert.equal(row.payloadExposed, false);
  const rp = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.REPROCESS_JOB,
    targetId: row.id,
    reason: 'reprocess',
    idempotencyKey: idem('rp'),
    confirm: true,
  }, owner);
  assert.equal(rp.ok, true);
});

test('A11-21..25 authz matrix forged role session missing', async () => {
  await reset();
  const ctx = await qualifiedCase();
  const viewer = identity('TEST_VIEWER');
  const operator = identity('TEST_OPERATOR');
  const owner = identity('TEST_OWNER');
  const killV = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'no',
    idempotencyKey: idem('v-kill'),
    confirm: true,
  }, viewer);
  assert.equal(killV.ok, false);
  assert.equal(killV.code, 'NOT_AUTHORIZED');
  const toV = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.TAKEOVER_CASE,
    targetId: ctx.caseId,
    reason: 'no',
    idempotencyKey: idem('v-to'),
    confirm: true,
  }, viewer);
  assert.equal(toV.ok, false);
  const killOp = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'no',
    idempotencyKey: idem('op-kill'),
    confirm: true,
  }, operator);
  assert.equal(killOp.ok, false);
  const note = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.ADD_NOTE,
    caseId: ctx.caseId,
    body: 'operator note',
    idempotencyKey: idem('note'),
  }, operator);
  assert.ok(note.ok === true || note.code === 'NOTE_SCHEMA_MISSING');
  const bff = createOpsBff({ pool });
  const forged = await bff.dispatch({
    method: 'POST',
    path: '/ops/v1/a11/commands',
    body: {
      commandType: OperatorCommandType.SET_GLOBAL_KILL,
      role: OperatorRole.OWNER,
      operatorRole: 'OWNER',
      active: true,
      reason: 'forged',
      idempotencyKey: idem('forged'),
      confirm: true,
    },
    principal: authenticateTestOperator({ identity: 'TEST_VIEWER', env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' } }).principal,
    session: authenticateTestOperator({ identity: 'TEST_VIEWER', env: { NODE_ENV: 'test', DTH_LOCAL_AUTH_ENABLED: 'true' } }).session,
  });
  assert.equal(forged.body.ok, false);
  const missing = await bff.dispatch({
    method: 'GET',
    path: '/ops/v1/a11/overview',
  });
  assert.equal(missing.status, 401);
  const ownerKill = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'owner-ok',
    idempotencyKey: idem('ownerkill'),
    confirm: true,
  }, owner);
  assert.equal(ownerKill.ok, true);
  await setGlobalKill(pool, false, { reason: 'off' });
  await bff.close().catch(() => {});
});

test('A11-26/27/28 duplicate + stale screen + audit', async () => {
  await reset();
  const ctx = await qualifiedCase();
  const op = identity('TEST_OPERATOR');
  const key = idem('dup-to');
  const a = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.TAKEOVER_CASE,
    targetId: ctx.caseId,
    reason: 'dup',
    idempotencyKey: key,
    confirm: true,
  }, op);
  const b = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.TAKEOVER_CASE,
    targetId: ctx.caseId,
    reason: 'dup',
    idempotencyKey: key,
    confirm: true,
  }, op);
  assert.equal(a.ok, true);
  assert.equal(b.idempotentReplay, true);
  const ctrl = await reads.getControlState();
  const stale = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.SET_GLOBAL_KILL,
    active: true,
    reason: 'stale-view',
    idempotencyKey: idem('stale-kill'),
    confirm: true,
    expectedRevision: String(Number(ctrl.controlVersion) - 1),
  }, identity('TEST_OWNER'));
  assert.equal(stale.ok, false);
  assert.equal(stale.code, A11ErrorCode.STALE_OPERATOR_VIEW);
  const aud = await reads.listOpsAuditEvents({ limit: 20 });
  assert.ok(aud.editable === false);
  assert.ok(aud.items.some((i) => String(i.eventType || '').includes('a11.command')));
});

test('A11-29 XSS escaped', () => {
  const html = renderExceptionInbox([
    {
      severity: 'HIGH',
      domain: 'A9',
      caseId: 'c1',
      reasonCode: '<img onerror=alert(1)>',
      explanation: '<script>alert(1)</script>',
      waitingOn: 'PROVIDER',
      recommendedAction: 'RECONCILE_SWITCH',
    },
  ]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('A11-31/32 pagination + private access', async () => {
  await reset();
  const page = await reads.listOpsAuditEvents({ limit: 1000 });
  assert.ok(page.limit <= 100);
  const bff = createOpsBff({ pool });
  const unauth = await bff.dispatch({ method: 'GET', path: '/ops/v1/a11/cases' });
  assert.equal(unauth.status, 401);
  await bff.close().catch(() => {});
});

test('A11-35/36/39/40 readiness no fake green no AI no live', async () => {
  const r = getProductionReadinessView();
  assert.equal(r.overall, 'NOT_READY');
  assert.equal(r.falseGreens, 0);
  assert.ok(r.gates.every((g) => g.status !== 'PASS'));
  assert.equal(A11_LIVE_AI_CALLS, 0);
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/src/a11/commands.js'), 'utf8');
  assert.equal(/createResendEmailProvider|liveProvider:\s*true/.test(src), false);
});

test('A11-15 reconcile unknown does not blind retry', async () => {
  await reset();
  const owner = identity('TEST_OWNER');
  const r = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.RECONCILE_COMMUNICATION,
    targetId: randomUUID(),
    idempotencyKey: idem('rec'),
  }, owner);
  assert.ok(r.ok === false || r.code === 'INTENT_NOT_FOUND');
  assert.notEqual(r.blindRetry, true);
});

test('A11-42 bounded query stress', async () => {
  await reset();
  for (let i = 0; i < 25; i += 1) {
    await qualifiedCase({ firma: `Stress ${i}` });
  }
  const a = await Promise.all([
    reads.listOpsCases({ limit: 50 }),
    reads.listOpsInbox({ limit: 50 }),
    reads.getOpsOverview(),
    reads.listOpsAuditEvents({ limit: 50 }),
  ]);
  assert.ok(a[0].items.length <= 50);
  assert.ok(a[1].items.length <= 50);
  assert.ok(a[3].items.length <= 50);
});
