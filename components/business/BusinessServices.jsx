'use client'

import { motion } from 'framer-motion'
import { ClipboardList, Search, Handshake, UserRound } from 'lucide-react'
import { Section, GlowLine } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_SERVICES, BUSINESS_SITUATIONS } from '@/lib/business-content'

const ICONS = [ClipboardList, Search, Handshake, UserRound]

export function BusinessServices() {
  return (
    <>
      <Section id="leistungen" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 1, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="text-center mb-10 sm:mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">{BUSINESS_SERVICES.label}</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
            {BUSINESS_SERVICES.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl">
            {BUSINESS_SERVICES.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {BUSINESS_SERVICES.items.map((item, i) => {
            const Icon = ICONS[i] || ClipboardList
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 1, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-white/6 bg-bg-surface"
              >
                <div className="w-11 h-11 rounded-xl bg-energy/10 border border-energy/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-energy" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-text-primary text-[15px] sm:text-base leading-snug mb-1">
                    {item.title}
                  </h3>
                  <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Section>

      <GlowLine color="white" />

      <Section id="situationen" className="bg-bg-surface">
        <motion.div
          initial={{ opacity: 1, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="text-center mb-10 sm:mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">{BUSINESS_SITUATIONS.label}</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
            {BUSINESS_SITUATIONS.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl">
            {BUSINESS_SITUATIONS.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {BUSINESS_SITUATIONS.items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 1, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="p-5 sm:p-6 rounded-2xl border border-energy/15 bg-energy/5"
            >
              <h3 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug mb-2">
                {item.title}
              </h3>
              <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </Section>
    </>
  )
}
