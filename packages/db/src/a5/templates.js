/**
 * Deterministic A5 appointment message templates (German B2B).
 * Content derived server-side only — no client prose.
 */
import {
  MessagePurpose,
  A5_TEMPLATE_OFFER_ID,
  A5_TEMPLATE_CONFIRM_ID,
  A5_TEMPLATE_REMINDER_ID,
  A5_TEMPLATE_VERSION,
} from '@deintarifheld/shared';
import { createHash } from 'node:crypto';
import { formatInTimeZone } from './timezone.js';

function escapeText(v) {
  return String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
}

export function renderAppointmentMessage({
  purpose,
  ansprechpartner,
  bookingUrl,
  bookingRef,
  startAtUtc,
  timezone = 'Europe/Berlin',
  conferenceUrl,
  durationMinutes,
} = {}) {
  const name = escapeText(ansprechpartner) || 'Interessent';
  const ref = escapeText(bookingRef);

  if (purpose === MessagePurpose.APPOINTMENT_OFFER) {
    const body = [
      `Guten Tag ${name},`,
      '',
      'vielen Dank — Ihre Anfrage ist für ein kurzes Online-Gespräch bereit.',
      '',
      'Bitte wählen Sie hier einen Termin aus:',
      bookingUrl,
      '',
      durationMinutes ? `Dauer: ca. ${durationMinutes} Minuten` : null,
      ref ? `Referenz: ${ref}` : null,
      '',
      'Freundliche Grüße',
      'Ihr DeinTarifheld-Team',
    ].filter((l) => l !== null).join('\n');
    const subject = ref
      ? `Termin auswählen — DeinTarifheld [${ref}]`
      : 'Termin auswählen — DeinTarifheld';
    return {
      templateId: A5_TEMPLATE_OFFER_ID,
      templateVersion: A5_TEMPLATE_VERSION,
      subject,
      bodyText: body,
      contentHash: createHash('sha256').update(subject + '\n' + body).digest('hex'),
    };
  }

  if (purpose === MessagePurpose.APPOINTMENT_CONFIRMATION) {
    const when = startAtUtc ? formatInTimeZone(startAtUtc, timezone) : '';
    const body = [
      `Guten Tag ${name},`,
      '',
      'Ihr Online-Termin ist bestätigt.',
      when ? `Zeitpunkt: ${when} (${timezone})` : null,
      conferenceUrl ? `Teilnahmelink: ${conferenceUrl}` : null,
      ref ? `Referenz: ${ref}` : null,
      '',
      'Freundliche Grüße',
      'Ihr DeinTarifheld-Team',
    ].filter((l) => l !== null).join('\n');
    const subject = ref
      ? `Terminbestätigung — DeinTarifheld [${ref}]`
      : 'Terminbestätigung — DeinTarifheld';
    return {
      templateId: A5_TEMPLATE_CONFIRM_ID,
      templateVersion: A5_TEMPLATE_VERSION,
      subject,
      bodyText: body,
      contentHash: createHash('sha256').update(subject + '\n' + body).digest('hex'),
    };
  }

  if (purpose === MessagePurpose.APPOINTMENT_REMINDER) {
    const when = startAtUtc ? formatInTimeZone(startAtUtc, timezone) : '';
    const body = [
      `Guten Tag ${name},`,
      '',
      'kurze Erinnerung an Ihren Online-Termin bei DeinTarifheld.',
      when ? `Zeitpunkt: ${when} (${timezone})` : null,
      conferenceUrl ? `Teilnahmelink: ${conferenceUrl}` : null,
      '',
      'Freundliche Grüße',
      'Ihr DeinTarifheld-Team',
    ].filter((l) => l !== null).join('\n');
    const subject = 'Erinnerung an Ihren Termin — DeinTarifheld';
    return {
      templateId: A5_TEMPLATE_REMINDER_ID,
      templateVersion: A5_TEMPLATE_VERSION,
      subject,
      bodyText: body,
      contentHash: createHash('sha256').update(subject + '\n' + body).digest('hex'),
    };
  }

  throw new Error(`UNKNOWN_APPOINTMENT_TEMPLATE_PURPOSE:${purpose}`);
}
