// Restored after APFS sparse-file corruption
'use client'

import { cn } from '@/lib/utils'

/**
 * Section Label / Pill Badge über Überschriften
 */
export function SectionLabel({ children, variant = 'volt', className }) {
  const variants = {
    volt:    'bg-volt/10 text-volt border-volt/20',
    energy:  'bg-energy/10 text-energy border-energy/20',
    ice:     'bg-ice/10 text-ice border-ice/20',
    subtle:  'bg-white/5 text-text-secondary border-white/10',
    partner: 'bg-[#0A5ADB]/10 text-[#0A5ADB] border-[#0A5ADB]/20',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-2xl border',
        'font-body text-sm font-medium tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Display Heading H1 — größte Überschrift
 */
export function DisplayHeading({ children, className, as: Tag = 'h1' }) {
  return (
    <Tag
      className={cn(
        'font-display font-black text-text-primary',
        'text-4xl sm:text-5xl md:text-6xl lg:text-7xl',
        'leading-[1.05] tracking-tight',
        className
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * Section Heading H2
 */
export function SectionHeading({ children, className, as: Tag = 'h2', centered = false }) {
  return (
    <Tag
      className={cn(
        'font-display font-extrabold text-text-primary',
        'text-3xl sm:text-4xl md:text-5xl',
        'leading-[1.1] tracking-tight',
        centered && 'text-center',
        className
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * Sub-Heading H3
 */
export function SubHeading({ children, className, as: Tag = 'h3' }) {
  return (
    <Tag
      className={cn(
        'font-display font-bold text-text-primary',
        'text-xl sm:text-2xl',
        'leading-snug tracking-tight',
        className
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * Lead-Text (großer Fließtext unter Überschriften)
 */
export function LeadText({ children, className }) {
  return (
    <p
      className={cn(
        'font-body text-text-secondary',
        'text-lg sm:text-xl leading-relaxed',
        className
      )}
    >
      {children}
    </p>
  )
}

/**
 * Check-Liste mit Volt-Haken
 */
export function CheckList({ items = [], variant = 'volt', className, itemClassName }) {
  const variantColors = {
    volt:    'text-volt',
    energy:  'text-energy',
    ice:     'text-ice',
    check:   'text-green-400',
    partner: 'text-[#0A5ADB]',
  }

  return (
    <ul className={cn('flex flex-col gap-3', className)} role="list">
      {items.map((item, i) => (
        <li key={i} className={cn('flex items-start gap-3', itemClassName)}>
          <span
            className={cn('flex-shrink-0 text-lg leading-none mt-0.5', variantColors[variant])}
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="text-text-secondary font-body text-base leading-relaxed">
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Inline Trust-Indikatoren (✓ Kostenlos ✓ Unverbindlich ...)
 */
export function TrustIndicators({ items = [], variant = 'volt', className }) {
  const checkColor = {
    volt:    'text-volt',
    energy:  'text-energy',
    partner: 'text-[#0A5ADB]',
  }[variant] || 'text-volt'

  return (
    <div className={cn('flex flex-wrap gap-x-5 gap-y-2', className)} role="list">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5" role="listitem">
          <span className={cn(checkColor, 'text-sm')} aria-hidden="true">✓</span>
          <span className="font-body text-sm text-text-secondary">{item}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Volt-farbenes Text-Highlight
 */
export function VoltText({ children, className }) {
  return (
    <span className={cn('text-gradient-volt', className)}>
      {children}
    </span>
  )
}

export default {
  SectionLabel,
  DisplayHeading,
  SectionHeading,
  SubHeading,
  LeadText,
  CheckList,
  TrustIndicators,
  VoltText,
}
