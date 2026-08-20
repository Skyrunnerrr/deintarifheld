/**
 * Create/revise acquisition campaigns. Bind A12 content revision + destination + CTA.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  CampaignObjective,
  CampaignStatus,
  AcquisitionSourceKind,
  AcquisitionAttributionPolicyV1,
  AcquisitionBudgetPolicyV1,
  AcquisitionApprovalPolicyV1,
  AcquisitionApprovalDecision,
  A13_TEST_PROVIDER_ID,
  ClaimState,
} from '@deintarifheld/shared';
import { isAllowedAcquisitionDestination, resolveServerProviderAccount } from './policy.js';
import { parseBudgetMicroEur, budgetHashParts, assertAcquisitionMoneyExact } from './money.js';

function fingerprint(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

async function assertContentBindable(pool, contentRevisionId) {
  if (!contentRevisionId) return { ok: true, contentHash: null };
  const { rows } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [contentRevisionId]);
  const rev = rows[0];
  if (!rev) return { ok: false, code: 'CONTENT_REVISION_NOT_FOUND' };
  if (!rev.is_current) return { ok: false, code: 'STALE_CONTENT_REVISION' };
  const { rows: claims } = await pool.query(
    `SELECT claim_state, claim_type FROM ops.content_claims WHERE content_revision_id=$1`,
    [contentRevisionId],
  );
  if (claims.some((c) => [ClaimState.PROHIBITED, ClaimState.UNSUPPORTED].includes(c.claim_state))) {
    return { ok: false, code: 'UNSUPPORTED_CONTENT_CLAIMS' };
  }
  if (claims.some((c) => c.claim_type === 'TARIFF_AS_LIVE' || c.claim_type === 'SAVINGS')) {
    // still blocked above if PROHIBITED; explicit synthetic tariff safety
  }
  return { ok: true, contentHash: rev.content_hash, contentRevision: rev };
}

export async function createAcquisitionCampaign(pool, {
  name,
  objective = CampaignObjective.B2B_LEAD_GENERATION,
  sourceKind = AcquisitionSourceKind.ORGANIC_CONTENT,
  destination = 'https://www.deintarifheld.de/unternehmen',
  cta = 'Mehr zum Ablauf',
  channel = 'SYNTHETIC',
  contentRevisionId = null,
  contentPublicationId = null,
  totalBudgetEur = '0',
  dailyBudgetEur = '0',
  clientProviderCode = null,
  clientAccountRef = null,
  clientBudgetEur = null,
  scheduleStart = null,
  scheduleEnd = null,
} = {}) {
  if (!name) return { ok: false, code: 'NAME_REQUIRED' };
  if (!Object.values(CampaignObjective).includes(objective)) {
    return { ok: false, code: 'INVALID_OBJECTIVE' };
  }
  if (!Object.values(AcquisitionSourceKind).includes(sourceKind)) {
    return { ok: false, code: 'INVALID_SOURCE_KIND' };
  }

  // Client cannot set provider/account/budget authority — hints ignored, never adopted.
  void clientProviderCode;
  void clientAccountRef;
  void clientBudgetEur;

  const dest = isAllowedAcquisitionDestination(destination);
  if (!dest.ok) return dest;

  assertAcquisitionMoneyExact(totalBudgetEur, 'totalBudget');
  assertAcquisitionMoneyExact(dailyBudgetEur, 'dailyBudget');
  const totalMicro = parseBudgetMicroEur(totalBudgetEur);
  const dailyMicro = parseBudgetMicroEur(dailyBudgetEur);
  if (dailyMicro > totalMicro && totalMicro > 0n) {
    return { ok: false, code: 'DAILY_BUDGET_EXCEEDS_TOTAL' };
  }

  const content = await assertContentBindable(pool, contentRevisionId);
  if (!content.ok) return content;

  const provider = resolveServerProviderAccount();
  const budgetHash = fingerprint(budgetHashParts({
    totalBudgetMicroEur: totalMicro,
    dailyBudgetMicroEur: dailyMicro,
    providerCode: provider.providerCode,
    providerAccountRef: provider.providerAccountRef,
  }));

  const fp = fingerprint({
    name, objective, sourceKind, destination: dest.normalized, cta, channel,
    contentRevisionId, contentHash: content.contentHash, budgetHash,
    totalMicro: String(totalMicro), dailyMicro: String(dailyMicro),
    nonce: randomUUID(),
  });

  const zeroSpend = totalMicro === 0n;
  const status = zeroSpend && AcquisitionBudgetPolicyV1.zeroSpendAutoApprove
    ? CampaignStatus.APPROVED
    : (totalMicro > 0n ? CampaignStatus.APPROVAL_REQUIRED : CampaignStatus.DRAFT);
  const approvalDecision = status === CampaignStatus.APPROVED
    ? AcquisitionApprovalDecision.APPROVED
    : AcquisitionApprovalDecision.PENDING;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const camp = await client.query(
      `INSERT INTO ops.acquisition_campaigns (name, objective, source_kind, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, objective, sourceKind, status],
    );
    const campaign = camp.rows[0];
    const rev = await client.query(
      `INSERT INTO ops.acquisition_campaign_revisions
        (campaign_id, revision_no, is_current, fingerprint, budget_hash, destination, cta, channel,
         source_kind, content_revision_id, content_publication_id, content_hash,
         total_budget_micro_eur, daily_budget_micro_eur, provider_code, provider_account_ref,
         attribution_policy_id, attribution_policy_version, budget_policy_id, budget_policy_version,
         schedule_start, schedule_end)
       VALUES ($1,1,true,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        campaign.id, fp, budgetHash, dest.normalized, cta, channel, sourceKind,
        contentRevisionId, contentPublicationId, content.contentHash,
        String(totalMicro), String(dailyMicro), provider.providerCode, provider.providerAccountRef,
        AcquisitionAttributionPolicyV1.id, AcquisitionAttributionPolicyV1.version,
        AcquisitionBudgetPolicyV1.id, AcquisitionBudgetPolicyV1.version,
        scheduleStart, scheduleEnd,
      ],
    );
    const revision = rev.rows[0];
    await client.query(
      `UPDATE ops.acquisition_campaigns SET current_revision_id=$2, updated_at=now() WHERE id=$1`,
      [campaign.id, revision.id],
    );
    await client.query(
      `INSERT INTO ops.campaign_approvals
        (campaign_revision_id, budget_hash, destination, content_hash, policy_id, policy_version, decision, actor_type, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        revision.id, budgetHash, dest.normalized, content.contentHash,
        AcquisitionApprovalPolicyV1.id, AcquisitionApprovalPolicyV1.version,
        approvalDecision,
        approvalDecision === AcquisitionApprovalDecision.APPROVED ? 'SYSTEM_ZERO_SPEND_TEST' : null,
        approvalDecision === AcquisitionApprovalDecision.APPROVED ? new Date().toISOString() : null,
      ],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.campaign_created',$1::jsonb)`,
      [JSON.stringify({
        campaign_id: campaign.id,
        revision_id: revision.id,
        status,
        total_budget_micro_eur: String(totalMicro),
        zero_spend: zeroSpend,
        provider_code: A13_TEST_PROVIDER_ID,
      })],
    );
    await client.query('COMMIT');
    return {
      ok: true,
      campaignId: campaign.id,
      revisionId: revision.id,
      status,
      budgetHash,
      destination: dest.normalized,
      contentHash: content.contentHash,
      totalBudgetMicroEur: String(totalMicro),
      approvalDecision,
      zeroSpend,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function reviseAcquisitionCampaign(pool, {
  campaignId,
  destination = null,
  cta = null,
  contentRevisionId = undefined,
  contentPublicationId = undefined,
  totalBudgetEur = null,
  dailyBudgetEur = null,
  channel = null,
} = {}) {
  if (!campaignId) return { ok: false, code: 'CAMPAIGN_ID_REQUIRED' };
  const { rows } = await pool.query(`SELECT * FROM ops.acquisition_campaigns WHERE id=$1`, [campaignId]);
  const campaign = rows[0];
  if (!campaign) return { ok: false, code: 'CAMPAIGN_NOT_FOUND' };
  const { rows: curRows } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [campaign.current_revision_id],
  );
  const cur = curRows[0];
  if (!cur) return { ok: false, code: 'REVISION_NOT_FOUND' };

  const nextDest = destination != null ? isAllowedAcquisitionDestination(destination) : { ok: true, normalized: cur.destination };
  if (!nextDest.ok) return nextDest;

  const nextContentId = contentRevisionId === undefined ? cur.content_revision_id : contentRevisionId;
  const content = await assertContentBindable(pool, nextContentId);
  if (!content.ok) return content;

  const totalMicro = totalBudgetEur != null
    ? parseBudgetMicroEur(totalBudgetEur)
    : BigInt(cur.total_budget_micro_eur);
  const dailyMicro = dailyBudgetEur != null
    ? parseBudgetMicroEur(dailyBudgetEur)
    : BigInt(cur.daily_budget_micro_eur);

  const provider = resolveServerProviderAccount();
  const budgetHash = fingerprint(budgetHashParts({
    totalBudgetMicroEur: totalMicro,
    dailyBudgetMicroEur: dailyMicro,
    providerCode: provider.providerCode,
    providerAccountRef: provider.providerAccountRef,
  }));
  const nextCta = cta != null ? cta : cur.cta;
  const nextChannel = channel != null ? channel : cur.channel;
  const nextPub = contentPublicationId === undefined ? cur.content_publication_id : contentPublicationId;
  const fp = fingerprint({
    campaignId, prev: cur.id, destination: nextDest.normalized, cta: nextCta,
    contentRevisionId: nextContentId, contentHash: content.contentHash, budgetHash, nonce: randomUUID(),
  });

  const zeroSpend = totalMicro === 0n;
  const status = zeroSpend && AcquisitionBudgetPolicyV1.zeroSpendAutoApprove
    ? CampaignStatus.APPROVED
    : CampaignStatus.APPROVAL_REQUIRED;
  const approvalDecision = status === CampaignStatus.APPROVED
    ? AcquisitionApprovalDecision.APPROVED
    : AcquisitionApprovalDecision.PENDING;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.acquisition_campaign_revisions SET is_current=false WHERE campaign_id=$1 AND is_current`,
      [campaignId],
    );
    const rev = await client.query(
      `INSERT INTO ops.acquisition_campaign_revisions
        (campaign_id, revision_no, is_current, fingerprint, budget_hash, destination, cta, channel,
         source_kind, content_revision_id, content_publication_id, content_hash,
         total_budget_micro_eur, daily_budget_micro_eur, provider_code, provider_account_ref,
         attribution_policy_id, attribution_policy_version, budget_policy_id, budget_policy_version,
         schedule_start, schedule_end)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        campaignId, cur.revision_no + 1, fp, budgetHash, nextDest.normalized, nextCta, nextChannel,
        cur.source_kind, nextContentId, nextPub, content.contentHash,
        String(totalMicro), String(dailyMicro), provider.providerCode, provider.providerAccountRef,
        AcquisitionAttributionPolicyV1.id, AcquisitionAttributionPolicyV1.version,
        AcquisitionBudgetPolicyV1.id, AcquisitionBudgetPolicyV1.version,
        cur.schedule_start, cur.schedule_end,
      ],
    );
    const revision = rev.rows[0];
    await client.query(
      `UPDATE ops.acquisition_campaigns
       SET current_revision_id=$2, status=$3, updated_at=now() WHERE id=$1`,
      [campaignId, revision.id, status],
    );
    await client.query(
      `INSERT INTO ops.campaign_approvals
        (campaign_revision_id, budget_hash, destination, content_hash, policy_id, policy_version, decision, actor_type, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        revision.id, budgetHash, nextDest.normalized, content.contentHash,
        AcquisitionApprovalPolicyV1.id, AcquisitionApprovalPolicyV1.version,
        approvalDecision,
        approvalDecision === AcquisitionApprovalDecision.APPROVED ? 'SYSTEM_ZERO_SPEND_TEST' : null,
        approvalDecision === AcquisitionApprovalDecision.APPROVED ? new Date().toISOString() : null,
      ],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('acquisition.campaign_revised',$1::jsonb)`,
      [JSON.stringify({ campaign_id: campaignId, revision_id: revision.id, prev_revision_id: cur.id })],
    );
    await client.query('COMMIT');
    return {
      ok: true,
      campaignId,
      revisionId: revision.id,
      prevRevisionId: cur.id,
      status,
      budgetHash,
      approvalDecision,
      stalePrevApproval: true,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function getAcquisitionCampaign(pool, campaignId) {
  const { rows } = await pool.query(`SELECT * FROM ops.acquisition_campaigns WHERE id=$1`, [campaignId]);
  if (!rows[0]) return null;
  const { rows: rev } = await pool.query(
    `SELECT * FROM ops.acquisition_campaign_revisions WHERE id=$1`,
    [rows[0].current_revision_id],
  );
  return { campaign: rows[0], revision: rev[0] || null };
}

export { assertContentBindable };
