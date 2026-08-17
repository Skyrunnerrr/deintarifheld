/**
 * Deterministic German B2B missing-info template V1.
 */
import {
  A4_TEMPLATE_MISSING_INFO_ID,
  A4_TEMPLATE_MISSING_INFO_VERSION,
  FIELD_LABEL_DE,
} from '@deintarifheld/shared';
import { createHash } from 'node:crypto';

function escapeText(v) {
  return String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
}

export function renderMissingInfoMessage({
  ansprechpartner,
  conversationRef,
  requirements,
  isFollowup = false,
}) {
  const name = escapeText(ansprechpartner) || 'Interessent';
  const lines = (requirements || []).map((r) => {
    const label = FIELD_LABEL_DE[r.field_code] || 'weitere Angabe';
    return `- ${label}`;
  });
  const intro = isFollowup
    ? 'freundliche Erinnerung zu Ihrer Anfrage.'
    : 'vielen Dank für Ihre Anfrage.';
  const body = [
    `Guten Tag ${name},`,
    '',
    intro,
    '',
    'Damit wir den kurzen Online-Termin sinnvoll vorbereiten können, benötigen wir noch folgende Angabe(n):',
    '',
    ...lines,
    '',
    'Sie können uns die Informationen einfach als Antwort auf diese E-Mail senden.',
    '',
    `Referenz: [DTH-${conversationRef}]`,
    '',
    'Freundliche Grüße',
    'Ihr DeinTarifheld-Team',
  ].join('\n');

  const subject = isFollowup
    ? `Erinnerung: Angaben zu Ihrer Anfrage [DTH-${conversationRef}]`
    : `Kurze Rückfrage zu Ihrer Anfrage [DTH-${conversationRef}]`;

  const contentHash = createHash('sha256').update(subject + '\n' + body).digest('hex');
  return {
    templateId: A4_TEMPLATE_MISSING_INFO_ID,
    templateVersion: A4_TEMPLATE_MISSING_INFO_VERSION,
    subject,
    bodyText: body,
    contentHash,
  };
}
