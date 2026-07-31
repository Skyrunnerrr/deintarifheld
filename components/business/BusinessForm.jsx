'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import {
  sanitizePayload,
  isBot,
  HONEYPOT_FIELD,
  HONEYPOT_FIELD_2,
  checkRateLimit,
  recordSubmission,
  recordFormLoad,
  getFormTiming,
  isTooFast,
} from '@/lib/security'
import { BUSINESS_FORM, BUSINESS_TRIGGERS } from '@/lib/business-content'
import { leadsApiUrl, postJsonLead } from '@/lib/leads/browser-api'

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const inputClass =
  'w-full px-4 py-3.5 min-h-[52px] rounded-2xl bg-white border border-[rgba(21,32,51,0.14)] text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#F98540]/55 focus:ring-2 focus:ring-[#F98540]/15 transition-colors'

function ChoiceButton({ active, children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      className={`px-4 py-2.5 min-h-[44px] rounded-2xl border font-body text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-[#FF6B2B] text-white border-[#FF6B2B]'
          : 'bg-white border-[rgba(21,32,51,0.14)] text-text-secondary hover:border-[rgba(21,32,51,0.28)]'
      }`}
    >
      {children}
    </button>
  )
}

function BusinessFormular() {
  const [step, setStep] = useState(1)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [dsgvoError, setDsgvoError] = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [honeypot2, setHoneypot2] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const [form, setForm] = useState({
    energieart: '',
    verbrauchStrom: '',
    verbrauchGas: '',
    standorte: '',
    plz: '',
    firma: '',
    ansprechpartner: '',
    email: '',
    telefon: '',
    versorger: '',
    vertragslaufzeit: '',
    nachricht: '',
    dsgvo: false,
  })

  useEffect(() => {
    recordFormLoad('b2b-form')
  }, [])

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const step1Valid =
    form.energieart !== '' &&
    form.standorte !== '' &&
    form.plz.trim().length === 5 &&
    /^\d{5}$/.test(form.plz.trim())

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const step2Valid =
    form.firma.trim().length >= 2 &&
    form.ansprechpartner.trim().length >= 2 &&
    emailRegex.test(form.email.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (sending) return

    setRateLimitMsg('')
    setValidationErrors({})

    const errs = {}
    if (form.firma.trim().length < 2) errs.firma = 'Bitte geben Sie einen Firmennamen ein'
    if (form.ansprechpartner.trim().length < 2) errs.ansprechpartner = 'Bitte geben Sie einen Ansprechpartner ein'
    if (!emailRegex.test(form.email.trim())) errs.email = 'Bitte geben Sie eine gültige E-Mail ein'
    if (!form.dsgvo) {
      setDsgvoError(true)
      errs.dsgvo = true
    }
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs)
      if (!errs.dsgvo) setDsgvoError(false)
      return
    }
    setDsgvoError(false)

    if (isBot(honeypot, honeypot2)) {
      setDone(true)
      return
    }

    if (isTooFast('b2b-form')) {
      setDone(true)
      return
    }

    const rl = checkRateLimit('b2b-form')
    if (!rl.allowed) {
      setRateLimitMsg(`Bitte warten Sie ${rl.remainingSeconds}s bevor Sie erneut absenden.`)
      return
    }

    setSending(true)
    recordSubmission('b2b-form')
    try {
      const payload = sanitizePayload({
        ...form,
        page_source: 'unternehmen',
        lead_type: 'business_energy',
        form_version: '2.0',
        source_page: typeof window !== 'undefined' ? window.location.pathname : '/unternehmen-neu/',
        timestamp: new Date().toISOString(),
        _formLoadedAt: getFormTiming('b2b-form')._formLoadedAt,
        [HONEYPOT_FIELD]: honeypot,
        [HONEYPOT_FIELD_2]: honeypot2,
      })

      const { res, json } = await postJsonLead(leadsApiUrl(), payload)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.code || `submit-failed-${res.status}`)
      }
      setDone(true)
    } catch (error) {
      console.error('Business form submit error:', error)
      setDone(false)
      setRateLimitMsg('Absenden fehlgeschlagen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.')
    } finally {
      setSending(false)
    }
  }

  const goToStep2 = () => {
    if (!step1Valid) {
      const errs = {}
      if (!form.energieart) errs.energieart = 'Bitte wählen Sie eine Energieart'
      if (!form.standorte) errs.standorte = 'Bitte wählen Sie die Anzahl der Standorte'
      if (form.plz.trim().length !== 5 || !/^\d{5}$/.test(form.plz.trim())) {
        errs.plz = 'Bitte geben Sie eine gültige 5-stellige Postleitzahl ein'
      }
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})
    setStep(2)
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-12 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M6 14l6 6L22 8" stroke="#FF6B2B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-display font-black text-2xl text-text-primary mb-2">{BUSINESS_FORM.successTitle}</p>
          <p className="font-body text-text-secondary text-base max-w-sm">{BUSINESS_FORM.successText}</p>
        </div>
        <Link href="/" className="font-body text-sm text-[#FF6B2B] hover:underline">
          Zurück zur Startseite
        </Link>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-center gap-3 mb-8" aria-label="Formular-Schritte">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm transition-all duration-300 ${
                step >= s
                  ? 'bg-[#FF6B2B] text-white'
                  : 'bg-[#EEF0F4] text-text-tertiary border border-[rgba(21,32,51,0.12)]'
              }`}
            >
              {s}
            </div>
            {s === 1 && (
              <div
                className={`h-px flex-1 w-12 transition-all duration-500 ${
                  step > 1 ? 'bg-[#FF6B2B]/50' : 'bg-[rgba(21,32,51,0.12)]'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
        <div className="ml-2 font-body text-sm text-text-secondary">
          {step === 1 ? 'Verbrauch & Situation' : 'Ihre Kontaktdaten'}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 1, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            <div>
              <label className="block font-body text-sm font-medium text-text-secondary mb-2" id="bneu-energieart-label">
                Energieart *
              </label>
              <div className="flex gap-3 flex-wrap" role="group" aria-labelledby="bneu-energieart-label">
                {['Strom', 'Gas'].map((opt) => (
                  <ChoiceButton
                    key={opt}
                    active={form.energieart === opt}
                    onClick={() => {
                      set('energieart', opt)
                      setValidationErrors((prev) => ({ ...prev, energieart: undefined }))
                    }}
                  >
                    {opt}
                  </ChoiceButton>
                ))}
              </div>
              {validationErrors.energieart && (
                <p role="alert" id="bneu-energieart-error" className="font-body text-[#EF4444] text-xs mt-2">
                  {validationErrors.energieart}
                </p>
              )}
            </div>

            {form.energieart === 'Strom' && (
              <div>
                <label htmlFor="bneu-verbrauchStrom" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Jahresverbrauch Strom (kWh)
                </label>
                <input
                  id="bneu-verbrauchStrom"
                  type="number"
                  min="0"
                  placeholder="z. B. 80000"
                  value={form.verbrauchStrom}
                  onChange={(e) => set('verbrauchStrom', e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {form.energieart === 'Gas' && (
              <div>
                <label htmlFor="bneu-verbrauchGas" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Jahresverbrauch Gas (kWh)
                </label>
                <input
                  id="bneu-verbrauchGas"
                  type="number"
                  min="0"
                  placeholder="z. B. 150000"
                  value={form.verbrauchGas}
                  onChange={(e) => set('verbrauchGas', e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block font-body text-sm font-medium text-text-secondary mb-2" id="bneu-standorte-label">
                Anzahl Standorte *
              </label>
              <div className="flex gap-3 flex-wrap" role="group" aria-labelledby="bneu-standorte-label">
                {['1', '2–5', '6+'].map((opt) => (
                  <ChoiceButton
                    key={opt}
                    active={form.standorte === opt}
                    onClick={() => {
                      set('standorte', opt)
                      setValidationErrors((prev) => ({ ...prev, standorte: undefined }))
                    }}
                  >
                    {opt}
                  </ChoiceButton>
                ))}
              </div>
              {validationErrors.standorte && (
                <p role="alert" id="bneu-standorte-error" className="font-body text-[#EF4444] text-xs mt-2">
                  {validationErrors.standorte}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="bneu-plz" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Postleitzahl *
              </label>
              <input
                id="bneu-plz"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="z. B. 80331"
                value={form.plz}
                onChange={(e) => {
                  set('plz', e.target.value.replace(/\D/g, ''))
                  setValidationErrors((prev) => ({ ...prev, plz: undefined }))
                }}
                className={inputClass}
                aria-required="true"
                aria-invalid={Boolean(validationErrors.plz)}
                aria-describedby={validationErrors.plz ? 'bneu-plz-error' : undefined}
              />
              {validationErrors.plz && (
                <p role="alert" id="bneu-plz-error" className="font-body text-[#EF4444] text-xs mt-2">
                  {validationErrors.plz}
                </p>
              )}
            </div>

            <Button
              variant="energy"
              size="lg"
              type="button"
              onClick={goToStep2}
              className="w-full mt-2"
              aria-disabled={!step1Valid}
            >
              {BUSINESS_FORM.nextLabel}
              <IconArrow />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 1, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            <div>
              <label htmlFor="bneu-firma" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Firmenname *
              </label>
              <input
                id="bneu-firma"
                type="text"
                placeholder="Ihre Firma GmbH"
                value={form.firma}
                onChange={(e) => set('firma', e.target.value)}
                className={inputClass}
                aria-required="true"
                aria-invalid={Boolean(validationErrors.firma)}
                aria-describedby={validationErrors.firma ? 'bneu-firma-error' : undefined}
              />
              {validationErrors.firma && (
                <p role="alert" id="bneu-firma-error" className="font-body text-[#EF4444] text-xs mt-2">
                  {validationErrors.firma}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="bneu-ansprechpartner" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Ansprechpartner *
              </label>
              <input
                id="bneu-ansprechpartner"
                type="text"
                placeholder="Vor- und Nachname"
                value={form.ansprechpartner}
                onChange={(e) => set('ansprechpartner', e.target.value)}
                className={inputClass}
                aria-required="true"
                aria-invalid={Boolean(validationErrors.ansprechpartner)}
                aria-describedby={validationErrors.ansprechpartner ? 'bneu-ansprechpartner-error' : undefined}
              />
              {validationErrors.ansprechpartner && (
                <p role="alert" id="bneu-ansprechpartner-error" className="font-body text-[#EF4444] text-xs mt-2">
                  {validationErrors.ansprechpartner}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bneu-email" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  E-Mail *
                </label>
                <input
                  id="bneu-email"
                  type="email"
                  placeholder="ihre@firma.de"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputClass}
                  aria-required="true"
                  aria-invalid={Boolean(validationErrors.email)}
                  aria-describedby={validationErrors.email ? 'bneu-email-error' : undefined}
                />
                {validationErrors.email && (
                  <p role="alert" id="bneu-email-error" className="font-body text-[#EF4444] text-xs mt-2">
                    {validationErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="bneu-telefon" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Telefon <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="bneu-telefon"
                  type="tel"
                  placeholder="+49 6221 8688877"
                  value={form.telefon}
                  onChange={(e) => set('telefon', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bneu-versorger" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Aktueller Versorger <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="bneu-versorger"
                  type="text"
                  placeholder="z. B. aktueller Versorger"
                  value={form.versorger}
                  onChange={(e) => set('versorger', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="bneu-vertragslaufzeit" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Vertragslaufzeit bekannt?
                </label>
                <select
                  id="bneu-vertragslaufzeit"
                  value={form.vertragslaufzeit}
                  onChange={(e) => set('vertragslaufzeit', e.target.value)}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="">Bitte wählen</option>
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                  <option value="laeuft-bald-aus">Läuft bald aus</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="bneu-nachricht" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Nachricht / Besonderheiten <span className="text-text-tertiary">(optional)</span>
              </label>
              <textarea
                id="bneu-nachricht"
                rows={3}
                placeholder="Standorte, Verbrauchsschwerpunkte oder offene Fragen..."
                value={form.nachricht}
                onChange={(e) => set('nachricht', e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
              <input
                type="text"
                name={HONEYPOT_FIELD}
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
              <input
                type="text"
                name={HONEYPOT_FIELD_2}
                value={honeypot2}
                onChange={(e) => setHoneypot2(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={form.dsgvo}
                  onChange={(e) => {
                    set('dsgvo', e.target.checked)
                    if (e.target.checked) setDsgvoError(false)
                  }}
                  className="sr-only"
                  required
                  aria-label="Datenschutzerklärung akzeptieren"
                />
                <div
                  className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                    form.dsgvo
                      ? 'bg-[#FF6B2B] border-[#FF6B2B]'
                      : 'bg-white border-[rgba(21,32,51,0.28)] group-hover:border-[rgba(21,32,51,0.45)]'
                  }`}
                >
                  {form.dsgvo && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#090B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="font-body text-sm text-text-secondary leading-relaxed">
                {BUSINESS_FORM.dsgvoTextPrefix}{' '}
                <Link href="/datenschutz" className="text-[#FF6B2B] hover:underline" target="_blank" rel="noopener noreferrer">
                  Datenschutzerklärung
                </Link>{' '}
                {BUSINESS_FORM.dsgvoTextSuffix}
              </span>
            </label>

            {dsgvoError && (
              <p role="alert" className="font-body text-[#EF4444] text-xs mt-2 pl-8">
                Bitte stimmen Sie der Datenschutzerklärung zu.
              </p>
            )}

            <div className="flex items-center gap-2 text-text-tertiary">
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
                <rect x="1.5" y="6" width="10" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="font-body text-xs">SSL-verschlüsselt & DSGVO-konform</span>
            </div>

            {rateLimitMsg && (
              <p role="alert" className="font-body text-[#EF4444] text-xs text-center">
                {rateLimitMsg}
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 min-h-[48px] rounded-2xl border border-[rgba(21,32,51,0.14)] text-text-secondary font-body text-sm hover:border-[rgba(21,32,51,0.28)] hover:text-text-primary transition-all duration-200"
              >
                ← Zurück
              </button>
              <Button
                variant="energy"
                size="lg"
                type="submit"
                disabled={!step2Valid || sending}
                loading={sending}
                className="flex-1"
              >
                {sending ? 'Wird gesendet...' : BUSINESS_FORM.submitLabel}
                {!sending && <IconArrow />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}

export function BusinessForm() {
  return (
    <Section id="formular" className="bg-bg-surface">
      <div className="dth-biz-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <SectionLabel variant="energy">{BUSINESS_FORM.label}</SectionLabel>
          <SectionHeading className="dth-section-heading text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
            {BUSINESS_FORM.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-lg sm:text-xl leading-relaxed">
            {BUSINESS_FORM.description}
          </p>

          <div className="flex flex-col gap-3.5 pt-1">
            <h3 className="font-display font-bold text-text-primary text-lg sm:text-xl leading-snug">
              {BUSINESS_TRIGGERS.title}
            </h3>
            <ul className="flex flex-col gap-3" role="list">
              {BUSINESS_TRIGGERS.items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-energy flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3.5 pt-2">
            {BUSINESS_FORM.trustItems.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-energy flex-shrink-0" aria-hidden="true" />
                <span className="font-body text-text-secondary text-base sm:text-lg">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 1, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 dth-form-navy p-7 md:p-10 rounded-[26px] border overflow-hidden relative w-full"
          style={{ minWidth: 0 }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]"
            style={{ background: 'linear-gradient(90deg, #F98540 0%, rgba(249,133,64,0.35) 100%)' }}
            aria-hidden="true"
          />
          <h3 className="font-display font-bold text-text-primary text-xl sm:text-2xl mb-6">
            {BUSINESS_FORM.formHeading}
          </h3>
          <BusinessFormular />
          <p className="mt-5 font-body text-xs text-text-tertiary leading-relaxed border-t border-[rgba(21,32,51,0.08)] pt-4">
            {BUSINESS_FORM.microcopy}
          </p>
        </motion.div>
      </div>
    </Section>
  )
}
