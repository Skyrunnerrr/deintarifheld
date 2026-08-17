/**
 * DTH-A5 appointment booking domain.
 * Durable intent before provider. No blind unknown retry. Token = hash only.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  AppointmentPurpose,
  AppointmentStatus,
  BookingSessionStatus,
  ConferenceStatus,
  ReminderStatus,
  TEST_APPOINTMENT_POLICY_V1,
  A5_APPOINTMENT_POLICY_VERSION,
  A5_CALENDAR_RESOURCE_DEFAULT,
  A5_PROVIDER_TEST,
  APPOINTMENT_BOOK_SELECTED_SLOT_CAPABILITY,
  APPOINTMENT_RECONCILE_CAPABILITY,
  APPOINTMENT_REMINDER_DUE_CAPABILITY,
  APPOINTMENT_SESSION_EXPIRE_CAPABILITY,
  MessagePurpose,
  QualificationOutcome,
  KillDomain,
  B2B_INBOUND_WORKFLOW_TYPE,
  B2B_COMMUNICATION_SEND_CAPABILITY,
  eligibilityFingerprint,
} from '@deintarifheld/shared';
import { getCurrentQualification, getOpenMissingRequirements } from '../a3/evaluate.js';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { hashEmail, redactEmail } from '../a4/provider.js';
import { createTestCalendarProvider } from './provider.js';
import { generateCandidateSlots } from './slots.js';
import { formatInTimeZone } from './timezone.js';
import { renderAppointmentMessage } from './templates.js';

function makeBookingRef() {
  return randomBytes(4).toString('hex').toUpperCase();
}

function mintToken() {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

async function resolveContact(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.source_lead_id, c.status AS case_status,
            l.email, l.firma, l.payload, l.lead_type
     FROM public.cases c
     JOIN public.leads l ON l.id = c.source_lead_id
     WHERE c.id = $1 AND c.deleted_at IS NULL AND l.deleted_at IS NULL`,
    [caseId],
  );
  const row = rows[0];
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    caseId: row.id,
    leadId: row.source_lead_id,
    email: String(row.email || payload.email || '').trim().toLowerCase(),
    ansprechpartner: String(payload.ansprechpartner || '').trim(),
    firma: row.firma,
  };
}

async function loadWorkflow(client, caseId) {
  const { rows } = await client.query(
    `SELECT id, correlation_id, control_version_at_start, status
     FROM workflow.workflow_instances
     WHERE case_id = $1 AND workflow_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [caseId, B2B_INBOUND_WORKFLOW_TYPE],
  );
  return rows[0] || null;
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

async function calendarControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.AUTOMATION_ENGINE });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return { ok: false, code: snap.globalKillActive ? 'GLOBAL_KILL' : 'CALENDAR_DOMAIN_KILL', snap };
    }
    const mailSnap = await readFreshControlSnapshot(pool, { domain: KillDomain.INTERNAL_MAIL });
    return { ok: true, snap, mailSnap };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}

async function hasTakeover(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM security.control_state
     WHERE scope = 'WORKFLOW' AND state = 'TAKEOVER'
       AND scope_key IN (SELECT id::text FROM workflow.workflow_instances WHERE case_id = $1)
     LIMIT 1`,
    [caseId],
  );
  return rows.length > 0;
}

async function assertCallReady(pool, caseId) {
  const qual = await getCurrentQualification(pool, caseId);
  if (!qual || qual.outcome !== QualificationOutcome.QUALIFIED_FOR_CALL) {
    return { ok: false, code: 'NOT_QUALIFIED_FOR_CALL', qual };
  }
  const open = await getOpenMissingRequirements(pool, caseId);
  if (open.length) return { ok: false, code: 'OPEN_REQUIREMENTS', qual, open };
  return { ok: true, qual };
}

/**
 * Prepare appointment offer: booking session + slots + A4 APPOINTMENT_OFFER intent.
 */
export async function prepareAppointmentOffer(pool, {
  caseId,
  policy = TEST_APPOINTMENT_POLICY_V1,
  calendarProvider = null,
  now = new Date(),
} = {}) {
  const provider = calendarProvider || createTestCalendarProvider();
  const gate = await calendarControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };

  const ready = await assertCallReady(pool, caseId);
  if (!ready.ok) return { ok: false, code: ready.code, providerCalls: 0 };

  if (await hasTakeover(pool, caseId)) {
    return { ok: false, code: 'TAKEOVER', providerCalls: 0 };
  }

  const contact = await resolveContact(pool, caseId);
  if (!contact?.email) return { ok: false, code: 'RECIPIENT_UNRESOLVED', providerCalls: 0 };

  const resourceId = policy.calendarResourceId || A5_CALENDAR_RESOURCE_DEFAULT;
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + policy.bookingHorizonMs);
  const avail = await provider.getAvailability({
    resourceId,
    rangeStartUtc: rangeStart.toISOString(),
    rangeEndUtc: rangeEnd.toISOString(),
    timezone: policy.timezone,
  });
  if (!avail.ok) return { ok: false, code: 'NO_AVAILABLE_PROVIDER_DATA', providerCalls: 0 };

  const { rows: dthAppts } = await pool.query(
    `SELECT start_at_utc, end_at_utc FROM ops.appointments
     WHERE calendar_resource_id = $1
       AND status IN ('CONFIRMED','CONFIRMED_MEETING_LINK_PENDING','PENDING_PROVIDER','OUTCOME_UNKNOWN','RESCHEDULE_PENDING')`,
    [resourceId],
  );
  const slots = generateCandidateSlots({
    policy,
    now,
    busyPeriods: avail.busyPeriods || [],
    dthAppointments: dthAppts,
  });
  if (!slots.length) return { ok: false, code: 'NO_AVAILABLE_SLOTS', providerCalls: 0 };

  const fp = eligibilityFingerprint({
    outcome: ready.qual.outcome,
    purpose: AppointmentPurpose.INITIAL_B2B_CONSULTATION,
    policyVersion: policy.version,
    resourceId,
  });

  const client = await pool.connect();
  let rawToken = null;
  try {
    await client.query('BEGIN');
    // cancel stale missing-info follow-ups
    await client.query(
      `UPDATE ops.followup_schedules SET status='CANCELLED_QUALIFIED', cancelled_at=now()
       WHERE case_id=$1 AND status='SCHEDULED'`,
      [caseId],
    );
    await client.query(
      `UPDATE ops.outbound_intents SET state='CANCELLED_STALE', cancelled_at=now(), updated_at=now()
       WHERE case_id=$1 AND purpose IN ('MISSING_INFORMATION_REQUEST','MISSING_INFORMATION_FOLLOWUP')
         AND state IN ('INTENT_CREATED','READY_TO_SEND')`,
      [caseId],
    );

    // reuse open session with same fingerprint
    const existing = await client.query(
      `SELECT * FROM ops.booking_sessions
       WHERE case_id=$1 AND purpose=$2 AND status IN ('PREPARING','OPEN')
       ORDER BY created_at DESC LIMIT 1`,
      [caseId, AppointmentPurpose.INITIAL_B2B_CONSULTATION],
    );
    if (existing.rows[0] && existing.rows[0].eligibility_fingerprint === fp) {
      await client.query('COMMIT');
      return {
        ok: true,
        duplicate: true,
        sessionId: existing.rows[0].id,
        bookingRef: existing.rows[0].booking_ref,
        token: null, // raw token only on create
      };
    }
    // supersede older open sessions
    await client.query(
      `UPDATE ops.booking_sessions SET status='SUPERSEDED', updated_at=now()
       WHERE case_id=$1 AND purpose=$2 AND status IN ('PREPARING','OPEN')`,
      [caseId, AppointmentPurpose.INITIAL_B2B_CONSULTATION],
    );

    const wf = await loadWorkflow(client, caseId);
    const { token, tokenHash } = mintToken();
    rawToken = token;
    const bookingRef = makeBookingRef();
    const expiresAt = new Date(now.getTime() + policy.bookingLinkExpiryMs).toISOString();
    const { rows: sessRows } = await client.query(
      `INSERT INTO ops.booking_sessions
        (case_id, workflow_instance_id, purpose, status, booking_ref, token_hash,
         eligibility_fingerprint, appointment_policy_version, calendar_resource_id,
         slot_generation, expires_at)
       VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7,$8,1,$9)
       RETURNING *`,
      [
        caseId,
        wf?.id || null,
        AppointmentPurpose.INITIAL_B2B_CONSULTATION,
        bookingRef,
        tokenHash,
        fp,
        policy.version || A5_APPOINTMENT_POLICY_VERSION,
        resourceId,
        expiresAt,
      ],
    );
    const session = sessRows[0];

    let order = 0;
    for (const s of slots) {
      order += 1;
      await client.query(
        `INSERT INTO ops.booking_slots
          (booking_session_id, generation, start_at_utc, end_at_utc, timezone, sort_order)
         VALUES ($1,1,$2,$3,$4,$5)`,
        [session.id, s.startAtUtc, s.endAtUtc, s.timezone, order],
      );
    }

    const conv = await ensureConversation(client, { caseId, workflowInstanceId: wf?.id || null });
    if (conv.do_not_automatically_contact) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SUPPRESSED', providerCalls: 0 };
    }

    const bookingUrl = `https://booking.deintarifheld.invalid/buchen?t=${token}`;
    const rendered = renderAppointmentMessage({
      purpose: MessagePurpose.APPOINTMENT_OFFER,
      ansprechpartner: contact.ansprechpartner,
      bookingUrl,
      bookingRef,
      timezone: policy.timezone,
      durationMinutes: policy.durationMinutes,
    });
    const dthKey = `appointment-offer/${caseId}/${fp}/${session.id}`;
    const { rows: intentRows } = await client.query(
      `INSERT INTO ops.outbound_intents
        (conversation_id, case_id, purpose, state, qualification_revision,
         requirement_ids, requirement_fingerprint, dth_idempotency_key,
         communication_policy_version, template_id, template_version,
         content_hash, subject, body_text, recipient_email_hash,
         recipient_snapshot_redacted, provider_idempotency_key, followup_generation,
         correlation_id)
       VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,0,$15)
       RETURNING *`,
      [
        conv.id,
        caseId,
        MessagePurpose.APPOINTMENT_OFFER,
        ready.qual.revision,
        `appointment:${session.id}`,
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
    const intent = intentRows[0];
    await client.query(
      `UPDATE ops.booking_sessions SET offer_intent_id=$2, updated_at=now() WHERE id=$1`,
      [session.id, intent.id],
    );

    if (wf) {
      await client.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',90,5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          wf.id,
          B2B_COMMUNICATION_SEND_CAPABILITY,
          `b2b-appt-offer-send:${intent.id}`,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({ case_id: caseId, intent_id: intent.id, schema_version: 1 }),
        ],
      );
      const expireJobKey = `b2b-appt-session-expire:${session.id}`;
      await client.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, scheduled_at, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',70,$3,3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          wf.id,
          APPOINTMENT_SESSION_EXPIRE_CAPABILITY,
          expiresAt,
          expireJobKey,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({ case_id: caseId, session_id: session.id, schema_version: 1 }),
        ],
      );
      await client.query(
        `UPDATE workflow.workflow_instances
         SET current_state='APPOINTMENT_OFFER_PREPARED', updated_at=now()
         WHERE id=$1`,
        [wf.id],
      );
    }

    await client.query(
      `INSERT INTO public.audit_events (lead_id, event_type, detail)
       VALUES ($1,'appointment.offer_prepared',$2::jsonb)`,
      [
        contact.leadId,
        JSON.stringify({
          case_id: caseId,
          session_id: session.id,
          slot_count: slots.length,
          intent_id: intent.id,
        }),
      ],
    );
    await client.query('COMMIT');
    return {
      ok: true,
      sessionId: session.id,
      bookingRef,
      token: rawToken,
      intentId: intent.id,
      slotCount: slots.length,
      expiresAt,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function getBookingSessionByToken(pool, token) {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT * FROM ops.booking_sessions WHERE token_hash=$1`,
    [tokenHash],
  );
  return rows[0] || null;
}

export async function listSessionSlots(pool, sessionId, { generation = null } = {}) {
  const sess = (await pool.query(`SELECT * FROM ops.booking_sessions WHERE id=$1`, [sessionId])).rows[0];
  if (!sess) return [];
  const gen = generation ?? sess.slot_generation;
  const { rows } = await pool.query(
    `SELECT id, start_at_utc, end_at_utc, timezone, sort_order, is_stale, generation
     FROM ops.booking_slots
     WHERE booking_session_id=$1 AND generation=$2 AND is_stale=false
     ORDER BY sort_order ASC, start_at_utc ASC`,
    [sessionId, gen],
  );
  return rows;
}

/**
 * Public booking view — no Case/Lead IDs in response.
 */
export async function getPublicBookingView(pool, token, { now = new Date() } = {}) {
  const session = await getBookingSessionByToken(pool, token);
  if (!session) return { ok: false, code: 'INVALID_TOKEN' };
  if (session.status === BookingSessionStatus.BOOKED) {
    return { ok: true, status: 'BOOKED', bookingRef: session.booking_ref };
  }
  if (session.status === BookingSessionStatus.SUPERSEDED) {
    return { ok: false, code: 'SUPERSEDED_TOKEN' };
  }
  if (session.status === BookingSessionStatus.EXPIRED || new Date(session.expires_at) <= now) {
    if (session.status !== BookingSessionStatus.EXPIRED) {
      await pool.query(`UPDATE ops.booking_sessions SET status='EXPIRED', updated_at=now() WHERE id=$1 AND status='OPEN'`, [session.id]);
    }
    return { ok: false, code: 'EXPIRED_TOKEN' };
  }
  if (session.status !== BookingSessionStatus.OPEN) {
    return { ok: false, code: 'SESSION_NOT_OPEN', status: session.status };
  }
  const slots = await listSessionSlots(pool, session.id);
  return {
    ok: true,
    status: 'OPEN',
    bookingRef: session.booking_ref,
    purpose: 'Erstberatung',
    timezone: TEST_APPOINTMENT_POLICY_V1.timezone,
    slots: slots.map((s) => ({
      slotId: s.id,
      startLabel: formatInTimeZone(s.start_at_utc, s.timezone),
      timezone: s.timezone,
    })),
  };
}

/**
 * Customer selects opaque slot_id. Creates durable booking intent + A1 job.
 * No provider call here.
 */
export async function submitSlotSelection(pool, {
  token,
  slotId,
  now = new Date(),
} = {}) {
  if (!token || !slotId) return { ok: false, code: 'INVALID_INPUT', providerCalls: 0 };
  const session = await getBookingSessionByToken(pool, token);
  if (!session) return { ok: false, code: 'INVALID_TOKEN', providerCalls: 0 };
  if (session.status === BookingSessionStatus.BOOKED) {
    return { ok: true, duplicate: true, alreadyBooked: true, appointmentId: session.appointment_id, providerCalls: 0 };
  }
  if (session.status === BookingSessionStatus.SUPERSEDED) {
    return { ok: false, code: 'SUPERSEDED_TOKEN', providerCalls: 0 };
  }
  if (session.status === BookingSessionStatus.EXPIRED || new Date(session.expires_at) <= now) {
    return { ok: false, code: 'EXPIRED_TOKEN', providerCalls: 0 };
  }
  if (session.status === BookingSessionStatus.BOOKING_IN_PROGRESS && session.selected_slot_id) {
    // idempotent double-click
    return { ok: true, duplicate: true, sessionId: session.id, selectedSlotId: session.selected_slot_id, providerCalls: 0 };
  }
  if (session.status !== BookingSessionStatus.OPEN) {
    return { ok: false, code: 'SESSION_NOT_OPEN', providerCalls: 0 };
  }

  const gate = await calendarControlGate(pool);
  if (!gate.ok) {
    return { ok: false, code: gate.code === 'GLOBAL_KILL' || gate.code === 'CALENDAR_DOMAIN_KILL' ? 'BOOKING_PAUSED' : gate.code, providerCalls: 0 };
  }
  if (await hasTakeover(pool, session.case_id)) {
    return { ok: false, code: 'TAKEOVER', providerCalls: 0 };
  }
  const ready = await assertCallReady(pool, session.case_id);
  if (!ready.ok) return { ok: false, code: ready.code, providerCalls: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // advisory lock per resource
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [session.calendar_resource_id]);

    const slotRes = await client.query(
      `SELECT * FROM ops.booking_slots WHERE id=$1 AND booking_session_id=$2`,
      [slotId, session.id],
    );
    const slot = slotRes.rows[0];
    if (!slot || slot.is_stale || slot.generation !== session.slot_generation) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STALE_SLOT', providerCalls: 0 };
    }

    const claim = await client.query(
      `UPDATE ops.booking_sessions
       SET status='BOOKING_IN_PROGRESS', selected_slot_id=$2, updated_at=now()
       WHERE id=$1 AND status='OPEN'
       RETURNING *`,
      [session.id, slotId],
    );
    if (!claim.rows[0]) {
      const cur = (await client.query(`SELECT * FROM ops.booking_sessions WHERE id=$1`, [session.id])).rows[0];
      await client.query('COMMIT');
      if (cur?.status === BookingSessionStatus.BOOKING_IN_PROGRESS || cur?.status === BookingSessionStatus.BOOKED) {
        return { ok: true, duplicate: true, sessionId: session.id, selectedSlotId: cur.selected_slot_id, providerCalls: 0 };
      }
      return { ok: false, code: 'SESSION_RACE', providerCalls: 0 };
    }

    const wf = await loadWorkflow(client, session.case_id);
    const jobKey = `b2b-appt-book:${session.id}:${slotId}`;
    let jobId = null;
    if (wf) {
      const ins = await client.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',95,5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
          wf.id,
          APPOINTMENT_BOOK_SELECTED_SLOT_CAPABILITY,
          jobKey,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({
            case_id: session.case_id,
            session_id: session.id,
            slot_id: slotId,
            schema_version: 1,
          }),
        ],
      );
      jobId = ins.rows[0]?.id || null;
    }
    await client.query('COMMIT');
    return { ok: true, sessionId: session.id, selectedSlotId: slotId, jobId, providerCalls: 0 };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute booking after durable intent — fresh checks then provider create.
 */
export async function executeBookSelectedSlot(pool, {
  sessionId,
  slotId,
  calendarProvider = null,
  policy = TEST_APPOINTMENT_POLICY_V1,
  now = new Date(),
} = {}) {
  const provider = calendarProvider || createTestCalendarProvider();
  const session = (await pool.query(`SELECT * FROM ops.booking_sessions WHERE id=$1`, [sessionId])).rows[0];
  if (!session) return { ok: false, code: 'SESSION_MISSING', providerCalls: 0 };
  if (session.status === BookingSessionStatus.BOOKED && session.appointment_id) {
    return { ok: true, duplicate: true, appointmentId: session.appointment_id, providerCalls: 0 };
  }
  if (session.status !== BookingSessionStatus.BOOKING_IN_PROGRESS) {
    return { ok: false, code: 'SESSION_NOT_IN_PROGRESS', providerCalls: 0 };
  }
  if (new Date(session.expires_at) <= now) {
    await pool.query(`UPDATE ops.booking_sessions SET status='EXPIRED', updated_at=now() WHERE id=$1`, [sessionId]);
    return { ok: false, code: 'EXPIRED_TOKEN', providerCalls: 0 };
  }

  const gate = await calendarControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };
  if (await hasTakeover(pool, session.case_id)) {
    return { ok: false, code: 'TAKEOVER', providerCalls: 0 };
  }
  const ready = await assertCallReady(pool, session.case_id);
  if (!ready.ok) return { ok: false, code: ready.code, providerCalls: 0 };

  const slot = (await pool.query(
    `SELECT * FROM ops.booking_slots WHERE id=$1 AND booking_session_id=$2`,
    [slotId || session.selected_slot_id, sessionId],
  )).rows[0];
  if (!slot || slot.is_stale || slot.generation !== session.slot_generation) {
    return { ok: false, code: 'STALE_SLOT', providerCalls: 0 };
  }

  const contact = await resolveContact(pool, session.case_id);
  const dthKey = `appointment-create/${session.case_id}/${session.id}/${slot.id}`;

  // TX1: durable pending appointment intent
  const client = await pool.connect();
  let appointment;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [session.calendar_resource_id]);

    const overlap = await client.query(
      `SELECT id FROM ops.appointments
       WHERE calendar_resource_id=$1
         AND status IN ('CONFIRMED','CONFIRMED_MEETING_LINK_PENDING','PENDING_PROVIDER','OUTCOME_UNKNOWN','RESCHEDULE_PENDING')
         AND start_at_utc < $3 AND end_at_utc > $2
       LIMIT 1`,
      [session.calendar_resource_id, slot.start_at_utc, slot.end_at_utc],
    );
    if (overlap.rows[0]) {
      await client.query(
        `UPDATE ops.booking_slots SET is_stale=true WHERE id=$1`,
        [slot.id],
      );
      await client.query(
        `UPDATE ops.booking_sessions SET status='OPEN', selected_slot_id=NULL, updated_at=now() WHERE id=$1`,
        [sessionId],
      );
      await client.query('COMMIT');
      return { ok: false, code: 'SLOT_NO_LONGER_AVAILABLE', providerCalls: 0 };
    }

    const existing = await client.query(
      `SELECT * FROM ops.appointments WHERE dth_idempotency_key=$1`,
      [dthKey],
    );
    if (existing.rows[0]) {
      appointment = existing.rows[0];
      await client.query('COMMIT');
      if (appointment.status === AppointmentStatus.OUTCOME_UNKNOWN) {
        return { ok: true, outcomeUnknown: true, appointmentId: appointment.id, providerCalls: 0, blindRetry: false };
      }
      if (['CONFIRMED', 'CONFIRMED_MEETING_LINK_PENDING'].includes(appointment.status)) {
        return { ok: true, duplicate: true, appointmentId: appointment.id, providerCalls: 0 };
      }
    } else {
      const ins = await client.query(
        `INSERT INTO ops.appointments
          (case_id, booking_session_id, purpose, calendar_resource_id, provider,
           dth_idempotency_key, status, start_at_utc, end_at_utc, timezone,
           policy_version, attendee_email_hash, conference_status)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING_PROVIDER',$7,$8,$9,$10,$11,'PENDING')
         RETURNING *`,
        [
          session.case_id,
          sessionId,
          AppointmentPurpose.INITIAL_B2B_CONSULTATION,
          session.calendar_resource_id,
          A5_PROVIDER_TEST,
          dthKey,
          slot.start_at_utc,
          slot.end_at_utc,
          slot.timezone,
          policy.version,
          contact ? hashEmail(contact.email) : null,
        ],
      );
      appointment = ins.rows[0];
      await client.query('COMMIT');
    }
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  // Fresh provider availability check
  const avail = await provider.getAvailability({
    resourceId: session.calendar_resource_id,
    rangeStartUtc: slot.start_at_utc,
    rangeEndUtc: slot.end_at_utc,
    timezone: slot.timezone,
  });
  const busy = (avail.busyPeriods || []).some(
    (b) => new Date(b.startUtc) < new Date(slot.end_at_utc) && new Date(slot.start_at_utc) < new Date(b.endUtc),
  );
  if (busy) {
    await pool.query(
      `UPDATE ops.appointments SET status='FAILED', exception_code='PROVIDER_CONFLICT', updated_at=now() WHERE id=$1`,
      [appointment.id],
    );
    await pool.query(
      `UPDATE ops.booking_slots SET is_stale=true WHERE id=$1`,
      [slot.id],
    );
    await pool.query(
      `UPDATE ops.booking_sessions SET status='OPEN', selected_slot_id=NULL, appointment_id=NULL, updated_at=now() WHERE id=$1`,
      [sessionId],
    );
    return { ok: false, code: 'SLOT_NO_LONGER_AVAILABLE', providerCalls: 0, falseConfirm: false };
  }

  // Provider create OUTSIDE long TX
  const createResult = await provider.createAppointment({
    resourceId: session.calendar_resource_id,
    startUtc: slot.start_at_utc,
    endUtc: slot.end_at_utc,
    title: policy.meetingTitle,
    idempotencyKey: dthKey,
    attendeeEmailHash: contact ? hashEmail(contact.email) : null,
  });

  if (createResult.class === 'OUTCOME_UNKNOWN') {
    await pool.query(
      `UPDATE ops.appointments SET status='OUTCOME_UNKNOWN', exception_code=$2, updated_at=now() WHERE id=$1`,
      [appointment.id, createResult.code],
    );
    const wf = (await pool.query(
      `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
       WHERE case_id=$1 AND workflow_type=$2 ORDER BY created_at DESC LIMIT 1`,
      [session.case_id, B2B_INBOUND_WORKFLOW_TYPE],
    )).rows[0];
    if (wf) {
      await pool.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, scheduled_at, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',85,now() + interval '50 milliseconds',5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          wf.id,
          APPOINTMENT_RECONCILE_CAPABILITY,
          `b2b-appt-reconcile:${appointment.id}`,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({ appointment_id: appointment.id, case_id: session.case_id, schema_version: 1 }),
        ],
      );
    }
    return { ok: true, outcomeUnknown: true, appointmentId: appointment.id, providerCalls: 1, blindRetry: false };
  }

  if (!createResult.ok || createResult.class === 'CONFLICT') {
    await pool.query(
      `UPDATE ops.appointments SET status='FAILED', exception_code=$2, updated_at=now() WHERE id=$1`,
      [appointment.id, createResult.code || 'FAILED'],
    );
    await pool.query(`UPDATE ops.booking_slots SET is_stale=true WHERE id=$1`, [slot.id]);
    await pool.query(
      `UPDATE ops.booking_sessions SET status='OPEN', selected_slot_id=NULL, updated_at=now() WHERE id=$1`,
      [sessionId],
    );
    return {
      ok: false,
      code: createResult.code || 'PROVIDER_CONFLICT',
      providerCalls: 1,
      falseConfirm: false,
    };
  }

  // TX2: persist provider result + confirmation path
  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    const confStatus = createResult.conferenceStatus === 'READY'
      ? ConferenceStatus.READY
      : (createResult.conferenceStatus === 'DELAYED' ? ConferenceStatus.DELAYED : ConferenceStatus.PENDING);
    const apptStatus = confStatus === ConferenceStatus.READY
      ? AppointmentStatus.CONFIRMED
      : AppointmentStatus.CONFIRMED_MEETING_LINK_PENDING;

    // validate meeting URL if present
    let conferenceUrl = createResult.conferenceUrl || null;
    if (conferenceUrl) {
      try {
        const u = new URL(conferenceUrl);
        if (u.protocol !== 'https:' || conferenceUrl.length > 500) conferenceUrl = null;
      } catch {
        conferenceUrl = null;
      }
    }

    await client2.query(
      `UPDATE ops.appointments
       SET status=$2, provider_event_id=$3, conference_url=$4, conference_status=$5,
           confirmed_at=now(), updated_at=now()
       WHERE id=$1`,
      [appointment.id, apptStatus, createResult.providerEventId, conferenceUrl, confStatus],
    );
    await client2.query(
      `INSERT INTO ops.appointment_provider_events
        (appointment_id, provider, provider_event_id, event_kind, precedence, payload_redacted)
       VALUES ($1,$2,$3,'CREATED',20,$4::jsonb)`,
      [
        appointment.id,
        A5_PROVIDER_TEST,
        createResult.providerEventId,
        JSON.stringify({ conference_status: confStatus }),
      ],
    );
    await client2.query(
      `UPDATE ops.booking_sessions
       SET status='BOOKED', appointment_id=$2, updated_at=now() WHERE id=$1`,
      [sessionId, appointment.id],
    );

    // confirmation via A4 if conference ready (or confirm without link when delayed — no invented URL)
    const conv = await ensureConversation(client2, {
      caseId: session.case_id,
      workflowInstanceId: session.workflow_instance_id,
    });
    if (!conv.do_not_automatically_contact && apptStatus === AppointmentStatus.CONFIRMED) {
      const rendered = renderAppointmentMessage({
        purpose: MessagePurpose.APPOINTMENT_CONFIRMATION,
        ansprechpartner: contact?.ansprechpartner,
        startAtUtc: slot.start_at_utc,
        timezone: slot.timezone,
        conferenceUrl,
        bookingRef: session.booking_ref,
      });
      const confKey = `appointment-confirm/${appointment.id}`;
      const intentIns = await client2.query(
        `INSERT INTO ops.outbound_intents
          (conversation_id, case_id, purpose, state, qualification_revision,
           requirement_ids, requirement_fingerprint, dth_idempotency_key,
           communication_policy_version, template_id, template_version,
           content_hash, subject, body_text, recipient_email_hash,
           recipient_snapshot_redacted, provider_idempotency_key, followup_generation)
         VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,0)
         ON CONFLICT (dth_idempotency_key) DO NOTHING
         RETURNING id`,
        [
          conv.id,
          session.case_id,
          MessagePurpose.APPOINTMENT_CONFIRMATION,
          ready.qual.revision,
          `confirm:${appointment.id}`,
          confKey,
          rendered.templateId,
          rendered.templateVersion,
          rendered.contentHash,
          rendered.subject,
          rendered.bodyText,
          contact ? hashEmail(contact.email) : null,
          contact ? redactEmail(contact.email) : null,
          confKey.slice(0, 200),
        ],
      );
      const intentId = intentIns.rows[0]?.id;
      if (intentId) {
        await client2.query(
          `UPDATE ops.booking_sessions SET confirmation_intent_id=$2 WHERE id=$1`,
          [sessionId, intentId],
        );
        const wf = await loadWorkflow(client2, session.case_id);
        if (wf) {
          await client2.query(
            `INSERT INTO workflow.jobs
              (workflow_instance_id, job_type, status, priority, max_attempts,
               idempotency_key, correlation_id, control_version, payload_redacted)
             VALUES ($1,$2,'READY',90,5,$3,$4,$5,$6::jsonb)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              wf.id,
              B2B_COMMUNICATION_SEND_CAPABILITY,
              `b2b-appt-confirm-send:${intentId}`,
              wf.correlation_id,
              wf.control_version_at_start || 1,
              JSON.stringify({ case_id: session.case_id, intent_id: intentId, schema_version: 1 }),
            ],
          );
        }
      }
    }

    // schedule reminders
    const offsets = policy.reminderOffsetsMs || [];
    let gen = 0;
    for (const offset of offsets) {
      gen += 1;
      if (gen > (policy.maxReminders || 1)) break;
      const due = new Date(new Date(slot.start_at_utc).getTime() - offset);
      // for synthetic tests, allow due soon after now
      const dueAt = due < now ? new Date(now.getTime() + offset) : due;
      const rKey = `b2b-appt-reminder:${appointment.id}:${gen}`;
      await client2.query(
        `INSERT INTO ops.appointment_reminders
          (appointment_id, case_id, generation, due_at, job_idempotency_key)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (appointment_id, generation) DO NOTHING`,
        [appointment.id, session.case_id, gen, dueAt.toISOString(), rKey],
      );
      const wf = await loadWorkflow(client2, session.case_id);
      if (wf) {
        await client2.query(
          `INSERT INTO workflow.jobs
            (workflow_instance_id, job_type, status, priority, scheduled_at, max_attempts,
             idempotency_key, correlation_id, control_version, payload_redacted)
           VALUES ($1,$2,'READY',75,$3,3,$4,$5,$6,$7::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            wf.id,
            APPOINTMENT_REMINDER_DUE_CAPABILITY,
            dueAt.toISOString(),
            rKey,
            wf.correlation_id,
            wf.control_version_at_start || 1,
            JSON.stringify({
              appointment_id: appointment.id,
              case_id: session.case_id,
              generation: gen,
              schema_version: 1,
            }),
          ],
        );
      }
    }

    await client2.query(
      `UPDATE workflow.workflow_instances
       SET current_state='APPOINTMENT_CONFIRMED', updated_at=now()
       WHERE case_id=$1 AND workflow_type=$2 AND status='RUNNING'`,
      [session.case_id, B2B_INBOUND_WORKFLOW_TYPE],
    );
    await client2.query(
      `INSERT INTO public.audit_events (event_type, detail)
       VALUES ('appointment.confirmed',$1::jsonb)`,
      [JSON.stringify({
        case_id: session.case_id,
        appointment_id: appointment.id,
        provider_event_id: createResult.providerEventId,
        conference_status: confStatus,
      })],
    );
    await client2.query('COMMIT');

    if (confStatus === ConferenceStatus.DELAYED) {
      const wf = (await pool.query(
        `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
         WHERE case_id=$1 AND workflow_type=$2 ORDER BY created_at DESC LIMIT 1`,
        [session.case_id, B2B_INBOUND_WORKFLOW_TYPE],
      )).rows[0];
      if (wf) {
        await pool.query(
          `INSERT INTO workflow.jobs
            (workflow_instance_id, job_type, status, priority, scheduled_at, max_attempts,
             idempotency_key, correlation_id, control_version, payload_redacted)
           VALUES ($1,$2,'READY',85,now() + interval '50 milliseconds',5,$3,$4,$5,$6::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            wf.id,
            APPOINTMENT_RECONCILE_CAPABILITY,
            `b2b-appt-reconcile-link:${appointment.id}`,
            wf.correlation_id,
            wf.control_version_at_start || 1,
            JSON.stringify({ appointment_id: appointment.id, case_id: session.case_id, schema_version: 1 }),
          ],
        );
      }
    }

    return {
      ok: true,
      appointmentId: appointment.id,
      providerEventId: createResult.providerEventId,
      status: apptStatus,
      conferenceUrl,
      providerCalls: 1,
      falseConfirm: false,
    };
  } catch (err) {
    try { await client2.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client2.release();
  }
}

export async function reconcileAppointment(pool, {
  appointmentId,
  calendarProvider = null,
} = {}) {
  const provider = calendarProvider || createTestCalendarProvider();
  const appt = (await pool.query(`SELECT * FROM ops.appointments WHERE id=$1`, [appointmentId])).rows[0];
  if (!appt) return { ok: false, code: 'APPOINTMENT_MISSING' };

  if (!appt.provider_event_id && appt.status === AppointmentStatus.OUTCOME_UNKNOWN) {
    // try idempotent create read via get — if absent, allow controlled retry once by resetting to pending
    return { ok: true, code: 'RECONCILIATION_REQUIRED', requiresHuman: true };
  }

  if (!appt.provider_event_id) {
    return { ok: false, code: 'NO_PROVIDER_EVENT_ID' };
  }

  const read = await provider.getAppointment({ providerEventId: appt.provider_event_id });
  if (!read.found) {
    await pool.query(
      `UPDATE ops.appointments
       SET status='RECONCILIATION_REQUIRED', exception_code='PROVIDER_EVENT_MISSING', updated_at=now()
       WHERE id=$1`,
      [appointmentId],
    );
    return { ok: true, code: 'PROVIDER_EVENT_MISSING', requiresHuman: true };
  }

  const ev = read.event;
  if (
    new Date(ev.startUtc).getTime() !== new Date(appt.start_at_utc).getTime() ||
    new Date(ev.endUtc).getTime() !== new Date(appt.end_at_utc).getTime()
  ) {
    await pool.query(
      `UPDATE ops.appointments
       SET status='RECONCILIATION_REQUIRED', exception_code='PROVIDER_DIVERGENCE', updated_at=now()
       WHERE id=$1`,
      [appointmentId],
    );
    return { ok: true, code: 'PROVIDER_DIVERGENCE', requiresHuman: true };
  }

  let conferenceUrl = ev.conferenceUrl || appt.conference_url;
  if (conferenceUrl) {
    try {
      const u = new URL(conferenceUrl);
      if (u.protocol !== 'https:') conferenceUrl = null;
    } catch {
      conferenceUrl = null;
    }
  }
  const confStatus = ev.conferenceStatus || (conferenceUrl ? ConferenceStatus.READY : ConferenceStatus.DELAYED);
  const status = confStatus === ConferenceStatus.READY
    ? AppointmentStatus.CONFIRMED
    : AppointmentStatus.CONFIRMED_MEETING_LINK_PENDING;

  await pool.query(
    `UPDATE ops.appointments
     SET status=$2, conference_url=$3, conference_status=$4, confirmed_at=COALESCE(confirmed_at, now()), updated_at=now()
     WHERE id=$1`,
    [appointmentId, status, conferenceUrl, confStatus],
  );
  await pool.query(
    `UPDATE ops.booking_sessions SET status='BOOKED', appointment_id=$2, updated_at=now()
     WHERE id=$1 AND status IN ('BOOKING_IN_PROGRESS','OPEN')`,
    [appt.booking_session_id, appointmentId],
  );
  return { ok: true, code: 'RECONCILED', status, conferenceUrl };
}

export async function executeAppointmentReminder(pool, {
  appointmentId,
  generation,
} = {}) {
  const appt = (await pool.query(`SELECT * FROM ops.appointments WHERE id=$1`, [appointmentId])).rows[0];
  if (!appt) return { ok: false, code: 'APPOINTMENT_MISSING', providerCalls: 0 };

  const rem = (await pool.query(
    `SELECT * FROM ops.appointment_reminders WHERE appointment_id=$1 AND generation=$2`,
    [appointmentId, generation],
  )).rows[0];
  if (!rem) return { ok: false, code: 'REMINDER_MISSING', providerCalls: 0 };
  if (rem.status !== ReminderStatus.SCHEDULED) {
    return { ok: true, cancelled: true, status: rem.status, providerCalls: 0 };
  }

  if (!['CONFIRMED', 'CONFIRMED_MEETING_LINK_PENDING'].includes(appt.status)) {
    await pool.query(
      `UPDATE ops.appointment_reminders SET status='CANCELLED_STALE', cancelled_at=now() WHERE id=$1`,
      [rem.id],
    );
    return { ok: true, cancelled: true, code: 'APPOINTMENT_NOT_CONFIRMED', providerCalls: 0 };
  }
  if (appt.status === AppointmentStatus.CANCELLED) {
    await pool.query(
      `UPDATE ops.appointment_reminders SET status='CANCELLED_APPOINTMENT', cancelled_at=now() WHERE id=$1`,
      [rem.id],
    );
    return { ok: true, cancelled: true, code: 'CANCELLED', providerCalls: 0 };
  }

  const gate = await calendarControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, deferred: true, providerCalls: 0 };

  const conv = (await pool.query(
    `SELECT * FROM ops.conversations WHERE case_id=$1 AND channel='EMAIL'`,
    [appt.case_id],
  )).rows[0];
  if (conv?.do_not_automatically_contact) {
    await pool.query(
      `UPDATE ops.appointment_reminders SET status='CANCELLED_SUPPRESSED', cancelled_at=now() WHERE id=$1`,
      [rem.id],
    );
    return { ok: true, cancelled: true, code: 'SUPPRESSED', providerCalls: 0 };
  }

  const contact = await resolveContact(pool, appt.case_id);
  const session = (await pool.query(`SELECT * FROM ops.booking_sessions WHERE id=$1`, [appt.booking_session_id])).rows[0];
  const qual = await getCurrentQualification(pool, appt.case_id);
  const rendered = renderAppointmentMessage({
    purpose: MessagePurpose.APPOINTMENT_REMINDER,
    ansprechpartner: contact?.ansprechpartner,
    startAtUtc: appt.start_at_utc,
    timezone: appt.timezone,
    conferenceUrl: appt.conference_url,
    bookingRef: session?.booking_ref,
  });
  const dthKey = `appointment-reminder/${appointmentId}/${generation}`;
  const intentIns = await pool.query(
    `INSERT INTO ops.outbound_intents
      (conversation_id, case_id, purpose, state, qualification_revision,
       requirement_ids, requirement_fingerprint, dth_idempotency_key,
       communication_policy_version, template_id, template_version,
       content_hash, subject, body_text, recipient_email_hash,
       recipient_snapshot_redacted, provider_idempotency_key, followup_generation)
     VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,0)
     ON CONFLICT (dth_idempotency_key) DO NOTHING
     RETURNING id`,
    [
      conv.id,
      appt.case_id,
      MessagePurpose.APPOINTMENT_REMINDER,
      qual?.revision || 1,
      `reminder:${appointmentId}:${generation}`,
      dthKey,
      rendered.templateId,
      rendered.templateVersion,
      rendered.contentHash,
      rendered.subject,
      rendered.bodyText,
      contact ? hashEmail(contact.email) : null,
      contact ? redactEmail(contact.email) : null,
      dthKey.slice(0, 200),
    ],
  );
  const intentId = intentIns.rows[0]?.id;
  if (intentId) {
    const wf = (await pool.query(
      `SELECT id, correlation_id, control_version_at_start FROM workflow.workflow_instances
       WHERE case_id=$1 AND workflow_type=$2 ORDER BY created_at DESC LIMIT 1`,
      [appt.case_id, B2B_INBOUND_WORKFLOW_TYPE],
    )).rows[0];
    if (wf) {
      await pool.query(
        `INSERT INTO workflow.jobs
          (workflow_instance_id, job_type, status, priority, max_attempts,
           idempotency_key, correlation_id, control_version, payload_redacted)
         VALUES ($1,$2,'READY',90,5,$3,$4,$5,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          wf.id,
          B2B_COMMUNICATION_SEND_CAPABILITY,
          `b2b-appt-reminder-send:${intentId}`,
          wf.correlation_id,
          wf.control_version_at_start || 1,
          JSON.stringify({ case_id: appt.case_id, intent_id: intentId, schema_version: 1 }),
        ],
      );
    }
  }
  await pool.query(
    `UPDATE ops.appointment_reminders SET status='SENT', outbound_intent_id=$2 WHERE id=$1`,
    [rem.id, intentId || null],
  );
  return { ok: true, sent: true, intentId, providerCalls: 0 };
}

export async function cancelAppointment(pool, {
  appointmentId,
  calendarProvider = null,
} = {}) {
  const provider = calendarProvider || createTestCalendarProvider();
  const appt = (await pool.query(`SELECT * FROM ops.appointments WHERE id=$1`, [appointmentId])).rows[0];
  if (!appt) return { ok: false, code: 'APPOINTMENT_MISSING', providerCalls: 0 };
  if (appt.status === AppointmentStatus.CANCELLED) {
    return { ok: true, duplicate: true, providerCalls: 0 };
  }

  const gate = await calendarControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code, providerCalls: 0 };

  await pool.query(
    `UPDATE ops.appointments SET status='CANCEL_PENDING', updated_at=now() WHERE id=$1`,
    [appointmentId],
  );

  let providerCalls = 0;
  if (appt.provider_event_id) {
    const cancel = await provider.cancelAppointment({ providerEventId: appt.provider_event_id });
    providerCalls = 1;
    if (!cancel.ok) {
      await pool.query(
        `UPDATE ops.appointments
         SET status='RECONCILIATION_REQUIRED', exception_code='CANCEL_PROVIDER_FAIL', updated_at=now()
         WHERE id=$1`,
        [appointmentId],
      );
      return { ok: false, code: 'CANCEL_PROVIDER_FAIL', providerCalls };
    }
  }

  await pool.query(
    `UPDATE ops.appointments SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id=$1`,
    [appointmentId],
  );
  await pool.query(
    `UPDATE ops.appointment_reminders
     SET status='CANCELLED_APPOINTMENT', cancelled_at=now()
     WHERE appointment_id=$1 AND status='SCHEDULED'`,
    [appointmentId],
  );
  return { ok: true, cancelled: true, providerCalls };
}

export async function rescheduleAppointment(pool, {
  appointmentId,
  token,
  newSlotId,
  calendarProvider = null,
  policy = TEST_APPOINTMENT_POLICY_V1,
} = {}) {
  const provider = calendarProvider || createTestCalendarProvider();
  const old = (await pool.query(`SELECT * FROM ops.appointments WHERE id=$1`, [appointmentId])).rows[0];
  if (!old) return { ok: false, code: 'APPOINTMENT_MISSING' };

  // create new booking via selection path on same or new session
  const sel = await submitSlotSelection(pool, { token, slotId: newSlotId });
  if (!sel.ok && !sel.duplicate) return sel;

  const session = await getBookingSessionByToken(pool, token);
  const book = await executeBookSelectedSlot(pool, {
    sessionId: session.id,
    slotId: newSlotId,
    calendarProvider: provider,
    policy,
  });
  if (!book.ok || book.outcomeUnknown) {
    return { ...book, code: book.code || 'RESCHEDULE_NEW_FAILED' };
  }

  const cancel = await cancelAppointment(pool, {
    appointmentId,
    calendarProvider: provider,
  });
  if (!cancel.ok) {
    await pool.query(
      `UPDATE ops.appointments SET status='RECONCILIATION_REQUIRED', exception_code='RESCHEDULE_RECONCILIATION_REQUIRED', updated_at=now()
       WHERE id=$1`,
      [book.appointmentId],
    );
    return {
      ok: false,
      code: 'RESCHEDULE_RECONCILIATION_REQUIRED',
      newAppointmentId: book.appointmentId,
      providerCalls: (book.providerCalls || 0) + (cancel.providerCalls || 0),
    };
  }
  await pool.query(
    `UPDATE ops.appointments SET status='SUPERSEDED', rescheduled_from=$2, updated_at=now() WHERE id=$1`,
    [appointmentId, book.appointmentId],
  );
  await pool.query(
    `UPDATE ops.appointment_reminders SET status='CANCELLED_RESCHEDULE', cancelled_at=now()
     WHERE appointment_id=$1 AND status='SCHEDULED'`,
    [appointmentId],
  );
  return {
    ok: true,
    newAppointmentId: book.appointmentId,
    oldAppointmentId: appointmentId,
    providerCalls: (book.providerCalls || 0) + (cancel.providerCalls || 0),
  };
}

export async function expireBookingSession(pool, { sessionId } = {}) {
  const { rows } = await pool.query(
    `UPDATE ops.booking_sessions SET status='EXPIRED', updated_at=now()
     WHERE id=$1 AND status IN ('OPEN','PREPARING')
     RETURNING *`,
    [sessionId],
  );
  return { ok: true, expired: Boolean(rows[0]) };
}

export function a6HandoffFromAppointment(appt) {
  if (!appt) return { ready: false, code: 'NO_APPOINTMENT' };
  if (!['CONFIRMED', 'CONFIRMED_MEETING_LINK_PENDING'].includes(appt.status)) {
    return { ready: false, code: 'NOT_CONFIRMED' };
  }
  return {
    ready: true,
    handoff: 'A5_TO_A6',
    appointmentId: appt.id,
    caseId: appt.case_id,
    // Explicit: appointment confirmed ≠ call completed ≠ offer input ready
    callCompleted: false,
    offerInputReady: false,
    nextCapability: 'DOCUMENT_INTELLIGENCE_PREPARE',
  };
}
