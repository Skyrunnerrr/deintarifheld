// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from '@/lib/constants'
// ─── Inline SVG Icons ─────────────────────────────────────────────
function IconBolt() {
  return (
    <svg width="18" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.5 2L3.5 11.5H9.5L8.5 18L16.5 8.5H10.5Z" fill="#D4FF3E" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
      <path d="M1 1h20M1 8h20M1 15h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const scrollToFunnel = () => {
    setMenuOpen(false)
    // DTH-04: On business preview, Header-CTA must not target the private funnel.
    const isBusinessPreview =
      pathname === '/unternehmen-neu' || pathname?.startsWith('/unternehmen-neu/')
    const targetId = isBusinessPreview ? 'formular' : 'funnel'
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <header
        role="banner"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 50,
          transition: 'background 300ms, box-shadow 300ms, border-color 300ms',
          ...(scrolled ? {
            background: 'rgba(9,11,15,0.80)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 1px 24px rgba(0,0,0,0.5)',
          } : {
            background: 'transparent',
            borderBottom: '1px solid transparent',
          }),
        }}
      >
        <nav
          aria-label="Hauptnavigation"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 48px',
          }}
          className="navbar-inner"
        >
          {/* ── Logo ── */}
          <Link
            href="/"
            aria-label="Dein Tarifheld — Startseite"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              textDecoration: 'none',
              outline: 'none',
              minHeight: 56,
            }}
          >
            <img
              src="/images/tari-nobg.png"
              alt="Tarifheld Maskottchen"
              style={{
                height: 52,
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
                display: 'block',
              }}
            />
            <span style={{
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontWeight: 900,
              fontSize: 21,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#F2F4F8',
            }}>
              Dein<span style={{ color: '#D4FF3E' }}>Tarifheld</span>
            </span>
          </Link>

          {/* ── Desktop Nav ── */}
          <ul
            role="list"
            className="navbar-desktop-links"
            style={{ display: 'flex', alignItems: 'center', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}
          >
            {(pathname === '/unternehmen' ? [{ label: 'Privatkunden', href: '/' }, ...NAV_LINKS] : NAV_LINKS).map(link => (
              <li key={link.href}>
                <a
                  href={link.href}
                  style={{
                    display: 'block',
                    padding: '8px 16px',
                    borderRadius: 12,
                    fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                    fontWeight: 600,
                    fontSize: 14,
                    color: '#8E97A8',
                    textDecoration: 'none',
                    transition: 'color 200ms, background 200ms',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F2F4F8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#8E97A8'; e.currentTarget.style.background = 'transparent' }}
                  onFocus={e => { e.currentTarget.style.outline = '2px solid rgba(212,255,62,0.4)'; e.currentTarget.style.outlineOffset = '2px' }}
                  onBlur={e => { e.currentTarget.style.outline = 'none' }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* ── Desktop CTAs ── */}
          <div className="navbar-desktop-cta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Primary CTA */}
            <button
              onClick={scrollToFunnel}
              aria-label="Kostenlose Tarifanalyse starten"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px',
                borderRadius: 13,
                border: 'none',
                background: '#D4FF3E',
                color: '#090B0F',
                fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(212,255,62,0.22)',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#B8E032'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(212,255,62,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#D4FF3E'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 20px rgba(212,255,62,0.22)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            >
              Kostenlos analysieren
              <IconArrow />
            </button>
          </div>

          {/* ── Hamburger ── */}
          <button
            className="navbar-hamburger"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            style={{
              display: 'none',
              padding: 8, borderRadius: 10,
              background: 'transparent',
              border: 'none',
              color: '#8E97A8',
              cursor: 'pointer',
              transition: 'color 200ms, background 200ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F2F4F8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8E97A8'; e.currentTarget.style.background = 'transparent' }}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </nav>
      </header>

      {/* ── Mobile Overlay ── */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        style={{
          position: 'fixed', inset: 0,
          zIndex: 40,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(9,11,15,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'opacity 300ms, transform 300ms',
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? 'none' : 'translateY(-8px)',
          pointerEvents: menuOpen ? 'auto' : 'none',
        }}
      >
        {/* Spacer for header height */}
        <div style={{ height: 72, flexShrink: 0 }} aria-hidden="true" />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0 20px 32px' }}>
          {/* Nav Links */}
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(pathname === '/unternehmen' ? [{ label: 'Privatkunden', href: '/' }, ...NAV_LINKS] : NAV_LINKS).map((link, i) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '16px 8px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                    fontWeight: 700,
                    fontSize: 'clamp(20px, 5.5vw, 26px)',
                    color: '#F2F4F8',
                    textDecoration: 'none',
                    transition: 'color 200ms',
                    transitionDelay: `${i * 40}ms`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#D4FF3E'}
                  onMouseLeave={e => e.currentTarget.style.color = '#F2F4F8'}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Mobile CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            <button
              onClick={scrollToFunnel}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                padding: '16px 24px',
                borderRadius: 16,
                border: 'none',
                background: '#D4FF3E',
                color: '#090B0F',
                fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                fontWeight: 800, fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(212,255,62,0.22)',
              }}
            >
              Kostenlos analysieren
              <IconArrow />
            </button>
          </div>
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 1024px) {
          .navbar-inner { padding: 14px 20px !important; }
          .navbar-desktop-links { display: none !important; }
          .navbar-desktop-cta   { display: none !important; }
          .navbar-hamburger     { display: flex !important; }
        }
      `}</style>
    </>
  )
}

export default Navbar
