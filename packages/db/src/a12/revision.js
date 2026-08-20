/**
 * Generate candidate → validate claims/brand/risk → persist immutable revision.
 */
import { createHash } from 'node:crypto';
import {
  ContentStatus,
  ContentRiskClass,
  ContentApprovalDecision,
  BrandPolicyV1,
  ContentRiskPolicyV1,
  ContentApprovalPolicyV1,
  A12_TEST_GENERATOR_ID,
  ContentGeneratorMode,
} from '@deintarifheld/shared';
import { createDeterministicTestContentGenerator } from './generator.js';
import { extractClaimsFromText, validateClaimSet, extractAndValidateLinks } from './claims.js';
import { validateBrand } from './brand.js';
import { classifyContentRisk } from './risk.js';
import { renderForChannel } from './channel.js';
import { getContentBrief } from './brief.js';
import { mergeContentApprovalPolicy } from './policy.js';

function hashCanonical(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

export async function produceContentCandidate(pool, {
  briefId,
  mode = ContentGeneratorMode.SAFE_EDUCATION,
  generator = null,
  approvalPolicy = null,
} = {}) {
  if (!briefId) return { ok: false, code: 'BRIEF_ID_REQUIRED' };
  const brief = await getContentBrief(pool, briefId);
  if (!brief) return { ok: false, code: 'BRIEF_NOT_FOUND' };

  const gen = generator || createDeterministicTestContentGenerator();
  const candidate = gen.generateContentCandidate(brief, { mode });
  if (!candidate?.ok) return { ok: false, code: 'GENERATION_FAILED' };

  const brand = validateBrand({
    headline: candidate.headline,
    bodyText: candidate.bodyText,
    cta: candidate.cta,
    hashtags: candidate.hashtags,
  });
  const linkCheck = extractAndValidateLinks(
    `${candidate.bodyText} ${(candidate.links || []).join(' ')}`,
    BrandPolicyV1.allowedDomains,
  );
  const claims = extractClaimsFromText(candidate.bodyText, { modeHints: candidate.modeHints || [] });
  if (!linkCheck.ok) {
    claims.push({
      claimType: 'LINK',
      claimText: linkCheck.unapproved[0],
      claimState: 'PROHIBITED',
      patternId: 'UNAPPROVED_LINK',
      riskClass: 'BLOCKED',
    });
  }
  const claimVal = validateClaimSet(claims);
  const risk = classifyContentRisk({
    claims,
    brandOk: brand.ok && linkCheck.ok,
    highRiskSupported: mode === ContentGeneratorMode.HIGH_RISK_SUPPORTED,
  });

  const rendered = renderForChannel({
    headline: candidate.headline,
    bodyText: candidate.bodyText,
    cta: candidate.cta,
    hashtags: candidate.hashtags,
    links: candidate.links,
  }, brief.channel);

  const contentHash = hashCanonical({
    headline: rendered.channelPayload.headline,
    body: rendered.channelPayload.bodyText,
    cta: rendered.channelPayload.cta,
    hashtags: rendered.channelPayload.hashtags,
    links: rendered.channelPayload.links,
    channel: brief.channel,
  });
  const fingerprint = hashCanonical({
    briefId,
    mode,
    generatorId: A12_TEST_GENERATOR_ID,
    brandPolicyVersion: BrandPolicyV1.version,
    riskPolicyVersion: ContentRiskPolicyV1.version,
    contentHash,
    claims: claims.map((c) => ({ t: c.claimType, s: c.claimState, p: c.patternId })),
  });

  const ap = mergeContentApprovalPolicy(approvalPolicy || {});
  let status = ContentStatus.APPROVAL_REQUIRED;
  if (risk.riskClass === ContentRiskClass.BLOCKED || !claimVal.ok || !brand.ok || !linkCheck.ok) {
    status = ContentStatus.BLOCKED;
  } else if ((ap.autoApproveRiskClasses || []).includes(risk.riskClass)) {
    status = ContentStatus.APPROVED;
  } else {
    status = ContentStatus.APPROVAL_REQUIRED;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemIns = await client.query(
      `INSERT INTO ops.content_items (brief_id, channel, status, risk_class)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [briefId, brief.channel, status, risk.riskClass],
    );
    const item = itemIns.rows[0];
    const { rows: prev } = await client.query(
      `SELECT coalesce(max(revision_no),0)::int AS n FROM ops.content_revisions WHERE content_item_id=$1`,
      [item.id],
    );
    const revNo = (prev[0]?.n || 0) + 1;
    await client.query(
      `UPDATE ops.content_revisions SET is_current=false WHERE content_item_id=$1 AND is_current`,
      [item.id],
    );
    let rev;
    try {
      const revIns = await client.query(
        `INSERT INTO ops.content_revisions
          (content_item_id, revision_no, is_current, fingerprint, content_hash,
           headline, body_text, cta, hashtags, links, channel_payload,
           generator_id, generator_mode, brand_policy_version, risk_policy_version,
           approval_policy_version, risk_class)
         VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          item.id, revNo, fingerprint, contentHash,
          rendered.channelPayload.headline, rendered.channelPayload.bodyText,
          rendered.channelPayload.cta,
          JSON.stringify(rendered.channelPayload.hashtags),
          JSON.stringify(rendered.channelPayload.links),
          JSON.stringify(rendered.channelPayload),
          A12_TEST_GENERATOR_ID, mode,
          BrandPolicyV1.version, ContentRiskPolicyV1.version, ap.version,
          risk.riskClass,
        ],
      );
      rev = revIns.rows[0];
    } catch (err) {
      if (err?.code === '23505') {
        await client.query('ROLLBACK');
        const { rows: existing } = await pool.query(
          `SELECT * FROM ops.content_revisions WHERE fingerprint=$1`,
          [fingerprint],
        );
        return { ok: true, duplicateFingerprint: true, revision: existing[0], contentHash, fingerprint };
      }
      throw err;
    }

    for (const c of claims) {
      await client.query(
        `INSERT INTO ops.content_claims
          (content_revision_id, claim_type, claim_text, claim_state, pattern_id, source_ref, risk_class)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rev.id, c.claimType, c.claimText, c.claimState, c.patternId || null, c.sourceRef || null, c.riskClass || null],
      );
    }

    const decision = status === ContentStatus.APPROVED
      ? ContentApprovalDecision.APPROVED
      : status === ContentStatus.BLOCKED
        ? ContentApprovalDecision.REJECTED
        : ContentApprovalDecision.PENDING;
    await client.query(
      `INSERT INTO ops.content_approvals
        (content_revision_id, content_hash, policy_id, policy_version, decision, actor_type, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        rev.id, contentHash, ap.id, ap.version, decision,
        status === ContentStatus.APPROVED ? 'SYSTEM_TEST' : null,
        status === ContentStatus.APPROVED || status === ContentStatus.BLOCKED ? new Date() : null,
      ],
    );

    await client.query(
      `UPDATE ops.content_items SET current_revision_id=$2, updated_at=now() WHERE id=$1`,
      [item.id, rev.id],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ($1,$2::jsonb)`,
      [
        status === ContentStatus.BLOCKED ? 'content.claim_blocked' : 'content.generated',
        JSON.stringify({
          content_item_id: item.id,
          revision_id: rev.id,
          status,
          risk_class: risk.riskClass,
          mode,
          candidate_only: true,
        }),
      ],
    );
    if (status === ContentStatus.APPROVAL_REQUIRED) {
      await client.query(
        `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.approval_requested',$1::jsonb)`,
        [JSON.stringify({ content_revision_id: rev.id })],
      );
    }
    await client.query('COMMIT');
    return {
      ok: true,
      contentItemId: item.id,
      revisionId: rev.id,
      status,
      riskClass: risk.riskClass,
      contentHash,
      fingerprint,
      claims,
      brand,
      linkCheck,
      candidateOnly: true,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function createSupersedingRevision(pool, {
  contentItemId,
  mode = ContentGeneratorMode.SAFE_EDUCATION,
  bodyOverride = null,
} = {}) {
  const { rows: items } = await pool.query(`SELECT * FROM ops.content_items WHERE id=$1`, [contentItemId]);
  const item = items[0];
  if (!item) return { ok: false, code: 'ITEM_NOT_FOUND' };
  const brief = await getContentBrief(pool, item.brief_id);
  const gen = createDeterministicTestContentGenerator();
  const candidate = gen.generateContentCandidate(brief, { mode });
  if (bodyOverride) candidate.bodyText = bodyOverride;

  const brand = validateBrand(candidate);
  const claims = extractClaimsFromText(candidate.bodyText, { modeHints: candidate.modeHints || [] });
  const risk = classifyContentRisk({ claims, brandOk: brand.ok });
  const rendered = renderForChannel(candidate, brief.channel);
  const contentHash = hashCanonical({
    headline: rendered.channelPayload.headline,
    body: rendered.channelPayload.bodyText,
    cta: rendered.channelPayload.cta,
    n: Date.now(),
  });
  const fingerprint = hashCanonical({ contentItemId, contentHash, mode, n: Date.now() });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.content_revisions SET is_current=false WHERE content_item_id=$1 AND is_current`,
      [contentItemId],
    );
    const { rows: prev } = await client.query(
      `SELECT coalesce(max(revision_no),0)::int AS n FROM ops.content_revisions WHERE content_item_id=$1`,
      [contentItemId],
    );
    const revIns = await client.query(
      `INSERT INTO ops.content_revisions
        (content_item_id, revision_no, is_current, fingerprint, content_hash,
         headline, body_text, cta, hashtags, links, channel_payload,
         generator_id, generator_mode, brand_policy_version, risk_policy_version,
         approval_policy_version, risk_class)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        contentItemId, (prev[0]?.n || 0) + 1, fingerprint, contentHash,
        rendered.channelPayload.headline, rendered.channelPayload.bodyText,
        rendered.channelPayload.cta,
        JSON.stringify(rendered.channelPayload.hashtags),
        JSON.stringify(rendered.channelPayload.links),
        JSON.stringify(rendered.channelPayload),
        A12_TEST_GENERATOR_ID, mode,
        BrandPolicyV1.version, ContentRiskPolicyV1.version, ContentApprovalPolicyV1.version,
        risk.riskClass,
      ],
    );
    const rev = revIns.rows[0];
    await client.query(
      `INSERT INTO ops.content_approvals
        (content_revision_id, content_hash, policy_id, policy_version, decision)
       VALUES ($1,$2,$3,$4,'PENDING')`,
      [rev.id, contentHash, ContentApprovalPolicyV1.id, ContentApprovalPolicyV1.version],
    );
    await client.query(
      `UPDATE ops.content_items
       SET current_revision_id=$2, status='APPROVAL_REQUIRED', risk_class=$3, updated_at=now()
       WHERE id=$1`,
      [contentItemId, rev.id, risk.riskClass],
    );
    await client.query('COMMIT');
    return { ok: true, revisionId: rev.id, contentHash, supersededPrevious: true };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function getContentRevision(pool, revisionId) {
  const { rows } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [revisionId]);
  return rows[0] || null;
}

export async function listContentClaims(pool, revisionId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.content_claims WHERE content_revision_id=$1 ORDER BY created_at`,
    [revisionId],
  );
  return rows;
}
