'use client'

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
      <motion.div
        initial={{ opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45 }}
        className="max-w-3xl mx-auto text-center rounded-3xl border border-energy/20 bg-energy/5 px-6 py-10 sm:px-10 sm:py-14"
      >
        <h2 className="font-display font-black text-text-primary text-[1.6rem] sm:text-3xl md:text-4xl leading-[1.14] mb-4">
          {BUSINESS_FINAL_CTA.title}
        </h2>
        <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
          {BUSINESS_FINAL_CTA.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <a
            href="#formular"
            onClick={scrollToForm}
            className="inline-flex items-center justify-center gap-2 font-display font-bold tracking-tight rounded-2xl transition-all duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt/60 focus-visible:outline-offset-3 cursor-pointer select-none bg-energy text-white hover:bg-energy/90 hover:shadow-energy text-lg px-8 py-4 h-14 whitespace-normal text-center"
          >
            {BUSINESS_FINAL_CTA.primaryCta}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <a
            href={BUSINESS_FINAL_CTA.secondaryHref}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[52px] rounded-2xl border border-white/10 bg-bg-elevated text-text-primary font-display font-bold text-base hover:bg-bg-overlay hover:border-white/20 transition-all duration-200"
          >
            <Mail className="w-5 h-5" aria-hidden="true" />
            {BUSINESS_FINAL_CTA.secondaryCta}
          </a>
        </div>
      </motion.div>
    </Section>
  )
}
