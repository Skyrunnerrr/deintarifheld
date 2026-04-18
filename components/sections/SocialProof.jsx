// Restored after APFS sparse-file corruption
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Section, AmbientBg } from '@/components/ui/Background'
import { SectionLabel, SectionHeading, VoltText } from '@/components/ui/Typography'
import { TESTIMONIALS } from '@/lib/constants'

// ─── Count-Up Hook ────────────────────────────────────
function useCountUp(target, duration = 4000, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}

// ─── Gesamt-Ersparnis Counter ─────────────────────────
function TotalSavingsCounter() {
  const [inView, setInView] = useState(false)
  const ref = useRef(null)
  const count = useCountUp(62356, 4500, inView)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center mt-16 md:mt-24 rounded-3xl bg-bg-elevated border border-volt/10 p-7 md:p-14 max-w-2xl mx-auto"
    >
      <div className="font-body text-text-secondary text-sm mb-5">
        Von unseren Kunden gemeinsam gespart (2025)
      </div>
      <div
        className="font-display font-black text-5xl md:text-7xl text-gradient-volt mb-4"
        aria-label={`${count.toLocaleString('de-DE')} Euro gespart`}
      >
        {count.toLocaleString('de-DE')} €
      </div>
      <div className="font-body text-text-tertiary text-sm">
        Basierend auf abgeschlossenen Verträgen über unser Partner-Netzwerk
      </div>
    </motion.div>
  )
}

// ─── Einzelne Bewertungskarte (rahmenlos) ─────────────
function TestimonialItem({ t }) {
  return (
    <div
      className="testimonial-card"
      style={{
        flexShrink: 0,
        width: 320,
        marginRight: 20,
        padding: '26px 26px 22px',
        borderRadius: 18,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'default',
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), z-index 0s',
        userSelect: 'none',
        willChange: 'transform',
        position: 'relative',
        zIndex: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.2)'
        e.currentTarget.style.zIndex = '20'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.zIndex = '1'
      }}
    >
      {/* Sterne */}
      <div style={{ color: '#D4FF3E', fontSize: 15, letterSpacing: 3 }}>
        {'★'.repeat(t.rating)}
      </div>

      {/* Zitat */}
      <p style={{ fontSize: 13.5, color: '#D9DEE4', lineHeight: 1.7, fontStyle: 'italic', flexGrow: 1 }}>
        {t.text}
      </p>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingTop: 10,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#D9DEE4' }}>{t.name}</div>
          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{t.city} · {t.type}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#D4FF3E' }}>{t.savings}</span>
          <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>gespart</span>
        </div>
      </div>
    </div>
  )
}

// ─── Endlos-Karussell ─────────────────────────────────
// Karten 2× duplizieren → animate translateX(-50%) für nahtlosen Loop
// Pro Karte: width 320 + marginRight 20 = 340px → 3 Karten = 1020px = exakt 50%
function TestimonialCarousel() {
  const [isPaused, setIsPaused] = useState(false)
  // 4 Kopien damit genug Content für breite Screens
  const items = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS]

  return (
    <div
      style={{
        overflow: 'hidden',
        width: '100vw',
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        padding: '8px 0',
      }}
    >
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 38s linear infinite;
        }
        .ticker-track.paused {
          animation-play-state: paused;
        }
        @media (max-width: 640px) {
          .testimonial-card {
            width: 280px !important;
            margin-right: 14px !important;
            padding: 22px 20px 18px !important;
          }
          .testimonial-card p {
            font-size: 13px !important;
            line-height: 1.65 !important;
          }
          .ticker-track {
            animation-duration: 28s !important;
          }
        }
        @media (hover: none), (pointer: coarse) {
          .testimonial-card {
            transform: none !important;
            z-index: 1 !important;
          }
        }
      `}</style>

      <div
        className={`ticker-track${isPaused ? ' paused' : ''}`}
        style={{ padding: '28px 0 36px', isolation: 'isolate' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {items.map((t, i) => (
          <TestimonialItem key={`${t.id}-${i}`} t={t} />
        ))}
      </div>
    </div>
  )
}

// ─── ProvenExpert Zertifikat Platzhalter ──────────────
function ProvenExpertBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex justify-center mt-16"
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        border: '1px dashed rgba(212,255,62,0.2)',
        borderRadius: 14, padding: '16px 28px',
        background: 'rgba(212,255,62,0.03)',
      }}>
        {/* Platzhalter-Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'rgba(212,255,62,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          🏅
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#D9DEE4', marginBottom: 3 }}>
            ProvenExpert Zertifikat
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Wird hier eingebunden — verifizierte Bewertungen & Siegel
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────
export function SocialProof() {
  return (
    <section
      id="testimonials"
      className="relative w-full py-20 md:py-28 bg-bg-base overflow-hidden"
    >
      <AmbientBg />

      {/* Header — constrained to max-w-7xl */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 flex flex-col items-center gap-4"
        >
          <SectionLabel>Kundenerfahrungen</SectionLabel>
          <SectionHeading centered>
            Echte Menschen.<br />
            <VoltText>Echte Ersparnisse.</VoltText>
          </SectionHeading>
        </motion.div>
      </div>

      {/* Karussell — echte volle Breite, AUSSERHALB des max-w-7xl Containers */}
      <div className="relative z-10">
        <TestimonialCarousel />
      </div>

      {/* Rest — wieder max-w-7xl */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ProvenExpert Platzhalter */}
        <ProvenExpertBadge />

        {/* Gesamt-Counter */}
        <TotalSavingsCounter />
      </div>
    </section>
  )
}

export default SocialProof
