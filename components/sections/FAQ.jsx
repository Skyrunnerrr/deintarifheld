// Restored after APFS sparse-file corruption
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading, VoltText } from '@/components/ui/Typography'
import { FAQ_ITEMS } from '@/lib/constants'
import { cn } from '@/lib/utils'

function FaqItem({ question, answer, index }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl border transition-all duration-300',
        open
          ? 'bg-bg-elevated border-volt/20'
          : 'bg-bg-surface border-white/6 hover:border-white/12'
      )}
    >
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40 rounded-2xl"
        aria-expanded={open}
        aria-controls={`faq-answer-${index}`}
      >
        <span className="font-display font-bold text-base md:text-lg text-text-primary pr-4">
          {question}
        </span>
        <span
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300',
            open ? 'bg-volt text-bg-base' : 'bg-white/8 text-text-secondary'
          )}
          aria-hidden="true"
        >
          {open
            ? <Minus className="w-4 h-4" />
            : <Plus  className="w-4 h-4" />
          }
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`faq-answer-${index}`}
            role="region"
            aria-label={question}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-1">
              <div className="w-full h-px bg-white/6 mb-4" aria-hidden="true" />
              <p className="font-body text-text-secondary text-base leading-relaxed">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  return (
    <Section id="faq" className="bg-bg-base">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12 flex flex-col items-center gap-4"
      >
        <SectionLabel>Häufige Fragen</SectionLabel>
        <SectionHeading centered>
          Noch Fragen? Hier sind<br />
          <VoltText>die Antworten.</VoltText>
        </SectionHeading>
      </motion.div>

      {/* Accordion */}
      <div
        className="max-w-3xl mx-auto flex flex-col gap-3"
        role="list"
        aria-label="Häufig gestellte Fragen"
      >
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} role="listitem">
            <FaqItem
              question={item.question}
              answer={item.answer}
              index={i}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

export default FAQ
