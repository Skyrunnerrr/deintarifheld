/**
 * Shared customer-mail shell for the four unified inquiry variants.
 * Preview and future copy only. The send path does not call this module.
 * Unified inquiry stays fail-closed in shouldSendCustomerMail.
 * Import safety helpers from mail-safety.js, never from mail.js.
 */
import { stripMailControls } from './mail-safety.js'

const SITE = 'https://www.deintarifheld.de'
const CONTACT = 'kontakt@deintarifheld.de'
const FONT = 'Arial,Helvetica,sans-serif'

export const CUSTOMER_MAIL_VARIANTS = Object.freeze(['private', 'business', 'partner', 'general'])

const THEMES = Object.freeze({
  private: {
    page: '#090B15',
    card: '#15182A',
    text: '#F5F4F1',
    muted: '#C2CAD6',
    hairline: '#2A3148',
    band: '#D4FF3E',
    bandText: '#090B15',
    ctaBg: '#D4FF3E',
    ctaText: '#090B15',
    link: '#D4FF3E',
    stepBg: '#D4FF3E',
    stepText: '#090B15',
  },
  business: {
    page: '#F5F4F1',
    card: '#FFFFFF',
    text: '#090B15',
    muted: '#5B6578',
    hairline: '#E4DFD6',
    band: '#F98540',
    bandText: '#090B15',
    ctaBg: '#F98540',
    ctaText: '#090B15',
    link: '#B5470A',
    stepBg: '#F98540',
    stepText: '#090B15',
  },
  partner: {
    page: '#090B15',
    card: '#15182A',
    text: '#F5F4F1',
    muted: '#C2CAD6',
    hairline: '#2A3148',
    band: '#0A5ADB',
    bandText: '#FFFFFF',
    ctaBg: '#0A5ADB',
    ctaText: '#FFFFFF',
    link: '#8EB4FF',
    stepBg: '#0A5ADB',
    stepText: '#FFFFFF',
  },
  general: {
    page: '#F5F4F1',
    card: '#FFFFFF',
    text: '#090B15',
    muted: '#5B6578',
    hairline: '#E4DFD6',
    band: '#090B15',
    bandText: '#D4FF3E',
    ctaBg: '#090B15',
    ctaText: '#D4FF3E',
    link: '#1F6B2A',
    stepBg: '#090B15',
    stepText: '#D4FF3E',
  },
})

const COPY = Object.freeze({
  private: {
    typeLabel: 'Privatanfrage',
    subject: 'Deine Anfrage bei DeinTarifheld',
    preheader: 'Deine Anfrage ist eingegangen. Wir sehen uns deine Angaben an und melden uns bei dir.',
    greet: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    thanks:
      'danke für deine Anfrage. Wir haben deine Angaben erhalten und melden uns bei dir.',
    steps: [
      'Wir sehen uns deine Angaben an.',
      'Wir melden uns bei dir.',
      'Du entscheidest selbst. Es passiert nichts automatisch.',
    ],
    ctaLabel: 'Zur Website',
    ctaHref: `${SITE}/`,
    questions: 'Fragen?',
  },
  business: {
    typeLabel: 'Gewerbeanfrage',
    subject: 'Ihre Anfrage bei DeinTarifheld',
    preheader:
      'Ihre Anfrage ist eingegangen. Es erfolgt keine automatische Vertragsänderung oder Beauftragung.',
    greet: (name) => (name ? `Guten Tag ${name},` : 'Guten Tag,'),
    thanks:
      'vielen Dank für Ihre Anfrage. Wir haben Ihre Angaben erhalten. Es erfolgt keine automatische Vertragsänderung oder Beauftragung.',
    steps: [
      'Wir prüfen Ihre Angaben.',
      'Wir melden uns persönlich bei Ihnen.',
      'Ein Vertrag ändert sich nur, wenn Sie das ausdrücklich beauftragen.',
    ],
    ctaLabel: 'Zur Unternehmensseite',
    ctaHref: `${SITE}/unternehmen-neu/`,
    questions: 'Haben Sie Fragen?',
  },
  partner: {
    typeLabel: 'Partneranfrage',
    subject: 'Dein Interesse an einer Zusammenarbeit',
    preheader: 'Danke für dein Interesse an einer Zusammenarbeit. Wir schauen uns deine Nachricht persönlich an.',
    greet: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    thanks:
      'danke für dein Interesse an einer Zusammenarbeit. Wir schauen uns deine Nachricht persönlich an.',
    steps: [
      'Wir lesen dein Anliegen.',
      'Eine Person aus dem Team prüft es.',
      'Wir melden uns, wenn eine Zusammenarbeit passen kann.',
    ],
    ctaLabel: 'Zur Website',
    ctaHref: `${SITE}/`,
    questions: 'Fragen?',
  },
  general: {
    typeLabel: 'Allgemeine Anfrage',
    subject: 'Deine Nachricht an DeinTarifheld',
    preheader: 'Deine Nachricht ist eingegangen. Wir melden uns, wenn wir etwas von dir brauchen.',
    greet: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    thanks: 'danke für deine Nachricht. Wir haben sie erhalten und melden uns, wenn wir etwas von dir brauchen.',
    steps: [
      'Wir haben deine Nachricht.',
      'Wir ordnen sie dem passenden Thema zu.',
      'Wir antworten dir.',
    ],
    ctaLabel: 'Zur Website',
    ctaHref: `${SITE}/`,
    questions: 'Fragen?',
  },
})

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
    return ''
  }
}

export function customerMailVariantForInquiry(inquiryType) {
  if (inquiryType === 'private_energy') return 'private'
  if (inquiryType === 'business_energy') return 'business'
  if (inquiryType === 'partner') return 'partner'
  if (inquiryType === 'general') return 'general'
  return ''
}

function detailRow(theme, label, value, padding) {
  return `
    <tr>
      <td style="padding:${padding};font-family:${FONT};">
        <div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${theme.muted};">${esc(label)}</div>
        <div style="padding-top:4px;font-size:16px;line-height:24px;font-weight:700;color:${theme.text};">${esc(value)}</div>
      </td>
    </tr>`
}

function shellHtml({ theme, copy, name, leadRef, when }) {
  const steps = copy.steps
    .map(
      (step, index) => `
        <tr>
          <td width="40" valign="middle" style="width:40px;padding:8px 12px 8px 0;vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" valign="middle" width="28" height="28" bgcolor="${theme.stepBg}" style="width:28px;height:28px;background:${theme.stepBg};border-radius:14px;color:${theme.stepText};font-family:${FONT};font-size:13px;font-weight:700;line-height:28px;text-align:center;">${index + 1}</td>
              </tr>
            </table>
          </td>
          <td valign="middle" style="padding:8px 0;vertical-align:middle;color:${theme.text};font-family:${FONT};font-size:16px;line-height:24px;">${esc(step)}</td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.page};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.page}" style="background:${theme.page};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 8px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td width="8" height="8" bgcolor="${theme.band}" style="width:8px;height:8px;background:${theme.band};font-size:0;line-height:0;">&nbsp;</td>
                  <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="font-family:${FONT};font-size:20px;line-height:24px;font-weight:700;letter-spacing:-0.02em;color:${theme.text};">DeinTarifheld</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${theme.band}" style="background:${theme.band};color:${theme.bandText};font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.12em;padding:16px 20px;">
              ANFRAGE ERFOLGREICH EINGEGANGEN
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;font-family:${FONT};color:${theme.text};font-size:16px;line-height:24px;">
              <p style="margin:0 0 8px;">${esc(copy.greet(name))}</p>
              <p style="margin:0;">${esc(copy.thanks)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.card}" style="width:100%;background:${theme.card};border:1px solid ${theme.hairline};border-radius:12px;border-collapse:separate;">
                <tr>
                  <td width="4" bgcolor="${theme.band}" style="width:4px;background:${theme.band};font-size:0;line-height:0;border-radius:12px 0 0 12px;">&nbsp;</td>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      ${detailRow(theme, 'Typ', copy.typeLabel, '16px 20px 8px 16px')}
                      ${detailRow(theme, 'Referenz', leadRef, '8px 20px')}
                      ${detailRow(theme, 'Eingegangen', when, '8px 20px 16px 16px')}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 8px;font-family:${FONT};color:${theme.text};font-size:18px;line-height:24px;font-weight:700;">
              Was passiert jetzt?
            </td>
          </tr>
          <tr>
            <td style="padding:0 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${steps}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${theme.ctaBg}" style="background:${theme.ctaBg};border-radius:12px;">
                    <a href="${esc(copy.ctaHref)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${theme.ctaText};text-decoration:none;border-radius:12px;">${esc(copy.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${theme.muted};">
              ${esc(copy.questions)} <a href="mailto:${CONTACT}" style="color:${theme.link};text-decoration:underline;">${CONTACT}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 8px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td height="1" bgcolor="${theme.hairline}" style="height:1px;line-height:1px;font-size:0;background:${theme.hairline};">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px 8px;font-family:${FONT};font-size:12px;line-height:20px;color:${theme.muted};">
              DeinTarifheld<br>
              <a href="${SITE}/impressum/" style="color:${theme.link};text-decoration:underline;">Impressum</a>
              &nbsp;·&nbsp;
              <a href="${SITE}/datenschutz/" style="color:${theme.link};text-decoration:underline;">Datenschutz</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildCustomerMail({ variant, leadRef, name, submittedAt }) {
  if (!CUSTOMER_MAIL_VARIANTS.includes(variant)) {
    throw new Error('unsupported-customer-mail-variant')
  }
  const theme = THEMES[variant]
  const copy = COPY[variant]
  const safeName = stripMailControls(name, 80)
  const safeRef = stripMailControls(leadRef, 80)
  const when = formatWhen(submittedAt)
  const text = [
    copy.subject,
    '',
    copy.preheader,
    '',
    'ANFRAGE ERFOLGREICH EINGEGANGEN',
    '',
    copy.greet(safeName),
    '',
    copy.thanks,
    '',
    `Typ: ${copy.typeLabel}`,
    `Referenz: ${safeRef}`,
    `Eingegangen: ${when}`,
    '',
    'Was passiert jetzt?',
    ...copy.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `${copy.ctaLabel}: ${copy.ctaHref}`,
    '',
    `${copy.questions} ${CONTACT}`,
    '',
    `Impressum: ${SITE}/impressum/`,
    `Datenschutz: ${SITE}/datenschutz/`,
  ].join('\n')

  return {
    variant,
    subject: copy.subject,
    html: shellHtml({ theme, copy, name: safeName, leadRef: safeRef, when }),
    text,
    fromOwnedByServer: true,
    customerGate: 'off',
  }
}
