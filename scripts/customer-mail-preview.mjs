#!/usr/bin/env node
/**
 * Write the four customer-mail variants as local HTML.
 * Does not send mail and does not open the customer gate.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCustomerMail, CUSTOMER_MAIL_VARIANTS } from '../lib/leads/customer-mail.js'

const outDir = join(process.cwd(), 'tmp', 'customer-mail-preview')
const submittedAt = '2026-09-26T08:00:00.000Z'
const samples = {
  private: { name: 'Ada Muster', leadRef: 'PRV-PREVIEW' },
  business: { name: 'Nord GmbH', leadRef: 'B2B-PREVIEW' },
  partner: { name: 'Ada Muster', leadRef: 'PAR-PREVIEW' },
  general: { name: 'Ada Muster', leadRef: 'GEN-PREVIEW' },
}

mkdirSync(outDir, { recursive: true })
const links = []
for (const variant of CUSTOMER_MAIL_VARIANTS) {
  const mail = buildCustomerMail({ variant, submittedAt, ...samples[variant] })
  const file = `${variant}.html`
  writeFileSync(join(outDir, file), mail.html)
  links.push(`<li><a href="${file}">${variant}</a> — ${mail.subject}</li>`)
}
writeFileSync(
  join(outDir, 'index.html'),
  `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Customer mail preview</title></head><body style="font-family:Arial,sans-serif;max-width:640px;margin:32px auto;"><h1>Customer mail preview</h1><p>Gate stays OFF. These files are not sent.</p><ul>${links.join('')}</ul></body></html>`,
)
console.log(`CUSTOMER_MAIL_PREVIEW=${outDir}`)
console.log('CUSTOMER_MAIL_GATE=OFF')
console.log('NO_SEND=YES')
