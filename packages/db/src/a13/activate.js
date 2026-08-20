/**
 * Durable create/activate/pause intents. Fresh claim check. Kill fail-closed.
 * create ≠ active. OUTCOME_UNKNOWN: no blind recreate/reactivate.
 */
import { randomUUID } from 'node:crypto';
import {
  CampaignStatus,
  CampaignIntentState,
  CampaignIntentKind,
  AcquisitionProviderCampaignState,
  ClaimState,
  A13_TEST_PROVIDER_ID,
} from '@deintarifheld/shared';
import { acquisitionControlGate, assertNoLiveAcquisition } from './policy.js';
import { loadBoundApproval } from './approval.js';
import { createDeterministicTestAcquisitionProvider } from './provider.js';
import { bumpA13Invariant } from './invariants.js';

async function freshContentClaimsOk(pool, contentRevisionId) {
  if (!contentRevisionId) return { ok: true };
  const { rows: rev } = await pool.query(
    `SELECT * FROM ops.content_revisions WHERE id=$1`,
    [contentRevisionId],
  );
  if (!rev[0]) return { ok: false, code: 'CONTENT_REVISION_NOT_FOUND' };
  if (!rev[0].is_current) return { ok: false, code: 'STALE_CONTENT_REVISION' };
  const { rows: claims } = await pool.query(
    `SELECT claim_state, claim_type FROM ops.content_claims WHERE content_revision_id=$1`,
    [contentRevisionId],
  );
  if (claims.some((c) => [ClaimState.PROHIBITED, ClaimState.UNSUPPORTED].includes(c.claim_state))) {
    return { ok: false, code: 'UNSUPPORTED_CONTENT_CLAIMS' };
  }
  if (claims.some((c) => c.claim_type === 'TARIFF_AS_LIVE')) {
    return { ok: false, code: 'SYNTHETIC_TARIFF_CLAIM_FORBIDDEN' };
  }
  return { ok: true, contentHash: rev[0].content_hash };
}

async function loadCurrentRevision(pool, campaignId) {
  const { rows } = await pool.query(`SELECT * FROM ops.acquisition_campaigns WHERE id=$1`, [campaignId]);
  const camp = rows[0];
  if (!camp) return { ok: false, code: 'CAMPAIGN_NOT_FOUND' };
  const { rows: rev } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [camp.current_revision_id],
  );
  if (!rev[0] || !rev[0].is_current) return { ok: false, code: 'STALE_CAMPAIGN_REVISION' };
  return { ok: true, campaign: camp, revision: rev[0] };
}

export async function scheduleProviderIntent(pool, {
  campaignId,
  intentKind,
  idempotencyKey = null,
} = {}) {
  if (!campaignId) return { ok: false, code: 'CAMPAIGN_ID_REQUIRED' };
  if (!Object.values(CampaignIntentKind).includes(intentKind)) {
    return { ok: false, code: 'INVALID_INTENT_KIND' };
  }
  const loaded = await loadCurrentRevision(pool, campaignId);
  if (!loaded.ok) return loaded;
  const { revision } = loaded;

  const key = idempotencyKey || `${intentKind}:${revision.id}:${revision.budget_hash}`;
  const { rows: existing } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_intents WHERE idempotency_key=$1`,
    [key],
  );
  if (existing[0]) {
    if (intentKind === CampaignIntentKind.ACTIVATE && existing[0].state !== CampaignIntentState.CANCELLED) {
      // duplicate activation intent protection
      return { ok: true, duplicate: true, intent: existing[0], intentId: existing[0].id, idempotencyKey: key };
    }
    return { ok: true, duplicate: true, intent: existing[0], intentId: existing[0].id, idempotencyKey: key };
  }

  const { rows } = await pool.query(
    `INSERT INTO ops.acquisition_provider_intents
      (campaign_id, campaign_revision_id, intent_kind, provider_code, provider_account_ref,
       budget_hash, idempotency_key, state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'SCHEDULED')
     RETURNING *`,
    [
      campaignId, revision.id, intentKind, revision.provider_code, revision.provider_account_ref,
      revision.budget_hash, key,
    ],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.intent_created',$1::jsonb)`,
    [JSON.stringify({ intent_id: rows[0].id, intent_kind: intentKind, campaign_id: campaignId })],
  );
  return { ok: true, intent: rows[0], intentId: rows[0].id, idempotencyKey: key };
}

export async function executeCreateCampaignIntent(pool, {
  intentId,
  provider = null,
} = {}) {
  if (!intentId) return { ok: false, code: 'INTENT_ID_REQUIRED', providerCalls: 0 };
  assertNoLiveAcquisition();
  const acqProvider = provider || createDeterministicTestAcquisitionProvider();
  const gate = await acquisitionControlGate(pool);
  if (!gate.ok) {
    return { ok: false, code: gate.code, providerCalls: 0 };
  }

  const { rows: intents } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_intents WHERE id=$1`,
    [intentId],
  );
  const intent = intents[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND', providerCalls: 0 };
  if (intent.intent_kind !== CampaignIntentKind.CREATE) {
    return { ok: false, code: 'NOT_CREATE_INTENT', providerCalls: 0 };
  }
  if (intent.state === CampaignIntentState.CANCELLED) {
    return { ok: false, code: 'CANCELLED', providerCalls: 0 };
  }
  if (intent.state === CampaignIntentState.OUTCOME_UNKNOWN) {
    return {
      ok: false,
      code: 'RECONCILIATION_REQUIRED',
      blindRetry: false,
      providerCalls: 0,
      explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT RECREATE BLINDLY.',
    };
  }
  if (intent.state === CampaignIntentState.PROVIDER_ACCEPTED) {
    const { rows: pcs } = await pool.query(
      `SELECT * FROM ops.acquisition_provider_campaigns WHERE create_intent_id=$1`,
      [intentId],
    );
    return { ok: true, alreadyCreated: true, providerCampaign: pcs[0] || null, providerCalls: 0 };
  }

  const { rows: revs } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [intent.campaign_revision_id],
  );
  const rev = revs[0];
  if (!rev || !rev.is_current) {
    return { ok: false, code: 'STALE_CAMPAIGN_REVISION', providerCalls: 0 };
  }
  if (rev.budget_hash !== intent.budget_hash) {
    return { ok: false, code: 'BUDGET_HASH_MISMATCH', providerCalls: 0 };
  }

  const appr = await loadBoundApproval(pool, rev.id, rev.budget_hash);
  if (!appr.ok) return { ok: false, code: appr.code, providerCalls: 0 };
  const claims = await freshContentClaimsOk(pool, rev.content_revision_id);
  if (!claims.ok) return { ok: false, code: claims.code, providerCalls: 0 };

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='CREATED', updated_at=now() WHERE id=$1`,
    [intentId],
  );
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status=$2, updated_at=now() WHERE id=$1`,
    [intent.campaign_id, CampaignStatus.ACTIVATION_PENDING],
  );

  const gate2 = await acquisitionControlGate(pool);
  if (!gate2.ok) return { ok: false, code: gate2.code, providerCalls: 0, intentId };

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='ATTEMPTED', attempted_at=now(), updated_at=now() WHERE id=$1`,
    [intentId],
  );

  const result = await acqProvider.createCampaign({
    idempotencyKey: intent.idempotency_key,
    budgetHash: intent.budget_hash,
    accountRef: intent.provider_account_ref,
    destination: rev.destination,
    totalBudgetMicroEur: rev.total_budget_micro_eur,
  });

  if (result.class === 'CREATE_TIMEOUT_UNKNOWN') {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    await pool.query(
      `INSERT INTO ops.acquisition_provider_campaigns
        (create_intent_id, campaign_id, campaign_revision_id, provider_code, provider_account_ref, state)
       VALUES ($1,$2,$3,$4,$5,'OUTCOME_UNKNOWN')
       ON CONFLICT (create_intent_id) DO UPDATE SET state='OUTCOME_UNKNOWN', updated_at=now()`,
      [intentId, intent.campaign_id, rev.id, intent.provider_code, intent.provider_account_ref],
    );
    await pool.query(
      `UPDATE ops.acquisition_campaigns SET status='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
      [intent.campaign_id],
    );
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.outcome_unknown',$1::jsonb)`,
      [JSON.stringify({ intent_id: intentId, kind: 'CREATE', blind_retry: false })],
    );
    return { ok: true, outcomeUnknown: true, blindRetry: false, providerCalls: result.providerCalls || 1, intentId };
  }

  if (result.class === 'CREATE_TRANSIENT_KNOWN_NOT_EXECUTED') {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    return {
      ok: false,
      code: 'TRANSIENT_KNOWN_NOT_EXECUTED',
      retryEligible: true,
      providerCalls: result.providerCalls || 1,
    };
  }

  if (!result.ok) {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    await pool.query(
      `UPDATE ops.acquisition_campaigns SET status='FAILED', updated_at=now() WHERE id=$1`,
      [intent.campaign_id],
    );
    return { ok: false, code: result.reasonCode || 'PROVIDER_REJECTED', providerCalls: result.providerCalls || 1 };
  }

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
    [intentId],
  );
  const pc = await pool.query(
    `INSERT INTO ops.acquisition_provider_campaigns
      (create_intent_id, campaign_id, campaign_revision_id, provider_code, provider_campaign_id,
       provider_account_ref, state)
     VALUES ($1,$2,$3,$4,$5,$6,'CREATED')
     ON CONFLICT (create_intent_id) DO UPDATE
       SET provider_campaign_id=EXCLUDED.provider_campaign_id, state='CREATED', updated_at=now()
     RETURNING *`,
    [
      intentId, intent.campaign_id, rev.id, intent.provider_code || A13_TEST_PROVIDER_ID,
      result.providerCampaignId, intent.provider_account_ref,
    ],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.provider_created',$1::jsonb)`,
    [JSON.stringify({ intent_id: intentId, provider_campaign_id: result.providerCampaignId, active: false })],
  );
  return {
    ok: true,
    created: true,
    active: false,
    providerCampaign: pc.rows[0],
    providerCampaignId: result.providerCampaignId,
    providerCalls: result.providerCalls || 1,
  };
}

export async function executeActivateCampaignIntent(pool, {
  intentId,
  provider = null,
} = {}) {
  if (!intentId) return { ok: false, code: 'INTENT_ID_REQUIRED', providerCalls: 0 };
  assertNoLiveAcquisition();
  const acqProvider = provider || createDeterministicTestAcquisitionProvider();
  const gate = await acquisitionControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };

  const { rows: intents } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_intents WHERE id=$1`,
    [intentId],
  );
  const intent = intents[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND', providerCalls: 0 };
  if (intent.intent_kind !== CampaignIntentKind.ACTIVATE) {
    return { ok: false, code: 'NOT_ACTIVATE_INTENT', providerCalls: 0 };
  }
  if (intent.state === CampaignIntentState.OUTCOME_UNKNOWN) {
    return {
      ok: false,
      code: 'RECONCILIATION_REQUIRED',
      blindRetry: false,
      providerCalls: 0,
      explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT REACTIVATE BLINDLY.',
    };
  }
  if (intent.state === CampaignIntentState.PROVIDER_ACCEPTED) {
    return { ok: true, alreadyActive: true, providerCalls: 0 };
  }
  if (intent.state === CampaignIntentState.CANCELLED) {
    return { ok: false, code: 'CANCELLED', providerCalls: 0 };
  }

  const { rows: revs } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [intent.campaign_revision_id],
  );
  const rev = revs[0];
  if (!rev || !rev.is_current) {
    return { ok: false, code: 'STALE_CAMPAIGN_REVISION', providerCalls: 0 };
  }
  const appr = await loadBoundApproval(pool, rev.id, rev.budget_hash);
  if (!appr.ok) return { ok: false, code: appr.code, providerCalls: 0 };
  const claims = await freshContentClaimsOk(pool, rev.content_revision_id);
  if (!claims.ok) return { ok: false, code: claims.code, providerCalls: 0 };

  const { rows: pcs } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_campaigns
     WHERE campaign_revision_id=$1 AND provider_campaign_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [rev.id],
  );
  const pc = pcs[0];
  if (!pc?.provider_campaign_id) return { ok: false, code: 'PROVIDER_CAMPAIGN_NOT_CREATED', providerCalls: 0 };

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='ATTEMPTED', attempted_at=now(), updated_at=now() WHERE id=$1`,
    [intentId],
  );

  const result = await acqProvider.activateCampaign({
    idempotencyKey: intent.idempotency_key,
    providerCampaignId: pc.provider_campaign_id,
  });

  if (result.class === 'ACTIVATE_TIMEOUT_UNKNOWN') {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    await pool.query(
      `UPDATE ops.acquisition_provider_campaigns SET state='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
      [pc.id],
    );
    await pool.query(
      `UPDATE ops.acquisition_campaigns SET status='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
      [intent.campaign_id],
    );
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.outcome_unknown',$1::jsonb)`,
      [JSON.stringify({ intent_id: intentId, kind: 'ACTIVATE', blind_retry: false })],
    );
    return { ok: true, outcomeUnknown: true, blindRetry: false, providerCalls: result.providerCalls || 1 };
  }

  if (!result.ok) {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    return { ok: false, code: result.reasonCode || 'ACTIVATE_FAILED', providerCalls: result.providerCalls || 1 };
  }

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
    [intentId],
  );
  await pool.query(
    `UPDATE ops.acquisition_provider_campaigns
     SET state='ACTIVE', activate_intent_id=$2, updated_at=now() WHERE id=$1`,
    [pc.id, intentId],
  );
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status='ACTIVE', updated_at=now() WHERE id=$1`,
    [intent.campaign_id],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.activated',$1::jsonb)`,
    [JSON.stringify({ intent_id: intentId, provider_campaign_id: pc.provider_campaign_id })],
  );
  return {
    ok: true,
    activated: true,
    providerCampaignId: pc.provider_campaign_id,
    providerCalls: result.providerCalls || 1,
  };
}

export async function activateAcquisitionCampaign(pool, {
  campaignId,
  provider = null,
} = {}) {
  const createSched = await scheduleProviderIntent(pool, {
    campaignId,
    intentKind: CampaignIntentKind.CREATE,
  });
  if (!createSched.ok) return createSched;
  const created = await executeCreateCampaignIntent(pool, {
    intentId: createSched.intentId,
    provider,
  });
  if (!created.ok || created.outcomeUnknown) return { ...created, createIntentId: createSched.intentId };
  const actSched = await scheduleProviderIntent(pool, {
    campaignId,
    intentKind: CampaignIntentKind.ACTIVATE,
  });
  if (!actSched.ok) return { ...actSched, createIntentId: createSched.intentId, created };
  if (actSched.duplicate && actSched.intent?.state === CampaignIntentState.PROVIDER_ACCEPTED) {
    return { ok: true, alreadyActive: true, createIntentId: createSched.intentId, activateIntentId: actSched.intentId };
  }
  const activated = await executeActivateCampaignIntent(pool, {
    intentId: actSched.intentId,
    provider,
  });
  return {
    ...activated,
    createIntentId: createSched.intentId,
    activateIntentId: actSched.intentId,
    created,
  };
}

export async function pauseAcquisitionCampaign(pool, {
  campaignId,
  provider = null,
  reason = 'OPERATOR_PAUSE',
} = {}) {
  if (!campaignId) return { ok: false, code: 'CAMPAIGN_ID_REQUIRED' };
  const gate = await acquisitionControlGate(pool);
  if (!gate.ok && gate.code === 'CONTROL_UNAVAILABLE') return { ok: false, code: gate.code };
  const acqProvider = provider || createDeterministicTestAcquisitionProvider();
  const { rows: pcs } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_campaigns
     WHERE campaign_id=$1 AND provider_campaign_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [campaignId],
  );
  const pc = pcs[0];
  if (!pc) return { ok: false, code: 'PROVIDER_CAMPAIGN_NOT_FOUND' };

  const sched = await scheduleProviderIntent(pool, {
    campaignId,
    intentKind: CampaignIntentKind.PAUSE,
    idempotencyKey: `PAUSE:${pc.id}:${randomUUID()}`,
  });
  if (!sched.ok) return sched;

  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='ATTEMPTED', attempted_at=now(), updated_at=now() WHERE id=$1`,
    [sched.intentId],
  );
  const result = await acqProvider.pauseCampaign({ providerCampaignId: pc.provider_campaign_id });
  if (!result.ok) {
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [sched.intentId],
    );
    return { ok: false, code: 'PAUSE_FAILED', providerCalls: result.providerCalls || 1 };
  }
  await pool.query(
    `UPDATE ops.acquisition_provider_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
    [sched.intentId],
  );
  await pool.query(
    `UPDATE ops.acquisition_provider_campaigns SET state='PAUSED', updated_at=now() WHERE id=$1`,
    [pc.id],
  );
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status='PAUSED', updated_at=now() WHERE id=$1`,
    [campaignId],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.paused',$1::jsonb)`,
    [JSON.stringify({ campaign_id: campaignId, reason })],
  );
  return { ok: true, paused: true, intentId: sched.intentId, providerCalls: result.providerCalls || 1 };
}

export async function reconcileAcquisitionCampaign(pool, {
  intentId = null,
  campaignId = null,
  provider = null,
} = {}) {
  const acqProvider = provider || createDeterministicTestAcquisitionProvider();
  let intent;
  if (intentId) {
    const { rows } = await pool.query(`SELECT * FROM ops.acquisition_provider_intents WHERE id=$1`, [intentId]);
    intent = rows[0];
  } else if (campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM ops.acquisition_provider_intents
       WHERE campaign_id=$1 AND state='OUTCOME_UNKNOWN'
       ORDER BY created_at DESC LIMIT 1`,
      [campaignId],
    );
    intent = rows[0];
  }
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND', blindRetry: false };

  const { rows: pcs } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_campaigns
     WHERE create_intent_id=$1 OR campaign_id=$2
     ORDER BY created_at DESC LIMIT 1`,
    [intent.intent_kind === 'CREATE' ? intent.id : null, intent.campaign_id],
  );
  const pc = pcs[0];
  const readback = await acqProvider.getCampaign({
    idempotencyKey: intent.idempotency_key,
    providerCampaignId: pc?.provider_campaign_id || null,
    expectedAccountRef: intent.provider_account_ref,
  });

  if (readback.class === 'READBACK_FOUND') {
    const postId = readback.campaign.providerCampaignId;
    const spend = BigInt(readback.campaign.spendMicroEur || 0);
    const { rows: revRows } = await pool.query(
      `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
      [intent.campaign_revision_id],
    );
    const rev = revRows[0];
    let state = readback.campaign.status === 'ACTIVE'
      ? AcquisitionProviderCampaignState.ACTIVE
      : AcquisitionProviderCampaignState.CREATED;
    let campStatus = state === 'ACTIVE' ? CampaignStatus.ACTIVE : CampaignStatus.ACTIVATION_PENDING;
    if (rev && spend > BigInt(rev.total_budget_micro_eur)) {
      state = AcquisitionProviderCampaignState.MISMATCH;
      campStatus = CampaignStatus.BUDGET_MISMATCH_REVIEW_REQUIRED;
    }
    await pool.query(
      `INSERT INTO ops.acquisition_provider_campaigns
        (create_intent_id, campaign_id, campaign_revision_id, provider_code, provider_campaign_id,
         provider_account_ref, state, spend_micro_eur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (create_intent_id) DO UPDATE
         SET provider_campaign_id=EXCLUDED.provider_campaign_id, state=EXCLUDED.state,
             spend_micro_eur=EXCLUDED.spend_micro_eur, updated_at=now()`,
      [
        intent.intent_kind === 'CREATE' ? intent.id : (pc?.create_intent_id || intent.id),
        intent.campaign_id, intent.campaign_revision_id, intent.provider_code, postId,
        intent.provider_account_ref, state, String(spend),
      ],
    ).catch(async () => {
      if (pc) {
        await pool.query(
          `UPDATE ops.acquisition_provider_campaigns
           SET provider_campaign_id=$2, state=$3, spend_micro_eur=$4, updated_at=now() WHERE id=$1`,
          [pc.id, postId, state, String(spend)],
        );
      }
    });
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
      [intent.id],
    );
    await pool.query(
      `UPDATE ops.acquisition_campaigns SET status=$2, updated_at=now() WHERE id=$1`,
      [intent.campaign_id, campStatus],
    );
    return {
      ok: true,
      adopted: true,
      providerCampaignId: postId,
      blindRetry: false,
      budgetMismatch: campStatus === CampaignStatus.BUDGET_MISMATCH_REVIEW_REQUIRED,
      providerCalls: readback.providerCalls || 1,
    };
  }

  if (readback.class === 'READBACK_NOT_FOUND') {
    if (pc) {
      await pool.query(
        `UPDATE ops.acquisition_provider_campaigns SET state='ABSENT', updated_at=now() WHERE id=$1`,
        [pc.id],
      );
    }
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [intent.id],
    );
    await pool.query(
      `UPDATE ops.acquisition_campaigns SET status='FAILED', updated_at=now() WHERE id=$1`,
      [intent.campaign_id],
    );
    return {
      ok: true,
      absent: true,
      safeRetryEligible: true,
      blindRetry: false,
      providerCalls: readback.providerCalls || 1,
    };
  }

  if (readback.class === 'READBACK_MISMATCH') {
    if (pc) {
      await pool.query(
        `UPDATE ops.acquisition_provider_campaigns SET state='MISMATCH', updated_at=now() WHERE id=$1`,
        [pc.id],
      );
    }
    return {
      ok: false,
      code: 'PROVIDER_ACCOUNT_MISMATCH_REVIEW_REQUIRED',
      blindRetry: false,
      providerCalls: readback.providerCalls || 1,
    };
  }

  return {
    ok: true,
    code: 'RECONCILIATION_REQUIRED',
    blindRetry: false,
    providerCalls: readback.providerCalls || 0,
  };
}

export async function cancelAcquisitionCampaign(pool, {
  campaignId,
  reason = 'OPERATOR_CANCEL',
} = {}) {
  if (!campaignId) return { ok: false, code: 'CAMPAIGN_ID_REQUIRED' };
  const { rows } = await pool.query(
    `SELECT * FROM ops.acquisition_provider_intents
     WHERE campaign_id=$1 AND state IN ('SCHEDULED','CREATED','FAILED')
     ORDER BY created_at DESC`,
    [campaignId],
  );
  for (const intent of rows) {
    if ([CampaignIntentState.PROVIDER_ACCEPTED, CampaignIntentState.OUTCOME_UNKNOWN].includes(intent.state)) {
      continue;
    }
    await pool.query(
      `UPDATE ops.acquisition_provider_intents SET state='CANCELLED', updated_at=now() WHERE id=$1`,
      [intent.id],
    );
  }
  await pool.query(
    `UPDATE ops.acquisition_campaigns SET status='CANCELLED', updated_at=now() WHERE id=$1`,
    [campaignId],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.cancelled',$1::jsonb)`,
    [JSON.stringify({ campaign_id: campaignId, reason })],
  );
  return { ok: true, cancelled: true };
}

