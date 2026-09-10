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

export const MAIL_TEMPLATE_IDS = {
  business_admin: 'dth.business.admin.v1',
  business_customer: 'dth.business.customer.v1',
  private_admin: 'dth.private.admin.v1',
  private_customer: 'dth.private.customer.v1',
  career_admin: 'dth.career.admin.v1',
  career_applicant: 'dth.career.applicant.v1',
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
      <p style="margin:20px 0 0;font-size:12px;color:#7D8798;">Template ${MAIL_TEMPLATE_IDS.business_admin}</p>
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
    `Verbrauch Strom: ${data.verbrauchStrom || ''}`,
    `Verbrauch Gas: ${data.verbrauchGas || ''}`,
    `Standorte: ${data.standorte || ''}`,
    `Versorger: ${data.versorger || ''}`,
    `Vertragslaufzeit: ${data.vertragslaufzeit || ''}`,
    `Nachricht: ${data.nachricht || ''}`,
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
    templateIds: [MAIL_TEMPLATE_IDS.business_admin, MAIL_TEMPLATE_IDS.business_customer],
    subjectAdmin,
    subjectCustomer,
    adminHtml,
    adminText,
    customerHtml,
    customerText,
    customerEmail: data.email,
    replyTo: data.email,
  }
}

export function buildPrivateMails({ leadRef, data, submittedAt }) {
  const when = formatWhen(submittedAt)
  const name = data.firstName || 'Interessent'
  const subjectAdmin = `[Privat] ${name} — ${leadRef}`
  const subjectCustomer = 'Ihre Tarif-Anfrage bei DeinTarifheld'

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Neue Privat-Anfrage</h2>
      <p style="margin:0 0 16px;color:#5B6578;">Lead-ID: <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
      <table style="border-collapse:collapse;">
        ${row('Name', data.firstName)}
        ${row('E-Mail', data.email)}
        ${row('Telefon', data.phone)}
        ${row('Anbieter', data.provider)}
        ${row('Verbrauch', data.usage)}
        ${row('PLZ', data.zip)}
        ${row('Tarifart', data.type)}
        ${row('page_source', data.page_source)}
        ${row('Quelle', data.source_page)}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#7D8798;">Template ${MAIL_TEMPLATE_IDS.private_admin}</p>
    </div>
  `

  const adminText = [
    `Neue Privat-Anfrage ${leadRef}`,
    `Name: ${data.firstName}`,
    `E-Mail: ${data.email}`,
    `Telefon: ${data.phone}`,
    `Anbieter: ${data.provider}`,
    `Verbrauch: ${data.usage}`,
    `PLZ: ${data.zip}`,
    `Tarifart: ${data.type}`,
    `page_source: ${data.page_source}`,
  ].join('\n')

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Anfrage eingegangen</h2>
      <p>Hallo ${esc(name)},</p>
      <p>vielen Dank für deine Anfrage bei <strong>DeinTarifheld</strong>. Wir melden uns in Kürze bei dir.</p>
      <p style="color:#5B6578;">Deine Referenz: <strong>${esc(leadRef)}</strong></p>
    </div>
  `

  const customerText = [
    `Hallo ${name},`,
    '',
    'vielen Dank für deine Anfrage bei DeinTarifheld. Wir melden uns in Kürze bei dir.',
    `Deine Referenz: ${leadRef}`,
  ].join('\n')

  return {
    templateIds: [MAIL_TEMPLATE_IDS.private_admin, MAIL_TEMPLATE_IDS.private_customer],
    subjectAdmin,
    subjectCustomer,
    adminHtml,
    adminText,
    customerHtml,
    customerText,
    customerEmail: data.email,
    replyTo: data.email,
  }
}

export function buildCareerMails({ leadRef, data, submittedAt }) {
  const when = formatWhen(submittedAt)
  const subjectAdmin = `[Karriere] ${data.name} — ${leadRef}`
  const subjectCustomer = 'Deine Bewerbung bei DeinTarifheld'

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Neue Bewerbung</h2>
      <p style="margin:0 0 16px;color:#5B6578;">Ref: <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
      <table style="border-collapse:collapse;">
        ${row('Name', data.name)}
        ${row('E-Mail', data.email)}
        ${row('Telefon', data.phone)}
        ${row('Motivation', data.motivation)}
        ${row('Quelle', data.source_page)}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#7D8798;">Template ${MAIL_TEMPLATE_IDS.career_admin} · kein Datei-Upload</p>
    </div>
  `

  const adminText = [
    `Neue Bewerbung ${leadRef}`,
    `Name: ${data.name}`,
    `E-Mail: ${data.email}`,
    `Telefon: ${data.phone}`,
    `Motivation: ${data.motivation}`,
  ].join('\n')

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
      <h2 style="margin:0 0 12px;">Bewerbung eingegangen</h2>
      <p>Hallo ${esc(data.name)},</p>
      <p>vielen Dank für dein Interesse an DeinTarifheld. Wir haben deine Bewerbung erhalten.</p>
      <p style="color:#5B6578;">Referenz: <strong>${esc(leadRef)}</strong></p>
    </div>
  `

  const customerText = [
    `Hallo ${data.name},`,
    '',
    'vielen Dank für dein Interesse an DeinTarifheld. Wir haben deine Bewerbung erhalten.',
    `Referenz: ${leadRef}`,
  ].join('\n')

  return {
    templateIds: [MAIL_TEMPLATE_IDS.career_admin, MAIL_TEMPLATE_IDS.career_applicant],
    subjectAdmin,
    subjectCustomer,
    adminHtml,
    adminText,
    customerHtml,
    customerText,
    customerEmail: data.email,
    replyTo: data.email,
  }
}

function resolveMailBundle({ channel, leadRef, data, submittedAt }) {
  if (channel === 'private') return buildPrivateMails({ leadRef, data, submittedAt })
  if (channel === 'career') return buildCareerMails({ leadRef, data, submittedAt })
  return buildUnternehmenMails({ leadRef, data, submittedAt })
}

/**
 * Split LEADS_TO_EMAIL into one or more recipients.
 * Comma-separated values are allowed; empty parts are dropped.
 */
export function parseLeadToAddresses(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Internal ops notification for temporary internal_live mode.
 * Includes the submitted inquiry fields (Strom/Gas/Verbrauch/Anbieter etc.).
 * Still omits honeypot, IP, UA, and secrets. No customer confirmation.
 */
export function buildInternalOpsMail({ channel, leadRef, data, submittedAt }) {
  const when = formatWhen(submittedAt)
  if (channel === 'private') {
    const name = data.firstName || 'Interessent'
    const energyType = data.type || 'Tarif'
    return {
      templateIds: [MAIL_TEMPLATE_IDS.private_admin],
      subjectAdmin: `[Privat] ${energyType}-Anfrage — ${name} — ${leadRef}`,
      adminText: [
        `Neue Privat-Tarifanfrage ${leadRef}`,
        `Zeit: ${when}`,
        `Name: ${data.firstName || ''}`,
        `E-Mail: ${data.email || ''}`,
        `Telefon: ${data.phone || ''}`,
        `PLZ: ${data.zip || ''}`,
        `Anbieter: ${data.provider || ''}`,
        `Verbrauch: ${data.usage || ''}`,
        `Tarifart: ${data.type || ''}`,
        `Kanal: ${data.page_source || 'private'}`,
        `Quelle: ${data.source_page || ''}`,
        'Kundenbestätigung: bewusst übersprungen (internal_live)',
      ].join('\n'),
      adminHtml: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
          <h2 style="margin:0 0 12px;">Neue Privat-Tarifanfrage</h2>
          <p style="margin:0 0 16px;color:#5B6578;">Ref <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
          <table style="border-collapse:collapse;">
            ${row('Name', data.firstName)}
            ${row('E-Mail', data.email)}
            ${row('Telefon', data.phone)}
            ${row('PLZ', data.zip)}
            ${row('Anbieter', data.provider)}
            ${row('Verbrauch', data.usage)}
            ${row('Tarifart', data.type)}
            ${row('Kanal', data.page_source)}
            ${row('Quelle', data.source_page)}
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#7D8798;">Kundenbestätigung: übersprungen (internal_live)</p>
        </div>`,
      replyTo: data.email,
    }
  }
  if (channel === 'career') {
    const motivation = String(data.motivation || '')
    return {
      templateIds: [MAIL_TEMPLATE_IDS.career_admin],
      subjectAdmin: `[Karriere] Bewerbung — ${data.name || 'Bewerbung'} — ${leadRef}`,
      adminText: [
        `Neue Karriere-Bewerbung ${leadRef}`,
        `Zeit: ${when}`,
        `Name: ${data.name || ''}`,
        `E-Mail: ${data.email || ''}`,
        `Telefon: ${data.phone || ''}`,
        `Motivation: ${motivation}`,
        `Quelle: ${data.source_page || ''}`,
        'Kundenbestätigung: bewusst übersprungen (internal_live)',
      ].join('\n'),
      adminHtml: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
          <h2 style="margin:0 0 12px;">Neue Karriere-Bewerbung</h2>
          <p style="margin:0 0 16px;color:#5B6578;">Ref <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
          <table style="border-collapse:collapse;">
            ${row('Name', data.name)}
            ${row('E-Mail', data.email)}
            ${row('Telefon', data.phone)}
            ${row('Motivation', motivation)}
            ${row('Quelle', data.source_page)}
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#7D8798;">Kundenbestätigung: übersprungen (internal_live) · kein Datei-Upload</p>
        </div>`,
      replyTo: data.email,
    }
  }
  const energyType = data.energieart || 'Energie'
  return {
    templateIds: [MAIL_TEMPLATE_IDS.business_admin],
    subjectAdmin: `[B2B] ${energyType}-Anfrage — ${data.firma || 'Unternehmen'} — ${leadRef}`,
    adminText: [
      `Neue Unternehmensanfrage ${leadRef}`,
      `Zeit: ${when}`,
      `Firma: ${data.firma || ''}`,
      `Ansprechpartner: ${data.ansprechpartner || ''}`,
      `E-Mail: ${data.email || ''}`,
      `Telefon: ${data.telefon || ''}`,
      `PLZ: ${data.plz || ''}`,
      `Energieart: ${data.energieart || ''}`,
      `Verbrauch Strom: ${data.verbrauchStrom || ''}`,
      `Verbrauch Gas: ${data.verbrauchGas || ''}`,
      `Standorte: ${data.standorte || ''}`,
      `Versorger: ${data.versorger || ''}`,
      `Vertragslaufzeit: ${data.vertragslaufzeit || ''}`,
      `Nachricht: ${data.nachricht || ''}`,
      `Quelle: ${data.source_page || ''}`,
      'Kundenbestätigung: bewusst übersprungen (internal_live)',
    ].join('\n'),
    adminHtml: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033;">
        <h2 style="margin:0 0 12px;">Neue Unternehmensanfrage (${esc(energyType)})</h2>
        <p style="margin:0 0 16px;color:#5B6578;">Ref <strong>${esc(leadRef)}</strong> · ${esc(when)}</p>
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
        <p style="margin:16px 0 0;font-size:12px;color:#7D8798;">Kundenbestätigung: übersprungen (internal_live)</p>
      </div>`,
    replyTo: data.email,
  }
}

function extractProviderId(sendResult) {
  return sendResult?.data?.id || sendResult?.id || null
}

/**
 * LEADS_MAIL_MODE:
 * - mock (safe default): accept without network
 * - fail: deterministic failure path for tests
 * - internal_live: one internal Resend notification, no customer confirmation
 * - live: internal + customer confirmation via Resend (explicit env only)
 * - any other value: fail-closed, no provider network
 */
export async function sendLeadEmails({ leadRef, data, submittedAt, channel = 'business' }) {
  const mode = (process.env.LEADS_MAIL_MODE || 'mock').trim().toLowerCase()

  if (mode === 'mock') {
    return {
      ok: true,
      mode: 'mock',
      code: 'sandbox_accepted',
      mailStatus: 'accepted',
      customerConfirmation: 'n/a',
      templateIds: resolveMailBundle({ channel, leadRef, data, submittedAt }).templateIds,
    }
  }
  if (mode === 'fail') {
    return {
      ok: false,
      mode: 'fail',
      code: 'mail-send-failed',
      mailStatus: 'failed',
      customerConfirmation: 'n/a',
    }
  }

  if (mode === 'internal_live') {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.LEADS_FROM_EMAIL?.trim()
    const to = parseLeadToAddresses(process.env.LEADS_TO_EMAIL)
    if (!apiKey || !from || !to.length) {
      return {
        ok: false,
        code: 'mail-not-configured',
        mode: 'internal_live',
        mailStatus: 'failed',
        customerConfirmation: 'skipped',
      }
    }
    const mail = buildInternalOpsMail({ channel, leadRef, data, submittedAt })
    const resend = new Resend(apiKey)
    const internal = await resend.emails.send({
      from,
      to,
      replyTo: mail.replyTo,
      subject: mail.subjectAdmin,
      text: mail.adminText,
      html: mail.adminHtml,
    })
    if (internal.error) {
      return {
        ok: false,
        code: 'mail-send-failed',
        mode: 'internal_live',
        mailStatus: 'failed',
        customerConfirmation: 'skipped',
        providerErrorCode: internal.error.name || 'resend_error',
      }
    }
    return {
      ok: true,
      mode: 'internal_live',
      mailStatus: 'internal_sent',
      customerConfirmation: 'skipped',
      templateIds: mail.templateIds,
      providerEmailId: extractProviderId(internal),
    }
  }

  if (mode !== 'live') {
    return {
      ok: false,
      mode: mode || 'unknown',
      code: 'mail-mode-unsupported',
      mailStatus: 'failed',
      customerConfirmation: 'n/a',
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.LEADS_FROM_EMAIL?.trim()
  const to = parseLeadToAddresses(process.env.LEADS_TO_EMAIL)

  if (!apiKey || !from || !to.length) {
    return { ok: false, code: 'mail-not-configured', mode: 'live', mailStatus: 'failed', customerConfirmation: 'n/a' }
  }

  const mail = resolveMailBundle({ channel, leadRef, data, submittedAt })
  const resend = new Resend(apiKey)

  const internal = await resend.emails.send({
    from,
    to,
    replyTo: mail.replyTo,
    subject: mail.subjectAdmin,
    text: mail.adminText,
    html: mail.adminHtml,
  })
  if (internal.error) {
    return { ok: false, code: 'mail-send-failed', mode: 'live', mailStatus: 'failed', customerConfirmation: 'n/a' }
  }

  const confirmation = await resend.emails.send({
    from,
    to: [mail.customerEmail],
    replyTo: to[0],
    subject: mail.subjectCustomer,
    text: mail.customerText,
    html: mail.customerHtml,
  })
  if (confirmation.error) {
    return { ok: false, code: 'mail-send-failed', mode: 'live', mailStatus: 'failed', customerConfirmation: 'failed' }
  }

  return {
    ok: true,
    mode: 'live',
    mailStatus: 'accepted',
    customerConfirmation: 'sent',
    templateIds: mail.templateIds,
    providerEmailId: extractProviderId(internal),
  }
}
