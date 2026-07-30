/**
 * DTH-06 — route-local visual tokens for /unternehmen-neu only.
 * Prepared for later Business subdomain (no host activation here).
 */

export const BUSINESS_VISUAL = {
  pageBg: '#F5F4F1',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F4',
  navy: '#090B15',
  navySoft: '#15182A',
  graphite: '#090B15',
  border: 'rgba(9, 11, 21, 0.10)',
  borderStrong: 'rgba(9, 11, 21, 0.16)',
  textPrimary: '#090B15',
  textSecondary: '#5B6578',
  textTertiary: '#7D8798',
  accent: '#F98540',
  accentHover: '#E06F2E',
  shadow: '0 10px 36px rgba(9, 11, 21, 0.07)',
  shadowSoft: '0 2px 12px rgba(9, 11, 21, 0.04)',
}

export const BUSINESS_VISUAL_CSS = `
.dth-biz {
  background-color: ${BUSINESS_VISUAL.pageBg} !important;
  color: ${BUSINESS_VISUAL.textPrimary} !important;
  overflow-x: clip;
}

.dth-biz .bg-bg-base { background-color: ${BUSINESS_VISUAL.pageBg} !important; }
.dth-biz .bg-bg-surface { background-color: ${BUSINESS_VISUAL.surface} !important; }
.dth-biz .bg-bg-elevated { background-color: ${BUSINESS_VISUAL.surface} !important; }
.dth-biz .bg-bg-overlay { background-color: ${BUSINESS_VISUAL.surfaceMuted} !important; }
.dth-biz .bg-bg-input { background-color: ${BUSINESS_VISUAL.surface} !important; }

.dth-biz .text-text-primary { color: ${BUSINESS_VISUAL.textPrimary} !important; }
.dth-biz .text-text-secondary { color: ${BUSINESS_VISUAL.textSecondary} !important; }
.dth-biz .text-text-tertiary { color: ${BUSINESS_VISUAL.textTertiary} !important; }

.dth-biz .text-volt,
.dth-biz .text-energy { color: ${BUSINESS_VISUAL.accent} !important; }
.dth-biz .bg-volt,
.dth-biz .bg-energy {
  background-color: ${BUSINESS_VISUAL.accent} !important;
  color: #FFFFFF !important;
  box-shadow: none !important;
}
.dth-biz .hover\\:bg-volt\\/90:hover,
.dth-biz .hover\\:bg-energy\\/90:hover { background-color: ${BUSINESS_VISUAL.accentHover} !important; }
.dth-biz .bg-energy\\/5,
.dth-biz .bg-energy\\/10 { background-color: rgba(249,133,64,0.10) !important; }
.dth-biz .border-energy\\/20 { border-color: rgba(249,133,64,0.28) !important; }
.dth-biz .hover\\:shadow-energy:hover,
.dth-biz .shadow-energy { box-shadow: ${BUSINESS_VISUAL.shadowSoft} !important; }

.dth-biz .border-white\\/6,
.dth-biz .border-white\\/8,
.dth-biz .border-white\\/10,
.dth-biz .border-white\\/12,
.dth-biz .border-white\\/20 {
  border-color: ${BUSINESS_VISUAL.border} !important;
}
.dth-biz .border-y.border-white\\/8,
.dth-biz .border-b.border-white\\/6,
.dth-biz .border-t.border-white\\/6 {
  border-color: ${BUSINESS_VISUAL.border} !important;
}

.dth-biz .bg-white\\/8 { background-color: ${BUSINESS_VISUAL.surfaceMuted} !important; }

.dth-biz section.relative.w-full.py-20 {
  padding-top: 3.75rem !important;
  padding-bottom: 3.75rem !important;
}
@media (min-width: 768px) {
  .dth-biz section.relative.w-full.py-20 {
    padding-top: 5.5rem !important;
    padding-bottom: 5.5rem !important;
  }
}
.dth-biz section.relative.w-full.py-20 > .relative.z-10.max-w-7xl {
  max-width: 1220px !important;
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
}
@media (min-width: 1024px) {
  .dth-biz section.relative.w-full.py-20 > .relative.z-10.max-w-7xl {
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
}

/* Route-local type + container scale */
.dth-biz .dth-biz-container {
  max-width: 1220px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  padding-left: 1.25rem;
  padding-right: 1.25rem;
}
@media (min-width: 640px) {
  .dth-biz .dth-biz-container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}
@media (min-width: 1024px) {
  .dth-biz .dth-biz-container {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
  }
}
.dth-biz .font-body {
  font-size: 1.015rem;
  line-height: 1.65;
}
@media (min-width: 1024px) {
  .dth-biz .font-body {
    font-size: 1.0625rem;
  }
}
.dth-biz h2.font-display,
.dth-biz .dth-section-heading {
  font-size: clamp(1.85rem, 2.8vw, 2.45rem) !important;
  line-height: 1.16 !important;
  letter-spacing: -0.02em;
}

.dth-biz .dth-biz-divider {
  height: 0;
  margin: 0;
  border: 0;
  background: transparent;
}

/* Fluid section rhythm — soft blends instead of hard boxes */
.dth-biz #wirtschaftlicher-hebel {
  background:
    linear-gradient(180deg, ${BUSINESS_VISUAL.pageBg} 0%, #FFFFFF 18%, #FFFFFF 82%, ${BUSINESS_VISUAL.pageBg} 100%) !important;
}
.dth-biz #zielgruppen {
  background:
    radial-gradient(ellipse 80% 50% at 10% 0%, rgba(255,107,43,0.05), transparent 55%),
    ${BUSINESS_VISUAL.pageBg} !important;
}
.dth-biz #leistungen {
  background: #FFFFFF !important;
}
.dth-biz #situationen {
  background:
    linear-gradient(180deg, #FFFFFF 0%, ${BUSINESS_VISUAL.pageBg} 100%) !important;
}
.dth-biz #ablauf {
  background: ${BUSINESS_VISUAL.pageBg} !important;
}
.dth-biz #rolle {
  background:
    linear-gradient(180deg, ${BUSINESS_VISUAL.pageBg} 0%, #FFFFFF 40%, #FFFFFF 100%) !important;
}
.dth-biz #formular {
  background:
    linear-gradient(180deg, #FFFFFF 0%, ${BUSINESS_VISUAL.pageBg} 100%) !important;
}
.dth-biz #faq-business {
  background: ${BUSINESS_VISUAL.pageBg} !important;
}

.dth-biz .dth-hero-grid {
  display: grid !important;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: center;
  width: 100%;
}
@media (min-width: 1024px) {
  .dth-biz .dth-hero-grid {
    grid-template-columns: minmax(0, 0.96fr) minmax(0, 1.04fr);
    gap: 3.25rem;
  }
}

.dth-biz .dth-btn-primary {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 54px;
  padding: 0.85rem 1.7rem;
  border-radius: 14px;
  background: ${BUSINESS_VISUAL.accent} !important;
  color: #FFFFFF !important;
  font-family: 'Cabinet Grotesk', var(--font-cabinet), sans-serif;
  font-weight: 700;
  text-decoration: none !important;
  box-shadow: 0 8px 22px rgba(249,133,64,0.22);
}
.dth-biz .dth-btn-primary:hover {
  background: ${BUSINESS_VISUAL.accentHover} !important;
}
.dth-biz .dth-btn-secondary {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 54px;
  padding: 0.85rem 1.7rem;
  border-radius: 14px;
  border: 1px solid ${BUSINESS_VISUAL.borderStrong};
  background: #FFFFFF !important;
  color: ${BUSINESS_VISUAL.textPrimary} !important;
  font-family: 'Cabinet Grotesk', var(--font-cabinet), sans-serif;
  font-weight: 700;
  text-decoration: none !important;
}
.dth-biz .dth-btn-secondary:hover {
  background: ${BUSINESS_VISUAL.surfaceMuted} !important;
}

/* Trust/info panel — used when photography assets are not yet available */
.dth-biz .dth-trust-panel {
  border: 1px solid ${BUSINESS_VISUAL.border};
  background: #FFFFFF;
  border-radius: 22px;
  padding: 1.5rem 1.65rem;
  box-shadow: ${BUSINESS_VISUAL.shadow};
}
.dth-biz .dth-trust-panel-lg {
  padding: 2rem 2.15rem;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
@media (min-width: 1024px) {
  .dth-biz .dth-trust-panel-lg {
    min-height: 520px;
    padding: 2.5rem 2.5rem;
  }
}

.dth-biz .dth-form-navy {
  background: ${BUSINESS_VISUAL.navy} !important;
  border-color: transparent !important;
  color: #F2F4F8;
  box-shadow: 0 18px 48px rgba(21,32,51,0.22) !important;
}
.dth-biz .dth-form-navy .text-text-primary { color: #F2F4F8 !important; }
.dth-biz .dth-form-navy .text-text-secondary { color: #C2CAD6 !important; }
.dth-biz .dth-form-navy .text-text-tertiary { color: #9AA3B2 !important; }
.dth-biz .dth-form-navy input,
.dth-biz .dth-form-navy select,
.dth-biz .dth-form-navy textarea {
  background: rgba(255,255,255,0.06) !important;
  border-color: rgba(255,255,255,0.16) !important;
  color: #F2F4F8 !important;
}
.dth-biz .dth-form-navy input::placeholder,
.dth-biz .dth-form-navy textarea::placeholder {
  color: #9AA3B2 !important;
}
.dth-biz .dth-form-navy button[aria-pressed="false"] {
  background: rgba(255,255,255,0.06) !important;
  border-color: rgba(255,255,255,0.18) !important;
  color: #C2CAD6 !important;
}
.dth-biz .dth-form-navy .border-\\[rgba\\(21\\,32\\,51\\,0\\.14\\)\\],
.dth-biz .dth-form-navy .border-\\[rgba\\(21\\2c 32\\2c 51\\2c 0\\.14\\)\\] {
  border-color: rgba(255,255,255,0.18) !important;
}
.dth-biz .dth-form-navy .bg-\\[\\#EEF0F4\\] {
  background: rgba(255,255,255,0.1) !important;
}
.dth-biz .dth-form-navy a { color: ${BUSINESS_VISUAL.accent} !important; }

/* Final CTA — photo-backed navy band */
.dth-biz #abschluss {
  background: ${BUSINESS_VISUAL.navy} !important;
  position: relative;
  overflow: hidden;
}
.dth-biz #abschluss .dth-final-cta-media {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.dth-biz #abschluss .dth-final-cta-media img {
  object-fit: cover;
  object-position: center 40%;
}
.dth-biz #abschluss .dth-final-cta-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(105deg, rgba(9,11,21,0.86) 0%, rgba(9,11,21,0.58) 46%, rgba(9,11,21,0.22) 100%);
}
.dth-biz #abschluss.relative.w-full.py-20 {
  padding-top: 5.5rem !important;
  padding-bottom: 5.5rem !important;
}
@media (min-width: 768px) {
  .dth-biz #abschluss.relative.w-full.py-20 {
    padding-top: 6.5rem !important;
    padding-bottom: 6.5rem !important;
  }
}
.dth-biz #abschluss .relative.z-10 {
  position: relative;
  z-index: 2 !important;
}
.dth-biz #abschluss .text-text-primary { color: #F2F4F8 !important; }
.dth-biz #abschluss .text-text-secondary { color: #B7C0CF !important; }
.dth-biz #abschluss .bg-energy\\/5 { background-color: transparent !important; }
.dth-biz #abschluss .border-energy\\/20 { border-color: rgba(255,255,255,0.12) !important; }
.dth-biz #abschluss .bg-bg-elevated { background-color: rgba(255,255,255,0.06) !important; }
.dth-biz #abschluss .border-white\\/10,
.dth-biz #abschluss .hover\\:border-white\\/20:hover {
  border-color: rgba(255,255,255,0.22) !important;
}
.dth-biz #abschluss .hover\\:bg-bg-overlay:hover {
  background-color: rgba(255,255,255,0.1) !important;
}
.dth-biz #abschluss a[href="#formular"] {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 56px;
  padding: 0.95rem 1.9rem;
  border-radius: 14px;
  background: ${BUSINESS_VISUAL.accent} !important;
  color: #FFFFFF !important;
  text-decoration: none !important;
  font-weight: 700;
  font-size: 1.05rem;
}
.dth-biz #abschluss a[href^="mailto:"] {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 56px;
  padding: 0.85rem 1.6rem;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.06) !important;
  color: #F2F4F8 !important;
  text-decoration: none !important;
  font-weight: 700;
  font-size: 1.05rem;
}
.dth-biz #abschluss h2 {
  font-size: clamp(1.85rem, 3.2vw, 2.65rem) !important;
  line-height: 1.15 !important;
  font-weight: 800 !important;
}

/* Footer — business close */
.dth-biz footer {
  background-color: #0F141C !important;
  border-top-color: rgba(255,255,255,0.08) !important;
}
.dth-biz footer .text-text-primary { color: #F2F4F8 !important; }
.dth-biz footer .text-text-secondary { color: #C2CAD6 !important; }
.dth-biz footer .text-text-tertiary { color: #8E97A8 !important; }
.dth-biz footer .bg-bg-elevated { background-color: rgba(255,255,255,0.06) !important; }
.dth-biz footer .border-white\\/6,
.dth-biz footer .border-white\\/8,
.dth-biz footer .border-white\\/20 {
  border-color: rgba(255,255,255,0.10) !important;
}
.dth-biz footer .text-volt { color: ${BUSINESS_VISUAL.accent} !important; }
.dth-biz footer .bg-volt {
  background-color: ${BUSINESS_VISUAL.accent} !important;
  color: #FFFFFF !important;
}
.dth-biz footer .text-bg-base { color: #FFFFFF !important; }
.dth-biz footer .py-12 { padding-top: 3.5rem !important; padding-bottom: 3.5rem !important; }
.dth-biz footer .md\\:py-16 { padding-top: 4.5rem !important; padding-bottom: 4.5rem !important; }
.dth-biz footer .mb-12 { margin-bottom: 2.75rem !important; }
.dth-biz footer .max-w-7xl { max-width: 1220px !important; }
.dth-biz footer .font-body { font-size: 1rem; }

.dth-biz #faq-business .bg-white\\/8 { background-color: ${BUSINESS_VISUAL.surfaceMuted} !important; }
.dth-biz #faq-business h2 {
  font-size: clamp(1.85rem, 2.8vw, 2.45rem) !important;
  line-height: 1.16 !important;
}
.dth-biz #faq-business .rounded-2xl {
  box-shadow: ${BUSINESS_VISUAL.shadowSoft};
}
.dth-biz #faq-business .dth-faq-list {
  max-width: 1040px !important;
}

.dth-biz #formular .dth-form-navy {
  min-width: 0;
}
@media (min-width: 1024px) {
  .dth-biz #formular .dth-form-navy {
    min-height: 640px;
    padding: 2.5rem 2.5rem !important;
  }
}
.dth-biz #formular input,
.dth-biz #formular select,
.dth-biz #formular textarea {
  min-height: 52px;
}
.dth-biz #formular textarea {
  min-height: 110px;
}

.dth-biz #ablauf .dth-process-nr {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.05rem;
}
.dth-biz #zielgruppen .dth-audience-media {
  aspect-ratio: 4 / 3;
}
.dth-biz header.dth-biz-header .dth-biz-header-inner {
  max-width: 1220px !important;
}

@media (prefers-reduced-motion: reduce) {
  .dth-biz * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`
