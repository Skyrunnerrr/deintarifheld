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
        initial={{ opacity: 1, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="dth-biz-container"
      >
        <div className="rounded-[28px] border border-[rgba(21,32,51,0.10)] bg-white overflow-hidden shadow-[0_16px_44px_rgba(21,32,51,0.07)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
            <div className="lg:col-span-5 flex flex-col gap-4 p-7 sm:p-9 lg:p-10 lg:border-r border-[rgba(21,32,51,0.08)]">
              <SectionLabel variant="energy">{BUSINESS_CASE.label}</SectionLabel>
              <SectionHeading className="dth-section-heading text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
                {BUSINESS_CASE.title}
              </SectionHeading>
              <p className="font-body text-text-secondary text-lg sm:text-xl leading-relaxed">
                {BUSINESS_CASE.intro}
              </p>
              <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                {BUSINESS_CASE.nextStep}
              </p>
              <a
                href="#formular"
                onClick={scrollToForm}
                className="dth-btn-primary mt-3 w-fit text-base sm:text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F98540]/50 focus-visible:outline-offset-3"
              >
                Versorgungssituation unverbindlich prüfen lassen
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>

            <div className="lg:col-span-7 flex flex-col">
              <p className="px-6 sm:px-8 pt-7 sm:pt-8 font-display font-bold text-text-primary text-base sm:text-lg tracking-wide">
                {BUSINESS_CASE.examplesLabel}
              </p>
              <div className="overflow-x-auto mt-4 flex-1">
                <table className="w-full min-w-[540px] text-left border-collapse">
                  <caption className="caption-bottom px-6 sm:px-8 pb-3 pt-1 text-left font-body text-sm text-text-tertiary leading-relaxed">
                    {BUSINESS_CASE.tableCaption}
                  </caption>
                  <thead>
                    <tr className="border-y border-[rgba(21,32,51,0.10)] bg-[#F4F2ED]">
                      <th scope="col" className="px-6 sm:px-8 py-4 font-body text-sm sm:text-base font-semibold text-text-secondary">
                        {BUSINESS_CASE.columns.consumption}
                      </th>
                      <th scope="col" className="px-6 sm:px-8 py-4 font-body text-sm sm:text-base font-semibold text-text-secondary">
                        {BUSINESS_CASE.columns.delta}
                      </th>
                      <th scope="col" className="px-6 sm:px-8 py-4 font-body text-sm sm:text-base font-semibold text-text-secondary text-right">
                        {BUSINESS_CASE.columns.effect}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {BUSINESS_CASE.examples.map((row) => (
                      <tr key={row.consumption} className="border-b border-[rgba(21,32,51,0.08)] last:border-b-0">
                        <td className="px-6 sm:px-8 py-5 font-body text-base sm:text-lg text-text-primary whitespace-nowrap">
                          {row.consumption}
                        </td>
                        <td className="px-6 sm:px-8 py-5 font-body text-base sm:text-lg text-text-secondary whitespace-nowrap">
                          {row.delta}
                        </td>
                        <td className="px-6 sm:px-8 py-5 font-display font-bold text-xl sm:text-2xl text-energy text-right whitespace-nowrap">
                          {row.effect}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-6 sm:px-8 py-5 font-body text-sm sm:text-base text-text-tertiary leading-relaxed border-t border-[rgba(21,32,51,0.08)] bg-[#FBFBFA]">
                {BUSINESS_CASE.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </Section>
  )
}

export default BusinessCase
