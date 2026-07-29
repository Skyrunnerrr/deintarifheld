'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Mail } from 'lucide-react'
import { AmbientBg } from '@/components/ui/Background'
import { SectionLabel, TrustIndicators } from '@/components/ui/Typography'
import { BUSINESS_HERO, BUSINESS_TRUST } from '@/lib/business-content'
import { scrollToAnchor } from '@/components/business/scrollToAnchor'

function scrollToForm(e) {
  e?.preventDefault?.()
  scrollToAnchor('formular')
}

export function BusinessHero() {
  return (
    <section
      id="hero-business"
      className="relative w-full min-h-[88vh] flex items-center overflow-hidden bg-bg-base pt-20 sm:pt-24 pb-14 sm:pb-20"
      aria-labelledby="hero-business-heading"
    >
      <AmbientBg variant="energy" />
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 55% 40%, rgba(255,107,43,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 1, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <SectionLabel variant="energy">{BUSINESS_HERO.label}</SectionLabel>
          </motion.div>

          <motion.p
            initial={{ opacity: 1, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04 }}
            className="mt-5 font-display font-bold text-energy text-sm sm:text-base tracking-wide uppercase"
          >
            DeinTarifheld Unternehmen
          </motion.p>

          <motion.h1
            id="hero-business-heading"
            initial={{ opacity: 1, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-black text-text-primary mt-3 mb-5"
            style={{ fontSize: 'clamp(2.1rem, 5.5vw, 3.75rem)', lineHeight: 1.08, letterSpacing: '-0.02em' }}
          >
            {BUSINESS_HERO.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 1, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="font-body text-text-primary text-base sm:text-xl leading-relaxed mb-4 max-w-2xl"
          >
            {BUSINESS_HERO.description}
          </motion.p>

          <motion.p
            initial={{ opacity: 1, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22 }}
            className="font-body text-text-secondary text-sm sm:text-lg leading-relaxed mb-8 max-w-2xl"
          >
            {BUSINESS_HERO.support}
          </motion.p>

          <motion.div
            initial={{ opacity: 1, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8"
          >
            <a
              href="#formular"
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 font-display font-bold tracking-tight rounded-2xl transition-all duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt/60 focus-visible:outline-offset-3 cursor-pointer select-none bg-energy text-white hover:bg-energy/90 hover:shadow-energy whitespace-normal text-center text-[15px] leading-snug sm:text-lg px-5 sm:px-8 h-auto min-h-[56px] py-3 sm:py-4"
            >
              {BUSINESS_HERO.primaryCta}
              <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            </a>
            <a
              href={BUSINESS_HERO.secondaryHref}
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-3 sm:py-4 min-h-[56px] rounded-2xl border border-white/10 bg-bg-elevated text-text-primary font-display font-bold text-[15px] leading-snug sm:text-lg hover:bg-bg-overlay hover:border-white/20 transition-all duration-200 text-center"
            >
              <Mail className="w-5 h-5" aria-hidden="true" />
              {BUSINESS_HERO.secondaryCta}
            </a>
          </motion.div>

          <motion.div
            id="vertrauen"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.36 }}
          >
            <TrustIndicators variant="energy" items={BUSINESS_TRUST} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
