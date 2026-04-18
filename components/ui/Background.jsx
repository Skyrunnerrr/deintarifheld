'use client'

import { cn } from '@/lib/utils'

/**
 * Ambient Background mit schwebenden Orbs
 */
const ORB_THEMES = {
  volt: {
    orb1: 'radial-gradient(circle, rgba(212,255,62,0.07) 0%, transparent 70%)',
    orb2: 'radial-gradient(circle, rgba(184,224,50,0.05) 0%, transparent 70%)',
    orb3: 'radial-gradient(circle, rgba(138,170,32,0.04) 0%, transparent 70%)',
  },
  energy: {
    orb1: 'radial-gradient(circle, rgba(255,107,43,0.07) 0%, transparent 70%)',
    orb2: 'radial-gradient(circle, rgba(229,90,31,0.05) 0%, transparent 70%)',
    orb3: 'radial-gradient(circle, rgba(255,139,90,0.04) 0%, transparent 70%)',
  },
  partner: {
    orb1: 'radial-gradient(circle, rgba(10,90,219,0.07) 0%, transparent 70%)',
    orb2: 'radial-gradient(circle, rgba(8,60,146,0.05) 0%, transparent 70%)',
    orb3: 'radial-gradient(circle, rgba(10,90,219,0.04) 0%, transparent 70%)',
  },
}

export function AmbientBg({ className, variant = 'volt' }) {
  const theme = ORB_THEMES[variant] || ORB_THEMES.volt
  return (
    <div
      className={cn('pointer-events-none', className)}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '-120px',
        bottom: '-120px',
        left: '50%',
        width: '100vw',
        transform: 'translateX(-50%)',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <div
        className="absolute animate-orb-float"
        style={{
          top: '-10%',
          right: '0%',
          width: '600px',
          height: '600px',
          background: theme.orb1,
          borderRadius: '50%',
        }}
      />
      <div
        className="absolute animate-orb-float-2"
        style={{
          top: '30%',
          left: '0%',
          width: '500px',
          height: '500px',
          background: theme.orb2,
          borderRadius: '50%',
        }}
      />
      <div
        className="absolute animate-orb-float-3"
        style={{
          bottom: '-5%',
          left: '40%',
          width: '400px',
          height: '400px',
          background: theme.orb3,
          borderRadius: '50%',
        }}
      />
    </div>
  )
}

/**
 * Grid-Hintergrund (subtiles Raster)
 */
export function GridBg({ className }) {
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none bg-grid opacity-60', className)}
      aria-hidden="true"
    />
  )
}

/**
 * Horizontale Glow-Linie (Trenner zwischen Sections)
 */
export function GlowLine({ color = 'volt', className }) {
  const gradients = {
    volt:    'from-transparent via-volt/30 to-transparent',
    energy:  'from-transparent via-energy/30 to-transparent',
    ice:     'from-transparent via-ice/30 to-transparent',
    white:   'from-transparent via-white/10 to-transparent',
    partner: 'from-transparent via-[#0A5ADB]/30 to-transparent',
  }

  return (
    <div
      className={cn(`w-full h-px bg-gradient-to-r ${gradients[color]}`, className)}
      aria-hidden="true"
    />
  )
}

/**
 * Section Wrapper mit konsistentem Padding
 */
export function Section({ children, id, className, style, innerClassName }) {
  return (
    <section
      id={id}
      className={cn('relative w-full py-20 md:py-28', className)}
      style={style}
    >
      <div className={cn('relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', innerClassName)}>
        {children}
      </div>
    </section>
  )
}

/**
 * Floating Chip — schwebendes Info-Badge
 */
export function FloatingChip({ icon, text, className, style }) {
  return (
    <div
      className={cn(
        'absolute flex items-center gap-2 px-3 py-2 rounded-2xl',
        'bg-bg-elevated/90 border border-white/10 shadow-card',
        'backdrop-blur-xl',
        'font-body text-xs font-semibold text-text-primary',
        'animate-orb-float-3',
        className
      )}
      style={style}
      aria-hidden="true"
    >
      {icon && <span>{icon}</span>}
      <span>{text}</span>
    </div>
  )
}

export default { AmbientBg, GridBg, GlowLine, Section, FloatingChip }
