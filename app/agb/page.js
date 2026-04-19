// AGB – Allgemeine Geschäftsbedingungen
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { ObfuscatedEmail } from '@/components/ui/ObfuscatedEmail'

export const metadata = {
  title: 'Allgemeine Geschäftsbedingungen — Dein Tarifheld',
  description: 'Allgemeine Geschäftsbedingungen (AGB) von Dein Tarifheld – Noah Bez, selbständiger Vertriebspartner der TELESON Vertriebs GmbH.',
  alternates: { canonical: 'https://www.deintarifheld.de/agb/' },
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

function Highlight({ children }) {
  return <strong style={{ color: '#D9DEE4' }}>{children}</strong>
}

export default function AGBPage() {
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
          textDecoration: 'none', marginBottom: '2.5rem', opacity: 0.9,
          minHeight: 44, padding: '8px 0',
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
          Allgemeine Geschäftsbedingungen
        </h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '3rem' }}>
          Stand: April 2026
        </p>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: '3rem' }} />

        {/* § 1 */}
        <LegalSection title="§ 1 Geltungsbereich">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB”) gelten für alle
            Leistungen und Angebote, die über die Website{' '}
            <Highlight>www.deintarifheld.de</Highlight> (nachfolgend „Website”) von:
          </p>
          <p style={{ margin: '0 0 0.75rem', paddingLeft: '1rem', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
            Noah Bez<br />
            Selbständiger Vertriebspartner der TELESON Vertriebs GmbH<br />
            Lochheimer Str. 37, 69124 Heidelberg<br />
            (nachfolgend „Anbieter” oder „wir”)
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            angeboten und erbracht werden.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Die Leistungen umfassen insbesondere die kostenlose und unverbindliche
            Tarifanalyse und -optimierung für Strom- und Gastarife für Privatkunden und
            Unternehmen sowie die Vermittlung von Energielieferungsverträgen über die
            TELESON Vertriebs GmbH.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Abweichende, entgegenstehende oder ergänzende AGB des Nutzers werden nur
            dann Vertragsbestandteil, wenn und soweit der Anbieter ihrer Geltung
            ausdrücklich schriftlich zugestimmt hat.
          </p>
          <p style={{ margin: 0 }}>
            (4) Der Nutzer erkennt diese AGB mit der Nutzung der Website und insbesondere
            mit der Absendung eines Kontakt- oder Analyseformulars an.
          </p>
        </LegalSection>

        {/* § 2 */}
        <LegalSection title="§ 2 Leistungsbeschreibung">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Anbieter bietet einen <Highlight>kostenlosen Vergleichs- und Vermittlungsservice</Highlight>{' '}
            für Strom- und Gastarife an. Die Leistung umfasst im Einzelnen:
          </p>
          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
            <li style={{ marginBottom: '0.25rem' }}>Analyse des bestehenden Energievertrags anhand der vom Nutzer bereitgestellten Angaben</li>
            <li style={{ marginBottom: '0.25rem' }}>Vergleich verfügbarer Tarife auf Basis aktueller Marktdaten</li>
            <li style={{ marginBottom: '0.25rem' }}>Persönliche Empfehlung eines aus unserer Sicht optimalen Tarifs</li>
            <li style={{ marginBottom: '0.25rem' }}>Auf Wunsch: Übernahme des gesamten Wechselprozesses (Kündigung des bestehenden Vertrags, Anmeldung beim neuen Anbieter)</li>
            <li style={{ marginBottom: '0.25rem' }}>Persönliche Beratung per Telefon, E-Mail oder Videocall</li>
          </ul>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Der Service ist für die Nutzer <Highlight>vollständig kostenlos</Highlight>.
            Es entstehen zu keinem Zeitpunkt Gebühren, Bearbeitungskosten, versteckte Kosten
            oder sonstige finanzielle Verpflichtungen gegenüber dem Anbieter durch die
            Nutzung der Website oder die Inanspruchnahme der Tarifanalyse.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Die Vergütung des Anbieters erfolgt ausschließlich durch Provisionen der
            Energieanbieter, die bei einem erfolgreich vermittelten und abgeschlossenen
            Energielieferungsvertrag gezahlt werden. Auf die Tarifkonditionen des
            Energieanbieters hat die Provision keinen Einfluss.
          </p>
          <p style={{ margin: 0 }}>
            (4) Die auf der Website dargestellten Tarife und Einsparungspotenziale basieren
            auf den jeweils zum Zeitpunkt der Anfrage verfügbaren Informationen und
            können sich jederzeit ändern. Eine Gewähr für die Aktualität und dauerhafte
            Verfügbarkeit bestimmter Tarife wird nicht übernommen.
          </p>
        </LegalSection>

        {/* § 3 */}
        <LegalSection title="§ 3 Vertragsschluss und Unverbindlichkeit">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Die auf der Website dargestellten Informationen, Tarifvergleiche und
            Einsparungspotenziale stellen <Highlight>kein verbindliches Angebot</Highlight> im
            Sinne des § 145 BGB dar, sondern eine unverbindliche Aufforderung zur Abgabe
            einer Anfrage (invitatio ad offerendum).
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Durch das Absenden eines Kontakt- oder Analyseformulars auf der Website
            erteilt der Nutzer eine <Highlight>unverbindliche Anfrage</Highlight> zur
            Tarifanalyse und Beratung. Ein vertraglicher Anspruch auf Durchführung der
            Analyse besteht nicht.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Ein <Highlight>verbindlicher Vertrag über einen Energieanbieterwechsel</Highlight>{' '}
            kommt erst durch die ausdrückliche Zustimmung des Nutzers zum empfohlenen Tarif
            (Auftragserteilung) und die anschließende Annahme durch den jeweiligen
            Energieanbieter zustande. Die Vertragsbeziehung besteht dann ausschließlich
            zwischen dem Nutzer und dem jeweiligen Energieanbieter.
          </p>
          <p style={{ margin: 0 }}>
            (4) Der Anbieter wird im Namen und auf Rechnung der TELESON Vertriebs GmbH
            als selbständiger Handelsvertreter gemäß § 84 HGB tätig. Er ist nicht
            Vertragspartei des Energielieferungsvertrags.
          </p>
        </LegalSection>

        {/* § 4 */}
        <LegalSection title="§ 4 Mitwirkungspflichten des Nutzers">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Nutzer ist verpflichtet, im Rahmen der Nutzung der Formulare
            <Highlight> wahrheitsgemäße, vollständige und aktuelle Angaben</Highlight> zu
            machen, insbesondere hinsichtlich:
          </p>
          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
            <li style={{ marginBottom: '0.25rem' }}>seines aktuellen Energieverbrauchs (Jahresverbrauch in kWh)</li>
            <li style={{ marginBottom: '0.25rem' }}>seines derzeitigen Energieanbieters</li>
            <li style={{ marginBottom: '0.25rem' }}>seiner Postleitzahl und der Energieart (Strom, Gas oder beides)</li>
            <li style={{ marginBottom: '0.25rem' }}>seiner Kontaktdaten (Name, E-Mail-Adresse, Telefonnummer)</li>
          </ul>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Fehlerhafte, unvollständige oder veraltete Angaben können zu einer
            ungenauen Tarifempfehlung führen. Der Anbieter übernimmt keine Haftung für
            Empfehlungen, die auf unrichtigen Nutzerangaben basieren.
          </p>
          <p style={{ margin: 0 }}>
            (3) Der Nutzer verpflichtet sich, die Website nicht missbräuchlich zu nutzen,
            insbesondere keine automatisierten Anfragen (Bots), Spam-Nachrichten oder
            sonstige den Betrieb beeinträchtigende Maßnahmen vorzunehmen.
          </p>
        </LegalSection>

        {/* § 5 */}
        <LegalSection title="§ 5 Elektronische Kommunikation">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Mit dem Absenden eines Formulars auf der Website erklärt sich der Nutzer
            damit einverstanden, dass der Anbieter ihn per E-Mail und/oder Telefon zum
            Zweck der Bearbeitung seiner Anfrage kontaktiert.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Der Nutzer erhält nach Absendung eines Formulars eine automatische
            Eingangsbestätigung per E-Mail. Diese Bestätigung enthält eine Auftragsnummer,
            eine Zusammenfassung der übermittelten Daten sowie Informationen über die
            nächsten Schritte.
          </p>
          <p style={{ margin: 0 }}>
            (3) Die Kommunikation erfolgt in der Regel per E-Mail an die vom Nutzer
            angegebene E-Mail-Adresse. Der Nutzer ist dafür verantwortlich, dass die
            angegebene E-Mail-Adresse korrekt und erreichbar ist.
          </p>
        </LegalSection>

        {/* § 6 */}
        <LegalSection title="§ 6 Datenschutz und DSGVO-Einwilligung">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Anbieter verarbeitet personenbezogene Daten des Nutzers ausschließlich
            im Einklang mit den geltenden datenschutzrechtlichen Bestimmungen, insbesondere
            der DSGVO, dem BDSG und dem TTDSG.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Vor der Absendung jedes Formulars wird der Nutzer aufgefordert, seine
            Einwilligung in die Verarbeitung seiner personenbezogenen Daten gemäß Art. 6
            Abs. 1 S. 1 lit. a DSGVO durch aktives Setzen einer Checkbox zu erteilen.
            Ohne diese Einwilligung ist eine Absendung des Formulars technisch nicht möglich.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Die erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft
            widerrufen werden. Durch den Widerruf wird die Rechtmäßigkeit der aufgrund
            der Einwilligung bis zum Widerruf erfolgten Verarbeitung nicht berührt.
          </p>
          <p style={{ margin: 0 }}>
            (4) Ausführliche Informationen zum Umgang mit personenbezogenen Daten finden
            Sie in unserer{' '}
            <Link href="/datenschutz" style={{ color: '#8E97A8', textDecoration: 'none' }}>
              Datenschutzerklärung
            </Link>.
          </p>
        </LegalSection>

        {/* § 7 */}
        <LegalSection title="§ 7 Haftung">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Anbieter übernimmt <Highlight>keine Gewähr</Highlight> für die Richtigkeit,
            Vollständigkeit, Aktualität und fortlaufende Verfügbarkeit der auf der Website
            angezeigten Tarifinformationen, Vergleichsergebnisse und Einsparungspotenziale.
            Die endgültigen Vertragskonditionen werden ausschließlich vom jeweiligen
            Energieanbieter festgelegt.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Die Tarifempfehlungen des Anbieters stellen keine rechtsverbindliche
            Beratung und keine Anlageberatung dar. Sie dienen ausschließlich der
            allgemeinen Information und unverbindlichen Orientierung.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Der Anbieter haftet unbeschränkt für Schäden, die auf einer vorsätzlichen
            oder grob fahrlässigen Pflichtverletzung des Anbieters oder seiner
            Erfüllungsgehilfen beruhen, sowie für Schäden aus der Verletzung des Lebens,
            des Körpers oder der Gesundheit.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (4) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht
            (Kardinalpflicht) haftet der Anbieter der Höhe nach begrenzt auf den bei
            Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Wesentliche
            Vertragspflichten sind solche, deren Erfüllung die ordnungsgemäße Durchführung
            des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Nutzer
            regelmäßig vertrauen darf.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (5) Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.
          </p>
          <p style={{ margin: 0 }}>
            (6) Die vorstehenden Haftungsbeschränkungen gelten auch zugunsten der
            Erfüllungsgehilfen und gesetzlichen Vertreter des Anbieters.
          </p>
        </LegalSection>

        {/* § 8 */}
        <LegalSection title="§ 8 Widerrufsrecht und Widerrufsbelehrung">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Da die kostenlose Tarifanalyse eine <Highlight>unverbindliche und kostenfreie
            Serviceleistung</Highlight> darstellt, bei der kein entgeltlicher Vertrag zwischen
            dem Nutzer und dem Anbieter zustande kommt, besteht kein gesetzliches
            Widerrufsrecht im Sinne der §§ 312g, 355 ff. BGB (Fernabsatzrecht).
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Das <Highlight>Widerrufsrecht bei einem abgeschlossenen Energielieferungsvertrag</Highlight>{' '}
            richtet sich nach den Allgemeinen Geschäftsbedingungen und
            Widerrufsbelehrungen des jeweiligen Energieanbieters. In der Regel besteht
            ein 14-tägiges Widerrufsrecht gemäß § 312g BGB i. V. m. § 355 BGB. Die
            Widerrufsfrist beginnt mit dem Tag des Vertragsschlusses.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Im Falle eines Widerrufs gegenüber dem Energieanbieter ist der Nutzer
            verpflichtet, den Widerruf direkt an den jeweiligen Energieanbieter zu richten.
            Der Anbieter (Dein Tarifheld) kann bei der Ausübung des Widerrufs unterstützen,
            ist jedoch nicht Adressat des Widerrufs.
          </p>
          <p style={{ margin: 0 }}>
            (4) Die datenschutzrechtliche Einwilligung (DSGVO) kann jederzeit unabhängig
            vom Widerruf eines Energievertrags mit Wirkung für die Zukunft widerrufen
            werden (Art. 7 Abs. 3 DSGVO). Der Widerruf ist zu richten an:{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
          </p>
        </LegalSection>

        {/* § 9 */}
        <LegalSection title="§ 9 Verfügbarkeit der Website">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Anbieter ist bemüht, die Website möglichst unterbrechungsfrei zum
            Abruf anzubieten. Ein Anspruch auf ununterbrochene Verfügbarkeit besteht
            jedoch nicht.
          </p>
          <p style={{ margin: 0 }}>
            (2) Vorübergehende Betriebsunterbrechungen aufgrund von Wartungsarbeiten,
            Weiterentwicklungen, technischen Störungen, höherer Gewalt oder sonstigen
            Umständen außerhalb des Einflussbereichs des Anbieters begründen keinen
            Anspruch auf Schadensersatz.
          </p>
        </LegalSection>

        {/* § 10 */}
        <LegalSection title="§ 10 Urheberrecht und geistiges Eigentum">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Alle auf der Website veröffentlichten Inhalte (Texte, Bilder, Grafiken,
            Logos, Designs, Layouts, Quellcode) unterliegen dem deutschen Urheberrecht
            und sind Eigentum des Anbieters oder Dritter, die dem Anbieter entsprechende
            Nutzungsrechte eingeräumt haben.
          </p>
          <p style={{ margin: 0 }}>
            (2) Die Vervielfältigung, Bearbeitung, Verbreitung, öffentliche Zugänglichmachung
            oder sonstige Nutzung der Inhalte außerhalb der Grenzen des Urheberrechts
            bedarf der vorherigen schriftlichen Zustimmung des Anbieters. Downloads und
            Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch
            gestattet.
          </p>
        </LegalSection>

        {/* § 11 */}
        <LegalSection title="§ 11 Verbraucherschlichtung">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
            (OS) bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#8E97A8', textDecoration: 'none' }}
            >
              https://ec.europa.eu/consumers/odr
            </a>
          </p>
          <p style={{ margin: 0 }}>
            (2) Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle im Sinne des
            Verbraucherstreitbeilegungsgesetzes (VSBG) teilzunehmen.
          </p>
        </LegalSection>

        {/* § 12 */}
        <LegalSection title="§ 12 Änderung der AGB">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Der Anbieter behält sich vor, diese AGB jederzeit mit Wirkung für die
            Zukunft zu ändern oder zu ergänzen, soweit dies aufgrund geänderter
            Rechtslage, höchstrichterlicher Rechtsprechung oder einer Änderung der
            Marktgegebenheiten erforderlich wird.
          </p>
          <p style={{ margin: 0 }}>
            (2) Die geänderte Fassung wird auf der Website veröffentlicht. Es gilt
            jeweils die zum Zeitpunkt der Nutzung der Website aktuelle Version der AGB.
          </p>
        </LegalSection>

        {/* § 13 */}
        <LegalSection title="§ 13 Schlussbestimmungen">
          <p style={{ marginBottom: '0.75rem' }}>
            (1) Es gilt das <Highlight>Recht der Bundesrepublik Deutschland</Highlight> unter
            Ausschluss des UN-Kaufrechts (CISG) und der Kollisionsnormen des
            internationalen Privatrechts.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (2) Ist der Nutzer Kaufmann im Sinne des Handelsgesetzbuches, juristische
            Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen,
            ist ausschließlicher Gerichtsstand für alle sich aus dem Vertragsverhältnis
            ergebenden Streitigkeiten Heidelberg.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            (3) Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise unwirksam
            sein oder werden, so wird die Wirksamkeit der übrigen Bestimmungen hiervon
            nicht berührt (<Highlight>Salvatorische Klausel</Highlight>). Anstelle der
            unwirksamen oder undurchführbaren Bestimmung gilt diejenige wirksame und
            durchführbare Regelung, deren Wirkungen der wirtschaftlichen Zielsetzung am
            nächsten kommen, die die Vertragsparteien mit der unwirksamen bzw.
            undurchführbaren Bestimmung verfolgt haben.
          </p>
          <p style={{ margin: 0 }}>
            (4) Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen
            bedürfen der Schriftform. Dies gilt auch für die Aufhebung dieses
            Schriftformerfordernisses.
          </p>
        </LegalSection>

        {/* Footer divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginTop: '3rem', marginBottom: '2rem' }} />

        <p style={{ color: '#6B7280', fontSize: '0.8125rem', textAlign: 'center' }}>
          Noah Bez · Selbständiger Vertriebspartner der TELESON Vertriebs GmbH ·{' '}
          <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
        </p>
      </div>
    </div>
  )
}
