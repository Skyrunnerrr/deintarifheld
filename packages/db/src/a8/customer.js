/**
 * A8 customer capability: view / accept / reject via hashed token.
 * Raw token never persisted. Email replies are not acceptance.
 */
import {
  OfferState,
  OfferCustomerDecision,
  OfferDecisionChannel,
  SWITCH_PREPARATION_CAPABILITY,
} from '@deintarifheld/shared';
import { isTariffEvaluationCurrent } from '../a7/handoff.js';
import { hashOfferToken, hasTakeover, isCaseActive, resolveOfferContact } from './prepare.js';
import { buildPublicOfferViewModel } from './render.js';
import { cancelOfferFollowups, loadOfferOptions } from './deliver.js';
import { createSwitchPreparation } from './a9.js';

async function loadRevisionByToken(pool, token) {
  const tokenHash = hashOfferToken(token);
  const { rows } = await pool.query(
    `SELECT t.id AS token_id, t.expires_at, t.superseded_at,
            r.*, o.case_id, o.id AS offer_id, o.status AS offer_status
     FROM ops.offer_tokens t
     JOIN ops.offer_revisions r ON r.id = t.offer_revision_id
     JOIN ops.offers o ON o.id = r.offer_id
     WHERE t.token_hash = $1
     LIMIT 1`,
    [tokenHash],
  );
  return rows[0] || null;
}

export async function getPublicOfferView(pool, token) {
  if (!token || String(token).length > 200) return { ok: false, code: 'INVALID_TOKEN' };
  const rev = await loadRevisionByToken(pool, token);
  if (!rev) return { ok: false, code: 'INVALID_TOKEN' };
  if (rev.superseded_at || !rev.is_current || rev.state === OfferState.SUPERSEDED) {
    return { ok: false, code: 'SUPERSEDED_TOKEN' };
  }
  const { rows: exp } = await pool.query(
    `SELECT $1::timestamptz <= now() AS expired`,
    [rev.expires_at],
  );
  if (exp[0]?.expired || rev.state === OfferState.EXPIRED) {
    return { ok: false, code: 'EXPIRED_TOKEN' };
  }
  const options = await loadOfferOptions(pool, rev.id);
  const view = buildPublicOfferViewModel({
    revision: rev,
    options,
    validUntil: rev.valid_until,
  });
  return {
    ok: true,
    status: rev.state,
    banner: view.banner,
    legalText: view.legalText,
    validUntil: view.validUntil,
    synthetic: true,
    environmentMarker: 'TEST_ONLY',
    options: view.options,
  };
}

async function commitDecision(pool, {
  rev, token, decision, optionId, now,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const optCheck = optionId
      ? await client.query(
        `SELECT id, tariff_version_id FROM ops.offer_options
         WHERE id = $1 AND offer_revision_id = $2`,
        [optionId, rev.id],
      )
      : await client.query(
        `SELECT id, tariff_version_id FROM ops.offer_options
         WHERE offer_revision_id = $1 ORDER BY option_index LIMIT 1`,
        [rev.id],
      );
    const option = optCheck.rows[0];
    if (decision === OfferCustomerDecision.ACCEPT && !option) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'OPTION_NOT_IN_REVISION' };
    }

    const ins = await client.query(
      `INSERT INTO ops.offer_customer_decisions
        (offer_revision_id, offer_option_id, decision, commercial_snapshot_hash, decided_at, channel)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (offer_revision_id) DO NOTHING
       RETURNING id, decision`,
      [
        rev.id,
        option?.id || null,
        decision,
        rev.commercial_snapshot_hash,
        new Date(now).toISOString(),
        OfferDecisionChannel.OFFER_PAGE_TOKEN,
      ],
    );
    if (!ins.rows[0]) {
      const existing = await client.query(
        `SELECT decision FROM ops.offer_customer_decisions WHERE offer_revision_id = $1`,
        [rev.id],
      );
      await client.query('COMMIT');
      const prior = existing.rows[0]?.decision;
      if (prior === decision) {
        return { ok: true, duplicate: true, decision: prior, revisionId: rev.id };
      }
      return { ok: false, code: 'TERMINAL_DECISION_EXISTS', existing: prior };
    }

    const nextState = decision === OfferCustomerDecision.ACCEPT ? OfferState.ACCEPTED : OfferState.REJECTED;
    await client.query(
      `UPDATE ops.offer_revisions SET state = $2 WHERE id = $1 AND state = 'SENT'`,
      [rev.id, nextState],
    );
    await client.query(
      `UPDATE ops.offers SET status = $2, updated_at = now() WHERE id = $1`,
      [rev.offer_id, nextState],
    );
    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ($2,$1::jsonb)`,
      [
        JSON.stringify({
          offer_revision_id: rev.id,
          offer_id: rev.offer_id,
          case_id: rev.case_id,
          decision,
        }),
        decision === OfferCustomerDecision.ACCEPT ? 'offer.accepted' : 'offer.rejected',
      ],
    );
    await client.query('COMMIT');

    await cancelOfferFollowups(pool, rev.id);

    let handoff = null;
    if (decision === OfferCustomerDecision.ACCEPT) {
      handoff = await createSwitchPreparation(pool, {
        caseId: rev.case_id,
        offerId: rev.offer_id,
        offerRevisionId: rev.id,
        commercialSnapshotHash: rev.commercial_snapshot_hash,
        selectedTariffVersionId: option.tariff_version_id,
        catalogueSnapshotId: rev.catalogue_snapshot_id,
      });
    }
    return {
      ok: true,
      decision,
      revisionId: rev.id,
      snapshotHash: rev.commercial_snapshot_hash,
      optionId: option?.id || null,
      handoff,
      nextCapability: decision === OfferCustomerDecision.ACCEPT ? SWITCH_PREPARATION_CAPABILITY : null,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function preDecision(pool, token, { requireSent = true } = {}) {
  if (!token || String(token).length > 200) return { ok: false, code: 'INVALID_TOKEN' };
  const rev = await loadRevisionByToken(pool, token);
  if (!rev) return { ok: false, code: 'INVALID_TOKEN' };
  if (rev.superseded_at || rev.state === OfferState.SUPERSEDED || !rev.is_current) {
    return { ok: false, code: 'SUPERSEDED_TOKEN' };
  }
  const { rows: exp } = await pool.query(
    `SELECT now() AS n, ($1::timestamptz <= now()) AS expired`,
    [rev.valid_until],
  );
  if (exp[0]?.expired || rev.state === OfferState.EXPIRED) {
    return { ok: false, code: 'EXPIRED_TOKEN' };
  }
  if (requireSent && rev.state !== OfferState.SENT && rev.state !== OfferState.ACCEPTED && rev.state !== OfferState.REJECTED) {
    return { ok: false, code: 'OFFER_NOT_SENT', state: rev.state };
  }
  const contact = await resolveOfferContact(pool, rev.case_id);
  if (!contact || !isCaseActive(contact.caseStatus)) return { ok: false, code: 'CASE_NOT_ACTIVE' };
  if (await hasTakeover(pool, rev.case_id)) {
    // Public token must not bypass takeover for autonomous progression; existing SENT
    // offer may still be accepted as customer action (durable receipt).
  }
  const fresh = await isTariffEvaluationCurrent(pool, rev.evaluation_id);
  if (!fresh.current && rev.state === OfferState.SENT) {
    // Historical SENT terms remain bindable until expiry/supersede — do not silently
    // reprice. Stale evaluation blocks NEW send, not acceptance of already-sent snapshot
    // unless superseded. E2: allow accept of SENT snapshot while unexpired.
  }
  return { ok: true, revision: rev };
}

export async function acceptOffer(pool, { token, optionId, now = new Date() } = {}) {
  const pre = await preDecision(pool, token);
  if (!pre.ok) return pre;
  if (pre.revision.state === OfferState.ACCEPTED) {
    return { ok: true, duplicate: true, decision: OfferCustomerDecision.ACCEPT, revisionId: pre.revision.id };
  }
  if (pre.revision.state === OfferState.REJECTED) {
    return { ok: false, code: 'TERMINAL_DECISION_EXISTS', existing: OfferCustomerDecision.REJECT };
  }
  return commitDecision(pool, {
    rev: pre.revision,
    token,
    decision: OfferCustomerDecision.ACCEPT,
    optionId: optionId || null,
    now,
  });
}

export async function rejectOffer(pool, { token, now = new Date() } = {}) {
  const pre = await preDecision(pool, token);
  if (!pre.ok) return pre;
  if (pre.revision.state === OfferState.REJECTED) {
    return { ok: true, duplicate: true, decision: OfferCustomerDecision.REJECT, revisionId: pre.revision.id };
  }
  if (pre.revision.state === OfferState.ACCEPTED) {
    return { ok: false, code: 'TERMINAL_DECISION_EXISTS', existing: OfferCustomerDecision.ACCEPT };
  }
  return commitDecision(pool, {
    rev: pre.revision,
    token,
    decision: OfferCustomerDecision.REJECT,
    optionId: null,
    now,
  });
}

export async function attemptMarkCustomerLive(_pool, { offerRevisionId } = {}) {
  void offerRevisionId;
  return { ok: false, code: 'SYNTHETIC_LIVE_BLOCK' };
}
