'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { SectionLabel, SectionHeading } from '@/components/ui/Typography'
import { BUSINESS_AUDIENCE } from '@/lib/business-content'

/**
 * One local industry photograph per unchanged audience item.
 * Paths map 1:1 to public/business/industries/*.webp.
 */
const AUDIENCE_MEDIA = [
  { src: '/business/industries/gewerbe.webp', position: '50% 45%' },
  { src: '/business/industries/gastronomie.webp', position: '50% 40%' },
  { src: '/business/industries/autohaus.webp', position: '50% 42%' },
  { src: '/business/industries/gesundheit.webp', position: '50% 40%' },
  { src: '/business/industries/produktion.webp', position: '40% 40%' },
  { src: '/business/industries/hausverwaltung.webp', position: '50% 45%' },
]

export function BusinessAudience() {
  return (
    <Section id="zielgruppen" className="bg-bg-base">
      <motion.div
        initial={{ opacity: 1, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8 sm:mb-10 flex flex-col items-center gap-4"
      >
        <SectionLabel variant="energy">{BUSINESS_AUDIENCE.label}</SectionLabel>
        <SectionHeading centered className="dth-section-heading max-w-3xl text-[1.85rem] sm:text-3xl md:text-[2.4rem] leading-[1.14]">
          {BUSINESS_AUDIENCE.title}
        </SectionHeading>
        <p className="font-body text-text-secondary text-lg sm:text-xl max-w-2xl">
          {BUSINESS_AUDIENCE.description}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-[1220px] mx-auto">
        {BUSINESS_AUDIENCE.items.map((item, i) => {
          const media = AUDIENCE_MEDIA[i]
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 1, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
              className="flex flex-col overflow-hidden rounded-[22px] bg-white border border-[rgba(9,11,21,0.10)] shadow-[0_10px_30px_rgba(9,11,21,0.05)] h-full"
            >
              <div className="relative w-full dth-audience-media aspect-[4/3] bg-[#EEF0F4]">
                <Image
                  src={media.src}
                  alt=""
                  fill
                  loading="lazy"
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                  style={{ objectFit: 'cover', objectPosition: media.position }}
                />
              </div>
              <div className="flex flex-col gap-3 p-6 sm:p-7 flex-1">
                <h3 className="font-display font-bold text-text-primary text-xl leading-snug">
                  {item.title}
                </h3>
                <p className="font-body text-text-secondary text-base sm:text-lg leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </Section>
  )
}
