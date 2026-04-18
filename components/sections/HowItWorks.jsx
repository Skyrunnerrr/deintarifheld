// Restored after APFS sparse-file corruption
'use client'

import { motion } from 'framer-motion'

// ─── Keyframes ────────────────────────────────────────────────────
const KF = `
  @keyframes hiw-orbfloat {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-20px); }
  }
  @keyframes hiw-pulsedot {
    0%,100% { box-shadow: 0 0 0 0 rgba(212,255,62,.5); }
    50%      { box-shadow: 0 0 0 4px rgba(212,255,62,0); }
  }

  /* ── Mobile: clean single-column layout ── */
  @media (max-width: 768px) {
    .hiw-section-outer {
      padding: 48px 20px 48px !important;
      overflow: visible !important;
    }
    .hiw-section-header {
      margin-bottom: 40px !important;
    }
    .hiw-section-header h2 {
      font-size: clamp(26px, 7vw, 36px) !important;
    }
    .hiw-section-header p {
      font-size: 15px !important;
    }
    .hiw-timeline-wrap {
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .hiw-step-row {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 0 !important;
      margin-bottom: 20px !important;
    }
    /* Hide grid column 2 (spine) and column 3 (empty) */
    .hiw-step-spine { display: none !important; }
    .hiw-step-empty { display: none !important; }
    /* card fills full width */
    .hiw-step-card {
      width: 100% !important;
      grid-column: 1 !important;
    }
    .hiw-step-card > div {
      padding: 24px 20px !important;
    }
    .hiw-center-line {
      display: none !important;
    }
    .hiw-cta-trust {
      flex-direction: column !important;
      gap: 8px !important;
    }
    .hiw-cta-section {
      margin-top: 40px !important;
    }
    .hiw-cta-section button {
      width: 100% !important;
      justify-content: center !important;
    }
    /* ── Readability: bump up small text on mobile ── */
    .hiw-step-label { font-size: 13px !important; }
    .hiw-step-time  { font-size: 13px !important; }
    .hiw-step-bullet-text { font-size: 14px !important; }
    .hiw-step-hl-sub { font-size: 13px !important; }
  }

  /* ── Tablet: tighten side padding ── */
  @media (max-width: 1024px) and (min-width: 769px) {
    .hiw-section-outer {
      padding: 80px 24px 80px !important;
    }
    .hiw-center-line {
      display: none !important;
    }
  }
`

// ─── Step data ───────────────────────────────────────────────────
const STEPS = [
  {
    num: '1',
    numClass: 'n1',
    cardAccent: { border: '1px solid rgba(212,255,62,0.1)', topLine: 'linear-gradient(90deg, transparent 5%, rgba(212,255,62,0.55) 50%, transparent 95%)', hoverBorder: 'rgba(212,255,62,0.22)' },
    time: '~60 Sekunden',
    timeColor: null,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="#D4FF3E" strokeWidth="1.6" strokeLinecap="round"/>
        <rect x="8" y="2" width="8" height="4" rx="1.5" stroke="#D4FF3E" strokeWidth="1.6"/>
        <path d="M9 12h6M9 16h4" stroke="#D4FF3E" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    iconBg: 'rgba(212,255,62,0.09)',
    title: 'Deine Anfrage',
    desc: 'Du gibst uns deinen ungefähren Jahresverbrauch und deine Kontaktdaten. Keine Rechnung nötig, keine Kündigung, keine Verpflichtung.',
    bullets: [
      { text: 'Name, E-Mail und Telefonnummer', color: '#D4FF3E' },
      { text: 'Jahresverbrauch (kWh) und Postleitzahl', color: '#D4FF3E' },
      { text: 'Strom, Gas oder beides', color: '#D4FF3E' },
    ],
    hl: {
      bg: 'rgba(212,255,62,0.05)', border: 'rgba(212,255,62,0.12)',
      color: '#D4FF3E',
      title: 'Keine Rechnung nötig',
      sub: 'Dein ungefährer Verbrauch reicht uns vollständig aus',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12.5 2L5 10H9.5l-1 4L14 6H9.5z" fill="#D4FF3E" opacity=".85"/>
        </svg>
      ),
    },
  },
  {
    num: '2',
    numClass: 'n2',
    cardAccent: { border: '1px solid rgba(212,255,62,0.08)', topLine: 'linear-gradient(90deg, transparent 5%, rgba(184,224,50,0.5) 50%, transparent 95%)', hoverBorder: 'rgba(184,224,50,0.2)' },
    time: 'schnellstmöglich',
    timeColor: null,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#B8E032" strokeWidth="1.6"/>
        <path d="M20 20l-3.5-3.5" stroke="#B8E032" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    iconBg: 'rgba(184,224,50,0.09)',
    title: 'Wir suchen das beste Angebot',
    desc: 'Unser Team recherchiert aktiv die besten verfügbaren Tarife aus unserem geprüften Anbieternetzwerk — passend für deine Region und deinen Verbrauch.',
    bullets: [
      { text: 'Manuelle Recherche über das Teleson-Netzwerk', color: '#B8E032' },
      { text: 'Regionale und bundesweite Anbieter im Blick', color: '#B8E032' },
      { text: 'Nur geprüfte und seriöse Anbieter', color: '#B8E032' },
    ],
    hl: {
      bg: 'rgba(184,224,50,0.05)', border: 'rgba(184,224,50,0.12)',
      color: '#B8E032',
      title: 'Persönliche Recherche',
      sub: 'Echte Menschen suchen für dich — kein Algorithmus',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="#B8E032" strokeWidth="1.3"/>
          <path d="M8 5v3M8 10.5v.5" stroke="#B8E032" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
  },
  {
    num: '3',
    numClass: 'n3',
    cardAccent: { border: '1px solid rgba(212,255,62,0.07)', topLine: 'linear-gradient(90deg, transparent 5%, rgba(168,212,0,0.45) 50%, transparent 95%)', hoverBorder: 'rgba(168,212,0,0.18)' },
    time: 'du entscheidest',
    timeColor: null,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#a8d400" strokeWidth="1.6"/>
        <path d="M2 10h20M6 15h4M14 15h2" stroke="#a8d400" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    iconBg: 'rgba(168,212,0,0.09)',
    title: 'Dein persönliches Angebot',
    desc: 'Du erhältst dein individuelles Angebot mit dem besten verfügbaren Tarif — transparent, verständlich, ohne Kleingedrucktes. Du entscheidest in Ruhe.',
    bullets: [
      { text: 'Angebot per E-Mail und persönlichem Gespräch', color: '#a8d400' },
      { text: 'Klarer Preis — kWh-Preis und monatliche Grundgebühr', color: '#a8d400' },
      { text: 'Kein Druck — nur bei Zustimmung geht es weiter', color: '#a8d400' },
    ],
    hl: {
      bg: 'rgba(168,212,0,0.05)', border: 'rgba(168,212,0,0.12)',
      color: '#a8d400',
      title: '100% unverbindlich',
      sub: 'Deine Zustimmung ist der einzige nächste Schritt',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5l1.4 3.4 3.7.3-2.7 2.5 1 3.6L8 9.5l-3.4 1.8 1-3.6-2.7-2.5 3.7-.3z" stroke="#a8d400" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      ),
    },
  },
  {
    num: '4',
    numClass: 'n4',
    cardAccent: { border: '1px solid rgba(138,170,32,0.1)', topLine: 'linear-gradient(90deg, transparent 5%, rgba(138,170,32,0.5) 50%, transparent 95%)', hoverBorder: 'rgba(138,170,32,0.22)' },
    time: '24–48 Stunden',
    timeColor: { border: 'rgba(138,170,32,0.15)', color: 'rgba(138,170,32,0.6)' },
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="#8AAA20" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#8AAA20" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    iconBg: 'rgba(138,170,32,0.09)',
    title: 'Vertrag & Wechsel — wir erledigen alles',
    desc: 'Sobald du zustimmst, erstellen wir deinen neuen Vertrag und senden ihn dir innerhalb von 24–48 Stunden zu. Kündigung, Anmeldung und Übergabe — wir kümmern uns um alles.',
    bullets: [
      { text: 'Vertrag wird erstellt und dir zugesendet', color: '#8AAA20' },
      { text: 'Wir kündigen deinen alten Vertrag für dich', color: '#8AAA20' },
      { text: 'Nahtlose Versorgung — kein einziger Tag Unterbrechung', color: '#8AAA20' },
    ],
    hl: {
      bg: 'rgba(138,170,32,0.05)', border: 'rgba(138,170,32,0.12)',
      color: '#8AAA20',
      title: 'Vertrag in 24–48 Std.',
      sub: 'Du lehnst dich zurück — wir regeln den Rest',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="#8AAA20" strokeWidth="1.3"/>
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#8AAA20" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="10.5" r="1" fill="#8AAA20"/>
        </svg>
      ),
    },
  },
]

const NUM_STYLES = {
  n1: { background: 'rgba(212,255,62,0.09)',  color: '#D4FF3E',  border: '2px solid rgba(212,255,62,0.3)',  ring: '#D4FF3E' },
  n2: { background: 'rgba(184,224,50,0.09)',  color: '#B8E032',  border: '2px solid rgba(184,224,50,0.3)',  ring: '#B8E032' },
  n3: { background: 'rgba(168,212,0,0.09)',   color: '#a8d400',  border: '2px solid rgba(168,212,0,0.3)',   ring: '#a8d400' },
  n4: { background: 'rgba(138,170,32,0.09)',  color: '#8AAA20',  border: '2px solid rgba(138,170,32,0.3)',  ring: '#8AAA20' },
}

// ─── Sub-components ───────────────────────────────────────────────
function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M6 3.5V6l1.2 1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}

function BulletCheck({ color }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <path d="M2 5l2.2 2.2 3.8-3.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StepCard({ step, isOdd }) {
  const ns = NUM_STYLES[step.numClass]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 80px minmax(0,1fr)',
        alignItems: 'start',
        marginBottom: 32,
      }}
      className="hiw-step-row"
    >
      {/* Card slot */}
      <div className="hiw-step-card" style={{ gridColumn: isOdd ? 1 : 3, gridRow: 1 }}>
        <motion.div
          initial={{ opacity: 0, x: isOdd ? -28 : 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: '#0F1218',
            borderRadius: 22,
            padding: '32px 34px',
            position: 'relative',
            overflow: 'hidden',
            border: step.cardAccent.border,
            transition: 'transform 0.3s cubic-bezier(.16,1,.3,1), box-shadow 0.3s, border-color 0.3s',
          }}
          whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,.5)', borderColor: step.cardAccent.hoverBorder }}
        >
          {/* Top accent line */}
          <div style={{
            position: 'absolute', insetInline: 0, top: 0, height: 1,
            background: step.cardAccent.topLine,
            pointerEvents: 'none',
          }} aria-hidden="true" />

          {/* Step label + time */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span className="hiw-step-label" style={
              {
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontWeight: 700, fontSize: 11,
              letterSpacing: '.14em', textTransform: 'uppercase',
              color: '#5A6272',
              }
            }>
              Schritt 0{step.num}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,.04)',
              border: step.timeColor ? `1px solid ${step.timeColor.border}` : '1px solid rgba(255,255,255,.08)',
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontSize: 11, fontWeight: 700,
              color: step.timeColor ? step.timeColor.color : '#5A6272',
              whiteSpace: 'nowrap',
            }}
              className="hiw-step-time"
            >
              <ClockIcon />
              {step.time}
            </span>
          </div>

          {/* Icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: step.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
          }}>
            {step.icon}
          </div>

          {/* Title */}
          <div style={{
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontWeight: 900, fontSize: 19,
            color: '#F2F4F8', marginBottom: 10,
            lineHeight: 1.2, letterSpacing: '-.02em',
          }}>
            {step.title}
          </div>

          {/* Desc */}
          <div style={{
            fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
            fontSize: 14, color: '#8E97A8',
            lineHeight: 1.72, marginBottom: 18,
          }}>
            {step.desc}
          </div>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {step.bullets.map((b, i) => (
              <div key={i} className="hiw-step-bullet-text" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#8E97A8', lineHeight: 1.5 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${b.color}1A`,
                }}>
                  <BulletCheck color={b.color} />
                </div>
                {b.text}
              </div>
            ))}
          </div>

          {/* Highlight box */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '13px 15px', borderRadius: 13, marginTop: 4,
            background: step.hl.bg,
            border: `1px solid ${step.hl.border}`,
          }}>
            <span style={{ flexShrink: 0 }}>{step.hl.icon}</span>
            <div>
              <div style={{
                fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
                fontWeight: 700, fontSize: 13,
                color: step.hl.color, lineHeight: 1.3,
              }}>
                {step.hl.title}
              </div>
              <div className="hiw-step-hl-sub" style={{
                fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
                fontSize: 12, color: '#5A6272', marginTop: 2,
              }}>
                {step.hl.sub}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Spine */}
      <div className="hiw-step-spine" style={{
        gridColumn: 2, gridRow: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 32, zIndex: 3,
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.08 }}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontWeight: 900, fontSize: 20,
            position: 'relative', zIndex: 3, flexShrink: 0,
            background: ns.background,
            color: ns.color,
            border: 'none',
          }}
        >
          {step.num}
        </motion.div>
      </div>

      {/* Empty slot */}
      <div className="hiw-step-empty" style={{ gridColumn: isOdd ? 3 : 1, gridRow: 1, visibility: 'hidden' }} aria-hidden="true" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────
export function HowItWorks() {
  return (
    <>
      <style>{KF}</style>
      <section
        id="how-it-works"
        aria-label="So funktioniert Dein Tarifheld"
        style={{ position: 'relative', padding: '120px 48px 100px', background: '#090B0F' }}
        className="hiw-section-outer"
      >
        {/* Fließender Übergang oben */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(180deg, #0F1218 0%, transparent 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Background orbs */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{
            position: 'absolute', width: 600, height: 600, top: '-5%', left: '-12%',
            borderRadius: '50%', filter: 'blur(90px)',
            background: 'radial-gradient(circle, rgba(212,255,62,0.055) 0%, transparent 65%)',
            animation: 'hiw-orbfloat 16s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', width: 500, height: 500, bottom: '5%', right: '-10%',
            borderRadius: '50%', filter: 'blur(90px)',
            background: 'radial-gradient(circle, rgba(126,220,255,0.04) 0%, transparent 65%)',
            animation: 'hiw-orbfloat 20s ease-in-out infinite reverse',
          }} />
          {/* Grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
          }} />
        </div>

        {/* ── Section Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', marginBottom: 80, position: 'relative', zIndex: 2 }}
          className="hiw-section-header"
        >
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 999,
            background: 'rgba(212,255,62,0.06)', border: '1px solid rgba(212,255,62,0.2)',
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontWeight: 700, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#D4FF3E', marginBottom: 20,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%', background: '#D4FF3E',
              animation: 'hiw-pulsedot 2.5s ease-in-out infinite',
            }} />
            So einfach gehts
          </div>

          <h2 style={{
            fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
            fontWeight: 900, fontSize: 'clamp(32px, 4vw, 52px)',
            lineHeight: 1.05, letterSpacing: '-.03em',
            color: '#F2F4F8', marginBottom: 16,
          }}>
            In 4 Schritten zu<br />deinem{' '}
            <em style={{ fontStyle: 'normal', color: '#D4FF3E' }}>neuen Tarif</em>
          </h2>

          <p style={{
            fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
            fontSize: 17, color: '#8E97A8', lineHeight: 1.65,
            maxWidth: 460, margin: '0 auto',
          }}>
            Kein Papierkram, kein Risiko — wir finden das beste Angebot
            und begleiten dich bis zum fertigen Vertrag.
          </p>
        </motion.div>

        {/* ── Timeline ── */}
        <div className="hiw-timeline-wrap" style={{ position: 'relative', maxWidth: 1000, margin: '0 auto', zIndex: 2 }}>

          {/* Center connecting line */}
          <div aria-hidden="true" className="hiw-center-line" style={{
            position: 'absolute', top: 32, bottom: 32,
            left: '50%', transform: 'translateX(-50%)',
            width: 1,
            background: 'linear-gradient(180deg, rgba(212,255,62,0) 0%, rgba(212,255,62,0.15) 8%, rgba(212,255,62,0.15) 92%, rgba(212,255,62,0) 100%)',
            pointerEvents: 'none', zIndex: 1,
          }} />

          {/* Step cards */}
          <div>
            {STEPS.map((step, i) => (
              <StepCard key={step.num} step={step} isOdd={i % 2 === 0} />
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ textAlign: 'center', marginTop: 72, position: 'relative', zIndex: 2 }}
          className="hiw-cta-section"
        >
          <button
            onClick={() => document.getElementById('funnel')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: '#D4FF3E', color: '#090B0F',
              fontFamily: 'var(--font-cabinet, "Cabinet Grotesk", sans-serif)',
              fontWeight: 800, fontSize: 16,
              padding: '15px 36px', borderRadius: 15, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 0 28px rgba(212,255,62,.25)',
              transition: 'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#B8E032'; e.currentTarget.style.boxShadow = '0 0 44px rgba(212,255,62,.42)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#D4FF3E'; e.currentTarget.style.boxShadow = '0 0 28px rgba(212,255,62,.25)'; e.currentTarget.style.transform = '' }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(.97)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          >
            Jetzt Anfrage starten
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18, fontSize: 13, color: '#5A6272',
            fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
            flexWrap: 'wrap',
          }}
            className="hiw-cta-trust"
          >
            {['Kostenlos', 'Unverbindlich', 'In 60 Sekunden'].map(label => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="rgba(212,255,62,0.5)" strokeWidth="1.2"/>
                  <path d="M3.5 6l1.8 1.8 3-3" stroke="rgba(212,255,62,0.6)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {label}
              </span>
            ))}
          </div>
        </motion.div>


      </section>
    </>
  )
}

export default HowItWorks
