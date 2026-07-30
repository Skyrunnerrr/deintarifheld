'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Mail, CheckCircle2 } from 'lucide-react'
import { SectionLabel } from '@/components/ui/Typography'
import { BUSINESS_HERO, BUSINESS_TRUST } from '@/lib/business-content'
import { scrollToAnchor } from '@/components/business/scrollToAnchor'

function scrollToForm(e) {
  e?.preventDefault?.()
  scrollToAnchor('formular')
}

export function BusinessHero() {
  return (
    <section
      id="hero-business"
      className="relative w-full flex items-center overflow-hidden bg-bg-base pt-28 sm:pt-32 pb-14 sm:pb-20"
      aria-labelledby="hero-business-heading"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 100% 0%, rgba(249,133,64,0.08) 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F5F4F1 100%)',
        }}
      />

      <div className="relative z-10 dth-biz-container w-full">
        <div className="dth-hero-grid">
          <div className="min-w-0 max-w-2xl lg:max-w-none">
            <motion.div
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <SectionLabel variant="energy">{BUSINESS_HERO.label}</SectionLabel>
            </motion.div>

            <motion.h1
              id="hero-business-heading"
              initial={{ opacity: 1, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-bold text-text-primary mt-5 mb-5"
              style={{
                fontSize: 'clamp(2.1rem, 4.1vw, 3.35rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.028em',
              }}
            >
              {BUSINESS_HERO.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14 }}
              className={`font-body text-text-primary text-lg sm:text-xl leading-relaxed max-w-xl ${BUSINESS_HERO.support ? 'mb-3' : 'mb-6'}`}
            >
              {BUSINESS_HERO.description}
            </motion.p>

            {BUSINESS_HERO.support ? (
              <motion.p
                initial={{ opacity: 1, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                className="font-body text-text-secondary text-base sm:text-lg leading-relaxed mb-6 max-w-xl"
              >
                {BUSINESS_HERO.support}
              </motion.p>
            ) : null}

            <motion.ul
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-col gap-2.5 mb-7"
              role="list"
            >
              {BUSINESS_TRUST.slice(0, 3).map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-energy flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">{item}</span>
                </li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <a
                href="#formular"
                onClick={scrollToForm}
                className="dth-btn-primary text-base sm:text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F98540]/50 focus-visible:outline-offset-3"
              >
                {BUSINESS_HERO.primaryCta}
                <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              </a>
              <a href={BUSINESS_HERO.secondaryHref} className="dth-btn-secondary text-base sm:text-lg">
                <Mail className="w-5 h-5" aria-hidden="true" />
                {BUSINESS_HERO.secondaryCta}
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 1, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="min-w-0"
          >
            <div
              className="relative w-full overflow-hidden rounded-[26px] bg-[#EEF0F4]"
              style={{
                aspectRatio: '5 / 4',
                minHeight: 340,
                boxShadow: '0 20px 52px rgba(9,11,21,0.13)',
              }}
            >
              <Image
                src="/business/hero/business-building.webp"
                alt=""
                fill
                priority
                unoptimized
                sizes="(max-width: 1024px) 100vw, 640px"
                style={{ objectFit: 'cover', objectPosition: '72% 22%' }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
