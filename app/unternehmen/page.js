// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Plus, Minus, CheckCircle2, Zap, Building2, ChefHat, MapPin, BarChart3, User, FileText, PhoneCall, Eye } from 'lucide-react'
import { Section, GlowLine, AmbientBg } from '@/components/ui/Background'
import { SectionLabel, SectionHeading, TrustIndicators } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { RecaptchaBox } from '@/components/ui/RecaptchaBox'
import { Footer } from '@/components/sections/Footer'
import { sanitizePayload, isBot, HONEYPOT_FIELD, HONEYPOT_FIELD_2, checkRateLimit, recordSubmission, recordFormLoad, getFormTiming, isTooFast } from '@/lib/security'
import { leadsApiUrl, postJsonLead } from '@/lib/leads/browser-api'

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCheck({ color = '#FF6B2B' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" stroke={color} strokeOpacity="0.3" strokeWidth="1.5" />
      <path d="M6 9l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L2 17h16L10 2z" stroke="#FF6B2B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8v4M10 14v.5" stroke="#FF6B2B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─── 2-Step Formular ─────────────────────────────────────────────────────────

function B2BFormular() {
  const [step, setStep] = useState(1)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [dsgvoError, setDsgvoError] = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [honeypot2, setHoneypot2] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaError, setRecaptchaError] = useState('')

  // Security: record form load time
  useEffect(() => { recordFormLoad('b2b-form') }, [])
  const [validationErrors, setValidationErrors] = useState({})
  const [form, setForm] = useState({
    // Step 1
    energieart: '',
    verbrauchStrom: '',
    verbrauchGas: '',
    standorte: '',
    plz: '',
    // Step 2
    firma: '',
    ansprechpartner: '',
    email: '',
    telefon: '',
    versorger: '',
    vertragslaufzeit: '',
    nachricht: '',
    dsgvo: false,
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const step1Valid =
    form.energieart !== '' &&
    form.standorte !== '' &&
    form.plz.trim().length === 5 && /^\d{5}$/.test(form.plz.trim())

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const step2Valid =
    form.firma.trim().length >= 2 &&
    form.ansprechpartner.trim().length >= 2 &&
    emailRegex.test(form.email.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    setRateLimitMsg('')
    setRecaptchaError('')
    setValidationErrors({})

    // Field-level validation
    const errs = {}
    if (form.firma.trim().length < 2) errs.firma = 'Bitte gib einen Firmennamen ein'
    if (form.ansprechpartner.trim().length < 2) errs.ansprechpartner = 'Bitte gib einen Ansprechpartner ein'
    if (!emailRegex.test(form.email.trim())) errs.email = 'Bitte gib eine gültige E-Mail ein'
    if (!form.dsgvo) { setDsgvoError(true); errs.dsgvo = true }
    if (Object.keys(errs).length > 0) { setValidationErrors(errs); if (!errs.dsgvo) setDsgvoError(false); return }
    setDsgvoError(false)

    // Honeypot check (dual fields)
    if (isBot(honeypot, honeypot2)) { setDone(true); return }

    // Timing-based bot detection
    if (isTooFast('b2b-form')) { setDone(true); return }

    // Rate limiting
    const rl = checkRateLimit('b2b-form')
    if (!rl.allowed) { setRateLimitMsg(`Bitte warten Sie ${rl.remainingSeconds}s bevor Sie erneut absenden.`); return }

    if (!recaptchaToken) {
      setRecaptchaError('Bitte bestaetigen Sie das Captcha.')
      return
    }

    setSending(true)
    recordSubmission('b2b-form')
    try {
      const payload = sanitizePayload({
        ...form,
        page_source: 'unternehmen',
        lead_type: 'business_energy',
        brand_theme: 'unternehmen',
        form_version: '2.0',
        timestamp: new Date().toISOString(),
        _formLoadedAt: getFormTiming('b2b-form')._formLoadedAt,
        _recaptchaToken: recaptchaToken,
        _recaptchaAction: 'unternehmen',
        source_page: '/unternehmen/',
        website_url: honeypot,
        company_fax: honeypot2,
      })
      const { res, json } = await postJsonLead(leadsApiUrl(), payload)
      if (!res.ok || !json?.ok) throw new Error(json?.code || 'submit-failed')
      setDone(true)
    } catch (error) {
      console.error('B2B submit error:', error)
      setRateLimitMsg('Absenden fehlgeschlagen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-12 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M6 14l6 6L22 8" stroke="#FF6B2B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-display font-black text-2xl text-text-primary mb-2">Anfrage eingegangen!</p>
          <p className="font-body text-text-secondary text-base max-w-sm">
            Ihr persönlicher Ansprechpartner meldet sich innerhalb von 24 Stunden bei Ihnen — per E-Mail oder Telefon, wie Sie es bevorzugen.
          </p>
        </div>
        <Link href="/" className="font-body text-sm text-[#FF6B2B] hover:underline">
          Zurück zur Startseite
        </Link>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Step Indicator */}
      <div className="flex items-center gap-3 mb-8" aria-label="Formular-Schritte">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm transition-all duration-300 ${
                step >= s
                  ? 'bg-[#FF6B2B] text-white'
                  : 'bg-white/8 text-text-tertiary border border-white/10'
              }`}
            >
              {s}
            </div>
            {s === 1 && (
              <div
                className={`h-px flex-1 w-12 transition-all duration-500 ${
                  step > 1 ? 'bg-[#FF6B2B]/50' : 'bg-white/10'
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
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            {/* Energieart */}
            <div>
              <label className="block font-body text-sm font-medium text-text-secondary mb-2">
                Energieart *
              </label>
              <div className="flex gap-3 flex-wrap">
                {['Strom', 'Gas'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set('energieart', opt)}
                    className={`px-4 py-2.5 rounded-2xl border font-body text-sm font-medium transition-all duration-200 ${
                      form.energieart === opt
                        ? 'bg-[#FF6B2B] text-white border-[#FF6B2B]'
                        : 'bg-bg-surface border-white/10 text-text-secondary hover:border-white/20'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Verbrauch Strom */}
            {form.energieart === 'Strom' && (
              <div>
                <label htmlFor="verbrauchStrom" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Jahresverbrauch Strom (kWh)
                </label>
                <input
                  id="verbrauchStrom"
                  type="number"
                  min="0"
                  placeholder="z. B. 80000"
                  value={form.verbrauchStrom}
                  onChange={e => set('verbrauchStrom', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
                />
              </div>
            )}

            {/* Verbrauch Gas */}
            {form.energieart === 'Gas' && (
              <div>
                <label htmlFor="verbrauchGas" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Jahresverbrauch Gas (kWh)
                </label>
                <input
                  id="verbrauchGas"
                  type="number"
                  min="0"
                  placeholder="z. B. 150000"
                  value={form.verbrauchGas}
                  onChange={e => set('verbrauchGas', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
                />
              </div>
            )}

            {/* Standorte */}
            <div>
              <label className="block font-body text-sm font-medium text-text-secondary mb-2">
                Anzahl Standorte *
              </label>
              <div className="flex gap-3 flex-wrap">
                {['1', '2–5', '6+'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set('standorte', opt)}
                    className={`px-4 py-2.5 rounded-2xl border font-body text-sm font-medium transition-all duration-200 ${
                      form.standorte === opt
                        ? 'bg-[#FF6B2B] text-white border-[#FF6B2B]'
                        : 'bg-bg-surface border-white/10 text-text-secondary hover:border-white/20'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* PLZ */}
            <div>
              <label htmlFor="plz" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Postleitzahl *
              </label>
              <input
                id="plz"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="z. B. 80331"
                value={form.plz}
                onChange={e => set('plz', e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
              />
            </div>

            <Button
              variant="energy"
              size="lg"
              type="button"
              disabled={!step1Valid}
              onClick={() => step1Valid && setStep(2)}
              className="w-full mt-2"
            >
              Weiter — kostenlose Analyse anfragen
              <IconArrow />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            {/* Firma */}
            <div>
              <label htmlFor="firma" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Firmenname *
              </label>
              <input
                id="firma"
                type="text"
                placeholder="Ihre Firma GmbH"
                value={form.firma}
                onChange={e => set('firma', e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
              />
            </div>

            {/* Ansprechpartner */}
            <div>
              <label htmlFor="ansprechpartner" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Ansprechpartner *
              </label>
              <input
                id="ansprechpartner"
                type="text"
                placeholder="Vor- und Nachname"
                value={form.ansprechpartner}
                onChange={e => set('ansprechpartner', e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
              />
            </div>

            {/* Email + Telefon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  E-Mail *
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="ihre@firma.de"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="telefon" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Telefon <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="telefon"
                  type="tel"
                  placeholder="+49 800 000 0000"
                  value={form.telefon}
                  onChange={e => set('telefon', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
                />
              </div>
            </div>

            {/* Versorger + Laufzeit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="versorger" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Aktueller Versorger <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="versorger"
                  type="text"
                  placeholder="z. B. E.ON, EnBW, ..."
                  value={form.versorger}
                  onChange={e => set('versorger', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="vertragslaufzeit" className="block font-body text-sm font-medium text-text-secondary mb-2">
                  Vertragslaufzeit bekannt?
                </label>
                <select
                  id="vertragslaufzeit"
                  value={form.vertragslaufzeit}
                  onChange={e => set('vertragslaufzeit', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base focus:outline-none focus:border-[#FF6B2B]/40 transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Bitte wählen</option>
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                  <option value="laeuft-bald-aus">Läuft bald aus</option>
                </select>
              </div>
            </div>

            {/* Nachricht */}
            <div>
              <label htmlFor="nachricht" className="block font-body text-sm font-medium text-text-secondary mb-2">
                Nachricht / Besonderheiten <span className="text-text-tertiary">(optional)</span>
              </label>
              <textarea
                id="nachricht"
                rows={3}
                placeholder="Besondere Anforderungen, Fragen oder Informationen..."
                value={form.nachricht}
                onChange={e => set('nachricht', e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-bg-input border border-white/10 text-text-primary font-body text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF6B2B]/40 transition-colors resize-none"
              />
            </div>

            {/* Honeypot — unsichtbar für echte Nutzer */}
            <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
              <input type="text" name={HONEYPOT_FIELD} value={honeypot} onChange={e => setHoneypot(e.target.value)} autoComplete="off" tabIndex={-1} />
              <input type="text" name={HONEYPOT_FIELD_2} value={honeypot2} onChange={e => setHoneypot2(e.target.value)} autoComplete="off" tabIndex={-1} />
            </div>

            {/* Validierungsfehler */}
            {validationErrors.firma && <p role="alert" className="font-body text-[#EF4444] text-xs">{ validationErrors.firma }</p>}
            {validationErrors.ansprechpartner && <p role="alert" className="font-body text-[#EF4444] text-xs">{ validationErrors.ansprechpartner }</p>}
            {validationErrors.email && <p role="alert" className="font-body text-[#EF4444] text-xs">{ validationErrors.email }</p>}

            {/* DSGVO */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={form.dsgvo}
                  onChange={e => { set('dsgvo', e.target.checked); if (e.target.checked) setDsgvoError(false) }}
                  className="sr-only"
                  required
                  aria-label="Datenschutzerklärung akzeptieren"
                />
                <div
                  className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                    form.dsgvo
                      ? 'bg-[#FF6B2B] border-[#FF6B2B]'
                      : 'bg-transparent border-white/20 group-hover:border-white/40'
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
                Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
                <Link href="/datenschutz" className="text-[#FF6B2B] hover:underline" target="_blank" rel="noopener noreferrer">
                  Datenschutzerklärung
                </Link>{' '}
                zu. Die Einwilligung kann jederzeit widerrufen werden.*
              </span>
            </label>

            {dsgvoError && (
              <p role="alert" className="font-body text-[#EF4444] text-xs mt-2 pl-8">
                Bitte stimmen Sie der Datenschutzerklärung zu.
              </p>
            )}

            <RecaptchaBox onToken={setRecaptchaToken} theme="dark" action="unternehmen" />

            {recaptchaError && (
              <p role="alert" className="font-body text-[#EF4444] text-xs">{recaptchaError}</p>
            )}

            {/* SSL-Hinweis */}
            <div className="flex items-center gap-2 text-text-tertiary">
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
                <rect x="1.5" y="6" width="10" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="font-body text-xs">SSL-verschlüsselt & DSGVO-konform</span>
            </div>

            {rateLimitMsg && (
              <p role="alert" className="font-body text-[#EF4444] text-xs text-center">{rateLimitMsg}</p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-2xl border border-white/10 text-text-secondary font-body text-sm hover:border-white/20 hover:text-text-primary transition-all duration-200"
              >
                ← Zurück
              </button>
              <Button
                variant="energy"
                size="lg"
                type="submit"
                disabled={!step2Valid}
                loading={sending}
                className="flex-1"
              >
                {sending ? 'Wird gesendet...' : 'Analyse anfordern'}
                {!sending && <IconArrow />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ question, answer, index }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border transition-all duration-300 ${
        open
          ? 'bg-bg-elevated border-energy/20 border-l-[3px] border-l-[#FF6B2B]'
          : 'bg-bg-surface border-white/6 hover:border-white/12'
      }`}
    >
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy/40 rounded-2xl"
        aria-expanded={open}
        aria-controls={`b2b-faq-${index}`}
      >
        <span className="font-display font-bold text-base md:text-lg text-text-primary pr-4">
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
            open ? 'bg-energy text-white' : 'bg-white/8 text-text-secondary'
          }`}
          aria-hidden="true"
        >
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`b2b-faq-${index}`}
            role="region"
            aria-label={question}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-1">
              <div className="w-full h-px bg-white/6 mb-4" aria-hidden="true" />
              <p className="font-body text-text-secondary text-sm sm:text-base leading-relaxed">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ZIELGRUPPEN = [
  {
    icon: Building2,
    title: 'Gewerbe & Einzelhandel',
    desc: 'Strom- und Gasoptimierung für Shops, Praxen, Werkstätten & Büros aller Größen.',
    color: '#FF6B2B',
  },
  {
    icon: BarChart3,
    title: 'Produktion & Industrie',
    desc: 'Hoher Verbrauch? Individuelle Konditionen statt Standardtarife — für Ihr spezifisches Lastprofil.',
    color: '#E55A1F',
  },
  {
    icon: ChefHat,
    title: 'Gastronomie & Hotel',
    desc: 'Stabile, planbare Preise für verlässliche Betriebskosten — unabhängig von Marktschwankungen.',
    color: '#FF8B5A',
  },
  {
    icon: MapPin,
    title: 'Mehrere Standorte',
    desc: 'Gebündelte Lösungen für Filialisten, Verwaltungen & Immobilien — alles aus einer Hand.',
    color: '#FF6B2B',
  },
]

const PROZESS_SCHRITTE = [
  {
    nr: '01',
    title: 'Anfrage (2 Minuten)',
    desc: 'Verbrauch und Situation kurz beschreiben — online oder per Telefon. Kein Papierkram zu Beginn.',
  },
  {
    nr: '02',
    title: 'Individuelle Analyse (24–48h)',
    desc: 'Wir prüfen Ihren aktuellen Vertrag, analysieren Ihr Verbrauchsprofil und vergleichen passende Angebote.',
  },
  {
    nr: '03',
    title: 'Persönliches Gespräch',
    desc: 'Ein Ansprechpartner erklärt Ihnen die besten Optionen — klar, verständlich, ohne Druck.',
  },
  {
    nr: '04',
    title: 'Umsetzung (optional)',
    desc: 'Wenn Sie wechseln möchten: Wir übernehmen alles. Kündigung, Anmeldung, Kommunikation.',
  },
]

const VORTEILE = [
  {
    icon: User,
    title: 'Persönlicher Ansprechpartner',
    desc: 'Kein Callcenter. Immer dieselbe Person.',
  },
  {
    icon: FileText,
    title: 'Individuelle Lösungen',
    desc: 'Ihr Verbrauch, Ihr Profil, Ihr Angebot — kein Einheitstarif.',
  },
  {
    icon: Eye,
    title: 'Analyse bestehender Verträge',
    desc: 'Wir prüfen was Sie aktuell zahlen — und warum.',
  },
  {
    icon: MapPin,
    title: 'Mehrere Standorte',
    desc: 'Bündelung & einheitliche Betreuung für Ihre gesamte Unternehmensstruktur.',
  },
]

const FAQ_B2B = [
  {
    q: 'Ab wann lohnt sich das?',
    a: 'Bereits ab einem Jahresverbrauch von ca. 10.000 kWh können wir bessere Konditionen finden. Ab 50.000 kWh werden individuelle Angebote möglich, die weit über Standard-Vergleichsportale hinausgehen.',
  },
  {
    q: 'Wir haben noch einen laufenden Vertrag.',
    a: 'Kein Problem. Wir analysieren Ihren aktuellen Vertrag, prüfen Kündigungsfristen und bereiten den optimalen Zeitpunkt für einen Wechsel vor — sodass kein Euro verloren geht.',
  },
  {
    q: 'Was kostet die Beratung?',
    a: 'Unsere Analyse und Beratung ist für Sie vollständig kostenlos. Wir werden über Provisionen der Energieanbieter vergütet — ausschließlich wenn ein Wechsel stattfindet und nur wenn er für Sie sinnvoll ist.',
  },
  {
    q: 'Was ist Spotmarkt — ist das riskant?',
    a: 'Marktnahe Modelle können Vorteile bieten wenn die Energiepreise sinken, tragen aber auch Schwankungsrisiken. Ob das für Ihr Unternehmen passt, hängt von Verbrauch, Liquidität und Planungshorizont ab. Wir empfehlen nur was wirklich zu Ihrer Situation passt.',
  },
  {
    q: 'Brauchen wir dafür viele Unterlagen?',
    a: 'Nein. Für die erste Analyse reichen: Jahresverbrauch, aktueller Arbeitspreis und PLZ. Für ein individuelles Angebot benötigen wir ggf. Ihre letzte Rechnung oder Zählernummer.',
  },
  {
    q: 'Können mehrere Standorte berücksichtigt werden?',
    a: 'Ja — wir betreuen auch Unternehmen mit mehreren Liegenschaften und erzielen durch Bündelung oft bessere Konditionen.',
  },
  {
    q: 'Ist die Anfrage wirklich unverbindlich?',
    a: 'Ja. Sie erhalten eine Analyse und können dann frei entscheiden. Keine Unterschrift, kein Druck, keine automatische Beauftragung.',
  },
  {
    q: 'Was passiert nach der Anfrage?',
    a: 'Sie erhalten innerhalb von 24h eine Rückmeldung von einem persönlichen Ansprechpartner — per E-Mail oder Telefon, wie Sie es bevorzugen.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnternehmenPage() {
  return (
    <>

      {/* ── BLOCK 1: HERO ──────────────────────────────────────────────────── */}
      <section
        id="hero-b2b"
        className="relative w-full min-h-screen flex items-center overflow-hidden bg-bg-base pt-16 sm:pt-24 pb-12 sm:pb-20"
        aria-labelledby="hero-b2b-heading"
      >
        <AmbientBg variant="energy" />
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30" aria-hidden="true"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Energy-toned gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(255,107,43,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl">
            {/* Sub-Label */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionLabel variant="energy">Für Unternehmen &amp; Gewerbe</SectionLabel>
            </motion.div>

            {/* H1 */}
            <motion.h1
              id="hero-b2b-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-black text-text-primary mt-6 mb-6"
              style={{ fontSize: 'clamp(2.25rem, 6vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
            >
              Energiekosten senken.{' '}
              <br className="hidden sm:block" />
              <span className="text-gradient-energy">Planbar. Persönlich.</span>
              <br className="hidden sm:block" />
              Professionell.
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="font-body text-text-secondary text-base sm:text-xl leading-relaxed mb-6 sm:mb-8 max-w-2xl"
            >
              Tarifheld analysiert Ihren aktuellen Energie-Vertrag, vergleicht Konditionen
              und findet die optimale Lösung — für Ihren Verbrauch, Ihre Situation, Ihren Standort.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.26 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <Button
                variant="energy"
                size="lg"
                onClick={() => document.getElementById('formular')?.scrollIntoView({ behavior: 'smooth' })}
                className="whitespace-normal text-center text-[15px] leading-snug sm:text-lg px-5 sm:px-8 h-auto min-h-[56px] py-3 sm:py-4"
              >
                Kostenlose Unternehmens-Analyse anfragen
                <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              </Button>
              <a
                href="mailto:kontakt@deintarifheld.de"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-3 sm:py-4 min-h-[56px] rounded-2xl border border-white/10 bg-bg-elevated text-text-primary font-display font-bold text-[15px] leading-snug sm:text-lg hover:bg-bg-overlay hover:border-white/20 transition-all duration-200 text-center whitespace-normal"
              >
                <PhoneCall className="w-5 h-5" aria-hidden="true" />
                Telefontermin vereinbaren
              </a>
            </motion.div>

            {/* Trust Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.36 }}
            >
              <TrustIndicators
                variant="energy"
                items={[
                  'Kostenlos & unverbindlich',
                  'Persönlicher Ansprechpartner',
                  'Auch für mehrere Standorte',
                ]}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <GlowLine color="energy" />

      {/* ── BLOCK 2: FÜR WEN ───────────────────────────────────────────────── */}
      <Section id="zielgruppen" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">Für wen ist das relevant?</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
            Maßgeschneidert für{' '}
            <span className="text-gradient-energy">jede Unternehmensgröße</span>
          </SectionHeading>
          <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl">
            Ob Einzelbetrieb oder Filialstruktur — wir finden die passende Lösung für Ihre Situation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ZIELGRUPPEN.map((z, i) => {
            const Icon = z.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-4 p-6 rounded-3xl border border-white/6 bg-bg-surface hover:border-white/12 transition-all duration-300 group cursor-default"
                onClick={() => document.getElementById('formular')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: `${z.color}18`, border: `1px solid ${z.color}30` }}
                >
                  <Icon className="w-6 h-6" style={{ color: z.color }} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug mb-2 group-hover:text-white transition-colors">
                    {z.title}
                  </h3>
                  <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">
                    {z.desc}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Section>

      <GlowLine color="white" />

      {/* ── BLOCK 3: DAS PROBLEM ───────────────────────────────────────────── */}
      <Section id="problem" className="bg-bg-surface">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <SectionLabel variant="energy">Das Problem</SectionLabel>
            <SectionHeading className="mt-5 mb-6 text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
              Viele Unternehmen zahlen mehr als nötig —{' '}
              <span className="text-gradient-energy">und merken es erst Jahre später.</span>
            </SectionHeading>
            <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed mb-6 sm:mb-8">
              Der Energiemarkt ist komplex und verändert sich ständig. Pauschallösungen passen selten wirklich.
              Wer nicht aktiv handelt, verliert Jahr für Jahr bares Geld.
            </p>
            <Button
              variant="energy"
              size="md"
              onClick={() => document.getElementById('formular')?.scrollIntoView({ behavior: 'smooth' })}
              className="whitespace-normal text-center leading-snug min-h-[52px]"
            >
              Einsparpotenzial prüfen lassen
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Button>
          </motion.div>

          <div className="flex flex-col gap-5">
            {[
              {
                title: 'Auslaufende Verträge ohne Nachverhandlung',
                desc: 'Wer nicht aktiv handelt, landet automatisch in teuren Folgetarifen. Anbieter setzen darauf.',
              },
              {
                title: 'Standardtarife für nicht-standardisierte Verbräuche',
                desc: 'Ihr Verbrauchsprofil ist individuell — Ihr Tarif sollte es auch sein. Einheitslösungen kosten Sie Marge.',
              },
              {
                title: 'Keine Zeit für Tarifrecherche',
                desc: 'Kerngeschäft geht vor. Energiebeschaffung bleibt liegen. Die Kosten steigen leise weiter.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-4 p-5 rounded-2xl border border-energy/15 bg-energy/5"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <IconWarning />
                </div>
                <div>
                  <h3 className="font-display font-bold text-text-primary text-[15px] sm:text-base leading-snug mb-1">{item.title}</h3>
                  <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      <GlowLine color="energy" />

      {/* ── BLOCK 4: BESCHAFFUNGSMODELLE ───────────────────────────────────── */}
      <Section id="modelle" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">Beschaffungsmodelle</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
            Welches Modell passt zu{' '}
            <span className="text-gradient-energy">Ihrem Unternehmen?</span>
          </SectionHeading>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Festpreise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-5 p-5 md:p-8 rounded-3xl border border-energy/20 bg-bg-elevated overflow-hidden relative"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{ background: 'linear-gradient(90deg, #FF6B2B 0%, rgba(255,107,43,0.3) 100%)' }}
              aria-hidden="true"
            />
            <div>
              <p className="font-body text-sm text-energy font-semibold mb-2 uppercase tracking-wider">Planbare Festpreise</p>
              <h3 className="font-display font-black text-text-primary text-[1.3rem] sm:text-2xl leading-tight mb-3">
                Sicherheit & Planbarkeit
              </h3>
              <p className="font-body text-text-secondary text-[15px] sm:text-base leading-relaxed">
                Sie kennen Ihre Kosten im Voraus. Ideal wenn Planbarkeit wichtiger ist als maximale Flexibilität.
              </p>
            </div>
            <ul className="flex flex-col gap-3" role="list">
              {[  
                'Fester ct/kWh-Preis für 1–3 Jahre',
                'Budgetsicherheit für Ihre Kalkulation',
                'Kein Marktrisiko',
                'Ideal für Gastronomie, Handel, Büro',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <IconCheck color="#FF6B2B" />
                  <span className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Spotmarkt */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex flex-col gap-5 p-5 md:p-8 rounded-3xl border border-energy-dim/20 bg-bg-elevated overflow-hidden relative"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{ background: 'linear-gradient(90deg, #E55A1F 0%, rgba(229,90,31,0.3) 100%)' }}
              aria-hidden="true"
            />
            <div>
              <p className="font-body text-sm text-energy-dim font-semibold mb-2 uppercase tracking-wider">Marktnahe Modelle</p>
              <h3 className="font-display font-black text-text-primary text-[1.3rem] sm:text-2xl leading-tight mb-3">
                Flexibilität & Transparenz
              </h3>
              <p className="font-body text-text-secondary text-[15px] sm:text-base leading-relaxed">
                Ihr Preis orientiert sich am aktuellen Energiemarkt — mit Chancen auf günstigere Phasen und transparenter Preisbildung.
              </p>
            </div>
            <ul className="flex flex-col gap-3" role="list">
              {[
                'Monatlich variabler Preis',
                'Profitieren wenn Marktpreise sinken',
                'Volle Transparenz über Preisbildung',
                'Ideal ab ca. 200.000 kWh Jahresverbrauch',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <IconCheck color="#E55A1F" />
                  <span className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Info-Box */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border-l-4 border-l-energy border border-energy/15 bg-energy/5 p-6"
        >
          <h4 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug mb-2">
            Welches Modell passt zu Ihnen?
          </h4>
          <p className="font-body text-text-secondary text-[15px] sm:text-base leading-relaxed">
            Das hängt von Verbrauch, Risikobereitschaft und Planungshorizont ab.
            Wir analysieren das gemeinsam — <strong className="text-text-primary">kostenlos und ohne Verpflichtung.</strong>
          </p>
        </motion.div>
      </Section>

      <GlowLine color="white" />

      {/* ── BLOCK 5: 50k-SCHWELLE & ABLAUF ─────────────────────────────────── */}
      <Section id="ablauf" className="bg-bg-surface">

        {/* 50k Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border-l-4 border-l-energy border border-energy/15 bg-energy/5 p-6 mb-14"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-energy/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-energy" aria-hidden="true" />
              </div>
              <p className="font-display font-black text-energy text-base sm:text-lg leading-snug">Ab 50.000 kWh:</p>
            </div>
            <p className="font-body text-text-secondary text-[15px] sm:text-base leading-relaxed">
              <span className="text-text-primary font-medium">Individuelle Angebote & persönliche Beratung</span> —
              jenseits von Standard-Vergleichsportalen. Auch darunter? Kein Problem — wir finden den optimalen Tarif für Ihren Bedarf.
            </p>
          </div>
        </motion.div>

        {/* Ablauf */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">So funktioniert&apos;s</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
            So läuft die{' '}
            <span className="text-gradient-energy">Unternehmens-Analyse ab</span>
          </SectionHeading>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PROZESS_SCHRITTE.map((schritt, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col gap-4 p-6 rounded-3xl bg-bg-elevated border border-white/6 hover:border-energy/20 transition-colors duration-300"
            >
              {/* Connector line */}
              {i < 3 && (
                <div
                  className="hidden lg:block absolute top-10 left-full w-6 h-px bg-gradient-to-r from-white/15 to-transparent"
                  aria-hidden="true"
                />
              )}
              <div className="font-display font-black text-4xl text-energy/20 leading-none select-none" aria-hidden="true">
                {schritt.nr}
              </div>
              <div>
                <h3 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug mb-2">{schritt.title}</h3>
                <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">{schritt.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center font-body text-text-tertiary text-sm mt-8"
        >
          Die Analyse ist kostenlos. Eine Entscheidung ist nicht erforderlich.
        </motion.p>
      </Section>

      <GlowLine color="energy" />

      {/* ── BLOCK 6: VORTEILE ──────────────────────────────────────────────── */}
      <Section id="vorteile" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">Ihre Vorteile</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
            Was Sie von Tarifheld{' '}
            <span className="text-gradient-energy">erwarten können</span>
          </SectionHeading>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {VORTEILE.map((v, i) => {
            const Icon = v.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-4 p-6 rounded-2xl border border-white/6 bg-bg-surface hover:border-energy/20 hover:bg-bg-elevated transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-energy/10 border border-energy/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-energy" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-text-primary text-[15px] sm:text-base leading-snug mb-1">{v.title}</h3>
                  <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">{v.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Section>

      <GlowLine color="white" />

      {/* ── BLOCK 7: FAQ ───────────────────────────────────────────────────── */}
      <Section id="faq-b2b" className="bg-bg-surface">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">Häufige Fragen</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
            Alle Antworten — damit{' '}
            <span className="text-gradient-energy">keine Fragen offenbleiben</span>
          </SectionHeading>
        </motion.div>

        <div
          className="max-w-3xl mx-auto flex flex-col gap-3"
          role="list"
          aria-label="Häufig gestellte Fragen für Firmenkunden"
        >
          {FAQ_B2B.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} index={i} />
          ))}
        </div>
      </Section>

      <GlowLine color="energy" />

      {/* ── BLOCK 8: FORMULAR ──────────────────────────────────────────────── */}
      <Section id="formular" className="bg-bg-base">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left: Intro */}
          <div className="flex flex-col gap-6">
            <SectionLabel variant="energy">Kostenlose Analyse</SectionLabel>
            <SectionHeading className="text-[1.9rem] sm:text-4xl md:text-5xl leading-[1.14]">
              Bereit für Ihre{' '}
              <span className="text-gradient-energy">unverbindliche Analyse?</span>
            </SectionHeading>
            <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
              Wir prüfen Ihre aktuelle Situation und zeigen Ihnen klar auf, ob und wie Sie
              Energiekosten reduzieren können. Ohne Versprechen, ohne Druck.
            </p>

            {/* Mini-Trust */}
            <div className="flex flex-col gap-3 pt-2">
              {[
                'Analyse vollständig kostenlos',
                'Persönlicher Ansprechpartner innerhalb 24h',
                'Keine Unterschrift, kein Risiko',
                'DSGVO-konform & SSL-verschlüsselt',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-energy flex-shrink-0" aria-hidden="true" />
                  <span className="font-body text-text-secondary text-base">{item}</span>
                </div>
              ))}
            </div>

            {/* Geschäftsmodell-Transparenz */}
            <div className="mt-2 p-5 rounded-2xl border border-white/8 bg-bg-surface">
              <h4 className="font-display font-bold text-text-primary text-sm mb-2 uppercase tracking-wider">
                Wie verdient Tarifheld?
              </h4>
              <p className="font-body text-text-secondary text-sm leading-relaxed">
                Wir sind unabhängig und nicht an einen Anbieter gebunden. Unsere Vergütung erfolgt
                ausschließlich durch Provisionen der Energieanbieter — und nur dann, wenn ein
                Wechsel für Sie wirklich sinnvoll ist und stattfindet. Für Sie entstehen keine Kosten.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="p-5 md:p-8 rounded-3xl border border-white/8 bg-bg-elevated overflow-hidden relative"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{ background: 'linear-gradient(90deg, #FF6B2B 0%, rgba(255,107,43,0.3) 100%)' }}
              aria-hidden="true"
            />
            <h3 className="font-display font-black text-text-primary text-xl mb-6">
              Unternehmens-Analyse anfragen
            </h3>
            <B2BFormular />
            {/* Vermittlerhinweis */}
            <p className="mt-5 font-body text-xs text-text-tertiary leading-relaxed border-t border-white/6 pt-4">
              Tarifheld vermittelt Energietarife im Auftrag geprüfter Energieversorger.
              Die Beratung und Analyse ist für Sie kostenlos und unverbindlich.
              Eine Vergütung erfolgt ausschließlich durch Provisionen der Energieanbieter
              — und nur bei einem tatsächlichen Vertragswechsel.
            </p>
          </motion.div>
        </div>
      </Section>

      {/* ── STICKY MOBILE CTA (only on mobile, hides global green one) ──── */}
      <a
        href="#formular"
        aria-label="Kostenlose Unternehmens-Analyse anfragen"
        onClick={e => {
          e.preventDefault()
          document.getElementById('formular')?.scrollIntoView({ behavior: 'smooth' })
        }}
        className="sticky-b2b-cta"
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          display: 'none',
          alignItems: 'center',
          gap: 8,
          background: '#FF6B2B',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: 14,
          padding: '14px 20px',
          borderRadius: 999,
          boxShadow: '0 4px 24px rgba(255,107,43,0.4)',
          textDecoration: 'none',
          whiteSpace: 'normal',
          textAlign: 'center',
          lineHeight: 1.25,
          width: 'min(340px, calc(100vw - 24px))',
        }}
      >
        Kostenlose Analyse anfragen →
      </a>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <Footer />
    </>
  )
}
