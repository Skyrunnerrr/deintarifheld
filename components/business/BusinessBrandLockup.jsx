'use client'

import Image from 'next/image'
import Link from 'next/link'

const ORANGE = '#F98540'
const NAVY = '#090B15'

/**
 * Route-local Business brand lockup for /unternehmen-neu only.
 * Emblem = approved orange T-shield. Wordmark = HTML text. No mascot.
 */
export function BusinessBrandLockup({
  href = '/',
  size = 'desktop',
  className = '',
}) {
  const emblem = size === 'mobile' ? 36 : size === 'footer' ? 46 : 46
  const wordSize = size === 'mobile' ? 18 : size === 'footer' ? 20 : 22
  const businessSize = size === 'mobile' ? 11 : 13
  const gap = size === 'mobile' ? 9 : 12

  return (
    <Link
      href={href}
      aria-label="DeinTarifheld Business — Startseite"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        textDecoration: 'none',
        minHeight: size === 'mobile' ? 44 : 52,
        flexShrink: 0,
      }}
    >
      <Image
        src="/business/brand/deintarifheld-business-emblem.png"
        alt=""
        width={emblem}
        height={emblem}
        priority={size === 'desktop'}
        style={{
          width: emblem,
          height: emblem,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.05,
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontWeight: 900,
            fontSize: wordSize,
            letterSpacing: '-0.03em',
            color: NAVY,
          }}
        >
          Dein<span style={{ color: ORANGE }}>Tarifheld</span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
            fontWeight: 700,
            fontSize: businessSize,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: ORANGE,
          }}
        >
          Business
        </span>
      </span>
    </Link>
  )
}

export default BusinessBrandLockup
