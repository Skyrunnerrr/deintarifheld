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
      className={`rounded-[20px] border transition-all duration-300 ${
        open
          ? 'bg-white border-[rgba(21,32,51,0.12)] border-l-[3px] border-l-[#FF6B2B] shadow-[0_10px_28px_rgba(21,32,51,0.06)]'
          : 'bg-white border-[rgba(21,32,51,0.10)] hover:border-[rgba(21,32,51,0.16)]'
      }`}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-7 py-5 sm:py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy/40 rounded-[20px]"
        aria-expanded={open}
        aria-controls={`business-faq-${index}`}
      >
        <span className="font-display font-bold text-lg md:text-xl text-text-primary pr-4 leading-snug">
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
            open ? 'bg-energy text-white' : 'bg-[#EEF0F4] text-text-secondary'
          }`}
          aria-hidden="true"
        >
          {open ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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
            <div className="px-5 sm:px-7 pb-5 sm:pb-6 pt-1">
              <div className="w-full h-px bg-[rgba(21,32,51,0.08)] mb-4" aria-hidden="true" />
              <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">{answer}</p>
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
        className="text-center mb-8 sm:mb-10 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="energy">{BUSINESS_FAQ.label}</SectionLabel>
        <SectionHeading centered className="dth-section-heading max-w-3xl text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
          {BUSINESS_FAQ.title}
        </SectionHeading>
      </motion.div>

      <div
        className="dth-faq-list max-w-[1040px] mx-auto flex flex-col gap-4"
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
