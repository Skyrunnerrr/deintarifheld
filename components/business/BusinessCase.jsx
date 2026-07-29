'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_CASE } from '@/lib/business-content'
import { scrollToAnchor } from '@/components/business/scrollToAnchor'

function scrollToForm(e) {
  e?.preventDefault?.()
  scrollToAnchor('formular')
}

export function BusinessCase() {
  return (
    <Section id="wirtschaftlicher-hebel" className="bg-bg-surface">
      <motion.div
        initial={{ opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45 }}
        className="max-w-4xl mx-auto flex flex-col gap-8"
      >
        <div className="text-center flex flex-col items-center gap-4">
          <SectionLabel variant="energy">{BUSINESS_CASE.label}</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
            {BUSINESS_CASE.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl leading-relaxed">
            {BUSINESS_CASE.intro}
          </p>
        </div>

        <div className="rounded-3xl border border-white/8 bg-bg-elevated overflow-hidden">
          <p className="px-5 sm:px-6 pt-5 sm:pt-6 font-display font-bold text-text-primary text-sm tracking-wide uppercase">
            {BUSINESS_CASE.examplesLabel}
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full min-w-[520px] text-left border-collapse">
              <caption className="caption-bottom px-5 sm:px-6 pb-3 pt-1 text-left font-body text-xs text-text-tertiary leading-relaxed">
                {BUSINESS_CASE.tableCaption}
              </caption>
              <thead>
                <tr className="border-y border-white/8">
                  <th scope="col" className="px-5 sm:px-6 py-3 font-body text-xs sm:text-sm font-medium text-text-tertiary">
                    {BUSINESS_CASE.columns.consumption}
                  </th>
                  <th scope="col" className="px-5 sm:px-6 py-3 font-body text-xs sm:text-sm font-medium text-text-tertiary">
                    {BUSINESS_CASE.columns.delta}
                  </th>
                  <th scope="col" className="px-5 sm:px-6 py-3 font-body text-xs sm:text-sm font-medium text-text-tertiary text-right">
                    {BUSINESS_CASE.columns.effect}
                  </th>
                </tr>
              </thead>
              <tbody>
                {BUSINESS_CASE.examples.map((row) => (
                  <tr key={row.consumption} className="border-b border-white/6 last:border-b-0">
                    <td className="px-5 sm:px-6 py-3.5 font-body text-sm sm:text-base text-text-primary whitespace-nowrap">
                      {row.consumption}
                    </td>
                    <td className="px-5 sm:px-6 py-3.5 font-body text-sm sm:text-base text-text-secondary whitespace-nowrap">
                      {row.delta}
                    </td>
                    <td className="px-5 sm:px-6 py-3.5 font-display font-bold text-sm sm:text-base text-energy text-right whitespace-nowrap">
                      {row.effect}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 sm:px-6 py-4 font-body text-xs sm:text-sm text-text-tertiary leading-relaxed border-t border-white/6">
            {BUSINESS_CASE.disclaimer}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <p className="font-body text-text-secondary text-sm sm:text-base leading-relaxed max-w-xl">
            {BUSINESS_CASE.nextStep}
          </p>
          <a
            href="#formular"
            onClick={scrollToForm}
            className="inline-flex items-center justify-center gap-2 font-display font-bold tracking-tight rounded-2xl transition-all duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt/60 focus-visible:outline-offset-3 cursor-pointer select-none bg-energy text-white hover:bg-energy/90 hover:shadow-energy text-base px-6 py-3.5 min-h-[52px] whitespace-normal text-center flex-shrink-0"
          >
            Versorgungssituation unverbindlich prüfen lassen
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
        </div>
      </motion.div>
    </Section>
  )
}

export default BusinessCase
