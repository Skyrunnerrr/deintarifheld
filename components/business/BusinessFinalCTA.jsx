'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Mail } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { BUSINESS_FINAL_CTA } from '@/lib/business-content'
import { scrollToAnchor } from '@/components/business/scrollToAnchor'

function scrollToForm(e) {
  e?.preventDefault?.()
  scrollToAnchor('formular')
}

export function BusinessFinalCTA() {
  return (
    <Section id="abschluss" className="bg-bg-base">
      <div className="dth-final-cta-media" aria-hidden="true">
        <Image
          src="/business/backgrounds/building-evening.webp"
          alt=""
          fill
          loading="lazy"
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center 35%', opacity: 1 }}
          unoptimized
        />
      </div>
      <div className="dth-final-cta-overlay" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45 }}
        className="relative z-10 dth-biz-container"
      >
        <div className="max-w-3xl py-2">
          <h2 className="font-display font-black text-text-primary text-[2rem] sm:text-3xl md:text-[2.75rem] leading-[1.12] mb-5">
            {BUSINESS_FINAL_CTA.title}
          </h2>
          <p className="font-body text-text-secondary text-lg sm:text-xl leading-relaxed mb-9 max-w-2xl">
            {BUSINESS_FINAL_CTA.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a
              href="#formular"
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 font-display font-bold tracking-tight rounded-2xl transition-all duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F98540]/60 focus-visible:outline-offset-3 cursor-pointer select-none bg-energy text-white hover:bg-energy/90 text-lg px-8 py-4 h-14 whitespace-normal text-center"
            >
              {BUSINESS_FINAL_CTA.primaryCta}
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </a>
            <a
              href={BUSINESS_FINAL_CTA.secondaryHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[56px] rounded-2xl border border-white/10 bg-bg-elevated text-text-primary font-display font-bold text-base hover:bg-bg-overlay hover:border-white/20 transition-all duration-200"
            >
              <Mail className="w-5 h-5" aria-hidden="true" />
              {BUSINESS_FINAL_CTA.secondaryCta}
            </a>
          </div>
        </div>
      </motion.div>
    </Section>
  )
}
