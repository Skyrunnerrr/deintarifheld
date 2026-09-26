'use client'

import { motion } from 'framer-motion'
import { MapPin, Clock, TrendingUp, Users, Zap, Star } from 'lucide-react'
import { AmbientBg, GridBg } from '@/components/ui/Background'
import { UnifiedInquiryForm } from '@/components/forms/UnifiedInquiryForm'

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

const BENEFITS = [
  { icon: <TrendingUp className="w-5 h-5" />, title: '1.400 – 5.500 €', sub: 'monatlich möglich', color: '#0A5ADB' },
  { icon: <Clock className="w-5 h-5" />,      title: 'Flexibel',         sub: 'Zeit & Ort frei wählen', color: '#217CFF' },
  { icon: <Users className="w-5 h-5" />,      title: 'Quereinsteiger',   sub: 'Keine Vorkenntnisse nötig', color: '#0A5ADB' },
  { icon: <Zap className="w-5 h-5" />,        title: 'Vollausbildung',   sub: 'Persönliche Schulungen inklusive', color: '#217CFF' },
  { icon: <MapPin className="w-5 h-5" />,     title: 'Deutschlandweit',  sub: 'Remote oder vor Ort möglich', color: '#0A5ADB' },
  { icon: <Star className="w-5 h-5" />,       title: 'Boni & Prämien',   sub: 'Attraktive Provisionsstruktur', color: '#217CFF' },
]

export function CareerSection({ headingLevel = 'h1' }) {
  const HeadingTag = headingLevel

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
              Partner werden im Energiemarkt
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
              Als{' '}
              <span style={{ background: 'linear-gradient(135deg, #217CFF 0%, #0A5ADB 50%, #5B9BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Partner
              </span>
              <br />selbstständig starten
            </HeadingTag>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 font-body text-base sm:text-lg leading-relaxed"
            style={{ color: 'rgba(180,200,255,0.75)' }}
          >
            Interessierst du dich für eine selbstständige Tätigkeit als Energieberater oder
            Vertriebspartner? Über dieses Formular kannst du unverbindlich Kontakt aufnehmen.
            Es wird kein Arbeitsverhältnis angeboten.
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
                    <div className="font-body text-xs" style={{ color: 'rgba(180,200,255,0.5)' }}>Selbstständiger Energieberater seit 2024</div>
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
                <div className="mb-6">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3"
                    style={{ background: 'rgba(10,90,219,0.15)', color: '#5B9BFF', border: '1px solid rgba(10,90,219,0.25)' }}
                  >
                    Partneranfrage
                  </div>
                  <h3 className="font-display font-bold text-2xl" style={{ color: '#F0F4FF' }}>Interesse an Zusammenarbeit</h3>
                  <p className="font-body text-sm mt-1" style={{ color: 'rgba(180,200,255,0.55)' }}>
                    Unverbindliche Anfrage für eine selbstständige Tätigkeit — kein Arbeitsverhältnis, keine Datei-Uploads.
                  </p>
                </div>
                <UnifiedInquiryForm initialType="partner" idPrefix="partner" buttonVariant="partner" />
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </>
  )
}

export default CareerSection
