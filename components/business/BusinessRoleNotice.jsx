'use client'

import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_ROLE } from '@/lib/business-content'

export function BusinessRoleNotice() {
  return (
    <Section id="rolle" className="bg-bg-base">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 1, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl border border-white/8 bg-bg-elevated p-6 sm:p-8 md:p-10"
        >
          <SectionLabel variant="energy">{BUSINESS_ROLE.label}</SectionLabel>
          <SectionHeading className="mt-5 mb-5 text-[1.6rem] sm:text-3xl md:text-4xl leading-[1.16]">
            {BUSINESS_ROLE.title}
          </SectionHeading>
          <p className="font-body text-text-primary text-base sm:text-lg leading-relaxed mb-6">
            {BUSINESS_ROLE.body}
          </p>
          <ul className="flex flex-col gap-3" role="list">
            {BUSINESS_ROLE.details.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-energy flex-shrink-0" aria-hidden="true" />
                <span className="font-body text-text-secondary text-[15px] sm:text-base leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </Section>
  )
}
