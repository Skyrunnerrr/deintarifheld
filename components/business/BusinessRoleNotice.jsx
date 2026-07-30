'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_ROLE } from '@/lib/business-content'

export function BusinessRoleNotice() {
  return (
    <Section id="rolle" className="bg-bg-base">
      <div className="dth-biz-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <motion.div
          initial={{ opacity: 1, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-6 order-2 lg:order-1"
        >
          <div
            className="relative w-full overflow-hidden rounded-[26px] bg-[#EEF0F4]"
            style={{ aspectRatio: '4 / 3', minHeight: 360 }}
          >
            <Image
              src="/business/advisory/conference.webp"
              alt=""
              fill
              loading="lazy"
              unoptimized
              sizes="(max-width: 1024px) 100vw, 620px"
              style={{ objectFit: 'cover', objectPosition: '50% 40%' }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 1, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-6 order-1 lg:order-2 rounded-[26px] bg-white px-8 py-10 sm:px-11 sm:py-12"
          style={{
            border: '1px solid rgba(9,11,21,0.10)',
            boxShadow: '0 16px 44px rgba(9,11,21,0.07)',
          }}
        >
          <SectionLabel variant="energy">{BUSINESS_ROLE.label}</SectionLabel>
          <SectionHeading className="dth-section-heading mt-5 mb-5 text-[1.85rem] sm:text-3xl md:text-[2.35rem] leading-[1.16]">
            {BUSINESS_ROLE.title}
          </SectionHeading>
          <p className="font-body text-text-primary text-lg sm:text-xl leading-relaxed mb-7">
            {BUSINESS_ROLE.body}
          </p>
          <ul className="grid grid-cols-1 gap-y-3.5" role="list">
            {BUSINESS_ROLE.details.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2.5 w-2 h-2 rounded-full bg-energy flex-shrink-0" aria-hidden="true" />
                <span className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </Section>
  )
}
