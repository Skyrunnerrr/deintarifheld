'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_FAQ } from '@/lib/business-content'

function FaqItem({ question, answer, index }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 1, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className={`rounded-2xl border transition-all duration-300 ${
        open
          ? 'bg-bg-elevated border-energy/20 border-l-[3px] border-l-[#FF6B2B]'
          : 'bg-bg-surface border-white/6 hover:border-white/12'
      }`}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy/40 rounded-2xl"
        aria-expanded={open}
        aria-controls={`business-faq-${index}`}
      >
        <span className="font-display font-bold text-base md:text-lg text-text-primary pr-4">
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
            open ? 'bg-energy text-white' : 'bg-white/8 text-text-secondary'
          }`}
          aria-hidden="true"
        >
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`business-faq-${index}`}
            role="region"
            aria-label={question}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-1">
              <div className="w-full h-px bg-white/6 mb-4" aria-hidden="true" />
              <p className="font-body text-text-secondary text-sm sm:text-base leading-relaxed">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function BusinessFAQ() {
  return (
    <Section id="faq-business" className="bg-bg-surface">
      <motion.div
        initial={{ opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45 }}
        className="text-center mb-10 sm:mb-12 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="energy">{BUSINESS_FAQ.label}</SectionLabel>
        <SectionHeading centered className="max-w-3xl text-[1.75rem] sm:text-4xl md:text-5xl leading-[1.14]">
          {BUSINESS_FAQ.title}
        </SectionHeading>
      </motion.div>

      <div
        className="max-w-3xl mx-auto flex flex-col gap-3"
        role="list"
        aria-label="Häufig gestellte Fragen für Unternehmenskunden"
      >
        {BUSINESS_FAQ.items.map((item, i) => (
          <FaqItem key={item.q} question={item.q} answer={item.a} index={i} />
        ))}
      </div>
    </Section>
  )
}
