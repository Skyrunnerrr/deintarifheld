/**
 * Content publish: TX1 intent → fresh checks → provider → TX2.
 * OUTCOME_UNKNOWN: no blind retry.
 */
import {
  ContentStatus,
  ContentIntentState,
  ContentApprovalDecision,
  ClaimState,
  A12_TEST_PUBLISHER_ID,
} from '@deintarifheld/shared';
import { contentControlGate } from './policy.js';
import { createDeterministicTestPublishingProvider } from './provider.js';

async function loadApprovalBound(pool, revisionId, contentHash) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.content_approvals WHERE content_revision_id=$1`,
    [revisionId],
  );
  const a = rows[0];
  if (!a || a.decision !== ContentApprovalDecision.APPROVED) return { ok: false, code: 'APPROVAL_MISSING' };
  if (a.content_hash !== contentHash) return { ok: false, code: 'STALE_CONTENT_APPROVAL' };
  return { ok: true, approval: a };
}

async function claimsPublishable(pool, revisionId) {
  const { rows } = await pool.query(
    `SELECT claim_state FROM ops.content_claims WHERE content_revision_id=$1`,
    [revisionId],
  );
  if (rows.some((r) => [ClaimState.PROHIBITED, ClaimState.UNSUPPORTED].includes(r.claim_state))) {
    return { ok: false, code: 'UNSUPPORTED_CLAIMS' };
  }
  return { ok: true };
}

export async function publishContentIntent(pool, {
  intentId,
  publisher = null,
} = {}) {
  if (!intentId) return { ok: false, code: 'INTENT_ID_REQUIRED', providerCalls: 0 };
  const provider = publisher || createDeterministicTestPublishingProvider();
  const gate = await contentControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };

  const { rows: intents } = await pool.query(
    `SELECT * FROM ops.content_publication_intents WHERE id=$1`,
    [intentId],
  );
  const intent = intents[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND', providerCalls: 0 };
  if (intent.state === ContentIntentState.CANCELLED) {
    return { ok: false, code: 'CANCELLED', providerCalls: 0 };
  }
  if (intent.state === ContentIntentState.OUTCOME_UNKNOWN) {
    return {
      ok: false,
      code: 'RECONCILIATION_REQUIRED',
      blindRetry: false,
      providerCalls: 0,
      explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT REPOST BLINDLY.',
    };
  }
  if (intent.state === ContentIntentState.PROVIDER_ACCEPTED) {
    const { rows: pubs } = await pool.query(
      `SELECT * FROM ops.content_publications WHERE intent_id=$1`,
      [intentId],
    );
    return { ok: true, alreadyPublished: true, publication: pubs[0] || null, providerCalls: 0 };
  }

  const { rows: revs } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [intent.content_revision_id]);
  const rev = revs[0];
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND', providerCalls: 0 };
  if (!rev.is_current) return { ok: false, code: 'STALE_CONTENT_REVISION', providerCalls: 0 };
  if (rev.content_hash !== intent.content_hash) {
    return { ok: false, code: 'CONTENT_HASH_MISMATCH', providerCalls: 0 };
  }

  const appr = await loadApprovalBound(pool, rev.id, rev.content_hash);
  if (!appr.ok) return { ok: false, code: appr.code, providerCalls: 0 };
  const claims = await claimsPublishable(pool, rev.id);
  if (!claims.ok) return { ok: false, code: claims.code, providerCalls: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ops.content_publication_intents
       SET state='CREATED', updated_at=now()
       WHERE id=$1 AND state IN ('SCHEDULED','CREATED','FAILED')`,
      [intentId],
    );
    await client.query(
      `UPDATE ops.content_items SET status=$2, updated_at=now() WHERE id=$1`,
      [intent.content_item_id, ContentStatus.PUBLICATION_PENDING],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('content.publication_intent_created',$1::jsonb)`,
      [JSON.stringify({ intent_id: intentId, revision_id: rev.id })],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  const gate2 = await contentControlGate(pool);
  if (!gate2.ok) return { ok: false, code: gate2.code, providerCalls: 0, intentId };
  const { rows: rev2 } = await pool.query(`SELECT * FROM ops.content_revisions WHERE id=$1`, [rev.id]);
  if (!rev2[0]?.is_current || rev2[0].content_hash !== intent.content_hash) {
    return { ok: false, code: 'STALE_CONTENT_REVISION', providerCalls: 0, intentId };
  }
  const appr2 = await loadApprovalBound(pool, rev.id, intent.content_hash);
  if (!appr2.ok) return { ok: false, code: appr2.code, providerCalls: 0, intentId };

  await pool.query(
    `UPDATE ops.content_publication_intents SET state='ATTEMPTED', attempted_at=now(), updated_at=now() WHERE id=$1`,
    [intentId],
  );

  const plaintext = rev.channel_payload?.plaintext
    || `${rev.headline}\n\n${rev.body_text}\n\n${rev.cta}`;
  const result = await provider.publishPost({
    channel: intent.channel,
    plaintext,
    idempotencyKey: intent.idempotency_key,
    contentHash: intent.content_hash,
  });

  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    if (result.class === 'PUBLISH_TIMEOUT_UNKNOWN') {
      await client2.query(
        `UPDATE ops.content_publication_intents SET state='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
        [intentId],
      );
      await client2.query(
        `INSERT INTO ops.content_publications
          (intent_id, content_revision_id, content_item_id, channel, provider_code, state)
         VALUES ($1,$2,$3,$4,$5,'OUTCOME_UNKNOWN')
         ON CONFLICT (intent_id) DO UPDATE SET state='OUTCOME_UNKNOWN', updated_at=now()`,
        [intentId, rev.id, intent.content_item_id, intent.channel, intent.provider_code],
      );
      await client2.query(
        `UPDATE ops.content_items SET status='OUTCOME_UNKNOWN', updated_at=now() WHERE id=$1`,
        [intent.content_item_id],
      );
      await client2.query(
        `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.outcome_unknown',$1::jsonb)`,
        [JSON.stringify({ intent_id: intentId, blind_retry: false })],
      );
      await client2.query('COMMIT');
      return {
        ok: true,
        outcomeUnknown: true,
        blindRetry: false,
        providerCalls: result.providerCalls || 1,
        intentId,
      };
    }
    if (result.class === 'PUBLISH_TRANSIENT_KNOWN_NOT_EXECUTED') {
      await client2.query(
        `UPDATE ops.content_publication_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
        [intentId],
      );
      await client2.query(
        `UPDATE ops.content_items SET status='FAILED', updated_at=now() WHERE id=$1`,
        [intent.content_item_id],
      );
      await client2.query('COMMIT');
      return {
        ok: false,
        code: 'TRANSIENT_KNOWN_NOT_EXECUTED',
        retryEligible: true,
        providerCalls: result.providerCalls || 1,
      };
    }
    if (!result.ok) {
      await client2.query(
        `UPDATE ops.content_publication_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
        [intentId],
      );
      await client2.query(
        `INSERT INTO ops.content_publications
          (intent_id, content_revision_id, content_item_id, channel, provider_code, state)
         VALUES ($1,$2,$3,$4,$5,'FAILED')
         ON CONFLICT (intent_id) DO UPDATE SET state='FAILED', updated_at=now()`,
        [intentId, rev.id, intent.content_item_id, intent.channel, intent.provider_code],
      );
      await client2.query(
        `UPDATE ops.content_items SET status='FAILED', updated_at=now() WHERE id=$1`,
        [intent.content_item_id],
      );
      await client2.query(
        `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.failed',$1::jsonb)`,
        [JSON.stringify({ intent_id: intentId, reason: result.reasonCode || result.class })],
      );
      await client2.query('COMMIT');
      return { ok: false, code: result.reasonCode || 'PROVIDER_REJECTED', providerCalls: result.providerCalls || 1 };
    }

    await client2.query(
      `UPDATE ops.content_publication_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    const pubIns = await client2.query(
      `INSERT INTO ops.content_publications
        (intent_id, content_revision_id, content_item_id, channel, provider_code, provider_post_id, state)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING')
       ON CONFLICT (intent_id) DO UPDATE
         SET provider_post_id=EXCLUDED.provider_post_id, state='PENDING', updated_at=now()
       RETURNING *`,
      [
        intentId, rev.id, intent.content_item_id, intent.channel,
        intent.provider_code || A12_TEST_PUBLISHER_ID, result.providerPostId,
      ],
    );
    await client2.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.provider_accepted',$1::jsonb)`,
      [JSON.stringify({ intent_id: intentId, provider_post_id: result.providerPostId })],
    );
    await client2.query('COMMIT');

    const readback = await provider.getPost({
      idempotencyKey: intent.idempotency_key,
      providerPostId: result.providerPostId,
      expectedChannel: intent.channel,
    });
    if (readback.class === 'READBACK_FOUND' && readback.post?.status === 'PUBLISHED') {
      await pool.query(
        `UPDATE ops.content_publications
         SET state='PUBLISHED', published_at=now(), readback_at=now(), updated_at=now()
         WHERE intent_id=$1`,
        [intentId],
      );
      await pool.query(
        `UPDATE ops.content_items SET status='PUBLISHED', updated_at=now() WHERE id=$1`,
        [intent.content_item_id],
      );
      await pool.query(
        `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.published',$1::jsonb)`,
        [JSON.stringify({ intent_id: intentId, provider_post_id: result.providerPostId })],
      );
      const { rows: pubs } = await pool.query(`SELECT * FROM ops.content_publications WHERE intent_id=$1`, [intentId]);
      return {
        ok: true,
        published: true,
        publication: pubs[0],
        providerCalls: (result.providerCalls || 1) + (readback.providerCalls || 0),
        providerPostId: result.providerPostId,
      };
    }
    if (readback.class === 'READBACK_MISMATCH') {
      await pool.query(
        `UPDATE ops.content_publications SET state='MISMATCH', readback_at=now(), updated_at=now() WHERE intent_id=$1`,
        [intentId],
      );
      return {
        ok: false,
        code: 'PROVIDER_CONTENT_MISMATCH_REVIEW_REQUIRED',
        providerCalls: (result.providerCalls || 1) + (readback.providerCalls || 0),
      };
    }
    return {
      ok: true,
      accepted: true,
      publication: pubIns.rows[0],
      providerCalls: (result.providerCalls || 1) + (readback.providerCalls || 0),
      providerPostId: result.providerPostId,
    };
  } catch (err) {
    try { await client2.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client2.release();
  }
}

export async function reconcileContentPublication(pool, {
  intentId,
  publisher = null,
} = {}) {
  if (!intentId) return { ok: false, code: 'INTENT_ID_REQUIRED', blindRetry: false };
  const provider = publisher || createDeterministicTestPublishingProvider();
  const { rows } = await pool.query(`SELECT * FROM ops.content_publication_intents WHERE id=$1`, [intentId]);
  const intent = rows[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND', blindRetry: false };

  const { rows: pubs } = await pool.query(`SELECT * FROM ops.content_publications WHERE intent_id=$1`, [intentId]);
  const pub = pubs[0];
  const readback = await provider.getPost({
    idempotencyKey: intent.idempotency_key,
    providerPostId: pub?.provider_post_id || null,
    expectedChannel: intent.channel,
  });

  if (readback.class === 'READBACK_FOUND') {
    const postId = readback.post.providerPostId;
    await pool.query(
      `INSERT INTO ops.content_publications
        (intent_id, content_revision_id, content_item_id, channel, provider_code, provider_post_id, state, published_at, readback_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PUBLISHED',now(),now())
       ON CONFLICT (intent_id) DO UPDATE
         SET provider_post_id=EXCLUDED.provider_post_id, state='PUBLISHED',
             published_at=COALESCE(ops.content_publications.published_at, now()),
             readback_at=now(), updated_at=now()`,
      [
        intentId, intent.content_revision_id, intent.content_item_id,
        intent.channel, intent.provider_code, postId,
      ],
    );
    await pool.query(
      `UPDATE ops.content_publication_intents SET state='PROVIDER_ACCEPTED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    await pool.query(
      `UPDATE ops.content_items SET status='PUBLISHED', updated_at=now() WHERE id=$1`,
      [intent.content_item_id],
    );
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.published',$1::jsonb)`,
      [JSON.stringify({ intent_id: intentId, reconciled: true, provider_post_id: postId })],
    );
    return { ok: true, adopted: true, providerPostId: postId, blindRetry: false, providerCalls: readback.providerCalls || 1 };
  }

  if (readback.class === 'READBACK_NOT_FOUND') {
    await pool.query(
      `UPDATE ops.content_publications SET state='ABSENT', readback_at=now(), updated_at=now() WHERE intent_id=$1`,
      [intentId],
    );
    await pool.query(
      `UPDATE ops.content_publication_intents SET state='FAILED', updated_at=now() WHERE id=$1`,
      [intentId],
    );
    await pool.query(
      `UPDATE ops.content_items SET status='FAILED', updated_at=now() WHERE id=$1`,
      [intent.content_item_id],
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
    await pool.query(
      `UPDATE ops.content_publications SET state='MISMATCH', readback_at=now(), updated_at=now() WHERE intent_id=$1`,
      [intentId],
    );
    return {
      ok: false,
      code: 'PROVIDER_CONTENT_MISMATCH_REVIEW_REQUIRED',
      blindRetry: false,
      providerCalls: readback.providerCalls || 1,
    };
  }

  return {
    ok: true,
    code: 'RECONCILIATION_REQUIRED',
    blindRetry: false,
    explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT REPOST BLINDLY.',
    providerCalls: readback.providerCalls || 0,
  };
}

export async function cancelContentPublication(pool, {
  intentId = null,
  contentItemId = null,
  reason = 'OPERATOR_CANCEL',
} = {}) {
  if (!intentId && !contentItemId) return { ok: false, code: 'TARGET_REQUIRED' };
  let intent;
  if (intentId) {
    const { rows } = await pool.query(`SELECT * FROM ops.content_publication_intents WHERE id=$1`, [intentId]);
    intent = rows[0];
  } else {
    const { rows } = await pool.query(
      `SELECT * FROM ops.content_publication_intents
       WHERE content_item_id=$1 AND state IN ('SCHEDULED','CREATED','FAILED')
       ORDER BY created_at DESC LIMIT 1`,
      [contentItemId],
    );
    intent = rows[0];
  }
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND' };
  if ([ContentIntentState.PROVIDER_ACCEPTED, ContentIntentState.OUTCOME_UNKNOWN].includes(intent.state)) {
    return { ok: false, code: 'CANCEL_AFTER_PROVIDER_FORBIDDEN', state: intent.state };
  }
  await pool.query(
    `UPDATE ops.content_publication_intents SET state='CANCELLED', updated_at=now() WHERE id=$1`,
    [intent.id],
  );
  await pool.query(
    `UPDATE ops.content_items SET status='CANCELLED', updated_at=now() WHERE id=$1`,
    [intent.content_item_id],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail) VALUES ('content.cancelled',$1::jsonb)`,
    [JSON.stringify({ intent_id: intent.id, reason })],
  );
  return { ok: true, intentId: intent.id, cancelled: true };
}
