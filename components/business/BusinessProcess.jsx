'use client'

import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_PROCESS } from '@/lib/business-content'

export function BusinessProcess() {
  return (
    <Section id="ablauf" className="bg-bg-surface">
      <motion.div
        initial={{ opacity: 1, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8 sm:mb-10 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="energy">{BUSINESS_PROCESS.label}</SectionLabel>
        <SectionHeading centered className="dth-section-heading max-w-3xl text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
          {BUSINESS_PROCESS.title}
        </SectionHeading>
        <p className="font-body text-text-secondary text-lg sm:text-xl max-w-2xl">
          {BUSINESS_PROCESS.description}
        </p>
      </motion.div>

      <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6 list-none m-0 p-0 dth-biz-container">
        <div
          className="hidden lg:block absolute left-10 right-10 top-6 h-px bg-[rgba(21,32,51,0.12)]"
          aria-hidden="true"
        />
        {BUSINESS_PROCESS.steps.map((step, i) => (
          <motion.li
            key={step.nr}
            initial={{ opacity: 1, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="relative flex flex-col gap-3.5 pt-1"
          >
            <span className="dth-process-nr inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#090B15] text-white font-display font-bold text-lg relative z-10">
              {step.nr}
            </span>
            <h3 className="font-display font-bold text-text-primary text-lg sm:text-xl leading-snug">
              {step.title}
            </h3>
            <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
              {step.desc}
            </p>
          </motion.li>
        ))}
      </ol>
    </Section>
  )
}
