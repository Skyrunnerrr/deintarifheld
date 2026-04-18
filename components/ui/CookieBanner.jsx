// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const STORAGE_KEY = 'th_consent'

// Externe Scripts (Analytics, ProvenExpert etc.) NUR nach expliziter Zustimmung laden
function loadExternalScripts() {
  // Platzhalter – hier externe <script>-Tags dynamisch einfügen, z.B.:
  // const s = document.createElement('script'); s.src = '...'; s.defer = true; document.head.appendChild(s)
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const pathname = usePathname()
  const isB2B = pathname?.startsWith('/unternehmen')
  const isKarriere = pathname?.startsWith('/karriere')
  const accentColor = isB2B ? '#FF6B2B' : isKarriere ? '#0A5ADB' : '#D4FF3E'
  const accentHover  = isB2B ? '#E55A22' : isKarriere ? '#083C92' : '#B8E032'
  const accentText   = isB2B ? '#ffffff' : isKarriere ? '#ffffff' : '#090B0F'

  useEffect(() => {
    // Banner nur zeigen wenn noch keine Entscheidung getroffen wurde
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  function acceptAll() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ essential: true, analytics: true, timestamp: Date.now() }))
    loadExternalScripts()
    setVisible(false)
  }

  function acceptEssential() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ essential: true, analytics: false, timestamp: Date.now() }))
    setVisible(false)
  }

  // Globale Funktion damit der Footer-Link den Banner wieder öffnen kann
  useEffect(() => {
    window.__openCookieBanner = () => setVisible(true)
    return () => { delete window.__openCookieBanner }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'max(12px, env(safe-area-inset-bottom))',
            padding: '0 max(12px, env(safe-area-inset-left))',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 120,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-live="polite"
            aria-label="Cookie-Einstellungen"
            className="cookie-banner"
            style={{
              width: '100%',
              maxWidth: 680,
              background: '#0F1218',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              padding: '20px 22px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              pointerEvents: 'auto',
            }}
          >
            <style>{`
              @media (min-width: 480px) {
                .cookie-banner { padding: 24px 28px !important; }
                .cookie-btn-row { flex-direction: row !important; }
                .cookie-btn-primary,
                .cookie-btn-secondary { flex: 0 0 auto !important; width: auto !important; }
                .cookie-btn-details { margin-left: auto !important; margin-top: 0 !important; }
              }
            `}</style>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🍪</span>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#F2F4F8', margin: 0 }}>
                Cookie-Einstellungen
              </p>
            </div>
          </div>

          {/* Text */}
          <p style={{ fontSize: 13, color: '#8E97A8', lineHeight: 1.65, marginBottom: 16 }}>
            Wir verwenden ausschließlich technisch notwendige Cookies, die für den Betrieb der Website erforderlich sind.
            Optionale Analyse-Cookies helfen uns, die Website zu verbessern. Es werden{' '}
            <strong style={{ color: '#D9DEE4' }}>keine Daten ohne deine Zustimmung</strong> an Dritte übermittelt.{' '}
            <Link
              href="/datenschutz"
              style={{ color: accentColor, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Datenschutzerklärung
            </Link>
          </p>

          {/* Details Toggle */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', marginBottom: 16 }}
              >
                <div style={{
                  background: '#141920', borderRadius: 12, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {/* Notwendige Cookies */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#F2F4F8', margin: '0 0 2px' }}>
                        Technisch notwendig
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Cookie-Einstellungen, Session — immer aktiv
                      </p>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      color: accentText, background: accentColor,
                      padding: '3px 10px', borderRadius: 6,
                    }}>
                      Immer aktiv
                    </span>
                  </div>

                  <div style={{ height: 1, background: '#1A1F28' }} />

                  {/* Analyse-Cookies */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#F2F4F8', margin: '0 0 2px' }}>
                        Analyse (optional)
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Anonyme Nutzungsstatistiken zur Verbesserung der Website
                      </p>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      color: '#6B7280', border: '1px solid #1A1F28',
                      padding: '3px 10px', borderRadius: 6,
                    }}>
                      Optional
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="cookie-btn-row" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
            <button
              onClick={acceptAll}
              className="cookie-btn-primary"
              style={{
                padding: '12px 22px', borderRadius: 12, border: 'none',
                background: accentColor, color: accentText,
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = accentHover}
              onMouseLeave={e => e.currentTarget.style.background = accentColor}
            >
              Alle akzeptieren
            </button>

            <button
              onClick={acceptEssential}
              className="cookie-btn-secondary"
              style={{
                padding: '12px 22px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#D9DEE4',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#D9DEE4' }}
            >
              Nur notwendige
            </button>

            <button
              onClick={() => setShowDetails(v => !v)}
              className="cookie-btn-details"
              style={{
                padding: '8px 16px', borderRadius: 12,
                border: 'none', background: 'transparent',
                color: '#6B7280', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'color 0.2s',
                textAlign: 'center', marginTop: 2,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#D9DEE4'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
            >
              {showDetails ? 'Details ausblenden ↑' : 'Details anzeigen ↓'}
            </button>
          </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default CookieBanner
