// Restored after APFS sparse-file corruption
'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Section, SectionLabel, SectionHeading, VoltText } from '@/components/ui'

// ─── Tarifheld Referenzpreise (ct/kWh) ───────────────
const REF = {
  privat:  { strom: 28, gas: 9  },
  gewerbe: { strom: 22, gas: 7  },
}

// ─── Slider-Konfigurationen je Typ & Energieart ───────
// Durchschnittstarif Strom Privat: 30,0 ct/kWh (Stand April 2026)
const SLIDER_CFG = {
  privat: {
    strom: { consMin: 500,   consMax: 10000,   consDefault: 3500,   consStep: 100,  priceMin: 20, priceMax: 60, priceDefault: 30.0, priceStep: 0.5 },
    gas:   { consMin: 5000,  consMax: 50000,   consDefault: 15000,  consStep: 500,  priceMin: 5,  priceMax: 25, priceDefault: 12, priceStep: 0.5 },
  },
  gewerbe: {
    strom: { consMin: 10000, consMax: 500000,  consDefault: 80000,  consStep: 1000, priceMin: 15, priceMax: 45, priceDefault: 28, priceStep: 0.5 },
    gas:   { consMin: 50000, consMax: 2000000, consDefault: 200000, consStep: 5000, priceMin: 4,  priceMax: 18, priceDefault: 9,  priceStep: 0.5 },
  },
}

const STANDORT_MULTI = { '1': 1, '2-5': 1.08, '6-10': 1.12, '10+': 1.18 }

function fmtEuro(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)
}
function fmtKwh(val) {
  return new Intl.NumberFormat('de-DE').format(val) + ' kWh'
}
function sliderBg(val, min, max) {
  const pct = ((val - min) / (max - min)) * 100
  return `linear-gradient(to right, #D4FF3E ${pct}%, #1A1F28 ${pct}%)`
}

// ─── Wiederverwendbarer Slider ────────────────────────
function SliderField({ label, value, min, max, step, onChange, displayValue, minLabel, maxLabel }) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[13px] font-semibold text-[#6B7280]">{label}</span>
        <span className="text-[15px] font-extrabold text-[#D4FF3E]">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="calc-slider"
        style={{ background: sliderBg(value, min, max) }}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
      />
      <div className="flex justify-between text-[11px] text-[#6B7280] mt-1.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

// ─── Toggle-Button-Gruppe ─────────────────────────────
function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-2 mb-7" role="radiogroup">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          role="radio"
          aria-checked={value === opt.value}
          className="flex-1 py-3 px-4 rounded-xl border text-sm font-semibold cursor-pointer transition-all duration-200"
          style={value === opt.value
            ? { background: '#D4FF3E', borderColor: '#D4FF3E', color: '#090B0F', fontWeight: 800 }
            : { background: 'transparent', borderColor: '#1A1F28', color: '#6B7280' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SavingsCalculator() {
  // ─── State ──────────────────────────────────────────
  const [kundentyp, setKundentyp] = useState('privat')   // 'privat' | 'gewerbe'
  const energie = 'strom'                                // fest: nur Strom
  const [calcDsgvo, setCalcDsgvo] = useState(false)
  const [calcDsgvoError, setCalcDsgvoError] = useState(false)

  // Privat-Felder
  const [privatName,  setPrivatName]  = useState('')
  const [privatCons,  setPrivatCons]  = useState(3500)
  const [privatPrice, setPrivatPrice] = useState(30)

  // Gewerbe-Felder
  const [gewerbeName,     setGewerbeName]     = useState('')
  const [gewerbeBranche,  setGewerbeBranche]  = useState('buero')
  const [gewerbeCons,     setGewerbeCons]     = useState(80000)
  const [gewerbePrice,    setGewerbePrice]    = useState(28)
  const [gewerbeStandort, setGewerbeStandort] = useState('1')
  const [gewerbeLaufzeit, setGewerbeLaufzeit] = useState('unknown')

  // Slider-Config für aktiven Typ+Energie
  const cfg = SLIDER_CFG[kundentyp][energie]

  // Energie-/Typ-Wechsel → Slider-Defaults zurücksetzen
  function handleKundentyp(typ) {
    setKundentyp(typ)
    const c = SLIDER_CFG[typ][energie]
    if (typ === 'privat') { setPrivatCons(c.consDefault); setPrivatPrice(c.priceDefault) }
    else                  { setGewerbeCons(c.consDefault); setGewerbePrice(c.priceDefault) }
  }

  // ─── Berechnung ─────────────────────────────────────
  const result = useMemo(() => {
    const ref = REF[kundentyp][energie]
    let currentYear, targetYear, aktuellerPreis

    if (kundentyp === 'privat') {
      aktuellerPreis = privatPrice
      currentYear = (privatCons * aktuellerPreis / 100) + 200
      targetYear  = (privatCons * ref / 100) + 200
    } else {
      aktuellerPreis = gewerbePrice
      const multi = STANDORT_MULTI[gewerbeStandort] || 1
      currentYear = (gewerbeCons * aktuellerPreis / 100) + 600
      targetYear  = (gewerbeCons * ref / 100 * multi) + 600
    }

    const ersparnis = Math.max(0, Math.round(currentYear - targetYear))
    const percent   = currentYear > 0 ? Math.round((ersparnis / currentYear) * 100) : 0
    const targetPct = currentYear > 0 ? Math.max(8, Math.round((targetYear / currentYear) * 100)) : 75
    const refLabel  = kundentyp === 'privat'
      ? (energie === 'strom' ? '28 ct/kWh' : '9 ct/kWh')
      : (energie === 'strom' ? '22 ct/kWh' : '7 ct/kWh')

    return {
      ersparnis,
      percent,
      currentYear: Math.round(currentYear),
      targetYear:  Math.round(targetYear),
      targetPct,
      aktuellerPreis,
      refLabel,
    }
  }, [kundentyp, energie, privatCons, privatPrice, gewerbeCons, gewerbePrice, gewerbeStandort])

  return (
    <Section id="rechner" className="bg-bg-base">

      {/* Globales Slider-Styling (scoped per className) */}
      <style>{`
        .calc-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 3px;
          outline: none; cursor: pointer;
        }
        .calc-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: #D4FF3E; cursor: pointer;
          box-shadow: 0 0 10px rgba(212,255,62,0.4);
          transition: box-shadow 0.2s;
        }
        .calc-slider::-webkit-slider-thumb:hover { box-shadow: 0 0 18px rgba(212,255,62,0.6); }
        .calc-slider::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: #D4FF3E; border: none; cursor: pointer;
        }
        .calc-select {
          width: 100%; padding: 12px 36px 12px 16px;
          background: #141920; border: 1px solid #1A1F28; border-radius: 12px;
          color: #D9DEE4; font-size: 14px; outline: none; cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='7' viewBox='0 0 12 7' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
          transition: border-color 0.2s;
        }
        .calc-select:focus { border-color: rgba(212,255,62,0.4); }
        .calc-text-input {
          width: 100%; padding: 12px 16px;
          background: #141920; border: 1px solid #1A1F28; border-radius: 12px;
          color: #D9DEE4; font-size: 14px; outline: none;
          transition: border-color 0.2s;
        }
        .calc-text-input:focus { border-color: rgba(212,255,62,0.4); }
        .calc-text-input::placeholder { color: #6B7280; }
        .calc-section-header {
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(212,255,62,0.5);
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px; margin-top: 8px;
        }
        .calc-section-header::after {
          content: ''; flex: 1; height: 1px; background: #1A1F28;
        }
        @media (max-width: 1023px) {
          .calc-result-card { position: static !important; }
        }
        @media (max-width: 640px) {
          .calc-result-card { padding: 20px !important; }
          .calc-input-card { padding: 20px !important; }
          .calc-section-header { font-size: 11px !important; margin-bottom: 12px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-12 flex flex-col items-center gap-4"
      >
        <SectionLabel>Dein Einsparpotenzial</SectionLabel>
        <SectionHeading centered>
          Wie viel kannst du <VoltText>sparen?</VoltText>
        </SectionHeading>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto items-start"
      >

        {/* ══ LINKE KARTE: Eingaben ══ */}
        <div className="calc-input-card" style={{ background: '#0F1218', border: '1px solid #1A1F28', borderRadius: 20, padding: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 28 }}>
            Deine Angaben
          </p>

          {/* Schritt 1: Kundentyp */}
          <div className="calc-section-header">Kundentyp</div>
          <ToggleGroup
            options={[{ value: 'privat', label: '👤 Privat' }, { value: 'gewerbe', label: '🏢 Gewerbe' }]}
            value={kundentyp}
            onChange={handleKundentyp}
          />

          {/* ── Privat-Felder ── */}
          <AnimatePresence mode="wait">
            {kundentyp === 'privat' && (
              <motion.div
                key="privat"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="calc-section-header">Angaben</div>

                <div className="mb-6">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Dein Name</p>
                  <input type="text" className="calc-text-input" placeholder="Dein Name"
                    value={privatName} onChange={e => setPrivatName(e.target.value)} />
                </div>

                <SliderField
                  label="Jahresverbrauch"
                  value={privatCons} min={cfg.consMin} max={cfg.consMax} step={cfg.consStep}
                  onChange={setPrivatCons}
                  displayValue={fmtKwh(privatCons)}
                  minLabel={fmtKwh(cfg.consMin)} maxLabel={fmtKwh(cfg.consMax)}
                />

                <SliderField
                  label="Aktueller Preis"
                  value={privatPrice} min={cfg.priceMin} max={cfg.priceMax} step={cfg.priceStep}
                  onChange={setPrivatPrice}
                  displayValue={privatPrice.toFixed(1) + ' ct/kWh'}
                  minLabel={cfg.priceMin + ' ct'} maxLabel={cfg.priceMax + ' ct'}
                />

                <div style={{ background: 'rgba(212,255,62,0.04)', borderLeft: '3px solid #D4FF3E', borderRadius: '0 10px 10px 0', padding: '12px 16px', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  <strong style={{ color: 'rgba(212,255,62,0.7)' }}>+ 200 € pauschale Grundkosten/Jahr</strong> wurden eingerechnet (marktüblicher Richtwert für Grundpreise).
                </div>
              </motion.div>
            )}

            {/* ── Gewerbe-Felder ── */}
            {kundentyp === 'gewerbe' && (
              <motion.div
                key="gewerbe"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="calc-section-header">Angaben</div>

                <div className="mb-6">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Firmenname</p>
                  <input type="text" className="calc-text-input" placeholder="Musterfirma GmbH"
                    value={gewerbeName} onChange={e => setGewerbeName(e.target.value)} />
                </div>

                <div className="mb-6">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Branche</p>
                  <select className="calc-select" value={gewerbeBranche} onChange={e => setGewerbeBranche(e.target.value)}>
                    <option value="produktion">Produktion</option>
                    <option value="handel">Handel</option>
                    <option value="gastronomie">Gastronomie</option>
                    <option value="buero">Büro</option>
                    <option value="handwerk">Handwerk</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>

                <SliderField
                  label="Jahresverbrauch"
                  value={gewerbeCons} min={cfg.consMin} max={cfg.consMax} step={cfg.consStep}
                  onChange={setGewerbeCons}
                  displayValue={fmtKwh(gewerbeCons)}
                  minLabel={fmtKwh(cfg.consMin)} maxLabel={fmtKwh(cfg.consMax)}
                />

                <SliderField
                  label="Aktueller Arbeitspreis"
                  value={gewerbePrice} min={cfg.priceMin} max={cfg.priceMax} step={cfg.priceStep}
                  onChange={setGewerbePrice}
                  displayValue={gewerbePrice.toFixed(1) + ' ct/kWh'}
                  minLabel={cfg.priceMin + ' ct'} maxLabel={cfg.priceMax + ' ct'}
                />

                <div className="mb-6">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Anzahl Standorte</p>
                  <select className="calc-select" value={gewerbeStandort} onChange={e => setGewerbeStandort(e.target.value)}>
                    <option value="1">1 Standort</option>
                    <option value="2-5">2–5 Standorte</option>
                    <option value="6-10">6–10 Standorte</option>
                    <option value="10+">10+ Standorte</option>
                  </select>
                </div>

                <div className="mb-6">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Aktuelle Vertragslaufzeit</p>
                  <select className="calc-select" value={gewerbeLaufzeit} onChange={e => setGewerbeLaufzeit(e.target.value)}>
                    <option value="monatlich">Monatlich kündbar</option>
                    <option value="1jahr">1 Jahr</option>
                    <option value="2jahre">2 Jahre</option>
                    <option value="unknown">Keine Ahnung</option>
                  </select>
                </div>

                <div style={{ background: 'rgba(212,255,62,0.04)', borderLeft: '3px solid #D4FF3E', borderRadius: '0 10px 10px 0', padding: '12px 16px', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  <strong style={{ color: 'rgba(212,255,62,0.7)' }}>+ 600 € pauschale Grundkosten/Jahr</strong> eingerechnet (Richtwert Gewerbe inkl. Messkosten).
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══ RECHTE KARTE: Live-Ergebnis ══ */}
        <div className="calc-result-card" style={{ background: '#0F1218', border: '1px solid #1A1F28', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 24 }}>

          {/* Ersparnis-Zahl */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 12 }}>
              Du sparst pro Jahr
            </p>
            <motion.div
              key={result.ersparnis}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 'clamp(52px, 6vw, 72px)', fontWeight: 900, color: '#D4FF3E', letterSpacing: '-0.04em', lineHeight: 1, textShadow: '0 0 40px rgba(212,255,62,0.3)' }}
              aria-live="polite"
            >
              {fmtEuro(result.ersparnis)}
            </motion.div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(212,255,62,0.5)', marginTop: 8, minHeight: 24 }}>
              {result.percent > 0 ? `~${result.percent}% Ersparnis` : ''}
            </div>
          </div>

          <div style={{ height: 1, background: '#1A1F28' }} />

          {/* Balken-Visualisierung */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: `Aktuell (bei ${result.aktuellerPreis.toFixed(1)} ct)`, value: fmtEuro(result.currentYear) + '/Jahr', pct: 100, volt: false },
              { label: 'Mit Tarifheld', value: fmtEuro(result.targetYear) + '/Jahr', pct: result.targetPct, volt: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6B7280' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.volt ? '#D4FF3E' : '#D9DEE4' }}>{row.value}</span>
                </div>
                <div style={{ height: 8, background: '#1A1F28', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: row.pct + '%' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', borderRadius: 4, background: row.volt ? '#D4FF3E' : 'rgba(255,255,255,0.18)' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Vergleichstabelle */}
          <div style={{ background: '#141920', border: '1px solid #1A1F28', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Aktuell (bei {result.aktuellerPreis.toFixed(1)} ct)</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#D9DEE4' }}>{fmtEuro(result.currentYear)}/Jahr</span>
            </div>
            <div style={{ borderTop: '1px solid #1A1F28', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Mit Tarifheld</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#D4FF3E' }}>{fmtEuro(result.targetYear)}/Jahr</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{ fontSize: 11.5, color: '#6B7280', textAlign: 'center', lineHeight: 1.6 }}>
            Basierend auf unserem Durchschnittstarif von{' '}
            <strong style={{ color: 'rgba(212,255,62,0.6)' }}>{result.refLabel}</strong>.<br />
            Echtes Angebot kann abweichen.
          </p>

          {/* DSGVO Checkbox */}
          <label
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 0 }}
          >
            <input
              type="checkbox"
              id="calc-dsgvo"
              checked={calcDsgvo}
              onChange={e => { setCalcDsgvo(e.target.checked); if (e.target.checked) setCalcDsgvoError(false) }}
              required
              style={{ marginTop: 2, flexShrink: 0, width: 15, height: 15, accentColor: '#D4FF3E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              Ich stimme der Verarbeitung meiner Daten gemäß der{' '}
              <a href="/datenschutz" style={{ color: 'rgba(212,255,62,0.7)', textDecoration: 'underline' }}>Datenschutzerklärung</a> zu. Die Einwilligung kann jederzeit widerrufen werden.*
            </span>
          </label>
          {calcDsgvoError && (
            <p role="alert" style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Bitte stimme der Datenschutzerklärung zu.</p>
          )}

          {/* CTA */}
          <button
            onClick={() => {
              if (!calcDsgvo) { setCalcDsgvoError(true); return }
              setCalcDsgvoError(false)
              document.getElementById('funnel')?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{
              display: 'block', width: '100%', padding: '18px 24px',
              background: '#D4FF3E', color: '#090B0F', fontSize: 18, fontWeight: 900,
              textAlign: 'center', border: 'none', borderRadius: 12, cursor: 'pointer',
              boxShadow: '0 0 30px rgba(212,255,62,0.35)',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#B8E032'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#D4FF3E'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Mein echtes Angebot holen →
          </button>
        </div>
      </motion.div>
    </Section>
  )
}

export default SavingsCalculator
