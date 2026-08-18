/**
 * A4 integration for switch missing-info and confirmation. No direct Resend.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  MessagePurpose,
  SWITCH_FIELD_LABEL_DE,
  B2B_INBOUND_WORKFLOW_TYPE,
} from '@deintarifheld/shared';
import { createMockEmailProvider, hashEmail, redactEmail } from '../a4/provider.js';
import { executeCommunicationSend } from '../a4/communicate.js';
import { getCurrentQualification } from '../a3/evaluate.js';
import { loadWorkflow, resolveOfferContact } from '../a8/prepare.js';

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

function missingBody(fields) {
  const labels = fields.map((f) => SWITCH_FIELD_LABEL_DE[f] || f);
  return [
    'Guten Tag,',
    '',
    `Für den Anbieterwechsel benötigen wir noch Ihre ${labels.join(', ')}.`,
    '',
    'Freundliche Grüße',
    'Ihr DeinTarifheld-Team (TEST)',
  ].join('\n');
}

export async function requestSwitchMissingInfo(pool, {
  caseId, fields = ['MALO_ID'], emailProvider = null,
} = {}) {
  const contact = await resolveOfferContact(pool, caseId);
  if (!contact?.email) return { ok: false, code: 'RECIPIENT_MISSING' };
  const wf = await loadWorkflow(pool, caseId);
  const qual = await getCurrentQualification(pool, caseId);
  const subject = 'Angaben für den Anbieterwechsel — DeinTarifheld [TEST_ONLY]';
  const body = missingBody(fields);
  const dthKey = `switch-missing/${caseId}/${fields.join(',')}`;
  const client = await pool.connect();
  let intentId;
  try {
    await client.query('BEGIN');
    const conv = await ensureConversation(client, { caseId, workflowInstanceId: wf?.id || null });
    if (conv.do_not_automatically_contact) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SUPPRESSED' };
    }
    const ins = await client.query(
      `INSERT INTO ops.outbound_intents
        (conversation_id, case_id, purpose, state, qualification_revision,
         requirement_ids, requirement_fingerprint, dth_idempotency_key,
         communication_policy_version, template_id, template_version,
         content_hash, subject, body_text, recipient_email_hash,
         recipient_snapshot_redacted, provider_idempotency_key, followup_generation)
       VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,1,$8,$9,$10,$11,$12,$13,0)
       ON CONFLICT (dth_idempotency_key) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [
        conv.id,
        caseId,
        MessagePurpose.SWITCH_MISSING_INFORMATION_REQUEST,
        qual?.revision || 1,
        `switch-missing:${fields.join(',')}`,
        dthKey,
        'DTH_A9_SWITCH_MISSING_DE_V1',
        createHash('sha256').update(subject + body).digest('hex'),
        subject,
        body,
        hashEmail(contact.email),
        redactEmail(contact.email),
        dthKey.slice(0, 200),
      ],
    );
    intentId = ins.rows[0].id;
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
  void B2B_INBOUND_WORKFLOW_TYPE;
  return { ok: true, intentId, providerCalls: send.providerCalls || 0, send };
}

export async function requestSwitchConfirmation(pool, {
  caseId, confirmedStart, productCode, supplierName, emailProvider = null,
} = {}) {
  const contact = await resolveOfferContact(pool, caseId);
  if (!contact?.email) return { ok: false, code: 'RECIPIENT_MISSING' };
  const wf = await loadWorkflow(pool, caseId);
  const qual = await getCurrentQualification(pool, caseId);
  const startLine = confirmedStart ? `Bestätigter Lieferbeginn: ${confirmedStart}` : 'Lieferbeginn wird vom Anbieter bestätigt.';
  const subject = 'Anbieterwechsel bestätigt — DeinTarifheld [TEST_ONLY]';
  const body = [
    `Guten Tag ${contact.ansprechpartner || ''},`.trim(),
    '',
    `Ihr Anbieterwechsel zu ${supplierName || 'dem gewählten Anbieter'} (${productCode || ''}) wurde bestätigt.`,
    startLine,
    '',
    'Freundliche Grüße',
    'Ihr DeinTarifheld-Team (TEST)',
  ].join('\n');
  const dthKey = `switch-confirm/${caseId}/${confirmedStart || 'none'}`;
  const client = await pool.connect();
  let intentId;
  try {
    await client.query('BEGIN');
    const conv = await ensureConversation(client, { caseId, workflowInstanceId: wf?.id || null });
    const ins = await client.query(
      `INSERT INTO ops.outbound_intents
        (conversation_id, case_id, purpose, state, qualification_revision,
         requirement_ids, requirement_fingerprint, dth_idempotency_key,
         communication_policy_version, template_id, template_version,
         content_hash, subject, body_text, recipient_email_hash,
         recipient_snapshot_redacted, provider_idempotency_key, followup_generation)
       VALUES ($1,$2,$3,'READY_TO_SEND',$4,'{}',$5,$6,1,$7,1,$8,$9,$10,$11,$12,$13,0)
       ON CONFLICT (dth_idempotency_key) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [
        conv.id,
        caseId,
        MessagePurpose.SWITCH_CONFIRMATION,
        qual?.revision || 1,
        `switch-confirm:${confirmedStart || 'none'}`,
        dthKey,
        'DTH_A9_SWITCH_CONFIRM_DE_V1',
        createHash('sha256').update(subject + body).digest('hex'),
        subject,
        body,
        hashEmail(contact.email),
        redactEmail(contact.email),
        dthKey.slice(0, 200),
      ],
    );
    intentId = ins.rows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
  return executeCommunicationSend(pool, {
    intentId,
    emailProvider: emailProvider || createMockEmailProvider(),
  });
}
