/**
 * A8 offer delivery via A4 intents. No direct Resend.
 */
import { randomBytes } from 'node:crypto';
import {
  MessagePurpose,
  B2B_COMMUNICATION_SEND_CAPABILITY,
  B2B_INBOUND_WORKFLOW_TYPE,
  OfferState,
  OFFER_DELIVER_CAPABILITY,
} from '@deintarifheld/shared';
import { isTariffEvaluationCurrent } from '../a7/handoff.js';
import { createMockEmailProvider, hashEmail, redactEmail } from '../a4/provider.js';
import { executeCommunicationSend } from '../a4/communicate.js';
import { getCurrentQualification } from '../a3/evaluate.js';
import {
  offerControlGate,
  hasTakeover,
  resolveOfferContact,
  isCaseActive,
  loadWorkflow,
  enqueueOfferJob,
} from './prepare.js';
import { renderOfferText } from './render.js';
import { assertOfferIntentSendable } from './gate.js';

function offerUrlForToken(token) {
  return `https://offer.deintarifheld.invalid/angebot?t=${token}`;
}

async function ensureConversation(client, { caseId, workflowInstanceId }) {
  const existing = await client.query(
    `SELECT * FROM ops.conversations WHERE case_id = $1 AND channel = 'EMAIL'`,
    [caseId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const ref = randomBytes(3).toString('hex').toUpperCase();
  const { rows } = await client.query(
    `INSERT INTO ops.conversations (case_id, workflow_instance_id, conversation_ref)
     VALUES ($1,$2,$3)
     ON CONFLICT (case_id, channel) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [caseId, workflowInstanceId, ref],
  );
  return rows[0];
}

export async function loadOfferRevision(pool, revisionId) {
  const { rows } = await pool.query(
    `SELECT r.*, o.case_id, o.id AS offer_id, o.status AS offer_status
     FROM ops.offer_revisions r
     JOIN ops.offers o ON o.id = r.offer_id
     WHERE r.id = $1`,
    [revisionId],
  );
  return rows[0] || null;
}

export async function loadOfferOptions(pool, revisionId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.offer_options WHERE offer_revision_id = $1 ORDER BY option_index`,
    [revisionId],
  );
  return rows;
}

async function loadRawTokenUnavailable() {
  return null;
}

/**
 * Create A4 intent + send (mock). Marks SENT only after PROVIDER_ACCEPTED (via A4 hook).
 */
export async function deliverOffer(pool, {
  offerRevisionId,
  emailProvider = null,
  now = new Date(),
} = {}) {
  if (!offerRevisionId) return { ok: false, code: 'REVISION_ID_REQUIRED', providerCalls: 0 };

  const gate = await offerControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };
  if (gate.mailSnap?.globalKillActive || gate.mailSnap?.domainKillActive) {
    return { ok: false, code: 'COMMUNICATION_KILL', providerCalls: 0 };
  }

  const rev = await loadOfferRevision(pool, offerRevisionId);
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND', providerCalls: 0 };
  if (await hasTakeover(pool, rev.case_id)) return { ok: false, code: 'TAKEOVER', providerCalls: 0 };

  const contact = await resolveOfferContact(pool, rev.case_id);
  if (!contact?.email) return { ok: false, code: 'RECIPIENT_MISSING', providerCalls: 0 };
  if (!isCaseActive(contact.caseStatus)) return { ok: false, code: 'CASE_NOT_ACTIVE', providerCalls: 0 };

  if (rev.customer_deliverable_live === true || rev.source_kind !== 'TEST_FIXTURE') {
    return { ok: false, code: 'SYNTHETIC_LIVE_BLOCK', providerCalls: 0 };
  }
  if (!rev.is_current) return { ok: false, code: 'REVISION_NOT_CURRENT', providerCalls: 0 };
  if (rev.state === OfferState.SENT) {
    return { ok: true, alreadySent: true, revisionId: rev.id, providerCalls: 0 };
  }
  if (rev.state !== OfferState.READY && rev.state !== OfferState.APPROVED) {
    return { ok: false, code: 'OFFER_NOT_READY', state: rev.state, providerCalls: 0 };
  }

  const { rows: expired } = await pool.query(
    `SELECT $1::timestamptz < now() AS expired`,
    [rev.valid_until],
  );
  if (expired[0]?.expired) return { ok: false, code: 'OFFER_EXPIRED', providerCalls: 0 };

  const { rows: appr } = await pool.query(
    `SELECT decision FROM ops.offer_approvals WHERE offer_revision_id = $1`,
    [rev.id],
  );
  if (!appr[0] || appr[0].decision !== 'APPROVED') {
    return { ok: false, code: 'APPROVAL_MISSING', providerCalls: 0 };
  }

  const fresh = await isTariffEvaluationCurrent(pool, rev.evaluation_id);
  if (!fresh.current) {
    await pool.query(
      `UPDATE ops.offer_revisions SET state = 'INVALIDATED', is_current = false WHERE id = $1 AND state IN ('READY','APPROVED')`,
      [rev.id],
    );
    await pool.query(
      `UPDATE ops.offers SET status = 'INVALIDATED', updated_at = now() WHERE id = $1`,
      [rev.offer_id],
    );
    await pool.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('offer.invalidated',$1::jsonb)`,
      [JSON.stringify({ offer_revision_id: rev.id, reason: 'EVALUATION_STALE' })],
    );
    return { ok: false, code: 'EVALUATION_STALE', staleReasons: fresh.reasons, providerCalls: 0 };
  }

  const { rows: tok } = await pool.query(
    `SELECT token_hash FROM ops.offer_tokens
     WHERE offer_revision_id = $1 AND superseded_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [rev.id],
  );
  void tok;
  void loadRawTokenUnavailable;
  void now;

  const options = await loadOfferOptions(pool, rev.id);
  const snapshot = rev.commercial_snapshot;
  // Token is not stored raw — delivery URL uses a one-time reconstruction only at create.
  // Tests that need a clickable token use prepareOffer's returned token. Delivery mail
  // includes a revision-bound placeholder path without the raw secret when token is unknown.
  const offerUrl = `https://offer.deintarifheld.invalid/angebot?revision=${rev.id}`;
  void offerUrlForToken;

  const rendered = renderOfferText({
    purpose: MessagePurpose.OFFER_DELIVERY,
    ansprechpartner: contact.ansprechpartner,
    firma: contact.firma,
    offerUrl,
    snapshot,
    options,
    validUntil: rev.valid_until,
  });

  const qual = await getCurrentQualification(pool, rev.case_id);
  const wf = await loadWorkflow(pool, rev.case_id);
  const dthKey = `offer-delivery/${rev.id}`;

  const client = await pool.connect();
  let intentId = rev.delivery_intent_id;
  try {
    await client.query('BEGIN');
    const conv = await ensureConversation(client, { caseId: rev.case_id, workflowInstanceId: wf?.id || null });
    if (conv.do_not_automatically_contact) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SUPPRESSED', providerCalls: 0 };
    }
    if (!intentId) {
      const ins = await client.query(
        `INSERT INTO ops.outbound_intents
          (conversation_id, case_id, purpose, state, qualification_revision,
           requirement_ids, requirement_fingerprint, dth_idempotency_key,
           communication_policy_version, template_id, template_version,
           content_hash, subject, body_text, recipient_email_hash,
           recipient_snapshot_redacted, provider_idempotency_key, followup_generation,
           correlation_id)
         VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,0,$15)
         ON CONFLICT (dth_idempotency_key) DO UPDATE SET updated_at = now()
         RETURNING id, state`,
        [
          conv.id,
          rev.case_id,
          MessagePurpose.OFFER_DELIVERY,
          qual?.revision || 1,
          `offer:${rev.id}`,
          dthKey,
          rendered.templateId,
          rendered.templateVersion,
          rendered.contentHash,
          rendered.subject,
          rendered.bodyText,
          hashEmail(contact.email),
          redactEmail(contact.email),
          dthKey.slice(0, 200),
          wf?.correlation_id || null,
        ],
      );
      intentId = ins.rows[0].id;
      await client.query(
        `UPDATE ops.offer_revisions SET delivery_intent_id = $2, content_hash = $3 WHERE id = $1`,
        [rev.id, intentId, rendered.contentHash],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  const send = await executeCommunicationSend(pool, {
    intentId,
    emailProvider: emailProvider || createMockEmailProvider(),
  });

  if (send.cancelled) {
    return { ok: true, cancelled: true, reasons: send.reasons, providerCalls: send.providerCalls || 0, code: 'CANCELLED_STALE' };
  }
  if (send.outcomeUnknown) {
    return {
      ok: true,
      outcomeUnknown: true,
      sent: false,
      providerCalls: send.providerCalls || 1,
      revisionId: rev.id,
      intentId,
    };
  }
  if (!send.ok && !send.alreadyTerminal) {
    return { ok: false, code: send.code || 'SEND_FAILED', providerCalls: send.providerCalls || 0, intentId };
  }

  const { rows: after } = await pool.query(
    `SELECT state FROM ops.offer_revisions WHERE id = $1`,
    [rev.id],
  );
  return {
    ok: true,
    sent: after[0]?.state === OfferState.SENT,
    revisionId: rev.id,
    intentId,
    providerCalls: send.providerCalls ?? 1,
    capability: OFFER_DELIVER_CAPABILITY,
    workflowType: B2B_INBOUND_WORKFLOW_TYPE,
  };
}

export async function expireOffer(pool, { offerRevisionId } = {}) {
  if (!offerRevisionId) return { ok: false, code: 'REVISION_ID_REQUIRED' };
  const { rows } = await pool.query(
    `UPDATE ops.offer_revisions
     SET state = 'EXPIRED', is_current = CASE WHEN is_current THEN is_current ELSE false END
     WHERE id = $1
       AND state IN ('DRAFT','APPROVAL_REQUIRED','APPROVED','READY','SENT')
       AND valid_until <= now()
     RETURNING id, offer_id, state`,
    [offerRevisionId],
  );
  if (!rows[0]) {
    const cur = await loadOfferRevision(pool, offerRevisionId);
    if (cur?.state === OfferState.EXPIRED) return { ok: true, duplicate: true };
    if (cur && ['ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CANCELLED', 'INVALIDATED'].includes(cur.state)) {
      return { ok: true, skipped: true, state: cur.state };
    }
    return { ok: false, code: 'NOT_EXPIRED_YET' };
  }
  await pool.query(
    `UPDATE ops.offers SET status = 'EXPIRED', updated_at = now() WHERE id = $1 AND status NOT IN ('ACCEPTED','REJECTED')`,
    [rows[0].offer_id],
  );
  await pool.query(
    `INSERT INTO public.audit_events (event_type, detail)
     VALUES ('offer.expired',$1::jsonb)`,
    [JSON.stringify({ offer_revision_id: offerRevisionId })],
  );
  await cancelOfferFollowups(pool, offerRevisionId);
  return { ok: true, revisionId: offerRevisionId };
}

export async function cancelOfferFollowups(pool, offerRevisionId) {
  await pool.query(
    `UPDATE workflow.jobs
     SET status = 'CANCELLED', updated_at = now()
     WHERE job_type = 'OFFER_FOLLOWUP_DUE'
       AND status IN ('READY','LEASED')
       AND payload_redacted->>'offer_revision_id' = $1`,
    [String(offerRevisionId)],
  );
}

export async function reconcileOfferDelivery(pool, { offerRevisionId } = {}) {
  const rev = await loadOfferRevision(pool, offerRevisionId);
  if (!rev?.delivery_intent_id) return { ok: false, code: 'NO_INTENT' };
  const { rows } = await pool.query(
    `SELECT state FROM ops.outbound_intents WHERE id = $1`,
    [rev.delivery_intent_id],
  );
  const state = rows[0]?.state;
  if (state === 'PROVIDER_ACCEPTED' && rev.state === 'READY') {
    await pool.query(`UPDATE ops.offer_revisions SET state = 'SENT' WHERE id = $1`, [rev.id]);
    await pool.query(`UPDATE ops.offers SET status = 'SENT', updated_at = now() WHERE id = $1`, [rev.offer_id]);
    return { ok: true, reconciled: true };
  }
  return { ok: true, intentState: state, offerState: rev.state };
}

export { assertOfferIntentSendable };
