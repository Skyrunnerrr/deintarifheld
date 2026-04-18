// Restored after APFS sparse-file corruption
'use client'

import { motion } from 'framer-motion'

// ─── Trust Badges ─────────────────────────────────────────────────
const BADGES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="19" height="19" rx="5" stroke="rgba(212,255,62,0.45)" strokeWidth="1.4" />
        <path d="M8 11l2.5 2.5L15 8" stroke="#D4FF3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 5v2M11 15v2M5 11H3M19 11h-2" stroke="rgba(212,255,62,0.3)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    label: 'SSL-Verschlüsselt',
  },
  {
    icon: (
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true">
        <path d="M10 1L2 5v6c0 5.25 3.4 10.15 8 11.35C14.6 21.15 18 16.25 18 11V5L10 1Z" stroke="rgba(212,255,62,0.45)" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="7.5" y="9" width="5" height="6" rx="1.2" stroke="#D4FF3E" strokeWidth="1.3" />
        <path d="M12.5 9V7.5a2.5 2.5 0 0 0-5 0V9" stroke="#D4FF3E" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    label: 'DSGVO-Konform',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="9.5" stroke="rgba(212,255,62,0.45)" strokeWidth="1.4" />
        <path d="M11 5.5v2.3M11 14.2v2.3M5.5 11h2.3M14.2 11h2.3" stroke="rgba(212,255,62,0.3)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M7.5 7.5l1.6 1.6M13 13l1.6 1.6M14.6 7.5l-1.6 1.6M7.5 14.5l1.6-1.6" stroke="rgba(212,255,62,0.2)" strokeWidth="1" strokeLinecap="round" />
        <circle cx="11" cy="11" r="2.5" stroke="#D4FF3E" strokeWidth="1.4" />
      </svg>
    ),
    label: 'Teleson GmbH',
  },
  {
    icon: (
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true">
        <path d="M10 1L2 4.5v6C2 15.5 5.5 20 10 21.5 14.5 20 18 15.5 18 10.5v-6L10 1Z" stroke="rgba(212,255,62,0.45)" strokeWidth="1.4" strokeLinejoin="round" />
        <path
          d="M10 5.5l1.2 2.8 3 .3-2.2 2 .7 2.9L10 12l-2.7 1.5.7-2.9-2.2-2 3-.3L10 5.5Z"
          stroke="#D4FF3E" strokeWidth="1.2" strokeLinejoin="round"
          fill="rgba(212,255,62,0.1)"
        />
      </svg>
    ),
    label: 'Geprüfter Anbieter',
  },
]

// ─── Placeholder Logo slots removed (no real logos available) ───────────────────

export function TrustLogos() {
  return (
    <section
      aria-label="Zertifizierungen und Partner"
      style={{
        padding: '32px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
      className="trust-logos-section"
    >
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>
        {/* Label */}
        <div style={{
          fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
          fontWeight: 700, fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#5A6272',
          marginRight: 28, whiteSpace: 'nowrap',
          paddingRight: 28,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          lineHeight: 1,
        }}
          className="trust-logos-label"
        >
          Zertifiziert &amp; Sicher
        </div>

        {/* Badges Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
          className="trust-logos-badges"
        >
          {BADGES.map((badge, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                border: '1px solid rgba(212,255,62,0.12)',
                borderRadius: 10,
                background: 'rgba(212,255,62,0.04)',
              }}
            >
              {badge.icon}
              <span style={{
                fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                fontSize: 12.5, fontWeight: 600,
                color: 'rgba(212,255,62,0.7)',
                whiteSpace: 'nowrap',
              }}>
                {badge.label}
              </span>
            </motion.div>
          ))}

          {/* Divider + Partner-Slots entfernt — keine Placeholder-Logos */}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .trust-logos-section { padding: 24px 16px !important; }
          .trust-logos-label   { width: 100%; text-align: center; border-right: none !important; padding-right: 0 !important; margin-right: 0 !important; margin-bottom: 16px; }
          .trust-logos-badges  { justify-content: center; }
          .trust-logos-divider { display: none !important; }
        }
      `}</style>
    </section>
  )
}

export default TrustLogos
