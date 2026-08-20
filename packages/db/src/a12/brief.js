/**
 * Content brief create — structured, not a freeform prompt authority.
 */
import {
  ContentStrategyPolicyV1,
  ContentPurpose,
  ContentAudience,
  ContentChannel,
} from '@deintarifheld/shared';

export async function createContentBrief(pool, input = {}) {
  const purpose = input.purpose || ContentPurpose.EDUCATION;
  const audience = input.audience || ContentAudience.SME_OWNER;
  const channel = input.channel || ContentChannel.SYNTHETIC_LINKEDIN;
  if (!Object.values(ContentPurpose).includes(purpose)) {
    return { ok: false, code: 'INVALID_PURPOSE' };
  }
  if (!Object.values(ContentAudience).includes(audience)) {
    return { ok: false, code: 'INVALID_AUDIENCE' };
  }
  if (!Object.values(ContentChannel).includes(channel)) {
    return { ok: false, code: 'INVALID_CHANNEL' };
  }
  if (!ContentStrategyPolicyV1.allowedChannels.includes(channel)) {
    return { ok: false, code: 'CHANNEL_NOT_ALLOWED' };
  }
  const topic = String(input.topic || '').trim();
  const primaryMessage = String(input.primaryMessage || '').trim();
  if (!topic || !primaryMessage) return { ok: false, code: 'BRIEF_FIELDS_REQUIRED' };

  const { rows } = await pool.query(
    `INSERT INTO ops.content_briefs
      (purpose, audience, topic, angle, primary_message, supporting_facts, allowed_claims,
       cta, channel, format, source_refs, risk_hint, strategy_policy_id, strategy_policy_version)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb,$12,$13,$14)
     RETURNING *`,
    [
      purpose,
      audience,
      topic,
      String(input.angle || ''),
      primaryMessage,
      JSON.stringify(input.supportingFacts || []),
      JSON.stringify(input.allowedClaims || []),
      String(input.cta || 'Mehr zum Ablauf'),
      channel,
      String(input.format || 'SHORT_POST'),
      JSON.stringify(input.sourceRefs || ['DTH_APPROVED_EDUCATION_V1']),
      input.riskHint || null,
      ContentStrategyPolicyV1.id,
      ContentStrategyPolicyV1.version,
    ],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.brief_created',$1::jsonb)`,
    [JSON.stringify({ brief_id: rows[0].id, purpose, channel })],
  );
  return { ok: true, brief: rows[0], briefId: rows[0].id };
}

export async function getContentBrief(pool, briefId) {
  const { rows } = await pool.query(`SELECT * FROM ops.content_briefs WHERE id=$1`, [briefId]);
  return rows[0] || null;
}
