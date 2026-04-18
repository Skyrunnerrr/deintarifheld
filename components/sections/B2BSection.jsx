// Restored after APFS sparse-file corruption
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { B2B_FEATURES } from '@/lib/constants'

export function B2BSection() {
  return (
    <Section id="b2b" className="bg-bg-base">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-3xl bg-bg-elevated border border-white/8 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(22,27,36,1) 0%, rgba(15,18,24,1) 100%)',
        }}
      >
        {/* Accent top border */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-volt/50 to-transparent" aria-hidden="true" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 p-8 md:p-12 lg:p-16">

          {/* ── LEFT: Text ──────────────────────────────── */}
          <div className="flex flex-col gap-6 justify-center">
            <SectionLabel variant="volt">Für Unternehmen</SectionLabel>

            <SectionHeading>
              Kooperationen &amp; maßgeschneiderte{' '}
              <span className="text-gradient-volt">Energielösungen</span>
            </SectionHeading>

            <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
              Profitieren Sie von Großkundenkonditionen, einem persönlichen
              Ansprechpartner und individueller Beratung — ganz ohne Risiko.
            </p>

            <Link href="/unternehmen" className="w-full sm:w-auto">
              <Button variant="volt" size="lg" className="w-full sm:w-auto whitespace-normal text-center">
                Mehr erfahren &amp; Analyse anfragen
                <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          {/* ── RIGHT: Feature Grid ──────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {B2B_FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-start gap-3 p-4 rounded-2xl bg-bg-surface/60 border border-white/6 hover:border-volt/20 transition-colors duration-300"
              >
                <CheckCircle2 className="w-5 h-5 text-volt flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-body text-text-secondary text-sm leading-relaxed">
                  {feature}
                </span>
              </motion.div>
            ))}
          </div>

        </div>
      </motion.div>
    </Section>
  )
}

export default B2BSection
