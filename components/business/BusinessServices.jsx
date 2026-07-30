'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ClipboardList, Search, Handshake, UserRound } from 'lucide-react'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_SERVICES, BUSINESS_SITUATIONS } from '@/lib/business-content'

const ICONS = [ClipboardList, Search, Handshake, UserRound]

function BusinessDivider() {
  return <div className="dth-biz-divider" aria-hidden="true" />
}

export function BusinessServices() {
  return (
    <>
      <Section id="leistungen" className="bg-bg-surface">
        <div className="dth-biz-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 1, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4 }}
              className="mb-7 sm:mb-8 flex flex-col gap-4 max-w-2xl"
            >
              <SectionLabel variant="energy">{BUSINESS_SERVICES.label}</SectionLabel>
              <SectionHeading className="dth-section-heading text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
                {BUSINESS_SERVICES.title}
              </SectionHeading>
              <p className="font-body text-text-secondary text-lg sm:text-xl max-w-2xl">
                {BUSINESS_SERVICES.description}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {BUSINESS_SERVICES.items.map((item, i) => {
                const Icon = ICONS[i] || ClipboardList
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 1, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                    className="flex gap-4 p-5 sm:p-6 rounded-[18px] bg-[#F8F7F4] border border-[rgba(9,11,21,0.08)]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[rgba(9,11,21,0.08)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#090B15]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-text-primary text-base sm:text-lg leading-snug mb-1.5">
                        {item.title}
                      </h3>
                      <p className="font-body text-text-secondary text-sm sm:text-base leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-6"
          >
            <div
              className="relative w-full overflow-hidden rounded-[26px] bg-[#EEF0F4]"
              style={{ aspectRatio: '4 / 3', minHeight: 360 }}
            >
              <Image
                src="/business/advisory/meeting-room.webp"
                alt=""
                fill
                loading="lazy"
                unoptimized
                sizes="(max-width: 1024px) 100vw, 620px"
                style={{ objectFit: 'cover', objectPosition: '50% 45%' }}
              />
            </div>
          </motion.div>
        </div>
      </Section>

      <BusinessDivider />

      <Section id="situationen" className="bg-bg-base">
        <motion.div
          initial={{ opacity: 1, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8 sm:mb-10 flex flex-col items-center gap-4"
        >
          <SectionLabel variant="energy">{BUSINESS_SITUATIONS.label}</SectionLabel>
          <SectionHeading centered className="dth-section-heading max-w-3xl text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
            {BUSINESS_SITUATIONS.title}
          </SectionHeading>
          <p className="font-body text-text-secondary text-lg sm:text-xl max-w-2xl">
            {BUSINESS_SITUATIONS.description}
          </p>
        </motion.div>

        <div className="relative dth-biz-container">
          <div
            className="hidden md:block absolute left-0 right-0 top-4 h-px bg-[rgba(9,11,21,0.12)]"
            aria-hidden="true"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {BUSINESS_SITUATIONS.items.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 1, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="relative pt-2"
              >
                <span
                  className="hidden md:flex w-3 h-3 rounded-full bg-energy mb-5 relative z-10"
                  aria-hidden="true"
                />
                <h3 className="font-display font-bold text-text-primary text-xl sm:text-2xl leading-snug mb-3">
                  {item.title}
                </h3>
                <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
