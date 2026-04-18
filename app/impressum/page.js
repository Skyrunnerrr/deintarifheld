// Restored after APFS sparse-file corruption
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { ObfuscatedEmail } from '@/components/ui/ObfuscatedEmail'

export const metadata = {
  title: 'Impressum – Dein Tarifheld | Pflichtangaben gem. § 5 DDG',
  description: 'Impressum und Pflichtangaben gemäß § 5 DDG (ehem. TMG) für Dein Tarifheld – Noah Bez, Vertriebspartner der TELESON Vertriebs GmbH.',
  alternates: { canonical: 'https://www.deintarifheld.de/impressum/' },
  robots: { index: false, follow: false },
}

function LegalSection({ title, children }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{
        fontSize: '1.125rem', fontWeight: 700, color: '#F2F4F8',
        marginBottom: '0.75rem', paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {title}
      </h2>
      <div style={{ color: '#8E97A8', fontSize: '0.9375rem', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  )
}

export default function ImpressumPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090B0F', paddingTop: '5rem' }}>
      <div className="legal-container" style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

        <style>{`
          @media (max-width: 767px) {
            .legal-container { padding: 2rem 1rem 3rem !important; }
            .legal-container h1 { font-size: 1.5rem !important; }
          }
        `}</style>

        {/* Back Link */}
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          color: '#8E97A8', fontSize: '0.875rem', fontWeight: 600,
          textDecoration: 'none', marginBottom: '2.5rem',
          opacity: 0.9, minHeight: 44, padding: '8px 0',
        }}>
          ← Zurück zur Startseite
        </Link>

        {/* Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#8E97A8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Zap style={{ width: 20, height: 20, color: '#090B0F' }} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F2F4F8' }}>
            Dein<span style={{ color: '#8E97A8' }}>Tarif</span>held
          </span>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#F2F4F8', margin: '0 0 0.5rem' }}>
          Impressum
        </h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '3rem' }}>
          Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
        </p>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: '3rem' }} />

        <LegalSection title="Angaben gemäß § 5 DDG (ehem. TMG)">
          <p style={{ margin: 0 }}>
            Dieses Onlineangebot wird betrieben durch:<br /><br />
            <strong style={{ color: '#D9DEE4' }}>Noah Bez</strong><br />
            Selbständiger Vertriebspartner der TELESON Vertriebs GmbH<br />
            Lochheimer Str. 37<br />
            69124 Heidelberg<br />
            Deutschland<br /><br />
            Online-Auftritt:{' '}
            <a href="https://www.deintarifheld.de" style={{ color: '#8E97A8', textDecoration: 'none' }}>
              www.deintarifheld.de
            </a>
          </p>
        </LegalSection>

        <LegalSection title="Kontakt">
          <p style={{ margin: 0 }}>
            E-Mail:{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
          </p>
        </LegalSection>

        <LegalSection title="Umsatzsteuer">
          <p style={{ margin: 0 }}>
            USt-IdNr.: DE350763393
          </p>
        </LegalSection>

        <LegalSection title="Berufsbezeichnung und berufsrechtliche Regelungen">
          <p style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: '#D9DEE4' }}>Berufsbezeichnung:</strong> Selbständiger Handelsvertreter gemäß § 84 HGB
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: '#D9DEE4' }}>Zuständige Aufsichtsbehörde:</strong> Gewerbeamt der Stadt Heidelberg
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: '#D9DEE4' }}>Auftraggeber:</strong> TELESON Vertriebs GmbH, Zielstattstraße 10, 81379 München
          </p>
          <p style={{ margin: 0 }}>
            Es bestehen keine berufsrechtlichen Regelungen im Sinne kammerrechtlicher Vorschriften.
            Die Gewerbeanmeldung erfolgte beim Gewerbeamt der Stadt Heidelberg.
          </p>
        </LegalSection>

        <LegalSection title="Handelsregistereintrag">
          <p style={{ margin: 0 }}>
            Nicht erforderlich (Einzelunternehmen ohne Eintragungspflicht gemäß § 1 HGB).
          </p>
        </LegalSection>

        <LegalSection title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p style={{ margin: 0 }}>
            Noah Bez<br />
            E-Mail:{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
          </p>
        </LegalSection>

        <LegalSection title="Streitbeilegung">
          <p style={{ marginBottom: '0.75rem' }}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#8E97A8', textDecoration: 'none' }}
            >
              https://ec.europa.eu/consumers/odr
            </a>
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
          <p style={{ margin: 0 }}>
            Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle im Sinne des Verbraucherstreitbeilegungsgesetzes
            (VSBG) teilzunehmen.
          </p>
        </LegalSection>

        <LegalSection title="Haftung für Inhalte (§ 7 DDG)">
          <p style={{ marginBottom: '0.75rem' }}>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
            diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10
            DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
            gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
            forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>
          <p style={{ margin: 0 }}>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen
            nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche
            Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
            Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
            Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>
        </LegalSection>

        <LegalSection title="Haftung für Links (§ 7 DDG)">
          <p style={{ marginBottom: '0.75rem' }}>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte
            wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch
            keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der
            jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
          <p style={{ margin: 0 }}>
            Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
            Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der
            Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der
            verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
            Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen
            werden wir derartige Links umgehend entfernen.
          </p>
        </LegalSection>

        <LegalSection title="Urheberrecht">
          <p style={{ marginBottom: '0.75rem' }}>
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
            unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
            Verbreitung und jede Art der Verwertung außerhalb der Grenzen des
            Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors
            bzw. Erstellers.
          </p>
          <p style={{ margin: 0 }}>
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht
            kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht
            vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet.
            Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden,
            bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
            Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </p>
        </LegalSection>

        <LegalSection title="Datenschutz">
          <p style={{ margin: 0 }}>
            Ausführliche Informationen zum Umgang mit personenbezogenen Daten finden Sie
            in unserer{' '}
            <Link href="/datenschutz" style={{ color: '#8E97A8', textDecoration: 'none' }}>
              Datenschutzerklärung
            </Link>.
          </p>
        </LegalSection>

        <p style={{ color: '#4A515C', fontSize: '0.8125rem', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          Stand: April 2026
        </p>
      </div>
    </div>
  )
}
