/**
 * DTH-A12 Content Autopilot — E2 local.
 * AI candidate only. No live social/AI. Claim-safe publication.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ContentPurpose,
  ContentAudience,
  ContentChannel,
  ContentGeneratorMode,
  ContentStatus,
  ContentRiskClass,
  LIVE_AI_CALLS_A12,
  LIVE_SOCIAL_PROVIDER_CALLS,
  LIVE_CONTENT_PUBLICATIONS,
  OWNER_CONTENT_AI_PROVIDER_REQUIRED,
  OWNER_CONTENT_PUBLISHING_PROVIDER_REQUIRED,
  ContentStrategyPolicyV1,
  BrandPolicyV1,
  OperatorCommandType,
} from '@deintarifheld/shared';
import {
  createLocalOutboxPool,
  wipeContentDomain,
  createContentBrief,
  produceContentCandidate,
  createSupersedingRevision,
  listContentClaims,
  approveContentRevision,
  rejectContentRevision,
  scheduleContentPublication,
  publishContentIntent,
  reconcileContentPublication,
  cancelContentPublication,
  createDeterministicTestPublishingProvider,
  resetContentPublisherTestStore,
  setContentPublisherTestMode,
  getContentPublisherPublishCount,
  refreshContentMetrics,
  listContentMetricSnapshots,
  buildA13ContentHandoff,
  renderForChannel,
  channelFactsEquivalent,
  createA11ReadService,
  executeOperatorCommand,
  getProductionReadinessView,
  setGlobalKill,
} from '@deintarifheld/db';
import { authenticateTestOperator } from '@deintarifheld/ops-api';
import { gateA11Request } from '@deintarifheld/ops-api';

const DB_URL =
  process.env.DTH_A12_DATABASE_URL ||
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
  const { rows } = await pool.query(`SELECT to_regclass('ops.content_briefs') AS c`);
  if (!rows[0].c) {
    await pool.query(readFileSync(join(migDir, '20260818190000_a12_content_autopilot.sql'), 'utf8'));
  }
}

async function reset() {
  await ensureSchemas();
  await wipeContentDomain(pool);
  resetContentPublisherTestStore();
  setContentPublisherTestMode('PUBLISH_ACCEPTED');
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('GLOBAL','AUTOMATION','INACTIVE','a12','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
  await pool.query(
    `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
     VALUES ('DOMAIN','AUTOMATION_ENGINE','INACTIVE','a12','TEST')
     ON CONFLICT (scope,scope_key) DO UPDATE SET state='INACTIVE', updated_at=now()`,
  );
}

async function makeBrief(over = {}) {
  return createContentBrief(pool, {
    purpose: ContentPurpose.EDUCATION,
    audience: ContentAudience.SME_OWNER,
    topic: 'Energiewechsel Prozess',
    primaryMessage: 'Ablauf erklären ohne Preisversprechen',
    cta: 'Mehr zum Ablauf',
    channel: ContentChannel.SYNTHETIC_LINKEDIN,
    ...over,
  });
}

async function produce(mode, opts = {}) {
  const b = await makeBrief(opts.brief || {});
  assert.equal(b.ok, true);
  const p = await produceContentCandidate(pool, {
    briefId: b.briefId,
    mode,
    approvalPolicy: opts.approvalPolicy,
  });
  return { brief: b, produced: p };
}

test('A12-01 schema + grants + flags', async () => {
  await ensureSchemas();
  const { rows } = await pool.query(`SELECT to_regclass('ops.content_briefs') AS c`);
  assert.ok(rows[0].c);
  const { rows: g } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM information_schema.role_table_grants
    WHERE table_schema='ops' AND table_name IN (
      'content_briefs','content_items','content_revisions','content_claims',
      'content_approvals','content_publication_intents','content_publications','content_metric_snapshots'
    ) AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`);
  assert.equal(g[0].n, 0);
  assert.equal(LIVE_AI_CALLS_A12, 0);
  assert.equal(LIVE_SOCIAL_PROVIDER_CALLS, 0);
  assert.equal(LIVE_CONTENT_PUBLICATIONS, 0);
  assert.equal(OWNER_CONTENT_AI_PROVIDER_REQUIRED, true);
  assert.equal(OWNER_CONTENT_PUBLISHING_PROVIDER_REQUIRED, true);
  assert.equal(ContentStrategyPolicyV1.liveChannelsAllowed, false);
  assert.equal(ContentStrategyPolicyV1.aiIsCandidateOnly, true);
});

test('A12-02/03 strategy brief + generator port', async () => {
  await reset();
  const b = await makeBrief();
  assert.equal(b.ok, true);
  assert.equal(b.brief.purpose, ContentPurpose.EDUCATION);
  const { produced } = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  assert.equal(produced.ok, true);
  assert.equal(produced.candidateOnly, true);
  assert.equal(produced.status, ContentStatus.APPROVED);
  assert.equal(produced.riskClass, ContentRiskClass.LOW);
});

test('A12-10..13 claim blocks savings tariff testimonial superlative', async () => {
  await reset();
  for (const mode of [
    ContentGeneratorMode.UNSUPPORTED_SAVINGS,
    ContentGeneratorMode.SYNTHETIC_TARIFF_AS_LIVE,
    ContentGeneratorMode.FAKE_TESTIMONIAL,
    ContentGeneratorMode.MARKET_SUPERLATIVE,
  ]) {
    const { produced } = await produce(mode);
    assert.equal(produced.ok, true);
    assert.equal(produced.status, ContentStatus.BLOCKED);
    const claims = await listContentClaims(pool, produced.revisionId);
    assert.ok(claims.some((c) => ['PROHIBITED', 'UNSUPPORTED'].includes(c.claim_state)));
    const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
    assert.equal(sched.ok, false);
  }
});

test('A12-16/17 approval + stale approval', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.HIGH_RISK_SUPPORTED);
  assert.equal(produced.status, ContentStatus.APPROVAL_REQUIRED);
  const badSched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  assert.equal(badSched.ok, false);
  const appr = await approveContentRevision(pool, {
    revisionId: produced.revisionId,
    expectedHash: produced.contentHash,
  });
  assert.equal(appr.ok, true);
  const next = await createSupersedingRevision(pool, {
    contentItemId: produced.contentItemId,
    mode: ContentGeneratorMode.SAFE_EDUCATION,
    bodyOverride: 'Geänderter Text ohne Freigabe der alten Revision.',
  });
  assert.equal(next.ok, true);
  const stale = await approveContentRevision(pool, {
    revisionId: next.revisionId,
    expectedHash: produced.contentHash,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'STALE_CONTENT_APPROVAL');
  const staleSched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  assert.equal(staleSched.ok, false);
});

test('A12-18/19 channel render + unapproved links + XSS', async () => {
  await reset();
  const a = renderForChannel({
    headline: 'A',
    bodyText: 'Kernfakt Prozess',
    cta: 'FAQ lesen',
    hashtags: ['#a'],
    links: ['https://www.deintarifheld.de/unternehmen'],
  }, ContentChannel.SYNTHETIC_LINKEDIN);
  const b = renderForChannel({
    headline: 'A',
    bodyText: 'Kernfakt Prozess',
    cta: 'FAQ lesen',
    hashtags: ['#a'],
    links: ['https://www.deintarifheld.de/unternehmen'],
  }, ContentChannel.SYNTHETIC_BLOG);
  assert.equal(channelFactsEquivalent(a.channelPayload, b.channelPayload), true);
  assert.match(a.channelPayload.plaintext, /&lt;|&gt;|&amp;|Kernfakt/);

  const link = await produce(ContentGeneratorMode.UNAPPROVED_LINK);
  assert.equal(link.produced.status, ContentStatus.BLOCKED);
  const xss = await produce(ContentGeneratorMode.XSS_PAYLOAD);
  assert.equal(xss.produced.status, ContentStatus.BLOCKED);
});

test('A12-20..25 publish idempotency unknown reconcile', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  assert.equal(sched.ok, true);
  const pub1 = await publishContentIntent(pool, { intentId: sched.intentId });
  assert.equal(pub1.ok, true);
  assert.equal(pub1.published, true);
  const key = sched.idempotencyKey;
  assert.equal(getContentPublisherPublishCount(key), 1);
  const pub2 = await publishContentIntent(pool, { intentId: sched.intentId });
  assert.equal(pub2.ok, true);
  assert.equal(pub2.alreadyPublished || pub2.published, true);
  assert.equal(getContentPublisherPublishCount(key), 1);

  await reset();
  const unk = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const s2 = await scheduleContentPublication(pool, { revisionId: unk.produced.revisionId });
  setContentPublisherTestMode('PUBLISH_TIMEOUT_UNKNOWN');
  const timeout = await publishContentIntent(pool, { intentId: s2.intentId });
  assert.equal(timeout.outcomeUnknown, true);
  assert.equal(timeout.blindRetry, false);
  const blind = await publishContentIntent(pool, { intentId: s2.intentId });
  assert.equal(blind.ok, false);
  assert.equal(blind.code, 'RECONCILIATION_REQUIRED');
  assert.equal(blind.blindRetry, false);

  setContentPublisherTestMode('READBACK_FOUND');
  const found = await reconcileContentPublication(pool, { intentId: s2.intentId });
  assert.equal(found.ok, true);
  assert.equal(found.adopted, true);
  assert.equal(found.blindRetry, false);
});

test('A12-26/27/28 cancel superseded global kill', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  const cancel = await cancelContentPublication(pool, { intentId: sched.intentId });
  assert.equal(cancel.ok, true);
  const after = await publishContentIntent(pool, { intentId: sched.intentId });
  assert.equal(after.ok, false);
  assert.equal(after.code, 'CANCELLED');
  assert.equal(after.providerCalls, 0);

  await reset();
  const a = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  await scheduleContentPublication(pool, { revisionId: a.produced.revisionId });
  const next = await createSupersedingRevision(pool, {
    contentItemId: a.produced.contentItemId,
    mode: ContentGeneratorMode.SAFE_EDUCATION,
    bodyOverride: 'Neue Revision',
  });
  assert.equal(next.ok, true);
  const stalePub = await publishContentIntent(pool, {
    intentId: (await pool.query(
      `SELECT id FROM ops.content_publication_intents WHERE content_revision_id=$1`,
      [a.produced.revisionId],
    )).rows[0].id,
  });
  assert.equal(stalePub.ok, false);
  assert.ok(['STALE_CONTENT_REVISION', 'CANCELLED', 'APPROVAL_MISSING'].includes(stalePub.code)
    || stalePub.providerCalls === 0);

  await reset();
  const k = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const sk = await scheduleContentPublication(pool, { revisionId: k.produced.revisionId });
  await setGlobalKill(pool, true, { reason: 'a12-test', actor: 'TEST' });
  const killed = await publishContentIntent(pool, { intentId: sk.intentId });
  assert.equal(killed.ok, false);
  assert.equal(killed.code, 'GLOBAL_KILL');
  assert.equal(killed.providerCalls, 0);
  await setGlobalKill(pool, false, { reason: 'a12-clear', actor: 'TEST' });

  await reset();
  const cu = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const scu = await scheduleContentPublication(pool, { revisionId: cu.produced.revisionId });
  const saved = await pool.query(
    `SELECT scope, scope_key, state, reason, updated_by FROM security.control_state
     WHERE scope='GLOBAL' AND scope_key='AUTOMATION'`,
  );
  await pool.query(`DELETE FROM security.control_state WHERE scope='GLOBAL' AND scope_key='AUTOMATION'`);
  try {
    const unavailable = await publishContentIntent(pool, { intentId: scu.intentId });
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.code, 'CONTROL_UNAVAILABLE');
    assert.equal(unavailable.providerCalls, 0);
  } finally {
    const row = saved.rows[0];
    await pool.query(
      `INSERT INTO security.control_state (scope,scope_key,state,reason,updated_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (scope,scope_key) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
      [row.scope, row.scope_key, row.state, row.reason, row.updated_by],
    );
  }
});

test('A12-30/31 prompt injection + brand', async () => {
  await reset();
  const inj = await produce(ContentGeneratorMode.PROMPT_INJECTION);
  assert.equal(inj.produced.status, ContentStatus.BLOCKED);
  assert.equal(BrandPolicyV1.canonicalName, 'DeinTarifheld');
});

test('A12-32/33 A11 approve + reconcile', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.HIGH_RISK_SUPPORTED);
  const approver = identity('TEST_APPROVER');
  const ok = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_CONTENT,
    targetId: produced.revisionId,
    expectedRevision: produced.contentHash,
    confirm: true,
    idempotencyKey: idem('a11-appr'),
    correlationId: idem('corr'),
  }, approver);
  assert.equal(ok.ok, true);

  const viewer = identity('TEST_VIEWER');
  const denied = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.APPROVE_CONTENT,
    targetId: produced.revisionId,
    expectedRevision: produced.contentHash,
    confirm: true,
    idempotencyKey: idem('a11-deny'),
    correlationId: idem('corr2'),
  }, viewer);
  assert.equal(denied.ok, false);

  const inbox = await reads.listOpsInbox({ limit: 50 });
  assert.ok(Array.isArray(inbox.items));

  const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  setContentPublisherTestMode('PUBLISH_TIMEOUT_UNKNOWN');
  await publishContentIntent(pool, { intentId: sched.intentId });
  const op = identity('TEST_OPERATOR');
  setContentPublisherTestMode('READBACK_FOUND');
  const rec = await executeOperatorCommand(pool, {
    commandType: OperatorCommandType.RECONCILE_CONTENT_PUBLICATION,
    targetId: sched.intentId,
    confirm: true,
    reason: 'reconcile unknown',
    idempotencyKey: idem('a11-rec'),
    correlationId: idem('corr3'),
  }, op);
  assert.equal(rec.ok, true);
  assert.equal(rec.blindRetry, false);
});

test('A12-34/35 metrics + A13 handoff', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  const pub = await publishContentIntent(pool, { intentId: sched.intentId });
  assert.equal(pub.published, true);
  const m = await refreshContentMetrics(pool, { publicationId: pub.publication.id });
  assert.equal(m.ok, true);
  assert.equal(m.revenueAttribution, null);
  const snaps = await listContentMetricSnapshots(pool, pub.publication.id);
  assert.ok(snaps.length >= 1);
  const handoff = await buildA13ContentHandoff(pool, { publicationId: pub.publication.id });
  assert.equal(handoff.ok, true);
  assert.equal(handoff.acquisitionActionsPerformed, 0);
  assert.ok(handoff.handoff.content_id);
  assert.ok(handoff.handoff.tracking_correlation_id);
});

test('A12-36/37 no live markers + readiness no false green', async () => {
  assert.equal(LIVE_AI_CALLS_A12, 0);
  assert.equal(LIVE_SOCIAL_PROVIDER_CALLS, 0);
  const ready = getProductionReadinessView();
  assert.equal(ready.falseGreens, 0);
  assert.equal(ready.overall, 'NOT_READY');
  assert.ok(ready.gates.some((g) => g.id === 'A12_CONTENT_AI' && g.status === 'BLOCKED'));
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../db/src/a12/publish.js'), 'utf8');
  assert.equal(/openai|anthropic|meta\.com|linkedin\.com\/oauth/i.test(src), false);
});

test('A12-38 bounded stress', async () => {
  await reset();
  const n = 25;
  let published = 0;
  let blocked = 0;
  for (let i = 0; i < n; i += 1) {
    const mode = i % 5 === 0
      ? ContentGeneratorMode.UNSUPPORTED_SAVINGS
      : ContentGeneratorMode.SAFE_EDUCATION;
    const { produced } = await produce(mode, {
      approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
      brief: { topic: `Topic ${i}`, primaryMessage: `Message ${i}` },
    });
    if (produced.status === ContentStatus.BLOCKED) {
      blocked += 1;
      continue;
    }
    const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
    assert.equal(sched.ok, true);
    const pub = await publishContentIntent(pool, { intentId: sched.intentId });
    if (pub.published) published += 1;
    await publishContentIntent(pool, { intentId: sched.intentId });
  }
  assert.ok(blocked >= 1);
  assert.ok(published >= 1);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ops.content_publications WHERE state='PUBLISHED'`,
  );
  assert.equal(rows[0].n, published);
});

test('A12 reject + absent reconcile', async () => {
  await reset();
  const { produced } = await produce(ContentGeneratorMode.HIGH_RISK_SUPPORTED);
  const rej = await rejectContentRevision(pool, { revisionId: produced.revisionId });
  assert.equal(rej.ok, true);
  const sched = await scheduleContentPublication(pool, { revisionId: produced.revisionId });
  assert.equal(sched.ok, false);

  await reset();
  const ok = await produce(ContentGeneratorMode.SAFE_EDUCATION, {
    approvalPolicy: { autoApproveRiskClasses: ['LOW'] },
  });
  const s = await scheduleContentPublication(pool, { revisionId: ok.produced.revisionId });
  setContentPublisherTestMode('PUBLISH_TIMEOUT_UNKNOWN');
  await publishContentIntent(pool, { intentId: s.intentId });
  setContentPublisherTestMode('READBACK_NOT_FOUND');
  const absent = await reconcileContentPublication(pool, { intentId: s.intentId });
  assert.equal(absent.absent, true);
  assert.equal(absent.safeRetryEligible, true);
  assert.equal(absent.blindRetry, false);
});
