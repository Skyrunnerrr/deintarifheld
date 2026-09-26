'use client'

import { motion } from 'framer-motion'
import { Section, AmbientBg } from '@/components/ui/Background'
import { SectionLabel, SectionHeading, VoltText } from '@/components/ui/Typography'
import { UnifiedInquiryForm } from '@/components/forms/UnifiedInquiryForm'

export function FunnelSection() {
  return (
    <Section id="funnel" className="bg-bg-base">
      <AmbientBg />
      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 flex flex-col items-center gap-3"
        >
          <SectionLabel>Kostenlose Analyse</SectionLabel>
          <SectionHeading centered>
            Dein persönliches
            <br />
            <VoltText>Einsparpotenzial</VoltText>
          </SectionHeading>
        </motion.div>
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl bg-bg-surface border border-white/8 p-7 md:p-10"
        >
          <UnifiedInquiryForm initialType="private_energy" idPrefix="funnel" />
        </motion.div>
      </div>
    </Section>
  )
}

export default FunnelSection
