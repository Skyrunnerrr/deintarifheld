/**
 * A4 durable case communication: missing-info outbound, follow-up, inbound loop.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  QualificationOutcome,
  MessagePurpose,
  OutboundIntentState,
  ConversationStatus,
  InboundEventStatus,
  FollowupStatus,
  A4_COMMUNICATION_POLICY_VERSION,
  A4_DEFAULT_MAX_FOLLOWUPS,
  A4_TEST_FOLLOWUP_DELAY_MS,
  B2B_COMMUNICATION_SEND_CAPABILITY,
  B2B_MISSING_INFO_FOLLOWUP_CAPABILITY,
  B2B_INBOUND_EMAIL_PROCESS_CAPABILITY,
  B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY,
  B2B_INBOUND_WORKFLOW_TYPE,
  KillDomain,
  ObservationSourceKind,
  PROVIDER_EVENT_PRECEDENCE,
  isAllowedMessagePurpose,
  isAppointmentMessagePurpose,
  isOfferMessagePurpose,
  isSwitchMessagePurpose,
  isLifecycleMessagePurpose,
} from '@deintarifheld/shared';
import {
  getCurrentQualification,
  getOpenMissingRequirements,
  applyQualificationObservation,
  evaluateQualification,
} from '../a3/evaluate.js';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { renderMissingInfoMessage } from './template.js';
import { interpretMissingInfoReply } from './interpret.js';
import { createMockEmailProvider, hashEmail, redactEmail } from './provider.js';

function makeConversationRef() {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

const NON_SENDABLE_STATES = new Set([
  OutboundIntentState.PROVIDER_ACCEPTED,
  OutboundIntentState.DELIVERED,
  OutboundIntentState.BOUNCED,
  OutboundIntentState.FAILED,
  OutboundIntentState.OUTCOME_UNKNOWN,
  OutboundIntentState.CANCELLED_STALE,
  OutboundIntentState.RECONCILIATION_REQUIRED,
]);

function requirementFingerprint(reqs) {
  const ids = reqs.map((r) => r.id).sort();
  const fields = reqs.map((r) => r.field_code).sort();
  return createHash('sha256').update(JSON.stringify({ ids, fields })).digest('hex');
}

function htmlToBoundedText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);
}

export async function cancelStaleOutboundIntents(pool, caseId, { currentRevision, fingerprint } = {}) {
  const { rows } = await pool.query(
    `UPDATE ops.outbound_intents
     SET state = 'CANCELLED_STALE', cancelled_at = now(), updated_at = now(),
         failure_class = 'STALE_AFTER_REVISION'
     WHERE case_id = $1
       AND state IN ('INTENT_CREATED','READY_TO_SEND')
       AND (
         ($2::int IS NOT NULL AND qualification_revision <> $2)
         OR ($3::text IS NOT NULL AND requirement_fingerprint <> $3)
       )
     RETURNING id`,
    [caseId, currentRevision ?? null, fingerprint ?? null],
  );
  return rows.length;
}

async function resolveAuthoritativeContact(client, caseId) {
  const { rows } = await client.query(
    `SELECT c.id AS case_id, c.status AS case_status, c.source_lead_id,
            l.email, l.firma, l.payload, l.lead_type, l.page_source
     FROM public.cases c
     JOIN public.leads l ON l.id = c.source_lead_id
     WHERE c.id = $1 AND c.deleted_at IS NULL AND l.deleted_at IS NULL`,
    [caseId],
  );
  const row = rows[0];
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    caseId: row.case_id,
    caseStatus: row.case_status,
    leadId: row.source_lead_id,
    email: String(row.email || payload.email || '').trim().toLowerCase(),
    ansprechpartner: String(payload.ansprechpartner || '').trim(),
    firma: row.firma,
    leadType: row.lead_type,
    pageSource: row.page_source,
  };
}

async function ensureConversation(client, { caseId, workflowInstanceId }) {
  const existing = await client.query(
    `SELECT * FROM ops.conversations WHERE case_id = $1 AND channel = 'EMAIL'`,
    [caseId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const ref = makeConversationRef();
  const { rows } = await client.query(
    `INSERT INTO ops.conversations
      (case_id, workflow_instance_id, conversation_ref, max_followups)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (case_id, channel) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [caseId, workflowInstanceId, ref, A4_DEFAULT_MAX_FOLLOWUPS],
  );
  return rows[0];
}

/**
 * Create durable missing-info intent + SEND job. No provider call here.
 */
export async function prepareMissingInfoCommunication(pool, {
  caseId,
  purpose = MessagePurpose.MISSING_INFORMATION_REQUEST,
  followupGeneration = 0,
  provider = null,
} = {}) {
  if (!isAllowedMessagePurpose(purpose)) {
    return { ok: false, code: 'PURPOSE_NOT_ALLOWED' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const contact = await resolveAuthoritativeContact(client, caseId);
    if (!contact?.email) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'RECIPIENT_UNRESOLVED' };
    }
    const qual = await getCurrentQualification(pool, caseId);
    if (!qual || qual.outcome !== QualificationOutcome.MISSING_INFORMATION) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_MISSING_INFORMATION', outcome: qual?.outcome || null };
    }
    const open = await getOpenMissingRequirements(pool, caseId);
    if (!open.length) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NO_OPEN_REQUIREMENTS' };
    }

    const { rows: wfs } = await client.query(
      `SELECT id, correlation_id, control_version_at_start
       FROM workflow.workflow_instances
       WHERE case_id = $1 AND workflow_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [caseId, B2B_INBOUND_WORKFLOW_TYPE],
    );
    const wf = wfs[0];
    const conv = await ensureConversation(client, {
      caseId,
      workflowInstanceId: wf?.id || null,
    });
    if (conv.do_not_automatically_contact) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SUPPRESSED' };
    }

    const fp = requirementFingerprint(open);
    await client.query(
      `UPDATE ops.outbound_intents
       SET state = 'CANCELLED_STALE', cancelled_at = now(), updated_at = now(),
           failure_class = 'STALE_AFTER_REVISION'
       WHERE case_id = $1
         AND state IN ('INTENT_CREATED','READY_TO_SEND')
         AND (qualification_revision <> $2 OR requirement_fingerprint <> $3)`,
      [caseId, qual.revision, fp],
    );
    const dthKey = `missing-info/${caseId}/${qual.revision}/${fp}/${purpose}/${followupGeneration}`;
    const existingIntent = await client.query(
      `SELECT * FROM ops.outbound_intents WHERE dth_idempotency_key = $1`,
      [dthKey],
    );
    if (existingIntent.rows[0]) {
      const ex = existingIntent.rows[0];
      await client.query('COMMIT');
      return {
        ok: true,
        duplicate: true,
        alreadySent: ['PROVIDER_ACCEPTED', 'DELIVERED'].includes(ex.state),
        intentId: ex.id,
        conversationId: conv.id,
        state: ex.state,
      };
    }

    const rendered = renderMissingInfoMessage({
      ansprechpartner: contact.ansprechpartner,
      conversationRef: conv.conversation_ref,
      requirements: open,
      isFollowup: purpose === MessagePurpose.MISSING_INFORMATION_FOLLOWUP,
    });

    const { rows: intentRows } = await client.query(
      `INSERT INTO ops.outbound_intents
        (conversation_id, case_id, purpose, state, qualification_revision,
         requirement_ids, requirement_fingerprint, dth_idempotency_key,
         communication_policy_version, template_id, template_version,
         content_hash, subject, body_text, recipient_email_hash,
         recipient_snapshot_redacted, provider_idempotency_key, followup_generation,
         correlation_id)
       VALUES ($1,$2,$3,'INTENT_CREATED',$4,$5::uuid[],$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        conv.id,
        caseId,
        purpose,
        qual.revision,
        open.map((r) => r.id),
        fp,
        dthKey,
        A4_COMMUNICATION_POLICY_VERSION,
        rendered.templateId,
        rendered.templateVersion,
        rendered.contentHash,
        rendered.subject,
        rendered.bodyText,
        hashEmail(contact.email),
        redactEmail(contact.email),
        dthKey.slice(0, 200),
        followupGeneration,
        wf?.correlation_id || null,
      ],
    );
    const intent = intentRows[0];

    await client.query(
      `UPDATE ops.outbound_intents SET state = 'READY_TO_SEND', updated_at = now() WHERE id = $1`,
      [intent.id],
    );

    let sendJobId = null;
    if (wf) {
      const jobKey = `b2b-comm-send:${intent.id}`;
      const ins = await client.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',90,5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
          wf.id,
          B2B_COMMUNICATION_SEND_CAPABILITY,
          jobKey,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({ case_id: caseId, intent_id: intent.id, schema_version: 1 }),
        ],
      );
      sendJobId = ins.rows[0]?.id || null;
    }

    await client.query(
      `INSERT INTO public.audit_events (lead_id, event_type, detail)
       VALUES ($1,'communication.intent_created',$2::jsonb)`,
      [
        contact.leadId,
        JSON.stringify({
          case_id: caseId,
          intent_id: intent.id,
          purpose,
          qualification_revision: qual.revision,
          requirement_count: open.length,
          template_version: rendered.templateVersion,
        }),
      ],
    );

    await client.query('COMMIT');
    return {
      ok: true,
      duplicate: false,
      intentId: intent.id,
      conversationId: conv.id,
      conversationRef: conv.conversation_ref,
      sendJobId,
      qualificationRevision: qual.revision,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function preSendChecks(pool, intent, contact) {
  const reasons = [];
  let snap;
  let mailSnap;
  try {
    snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    mailSnap = await readFreshControlSnapshot(pool, { domain: KillDomain.INTERNAL_MAIL });
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, reasons: ['CONTROL_UNAVAILABLE'], defer: true, qual: null, open: [], conv: null, snap: null };
    }
    throw err;
  }
  if (!snap.mayClaim || snap.globalKillActive) reasons.push('AUTOMATION_BLOCKED');
  if (mailSnap.globalKillActive || mailSnap.domainKillActive) reasons.push('COMMUNICATION_KILL');

  const { rows: takeover } = await pool.query(
    `SELECT 1 FROM security.control_state
     WHERE scope = 'WORKFLOW' AND state = 'TAKEOVER'
       AND scope_key IN (
         SELECT id::text FROM workflow.workflow_instances WHERE case_id = $1
       )
     LIMIT 1`,
    [intent.case_id],
  );
  if (takeover.length) reasons.push('TAKEOVER');

  const qual = await getCurrentQualification(pool, intent.case_id);
  if (!qual) reasons.push('NO_QUALIFICATION');
  else if (isSwitchMessagePurpose(intent.purpose) || isLifecycleMessagePurpose(intent.purpose)) {
    if (qual.outcome !== QualificationOutcome.QUALIFIED_FOR_CALL) {
      reasons.push('NOT_QUALIFIED_FOR_CALL');
    }
  }
  else if (isOfferMessagePurpose(intent.purpose)) {
    if (qual.outcome !== QualificationOutcome.QUALIFIED_FOR_CALL) {
      reasons.push('NOT_QUALIFIED_FOR_CALL');
    }
    const { assertOfferIntentSendable } = await import('../a8/gate.js');
    const offerGate = await assertOfferIntentSendable(pool, intent);
    if (!offerGate.ok) reasons.push(...offerGate.reasons);
  }
  else if (isAppointmentMessagePurpose(intent.purpose)) {
    // Appointment communications require call-ready qualification
    if (qual.outcome !== QualificationOutcome.QUALIFIED_FOR_CALL) {
      reasons.push('NOT_QUALIFIED_FOR_CALL');
    } else if (qual.revision !== intent.qualification_revision) {
      // eligibility may still hold; revision drift alone does not stale appointment mail
      // unless outcome left QUALIFIED_FOR_CALL (handled above)
    }
    if (intent.purpose === MessagePurpose.APPOINTMENT_OFFER) {
      const { rows: sess } = await pool.query(
        `SELECT status FROM ops.booking_sessions
         WHERE case_id=$1 AND offer_intent_id=$2 LIMIT 1`,
        [intent.case_id, intent.id],
      );
      if (sess[0] && !['OPEN', 'PREPARING', 'BOOKING_IN_PROGRESS', 'BOOKED'].includes(sess[0].status)) {
        reasons.push('BOOKING_SESSION_STALE');
      }
      if (sess[0] && sess[0].status === 'BOOKED') {
        reasons.push('ALREADY_BOOKED');
      }
    }
    if (intent.purpose === MessagePurpose.APPOINTMENT_CONFIRMATION || intent.purpose === MessagePurpose.APPOINTMENT_REMINDER) {
      const { rows: appts } = await pool.query(
        `SELECT status FROM ops.appointments
         WHERE case_id=$1 AND status IN ('CONFIRMED','CONFIRMED_MEETING_LINK_PENDING')
         ORDER BY confirmed_at DESC NULLS LAST LIMIT 1`,
        [intent.case_id],
      );
      if (!appts[0] && intent.purpose === MessagePurpose.APPOINTMENT_CONFIRMATION) {
        // confirmation may race slightly after confirm write; allow if intent freshly created
      }
      if (intent.purpose === MessagePurpose.APPOINTMENT_REMINDER) {
        if (!appts[0]) reasons.push('NO_CONFIRMED_APPOINTMENT');
        if (appts[0]?.status === 'CANCELLED') reasons.push('APPOINTMENT_CANCELLED');
      }
    }
  } else if (qual.outcome === QualificationOutcome.QUALIFIED_FOR_CALL) reasons.push('NOW_QUALIFIED');
  else if (qual.revision !== intent.qualification_revision) reasons.push('STALE_REVISION');
  else if (qual.outcome !== QualificationOutcome.MISSING_INFORMATION) reasons.push('NOT_MISSING');

  const skipMissingInfoShape = isAppointmentMessagePurpose(intent.purpose)
    || isOfferMessagePurpose(intent.purpose)
    || isSwitchMessagePurpose(intent.purpose)
    || isLifecycleMessagePurpose(intent.purpose);
  const open = skipMissingInfoShape
    ? []
    : await getOpenMissingRequirements(pool, intent.case_id);
  if (!skipMissingInfoShape) {
    const openIds = new Set(open.map((r) => r.id));
    const bound = intent.requirement_ids || [];
    if (!bound.every((id) => openIds.has(id))) reasons.push('REQUIREMENTS_CHANGED');
    if (requirementFingerprint(open) !== intent.requirement_fingerprint && bound.length) {
      if (open.length !== bound.length || !bound.every((id) => openIds.has(id))) {
        reasons.push('REQUIREMENT_SET_STALE');
      }
    }
  }

  if (!contact?.email) reasons.push('RECIPIENT_MISSING');
  else if (hashEmail(contact.email) !== intent.recipient_email_hash) reasons.push('STALE_RECIPIENT');

  const { rows: convRows } = await pool.query(`SELECT * FROM ops.conversations WHERE id = $1`, [intent.conversation_id]);
  const conv = convRows[0];
  if (conv?.do_not_automatically_contact) reasons.push('SUPPRESSED');

  if (NON_SENDABLE_STATES.has(intent.state)) {
    reasons.push(intent.state === OutboundIntentState.OUTCOME_UNKNOWN ? 'OUTCOME_UNKNOWN' : 'ALREADY_TERMINAL');
  }

  return { ok: reasons.length === 0, reasons, qual, open, conv, snap };
}

/**
 * Execute provider send for READY intent after fresh checks.
 */
export async function executeCommunicationSend(pool, {
  intentId,
  emailProvider = null,
  fromAddress = 'noreply@deintarifheld.invalid',
} = {}) {
  const provider = emailProvider || createMockEmailProvider();
  const { rows } = await pool.query(`SELECT * FROM ops.outbound_intents WHERE id = $1`, [intentId]);
  const intent = rows[0];
  if (!intent) return { ok: false, code: 'INTENT_MISSING' };
  if (NON_SENDABLE_STATES.has(intent.state)) {
    return {
      ok: true,
      cancelled: intent.state === OutboundIntentState.CANCELLED_STALE,
      outcomeUnknown: intent.state === OutboundIntentState.OUTCOME_UNKNOWN
        || intent.state === OutboundIntentState.RECONCILIATION_REQUIRED,
      alreadyTerminal: true,
      providerCalls: 0,
      blindRetry: false,
      code: intent.state,
    };
  }

  const contact = await resolveAuthoritativeContact(pool, intent.case_id);
  const checks = await preSendChecks(pool, intent, contact);
  if (!checks.ok) {
    if (checks.defer || checks.reasons.includes('CONTROL_UNAVAILABLE')) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE', deferred: true, providerCalls: 0 };
    }
    await pool.query(
      `UPDATE ops.outbound_intents
       SET state = 'CANCELLED_STALE', cancelled_at = now(), updated_at = now(),
           failure_class = $2
       WHERE id = $1 AND state IN ('INTENT_CREATED','READY_TO_SEND')`,
      [intentId, checks.reasons.join(',')],
    );
    return { ok: true, cancelled: true, reasons: checks.reasons, providerCalls: 0 };
  }

  // Provider call OUTSIDE long DB transaction
  const sendResult = await provider.sendEmail({
    to: contact.email,
    from: fromAddress,
    subject: intent.subject,
    text: intent.body_text,
    idempotencyKey: intent.provider_idempotency_key || intent.dth_idempotency_key,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (sendResult.class === 'OUTCOME_UNKNOWN') {
      await client.query(
        `UPDATE ops.outbound_intents
         SET state = 'OUTCOME_UNKNOWN', failure_class = $2, updated_at = now()
         WHERE id = $1 AND state IN ('INTENT_CREATED','READY_TO_SEND')`,
        [intentId, sendResult.code || 'OUTCOME_UNKNOWN'],
      );
      await client.query(
        `INSERT INTO public.audit_events (event_type, detail)
         VALUES ('communication.outcome_unknown',$1::jsonb)`,
        [JSON.stringify({ case_id: intent.case_id, intent_id: intent.id })],
      );
      await client.query('COMMIT');
      return { ok: true, outcomeUnknown: true, providerCalls: 1, blindRetry: false };
    }
    if (!sendResult.ok) {
      await client.query(
        `UPDATE ops.outbound_intents
         SET state = 'FAILED', failure_class = $2, updated_at = now()
         WHERE id = $1`,
        [intentId, sendResult.code || 'FAILED'],
      );
      await client.query('COMMIT');
      return { ok: false, code: sendResult.code, providerCalls: 1 };
    }

    await client.query(
      `UPDATE ops.outbound_intents
       SET state = 'PROVIDER_ACCEPTED', provider_message_id = $2, sent_at = now(), updated_at = now()
       WHERE id = $1`,
      [intentId, sendResult.providerMessageId],
    );
    await client.query(
      `INSERT INTO ops.communication_messages
        (conversation_id, case_id, direction, message_type, outbound_intent_id,
         provider_message_id, subject, body_text, content_hash, qualification_revision)
       VALUES ($1,$2,'OUTBOUND',$3,$4,$5,$6,$7,$8,$9)`,
      [
        intent.conversation_id,
        intent.case_id,
        intent.purpose,
        intent.id,
        sendResult.providerMessageId,
        intent.subject,
        intent.body_text,
        intent.content_hash,
        intent.qualification_revision,
      ],
    );
    await client.query(
      `UPDATE ops.conversations
       SET last_message_at = now(), updated_at = now(),
           status = CASE WHEN $2 THEN status ELSE 'WAITING_CUSTOMER' END
       WHERE id = $1`,
      [intent.conversation_id, isAppointmentMessagePurpose(intent.purpose) || isOfferMessagePurpose(intent.purpose) || isSwitchMessagePurpose(intent.purpose) || isLifecycleMessagePurpose(intent.purpose)],
    );
    if (isOfferMessagePurpose(intent.purpose)) {
      const { markOfferSentIfProviderAccepted } = await import('../a8/gate.js');
      await markOfferSentIfProviderAccepted(client, intent);
    }
    if (!isAppointmentMessagePurpose(intent.purpose) && !isOfferMessagePurpose(intent.purpose) && !isSwitchMessagePurpose(intent.purpose) && !isLifecycleMessagePurpose(intent.purpose)) {
      await client.query(
        `UPDATE workflow.workflow_instances
         SET current_state = 'WAITING_CUSTOMER_RESPONSE', updated_at = now()
         WHERE case_id = $1 AND workflow_type = $2 AND status = 'RUNNING'`,
        [intent.case_id, B2B_INBOUND_WORKFLOW_TYPE],
      );

      // Missing-info follow-up only — never for appointment purposes
      const due = new Date(Date.now() + A4_TEST_FOLLOWUP_DELAY_MS).toISOString();
      const gen = (checks.conv.followup_count || 0) + 1;
      if (gen <= (checks.conv.max_followups || A4_DEFAULT_MAX_FOLLOWUPS)) {
        const fKey = `b2b-followup:${intent.conversation_id}:${gen}`;
        await client.query(
          `INSERT INTO ops.followup_schedules
            (conversation_id, case_id, outbound_intent_id, generation, due_at, job_idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (conversation_id, generation) DO NOTHING`,
          [intent.conversation_id, intent.case_id, intent.id, gen, due, fKey],
        );
        const { rows: wfs } = await client.query(
          `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
           WHERE case_id = $1 AND workflow_type = $2 ORDER BY created_at DESC LIMIT 1`,
          [intent.case_id, B2B_INBOUND_WORKFLOW_TYPE],
        );
        if (wfs[0]) {
          await client.query(
            `INSERT INTO workflow.jobs
              (workflow_instance_id, job_type, status, priority, scheduled_at, max_attempts,
               idempotency_key, correlation_id, control_version, payload_redacted)
             VALUES ($1,$2,'READY',80,$3,5,$4,$5,$6,$7::jsonb)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              wfs[0].id,
              B2B_MISSING_INFO_FOLLOWUP_CAPABILITY,
              due,
              fKey,
              wfs[0].correlation_id,
              wfs[0].control_version_at_start || 1,
              JSON.stringify({
                case_id: intent.case_id,
                conversation_id: intent.conversation_id,
                generation: gen,
                schema_version: 1,
              }),
            ],
          );
        }
        await client.query(
          `UPDATE ops.conversations SET followup_count = $2, updated_at = now() WHERE id = $1`,
          [intent.conversation_id, gen],
        );
      }
    }

    await client.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('communication.provider_accepted',$1::jsonb)`,
      [JSON.stringify({ case_id: intent.case_id, intent_id: intent.id, purpose: intent.purpose })],
    );
    await client.query('COMMIT');
    return { ok: true, providerAccepted: true, providerMessageId: sendResult.providerMessageId, providerCalls: 1 };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelFollowupsForConversation(pool, conversationId, status) {
  await pool.query(
    `UPDATE ops.followup_schedules
     SET status = $2, cancelled_at = now()
     WHERE conversation_id = $1 AND status = 'SCHEDULED'`,
    [conversationId, status],
  );
  // Cancel pending follow-up jobs by matching idempotency prefix
  await pool.query(
    `UPDATE workflow.jobs
     SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
     WHERE job_type = $1
       AND status IN ('READY','RETRY_SCHEDULED')
       AND payload_redacted->>'conversation_id' = $2`,
    [B2B_MISSING_INFO_FOLLOWUP_CAPABILITY, String(conversationId)],
  );
}

export async function executeFollowupDue(pool, { caseId, conversationId, generation, emailProvider }) {
  const { rows: convRows } = await pool.query(`SELECT * FROM ops.conversations WHERE id = $1`, [conversationId]);
  const conv = convRows[0];
  if (!conv) return { ok: false, code: 'CONVERSATION_MISSING' };

  const { rows: sched } = await pool.query(
    `SELECT * FROM ops.followup_schedules WHERE conversation_id = $1 AND generation = $2`,
    [conversationId, generation],
  );
  const schedule = sched[0];
  if (!schedule || schedule.status !== 'SCHEDULED') {
    return { ok: true, noop: true, code: 'FOLLOWUP_NOT_ACTIVE' };
  }

  const qual = await getCurrentQualification(pool, caseId);
  if (qual?.outcome === QualificationOutcome.QUALIFIED_FOR_CALL) {
    await cancelFollowupsForConversation(pool, conversationId, FollowupStatus.CANCELLED_QUALIFIED);
    return { ok: true, cancelled: true, code: 'NOW_QUALIFIED', providerCalls: 0 };
  }
  // Any inbound correlated since?
  const { rows: inbound } = await pool.query(
    `SELECT 1 FROM ops.inbound_events
     WHERE conversation_id = $1 AND status IN ('CORRELATED','INTERPRETED','PROCESSED')
     LIMIT 1`,
    [conversationId],
  );
  if (inbound.length) {
    await cancelFollowupsForConversation(pool, conversationId, FollowupStatus.CANCELLED_REPLY);
    return { ok: true, cancelled: true, code: 'REPLY_RECEIVED', providerCalls: 0 };
  }
  if (generation > (conv.max_followups || A4_DEFAULT_MAX_FOLLOWUPS)) {
    await pool.query(
      `UPDATE ops.followup_schedules SET status = 'CANCELLED_MAX', cancelled_at = now() WHERE id = $1`,
      [schedule.id],
    );
    return { ok: true, cancelled: true, code: 'MAX_FOLLOWUPS', providerCalls: 0 };
  }

  const prep = await prepareMissingInfoCommunication(pool, {
    caseId,
    purpose: MessagePurpose.MISSING_INFORMATION_FOLLOWUP,
    followupGeneration: generation,
  });
  if (!prep.ok) {
    await pool.query(
      `UPDATE ops.followup_schedules SET status = 'CANCELLED_STALE', cancelled_at = now() WHERE id = $1`,
      [schedule.id],
    );
    return { ok: true, cancelled: true, code: prep.code, providerCalls: 0 };
  }
  const sent = await executeCommunicationSend(pool, { intentId: prep.intentId, emailProvider });
  if (sent.providerAccepted) {
    await pool.query(
      `UPDATE ops.followup_schedules SET status = 'SENT' WHERE id = $1`,
      [schedule.id],
    );
  }
  return { ok: true, prep, sent, providerCalls: sent.providerCalls || 0 };
}

/**
 * Thin webhook accept: verify + durable inbound event + A1 job. No deep processing.
 */
export async function acceptInboundWebhook(pool, {
  rawBody,
  headers,
  webhookSecret,
  emailProvider = null,
  enqueueJob = true,
}) {
  const provider = emailProvider || createMockEmailProvider();
  let parsed;
  try {
    parsed = provider.verifyWebhook({ payload: rawBody, headers, webhookSecret });
  } catch {
    return { ok: false, httpStatus: 400, code: 'INVALID_SIGNATURE', businessEffects: 0 };
  }

  const type = parsed.type || parsed.event_type;
  const data = parsed.data || {};
  const providerEventId = headers.id || headers['svix-id'] || parsed.id || `${type}:${data.email_id}`;
  const providerEmailId = data.email_id;
  if (!providerEmailId) {
    return { ok: false, httpStatus: 400, code: 'EMAIL_ID_MISSING', businessEffects: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id FROM ops.inbound_events WHERE provider_event_id = $1`,
      [String(providerEventId)],
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return { ok: true, duplicate: true, inboundEventId: existing.rows[0].id, httpStatus: 200 };
    }

    const attachments = Array.isArray(data.attachments) ? data.attachments.length : 0;
    const { rows } = await client.query(
      `INSERT INTO ops.inbound_events
        (provider_event_id, provider_email_id, message_id_header, from_address,
         to_addresses, subject, attachment_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'RECEIVED')
       RETURNING *`,
      [
        String(providerEventId),
        String(providerEmailId),
        data.message_id || null,
        data.from || null,
        data.to || [],
        data.subject || null,
        attachments,
      ],
    );
    const inbound = rows[0];
    await client.query(
      `INSERT INTO ops.provider_events
        (provider_event_id, event_type, provider_message_id, inbound_event_id, payload_redacted, precedence)
       VALUES ($1,$2,$3,$4,$5::jsonb,0)
       ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [
        String(providerEventId),
        String(type || 'email.received'),
        String(providerEmailId),
        inbound.id,
        JSON.stringify({ type, has_attachments: attachments > 0 }),
      ],
    );

    if (enqueueJob) {
      // Attach to any running B2B workflow for the matching conversation later; use a system workflow if needed.
      // Prefer: find conversation by ref in subject after retrieve. For job routing, enqueue on first open waiting workflow via case unknown — store job without case by creating on a synthetic path:
      // We enqueue processing job once we can bind case; here we store intent in inbound and create job when correlated.
      // For A1: create job on ALL waiting conversations is wrong. Instead store pending and use a global processing via first workflow found by email_id in handler scanning.
      // Practical approach: insert job into any RUNNING B2B workflow is unsafe. Use dedicated: look up by conversation ref in subject metadata if present.
      const subject = String(data.subject || '');
      const refMatch = subject.match(/\[DTH-([A-Z0-9]{6})\]/i);
      let wf = null;
      if (refMatch) {
        const { rows: convs } = await client.query(
          `SELECT c.*, w.id AS workflow_id, w.correlation_id, w.control_version_at_start
           FROM ops.conversations c
           LEFT JOIN workflow.workflow_instances w ON w.id = c.workflow_instance_id
           WHERE c.conversation_ref = $1`,
          [refMatch[1].toUpperCase()],
        );
        if (convs[0]?.workflow_id) {
          wf = convs[0];
          await client.query(
            `UPDATE ops.inbound_events SET conversation_id = $2, case_id = $3 WHERE id = $1`,
            [inbound.id, convs[0].id, convs[0].case_id],
          );
        }
      }
      if (wf?.workflow_id) {
        await client.query(
          `INSERT INTO workflow.jobs
            (workflow_instance_id, job_type, status, priority, max_attempts,
             idempotency_key, correlation_id, control_version, payload_redacted)
           VALUES ($1,$2,'READY',95,5,$3,$4,$5,$6::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            wf.workflow_id,
            B2B_INBOUND_EMAIL_PROCESS_CAPABILITY,
            `b2b-inbound:${providerEventId}`,
            wf.correlation_id,
            wf.control_version_at_start || 1,
            JSON.stringify({ inbound_event_id: inbound.id, provider_email_id: providerEmailId, schema_version: 1 }),
          ],
        );
      } else {
        // Unmatched at webhook time — still durable; processing job created against a placeholder by scanning in tests via processInboundEvent directly.
        await client.query(
          `UPDATE ops.inbound_events SET status = 'UNMATCHED' WHERE id = $1`,
          [inbound.id],
        );
      }
    }

    await client.query('COMMIT');
    return { ok: true, inboundEventId: inbound.id, httpStatus: 200, duplicate: false };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function processInboundEvent(pool, {
  inboundEventId,
  emailProvider = null,
}) {
  const provider = emailProvider || createMockEmailProvider();
  const { rows } = await pool.query(`SELECT * FROM ops.inbound_events WHERE id = $1`, [inboundEventId]);
  const inbound = rows[0];
  if (!inbound) return { ok: false, code: 'INBOUND_MISSING' };
  if (inbound.status === 'PROCESSED') return { ok: true, duplicate: true };

  const retrieved = await provider.retrieveReceivedEmail(inbound.provider_email_id);
  if (!retrieved.ok) {
    if (retrieved.transient) return { ok: false, retry: true, code: retrieved.code };
    await pool.query(
      `UPDATE ops.inbound_events SET status = 'FAILED_PERMANENT', error_code = $2 WHERE id = $1`,
      [inboundEventId, retrieved.code],
    );
    return { ok: false, permanent: true, code: retrieved.code };
  }

  const email = retrieved.email;
  const text = String(email.text || htmlToBoundedText(email.html) || '').slice(0, 20000);
  const subject = email.subject || inbound.subject || '';
  const from = String(email.from || inbound.from_address || '').toLowerCase();

  // Strong correlation via conversation ref
  const refMatch = String(subject + '\n' + text).match(/\[DTH-([A-Z0-9]{6})\]/i);
  let conv = null;
  if (refMatch) {
    const { rows: convs } = await pool.query(
      `SELECT * FROM ops.conversations WHERE conversation_ref = $1`,
      [refMatch[1].toUpperCase()],
    );
    conv = convs[0] || null;
  }

  if (!conv) {
    await pool.query(
      `UPDATE ops.inbound_events
       SET status = 'UNMATCHED', body_text = $2, processed_at = now()
       WHERE id = $1`,
      [inboundEventId, text.slice(0, 5000)],
    );
    return { ok: true, unmatched: true, observations: 0 };
  }

  const contact = await resolveAuthoritativeContact(pool, conv.case_id);
  if (contact?.email && from && !from.includes(contact.email) && contact.email !== from) {
    // Wrong sender with strong token
    await pool.query(
      `UPDATE ops.inbound_events
       SET status = 'CORRELATION_REVIEW', conversation_id = $2, case_id = $3,
           correlation_tier = 'STRONG_WRONG_SENDER', body_text = $4, processed_at = now()
       WHERE id = $1`,
      [inboundEventId, conv.id, conv.case_id, text.slice(0, 5000)],
    );
    return { ok: true, wrongSender: true, observations: 0 };
  }

  const open = await getOpenMissingRequirements(pool, conv.case_id);
  const expectedFields = open.map((r) => r.field_code);
  const interpretation = interpretMissingInfoReply({
    text,
    subject,
    headers: email.headers || {},
    expectedFields,
  });

  if (interpretation.automatedReply) {
    await pool.query(
      `UPDATE ops.inbound_events
       SET status = 'PROCESSED', automated_reply = true, conversation_id = $2, case_id = $3,
           body_text = $4, interpretation_json = $5::jsonb, processed_at = now()
       WHERE id = $1`,
      [inboundEventId, conv.id, conv.case_id, text.slice(0, 5000), JSON.stringify(interpretation)],
    );
    return { ok: true, automatedReply: true, observations: 0 };
  }

  if (interpretation.requiresHumanReview && interpretation.candidates.length === 0) {
    await pool.query(
      `UPDATE ops.inbound_events
       SET status = 'HUMAN_REVIEW', conversation_id = $2, case_id = $3,
           body_text = $4, interpretation_json = $5::jsonb, processed_at = now()
       WHERE id = $1`,
      [inboundEventId, conv.id, conv.case_id, text.slice(0, 5000), JSON.stringify(interpretation)],
    );
    await pool.query(
      `UPDATE ops.conversations SET status = 'HUMAN_REVIEW', updated_at = now() WHERE id = $1`,
      [conv.id],
    );
    return { ok: true, humanReview: true, observations: 0 };
  }

  let obsCount = 0;
  for (const c of interpretation.candidates) {
    const applied = await applyQualificationObservation(pool, {
      caseId: conv.case_id,
      fieldCode: c.fieldCode,
      value: c.rawCandidateValue,
      sourceKind: ObservationSourceKind.CUSTOMER_REPLY,
      sourceRef: `inbound:${inboundEventId}`,
      idempotencyKey: `inbound-obs:${inboundEventId}:${c.fieldCode}`,
      enqueueReevaluate: false,
    });
    if (applied.ok) obsCount += 1;
  }

  await evaluateQualification(pool, { caseId: conv.case_id, trigger: 'REEVALUATE' });
  await cancelFollowupsForConversation(pool, conv.id, FollowupStatus.CANCELLED_REPLY);

  const qual = await getCurrentQualification(pool, conv.case_id);
  if (qual?.outcome === QualificationOutcome.QUALIFIED_FOR_CALL) {
    await pool.query(
      `UPDATE ops.conversations SET status = 'QUALIFIED', updated_at = now() WHERE id = $1`,
      [conv.id],
    );
    // A5 handoff placeholder job
    const { rows: wfs } = await pool.query(
      `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
       WHERE case_id = $1 AND workflow_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [conv.case_id, B2B_INBOUND_WORKFLOW_TYPE],
    );
    if (wfs[0]) {
      await pool.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',70,5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          wfs[0].id,
          B2B_APPOINTMENT_OFFER_PREPARE_CAPABILITY,
          `a5-appt-prepare:${conv.case_id}:${qual.revision}`,
          wfs[0].correlation_id,
          wfs[0].control_version_at_start || 1,
          JSON.stringify({ case_id: conv.case_id, schema_version: 1, handoff: 'A4_TO_A5' }),
        ],
      );
    }
  } else if (qual?.outcome === QualificationOutcome.MISSING_INFORMATION) {
    // Prepare next missing-info communication for new revision
    await prepareMissingInfoCommunication(pool, { caseId: conv.case_id });
  }

  await pool.query(
    `INSERT INTO ops.communication_messages
      (conversation_id, case_id, direction, message_type, provider_message_id, subject, body_text,
       attachment_present, attachment_count)
     VALUES ($1,$2,'INBOUND','CUSTOMER_REPLY',$3,$4,$5,$6,$7)`,
    [
      conv.id,
      conv.case_id,
      inbound.provider_email_id,
      subject,
      text.slice(0, 5000),
      (inbound.attachment_count || 0) > 0,
      inbound.attachment_count || 0,
    ],
  );

  await pool.query(
    `UPDATE ops.inbound_events
     SET status = 'PROCESSED', conversation_id = $2, case_id = $3, correlation_tier = 'STRONG',
         body_text = $4, interpretation_json = $5::jsonb, processed_at = now()
     WHERE id = $1`,
    [inboundEventId, conv.id, conv.case_id, text.slice(0, 5000), JSON.stringify(interpretation)],
  );

  return {
    ok: true,
    observations: obsCount,
    outcome: qual?.outcome || null,
    injectionAttempt: interpretation.injectionAttempt === true,
  };
}

export async function applyProviderDeliveryEvent(pool, {
  providerEventId,
  eventType,
  providerMessageId,
}) {
  const precedence = PROVIDER_EVENT_PRECEDENCE[eventType] || 0;
  const { rows: intents } = await pool.query(
    `SELECT * FROM ops.outbound_intents WHERE provider_message_id = $1`,
    [providerMessageId],
  );
  const intent = intents[0];
  if (!intent) return { ok: false, code: 'INTENT_NOT_FOUND' };

  await pool.query(
    `INSERT INTO ops.provider_events
      (provider_event_id, event_type, provider_message_id, outbound_intent_id, precedence)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider, provider_event_id) DO NOTHING`,
    [providerEventId, eventType, providerMessageId, intent.id, precedence],
  );

  const currentPrec = PROVIDER_EVENT_PRECEDENCE[
    intent.state === 'DELIVERED' ? 'delivered' : intent.state === 'BOUNCED' ? 'bounced' : 'sent'
  ] || 0;
  if (precedence < currentPrec) return { ok: true, ignored: true, reason: 'OUT_OF_ORDER' };

  if (eventType === 'delivered') {
    await pool.query(
      `UPDATE ops.outbound_intents SET state = 'DELIVERED', updated_at = now() WHERE id = $1`,
      [intent.id],
    );
  } else if (eventType === 'bounced' || eventType === 'failed') {
    await pool.query(
      `UPDATE ops.outbound_intents SET state = 'BOUNCED', updated_at = now() WHERE id = $1`,
      [intent.id],
    );
    await cancelFollowupsForConversation(pool, intent.conversation_id, FollowupStatus.CANCELLED_BOUNCE);
  }
  return { ok: true };
}
