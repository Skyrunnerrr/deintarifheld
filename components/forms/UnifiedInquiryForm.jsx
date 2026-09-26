'use client'

import { useEffect, useRef, useState } from 'react'
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { RecaptchaBox } from '@/components/ui/RecaptchaBox'
import {
  HONEYPOT_FIELD,
  HONEYPOT_FIELD_2,
  checkRateLimit,
  getFormTiming,
  recordFormLoad,
  recordSubmission,
  sanitizePayload,
} from '@/lib/security'
import { CAPTCHA_ACTION_INQUIRY } from '@/lib/leads/captcha-action'
import { leadsApiUrl, newIdempotencyKey, postJsonLead } from '@/lib/leads/browser-api'
import {
  leadSubmitCaptchaClientMessage,
  mapLeadSubmitUserMessage,
  resolveSubmitCaptchaToken,
} from '@/lib/leads/form-submit'
import {
  INQUIRY_TYPES,
  PAGE_SOURCE_INQUIRY,
  isDocumentedInquirySuccess,
  isInquiryType,
} from '@/lib/leads/inquiry-contract'

const TYPE_OPTIONS = [
  { value: 'private_energy', label: 'Strom/Gas privat' },
  { value: 'business_energy', label: 'Strom/Gas Gewerbe' },
  { value: 'partner', label: 'Partner / Zusammenarbeit' },
  { value: 'general', label: 'Allgemeine Anfrage' },
]

const SUBMIT_LABEL = {
  private_energy: 'Kostenlos anfragen',
  business_energy: 'Anfrage senden',
  partner: 'Partneranfrage senden',
  general: 'Nachricht senden',
}

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  plz: '',
  verbrauch: '',
  tarifinfo: '',
  firma: '',
  zaehler: '',
  beschreibung: '',
  motivation: '',
  nachricht: '',
  privacy: false,
}

function fieldError(type, values, tone) {
  const formal = tone === 'formal'
  const errors = {}
  if (!isInquiryType(type)) {
    errors.inquiry_type = formal ? 'Bitte wählen Sie aus, worum es geht.' : 'Bitte wähle aus, worum es geht.'
  }
  if (values.name.trim().length < 2) {
    errors.name = formal ? 'Bitte geben Sie Ihren Namen ein.' : 'Bitte gib deinen Namen ein.'
  }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(values.email.trim())) {
    errors.email = formal ? 'Bitte geben Sie eine gültige E-Mail ein.' : 'Bitte gib eine gültige E-Mail ein.'
  }
  if (values.phone.trim().length < 6) {
    errors.phone = formal ? 'Bitte geben Sie Ihre Telefonnummer ein.' : 'Bitte gib deine Telefonnummer ein.'
  }
  if ((type === 'private_energy' || type === 'business_energy') && !/^\d{5}$/.test(values.plz.trim())) {
    errors.plz = formal ? 'Bitte geben Sie eine gültige fünfstellige PLZ ein.' : 'Bitte gib eine gültige fünfstellige PLZ ein.'
  }
  if (type === 'business_energy' && values.firma.trim().length < 2) {
    errors.firma = formal ? 'Bitte geben Sie den Firmennamen ein.' : 'Bitte gib den Firmennamen ein.'
  }
  if (type === 'partner' && values.motivation.trim().length < 10) {
    errors.motivation = formal
      ? 'Bitte schreiben Sie kurz, warum eine Zusammenarbeit Sie interessiert.'
      : 'Bitte schreib kurz, warum dich eine Zusammenarbeit interessiert.'
  }
  if (type === 'general' && values.nachricht.trim().length < 2) {
    errors.nachricht = formal ? 'Bitte schreiben Sie eine kurze Nachricht.' : 'Bitte schreib eine kurze Nachricht.'
  }
  if (!values.privacy) {
    errors.privacy = formal
      ? 'Bitte bestätigen Sie, dass Sie die Datenschutzerklärung zur Kenntnis genommen haben.'
      : 'Bitte bestätige, dass du die Datenschutzerklärung zur Kenntnis genommen hast.'
  }
  return errors
}

/**
 * One public inquiry form. Captcha action and storage route are server-owned.
 */
export function UnifiedInquiryForm({
  initialType,
  tone = 'informal',
  appearance = 'dark',
  buttonVariant,
  idPrefix = 'inquiry',
}) {
  const lockedType = isInquiryType(initialType) ? initialType : ''
  const [inquiryType, setInquiryType] = useState(lockedType)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [honeypot2, setHoneypot2] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaError, setRecaptchaError] = useState('')
  const lock = useRef(false)
  const attemptKey = useRef('')
  const formId = `${idPrefix}-form`

  useEffect(() => {
    recordFormLoad(formId)
  }, [formId])

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const light = appearance === 'light'
  const inputClass = light
    ? 'bg-white border-[rgba(21,32,51,0.14)] text-[#152033] placeholder:text-[#7D8798]'
    : ''
  const activeType = lockedType || inquiryType
  const variant = buttonVariant || (activeType === 'partner' ? 'partner' : activeType === 'business_energy' ? 'energy' : 'volt')

  async function onSubmit(event) {
    event.preventDefault()
    if (lock.current || submitting) return
    setFormError('')
    setRecaptchaError('')
    const nextErrors = fieldError(activeType, values, tone)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const rl = checkRateLimit(formId)
    if (!rl.allowed) {
      setFormError(`Bitte warte ${rl.remainingSeconds}s und versuche es dann erneut.`)
      return
    }

    lock.current = true
    setSubmitting(true)
    try {
      const captcha = await resolveSubmitCaptchaToken(CAPTCHA_ACTION_INQUIRY, recaptchaToken)
      if (!captcha.ok) {
        setRecaptchaError(leadSubmitCaptchaClientMessage(tone))
        return
      }
      if (!attemptKey.current) attemptKey.current = newIdempotencyKey()
      recordSubmission(formId)
      const payload = {
        ...sanitizePayload({
          inquiry_type: activeType,
          page_source: PAGE_SOURCE_INQUIRY,
          name: values.name,
          email: values.email,
          phone: values.phone,
          plz: values.plz,
          verbrauch: values.verbrauch,
          tarifinfo: values.tarifinfo,
          firma: values.firma,
          zaehler: values.zaehler,
          beschreibung: values.beschreibung,
          motivation: values.motivation,
          nachricht: values.nachricht,
          dsgvo: true,
          form_version: '3.0',
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
          _formLoadedAt: getFormTiming(formId)._formLoadedAt,
          website_url: honeypot,
          company_fax: honeypot2,
        }),
        _recaptchaToken: captcha.token,
      }
      const { res, json } = await postJsonLead(leadsApiUrl(), payload, { idempotencyKey: attemptKey.current })
      if (!isDocumentedInquirySuccess(res.status, json)) {
        setFormError(mapLeadSubmitUserMessage({ status: res.status, code: json?.code }, { tone }))
        return
      }
      attemptKey.current = ''
      setDone(true)
    } catch (error) {
      setFormError(mapLeadSubmitUserMessage({ thrown: error }, { tone }))
    } finally {
      lock.current = false
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
        <p className={`font-display font-bold text-xl ${light ? 'text-[#152033]' : 'text-text-primary'}`}>
          Anfrage gesendet
        </p>
        <p className={`font-body text-sm ${light ? 'text-[#5B6578]' : 'text-text-secondary'}`}>
          {tone === 'formal'
            ? 'Wir haben Ihre Angaben erhalten und melden uns bei Ihnen.'
            : 'Wir haben deine Angaben erhalten und melden uns bei dir.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting}>
      <div className="flex flex-col gap-4">
        {lockedType ? (
          <p className={`font-body text-sm ${light ? 'text-[#5B6578]' : 'text-text-secondary'}`}>
            Worum geht es?{' '}
            <strong className={light ? 'text-[#152033]' : 'text-text-primary'}>
              {TYPE_OPTIONS.find((opt) => opt.value === lockedType)?.label}
            </strong>
          </p>
        ) : (
          <Select
            label="Worum geht es?"
            id={`${idPrefix}-type`}
            required
            placeholder="Bitte auswählen"
            options={TYPE_OPTIONS.filter((opt) => INQUIRY_TYPES.includes(opt.value))}
            value={inquiryType}
            error={errors.inquiry_type}
            className={inputClass}
            onChange={(event) => {
              setInquiryType(event.target.value)
              setErrors((prev) => ({ ...prev, inquiry_type: undefined }))
            }}
          />
        )}

        <Input
          label="Name"
          id={`${idPrefix}-name`}
          required
          autoComplete="name"
          value={values.name}
          error={errors.name}
          className={inputClass}
          onChange={(event) => setField('name', event.target.value)}
        />
        <Input
          label="E-Mail"
          id={`${idPrefix}-email`}
          type="email"
          required
          autoComplete="email"
          value={values.email}
          error={errors.email}
          className={inputClass}
          onChange={(event) => setField('email', event.target.value)}
        />
        <Input
          label="Telefon"
          id={`${idPrefix}-phone`}
          type="tel"
          required
          autoComplete="tel"
          value={values.phone}
          error={errors.phone}
          className={inputClass}
          onChange={(event) => setField('phone', event.target.value)}
        />

        {(activeType === 'private_energy' || activeType === 'business_energy') && (
          <Input
            label="PLZ"
            id={`${idPrefix}-plz`}
            inputMode="numeric"
            required
            maxLength={5}
            autoComplete="postal-code"
            value={values.plz}
            error={errors.plz}
            className={inputClass}
            onChange={(event) => setField('plz', event.target.value)}
          />
        )}
        {activeType === 'private_energy' && (
          <>
            <Input
              label="Verbrauch / Tarifinfo (optional)"
              id={`${idPrefix}-usage`}
              value={values.verbrauch}
              className={inputClass}
              onChange={(event) => setField('verbrauch', event.target.value)}
            />
            <Input
              label="Aktueller Tarif oder Anbieter (optional)"
              id={`${idPrefix}-tariff`}
              value={values.tarifinfo}
              className={inputClass}
              onChange={(event) => setField('tarifinfo', event.target.value)}
            />
          </>
        )}
        {activeType === 'business_energy' && (
          <>
            <Input
              label="Firma"
              id={`${idPrefix}-firma`}
              required
              autoComplete="organization"
              value={values.firma}
              error={errors.firma}
              className={inputClass}
              onChange={(event) => setField('firma', event.target.value)}
            />
            <Input
              label="Zähler (optional)"
              id={`${idPrefix}-meter`}
              value={values.zaehler}
              className={inputClass}
              onChange={(event) => setField('zaehler', event.target.value)}
            />
            <Textarea
              label="Beschreibung (optional)"
              id={`${idPrefix}-note`}
              rows={3}
              value={values.beschreibung}
              className={inputClass}
              onChange={(event) => setField('beschreibung', event.target.value)}
            />
          </>
        )}
        {activeType === 'partner' && (
          <Textarea
            label="Warum interessiert dich eine Zusammenarbeit?"
            id={`${idPrefix}-why`}
            required
            rows={3}
            value={values.motivation}
            error={errors.motivation}
            className={inputClass}
            onChange={(event) => setField('motivation', event.target.value)}
          />
        )}
        {activeType === 'general' && (
          <Textarea
            label="Nachricht"
            id={`${idPrefix}-message`}
            required
            rows={4}
            value={values.nachricht}
            error={errors.nachricht}
            className={inputClass}
            onChange={(event) => setField('nachricht', event.target.value)}
          />
        )}

        <div className="absolute -left-[9999px] h-0 overflow-hidden opacity-0" aria-hidden="true">
          <input
            type="text"
            name={HONEYPOT_FIELD}
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
          <input
            type="text"
            name={HONEYPOT_FIELD_2}
            value={honeypot2}
            onChange={(event) => setHoneypot2(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <Checkbox
          id={`${idPrefix}-privacy`}
          required
          checked={values.privacy}
          error={errors.privacy}
          onChange={(event) => setField('privacy', event.target.checked)}
          label={
            <>
              Ich habe die{' '}
              <a
                href="/datenschutz"
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Datenschutzerklärung
              </a>{' '}
              zur Kenntnis genommen.
            </>
          }
        />

        <RecaptchaBox onToken={setRecaptchaToken} theme={light ? 'light' : 'dark'} action={CAPTCHA_ACTION_INQUIRY} />
        {recaptchaError && (
          <p role="alert" className="text-energy text-xs font-body">
            {recaptchaError}
          </p>
        )}
        {formError && (
          <p role="alert" className="text-energy text-xs font-body">
            {formError}
          </p>
        )}

        <Button type="submit" variant={variant} size="lg" className="w-full justify-center" loading={submitting} disabled={submitting}>
          {submitting ? 'Wird gesendet…' : SUBMIT_LABEL[activeType] || 'Anfrage senden'}
        </Button>
      </div>
    </form>
  )
}
