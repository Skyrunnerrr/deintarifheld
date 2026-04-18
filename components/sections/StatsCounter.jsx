// Restored after APFS sparse-file corruption
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Section } from '@/components/ui/Background'
import { STATS } from '@/lib/constants'

function useCountUp(target, duration = 3500, started = false) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!started) return
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, started])

  return value
}

function StatItem({ stat, delay = 0, isLast = false }) {
  const [started, setStarted] = useState(false)
  const ref = useRef(null)
  const count = useCountUp(stat.value, 3500, started)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.4 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const displayValue = stat.value >= 1000
    ? count.toLocaleString('de-DE')
    : count

  return (
    <div className="flex items-stretch" ref={ref}>
      {/* Zahl + Label */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-2 px-4 sm:px-6 md:px-10 py-2 flex-1"
      >
        {/* Kleiner Akzent-Strich oben */}
        <div
          className="w-6 h-0.5 rounded-full mb-1"
          style={{ background: 'rgba(212,255,62,0.35)' }}
        />
        <div
          className="font-display font-black text-gradient-volt leading-none"
          style={{ fontSize: 'clamp(36px, 4vw, 58px)', letterSpacing: '-0.03em' }}
          aria-label={`${stat.prefix}${stat.value}${stat.suffix} ${stat.label}`}
        >
          {stat.prefix}{displayValue}{stat.suffix}
        </div>
        <div className="font-body text-text-secondary text-sm text-center mt-1">
          {stat.label}
        </div>
      </motion.div>

      {/* Vertikaler Trenner — nur zwischen Elementen */}
      {!isLast && (
        <div
          className="self-stretch w-px my-4 hidden md:block"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent)' }}
        />
      )}
    </div>
  )
}

export function StatsCounter() {
  return (
    <Section
      id="stats"
      className="bg-bg-elevated border-y border-white/6"
    >
      <div className="flex flex-col md:flex-row items-stretch divide-y divide-white/6 md:divide-y-0">
        {STATS.map((stat, i) => (
          <StatItem
            key={stat.label}
            stat={stat}
            delay={i * 0.12}
            isLast={i === STATS.length - 1}
          />
        ))}
      </div>
      <p style={{
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-tertiary, #5A6272)',
        marginTop: 16,
        lineHeight: 1.5,
      }}>
        Kumulierte Ersparnis aller Tarifheld-Kunden (Stand: 2025). Individuelle Ergebnisse variieren.
      </p>
    </Section>
  )
}


export default StatsCounter
