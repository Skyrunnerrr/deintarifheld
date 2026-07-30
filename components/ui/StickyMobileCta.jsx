'use client'

import { usePathname } from 'next/navigation'

/** DTH-04: On /unternehmen-neu, sticky CTA must target the business form — not #rechner. */
function isBusinessPreviewRoute(pathname) {
  return pathname === '/unternehmen-neu' || pathname?.startsWith('/unternehmen-neu/')
}

export function StickyMobileCta() {
  const pathname = usePathname()
  const isBusinessPreview = isBusinessPreviewRoute(pathname)
  const href = isBusinessPreview ? '#formular' : '#rechner'

  return (
    <a
      href={href}
      aria-label="Kostenlos prüfen"
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'none', /* wird via CSS auf Mobile eingeblendet */
        alignItems: 'center',
        gap: 8,
        background: isBusinessPreview ? '#F98540' : '#D4FF3E',
        color: isBusinessPreview ? '#FFFFFF' : '#090B0F',
        fontWeight: 800,
        fontSize: 14,
        padding: '14px 24px',
        borderRadius: isBusinessPreview ? 16 : 999,
        boxShadow: isBusinessPreview
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
      Kostenlos prüfen →
    </a>
  )
}
