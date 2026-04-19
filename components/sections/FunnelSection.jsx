// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ArrowRight, CheckCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { ProgressBar, RadioToggle, Checkbox } from '@/components/ui/Form'
import { Section, AmbientBg } from '@/components/ui/Background'
import { SectionLabel, SectionHeading, VoltText } from '@/components/ui/Typography'
import { RecaptchaBox } from '@/components/ui/RecaptchaBox'
import { cn } from '@/lib/utils'
import { sanitizePayload, isBot, HONEYPOT_FIELD, HONEYPOT_FIELD_2, checkRateLimit, recordSubmission, recordFormLoad, getFormTiming, isTooFast } from '@/lib/security'

// ─── Schemas ─────────────────────────────────────────────────────

const step1Schema = z.object({
  firstName: z.string().min(2, 'Bitte gib deinen Vornamen ein'),
  email:     z.string().email('Bitte gib eine gültige E-Mail ein'),
  phone:     z.string().min(6, 'Bitte gib deine Telefonnummer ein'),
  gdpr:      z.literal(true, { errorMap: () => ({ message: 'Bitte stimme der Datenschutzerklärung zu' }) }),
})

const step2Schema = z.object({
  provider:    z.string().min(1, 'Bitte gib deinen aktuellen Anbieter ein'),
  consumption: z.string().regex(/^\d+$/, 'Bitte gib nur Zahlen ein').min(1, 'Verbrauch erforderlich'),
  zip:         z.string().regex(/^\d{5}$/, 'Bitte gib eine gültige 5-stellige PLZ ein'),
  gdpr:        z.literal(true, { errorMap: () => ({ message: 'Bitte stimme der Datenschutzerklärung zu' }) }),
})

// ─── Success Screen ───────────────────────────────────────────────

function SuccessScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-6 py-8 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-volt/10 border border-volt/20 flex items-center justify-center animate-pulse-volt">
        <CheckCircle className="w-10 h-10 text-volt" aria-hidden="true" />
      </div>

      <div>
        <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary mb-3">
          ✅ Vielen Dank!
        </h2>
        <p className="font-body text-text-secondary text-lg">
          Wir melden uns <strong className="text-volt">schnellstmöglich</strong> bei dir.
        </p>
      </div>

      <div className="w-full rounded-2xl bg-bg-elevated border border-white/8 p-5 text-left">
        <p className="font-body text-text-secondary text-sm leading-relaxed">
          🔍 Unser Team analysiert jetzt deinen aktuellen Tarif und findet
          die besten verfügbaren Angebote für dich.
        </p>
      </div>

      <a
        href="https://calendar.app.google/uum1t3Whpstgxsa49"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-volt/30 text-volt font-display font-bold text-sm hover:bg-volt/10 transition-all duration-200"
        aria-label="Direkt Termin buchen (öffnet neues Fenster)"
      >
        <Calendar className="w-4 h-4" aria-hidden="true" />
        Direkt Termin buchen (optional)
      </a>
    </motion.div>
  )
}

// ─── Step 1: Kontaktdaten ─────────────────────────────────────────

function Step1({ onNext }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(step1Schema),
  })

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="flex flex-col gap-5">
        <Input
          label="Vorname"
          placeholder="Max"
          required
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="E-Mail"
          type="email"
          placeholder="max@beispiel.de"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Telefon"
          type="tel"
          placeholder="+49 89 123456"
          required
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Checkbox
          label={
            <>
              Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
              <a href="/datenschutz" className="text-volt underline underline-offset-2 hover:text-volt/80" target="_blank" rel="noopener noreferrer">
                Datenschutzerklärung
              </a>{' '}
              zu.*
            </>
          }
          required
          error={errors.gdpr?.message}
          {...register('gdpr')}
        />

        <Button type="submit" variant="volt" size="lg" className="w-full justify-center mt-2">
          Weiter
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </Button>

        <p className="text-text-tertiary text-xs text-center font-body">
          🔒 DSGVO-konform · Keine Weitergabe an Dritte
        </p>
      </div>
    </form>
  )
}

// ─── Step 2: Verbrauchsdaten ──────────────────────────────────────

function Step2({ step1Data, onSuccess }) {
  const [energyType, setEnergyType] = useState('strom')
  const [loading, setLoading]       = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [honeypot, setHoneypot]     = useState('')
  const [honeypot2, setHoneypot2]   = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaError, setRecaptchaError] = useState('')

  // Security: record form load time
  useEffect(() => {
    recordFormLoad('main-funnel')
  }, [])

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(step2Schema),
  })

  async function onSubmit(data) {
    setRateLimitMsg('')
    setRecaptchaError('')

    // Honeypot check (dual fields)
    if (isBot(honeypot, honeypot2)) { onSuccess(); return }

    // Timing-based bot detection
    if (isTooFast('main-funnel')) { onSuccess(); return }

    // Rate limiting
    const rl = checkRateLimit('main-funnel')
    if (!rl.allowed) { setRateLimitMsg(`Bitte warte ${rl.remainingSeconds}s bevor du erneut absendest.`); return }

    if (!recaptchaToken) {
      setRecaptchaError('Bitte bestaetige das Captcha.')
      return
    }

    setLoading(true)
    recordSubmission('main-funnel')
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyR4SQWp3pmBFMmQUJL9sCSuZ7dfVDMLarUmNzV3rCPng817qYUEtt-a0tSnf_JPWI0/exec'
      if (!webhookUrl) throw new Error('Webhook URL fehlt')
      
      const payload = sanitizePayload({
        name:        step1Data.firstName,
        email:       step1Data.email,
        phone:       step1Data.phone,
        provider:    data.provider,
        consumption: parseInt(data.consumption),
        zip:         data.zip,
        type:        energyType,
        gdpr:        true,
        timestamp:   new Date().toISOString(),
        _formLoadedAt: getFormTiming('main-funnel')._formLoadedAt,
        _recaptchaToken: recaptchaToken,  // ← Neu: reCAPTCHA Token
        _recaptchaAction: 'main_funnel',
        page_source: 'main_funnel',
        brand_theme: 'privat',
        brand_color: '#D4FF3E',
        form_version: '2.0',
      })
      await fetch(webhookUrl, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload),
      })
      onSuccess()
    } catch (err) {
      console.error('Funnel submit error:', err)
      setRateLimitMsg('Absenden fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-5">
        {/* Strom / Gas */}
        <div>
          <label className="font-body text-sm font-medium text-text-secondary mb-2 block">
            Was möchtest du optimieren?
          </label>
          <RadioToggle
            options={[
              { value: 'strom', label: '⚡ Strom' },
              { value: 'gas',   label: '🔥 Gas' },
            ]}
            value={energyType}
            onChange={setEnergyType}
            name="energy-type-funnel"
          />
        </div>

        <Input
          label="Aktueller Anbieter"
          placeholder="z.B. E.ON, Stadtwerke, ..."
          required
          error={errors.provider?.message}
          {...register('provider')}
        />

        <Input
          label={`Jahresverbrauch in kWh (${energyType === 'strom' ? 'Ø 3.500 kWh' : 'Ø 15.000 kWh'})`}
          type="number"
          placeholder={energyType === 'strom' ? '3500' : '15000'}
          required
          error={errors.consumption?.message}
          {...register('consumption')}
        />

        <Input
          label="Postleitzahl"
          placeholder="12345"
          maxLength={5}
          required
          error={errors.zip?.message}
          {...register('zip')}
        />

        {/* Honeypot — unsichtbar für echte Nutzer */}
        <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
          <input type="text" name={HONEYPOT_FIELD} value={honeypot} onChange={e => setHoneypot(e.target.value)} autoComplete="off" tabIndex={-1} />
          <input type="text" name={HONEYPOT_FIELD_2} value={honeypot2} onChange={e => setHoneypot2(e.target.value)} autoComplete="off" tabIndex={-1} />
        </div>

        <Checkbox
          label={
            <>
              Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
              <a href="/datenschutz" className="text-volt underline underline-offset-2 hover:text-volt/80" target="_blank" rel="noopener noreferrer">
                Datenschutzerklärung
              </a>{' '}
              zu. Die Einwilligung kann jederzeit widerrufen werden.
            </>
          }
          required
          error={errors.gdpr?.message}
          {...register('gdpr')}
        />

        <RecaptchaBox onToken={setRecaptchaToken} theme="dark" action="main_funnel" />

        {recaptchaError && (
          <p className="text-energy text-xs text-center font-body" role="alert">{recaptchaError}</p>
        )}

        <Button
          type="submit"
          variant="volt"
          size="lg"
          className="w-full justify-center mt-2"
          loading={loading}
        >
          Kostenlos Angebot anfordern
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </Button>

        {rateLimitMsg && (
          <p className="text-energy text-xs text-center font-body" role="alert">{rateLimitMsg}</p>
        )}

        <p className="text-text-tertiary text-xs text-center font-body">
          Antwort schnellstmöglich · Kein Vertrag · Kostenlos
        </p>
      </div>
    </form>
  )
}

// ─── Funnel Sektion ───────────────────────────────────────────────

export function FunnelSection() {
  const [step,      setStep]      = useState(1)
  const [step1Data, setStep1Data] = useState(null)
  const [done,      setDone]      = useState(false)

  function handleStep1(data) {
    setStep1Data(data)
    setStep(2)
  }

  return (
    <Section id="funnel" className="bg-bg-base">
      <AmbientBg />

      <div className="max-w-xl mx-auto">

        {/* Header */}
        {!done && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8 flex flex-col items-center gap-3"
          >
            <SectionLabel>Kostenlose Analyse</SectionLabel>
            <SectionHeading centered>
              Dein persönliches<br />
              <VoltText>Einsparpotenzial</VoltText>
            </SectionHeading>
          </motion.div>
        )}

        {/* Card */}
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl bg-bg-surface border border-white/8 p-7 md:p-10"
        >
          {done ? (
            <SuccessScreen />
          ) : (
            <>
              {/* Progress Bar */}
              <div className="mb-8">
                <ProgressBar current={step} total={2} />
              </div>

              {/* Step Title */}
              <h3 className="font-display font-bold text-xl text-text-primary mb-6">
                {step === 1
                  ? '👋 Wie können wir dich erreichen?'
                  : '⚡ Fast fertig — Verbrauchsdaten'
                }
              </h3>

              {/* Step Content */}
              <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Step1 onNext={handleStep1} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Step2 step1Data={step1Data} onSuccess={() => setDone(true)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>
    </Section>
  )
}

export default FunnelSection
