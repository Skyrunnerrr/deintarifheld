// Restored after APFS sparse-file corruption
'use client'

import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Input-Feld
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className, id, required, ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="font-body text-sm font-medium text-text-secondary"
        >
          {label}
          {required && <span className="text-volt ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full px-4 py-3 rounded-2xl',
          'bg-bg-input border border-white/8',
          'text-text-primary font-body text-base placeholder:text-text-tertiary',
          'transition-all duration-200',
          'focus:outline-none focus:border-volt/50 focus:ring-2 focus:ring-volt/15',
          'hover:border-white/15',
          error && 'border-energy/60 focus:border-energy focus:ring-energy/15',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        required={required}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-text-tertiary text-xs font-body">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-energy text-xs font-body" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

/**
 * Select-Feld
 */
export const Select = forwardRef(function Select(
  { label, options = [], error, className, id, required, placeholder, ...props },
  ref
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="font-body text-sm font-medium text-text-secondary">
          {label}
          {required && <span className="text-volt ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'w-full px-4 py-3 rounded-2xl',
          'bg-bg-input border border-white/8',
          'text-text-primary font-body text-base',
          'transition-all duration-200',
          'focus:outline-none focus:border-volt/50 focus:ring-2 focus:ring-volt/15',
          'hover:border-white/15',
          'appearance-none cursor-pointer',
          error && 'border-energy/60',
          className
        )}
        required={required}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-bg-elevated">
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-energy text-xs font-body" role="alert">{error}</p>
      )}
    </div>
  )
})

/**
 * Textarea
 */
export const Textarea = forwardRef(function Textarea(
  { label, error, className, id, required, rows = 4, ...props },
  ref
) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="font-body text-sm font-medium text-text-secondary">
          {label}
          {required && <span className="text-volt ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full px-4 py-3 rounded-2xl resize-none',
          'bg-bg-input border border-white/8',
          'text-text-primary font-body text-base placeholder:text-text-tertiary',
          'transition-all duration-200',
          'focus:outline-none focus:border-volt/50 focus:ring-2 focus:ring-volt/15',
          'hover:border-white/15',
          error && 'border-energy/60',
          className
        )}
        required={required}
        {...props}
      />
      {error && (
        <p className="text-energy text-xs font-body" role="alert">{error}</p>
      )}
    </div>
  )
})

/**
 * Checkbox
 */
export const Checkbox = forwardRef(function Checkbox(
  { label, error, className, id, required, ...props },
  ref
) {
  const generatedId = useId()
  const checkId = id || `checkbox-${generatedId}`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={checkId} className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 flex-shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={checkId}
            className="sr-only peer"
            required={required}
            {...props}
          />
          <div className={cn(
            'w-5 h-5 rounded-md border border-white/15 bg-bg-input',
            'peer-checked:bg-volt peer-checked:border-volt',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-volt/30',
            'transition-all duration-200 group-hover:border-white/25',
            className
          )} aria-hidden="true">
            <svg
              className="w-3 h-3 text-bg-base absolute top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity"
              fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          </div>
        </div>
        <span className="text-sm text-text-secondary font-body leading-relaxed group-hover:text-text-primary transition-colors">
          {label}
          {required && <span className="text-volt ml-1" aria-hidden="true">*</span>}
        </span>
      </label>
      {error && (
        <p className="text-energy text-xs font-body ml-8" role="alert">{error}</p>
      )}
    </div>
  )
})

/**
 * Progress Bar
 */
export function ProgressBar({ current, total, className }) {
  const percentage = Math.round((current / total) * 100)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-body text-text-secondary">
          Schritt {current} von {total}
        </span>
        <span className="text-xs font-display font-bold text-volt">
          {percentage}%
        </span>
      </div>
      <div
        className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Fortschritt: ${percentage}%`}
      >
        <div
          className="h-full bg-volt rounded-full transition-all duration-500 ease-out shadow-volt"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Toggle / Radio-Gruppe (z.B. Strom / Gas)
 */
export function RadioToggle({ options = [], value, onChange, name, className }) {
  return (
    <div
      className={cn(
        'flex rounded-2xl bg-bg-input border border-white/8 p-1 gap-1',
        className
      )}
      role="radiogroup"
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-xl text-sm font-display font-bold transition-all duration-200',
            value === option.value
              ? 'bg-volt text-bg-base shadow-volt/30'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          )}
        >
          {option.icon && <span className="mr-1.5">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default { Input, Select, Textarea, Checkbox, ProgressBar, RadioToggle }
