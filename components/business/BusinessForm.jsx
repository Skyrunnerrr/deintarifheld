'use client'

import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_FORM, BUSINESS_TRIGGERS } from '@/lib/business-content'
import { UnifiedInquiryForm } from '@/components/forms/UnifiedInquiryForm'

function BusinessFormular() {
  return (
    <UnifiedInquiryForm
      initialType="business_energy"
      tone="formal"
      appearance="light"
      buttonVariant="energy"
      idPrefix="business"
    />
  )
}

export function BusinessForm() {
  return (
    <Section id="formular" className="bg-bg-surface">
      <div className="dth-biz-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <SectionLabel variant="energy">{BUSINESS_FORM.label}</SectionLabel>
          <SectionHeading className="dth-section-heading text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
            {BUSINESS_FORM.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-lg sm:text-xl leading-relaxed">
            {BUSINESS_FORM.description}
          </p>

          <div className="flex flex-col gap-3.5 pt-1">
            <h3 className="font-display font-bold text-text-primary text-lg sm:text-xl leading-snug">
              {BUSINESS_TRIGGERS.title}
            </h3>
            <ul className="flex flex-col gap-3" role="list">
              {BUSINESS_TRIGGERS.items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-energy flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3.5 pt-2">
            {BUSINESS_FORM.trustItems.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-energy flex-shrink-0" aria-hidden="true" />
                <span className="font-body text-text-secondary text-base sm:text-lg">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 1, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 dth-form-navy p-7 md:p-10 rounded-[26px] border overflow-hidden relative w-full"
          style={{ minWidth: 0 }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]"
            style={{ background: 'linear-gradient(90deg, #F98540 0%, rgba(249,133,64,0.35) 100%)' }}
            aria-hidden="true"
          />
          <h3 className="font-display font-bold text-text-primary text-xl sm:text-2xl mb-6">
            {BUSINESS_FORM.formHeading}
          </h3>
          <BusinessFormular />
          <p className="mt-5 font-body text-xs text-text-tertiary leading-relaxed border-t border-[rgba(21,32,51,0.08)] pt-4">
            {BUSINESS_FORM.microcopy}
          </p>
        </motion.div>
      </div>
    </Section>
  )
}
