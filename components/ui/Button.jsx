// Restored after APFS sparse-file corruption
'use client'

import { cn } from '@/lib/utils'

/**
 * Button Komponente — 6 Varianten
 * primary | secondary | ghost | outline | volt | energy
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  icon,
  iconPosition = 'right',
  ...props
}) {
  const base = [
    'inline-flex items-center justify-center gap-2',
    'font-display font-bold tracking-tight',
    'rounded-2xl transition-all duration-200',
    'active:scale-[0.97]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt/60 focus-visible:outline-offset-3',
    'disabled:opacity-40 disabled:pointer-events-none',
    'cursor-pointer select-none whitespace-nowrap',
  ]

  const variants = {
    primary: [
      'bg-volt text-bg-base',
      'hover:bg-volt/90 hover:shadow-volt',
      'shadow-volt/30',
    ],
    secondary: [
      'bg-bg-elevated text-text-primary border border-white/10',
      'hover:bg-bg-overlay hover:border-white/20',
    ],
    ghost: [
      'bg-transparent text-text-secondary border border-transparent',
      'hover:text-text-primary hover:bg-white/5',
    ],
    outline: [
      'bg-transparent text-volt border border-volt/40',
      'hover:bg-volt/10 hover:border-volt/70',
    ],
    volt: [
      'bg-volt text-bg-base font-black',
      'hover:bg-volt/90 hover:shadow-volt',
      'shadow-volt animate-pulse-volt',
    ],
    energy: [
      'bg-energy text-white',
      'hover:bg-energy/90 hover:shadow-energy',
    ],
    partner: [
      'bg-[#0A5ADB] text-white',
      'hover:bg-[#083C92]',
    ],
  }

  const sizes = {
    sm:  'text-sm px-4 py-2 h-9',
    md:  'text-base px-6 py-3 h-12',
    lg:  'text-lg px-8 py-4 h-14',
    xl:  'text-xl px-10 py-5 h-16',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  )
}

export default Button
