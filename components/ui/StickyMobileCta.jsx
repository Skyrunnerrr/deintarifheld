'use client'

import { usePathname } from 'next/navigation'

function resolveStickyCta(pathname) {
  if (pathname === '/') {
    return { href: '#rechner', label: 'Kostenlos prüfen', business: false }
  }
  if (pathname?.startsWith('/unternehmen')) {
    return { href: '#formular', label: 'Kostenlos prüfen', business: true }
  }
  if (pathname?.startsWith('/karriere')) {
    return { href: '#partneranfrage', label: 'Partneranfrage starten', business: false }
  }
  return null
}

export function StickyMobileCta() {
  const pathname = usePathname()
  const cta = resolveStickyCta(pathname)
  if (!cta) return null

  return (
    <a
      href={cta.href}
      aria-label={cta.label}
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'none',
        alignItems: 'center',
        gap: 8,
        background: cta.business ? '#F98540' : '#D4FF3E',
        color: cta.business ? '#FFFFFF' : '#090B0F',
        fontWeight: 800,
        fontSize: 14,
        padding: '14px 24px',
        borderRadius: cta.business ? 16 : 999,
        boxShadow: cta.business
          ? '0 6px 22px rgba(255,107,43,0.28)'
          : '0 4px 24px rgba(212,255,62,0.35)',
        textDecoration: 'none',
        whiteSpace: 'normal',
        textAlign: 'center',
        lineHeight: 1.25,
        width: 'min(340px, calc(100vw - 24px))',
      }}
      className="sticky-mobile-cta"
    >
      {cta.label} →
    </a>
  )
}
