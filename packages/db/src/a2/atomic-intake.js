/**
 * A2 local atomic public intake — Lead + source outbox + audit in one transaction.
 * LOCAL_TEST_ONLY / canonical target for M11Q cutover.
 * Production Data API path remains unchanged until M11Q.
 */
import { randomUUID } from 'node:crypto';
import {
  BUSINESS_LEAD_ACCEPTED_EVENT,
  BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION,
  LeadType,
  buildBusinessLeadAcceptedPayload,
  isBusinessEnergyLeadType,
} from '@deintarifheld/shared';

function makeLeadRef(pageSource) {
  const prefix =
    pageSource === 'unternehmen'
      ? 'B2B'
      : pageSource === 'hero-funnel' || pageSource === 'main_funnel' || pageSource === 'privat'
        ? 'PRV'
        : 'LED';
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Atomic accept for business_energy leads only.
 * Private/career must not call this for B2B handoff.
 */
export async function acceptBusinessLeadAtomic(pool, {
  pageSource = 'unternehmen',
  email,
  firma = null,
  payload = {},
  consentAt = null,
  sourcePage = null,
  idempotencyKey,
  correlationId = null,
  leadType = LeadType.BUSINESS_ENERGY,
  failureInjector = null,
} = {}) {
  if (!isBusinessEnergyLeadType(leadType)) {
    return { ok: false, code: 'LEAD_TYPE_NOT_BUSINESS_ENERGY' };
  }
  if (!email || !idempotencyKey) {
    return { ok: false, code: 'INTAKE_ARGS_REQUIRED' };
  }

  const corr = correlationId || randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (failureInjector?.beforeLeadInsert) {
      await failureInjector.beforeLeadInsert();
    }

    const existing = await client.query(
      `SELECT id, lead_ref, created_at, status FROM public.leads WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      const lead = existing.rows[0];
      const ev = await client.query(
        `SELECT id, status FROM public.transactional_outbox
         WHERE idempotency_key = $1`,
        [`lead-handoff:${lead.id}`],
      );
      await client.query('COMMIT');
      return {
        ok: true,
        duplicate: true,
        leadId: lead.id,
        leadRef: lead.lead_ref,
        correlationId: corr,
        eventId: ev.rows[0]?.id || null,
        eventStatus: ev.rows[0]?.status || null,
        code: 'IDEMPOTENT_REPLAY',
      };
    }

    const leadRef = makeLeadRef(pageSource);
    const leadIns = await client.query(
      `INSERT INTO public.leads
        (lead_ref, page_source, status, payload, email, firma, consent_at,
         source_page, idempotency_key, lead_type)
       VALUES ($1,$2,'new',$3::jsonb,$4,$5,COALESCE($6::timestamptz, now()),$7,$8,$9)
       RETURNING id, lead_ref, created_at`,
      [
        leadRef,
        pageSource,
        JSON.stringify(payload),
        email,
        firma,
        consentAt,
        sourcePage,
        idempotencyKey,
        leadType,
      ],
    );
    const lead = leadIns.rows[0];

    if (failureInjector?.afterLeadBeforeOutbox) {
      await failureInjector.afterLeadBeforeOutbox();
    }

    const redacted = buildBusinessLeadAcceptedPayload({
      leadId: lead.id,
      leadRef: lead.lead_ref,
      leadType,
      schemaVersion: BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION,
    });

    const out = await client.query(
      `INSERT INTO public.transactional_outbox
        (event_type, aggregate_type, aggregate_id, payload_redacted,
         idempotency_key, correlation_id, status)
       VALUES ($1,'lead',$2,$3::jsonb,$4,$5,'pending')
       ON CONFLICT (idempotency_key) DO UPDATE
         SET updated_at = public.transactional_outbox.updated_at
       RETURNING id, status`,
      [
        BUSINESS_LEAD_ACCEPTED_EVENT,
        String(lead.id),
        JSON.stringify(redacted),
        `lead-handoff:${lead.id}`,
        corr,
      ],
    );

    await client.query(
      `INSERT INTO public.audit_events (lead_id, event_type, detail)
       VALUES ($1,'lead.accepted',$2::jsonb)`,
      [
        lead.id,
        JSON.stringify({
          correlation_id: corr,
          handoff_intent: true,
          event_id: out.rows[0].id,
        }),
      ],
    );
    await client.query(
      `INSERT INTO public.audit_events (lead_id, event_type, detail)
       VALUES ($1,'lead.handoff_intent_created',$2::jsonb)`,
      [lead.id, JSON.stringify({ event_id: out.rows[0].id, correlation_id: corr })],
    );

    if (failureInjector?.beforeCommit) {
      await failureInjector.beforeCommit();
    }

    await client.query('COMMIT');
    return {
      ok: true,
      duplicate: false,
      leadId: lead.id,
      leadRef: lead.lead_ref,
      correlationId: corr,
      eventId: out.rows[0].id,
      eventStatus: out.rows[0].status,
      code: 'LEAD_DURABLY_ACCEPTED',
      semantics: 'LEAD_DURABLY_ACCEPTED+DURABLE_HANDOFF_INTENT_RECORDED',
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    // Concurrent idempotent insert race → treat as replay
    if (err.code === '23505' && idempotencyKey) {
      const existing = await pool.query(
        `SELECT id, lead_ref, created_at FROM public.leads WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (existing.rows[0]) {
        const ev = await pool.query(
          `SELECT id, status FROM public.transactional_outbox WHERE idempotency_key = $1`,
          [`lead-handoff:${existing.rows[0].id}`],
        );
        return {
          ok: true,
          duplicate: true,
          leadId: existing.rows[0].id,
          leadRef: existing.rows[0].lead_ref,
          correlationId: correlationId || randomUUID(),
          eventId: ev.rows[0]?.id || null,
          eventStatus: ev.rows[0]?.status || null,
          code: 'IDEMPOTENT_REPLAY',
        };
      }
    }
    throw err;
  } finally {
    client.release();
  }
}
