'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, CheckCircle, MapPin, Clock, TrendingUp, Users, Zap, Star } from 'lucide-react'
import { AmbientBg, GridBg } from '@/components/ui/Background'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Checkbox } from '@/components/ui/Form'
import { RecaptchaBox } from '@/components/ui/RecaptchaBox'
import { sanitizePayload, isBot, HONEYPOT_FIELD, HONEYPOT_FIELD_2, checkRateLimit, recordSubmission, recordFormLoad, getFormTiming, isTooFast } from '@/lib/security'

const KF = `
  @keyframes career-orb1 {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-28px) scale(1.04); }
  }
  @keyframes career-orb2 {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(20px); }
  }
  @keyframes career-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(10,90,219,0.4); }
    50%      { box-shadow: 0 0 0 8px rgba(10,90,219,0); }
  }
  @keyframes career-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`

const schema = z.object({
  name:       z.string().min(2, 'Bitte gib deinen Namen ein'),
  email:      z.string().email('Bitte gib eine gültige E-Mail ein'),
  phone:      z.string().min(6, 'Bitte gib deine Telefonnummer ein'),
  motivation: z.string().min(10, 'Bitte schreib uns kurz, warum dich das interessiert'),
  gdpr:       z.literal(true, { errorMap: () => ({ message: 'Bitte stimme der Datenschutzerklärung zu' }) }),
})

const BENEFITS = [
  { icon: <TrendingUp className="w-5 h-5" />, title: '1.400 – 5.500 €', sub: 'monatlich möglich', color: '#0A5ADB' },
  { icon: <Clock className="w-5 h-5" />,      title: 'Flexibel',         sub: 'Zeit & Arbeitsort frei wählen', color: '#217CFF' },
  { icon: <Users className="w-5 h-5" />,      title: 'Quereinsteiger',   sub: 'Keine Vorkenntnisse nötig', color: '#0A5ADB' },
  { icon: <Zap className="w-5 h-5" />,        title: 'Vollausbildung',   sub: 'Persönliche Schulungen inklusive', color: '#217CFF' },
  { icon: <MapPin className="w-5 h-5" />,     title: 'Deutschlandweit',  sub: 'Remote oder vor Ort möglich', color: '#0A5ADB' },
  { icon: <Star className="w-5 h-5" />,       title: 'Boni & Prämien',   sub: 'Attraktive Provisionsstruktur', color: '#217CFF' },
]

export function CareerSection({ headingLevel = 'h1' }) {
  const HeadingTag = headingLevel
  const [submitted, setSubmitted]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [honeypot, setHoneypot]         = useState('')
  const [honeypot2, setHoneypot2]       = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaError, setRecaptchaError] = useState('')

  // Security: record form load time
  useEffect(() => {
    recordFormLoad('career-form')
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setRateLimitMsg('')
    setRecaptchaError('')
    if (isBot(honeypot, honeypot2)) { setSubmitted(true); return }
    if (isTooFast('career-form')) { setSubmitted(true); return }
    const rl = checkRateLimit('career-form')
    if (!rl.allowed) { setRateLimitMsg(`Bitte warte ${rl.remainingSeconds}s.`); return }
    if (!recaptchaToken) { setRecaptchaError('Bitte bestaetige das Captcha.'); return }
    setLoading(true)
    recordSubmission('career-form')
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyR4SQWp3pmBFMmQUJL9sCSuZ7dfVDMLarUmNzV3rCPng817qYUEtt-a0tSnf_JPWI0/exec'
      if (!webhookUrl) throw new Error('Webhook URL fehlt')
      
      const payload = sanitizePayload({ ...data, _recaptchaToken: recaptchaToken, _recaptchaAction: 'career', page_source: 'career', timestamp: new Date().toISOString(), _formLoadedAt: getFormTiming('career-form')._formLoadedAt, form_version: '2.0' })
      await fetch(webhookUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
      setSubmitted(true)
    } catch (error) {
      console.error('Career submit error:', error)
      setRateLimitMsg('Absenden fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{KF}</style>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(10,90,219,0.28) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(33,124,255,0.15) 0%, transparent 60%), linear-gradient(180deg, #030509 0%, #060A12 100%)',
          minHeight: '100vh',
          paddingTop: '100px',
        }}
      >
        <AmbientBg variant="partner" />
        <GridBg className="opacity-[0.15]" />

        {/* floating orbs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '8%', right: '-5%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(10,90,219,0.12) 0%, transparent 70%)', animation: 'career-orb1 9s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-10%', left: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(33,124,255,0.08) 0%, transparent 70%)', animation: 'career-orb2 11s ease-in-out infinite' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-8"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(10,90,219,0.12)', border: '1px solid rgba(10,90,219,0.3)', color: '#5B9BFF', backdropFilter: 'blur(8px)' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#217CFF', display: 'inline-block', animation: 'career-pulse 2s infinite' }} />
              Karriere im Energiemarkt
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center max-w-4xl mx-auto mb-6"
          >
            <HeadingTag
              className="font-display font-black leading-none tracking-tight"
              style={{ fontSize: 'clamp(2.4rem, 6vw, 5rem)', color: '#F0F4FF' }}
            >
              Dein{' '}
              <span style={{ background: 'linear-gradient(135deg, #217CFF 0%, #0A5ADB 50%, #5B9BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Karrieresprung
              </span>
              <br />im Energiemarkt
            </HeadingTag>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 font-body text-base sm:text-lg leading-relaxed"
            style={{ color: 'rgba(180,200,255,0.75)' }}
          >
            Starte neben- oder hauptberuflich als Energieberater. Wir begleiten dich von Tag 1 —
            mit Schulungen, Leads und einem Team, das anzieht.
          </motion.p>

          {/* ── MAIN GRID ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* LEFT: Benefits */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-4"
            >
              <h2 className="font-display font-bold text-2xl mb-2" style={{ color: '#F0F4FF' }}>
                Was dich erwartet
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BENEFITS.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.07 }}
                    className="relative overflow-hidden rounded-2xl p-4 flex items-start gap-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)',
                        animation: `career-shimmer ${3 + i * 0.3}s linear infinite`,
                      }}
                    />
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-xl w-10 h-10"
                      style={{ background: `${b.color}20`, color: b.color }}
                    >
                      {b.icon}
                    </div>
                    <div>
                      <div className="font-display font-bold text-base" style={{ color: '#F0F4FF' }}>{b.title}</div>
                      <div className="font-body text-sm" style={{ color: 'rgba(180,200,255,0.55)' }}>{b.sub}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quote */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="rounded-2xl p-5 mt-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(10,90,219,0.12) 0%, rgba(33,124,255,0.06) 100%)',
                  border: '1px solid rgba(10,90,219,0.2)',
                }}
              >
                <p className="font-body text-sm italic leading-relaxed" style={{ color: 'rgba(180,200,255,0.8)' }}>
                  {'\u201EIn den ersten 3 Monaten hatte ich bereits mehr verdient als in meinem alten Nebenjob \u2014 und das mit nur 15 Stunden pro Woche.\u201C'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(10,90,219,0.3)', color: '#5B9BFF' }}>M</div>
                  <div>
                    <div className="font-body text-xs font-semibold" style={{ color: '#F0F4FF' }}>Markus T.</div>
                    <div className="font-body text-xs" style={{ color: 'rgba(180,200,255,0.5)' }}>Energieberater seit 2024</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* RIGHT: Form */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              <div
                className="rounded-3xl p-5 sm:p-7 md:p-8"
                style={{
                  background: 'linear-gradient(180deg, rgba(8,12,22,0.95) 0%, rgba(4,7,14,0.98) 100%)',
                  boxShadow: '0 0 0 1px rgba(10,90,219,0.18), 0 40px 100px rgba(0,0,0,0.5), 0 0 60px rgba(10,90,219,0.06) inset',
                }}
              >
                {submitted ? (
                  <div className="flex flex-col items-center gap-5 py-10 text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(10,90,219,0.15)', border: '1px solid rgba(10,90,219,0.3)' }}>
                      <CheckCircle className="w-10 h-10" style={{ color: '#217CFF' }} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-2xl mb-2" style={{ color: '#F0F4FF' }}>Bewerbung gesendet! 🎉</h3>
                      <p className="font-body text-base" style={{ color: 'rgba(180,200,255,0.65)' }}>Wir melden uns innerhalb von 48 Stunden bei dir.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <div className="mb-7">
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3"
                        style={{ background: 'rgba(10,90,219,0.15)', color: '#5B9BFF', border: '1px solid rgba(10,90,219,0.25)' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#217CFF', display: 'inline-block' }} />
                        Jetzt bewerben
                      </div>
                      <h3 className="font-display font-bold text-2xl" style={{ color: '#F0F4FF' }}>Starte deine Karriere</h3>
                      <p className="font-body text-sm mt-1" style={{ color: 'rgba(180,200,255,0.55)' }}>Kostenlos & unverbindlich — wir melden uns bei dir.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <Input
                        label="Vollständiger Name"
                        placeholder="Max Mustermann"
                        required
                        error={errors.name?.message}
                        {...register('name')}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="E-Mail"
                          type="email"
                          placeholder="max@beispiel.de"
                          required
                          error={errors.email?.message}
                          {...register('email')}
                        />
                        <Input
                          label="Telefon"
                          type="tel"
                          placeholder="+49 89 123456"
                          required
                          error={errors.phone?.message}
                          {...register('phone')}
                        />
                      </div>
                      <Textarea
                        label="Warum interessiert dich das?"
                        placeholder="Erzähl uns kurz von dir..."
                        rows={3}
                        required
                        error={errors.motivation?.message}
                        {...register('motivation')}
                      />

                      {/* Honeypot */}
                      <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
                        <input type="text" name={HONEYPOT_FIELD} value={honeypot} onChange={e => setHoneypot(e.target.value)} autoComplete="off" tabIndex={-1} />
                        <input type="text" name={HONEYPOT_FIELD_2} value={honeypot2} onChange={e => setHoneypot2(e.target.value)} autoComplete="off" tabIndex={-1} />
                      </div>

                      <Checkbox
                        label={
                          <>
                            Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
                            <a href="/datenschutz" style={{ color: '#5B9BFF' }} className="underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">
                              Datenschutzerklärung
                            </a>{' '}
                            zu.
                          </>
                        }
                        required
                        error={errors.gdpr?.message}
                        {...register('gdpr')}
                      />

                      <RecaptchaBox onToken={setRecaptchaToken} theme="dark" action="career" />

                      {recaptchaError && (
                        <p className="text-xs text-center font-body" style={{ color: '#FF6B2B' }} role="alert">{recaptchaError}</p>
                      )}

                      <Button
                        type="submit"
                        variant="partner"
                        size="lg"
                        className="w-full justify-center mt-1"
                        loading={loading}
                      >
                        Bewerbung senden
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </Button>

                      {rateLimitMsg && (
                        <p className="text-xs text-center font-body" style={{ color: '#FF6B2B' }} role="alert">{rateLimitMsg}</p>
                      )}

                      <div className="flex items-center justify-center gap-4 pt-1">
                        {['Kostenlos', 'Unverbindlich', '48h Antwort'].map((t, i) => (
                          <span key={i} className="flex items-center gap-1 font-body text-xs" style={{ color: 'rgba(180,200,255,0.45)' }}>
                            <span style={{ color: '#217CFF' }}>✓</span> {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </>
  )
}

export default CareerSection
