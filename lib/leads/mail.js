import { Resend } from 'resend'

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatWhen(iso) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function row(label, value) {
  if (!value) return ''
  return `<tr><td style="padding:6px 12px 6px 0;color:#5B6578;font-size:14px;">${esc(label)}</td><td style="padding:6px 0;color:#152033;font-size:14px;">${esc(value)}</td></tr>`
}

export function buildUnternehmenMails({ leadRef, data, submittedAt }) {
  const when = formatWhen(submittedAt)
  const subjectAdmin = `[B2B] ${data.firma} — ${leadRef}`
  const subjectCustomer = 'Ihre Unternehmensanfrage bei DeinTarifheld'

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Neue B2B-Anfrage</h2>
      <p style="margin:0 0 16px;color:#5B6578;">Lead-ID: <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
      <table style="border-collapse:collapse;">
        ${row('Firma', data.firma)}
        ${row('Ansprechpartner', data.ansprechpartner)}
        ${row('E-Mail', data.email)}
        ${row('Telefon', data.telefon)}
        ${row('PLZ', data.plz)}
        ${row('Energieart', data.energieart)}
        ${row('Verbrauch Strom', data.verbrauchStrom)}
        ${row('Verbrauch Gas', data.verbrauchGas)}
        ${row('Standorte', data.standorte)}
        ${row('Versorger', data.versorger)}
        ${row('Vertragslaufzeit', data.vertragslaufzeit)}
        ${row('Nachricht', data.nachricht)}
        ${row('Quelle', data.source_page)}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#7D8798;">Automatisch via /api/leads</p>
    </div>
  `

  const adminText = [
    `Neue B2B-Anfrage ${leadRef}`,
    `Zeit: ${when}`,
    `Firma: ${data.firma}`,
    `Ansprechpartner: ${data.ansprechpartner}`,
    `E-Mail: ${data.email}`,
    `Telefon: ${data.telefon}`,
    `PLZ: ${data.plz}`,
    `Energieart: ${data.energieart}`,
    `Verbrauch Strom: ${data.verbrauchStrom}`,
    `Verbrauch Gas: ${data.verbrauchGas}`,
    `Standorte: ${data.standorte}`,
    `Versorger: ${data.versorger}`,
    `Vertragslaufzeit: ${data.vertragslaufzeit}`,
    `Nachricht: ${data.nachricht}`,
    `Quelle: ${data.source_page}`,
  ].join('\n')

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Anfrage eingegangen</h2>
      <p>Guten Tag ${esc(data.ansprechpartner)},</p>
      <p>vielen Dank für Ihre Anfrage bei <strong>DeinTarifheld</strong>. Wir haben Ihre Angaben erhalten und melden uns in Kürze.</p>
      <p style="color:#5B6578;">Ihre Referenz: <strong>${esc(leadRef)}</strong></p>
      <p style="margin-top:24px;">Freundliche Grüße<br/>Ihr DeinTarifheld-Team</p>
    </div>
  `

  const customerText = [
    `Guten Tag ${data.ansprechpartner},`,
    '',
    'vielen Dank für Ihre Anfrage bei DeinTarifheld. Wir haben Ihre Angaben erhalten und melden uns in Kürze.',
    `Ihre Referenz: ${leadRef}`,
    '',
    'Freundliche Grüße',
    'Ihr DeinTarifheld-Team',
  ].join('\n')

  return {
    subjectAdmin,
    subjectCustomer,
    adminHtml,
    adminText,
    customerHtml,
    customerText,
  }
}

/**
 * LEADS_MAIL_MODE:
 * - live (default): send via Resend
 * - mock: accept without network (automation/CI)
 * - fail: deterministic failure path for tests (no network)
 */
export async function sendLeadEmails({ leadRef, data, submittedAt }) {
  const mode = (process.env.LEADS_MAIL_MODE || 'live').trim().toLowerCase()

  if (mode === 'mock') {
    return { ok: true, mode: 'mock', code: 'sandbox_accepted' }
  }
  if (mode === 'fail') {
    return { ok: false, mode: 'fail', code: 'mail-send-failed' }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.LEADS_FROM_EMAIL?.trim()
  const to = process.env.LEADS_TO_EMAIL?.trim()

  if (!apiKey || !from || !to) {
    return { ok: false, code: 'mail-not-configured' }
  }

  const mail = buildUnternehmenMails({ leadRef, data, submittedAt })
  const resend = new Resend(apiKey)

  const internal = await resend.emails.send({
    from,
    to: [to],
    replyTo: data.email,
    subject: mail.subjectAdmin,
    text: mail.adminText,
    html: mail.adminHtml,
  })
  if (internal.error) {
    return { ok: false, code: 'mail-send-failed' }
  }

  const confirmation = await resend.emails.send({
    from,
    to: [data.email],
    replyTo: to,
    subject: mail.subjectCustomer,
    text: mail.customerText,
    html: mail.customerHtml,
  })
  if (confirmation.error) {
    return { ok: false, code: 'mail-send-failed' }
  }

  return { ok: true, mode: 'live' }
}
