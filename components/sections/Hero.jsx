// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sanitizePayload, isBot, HONEYPOT_FIELD, HONEYPOT_FIELD_2, checkRateLimit, recordSubmission, recordFormLoad, getFormTiming, isTooFast } from '@/lib/security'
import { RecaptchaBox } from '@/components/ui/RecaptchaBox'

// ─── Keyframes via inline style tag ────────────────────────────────
const KEYFRAMES = `
  @keyframes orbFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-24px) scale(1.04); }
  }
  @keyframes tarifloat {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-14px); }
  }
  @keyframes pulseDot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(212,255,62,0.5); }
    50%       { box-shadow: 0 0 0 5px rgba(212,255,62,0); }
  }
  @keyframes chipin {
    from { opacity: 0; transform: scale(0.82) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes chipfloat1 {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-7px); }
  }
  @keyframes chipfloat2 {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(7px); }
  }
  @keyframes scrollPulse {
    0%, 100% { opacity: 0.3; transform: scaleY(0.7); }
    50%       { opacity: 1;   transform: scaleY(1); }
  }
`

// ─── SVG Icons ────────────────────────────────────────────────────
function IconArrow({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconArrowLeft({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M9 6H3M5 4l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconInfo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="rgba(212,255,62,0.55)" strokeWidth="1.2" />
      <path d="M4.5 7l1.8 1.8 3.2-3.2" stroke="rgba(212,255,62,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconBolt({ size = 16, fill = '#D4FF3E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.5 2L3.5 11.5H9.5L8.5 18L16.5 8.5H10.5Z" fill={fill} />
    </svg>
  )
}
function IconClock({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="#B8E032" strokeWidth="1.3" />
      <path d="M8 5v3l2 1.5" stroke="#B8E032" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function IconCheckCircle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="#a8d400" strokeWidth="1.3" />
      <path d="M5 8l2 2 4-4" stroke="#a8d400" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconCheckmarkSuccess() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l5 5L19 7" stroke="#D4FF3E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Floating Chip ────────────────────────────────────────────────
function FloatingChip({ icon, title, subtitle, style, floatStyle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        background: 'rgba(14,17,23,0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '14px',
        padding: '10px 14px',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        whiteSpace: 'nowrap',
        zIndex: 20,
        position: 'absolute',
        ...style,
        ...floatStyle,
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...icon.bg }}>
        {icon.svg}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary, #F2F4F8)' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-outfit, "Outfit", sans-serif)', fontSize: 11, color: 'var(--text-tertiary, #5A6272)' }}>{subtitle}</div>
      </div>
    </div>
  )
}

// ─── Main Hero Component ──────────────────────────────────────────
export function Hero() {
  const [funnelOpen, setFunnelOpen] = useState(false)
  const [step,       setStep]       = useState(1)
  const [formData,   setFormData]   = useState({
    firstName: '', phone: '', email: '',
    provider: '', usage: '', zip: '', type: '', gdpr: false,
    [HONEYPOT_FIELD]: '', [HONEYPOT_FIELD_2]: '',
  })
  const [errors, setErrors] = useState({})
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaError, setRecaptchaError] = useState('')

  // Security: record form load time
  useEffect(() => {
    recordFormLoad('hero-funnel')
  }, [])

  // Scroll-Trigger
  useEffect(() => {
    const handleScroll = () => {
      if (funnelOpen) return
      const total = document.body.scrollHeight - window.innerHeight
      if (total <= 0) return
      const pct = window.scrollY / total
      if (pct >= 0.62) setFunnelOpen(true)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [funnelOpen])

  function openFunnel() {
    setFunnelOpen(true)
    setTimeout(() => {
      document.getElementById('hero-funnel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  function goStep2() {
    const newErrors = {}
    if (!formData.firstName.trim()) newErrors.firstName = 'Bitte gib deinen Vornamen ein'
    if (!formData.phone.trim() || formData.phone.trim().length < 6) newErrors.phone = 'Bitte gib deine Telefonnummer ein'
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) newErrors.email = 'Bitte gib eine gültige E-Mail ein'
    if (!formData.gdprStep1) newErrors.gdprStep1 = 'Bitte stimme der Datenschutzerklärung zu'
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) setStep(2)
  }
  function goStep1() { setStep(1); setErrors({}) }

  async function submitForm() {
    setRateLimitMsg('')
    setRecaptchaError('')
    const newErrors = {}
    if (!formData.provider.trim()) newErrors.provider = 'Bitte gib deinen Anbieter ein'
    if (!formData.usage.trim()) newErrors.usage = 'Bitte gib deinen Verbrauch ein'
    if (!formData.zip.trim() || !/^\d{5}$/.test(formData.zip.trim())) newErrors.zip = 'Bitte gib eine gültige 5-stellige PLZ ein'
    if (!formData.gdpr) newErrors.gdpr = 'Bitte stimme der Datenschutzerklärung zu'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    // Honeypot check (dual fields)
    if (isBot(formData[HONEYPOT_FIELD], formData[HONEYPOT_FIELD_2])) { setStep('success'); return }

    // Timing-based bot detection (< 3s = bot)
    if (isTooFast('hero-funnel')) { setStep('success'); return }

    // Rate limiting
    const rl = checkRateLimit('hero-funnel')
    if (!rl.allowed) { setRateLimitMsg(`Bitte warte ${rl.remainingSeconds}s bevor du erneut absendest.`); return }

    if (!recaptchaToken) {
      setRecaptchaError('Bitte bestaetige das Captcha.')
      return
    }

    recordSubmission('hero-funnel')
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyR4SQWp3pmBFMmQUJL9sCSuZ7dfVDMLarUmNzV3rCPng817qYUEtt-a0tSnf_JPWI0/exec'
      if (!webhookUrl) throw new Error('Webhook URL fehlt')

      const { [HONEYPOT_FIELD]: _hp, [HONEYPOT_FIELD_2]: _hp2, gdprStep1: _g1, ...rest } = formData
      const { _formLoadedAt } = getFormTiming('hero-funnel')
      const payload = sanitizePayload({ ...rest, _recaptchaToken: recaptchaToken, _recaptchaAction: 'hero-funnel', page_source: 'hero-funnel', brand_theme: 'privat', brand_color: '#D4FF3E', form_version: '2.0', timestamp: new Date().toISOString(), _formLoadedAt, page: 'deintarifheld.de' })
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      })
      setStep('success')
    } catch (e) {
      console.error('Webhook error:', e)
      setRateLimitMsg('Absenden fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.')
    }
  }

  function handleInput(field) {
    return (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      <section
        id="hero"
        aria-label="Dein Tarifheld — Kostenlose Energieoptimierung"
        style={{
          position: 'relative',
          border: 'none',
          borderRadius: 0,
        }}
        className="hero-section"
      >
        {/* ── Hintergrund-Effekte ── */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          {/* Orb 1 — Volt */}
          <div style={{
            position: 'absolute', top: '-15%', right: '-10%',
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,255,62,0.08) 0%, rgba(212,255,62,0.03) 50%, transparent 75%)',
            filter: 'blur(80px)',
            animation: 'orbFloat 14s ease-in-out infinite',
          }} />
          {/* Orb 2 — Volt dim */}
          <div style={{
            position: 'absolute', bottom: '-10%', left: '-8%',
            width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(184,224,50,0.05) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'orbFloat 18s ease-in-out infinite reverse',
          }} />
          {/* Orb 3 — Volt dark */}
          <div style={{
            position: 'absolute', top: '30%', left: '28%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(138,170,32,0.04) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'orbFloat 22s ease-in-out infinite',
          }} />
          {/* Grid Overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%)',
          }} />
        </div>

        {/* ── LINKE SPALTE ── */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 0 }}
          className="hero-left"
        >
          {/* 1. Badge */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0 }}
            style={{ marginBottom: 24 }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 999,
              background: 'rgba(212,255,62,0.06)',
              border: '1px solid rgba(212,255,62,0.2)',
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontWeight: 700, fontSize: 11,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--volt, #D4FF3E)',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--volt, #D4FF3E)',
                animation: 'pulseDot 2s ease-in-out infinite',
                flexShrink: 0,
              }} />
              Kostenlos &amp; Unverbindlich
            </div>
          </motion.div>

          {/* 2. H1 */}
          <motion.h1
            className="hero-h1"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontWeight: 900,
              fontSize: 'clamp(36px, 7vw, 103px)',
              lineHeight: 1.0,
              letterSpacing: '-0.035em',
              color: 'var(--text-primary, #F2F4F8)',
              margin: 0,
              marginBottom: 24,
            }}
          >
            Bis zu 40%*<br />
            weniger<br />
            <span style={{ color: 'var(--volt, #D4FF3E)' }}>Energiekosten</span>
          </motion.h1>

          {/* 3. Lead Text */}
          <motion.p
            className="hero-lead"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            style={{
              fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
              fontSize: 17,
              color: 'var(--text-secondary, #8E97A8)',
              lineHeight: 1.65,
              maxWidth: 460,
              margin: 0,
              marginBottom: 32,
            }}
          >
            Wir analysieren deinen Strom- und Gastarif kostenlos,
            finden bessere Angebote und übernehmen den kompletten
            Wechsel für dich.
          </motion.p>

          {/* Disclaimer für 40%-Claim */}
          <p
            className="hero-disclaimer"
            style={{
              fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
              fontSize: 11,
              color: 'var(--text-tertiary, #5A6272)',
              lineHeight: 1.5,
              marginBottom: 28,
              maxWidth: 460,
            }}
          >
            * Potenzielle Ersparnis basierend auf Kundenbeispielen im Vergleich zum Grundversorgungstarif. Individuelle Ergebnisse variieren.
          </p>

          {/* 4. CTA Row */}
          <AnimatePresence>
            {!funnelOpen && (
              <motion.div
                id="ctaRow"
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, overflow: 'hidden', flexWrap: 'wrap' }}
                className="hero-cta-row"
              >
                {/* Primary Button */}
                <button
                  onClick={openFunnel}
                  aria-label="Jetzt kostenlos Tarifanalyse starten"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'var(--volt, #D4FF3E)',
                    color: 'var(--bg-base, #090B0F)',
                    fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                    fontWeight: 800, fontSize: 15,
                    padding: '14px 28px', borderRadius: 14,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 0 24px rgba(212,255,62,0.22)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#B8E032'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 36px rgba(212,255,62,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--volt, #D4FF3E)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 24px rgba(212,255,62,0.22)' }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                >
                  Jetzt kostenlos analysieren
                  <IconArrow />
                </button>

                {/* Ghost Button */}
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  aria-label="Erfahre wie Deintarifheld funktioniert"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                    fontWeight: 600, fontSize: 14,
                    padding: '13px 22px', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                >
                  <IconInfo />
                  Wie funktionierts?
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5. Funnel Card */}
          <motion.div
            id="hero-funnel"
            initial={{ maxHeight: 0, opacity: 0 }}
            animate={funnelOpen ? { maxHeight: 600, opacity: 1 } : { maxHeight: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', marginBottom: funnelOpen ? 28 : 0 }}
          >
            <div style={{
              background: 'rgba(15,18,24,0.85)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 20,
              padding: 24,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}>
              {step !== 'success' && (
                <>
                  {/* Funnel Header */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                      fontWeight: 700, fontSize: 11,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'var(--text-tertiary, #5A6272)',
                      marginBottom: 10,
                    }}>
                      Deine kostenlose Analyse
                    </div>
                    {/* Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: step === 1 ? '50%' : '100%',
                          background: 'var(--volt, #D4FF3E)',
                          borderRadius: 999,
                          transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                        }} />
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                        fontWeight: 700, fontSize: 11,
                        color: 'var(--text-tertiary, #5A6272)',
                        whiteSpace: 'nowrap',
                      }}>
                        Schritt {step} von 2
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 1 */}
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
                    <FunnelInputGrid>
                      <FunnelInput label="VORNAME" id="fn" type="text" placeholder="Max" value={formData.firstName} onChange={handleInput('firstName')} error={errors.firstName} />
                      <FunnelInput label="TELEFON" id="ph" type="tel" placeholder="+49 170 …" value={formData.phone} onChange={handleInput('phone')} error={errors.phone} />
                    </FunnelInputGrid>
                    <FunnelInput label="E-MAIL" id="em" type="email" placeholder="max@beispiel.de" value={formData.email} onChange={handleInput('email')} style={{ marginTop: 8 }} error={errors.email} />
                    {/* Honeypot — unsichtbar für echte Nutzer */}
                    <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true" tabIndex={-1}>
                      <input type="text" name={HONEYPOT_FIELD} value={formData[HONEYPOT_FIELD]} onChange={handleInput(HONEYPOT_FIELD)} autoComplete="off" tabIndex={-1} />
                      <input type="text" name={HONEYPOT_FIELD_2} value={formData[HONEYPOT_FIELD_2]} onChange={handleInput(HONEYPOT_FIELD_2)} autoComplete="off" tabIndex={-1} />
                    </div>
                    {/* DSGVO Checkbox Step 1 */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={formData.gdprStep1 || false}
                        onChange={e => setFormData(prev => ({ ...prev, gdprStep1: e.target.checked }))}
                        required
                        style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15, accentColor: '#D4FF3E', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary, #5A6272)', lineHeight: 1.5 }}>
                        Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
                        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(212,255,62,0.6)', textDecoration: 'underline' }}>Datenschutzerklärung</a>{' '}
                        zu.*
                      </span>
                    </label>
                    {errors.gdprStep1 && (
                      <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{errors.gdprStep1}</p>
                    )}
                    <FunnelCTA onClick={goStep2} style={{ marginTop: 12 }}>Weiter</FunnelCTA>
                    <DsgvoNote />
                  </motion.div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
                    <FunnelInputGrid>
                      <FunnelInput label="AKTUELLER ANBIETER" id="prov" type="text" placeholder="E.ON, Vattenfall …" value={formData.provider} onChange={handleInput('provider')} error={errors.provider} />
                      <FunnelInput label="JAHRESVERBRAUCH (KWH)" id="usage" type="number" placeholder="3500" value={formData.usage} onChange={handleInput('usage')} error={errors.usage} />
                    </FunnelInputGrid>
                    <FunnelInputGrid style={{ marginTop: 8 }}>
                      <FunnelInput label="POSTLEITZAHL" id="zip" type="text" placeholder="10115" maxLength={5} value={formData.zip} onChange={handleInput('zip')} error={errors.zip} />
                      <FunnelSelect label="ART" id="type" value={formData.type} onChange={handleInput('type')} />
                    </FunnelInputGrid>
                    {/* DSGVO Checkbox */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={formData.gdpr}
                        onChange={e => setFormData(prev => ({ ...prev, gdpr: e.target.checked }))}
                        required
                        style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15, accentColor: '#D4FF3E', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary, #5A6272)', lineHeight: 1.5 }}>
                        Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
                        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(212,255,62,0.6)', textDecoration: 'underline' }}>Datenschutzerklärung</a>{' '}
                        zu. Die Einwilligung kann jederzeit widerrufen werden.*
                      </span>
                    </label>
                    {errors.gdpr && (
                      <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{errors.gdpr}</p>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <RecaptchaBox onToken={setRecaptchaToken} theme="dark" action="hero-funnel" />
                    </div>
                    {recaptchaError && (
                      <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{recaptchaError}</p>
                    )}
                    {rateLimitMsg && (
                      <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{rateLimitMsg}</p>
                    )}
                    <FunnelCTA onClick={submitForm} style={{ marginTop: 10 }}>Kostenloses Angebot anfordern</FunnelCTA>
                    <button
                      onClick={goStep1}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary, #5A6272)',
                        fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                        fontSize: 12, margin: '8px auto 0', padding: '4px 0',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary, #8E97A8)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary, #5A6272)'}
                    >
                      <IconArrowLeft /> Zurück
                    </button>
                    <DsgvoNote />
                  </motion.div>
                )}

                {/* SUCCESS */}
                {step === 'success' && (
                  <motion.div key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '8px 0' }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(212,255,62,0.1)',
                      border: '2px solid rgba(212,255,62,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconCheckmarkSuccess />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                      fontWeight: 700, fontSize: 18,
                      color: 'var(--volt, #D4FF3E)',
                    }}>
                      Anfrage gesendet
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                      fontSize: 13, color: 'var(--text-secondary, #8E97A8)',
                      lineHeight: 1.55, margin: 0,
                    }}>
                      Wir prüfen deinen Tarif und melden uns{' '}
                      <strong style={{ color: 'var(--volt, #D4FF3E)' }}>schnellstmöglich</strong>{' '}
                      mit deinem Angebot.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 6. Trust Row */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="hero-trust-row"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}
          >
            {['Kostenlos', 'Unverbindlich', 'Deutschlandweit', 'DSGVO-konform'].map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCheck />
                <span style={{
                  fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                  fontSize: 12.5,
                  color: 'var(--text-tertiary, #5A6272)',
                  fontWeight: 500,
                }}>
                  {label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RECHTE SPALTE ── */}
        <div
          className="hero-right"
          style={{
            position: 'relative', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Tari Wrap */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>

            {/* Tari Bild */}
            <motion.img
              src="/images/tari-nobg.png"
              alt="Tari — Dein Tarifheld Maskottchen"
              loading="eager"
              fetchPriority="high"
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              style={{
                position: 'relative', zIndex: 2,
                width: '100%', height: 'auto', display: 'block',
                animation: 'tarifloat 9s ease-in-out 1.1s infinite',
              }}
            />

            {/* Volt Glow unter Tari */}
            <div aria-hidden="true" style={{
              position: 'absolute', bottom: -10,
              left: '50%', transform: 'translateX(-50%)',
              width: 260, height: 50,
              background: 'radial-gradient(ellipse, rgba(212,255,62,0.22) 0%, transparent 70%)',
              filter: 'blur(22px)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />

            {/* Chip 1 — Ersparnis */}
            <div className="hero-floating-chip">
              <FloatingChip
                icon={{
                  bg: { background: 'rgba(212,255,62,0.1)' },
                  svg: <IconBolt size={16} fill="#D4FF3E" />
                }}
                title="680 €"
                subtitle="pro Jahr gespart"
                style={{ top: '24%', left: '-12%' }}
                floatStyle={{ animation: 'chipin 0.7s ease 0.6s both, chipfloat1 9s ease-in-out 1.3s infinite' }}
              />
            </div>

            {/* Chip 2 — Zeit */}
            <div className="hero-floating-chip">
              <FloatingChip
                icon={{
                  bg: { background: 'rgba(255,107,43,0.1)' },
                  svg: <IconClock size={16} />
                }}
                title="Schnellstmöglich"
                subtitle="bis zum Angebot"
                style={{ top: '42%', right: '-10%' }}
                floatStyle={{ animation: 'chipin 0.7s ease 0.8s both, chipfloat2 9s ease-in-out 1.5s infinite' }}
              />
            </div>

            {/* Chip 3 — Kunden */}
            <div className="hero-floating-chip">
              <FloatingChip
                icon={{
                  bg: { background: 'rgba(126,220,255,0.1)' },
                  svg: <IconCheckCircle size={16} />
                }}
                title="1.200+"
                subtitle="Kunden optimiert"
                style={{ bottom: '24%', left: '-12%' }}
                floatStyle={{ animation: 'chipin 0.7s ease 1.0s both, chipfloat1 9s ease-in-out 1.7s infinite' }}
              />
            </div>
          </div>
        </div>

        {/* ── SCROLL HINT ── */}
        <motion.div
          className="hero-scroll-hint"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          style={{
            position: 'absolute', bottom: 32,
            left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            zIndex: 10, pointerEvents: 'none',
            cursor: 'default',
          }}
          aria-hidden="true"
        >
          <span style={{
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            fontWeight: 700, color: 'rgba(212,255,62,0.7)',
            textShadow: '0 0 18px rgba(212,255,62,0.35)',
          }}>
            Mehr entdecken
          </span>
          {/* Animierter Chevron */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: 'scrollBounce 1.6s ease-in-out infinite' }}>
            <path d="M5 8l6 6 6-6" stroke="rgba(212,255,62,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: 'scrollBounce 1.6s ease-in-out 0.2s infinite', marginTop: -10, opacity: 0.45 }}>
            <path d="M5 8l6 6 6-6" stroke="rgba(212,255,62,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>

        {/* ── Responsive Styles ── */}
        <style>{`
          @keyframes scrollBounce {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(5px); opacity: 0.6; }
          }

          /* Desktop defaults — all layout via CSS, not inline */
          .hero-section {
            min-height: 100vh;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            align-items: center;
            padding: 0 48px;
            padding-top: 80px;
            gap: 0;
            overflow: hidden;
          }
          .hero-left {
            padding-right: 40px;
            padding-left: 120px;
          }
          .hero-right {
            min-height: 100vh;
            padding-top: 80px;
          }

          /* Tablet */
          @media (max-width: 1023px) {
            .hero-section {
              grid-template-columns: 1fr 1fr;
              padding: 0 24px;
              padding-top: 80px;
            }
            .hero-left {
              padding-left: 24px;
              padding-right: 16px;
            }
            .hero-right {
              min-height: auto;
              padding-top: 40px;
            }
          }

          /* Mobile */
          @media (max-width: 767px) {
            .hero-section {
              display: flex;
              flex-direction: column;
              padding: 0 20px;
              padding-top: 80px;
              min-height: auto;
              overflow-x: hidden;
              overflow-y: visible;
            }
            .hero-left {
              padding-right: 0;
              padding-left: 0;
              padding-top: 0;
              padding-bottom: 0;
              order: 2;
            }
            .hero-right {
              min-height: auto;
              max-height: none;
              padding-top: 16px;
              padding-bottom: 0;
              order: 1;
              width: 100%;
            }
            .hero-right > div {
              max-width: 260px;
              margin: 0 auto;
            }
            .hero-floating-chip { display: none; }
            .hero-cta-row {
              flex-direction: column;
              gap: 10px;
            }
            .hero-cta-row button,
            .hero-cta-row a {
              width: 100%;
              justify-content: center;
            }
            .hero-funnel-grid { grid-template-columns: 1fr; }
            .hero-h1 {
              font-size: clamp(28px, 8vw, 36px);
              margin-bottom: 14px;
            }
            .hero-lead {
              font-size: 15px;
              margin-bottom: 16px;
            }
            .hero-disclaimer {
              font-size: 12px;
              margin-bottom: 14px;
            }
            .hero-trust-row {
              gap: 8px;
            }
            .hero-trust-row span {
              font-size: 12px;
            }
            .hero-scroll-hint {
              display: none;
            }
          }

          /* Small Mobile */
          @media (max-width: 374px) {
            .hero-section { padding: 0 14px; padding-top: 80px; }
            .hero-right > div { max-width: 220px; }
          }
        `}</style>
      </section>
    </>
  )
}

// ─── Helper Komponenten ────────────────────────────────────────────

function FunnelInputGrid({ children, style }) {
  return (
    <div className="hero-funnel-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, ...style }}>
      {children}
    </div>
  )
}

function FunnelInput({ label, id, style, error, ...props }) {
  return (
    <div style={style}>
      <label htmlFor={id} style={{
        display: 'block',
        fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
        fontWeight: 700, fontSize: 12,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-tertiary, #5A6272)',
        marginBottom: 5,
      }}>
        {label}
      </label>
      <input
        id={id}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 12,
          background: 'rgba(13,17,23,0.9)',
          border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.09)'}`,
          color: 'var(--text-primary, #F2F4F8)',
          fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
          fontSize: 14, outline: 'none',
          transition: 'border-color 200ms, box-shadow 200ms',
          boxSizing: 'border-box',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(212,255,62,0.4)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,255,62,0.06)'
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.09)'
          e.currentTarget.style.boxShadow = 'none'
        }}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error && <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

function FunnelSelect({ label, id, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} style={{
        display: 'block',
        fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
        fontWeight: 700, fontSize: 12,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-tertiary, #5A6272)',
        marginBottom: 5,
      }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 12,
          background: 'rgba(13,17,23,0.9)',
          border: '1px solid rgba(255,255,255,0.09)',
          color: value ? 'var(--text-primary, #F2F4F8)' : 'rgba(255,255,255,0.22)',
          fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
          fontSize: 14, outline: 'none',
          appearance: 'none', cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <option value="" disabled>Strom oder Gas?</option>
        <option value="strom">Strom</option>
        <option value="gas">Gas</option>
      </select>
    </div>
  )
}

function FunnelCTA({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%',
        background: 'var(--volt, #D4FF3E)',
        color: 'var(--bg-base, #090B0F)',
        fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
        fontWeight: 700, fontSize: 15,
        padding: '13px 24px', borderRadius: 14,
        border: 'none', cursor: 'pointer',
        boxShadow: '0 0 22px rgba(212,255,62,0.22)',
        transition: 'all 0.2s ease',
        ...style,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#B8E032'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 36px rgba(212,255,62,0.35)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--volt, #D4FF3E)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 22px rgba(212,255,62,0.22)' }}
    >
      {children}
      <IconArrow />
    </button>
  )
}

function DsgvoNote() {
  return (
    <p style={{
      fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
      fontSize: 12, color: 'var(--text-tertiary, #5A6272)',
      textAlign: 'center', marginTop: 6, lineHeight: 1.5,
    }}>
      Deine Daten werden ausschließlich zur Angebotserstellung verwendet.{' '}
      <a
        href="/datenschutz"
        style={{ color: 'rgba(212,255,62,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--volt, #D4FF3E)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(212,255,62,0.5)'}
      >
        Datenschutz
      </a>
    </p>
  )
}

export default Hero
