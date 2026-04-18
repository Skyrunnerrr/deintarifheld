// Restored after APFS sparse-file corruption
'use client'

import { cn } from '@/lib/utils'

/**
 * Basis-Karte
 */
export function Card({ children, className, hover = false, glow = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-bg-surface border border-white/6 shadow-card',
        hover && 'transition-all duration-300 hover:border-white/12 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]',
        glow  && 'hover:shadow-volt',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Feature-Karte mit Icon, Titel und Beschreibung
 */
export function FeatureCard({ icon, title, description, number, className, ...props }) {
  return (
    <Card
      hover
      className={cn('p-6 md:p-8 group', className)}
      {...props}
    >
      {number && (
        <span className="font-display font-black text-4xl text-gradient-volt opacity-40 group-hover:opacity-70 transition-opacity duration-300 block mb-4">
          {number}
        </span>
      )}
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-volt/10 border border-volt/20 flex items-center justify-center mb-4 group-hover:bg-volt/15 transition-colors duration-300">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="font-display font-bold text-xl text-text-primary mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-text-secondary text-sm leading-relaxed">
          {description}
        </p>
      )}
    </Card>
  )
}

/**
 * Statistik-Karte
 */
export function StatCard({ value, label, suffix = '', prefix = '', className, ...props }) {
  return (
    <Card
      className={cn('p-6 text-center group hover:border-volt/20 transition-all duration-300', className)}
      {...props}
    >
      <div className="font-display font-black text-4xl md:text-5xl text-gradient-volt mb-2 group-hover:drop-shadow-[0_0_16px_rgba(212,255,62,0.4)] transition-all duration-300">
        {prefix}{value}{suffix}
      </div>
      <div className="text-text-secondary text-sm font-body">
        {label}
      </div>
    </Card>
  )
}

/**
 * Badge / Pill
 */
export function Badge({ children, variant = 'volt', className, ...props }) {
  const variants = {
    volt:   'bg-volt/10 text-volt border border-volt/20',
    energy: 'bg-energy/10 text-energy border border-energy/20',
    ice:    'bg-ice/10 text-ice border border-ice/20',
    subtle: 'bg-white/5 text-text-secondary border border-white/8',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm font-body font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Testimonial-Karte
 */
export function TestimonialCard({ name, city, savings, rating = 5, text, type, className, ...props }) {
  return (
    <Card
      hover
      className={cn('p-6 md:p-8 flex flex-col gap-4', className)}
      {...props}
    >
      {/* Sterne */}
      <div className="flex gap-1" aria-label={`${rating} von 5 Sternen`}>
        {Array.from({ length: rating }).map((_, i) => (
          <span key={i} className="text-volt text-lg" aria-hidden="true">★</span>
        ))}
      </div>

      {/* Text */}
      <p className="text-text-secondary text-sm leading-relaxed italic flex-1">
        {text}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/6">
        <div>
          <div className="font-display font-bold text-text-primary">{name}</div>
          <div className="text-text-tertiary text-xs">{city} · {type}</div>
        </div>
        <div className="font-display font-black text-volt text-lg">
          {savings}<span className="text-text-tertiary text-xs font-body font-normal ml-1">gespart</span>
        </div>
      </div>
    </Card>
  )
}

export default Card
