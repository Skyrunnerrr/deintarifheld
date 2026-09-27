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
    frame: '#10131F',
    frameBorder: '#2A3148',
    card: '#15182A',
    cardBorder: '#31401F',
    text: '#F5F4F1',
    title: '#D4FF3E',
    muted: '#C2CAD6',
    hairline: '#2A3148',
    accent: '#D4FF3E',
    accentText: '#090B15',
    rule: '#D4FF3E',
    link: '#D4FF3E',
    ctaBg: '#D4FF3E',
    ctaText: '#090B15',
    chipBg: '#D4FF3E',
    chipText: '#090B15',
    nodeBg: '#D4FF3E',
    nodeText: '#090B15',
    line: '#3A4A22',
  },
  business: {
    page: '#F5F4F1',
    frame: '#FFFFFF',
    frameBorder: '#E6E4DF',
    card: '#F7F6F3',
    cardBorder: '#E6E4DF',
    text: '#090B15',
    title: '#090B15',
    muted: '#5B6578',
    hairline: '#E6E4DF',
    accent: '#F98540',
    accentText: '#090B15',
    rule: '#F98540',
    link: '#B5470A',
    ctaBg: '#F98540',
    ctaText: '#090B15',
    chipBg: '#F98540',
    chipText: '#090B15',
    nodeBg: '#F98540',
    nodeText: '#090B15',
    line: '#F6D3C0',
  },
  partner: {
    page: '#090B15',
    frame: '#10131F',
    frameBorder: '#243056',
    card: '#15182A',
    cardBorder: '#2A3D6E',
    text: '#F5F4F1',
    title: '#F5F4F1',
    muted: '#C2CAD6',
    hairline: '#243056',
    accent: '#0A5ADB',
    accentText: '#FFFFFF',
    rule: '#8EB4FF',
    link: '#8EB4FF',
    ctaBg: '#0A5ADB',
    ctaText: '#FFFFFF',
    chipBg: '#0A5ADB',
    chipText: '#FFFFFF',
    nodeBg: '#0A5ADB',
    nodeText: '#FFFFFF',
    line: '#1E3A78',
  },
  general: {
    page: '#F5F4F1',
    frame: '#FFFFFF',
    frameBorder: '#E6E4DF',
    card: '#F7F6F3',
    cardBorder: '#E6E4DF',
    text: '#090B15',
    title: '#090B15',
    muted: '#5B6578',
    hairline: '#E6E4DF',
    accent: '#090B15',
    accentText: '#D4FF3E',
    rule: '#D4FF3E',
    link: '#1F6B2A',
    ctaBg: '#090B15',
    ctaText: '#D4FF3E',
    chipBg: '#090B15',
    chipText: '#D4FF3E',
    nodeBg: '#090B15',
    nodeText: '#D4FF3E',
    line: '#E6E4DF',
  },
})

const COPY = Object.freeze({
  private: {
    typeLabel: 'Privatanfrage',
    subject: 'Deine Anfrage bei DeinTarifheld',
    preheader: 'Deine Anfrage ist eingegangen. Wir sehen uns deine Angaben an und melden uns bei dir.',
    chip: 'Eingegangen',
    statusTitle: 'Anfrage bestätigt',
    statusSubtitle: 'Wir haben deine Anfrage.',
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
    chip: 'Eingegangen',
    statusTitle: 'Anfrage bestätigt',
    statusSubtitle: 'Wir haben Ihre Anfrage.',
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
    chip: 'Eingegangen',
    statusTitle: 'Interesse bestätigt',
    statusSubtitle: 'Wir schauen uns deine Nachricht an.',
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
    chip: 'Eingegangen',
    statusTitle: 'Nachricht bestätigt',
    statusSubtitle: 'Wir haben deine Nachricht.',
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

function detailRows(theme, rows) {
  return rows
    .map((row, index) => {
      const rule = index < rows.length - 1 ? `border-bottom:1px solid ${theme.hairline};` : ''
      return `
        <tr>
          <td width="42%" valign="middle" style="width:42%;padding:16px 12px 16px 16px;${rule}font-family:${FONT};font-size:13px;line-height:20px;color:${theme.muted};">${esc(row.label)}</td>
          <td valign="middle" style="padding:16px 16px 16px 12px;${rule}font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:${theme.text};text-align:right;">${esc(row.value)}</td>
        </tr>`
    })
    .join('')
}

function timeline(theme, steps) {
  return steps
    .map((step, index) => {
      const connector =
        index < steps.length - 1
          ? `
        <tr>
          <td width="28" align="center" valign="top" style="width:28px;padding:0;font-size:0;line-height:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center">
              <tr>
                <td width="2" height="24" bgcolor="${theme.line}" style="width:2px;height:24px;background:${theme.line};font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td style="font-size:0;line-height:0;">&nbsp;</td>
        </tr>`
          : ''
      return `
        <tr>
          <td width="28" valign="top" style="width:28px;padding:0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" valign="middle" width="28" height="28" bgcolor="${theme.nodeBg}" style="width:28px;height:28px;background:${theme.nodeBg};border-radius:14px;color:${theme.nodeText};font-family:${FONT};font-size:13px;font-weight:700;line-height:28px;text-align:center;">${index + 1}</td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding:2px 0 2px 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${theme.text};">${esc(step)}</td>
        </tr>${connector}`
    })
    .join('')
}

function shellHtml({ theme, copy, name, leadRef, when }) {
  const facts = detailRows(theme, [
    { label: 'Typ', value: copy.typeLabel },
    { label: 'Referenz', value: leadRef },
    { label: 'Eingegangen', value: when },
  ])

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
      <td align="center" style="padding:32px 16px;">
        <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.frame}" style="width:100%;max-width:560px;background:${theme.frame};border:1px solid ${theme.frameBorder};border-radius:16px;border-collapse:separate;">
          <tr>
            <td style="padding:32px 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td width="12" valign="middle" style="width:12px;padding:0 16px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="12" height="28" bgcolor="${theme.accent}" style="width:12px;height:28px;background:${theme.accent};border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="font-family:${FONT};">
                    <div style="font-size:18px;line-height:24px;font-weight:700;color:${theme.text};">DeinTarifheld</div>
                    <div style="padding-top:2px;font-size:13px;line-height:18px;color:${theme.muted};">${esc(copy.typeLabel)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;font-family:${FONT};">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                <tr>
                  <td bgcolor="${theme.chipBg}" style="background:${theme.chipBg};color:${theme.chipText};border-radius:12px;padding:8px 16px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.04em;">${esc(copy.chip)}</td>
                </tr>
              </table>
              <div style="padding-top:16px;font-size:28px;line-height:34px;font-weight:700;color:${theme.title};">${esc(copy.statusTitle)}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td height="16" style="height:16px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td width="40" height="3" bgcolor="${theme.rule}" style="width:40px;height:3px;background:${theme.rule};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <div style="padding-top:16px;font-size:16px;line-height:24px;color:${theme.muted};">${esc(copy.statusSubtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;font-family:${FONT};color:${theme.text};">
              <div style="font-size:20px;line-height:28px;font-weight:700;">${esc(copy.greet(name))}</div>
              <div style="padding-top:8px;font-size:16px;line-height:26px;">${esc(copy.thanks)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.card}" style="width:100%;background:${theme.card};border:1px solid ${theme.cardBorder};border-radius:14px;border-collapse:separate;border-spacing:0;">
                ${facts}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:700;color:${theme.text};">
              Was passiert jetzt?
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${timeline(theme, copy.steps)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${theme.ctaBg}" style="background:${theme.ctaBg};color:${theme.ctaText};border-radius:12px;padding:14px 24px;">
                    <a href="${esc(copy.ctaHref)}" style="display:block;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${theme.ctaText};text-decoration:none;">${esc(copy.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${theme.muted};">
              ${esc(copy.questions)} <a href="mailto:${CONTACT}" style="color:${theme.link};text-decoration:underline;">${CONTACT}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td height="1" bgcolor="${theme.hairline}" style="height:1px;line-height:1px;font-size:0;background:${theme.hairline};">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 32px;font-family:${FONT};font-size:12px;line-height:20px;color:${theme.muted};">
              DeinTarifheld<br>
              <a href="${SITE}/impressum/" style="color:${theme.link};text-decoration:underline;">Impressum</a>
              &nbsp;·&nbsp;
              <a href="${SITE}/datenschutz/" style="color:${theme.link};text-decoration:underline;">Datenschutz</a>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
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
    copy.chip,
    copy.statusTitle,
    copy.statusSubtitle,
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
