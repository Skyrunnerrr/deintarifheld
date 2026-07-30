'use client'

import { useEffect, useState } from 'react'
import { BusinessBrandLockup } from '@/components/business/BusinessBrandLockup'
import { scrollToAnchor } from '@/components/business/scrollToAnchor'

const NAV_LINKS = [
  { label: 'Unternehmen', href: '/unternehmen-neu/' },
  { label: "So funktioniert's", href: '#ablauf' },
  { label: 'Karriere', href: '/karriere' },
]

function scrollToForm(e) {
  e?.preventDefault?.()
  scrollToAnchor('formular')
}

function scrollToAblauf(e) {
  e?.preventDefault?.()
  scrollToAnchor('ablauf')
}

/**
 * DTH-06 — route-local Business header for /unternehmen-neu.
 * Uses official logo artwork unchanged + textual "Business" lockup.
 * Prepared for later subdomain reuse (no host routing).
 */
export function BusinessHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lockupSize, setLockupSize] = useState('desktop')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)')
    const apply = () => setLockupSize(mq.matches ? 'mobile' : 'desktop')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <>
      <header
        role="banner"
        className="dth-biz-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transition: 'background 240ms, box-shadow 240ms, border-color 240ms',
          background: scrolled ? 'rgba(255,255,255,0.94)' : 'rgba(245,244,241,0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: scrolled
            ? '1px solid rgba(21,32,51,0.10)'
            : '1px solid rgba(21,32,51,0.07)',
          boxShadow: scrolled ? '0 1px 18px rgba(21,32,51,0.06)' : 'none',
        }}
      >
        <nav
          aria-label="Unternehmensnavigation"
          className="dth-biz-header-inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 1220,
            margin: '0 auto',
            padding: '14px 28px',
            gap: 22,
          }}
        >
          <BusinessBrandLockup href="/" size={lockupSize} />

          <ul
            role="list"
            className="dth-biz-header-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => {
                    if (link.href === '#ablauf') scrollToAblauf(e)
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'block',
                    padding: '11px 18px',
                    borderRadius: 10,
                    fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                    fontWeight: 650,
                    fontSize: 16,
                    color: '#3F4858',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="dth-biz-header-cta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href="#formular"
              onClick={scrollToForm}
              className="dth-btn-primary"
              style={{
                padding: '13px 22px',
                minHeight: 50,
                fontSize: 15,
              }}
            >
              Kostenlos analysieren
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <button
            type="button"
            className="dth-biz-header-burger"
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
            aria-controls="business-mobile-menu"
            onClick={() => setMenuOpen((p) => !p)}
            style={{
              display: 'none',
              border: 'none',
              background: 'transparent',
              color: '#152033',
              padding: 8,
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M2 2l18 12M20 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M1 1h20M1 8h20M1 15h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </nav>
      </header>

      <div
        id="business-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Unternehmensnavigation"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(245,244,241,0.98)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 220ms',
        }}
      >
        <div style={{ height: 72 }} aria-hidden="true" />
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: '8px 20px', flex: 1 }}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={(e) => {
                  if (link.href === '#ablauf') scrollToAblauf(e)
                  setMenuOpen(false)
                }}
                style={{
                  display: 'block',
                  padding: '16px 4px',
                  borderBottom: '1px solid rgba(21,32,51,0.10)',
                  fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                  fontWeight: 700,
                  fontSize: 22,
                  color: '#152033',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div style={{ padding: '16px 20px 32px' }}>
          <a
            href="#formular"
            onClick={(e) => {
              scrollToForm(e)
              setMenuOpen(false)
            }}
            className="dth-btn-primary"
            style={{ width: '100%', minHeight: 52 }}
          >
            Kostenlos analysieren →
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .dth-biz-header-links { display: none !important; }
          .dth-biz-header-cta { display: none !important; }
          .dth-biz-header-burger { display: flex !important; }
        }
      `}</style>
    </>
  )
}

export default BusinessHeader
