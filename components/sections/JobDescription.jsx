'use client'

import { motion } from 'framer-motion'
import { Briefcase, Clock, MapPin, TrendingUp, Users, GraduationCap, Handshake, Zap } from 'lucide-react'
import { Section, AmbientBg, GridBg } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'

// ─── Job-Details als Kacheln ──────────────────────────────────────
const BLUE = '#0A5ADB'

const JOB_TILES = [
  {
    icon: Briefcase,
    title: 'Selbstständig als Handelsvertreter',
    desc: 'Du arbeitest auf eigene Rechnung als Handelsvertreter gem. § 84 HGB — ohne Anstellungsverhältnis, mit voller unternehmerischer Freiheit.',
    color: BLUE,
  },
  {
    icon: TrendingUp,
    title: '1.400 – 5.500 € monatlich',
    desc: 'Attraktive Provisionen ab dem ersten Abschluss. Kein Deckel, kein Limit — dein Einkommen wächst mit deinem Engagement.',
    color: BLUE,
  },
  {
    icon: Clock,
    title: 'Flexible Zeiteinteilung',
    desc: 'Neben- oder hauptberuflich möglich. Du entscheidest, wann und wie viel du arbeitest — ideal für Eltern, Studierende oder Quereinsteiger.',
    color: BLUE,
  },
  {
    icon: MapPin,
    title: '100 % Remote & Digital',
    desc: 'Arbeite von überall in Deutschland. Alle Tools, Schulungen und Prozesse laufen komplett digital.',
    color: BLUE,
  },
  {
    icon: GraduationCap,
    title: 'Schulung & Onboarding',
    desc: 'Wir machen dich fit: Persönliches Onboarding, regelmäßige Schulungen und ein erfahrenes Team an deiner Seite.',
    color: BLUE,
  },
  {
    icon: Users,
    title: 'Quereinsteiger willkommen',
    desc: 'Keine Vorkenntnisse im Energiebereich nötig. Motivation und Kommunikationsstärke zählen — den Rest bringen wir dir bei.',
    color: BLUE,
  },
]

// ─── Dein Weg zu uns ──────────────────────────────────────────────
const STEPS = [
  { num: '01', title: 'Partneranfrage senden', desc: 'Fülle das Formular unten aus — dauert keine 2 Minuten.' },
  { num: '02', title: 'Kennenlerngespräch', desc: 'Wir melden uns innerhalb von 48h für ein kurzes Telefonat.' },
  { num: '03', title: 'Onboarding & Start', desc: 'Du bekommst Zugang zu allen Tools, Schulungen und deinen ersten Kunden.' },
]

export function JobDescription() {
  const deepBackground = {
    background: 'radial-gradient(circle at 88% 14%, rgba(33,124,255,0.22) 0%, transparent 24%), radial-gradient(circle at 10% 70%, rgba(10,90,219,0.14) 0%, transparent 20%), linear-gradient(180deg, #030509 0%, #060910 34%, #05070C 70%, #020409 100%)',
  }

  return (
    <Section
      id="job-description"
      className="bg-bg-base"
      style={deepBackground}
    >
      <AmbientBg variant="partner" />
      <GridBg className="opacity-[0.16]" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-44"
        style={{ background: 'linear-gradient(180deg, rgba(10,90,219,0.10) 0%, transparent 100%)' }}
      />

      {/* ── Header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="partner">Deine Chance</SectionLabel>
        <SectionHeading centered>
          Willst du etwas dazuverdienen{' '}
          <span className="text-gradient-partner">& anderen helfen?</span>
        </SectionHeading>
        <p className="font-body text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          Werde selbstständiger Energieberater und hilf Familien sowie Unternehmen,
          beim Strom zu sparen — flexibel, remote und mit attraktiver Vergütung ab dem ersten Abschluss.
        </p>
      </motion.div>

      {/* ── Kachel-Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
        {JOB_TILES.map((tile, i) => {
          const Icon = tile.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-2xl border p-6 hover:border-[#0A5ADB]/40 transition-all duration-300 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(14,18,27,0.88) 0%, rgba(7,10,15,0.96) 100%)',
                borderColor: 'rgba(255,255,255,0.07)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.28), 0 0 36px rgba(10,90,219,0.05)',
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent 5%, ${tile.color}80 50%, transparent 95%)` }}
                aria-hidden="true"
              />

              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${tile.color}12`, border: `1px solid ${tile.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: tile.color }} aria-hidden="true" />
              </div>

              {/* Text */}
              <h3 className="font-display font-bold text-text-primary text-base mb-2">
                {tile.title}
              </h3>
              <p className="font-body text-text-tertiary text-sm leading-relaxed">
                {tile.desc}
              </p>
            </motion.div>
          )
        })}
      </div>

      {/* ── Dein Weg zu uns ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl border border-white/8 p-8 md:p-12 bg-bg-elevated/20"
        style={{
          background: 'linear-gradient(180deg, rgba(12,16,24,0.90) 0%, rgba(8,11,17,0.96) 100%)',
          boxShadow: '0 26px 80px rgba(0,0,0,0.26)',
        }}
      >
        {/* Accent top border */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-[#0A5ADB]/50 to-transparent mb-8" aria-hidden="true" />

        <h3 className="font-display font-bold text-2xl md:text-3xl text-text-primary text-center mb-10">
          Dein Weg zu uns — in{' '}
          <span className="text-[#0A5ADB]">3 Schritten</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="relative flex flex-col items-center text-center p-6"
            >
              {/* Number */}
              <div className="w-14 h-14 rounded-2xl bg-[#0A5ADB]/10 border border-[#0A5ADB]/20 flex items-center justify-center mb-4">
                <span className="font-display font-black text-[#0A5ADB] text-xl">{step.num}</span>
              </div>

              <h4 className="font-display font-bold text-text-primary text-base mb-2">
                {step.title}
              </h4>
              <p className="font-body text-text-tertiary text-sm leading-relaxed">
                {step.desc}
              </p>

              {/* Connector Arrow (nicht beim letzten) */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-7 -right-3 w-6 text-[#0A5ADB]/40" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex justify-center mt-8"
        >
          <a
            href="#career"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#0A5ADB] text-white font-display font-bold text-sm hover:bg-[#0A5ADB]/85 transition-colors duration-200"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            Partneranfrage senden
          </a>
        </motion.div>
      </motion.div>
    </Section>
  )
}

export default JobDescription
