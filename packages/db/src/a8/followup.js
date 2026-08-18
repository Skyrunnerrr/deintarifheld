/**
 * Bounded A8 offer follow-up. Durable A1 job. Max 1. No memory timers.
 */
import { MessagePurpose, OfferState } from '@deintarifheld/shared';
import { createMockEmailProvider, hashEmail, redactEmail } from '../a4/provider.js';
import { executeCommunicationSend } from '../a4/communicate.js';
import { getCurrentQualification } from '../a3/evaluate.js';
import {
  offerControlGate,
  hasTakeover,
  resolveOfferContact,
  loadWorkflow,
} from './prepare.js';
import { loadOfferRevision, loadOfferOptions } from './deliver.js';
import { renderOfferText } from './render.js';
import { isTariffEvaluationCurrent } from '../a7/handoff.js';

export async function executeOfferFollowup(pool, {
  offerRevisionId,
  generation = 1,
  emailProvider = null,
} = {}) {
  if (!offerRevisionId) return { ok: false, code: 'REVISION_ID_REQUIRED', providerCalls: 0 };
  if (Number(generation) > 1) return { ok: true, cancelled: true, code: 'MAX_FOLLOWUPS', providerCalls: 0 };

  const gate = await offerControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };
  if (gate.mailSnap?.globalKillActive || gate.mailSnap?.domainKillActive) {
    return { ok: false, code: 'COMMUNICATION_KILL', providerCalls: 0 };
  }

  const rev = await loadOfferRevision(pool, offerRevisionId);
  if (!rev) return { ok: false, code: 'REVISION_NOT_FOUND', providerCalls: 0 };
  if (rev.state !== OfferState.SENT) {
    return { ok: true, cancelled: true, code: `NOT_SENT_${rev.state}`, providerCalls: 0 };
  }
  if (await hasTakeover(pool, rev.case_id)) return { ok: false, code: 'TAKEOVER', providerCalls: 0 };

  const { rows: dec } = await pool.query(
    `SELECT decision FROM ops.offer_customer_decisions WHERE offer_revision_id = $1`,
    [rev.id],
  );
  if (dec[0]) return { ok: true, cancelled: true, code: 'ALREADY_DECIDED', providerCalls: 0 };

  const { rows: exp } = await pool.query(`SELECT $1::timestamptz <= now() AS expired`, [rev.valid_until]);
  if (exp[0]?.expired) return { ok: true, cancelled: true, code: 'EXPIRED', providerCalls: 0 };

  const fresh = await isTariffEvaluationCurrent(pool, rev.evaluation_id);
  if (!fresh.current) return { ok: true, cancelled: true, code: 'EVALUATION_STALE', providerCalls: 0 };

  const contact = await resolveOfferContact(pool, rev.case_id);
  if (!contact?.email) return { ok: false, code: 'RECIPIENT_MISSING', providerCalls: 0 };

  const { rows: convRows } = await pool.query(
    `SELECT * FROM ops.conversations WHERE case_id = $1 AND channel = 'EMAIL'`,
    [rev.case_id],
  );
  const conv = convRows[0];
  if (!conv) return { ok: false, code: 'CONVERSATION_MISSING', providerCalls: 0 };
  if (conv.do_not_automatically_contact) return { ok: true, cancelled: true, code: 'SUPPRESSED', providerCalls: 0 };

  const options = await loadOfferOptions(pool, rev.id);
  const rendered = renderOfferText({
    purpose: MessagePurpose.OFFER_FOLLOWUP,
    ansprechpartner: contact.ansprechpartner,
    firma: contact.firma,
    offerUrl: `https://offer.deintarifheld.invalid/angebot?revision=${rev.id}`,
    snapshot: rev.commercial_snapshot,
    options,
    validUntil: rev.valid_until,
  });
  const qual = await getCurrentQualification(pool, rev.case_id);
  const wf = await loadWorkflow(pool, rev.case_id);
  const dthKey = `offer-followup/${rev.id}/${generation}`;

  const ins = await pool.query(
    `INSERT INTO ops.outbound_intents
      (conversation_id, case_id, purpose, state, qualification_revision,
       requirement_ids, requirement_fingerprint, dth_idempotency_key,
       communication_policy_version, template_id, template_version,
       content_hash, subject, body_text, recipient_email_hash,
       recipient_snapshot_redacted, provider_idempotency_key, followup_generation)
     VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (dth_idempotency_key) DO NOTHING
     RETURNING id`,
    [
      conv.id,
      rev.case_id,
      MessagePurpose.OFFER_FOLLOWUP,
      qual?.revision || 1,
      `offer-followup:${rev.id}:${generation}`,
      dthKey,
      rendered.templateId,
      rendered.templateVersion,
      rendered.contentHash,
      rendered.subject,
      rendered.bodyText,
      hashEmail(contact.email),
      redactEmail(contact.email),
      dthKey.slice(0, 200),
      generation,
    ],
  );
  const intentId = ins.rows[0]?.id;
  if (!intentId) return { ok: true, duplicate: true, providerCalls: 0 };
  void wf;

  const send = await executeCommunicationSend(pool, {
    intentId,
    emailProvider: emailProvider || createMockEmailProvider(),
  });
  return {
    ok: true,
    followup: true,
    cancelled: send.cancelled === true,
    outcomeUnknown: send.outcomeUnknown === true,
    providerCalls: send.providerCalls || 0,
  };
}
