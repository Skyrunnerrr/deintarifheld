'use client'

import { motion } from 'framer-motion'
import { Building2, ChefHat, Car, HeartPulse, Factory, Landmark } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_AUDIENCE } from '@/lib/business-content'

const AUDIENCE_ICONS = [Building2, ChefHat, Car, HeartPulse, Factory, Landmark]

export function BusinessAudience() {
  return (
      <Section id="zielgruppen" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 1, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="text-center mb-10 sm:mb-12 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">{BUSINESS_AUDIENCE.label}</SectionLabel>
          <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
            {BUSINESS_AUDIENCE.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-base sm:text-lg max-w-2xl">
            {BUSINESS_AUDIENCE.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {BUSINESS_AUDIENCE.items.map((item, i) => {
            const Icon = AUDIENCE_ICONS[i] || Building2
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 1, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex flex-col gap-3 p-5 sm:p-6 rounded-3xl border border-white/6 bg-bg-surface"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-energy/10 border border-energy/20">
                  <Icon className="w-5 h-5 text-energy" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug">
                  {item.title}
                </h3>
                <p className="font-body text-text-secondary text-[15px] sm:text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </Section>
  )
}
