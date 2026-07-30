'use client'

import { Instagram, Mail, ExternalLink } from 'lucide-react'
import { GlowLine } from '@/components/ui/Background'
import { FOOTER_LINKS } from '@/lib/constants'
import { BusinessBrandLockup } from '@/components/business/BusinessBrandLockup'

/**
 * Route-local footer for /unternehmen-neu.
 * Same visual structure as shared Footer; only preview navigation targets differ.
 */
const PREVIEW_MAIN_LINKS = [
  { label: 'Privatkunden', href: '/' },
  { label: 'Unternehmen', href: '/unternehmen-neu/' },
  { label: 'Karriere', href: '/karriere' },
  { label: 'FAQ', href: '#faq-business' },
]

export function BusinessFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative w-full bg-bg-base border-t border-white/6" role="contentinfo">
      <GlowLine color="white" />

      <div className="dth-biz-container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 mb-12">
          <div className="flex flex-col gap-6">
            <BusinessBrandLockup href="/" size="footer" />

            <p className="font-body text-text-tertiary text-base sm:text-lg leading-relaxed max-w-sm">
              Klarheit statt Chaos — mit deinem Tarifheld. Kostenlose
              Energieoptimierung für Privat- und Geschäftskunden.
            </p>

            <div className="flex gap-3">
              <a
                href="https://instagram.com/dein.tarifheld"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-xl bg-bg-elevated border border-white/8 flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-white/20 transition-all duration-200"
                aria-label="Dein Tarifheld auf Instagram"
              >
                <Instagram className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <h3 className="font-display font-bold text-text-primary text-sm sm:text-base tracking-wider uppercase">
              Navigation
            </h3>
            <nav aria-label="Footer Navigation">
              <ul className="flex flex-col gap-3.5" role="list">
                {PREVIEW_MAIN_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="font-body text-text-tertiary text-base sm:text-lg hover:text-text-secondary transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col gap-5">
            <h3 className="font-display font-bold text-text-primary text-sm sm:text-base tracking-wider uppercase">
              Kontakt &amp; Recht
            </h3>

            <div className="flex flex-col gap-3">
              <a
                href="mailto:kontakt@deintarifheld.de"
                className="flex items-center gap-2.5 font-body text-text-tertiary text-base sm:text-lg hover:text-text-secondary transition-colors duration-200"
              >
                <Mail className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                kontakt@deintarifheld.de
              </a>
            </div>

            <nav aria-label="Rechtliche Links" className="mt-2">
              <ul className="flex flex-col gap-2.5" role="list">
                {FOOTER_LINKS.legal.map((link) => (
                  <li key={link.label}>
                    {link.label === 'Cookie-Einstellungen' ? (
                      <button
                        type="button"
                        onClick={() =>
                          typeof window.__openCookieBanner === 'function' &&
                          window.__openCookieBanner()
                        }
                        className="font-body text-text-tertiary text-sm hover:text-text-secondary transition-colors duration-200 underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="font-body text-text-tertiary text-sm hover:text-text-secondary transition-colors duration-200 underline-offset-2 hover:underline"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="pt-8 border-t border-white/6 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
          <div className="flex-1">
            <p className="font-body text-text-tertiary text-xs leading-relaxed text-center md:text-left max-w-3xl">
              © {year} Dein Tarifheld — Angebot eines selbständigen
              Vertriebspartners der{' '}
              <span className="text-text-secondary font-semibold">
                TELESON Vertriebs GmbH
              </span>
              , Paul-Gerhardt-Allee 48, 81245 München. Alle Preisangaben sind
              Schätzwerte. Tatsächliche Ersparnisse können abweichen.
            </p>
          </div>

          <a
            href="https://www.teleson.de/index.php/produktangebot/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-volt text-bg-base font-display font-bold text-sm hover:bg-volt/90 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
          >
            Teleson Produktangebot
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  )
}

export default BusinessFooter
