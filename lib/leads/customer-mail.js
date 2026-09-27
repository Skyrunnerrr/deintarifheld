/**
 * Shared customer-mail shell for the four unified inquiry variants.
 * Preview and future copy only. The send path does not call this module.
 * Unified inquiry stays fail-closed in shouldSendCustomerMail.
 */
import { stripMailControls } from './mail.js'

const SITE = 'https://www.deintarifheld.de'
const CONTACT = 'kontakt@deintarifheld.de'

export const CUSTOMER_MAIL_VARIANTS = Object.freeze(['private', 'business', 'partner', 'general'])

const THEMES = Object.freeze({
  private: {
    page: '#090B15',
    card: '#15182A',
    text: '#F5F4F1',
    muted: '#C2CAD6',
    band: '#D4FF3E',
    bandText: '#090B15',
    ctaBg: '#D4FF3E',
    ctaText: '#090B15',
    link: '#D4FF3E',
  },
  business: {
    page: '#F5F4F1',
    card: '#FFFFFF',
    text: '#090B15',
    muted: '#5B6578',
    band: '#F98540',
    bandText: '#FFFFFF',
    ctaBg: '#F98540',
    ctaText: '#FFFFFF',
    link: '#C65A1A',
  },
  partner: {
    page: '#090B15',
    card: '#15182A',
    text: '#F5F4F1',
    muted: '#C2CAD6',
    band: '#0A5ADB',
    bandText: '#FFFFFF',
    ctaBg: '#0A5ADB',
    ctaText: '#FFFFFF',
    link: '#8EB4FF',
  },
  general: {
    page: '#F5F4F1',
    card: '#FFFFFF',
    text: '#090B15',
    muted: '#5B6578',
    band: '#090B15',
    bandText: '#D4FF3E',
    ctaBg: '#090B15',
    ctaText: '#D4FF3E',
    link: '#1F6B2A',
  },
})

const COPY = Object.freeze({
  private: {
    typeLabel: 'Privatanfrage',
    subject: 'Deine Anfrage bei DeinTarifheld',
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
    greet: (name) => (name ? `Guten Tag ${name},` : 'Guten Tag,'),
    thanks:
      'vielen Dank für Ihre Anfrage. Wir haben Ihre Angaben erhalten. Es erfolgt keine automatische Vertragsänderung und es entsteht keine Provision, solange Sie nichts beauftragen.',
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

function shellHtml({ theme, copy, name, leadRef, when }) {
  const steps = copy.steps
    .map(
      (step, index) => `
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:${theme.link};font-weight:700;font-size:15px;width:28px;">${index + 1}</td>
          <td style="padding:8px 0;color:${theme.text};font-size:15px;line-height:1.45;">${esc(step)}</td>
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(copy.subject)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 4px 16px;font-family:Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${theme.text};">
              DeinTarifheld
            </td>
          </tr>
          <tr>
            <td style="background:${theme.band};color:${theme.bandText};font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:14px 16px;">
              ANFRAGE ERFOLGREICH EINGEGANGEN
            </td>
          </tr>
          <tr>
            <td style="padding:22px 4px 0;font-family:Arial,sans-serif;color:${theme.text};font-size:16px;line-height:1.5;">
              <p style="margin:0 0 12px;">${esc(copy.greet(name))}</p>
              <p style="margin:0;">${esc(copy.thanks)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.card};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:${theme.muted};">
                    Typ<br><span style="color:${theme.text};font-size:16px;">${esc(copy.typeLabel)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:${theme.muted};">
                    Referenz<br><span style="color:${theme.text};font-size:16px;">${esc(leadRef)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:${theme.muted};">
                    Eingegangen<br><span style="color:${theme.text};font-size:16px;">${esc(when)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 4px 0;font-family:Arial,sans-serif;color:${theme.text};font-size:16px;font-weight:700;">
              Was passiert jetzt?
            </td>
          </tr>
          <tr>
            <td style="padding:4px 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;">
                ${steps}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 4px 0;">
              <a href="${esc(copy.ctaHref)}" style="display:inline-block;background:${theme.ctaBg};color:${theme.ctaText};font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:10px;">
                ${esc(copy.ctaLabel)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 4px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:${theme.muted};">
              ${esc(copy.questions)} <a href="mailto:${CONTACT}" style="color:${theme.link};">${CONTACT}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 4px 8px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:${theme.muted};">
              DeinTarifheld<br>
              <a href="${SITE}/impressum/" style="color:${theme.link};">Impressum</a>
              ·
              <a href="${SITE}/datenschutz/" style="color:${theme.link};">Datenschutz</a>
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
