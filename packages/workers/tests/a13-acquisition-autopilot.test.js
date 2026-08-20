/**
 * DTH-A13 Acquisition Autopilot — E2 local.
 * No live ads/AI/spend. Soft-fail attribution. create≠active.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AcquisitionSourceKind,
  CampaignObjective,
  CampaignStatus,
  AttributionState,
  TouchpointType,
  LIVE_AD_SPEND_EUR,
  LIVE_AD_PROVIDER_CALLS,
  LIVE_AI_CALLS_A13,
  LIVE_PAID_CAMPAIGN_ACTIVATIONS,
  OWNER_ACQUISITION_PROVIDER_REQUIRED,
  OWNER_ACQUISITION_BUDGET_POLICY_REQUIRED,
  AcquisitionAttributionPolicyV1,
  AcquisitionBudgetPolicyV1,
  A13_CRITICAL_INVARIANT_KEYS,
  OperatorCommandType,
  ContentGeneratorMode,
  ContentPurpose,
  ContentAudience,
  ContentChannel,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  wipeAcquisitionDomain,
  wipeContentDomain,
  createAcquisitionCampaign,
  reviseAcquisitionCampaign,
  issueAcquisitionRef,
  resolveAcquisitionRef,
  recordTouchpoint,
  acceptLeadWithAcquisition,
  approveAcquisitionCampaign,
  rejectAcquisitionCampaign,
  activateAcquisitionCampaign,
  executeCreateCampaignIntent,
  executeActivateCampaignIntent,
  scheduleProviderIntent,
  pauseAcquisitionCampaign,
  reconcileAcquisitionCampaign,
  cancelAcquisitionCampaign,
  refreshAcquisitionMetrics,
  computeCplMicroEur,
  computeRoas,
  createDeterministicTestAcquisitionProvider,
  resetAcquisitionProviderTestStore,
  setAcquisitionProviderTestMode,
  getAcquisitionProviderCreateCount,
  getAcquisitionProviderActivateCount,
  getAcquisitionProviderLiveCallCount,
  buildA14AcquisitionHandoff,
  resetA13InvariantCounters,
  getA13InvariantCounters,
  assertA13CriticalInvariantsZero,
  isAllowedAcquisitionDestination,
  parseBudgetMicroEur,
  createContentBrief,
  produceContentCandidate,
  createA11ReadService,
  executeOperatorCommand,
  getProductionReadinessView,
  setGlobalKill,
  processOneBusinessLeadHandoff,
} from '@deintarifheld/db';
import { authenticateTestOperator } from '@deintarifheld/ops-api';
import { gateA11Request } from '@deintarifheld/ops-api';

const DB_URL =
  process.env.DTH_A13_DATABASE_URL ||
  process.env.DTH_A1_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1';

if (/supabase\.co|aws\.|azure\.|gcp\./i.test(DB_URL) || !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  throw new Error('NON_LOCAL_DATABASE_URL_FORBIDDEN');
}

const pool = createLocalOutboxPool(DB_URL);
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

async function ensureSchemas() {
  const migDir = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  const { rows: a12 } = await pool.query(`SELECT to_regclass('ops.content_briefs') AS c`);
  if (!a12[0].c) {
    await pool.query(readFileSync(join(migDir, '20260818190000_a12_content_autopilot.sql'), 'utf8'));
  }
  const { rows: a13 } = await pool.query(`SELECT to_regclass('ops.acquisition_campaigns') AS c`);
  if (!a13[0].c) {
    await pool.query(readFileSync(join(migDir, '20260820120000_a13_acquisition_autopilot.sql'), 'utf8'));
  }
}

async function reset() {
  await ensureSchemas();
  await wipeAcquisitionDomain(pool);
  await wipeContentDomain(pool);
  resetAcquisitionProviderTestStore();
  setAcquisitionProviderTestMode('CREATE_ACCEPTED');
  resetA13InvariantCounters();
  // Local isolation only — never touch staging/production.
  await pool.query(`DELETE FROM workflow.job_queue`).catch(() => {});
  await pool.query(`DELETE FROM workflow.workflow_instances`).catch(() => {});
  await pool.query(`DELETE FROM public.cases`).catch(() => {});
  await pool.query(`DELETE FROM public.transactional_outbox`).catch(() => {});
  await pool.query(`DELETE FROM public.leads`).catch(() => {});
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','a13','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('DOMAIN','AUTOMATION_ENGINE','INACTIVE','a13','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
}

async function publishedContent() {
  const b = await createContentBrief(pool, {
    purpose: ContentPurpose.EDUCATION,
    audience: ContentAudience.SME_OWNER,
    topic: 'Energiewechsel Prozess',
    primaryMessage: 'Ablauf erklären ohne Preisversprechen',
    cta: 'Mehr zum Ablauf',
    channel: ContentChannel.SYNTHETIC_LINKEDIN,
  });
  assert.equal(b.ok, true);
  const p = await produceContentCandidate(pool, {
    briefId: b.briefId,
    mode: ContentGeneratorMode.SAFE_EDUCATION,
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  assert.equal(p.ok, true);
  return p;
}

async function organicCampaign(over = {}) {
  const content = over.skipContent ? null : await publishedContent();
  const camp = await createAcquisitionCampaign(pool, {
    name: over.name || 'Organic A13',
    objective: CampaignObjective.B2B_LEAD_GENERATION,
    sourceKind: AcquisitionSourceKind.ORGANIC_CONTENT,
    destination: 'https://www.deintarifheld.de/unternehmen',
    cta: 'Mehr zum Ablauf',
    contentRevisionId: content?.revisionId || null,
    totalBudgetEur: '0',
    dailyBudgetEur: '0',
    ...over.campaign,
  });
  assert.equal(camp.ok, true);
  const ref = await issueAcquisitionRef(pool, {
    campaignId: camp.campaignId,
    campaignRevisionId: camp.revisionId,
  });
  assert.equal(ref.ok, true);
  return { camp, ref, content };
}

test('A13-01 schema grants flags live=0', async () => {
  await ensureSchemas();
  const { rows } = await pool.query(`SELECT to_regclass('ops.acquisition_campaigns') AS c`);
  assert.ok(rows[0].c);
  const { rows: g } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM information_schema.role_table_grants
    WHERE table_schema='ops' AND table_name IN (
      'acquisition_campaigns','acquisition_campaign_revisions','acquisition_refs',
      'acquisition_touchpoints','lead_attributions','campaign_approvals',
      'acquisition_provider_intents','acquisition_provider_campaigns','acquisition_metric_snapshots'
    ) AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`);
  assert.equal(g[0].n, 0);
  assert.equal(LIVE_AD_SPEND_EUR, 0);
  assert.equal(LIVE_AD_PROVIDER_CALLS, 0);
  assert.equal(LIVE_AI_CALLS_A13, 0);
  assert.equal(LIVE_PAID_CAMPAIGN_ACTIVATIONS, 0);
  assert.equal(OWNER_ACQUISITION_PROVIDER_REQUIRED, true);
  assert.equal(OWNER_ACQUISITION_BUDGET_POLICY_REQUIRED, true);
  assert.equal(AcquisitionAttributionPolicyV1.model, 'LAST_TRACKED_TOUCH');
  assert.equal(AcquisitionBudgetPolicyV1.moneyUnit, 'MICRO_EUR');
  assert.equal(A13_CRITICAL_INVARIANT_KEYS.length > 40, true);
});

test('A13-02..07 campaign destination content binding claim gate', async () => {
  await reset();
  const bad = isAllowedAcquisitionDestination('https://evil.example/phish');
  assert.equal(bad.ok, false);
  const good = isAllowedAcquisitionDestination('https://www.deintarifheld.de/unternehmen');
  assert.equal(good.ok, true);

  const blocked = await produceContentCandidate(pool, {
    briefId: (await createContentBrief(pool, {
      purpose: ContentPurpose.EDUCATION,
      audience: ContentAudience.SME_OWNER,
      topic: 'x',
      primaryMessage: 'y',
      cta: 'Mehr zum Ablauf',
      channel: ContentChannel.SYNTHETIC_LINKEDIN,
    })).briefId,
    mode: ContentGeneratorMode.UNSUPPORTED_SAVINGS,
  });
  const denied = await createAcquisitionCampaign(pool, {
    name: 'bad-claims',
    contentRevisionId: blocked.revisionId,
    totalBudgetEur: '0',
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'UNSUPPORTED_CONTENT_CLAIMS');

  const { camp, ref } = await organicCampaign();
  assert.equal(camp.status, CampaignStatus.APPROVED);
  assert.equal(camp.zeroSpend, true);
  assert.match(ref.acqRef, /^acq_/);
  assert.doesNotMatch(ref.acqRef, /@|email/i);
  const resolved = await resolveAcquisitionRef(pool, ref.acqRef);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.campaignId, camp.campaignId);
});

test('A13-08..15 tracking intake attribution soft-fail forged direct', async () => {
  await reset();
  const { camp, ref } = await organicCampaign();

  await recordTouchpoint(pool, {
    acqRef: ref.acqRef,
    touchpointType: TouchpointType.LANDING_VISIT,
    meta: { fingerprint: 'SHOULD_DROP', email: 'x@y.z', path: '/unternehmen' },
  });
  const { rows: tps } = await pool.query(
    `SELECT meta FROM ops.acquisition_touchpoints WHERE acq_ref=$1`,
    [ref.acqRef],
  );
  assert.equal(tps[0].meta.fingerprint, undefined);
  assert.equal(tps[0].meta.email, undefined);

  const lead = await acceptLeadWithAcquisition(pool, {
    email: 'organic@example.invalid',
    firma: 'Organic GmbH',
    idempotencyKey: idem('org'),
    acqRef: ref.acqRef,
    clientCampaignId: 'forged-campaign',
    clientBudget: '99999',
    clientAttribution: { campaignId: 'hijack' },
  });
  assert.equal(lead.ok, true);
  assert.equal(lead.caseCreatedByAcquisition, false);
  assert.equal(lead.attribution.credited, true);
  assert.equal(lead.attribution.campaignId, camp.campaignId);
  assert.equal(lead.attribution.attributionState, AttributionState.ATTRIBUTED);

  const forged = await acceptLeadWithAcquisition(pool, {
    email: 'forged@example.invalid',
    firma: 'Forged',
    idempotencyKey: idem('frg'),
    acqRef: 'acq_FORGED_TOKEN_NOT_REAL_xxxxx',
  });
  assert.equal(forged.ok, true);
  assert.equal(forged.attribution.attributionState, AttributionState.FORGED_REF_IGNORED);
  assert.equal(forged.attribution.credited, false);

  const direct = await acceptLeadWithAcquisition(pool, {
    email: 'direct@example.invalid',
    firma: 'Direct',
    idempotencyKey: idem('dir'),
  });
  assert.equal(direct.ok, true);
  assert.equal(direct.attribution.attributionState, AttributionState.DIRECT);

  const soft = await acceptLeadWithAcquisition(pool, {
    email: 'soft@example.invalid',
    firma: 'Soft',
    idempotencyKey: idem('soft'),
    acqRef: ref.acqRef,
    failureInjector: {
      attribution: {
        beforeInsert: async () => {
          throw new Error('FI_A13_04_ATTRIBUTION');
        },
      },
    },
  });
  assert.equal(soft.ok, true);
  assert.equal(soft.leadId != null, true);
  assert.equal(soft.attribution.softFail || soft.attribution.attributionState === AttributionState.SOFT_FAIL, true);

  const beforeCases = await pool.query(
    `SELECT count(*)::int AS n FROM public.cases WHERE source_lead_id=$1`,
    [lead.leadId],
  );
  assert.equal(beforeCases.rows[0].n, 0);
  assert.equal(lead.caseCreatedByAcquisition, false);
  await processOneBusinessLeadHandoff(pool);
});

test('A13-16..22 approval budget paid provider create≠active', async () => {
  await reset();
  assert.equal(String(parseBudgetMicroEur('10')), '10000000');
  assert.throws(() => parseBudgetMicroEur(0.28), /FLOAT/);

  const paid = await createAcquisitionCampaign(pool, {
    name: 'Paid synth',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '50',
    dailyBudgetEur: '10',
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.status, CampaignStatus.APPROVAL_REQUIRED);
  const early = await activateAcquisitionCampaign(pool, { campaignId: paid.campaignId });
  assert.equal(early.ok, false);

  const appr = await approveAcquisitionCampaign(pool, {
    revisionId: paid.revisionId,
    expectedBudgetHash: paid.budgetHash,
  });
  assert.equal(appr.ok, true);

  const createdOnly = await scheduleProviderIntent(pool, {
    campaignId: paid.campaignId,
    intentKind: 'CREATE',
  });
  const createRes = await executeCreateCampaignIntent(pool, { intentId: createdOnly.intentId });
  assert.equal(createRes.ok, true);
  assert.equal(createRes.created, true);
  assert.equal(createRes.active, false);

  const act = await scheduleProviderIntent(pool, {
    campaignId: paid.campaignId,
    intentKind: 'ACTIVATE',
  });
  const actRes = await executeActivateCampaignIntent(pool, { intentId: act.intentId });
  assert.equal(actRes.ok, true);
  assert.equal(actRes.activated, true);

  const revised = await reviseAcquisitionCampaign(pool, {
    campaignId: paid.campaignId,
    totalBudgetEur: '100',
  });
  assert.equal(revised.ok, true);
  assert.equal(revised.status, CampaignStatus.APPROVAL_REQUIRED);
  const stale = await approveAcquisitionCampaign(pool, {
    revisionId: paid.revisionId,
    expectedBudgetHash: paid.budgetHash,
  });
  assert.equal(stale.ok, false);
  assert.ok(['STALE_CAMPAIGN_REVISION', 'STALE_CAMPAIGN_APPROVAL'].includes(stale.code));
});

test('A13-23..30 outcome unknown reconcile kill pause mismatch', async () => {
  await reset();
  const paid = await createAcquisitionCampaign(pool, {
    name: 'Unknown path',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '20',
    dailyBudgetEur: '5',
  });
  await approveAcquisitionCampaign(pool, {
    revisionId: paid.revisionId,
    expectedBudgetHash: paid.budgetHash,
  });

  setAcquisitionProviderTestMode('CREATE_TIMEOUT_UNKNOWN');
  const sched = await scheduleProviderIntent(pool, {
    campaignId: paid.campaignId,
    intentKind: 'CREATE',
  });
  const unk = await executeCreateCampaignIntent(pool, { intentId: sched.intentId });
  assert.equal(unk.outcomeUnknown, true);
  assert.equal(unk.blindRetry, false);
  const blind = await executeCreateCampaignIntent(pool, { intentId: sched.intentId });
  assert.equal(blind.ok, false);
  assert.equal(blind.code, 'RECONCILIATION_REQUIRED');
  assert.equal(blind.blindRetry, false);
  assert.equal(getAcquisitionProviderCreateCount(sched.idempotencyKey), 1);

  setAcquisitionProviderTestMode('READBACK_FOUND');
  const found = await reconcileAcquisitionCampaign(pool, { intentId: sched.intentId });
  assert.equal(found.ok, true);
  assert.equal(found.adopted, true);
  assert.equal(found.blindRetry, false);

  await reset();
  const killCamp = await createAcquisitionCampaign(pool, {
    name: 'Kill camp',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '5',
  });
  await approveAcquisitionCampaign(pool, {
    revisionId: killCamp.revisionId,
    expectedBudgetHash: killCamp.budgetHash,
  });
  await setGlobalKill(pool, true, { reason: 'a13-kill', actor: 'TEST' });
  const blocked = await activateAcquisitionCampaign(pool, { campaignId: killCamp.campaignId });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'GLOBAL_KILL');
  assert.equal(blocked.providerCalls, 0);
  await setGlobalKill(pool, false, { reason: 'a13-kill-off', actor: 'TEST' });

  await reset();
  const p = await createAcquisitionCampaign(pool, {
    name: 'Pause',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '5',
  });
  await approveAcquisitionCampaign(pool, {
    revisionId: p.revisionId,
    expectedBudgetHash: p.budgetHash,
  });
  const act = await activateAcquisitionCampaign(pool, { campaignId: p.campaignId });
  assert.equal(act.ok, true);
  const paused = await pauseAcquisitionCampaign(pool, { campaignId: p.campaignId });
  assert.equal(paused.ok, true);

  await reset();
  const m = await createAcquisitionCampaign(pool, {
    name: 'Mismatch',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '5',
  });
  await approveAcquisitionCampaign(pool, {
    revisionId: m.revisionId,
    expectedBudgetHash: m.budgetHash,
  });
  setAcquisitionProviderTestMode('CREATE_TIMEOUT_UNKNOWN');
  const s2 = await scheduleProviderIntent(pool, { campaignId: m.campaignId, intentKind: 'CREATE' });
  await executeCreateCampaignIntent(pool, { intentId: s2.intentId });
  setAcquisitionProviderTestMode('READBACK_MISMATCH');
  const mm = await reconcileAcquisitionCampaign(pool, { intentId: s2.intentId });
  assert.equal(mm.ok, false);
  assert.equal(mm.code, 'PROVIDER_ACCOUNT_MISMATCH_REVIEW_REQUIRED');
});

test('A13-31..35 CPL ROAS metrics downstream observation', async () => {
  await reset();
  assert.equal(computeCplMicroEur({ spendMicroEur: 0, leadsAccepted: 3 }).cpl, 'UNKNOWN');
  assert.equal(computeRoas({ spendMicroEur: 100, revenueMicroEur: null }).roas, 'UNKNOWN');
  const cpl = computeCplMicroEur({ spendMicroEur: 10_000_000n, leadsAccepted: 2 });
  assert.equal(cpl.cpl, 'COMPUTED');
  assert.equal(String(cpl.cplMicroEur), '5000000');

  const { camp, ref } = await organicCampaign();
  await acceptLeadWithAcquisition(pool, {
    email: 'cpl@example.invalid',
    firma: 'CPL',
    idempotencyKey: idem('cpl'),
    acqRef: ref.acqRef,
  });
  const snap = await refreshAcquisitionMetrics(pool, { campaignId: camp.campaignId });
  assert.equal(snap.ok, true);
  assert.equal(snap.roas, 'UNKNOWN');
  assert.equal(snap.cpl, 'UNKNOWN');
  const fake = await refreshAcquisitionMetrics(pool, {
    campaignId: camp.campaignId,
    forceFakeRoas: true,
  });
  assert.equal(fake.ok, false);
});

test('A13-36..42 A11 commands authz privacy claim cancel', async () => {
  await reset();
  const paid = await createAcquisitionCampaign(pool, {
    name: 'A11 paid',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '15',
  });
  const viewer = identity('TEST_VIEWER');
  const deny = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_ACQUISITION_CAMPAIGN,
    targetId: paid.revisionId,
    expectedRevision: paid.budgetHash,
    confirm: true,
    idempotencyKey: idem('deny'),
    correlationId: idem('corr-deny'),
  }, viewer);
  assert.equal(deny.ok, false);

  const approver = identity('TEST_APPROVER');
  const okAppr = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_ACQUISITION_CAMPAIGN,
    targetId: paid.revisionId,
    expectedRevision: paid.budgetHash,
    confirm: true,
    idempotencyKey: idem('appr'),
    correlationId: idem('corr-appr'),
  }, approver);
  assert.equal(okAppr.ok, true);

  const owner = identity('TEST_OWNER');
  const act = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.ACTIVATE_ACQUISITION_CAMPAIGN,
    targetId: paid.campaignId,
    confirm: true,
    idempotencyKey: idem('act'),
    correlationId: idem('corr-act'),
  }, owner);
  assert.equal(act.ok, true);

  const pause = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.PAUSE_ACQUISITION_CAMPAIGN,
    targetId: paid.campaignId,
    reason: 'test-pause',
    confirm: true,
    idempotencyKey: idem('pause'),
    correlationId: idem('corr-pause'),
  }, owner);
  assert.equal(pause.ok, true);

  const readiness = getProductionReadinessView();
  assert.ok(readiness.gates.some((g) => g.id === 'A13_ACQUISITION_PROVIDER' && g.status === 'BLOCKED'));
  assert.equal(readiness.stagingAcquisitionAutonomyReady, false);

  await reset();
  const cancelCamp = await createAcquisitionCampaign(pool, {
    name: 'Cancel',
    totalBudgetEur: '0',
  });
  const cancelled = await cancelAcquisitionCampaign(pool, { campaignId: cancelCamp.campaignId });
  assert.equal(cancelled.ok, true);

  const rejected = await createAcquisitionCampaign(pool, {
    name: 'Reject',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '8',
  });
  const rej = await rejectAcquisitionCampaign(pool, { revisionId: rejected.revisionId });
  assert.equal(rej.ok, true);
});

test('A13-43..47 live=0 A14 handoff stress BOUNDED critical invariants', async () => {
  await reset();
  assert.equal(getAcquisitionProviderLiveCallCount(), 0);
  setAcquisitionProviderTestMode('FORCE_LIVE');
  const paid = await createAcquisitionCampaign(pool, {
    name: 'Live forbid',
    sourceKind: AcquisitionSourceKind.PAID_CAMPAIGN,
    totalBudgetEur: '5',
  });
  await approveAcquisitionCampaign(pool, {
    revisionId: paid.revisionId,
    expectedBudgetHash: paid.budgetHash,
  });
  setAcquisitionProviderTestMode('CREATE_ACCEPTED');

  const handoff = buildA14AcquisitionHandoff();
  assert.equal(handoff.ok, true);
  assert.equal(handoff.autonomyActionsPerformed, 0);
  assert.ok(handoff.matrix.some((m) => m.status === 'OWNER_DECISION_REQUIRED'));
  assert.ok(handoff.matrix.some((m) => m.id === 'E2_LOCAL_ACQUISITION_LOOP'));

  // Stress BOUNDED: 8 campaigns / 8 leads
  for (let i = 0; i < 8; i += 1) {
    const { camp, ref } = await organicCampaign({ name: `stress-${i}` });
    await acceptLeadWithAcquisition(pool, {
      email: `st${i}@example.invalid`,
      firma: `ST${i}`,
      idempotencyKey: idem(`st${i}`),
      acqRef: ref.acqRef,
    });
    void camp;
  }
  const leads = await pool.query(`SELECT count(*)::int AS n FROM public.leads`);
  assert.equal(leads.rows[0].n, 8);
  const attrs = await pool.query(
    `SELECT count(*)::int AS n FROM ops.lead_attributions WHERE attribution_state='ATTRIBUTED'`,
  );
  assert.equal(attrs.rows[0].n, 8);

  const inv = assertA13CriticalInvariantsZero();
  assert.equal(inv.ok, true, JSON.stringify(inv.bad));
  const counters = getA13InvariantCounters();
  assert.equal(counters.VALID_LEADS_LOST_DUE_TO_ATTRIBUTION_FAILURE, 0);
  assert.equal(counters.ACQUISITION_DIRECT_CASE_CREATIONS, 0);
  assert.equal(counters.LIVE_AD_SPEND_EUR, 0);
  assert.equal(counters.LIVE_AD_PROVIDER_CALLS, 0);
  assert.equal(counters.OUTCOME_UNKNOWN_ACQUISITION_BLIND_RETRIES, 0);
});

test('A13-E2E organic content → tracked CTA → lead → attribution', async () => {
  await reset();
  const { camp, ref, content } = await organicCampaign();
  assert.ok(content.revisionId);
  await recordTouchpoint(pool, {
    acqRef: ref.acqRef,
    touchpointType: TouchpointType.CTA_CLICK,
  });
  await recordTouchpoint(pool, {
    acqRef: ref.acqRef,
    touchpointType: TouchpointType.LANDING_VISIT,
  });
  const lead = await acceptLeadWithAcquisition(pool, {
    email: 'e2e-a13@example.invalid',
    firma: 'E2E A13 GmbH',
    idempotencyKey: idem('e2e'),
    acqRef: ref.acqRef,
  });
  assert.equal(lead.ok, true);
  assert.equal(lead.attribution.campaignId, camp.campaignId);
  assert.equal(lead.acquisitionDirectCaseCreations, 0);
  const metrics = await refreshAcquisitionMetrics(pool, { campaignId: camp.campaignId });
  assert.equal(metrics.roas, 'UNKNOWN');
  const inv = assertA13CriticalInvariantsZero();
  assert.equal(inv.ok, true, JSON.stringify(inv.bad));
});
