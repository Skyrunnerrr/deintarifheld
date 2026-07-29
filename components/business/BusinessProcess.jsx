'use client'

import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_PROCESS } from '@/lib/business-content'

export function BusinessProcess() {
  return (
    <Section id="ablauf" className="bg-bg-surface">
      <motion.div
        initial={{ opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45 }}
        className="text-center mb-10 sm:mb-12 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="energy">{BUSINESS_PROCESS.label}</SectionLabel>
        <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
          {BUSINESS_PROCESS.title}
        </SectionHeading>
        <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl">
          {BUSINESS_PROCESS.description}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        {BUSINESS_PROCESS.steps.map((step, i) => (
          <motion.div
            key={step.nr}
            initial={{ opacity: 1, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="relative flex flex-col gap-3 p-5 rounded-3xl bg-bg-elevated border border-white/6"
          >
            <div className="font-display font-black text-3xl text-energy/25 leading-none select-none" aria-hidden="true">
              {step.nr}
            </div>
            <h3 className="font-display font-bold text-text-primary text-base leading-snug">
              {step.title}
            </h3>
            <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}
