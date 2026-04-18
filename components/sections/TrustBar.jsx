// Restored after APFS sparse-file corruption
'use client'

import { motion } from 'framer-motion'

const TRUST_ITEMS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5l1.5 3 3.3.5-2.4 2.3.6 3.2L8 9l-3 1.5.6-3.2L3.2 5l3.3-.5L8 1.5Z"
          stroke="#D4FF3E" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(212,255,62,0.12)" />
      </svg>
    ),
    label: 'Ø 480 € Ersparnis/Jahr',
    sub: 'Basierend auf Kundenbeispielen*',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5l1.5 3 3.3.5-2.4 2.3.6 3.2L8 9l-3 1.5.6-3.2L3.2 5l3.3-.5L8 1.5Z"
          stroke="#D4FF3E" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(212,255,62,0.12)" />
      </svg>
    ),
    label: '100% Kostenlos',
    sub: 'Keine versteckten Kosten',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="#D4FF3E" strokeWidth="1.3" />
        <path d="M8 5v3l2 1.5" stroke="#D4FF3E" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    label: '24h Rückmeldung',
    sub: 'Persönliche Beratung',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1L2 4v4c0 3.31 2.69 6 6 6s6-2.69 6-6V4L8 1Z" stroke="#D4FF3E" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="6" y="7" width="4" height="4" rx="1" stroke="#D4FF3E" strokeWidth="1.2" />
        <path d="M9.5 7V5.5a1.5 1.5 0 0 0-3 0V7" stroke="#D4FF3E" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    label: 'DSGVO-konform',
    sub: 'SSL-verschlüsselt',
  },
]

export function TrustBar() {
  return (
    <div
      aria-label="Vertrauensmerkmale"
      style={{
        width: '100%',
        background: 'linear-gradient(180deg, #090B0F 0%, #0F1218 15%, #0F1218 85%, #090B0F 100%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        padding: '28px 24px',
      }}
      className="trust-bar-outer"
    >
      <ul
        role="list"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0,
          margin: '0 auto',
          padding: 0,
          listStyle: 'none',
          width: 'max-content',
          minWidth: '100%',
        }}
        className="trust-bar-list"
      >
        {TRUST_ITEMS.map((item, i) => (
          <motion.li
            key={i}
            role="listitem"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 32px',
              borderRight: i < TRUST_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
            className="trust-bar-item"
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(212,255,62,0.07)',
              border: '1px solid rgba(212,255,62,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                fontWeight: 700, fontSize: 14,
                color: '#F2F4F8', lineHeight: 1.2,
              }}>
                {item.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                fontSize: 11.5, color: '#5A6272',
                lineHeight: 1.3, marginTop: 2,
              }}>
                {item.sub}
              </div>
            </div>
          </motion.li>
        ))}
      </ul>

      <style>{`
        .trust-bar-outer::-webkit-scrollbar { display: none; }
        .trust-bar-item { flex-shrink: 0; }
        @media (max-width: 767px) {
          .trust-bar-outer {
            padding: 18px 0 18px !important;
            mask-image: linear-gradient(to right, transparent 0%, black 5%, black 85%, transparent 100%);
            -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 85%, transparent 100%);
          }
          .trust-bar-item { padding: 10px 18px !important; }
          .trust-bar-list {
            justify-content: flex-start !important;
            padding-left: 16px !important;
            padding-right: 40px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default TrustBar
