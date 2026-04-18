import Link from 'next/link'
import { Zap } from 'lucide-react'
import { ObfuscatedEmail } from '@/components/ui/ObfuscatedEmail'

export const metadata = {
  title: 'Datenschutzerklärung – Dein Tarifheld | DSGVO-konforme Datenschutzinformationen',
  description: 'Umfassende Datenschutzerklärung gemäß Art. 13, 14 DSGVO, BDSG und TTDSG für deintarifheld.de – Informationen zur Verarbeitung personenbezogener Daten.',
  alternates: { canonical: 'https://www.deintarifheld.de/datenschutz/' },
  robots: { index: false, follow: false },
}

function LegalSection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: '2.5rem' }}>
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

function SubSection({ title, children }) {
  return (
    <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#D9DEE4', marginBottom: '0.5rem' }}>
        {title}
      </h3>
      <div>{children}</div>
    </div>
  )
}

function BulletList({ items }) {
  return (
    <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{item}</li>)}
    </ul>
  )
}

function Highlight({ children }) {
  return <strong style={{ color: '#D9DEE4' }}>{children}</strong>
}

function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#8E97A8', textDecoration: 'none' }}>
      {children}
    </a>
  )
}

export default function DatenschutzPage() {
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
          Datenschutzerklärung
        </h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '3rem' }}>
          Informationspflichten gemäß Art. 13, 14 DSGVO | BDSG | TTDSG
        </p>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: '3rem' }} />

        {/* ═══════════════════ EINLEITUNG ═══════════════════ */}
        <p style={{ color: '#8E97A8', fontSize: '0.9375rem', lineHeight: 1.75, marginBottom: '1rem' }}>
          Der Schutz Ihrer personenbezogenen Daten ist uns ein besonderes Anliegen.
          Wir verarbeiten Ihre Daten ausschließlich auf Grundlage der gesetzlichen
          Bestimmungen, insbesondere der Verordnung (EU) 2016/679 (Datenschutz-Grundverordnung – <Highlight>DSGVO</Highlight>),
          des Bundesdatenschutzgesetzes (<Highlight>BDSG</Highlight>) sowie des
          Telekommunikation-Telemedien-Datenschutz-Gesetzes (<Highlight>TTDSG</Highlight>).
        </p>
        <p style={{ color: '#8E97A8', fontSize: '0.9375rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>
          In dieser Datenschutzerklärung informieren wir Sie umfassend über Art, Umfang, Zweck,
          Dauer und Rechtsgrundlage der Verarbeitung personenbezogener Daten auf unserer Website
          <Highlight> www.deintarifheld.de</Highlight>, einschließlich der Nutzung von
          Kontaktformularen, externen Diensteanbietern, E-Mail-Kommunikation und der
          automatisierten Datenverarbeitung im Backend. Ferner informieren wir Sie über Ihre
          Rechte als betroffene Person.
        </p>

        {/* ═══════════════════ 1. VERANTWORTLICHER ═══════════════════ */}
        <LegalSection id="verantwortlicher" title="1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung und anderer nationaler
            Datenschutzgesetze der Mitgliedstaaten sowie sonstiger datenschutzrechtlicher
            Bestimmungen ist:
          </p>
          <p style={{ margin: '0 0 0.75rem', paddingLeft: '1rem', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
            <Highlight>Noah Bez</Highlight><br />
            Selbständiger Vertriebspartner der TELESON Vertriebs GmbH<br />
            Lochheimer Str. 37<br />
            69124 Heidelberg<br />
            Deutschland<br /><br />
            E-Mail:{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} /><br />
            Website: <ExtLink href="https://www.deintarifheld.de">www.deintarifheld.de</ExtLink>
          </p>
          <p style={{ margin: 0 }}>
            Bei Fragen zum Datenschutz können Sie sich jederzeit per E-Mail an uns wenden.
          </p>
        </LegalSection>

        {/* ═══════════════════ 2. DATENSCHUTZBEAUFTRAGTER ═══════════════════ */}
        <LegalSection id="dsb" title="2. Datenschutzbeauftragter">
          <p style={{ margin: 0 }}>
            Es besteht keine gesetzliche Pflicht zur Bestellung eines Datenschutzbeauftragten
            gemäß Art. 37 DSGVO i. V. m. § 38 BDSG, da wir weniger als 20 Personen ständig
            mit der automatisierten Verarbeitung personenbezogener Daten beschäftigen. Bei
            datenschutzrechtlichen Anliegen wenden Sie sich bitte direkt an den oben genannten
            Verantwortlichen.
          </p>
        </LegalSection>

        {/* ═══════════════════ 3. RECHTSGRUNDLAGEN ═══════════════════ */}
        <LegalSection id="rechtsgrundlagen" title="3. Maßgebliche Rechtsgrundlagen (Art. 6 DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Die Verarbeitung personenbezogener Daten erfolgt stets auf einer der folgenden
            Rechtsgrundlagen:
          </p>
          <BulletList items={[
            <span key="a"><Highlight>Art. 6 Abs. 1 S. 1 lit. a DSGVO (Einwilligung)</Highlight> – Sie haben Ihre Einwilligung zur Verarbeitung der Sie betreffenden personenbezogenen Daten für einen oder mehrere bestimmte Zwecke gegeben. Diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).</span>,
            <span key="b"><Highlight>Art. 6 Abs. 1 S. 1 lit. b DSGVO (Vertragserfüllung / vorvertragliche Maßnahmen)</Highlight> – Die Verarbeitung ist für die Erfüllung eines Vertrags oder zur Durchführung vorvertraglicher Maßnahmen erforderlich, die auf Ihre Anfrage hin erfolgen (z. B. Tarifvergleich, Angebotserstellung).</span>,
            <span key="c"><Highlight>Art. 6 Abs. 1 S. 1 lit. c DSGVO (Rechtliche Verpflichtung)</Highlight> – Die Verarbeitung ist zur Erfüllung einer rechtlichen Verpflichtung erforderlich, der wir unterliegen (z. B. steuerliche Aufbewahrungspflichten, handelsrechtliche Dokumentation).</span>,
            <span key="f"><Highlight>Art. 6 Abs. 1 S. 1 lit. f DSGVO (Berechtigtes Interesse)</Highlight> – Die Verarbeitung ist zur Wahrung unserer berechtigten Interessen oder der eines Dritten erforderlich und Ihre Interessen, Grundrechte und Grundfreiheiten überwiegen nicht. Unsere berechtigten Interessen umfassen insbesondere die Sicherstellung der IT-Sicherheit, den Schutz vor Missbrauch (z. B. Spam, Bot-Angriffe) und die Optimierung unserer Dienstleistungen.</span>,
          ]} />
          <p style={{ marginTop: '0.75rem' }}>
            Für die Verarbeitung von Bewerbungsdaten gilt zusätzlich <Highlight>§ 26 Abs. 1 BDSG</Highlight>{' '}
            i. V. m. Art. 88 DSGVO (Verarbeitung für Zwecke des Beschäftigungsverhältnisses).
          </p>
        </LegalSection>

        {/* ═══════════════════ 4. SICHERHEITSMASSNAHMEN ═══════════════════ */}
        <LegalSection id="sicherheit" title="4. Technische und organisatorische Maßnahmen (Art. 32 DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Wir treffen nach Maßgabe der gesetzlichen Vorgaben unter Berücksichtigung des
            Stands der Technik, der Implementierungskosten und der Art, des Umfangs, der
            Umstände und der Zwecke der Verarbeitung sowie der unterschiedlichen
            Eintrittswahrscheinlichkeit und Schwere des Risikos für die Rechte und Freiheiten
            natürlicher Personen geeignete technische und organisatorische Maßnahmen, um ein
            dem Risiko angemessenes Schutzniveau zu gewährleisten. Zu diesen Maßnahmen gehören
            insbesondere:
          </p>
          <BulletList items={[
            <span key="ssl"><Highlight>Transportverschlüsselung (SSL/TLS):</Highlight> Sämtliche Datenübertragungen zwischen Ihrem Browser und unserer Website erfolgen verschlüsselt über HTTPS (TLS 1.2 oder höher).</span>,
            <span key="input"><Highlight>Eingabevalidierung und Sanitierung:</Highlight> Alle über Formulare übermittelten Daten werden sowohl clientseitig als auch serverseitig auf Schadcode (XSS, SQL-Injection, Script-Injection) geprüft und bereinigt.</span>,
            <span key="honey"><Highlight>Bot-Erkennung:</Highlight> Wir setzen unsichtbare Honeypot-Felder und zeitbasierte Erkennungsmechanismen ein, um automatisierte Missbrauchsversuche (Spam-Bots) zu unterbinden, ohne dabei personenbezogene Daten zu erheben.</span>,
            <span key="rate"><Highlight>Rate-Limiting:</Highlight> Sowohl clientseitig als auch serverseitig limitieren wir die Anzahl möglicher Formularabsendungen pro Zeiteinheit, um Missbrauch und DDoS-Angriffe zu verhindern.</span>,
            <span key="dup"><Highlight>Duplikat-Erkennung:</Highlight> Identische Formularübermittlungen innerhalb eines kurzen Zeitfensters werden erkannt und abgelehnt. Zur Identifikation wird ein kryptografisch gehashter Fingerprint verwendet – keine Klartextdaten.</span>,
            <span key="whitelist"><Highlight>Feld-Whitelist:</Highlight> Nur vorab definierte Datenfelder pro Formulartyp werden akzeptiert. Alle unbekannten Felder werden serverseitig entfernt, bevor Daten gespeichert werden.</span>,
            <span key="payload"><Highlight>Payload-Begrenzung:</Highlight> Die maximale Größe eingehender Anfragen ist auf 10 KB beschränkt, die Anzahl der Felder auf maximal 25.</span>,
            <span key="hash"><Highlight>Pseudonymisierung:</Highlight> IP-Adressen werden ausschließlich als kryptografischer Hash (MD5 mit Salt) gespeichert – niemals im Klartext. Eine Rückrechnung auf die Ursprungs-IP ist praktisch ausgeschlossen.</span>,
            <span key="zugriff"><Highlight>Zugriffsbeschränkung:</Highlight> Der Zugriff auf gespeicherte personenbezogene Daten ist ausschließlich dem Verantwortlichen (Noah Bez) vorbehalten.</span>,
            <span key="auto"><Highlight>Automatische Datenlöschung:</Highlight> Ein serverseitiger Trigger löscht Daten automatisiert nach Ablauf der konfigurierten Aufbewahrungsfrist (siehe Abschnitt „Speicherdauer und Löschung").</span>,
            <span key="proto"><Highlight>DSGVO-Protokollierung:</Highlight> Sämtliche Datenverarbeitungsvorgänge (Speicherung, Löschung, Sicherheitsereignisse) werden in einem separaten Protokoll-Sheet dokumentiert (Art. 30 DSGVO).</span>,
          ]} />
        </LegalSection>

        {/* ═══════════════════ 5. HOSTING ═══════════════════ */}
        <LegalSection id="hosting" title="5. Bereitstellung des Onlineangebotes und Webhosting">
          <SubSection title="a) Hosting-Anbieter">
            <p style={{ marginBottom: '0.75rem' }}>
              Unsere Website wird bei <Highlight>Checkdomain GmbH</Highlight> gehostet,
              einem deutschen Hosting-Anbieter mit Sitz in Lübeck, Deutschland. Die Server
              befinden sich in Deutschland. Zwischen uns und Checkdomain besteht ein Vertrag
              zur Auftragsverarbeitung gemäß Art. 28 DSGVO.
            </p>
            <p style={{ margin: '0 0 0.75rem', paddingLeft: '1rem', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
              Checkdomain GmbH<br />
              Große Burgstraße 27/29<br />
              23552 Lübeck, Deutschland<br />
              <ExtLink href="https://checkdomain.de/agb/datenschutz/">checkdomain.de/agb/datenschutz</ExtLink>
            </p>
          </SubSection>

          <SubSection title="b) Erhebung von Zugriffsdaten (Server-Logfiles)">
            <p style={{ marginBottom: '0.75rem' }}>
              Beim Besuch unserer Website erhebt der Hosting-Anbieter automatisch Informationen
              in sogenannten Server-Logfiles, die Ihr Browser automatisch übermittelt. Dies sind:
            </p>
            <BulletList items={[
              'Browsertyp und Browserversion',
              'Verwendetes Betriebssystem',
              'Referrer-URL (die zuvor besuchte Seite)',
              'Hostname des zugreifenden Rechners',
              'Datum und Uhrzeit der Serveranfrage',
              'IP-Adresse des zugreifenden Rechners',
              'Übertragene Datenmenge und Anfragestatus (HTTP-Statuscode)',
            ]} />
            <p style={{ marginTop: '0.75rem' }}>
              <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 S. 1 lit. f DSGVO (berechtigtes Interesse
              an der technisch fehlerfreien Darstellung und Optimierung der Website sowie
              der Gewährleistung der Systemsicherheit).
            </p>
            <p style={{ margin: 0 }}>
              <Highlight>Speicherdauer:</Highlight> Die Server-Logfiles werden durch den Hosting-Anbieter
              gemäß dessen Datenschutzbestimmungen gespeichert und nach spätestens 30 Tagen
              automatisch gelöscht. Eine Zusammenführung dieser Daten mit anderen Datenquellen
              erfolgt nicht.
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 6. SSL/TLS ═══════════════════ */}
        <LegalSection id="ssl" title="6. SSL- bzw. TLS-Verschlüsselung">
          <p style={{ margin: 0 }}>
            Diese Website nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
            vertraulicher Inhalte, wie zum Beispiel Anfragen, die Sie an uns als
            Seitenbetreiber senden, eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte
            Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von
            „http://" auf „https://" wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
            Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten, die Sie
            an uns übermitteln, nicht von Dritten mitgelesen werden.
          </p>
        </LegalSection>

        {/* ═══════════════════ 7. KONTAKTFORMULARE PRIVATKUNDEN ═══════════════════ */}
        <LegalSection id="kontaktformulare" title="7. Kontaktformulare – Strom- & Gasvergleich (Privatkunden)">
          <SubSection title="a) Beschreibung und Umfang der Datenverarbeitung">
            <p style={{ marginBottom: '0.75rem' }}>
              Auf unserer Website stehen Ihnen Kontaktformulare zur Verfügung, über die Sie
              eine kostenlose und unverbindliche Tarifanalyse für Strom und Gas anfordern
              können. Im Rahmen der Absendung werden die folgenden personenbezogenen Daten
              erhoben und verarbeitet:
            </p>
            <BulletList items={[
              'Vorname und/oder Nachname (Pflichtfeld)',
              'E-Mail-Adresse (Pflichtfeld)',
              'Telefonnummer (Pflichtfeld)',
              'Aktueller Energieanbieter (Pflichtfeld)',
              'Jahresverbrauch in kWh (Pflichtfeld)',
              'Postleitzahl (Pflichtfeld)',
              'Energieart – Strom, Gas oder beides (optional)',
              'DSGVO-Einwilligung (Pflichtfeld – Checkbox)',
              'Technische Metadaten: Zeitstempel der Absendung, Zeitstempel des Formular-Ladevorgangs (für Bot-Erkennung), Formularversion, Seitenherkunft',
            ]} />
          </SubSection>

          <SubSection title="b) Zweck der Datenverarbeitung">
            <p style={{ margin: 0 }}>
              Die Verarbeitung dient ausschließlich der Durchführung einer individuellen
              Tarifanalyse, der persönlichen Kontaktaufnahme zur Beratung sowie ggf. der
              Unterstützung beim Anbieterwechsel. Die Daten werden nicht für Werbezwecke
              verwendet, es sei denn, Sie haben hierzu gesondert eingewilligt.
            </p>
          </SubSection>

          <SubSection title="c) Rechtsgrundlage">
            <p style={{ margin: 0 }}>
              <Highlight>Art. 6 Abs. 1 S. 1 lit. a DSGVO</Highlight> (Einwilligung durch
              aktives Setzen der DSGVO-Checkbox) in Verbindung mit{' '}
              <Highlight>Art. 6 Abs. 1 S. 1 lit. b DSGVO</Highlight> (Durchführung
              vorvertraglicher Maßnahmen auf Anfrage der betroffenen Person).
            </p>
          </SubSection>

          <SubSection title="d) Empfänger der Daten">
            <p style={{ marginBottom: '0.5rem' }}>
              Die übermittelten Daten können im Rahmen der Tarifvermittlung an folgende
              Empfänger weitergegeben werden:
            </p>
            <BulletList items={[
              <span key="tel"><Highlight>TELESON Vertriebs GmbH</Highlight>, Zielstattstraße 10, 81379 München – als Auftraggeber im Rahmen des Handelsvertreterverhältnisses, soweit für die Tarifvermittlung erforderlich</span>,
              <span key="gws"><Highlight>Google Ireland Limited</Highlight>, Gordon House, Barrow Street, Dublin 4, Irland – als Auftragsverarbeiter für die Speicherung in Google Sheets und den E-Mail-Versand via Gmail (Vertrag gemäß Art. 28 DSGVO)</span>,
            ]} />
            <p style={{ marginTop: '0.5rem', margin: 0 }}>
              Eine Weitergabe an sonstige Dritte oder eine Verarbeitung zu Werbezwecken
              erfolgt nicht ohne Ihre ausdrückliche Einwilligung.
            </p>
          </SubSection>

          <SubSection title="e) Speicherdauer">
            <p style={{ margin: 0 }}>
              Ihre Daten werden nach Bearbeitung der Anfrage für maximal <Highlight>90 Tage</Highlight> in
              unserer Datenbank (Google Sheets) gespeichert und anschließend automatisch
              und unwiderruflich gelöscht. Die Löschung erfolgt durch einen eingerichteten
              täglichen automatisierten Löschmechanismus. Jede Löschung wird im DSGVO-Protokoll
              dokumentiert und der Verantwortliche per E-Mail informiert.
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 8. B2B-ANFRAGEN ═══════════════════ */}
        <LegalSection id="b2b" title="8. Kontaktformulare – Unternehmensanfragen (B2B)">
          <SubSection title="a) Beschreibung und Umfang der Datenverarbeitung">
            <p style={{ marginBottom: '0.75rem' }}>
              Für geschäftliche Anfragen steht ein gesondertes B2B-Formular auf unserer
              Unternehmensseite zur Verfügung. Dabei werden die folgenden Daten erhoben:
            </p>
            <BulletList items={[
              'Firmenname (Pflichtfeld)',
              'Name des Ansprechpartners (Pflichtfeld)',
              'Geschäftliche E-Mail-Adresse (Pflichtfeld)',
              'Telefonnummer (optional)',
              'Postleitzahl (Pflichtfeld)',
              'Energieart (Pflichtfeld)',
              'Jahresverbrauch Strom und/oder Gas in kWh (optional)',
              'Anzahl der Standorte (Pflichtfeld)',
              'Aktueller Versorger (optional)',
              'Vertragslaufzeit (optional)',
              'Freitextnachricht (optional)',
              'DSGVO-Einwilligung (Pflichtfeld – Checkbox)',
              'Technische Metadaten (wie unter Abschnitt 7a beschrieben)',
            ]} />
          </SubSection>

          <SubSection title="b) Zweck, Rechtsgrundlage und Speicherdauer">
            <p style={{ margin: 0 }}>
              <Highlight>Zweck:</Highlight> Individuelle B2B-Tarifanalyse und Erstellung maßgeschneiderter Angebote.<br />
              <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 S. 1 lit. a DSGVO (Einwilligung) i. V. m. Art. 6 Abs. 1 S. 1 lit. b DSGVO (vorvertragliche Maßnahmen).<br />
              <Highlight>Speicherdauer:</Highlight> Maximal 90 Tage, danach automatische Löschung.
              Empfänger und Auftragsverarbeiter entsprechen den unter Abschnitt 7d genannten.
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 9. KARRIERE/BEWERBUNGEN ═══════════════════ */}
        <LegalSection id="karriere" title="9. Karriere – Bewerbungen (§ 26 BDSG)">
          <SubSection title="a) Beschreibung und Umfang der Datenverarbeitung">
            <p style={{ marginBottom: '0.75rem' }}>
              Über unser Karriereformular können Sie sich initiativ bei uns bewerben.
              Dabei werden die folgenden personenbezogenen Daten erhoben:
            </p>
            <BulletList items={[
              'Vollständiger Name (Pflichtfeld)',
              'E-Mail-Adresse (Pflichtfeld)',
              'Telefonnummer (Pflichtfeld)',
              'Motivationstext / Anschreiben (Pflichtfeld)',
              'DSGVO-Einwilligung (Pflichtfeld – Checkbox)',
              'Technische Metadaten (wie unter Abschnitt 7a beschrieben)',
            ]} />
          </SubSection>

          <SubSection title="b) Zweck der Datenverarbeitung">
            <p style={{ margin: 0 }}>
              Die Daten werden ausschließlich zum Zweck der Durchführung des
              Bewerbungsverfahrens verarbeitet, d. h. zur Prüfung Ihrer Eignung für eine
              Zusammenarbeit und zur Kontaktaufnahme im Rahmen des Bewerbungsprozesses.
            </p>
          </SubSection>

          <SubSection title="c) Rechtsgrundlage">
            <p style={{ margin: 0 }}>
              <Highlight>§ 26 Abs. 1 S. 1 BDSG</Highlight> i. V. m. <Highlight>Art. 88 Abs. 1 DSGVO</Highlight> (Verarbeitung
              personenbezogener Daten für Zwecke des Beschäftigungsverhältnisses, soweit dies
              für die Entscheidung über die Begründung eines Beschäftigungsverhältnisses
              erforderlich ist). Zusätzlich <Highlight>Art. 6 Abs. 1 S. 1 lit. a DSGVO</Highlight> (Einwilligung
              durch aktives Setzen der DSGVO-Checkbox).
            </p>
          </SubSection>

          <SubSection title="d) Speicherdauer">
            <p style={{ margin: 0 }}>
              Ihre Bewerbungsdaten werden nach Abschluss des Bewerbungsverfahrens für
              maximal <Highlight>6 Monate</Highlight> aufbewahrt – dies entspricht der üblichen Frist zur
              Geltendmachung von Ansprüchen nach dem Allgemeinen Gleichbehandlungsgesetz
              (AGG, § 15 Abs. 4: 2 Monate nach Zugang der Ablehnung, plus angemessene
              Bearbeitungszeit). Sofern keine Einstellung erfolgt, werden die Daten nach
              Ablauf dieser Frist automatisch und vollständig gelöscht. Bei einer
              Einstellung werden Ihre Daten in die Personalakte überführt.
            </p>
          </SubSection>

          <SubSection title="e) Freiwilligkeit">
            <p style={{ margin: 0 }}>
              Die Bereitstellung Ihrer Bewerbungsdaten ist freiwillig. Ohne die
              erforderlichen Pflichtangaben können wir Ihre Bewerbung jedoch nicht
              bearbeiten.
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 10. E-MAIL-KOMMUNIKATION ═══════════════════ */}
        <LegalSection id="email" title="10. E-Mail-Kommunikation und Bestätigungsmails">
          <SubSection title="a) Automatische Bestätigungsmails">
            <p style={{ margin: 0 }}>
              Nach Absendung eines Formulars erhalten Sie eine automatische Eingangsbestätigung
              per E-Mail an die von Ihnen angegebene E-Mail-Adresse. Diese E-Mail enthält Ihre
              Auftragsnummer, eine Zusammenfassung Ihrer Angaben sowie Informationen zu den
              nächsten Schritten. Der Versand erfolgt über Google Gmail (siehe Abschnitt 12).
            </p>
          </SubSection>

          <SubSection title="b) Interne Benachrichtigungen">
            <p style={{ margin: 0 }}>
              Als Verantwortlicher erhalte ich bei jedem Formulareingang eine interne
              Benachrichtigungs-E-Mail mit den Lead-Details, um eine zeitnahe Bearbeitung
              sicherzustellen. Diese E-Mails werden ausschließlich an die administrative
              E-Mail-Adresse des Verantwortlichen versendet.
            </p>
          </SubSection>

          <SubSection title="c) Rechtsgrundlage">
            <p style={{ margin: 0 }}>
              <Highlight>Art. 6 Abs. 1 S. 1 lit. b DSGVO</Highlight> (Vertragserfüllung / vorvertragliche
              Maßnahmen – die Bestätigungsmail ist Teil des Verarbeitungsprozesses, den
              Sie durch Ihre Anfrage ausgelöst haben).
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 11. AUTOMATISIERTE VERARBEITUNG ═══════════════════ */}
        <LegalSection id="automatisiert" title="11. Automatisierte Datenverarbeitung (Backend)">
          <p style={{ marginBottom: '0.75rem' }}>
            Die über unsere Formulare übermittelten Daten werden mittels eines automatisierten
            Backend-Systems verarbeitet. Im Einzelnen geschieht Folgendes:
          </p>
          <ol style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
            <li style={{ marginBottom: '0.35rem' }}>Prüfung der Payload-Größe (Überschreitung = Ablehnung)</li>
            <li style={{ marginBottom: '0.35rem' }}>Parsing und Validierung des Datenformats</li>
            <li style={{ marginBottom: '0.35rem' }}>Prüfung der Feldanzahl gegen definierte Obergrenzen</li>
            <li style={{ marginBottom: '0.35rem' }}>Serverseitige Honeypot-Prüfung (Bot-Erkennung – keine personenbezogenen Daten)</li>
            <li style={{ marginBottom: '0.35rem' }}>Timing-basierte Bot-Erkennung (Ausfüllzeit &lt; 3 Sekunden = automatisiert)</li>
            <li style={{ marginBottom: '0.35rem' }}>Prüfung der DSGVO-Einwilligung (ohne Einwilligung = keine Speicherung)</li>
            <li style={{ marginBottom: '0.35rem' }}>Rate-Limiting anhand pseudonymisierter E-Mail-Hashes (max. 5 Anfragen / Minute)</li>
            <li style={{ marginBottom: '0.35rem' }}>Inhaltliche Validierung der Pflichtfelder</li>
            <li style={{ marginBottom: '0.35rem' }}>Entfernung nicht-whitegelisteter Felder</li>
            <li style={{ marginBottom: '0.35rem' }}>Sanitierung aller Eingaben (Entfernung von HTML, JavaScript, SQL-Injection-Versuchen)</li>
            <li style={{ marginBottom: '0.35rem' }}>Duplikat-Erkennung über pseudonymisierten Fingerprint (60 Sekunden)</li>
            <li style={{ marginBottom: '0.35rem' }}>Generierung einer Auftragsnummer</li>
            <li style={{ marginBottom: '0.35rem' }}>Speicherung in Google Sheets</li>
            <li style={{ marginBottom: '0.35rem' }}>Eintrag im DSGVO-Protokoll</li>
            <li style={{ marginBottom: '0.35rem' }}>Versand der Bestätigungs- und Benachrichtigungsmails</li>
          </ol>
          <p style={{ marginTop: '0.75rem' }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 S. 1 lit. f DSGVO (berechtigtes Interesse
            an der IT-Sicherheit und dem Schutz vor Missbrauch) für die Sicherheitsprüfungen
            (Schritte 1–5, 7, 9–11); Art. 6 Abs. 1 S. 1 lit. a und b DSGVO für die
            Datenverarbeitung (Schritte 6, 8, 12–15).
          </p>
          <p style={{ margin: 0 }}>
            Bei allen Sicherheitsprüfungen, die zur Ablehnung einer Anfrage führen, wird
            ausschließlich die Art der Ablehnung und die Formularquelle protokolliert –
            keine personenbezogenen Daten der abgelehnten Anfrage.
          </p>
        </LegalSection>

        {/* ═══════════════════ 12. GOOGLE-DIENSTE ═══════════════════ */}
        <LegalSection id="google" title="12. Google-Dienste (Auftragsverarbeitung)">
          <SubSection title="a) Google Workspace und Gmail">
            <p style={{ margin: 0 }}>
              Wir nutzen <Highlight>Google Workspace</Highlight> der Google Ireland Limited,
              Gordon House, Barrow Street, Dublin 4, Irland, als cloudbasierte Plattform für
              die Verarbeitung und Speicherung personenbezogener Daten sowie für den
              E-Mail-Versand via Gmail. Google erfüllt anerkannte internationale
              Sicherheitsstandards (ISO/IEC 27001, ISO/IEC 27017, ISO/IEC 27018,
              ISO/IEC 27701, SOC 2, SOC 3).
            </p>
          </SubSection>

          <SubSection title="b) Google Sheets und Google Apps Script">
            <p style={{ margin: 0 }}>
              Die über unsere Kontaktformulare eingegebenen personenbezogenen Daten werden
              mittels <Highlight>Google Apps Script</Highlight> (serverseitig ausgeführtes
              JavaScript innerhalb der Google-Cloud-Infrastruktur) an{' '}
              <Highlight>Google Sheets</Highlight> übermittelt und dort in tabellarischer
              Form gespeichert. Die Daten sind durch die in Abschnitt 4 beschriebenen
              Sicherheitsmaßnahmen geschützt. Der Zugriff ist auf den Verantwortlichen
              beschränkt.
            </p>
          </SubSection>

          <SubSection title="c) Google Drive">
            <p style={{ margin: 0 }}>
              Für die strukturierte Ablage von Verarbeitungsdokumenten nutzen wir{' '}
              <Highlight>Google Drive</Highlight>. Die Speicherung erfolgt in einem
              zugangsbeschränkten Ordner innerhalb der Google-Cloud-Infrastruktur.
            </p>
          </SubSection>

          <SubSection title="d) Auftragsverarbeitung und Rechtsgrundlage">
            <p style={{ marginBottom: '0.75rem' }}>
              Mit Google Ireland Limited besteht ein Vertrag zur Auftragsverarbeitung gemäß{' '}
              <Highlight>Art. 28 DSGVO</Highlight> (Google Workspace Data Processing Amendment).
              Google verarbeitet die Daten nur nach unserer Weisung und setzt angemessene
              technische und organisatorische Maßnahmen zum Datenschutz ein.
            </p>
            <p style={{ marginBottom: '0.75rem' }}>
              <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 S. 1 lit. b DSGVO
              (vorvertragliche Maßnahmen) sowie Art. 6 Abs. 1 S. 1 lit. f DSGVO
              (berechtigtes Interesse an einer sicheren und effizienten Datenverarbeitung).
            </p>
            <p style={{ margin: 0 }}>
              Weitere Informationen zum Datenschutz bei Google:{' '}
              <ExtLink href="https://policies.google.com/privacy">policies.google.com/privacy</ExtLink><br />
              Google Workspace Sicherheitsübersicht:{' '}
              <ExtLink href="https://workspace.google.com/security/">workspace.google.com/security</ExtLink>
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 13. CALENDLY ═══════════════════ */}
        <LegalSection id="calendly" title="13. Terminbuchung (externer Link)">
          <p style={{ marginBottom: '0.75rem' }}>
            In unseren Bestätigungs-E-Mails bieten wir Ihnen die Möglichkeit, über einen
            externen Link einen Beratungstermin zu buchen. Dieser Link führt zu{' '}
            <Highlight>Google Calendar Appointment Scheduling</Highlight>, einem Dienst
            der Google Ireland Limited. Wenn Sie auf diesen Link klicken und einen Termin
            buchen, unterliegen Sie den Datenschutzbestimmungen von Google.
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Hinweis:</Highlight> Die Nutzung des Terminbuchungsdienstes ist vollständig
            freiwillig. Es werden erst dann personenbezogene Daten an Google übermittelt,
            wenn Sie aktiv einen Termin buchen. Das bloße Empfangen unserer
            Bestätigungs-E-Mail löst keine Datenübermittlung an den Terminbuchungsdienst aus.
          </p>
        </LegalSection>

        {/* ═══════════════════ 14. COOKIES ═══════════════════ */}
        <LegalSection id="cookies" title="14. Cookies und Speichertechnologien (§ 25 TTDSG)">
          <SubSection title="a) Was sind Cookies?">
            <p style={{ margin: 0 }}>
              Cookies sind kleine Textdateien, die von Ihrem Webbrowser auf Ihrem Endgerät
              gespeichert werden, wenn Sie eine Website besuchen. Sie dienen dazu, bestimmte
              Funktionen zu ermöglichen, die Nutzererfahrung zu verbessern oder
              Nutzerverhalten zu analysieren.
            </p>
          </SubSection>

          <SubSection title="b) Verwendung auf dieser Website">
            <p style={{ marginBottom: '0.75rem' }}>
              Diese Website verwendet derzeit <Highlight>ausschließlich technisch notwendige Cookies</Highlight>,
              die für den Betrieb der Website zwingend erforderlich sind. Es werden
              <Highlight> keine Tracking-Cookies, keine Analyse-Cookies und keine Werbe-Cookies</Highlight> eingesetzt.
            </p>
            <p style={{ margin: 0 }}>
              Insbesondere nutzen wir <Highlight>kein Google Analytics</Highlight>, kein Facebook Pixel und
              keine sonstigen Tracking-Dienste. Es werden keine personenbezogenen
              Nutzungsdaten an Dritte zu Analysezwecken übermittelt.
            </p>
          </SubSection>

          <SubSection title="c) Rechtsgrundlage">
            <p style={{ margin: 0 }}>
              <Highlight>§ 25 Abs. 2 Nr. 2 TTDSG</Highlight> (technisch notwendige Cookies / Speichertechnologien,
              die unbedingt erforderlich sind) i. V. m. <Highlight>Art. 6 Abs. 1 S. 1 lit. f DSGVO</Highlight>{' '}
              (berechtigtes Interesse an der technisch fehlerfreien Bereitstellung der Website).
            </p>
          </SubSection>

          <SubSection title="d) Verwaltung von Cookies">
            <p style={{ margin: 0 }}>
              Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies
              informiert werden, Cookies nur im Einzelfall erlauben, die Annahme von Cookies
              für bestimmte Fälle oder generell ausschließen sowie das automatische Löschen
              der Cookies beim Schließen des Browsers aktivieren. Bei der Deaktivierung von
              Cookies kann die Funktionalität dieser Website eingeschränkt sein.
            </p>
          </SubSection>

          <SubSection title="e) Zukünftige Änderungen">
            <p style={{ margin: 0 }}>
              Sollten in Zukunft nicht-technisch-notwendige Cookies oder Analysedienste
              eingebunden werden, erfolgt dies ausschließlich auf Grundlage Ihrer
              ausdrücklichen Einwilligung gemäß <Highlight>§ 25 Abs. 1 TTDSG</Highlight> i. V. m.{' '}
              <Highlight>Art. 6 Abs. 1 S. 1 lit. a DSGVO</Highlight>. In diesem Fall wird ein
              entsprechendes Cookie-Consent-Banner implementiert.
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 15. SCHRIFTARTEN ═══════════════════ */}
        <LegalSection id="fonts" title="15. Schriftarten (Web Fonts)">
          <p style={{ margin: 0 }}>
            Diese Website verwendet die Schriftart <Highlight>Outfit</Highlight>, die über das
            Next.js-Framework <Highlight>lokal eingebunden (self-hosted)</Highlight> wird. Beim
            Aufruf unserer Seiten werden keine Verbindungen zu externen Servern (z. B.
            Google Fonts, Adobe Fonts) hergestellt, um Schriftarten zu laden. Ihre
            IP-Adresse wird in diesem Zusammenhang nicht an Dritte übermittelt. Es findet
            kein Datentransfer in Drittländer statt.
          </p>
        </LegalSection>

        {/* ═══════════════════ 16. EMPFEHLUNGSPROGRAMM ═══════════════════ */}
        <LegalSection id="empfehlung" title="16. Empfehlungsprogramm / Prämienaktion">
          <SubSection title="a) Beschreibung">
            <p style={{ margin: 0 }}>
              Wir bieten unseren Kunden die Möglichkeit, an einem Empfehlungsprogramm
              teilzunehmen. Für jede erfolgreiche Empfehlung (abgeschlossener Energievertrag)
              erhalten teilnehmende Personen einen digitalen Amazon-Gutschein im Wert von
              10 Euro; bei zehn erfolgreichen Empfehlungen zusätzlich 50 Euro.
            </p>
          </SubSection>

          <SubSection title="b) Verarbeitete Daten">
            <BulletList items={[
              'Vor- und Nachname sowie E-Mail-Adresse der empfehlenden Person',
              'Freiwillig angegebener Vor- und Nachname der empfohlenen Person',
              'Technische Zuordnung (interne ID, Abschlusszeitpunkt)',
              'Ggf. Postanschrift für den Gutscheinversand',
            ]} />
          </SubSection>

          <SubSection title="c) Rechtsgrundlage und Empfänger">
            <p style={{ margin: 0 }}>
              <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 S. 1 lit. b DSGVO (Vertragserfüllung
              – Abwicklung der Prämie) sowie Art. 6 Abs. 1 S. 1 lit. f DSGVO (berechtigtes
              Interesse an der Vermeidung von Missbrauch).<br />
              <Highlight>Empfänger:</Highlight> Amazon EU S.à r.l. (Gutscheinzustellung);
              TELESON Vertriebs GmbH (Vertragszuordnung).<br />
              Die Teilnahme ist freiwillig. Widerruf jederzeit an:{' '}
              <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 17. KOOPERATIONSPARTNER ═══════════════════ */}
        <LegalSection id="kooperation" title="17. Hinweis zu Kooperationspartnern">
          <p style={{ marginBottom: '0.75rem' }}>
            Dein Tarifheld ist ein Angebot eines selbständigen Handelsvertreters gemäß
            § 84 HGB für die <Highlight>TELESON Vertriebs GmbH</Highlight>, Zielstattstraße 10,
            81379 München. Im Rahmen der Vermittlung von Strom- und Gastarifen kann eine
            Weitergabe Ihrer Daten an die TELESON Vertriebs GmbH oder an den jeweiligen
            Energieanbieter erforderlich werden.
          </p>
          <p style={{ margin: 0 }}>
            Die Weitergabe erfolgt ausschließlich im Rahmen der von Ihnen angefragten
            Dienstleistung und auf Grundlage von Art. 6 Abs. 1 S. 1 lit. b DSGVO.
            Weitere Informationen entnehmen Sie bitte der Datenschutzerklärung der
            TELESON Vertriebs GmbH unter{' '}
            <ExtLink href="https://www.teleson.de/datenschutz">www.teleson.de/datenschutz</ExtLink>.
          </p>
        </LegalSection>

        {/* ═══════════════════ 18. EMPFÄNGER ═══════════════════ */}
        <LegalSection id="empfaenger" title="18. Empfänger personenbezogener Daten (Übersicht)">
          <p style={{ marginBottom: '0.75rem' }}>
            Eine Übermittlung Ihrer personenbezogenen Daten an Dritte erfolgt nur, wenn dies
            für die Erbringung unserer Dienstleistung erforderlich ist, Sie eingewilligt haben
            oder eine gesetzliche Grundlage besteht. Im Einzelnen:
          </p>
          <BulletList items={[
            <span key="tel"><Highlight>TELESON Vertriebs GmbH</Highlight> – Auftraggeber im Rahmen des Handelsvertreterverhältnisses (Tarifvermittlung)</span>,
            <span key="google"><Highlight>Google Ireland Limited</Highlight> – Auftragsverarbeiter (Google Workspace, Sheets, Drive, Gmail, Apps Script); Vertrag gem. Art. 28 DSGVO</span>,
            <span key="check"><Highlight>Checkdomain GmbH</Highlight> – Hosting-Anbieter; Vertrag gem. Art. 28 DSGVO</span>,
            <span key="amazon"><Highlight>Amazon EU S.à r.l.</Highlight> – Gutscheinzustellung im Rahmen des Empfehlungsprogramms (nur bei Teilnahme)</span>,
            <span key="energie"><Highlight>Energieanbieter</Highlight> – im Rahmen eines konkreten Tarifwechsels, nur mit Ihrer ausdrücklichen Zustimmung</span>,
          ]} />
          <p style={{ marginTop: '0.75rem', margin: 0 }}>
            Eine Weitergabe an sonstige Dritte – insbesondere zu Werbe- oder Marketingzwecken –
            erfolgt nicht.
          </p>
        </LegalSection>

        {/* ═══════════════════ 19. INTERNATIONALE TRANSFERS ═══════════════════ */}
        <LegalSection id="international" title="19. Internationale Datenübermittlung (Art. 44 ff. DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Im Rahmen der Nutzung von Google-Diensten können personenbezogene Daten
            in die USA übermittelt werden. Google LLC ist unter dem{' '}
            <Highlight>EU-US Data Privacy Framework (DPF)</Highlight> zertifiziert.
            Der Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023
            gemäß Art. 45 DSGVO bildet die Grundlage für diese Datenübermittlung.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            Zusätzlich hat Google <Highlight>Standardvertragsklauseln (Standard Contractual Clauses – SCCs)</Highlight>{' '}
            gemäß Art. 46 Abs. 2 lit. c DSGVO implementiert, die als zusätzliche Schutzmaßnahme
            für den Fall dienen, dass der Angemessenheitsbeschluss aufgehoben werden sollte.
          </p>
          <p style={{ margin: 0 }}>
            Alle übrigen Dienstleister (Checkdomain, TELESON) verarbeiten Daten
            ausschließlich innerhalb der Europäischen Union bzw. des Europäischen
            Wirtschaftsraums. Eine Übermittlung in Drittstaaten findet insoweit nicht statt.
          </p>
        </LegalSection>

        {/* ═══════════════════ 20. SPEICHERDAUER ═══════════════════ */}
        <LegalSection id="speicherdauer" title="20. Speicherdauer und Löschung (Art. 5 Abs. 1 lit. e DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Wir verarbeiten und speichern personenbezogene Daten nur so lange, wie dies
            für die Erreichung des Verarbeitungszwecks erforderlich ist oder soweit dies
            durch gesetzliche Aufbewahrungsfristen vorgesehen ist. Im Einzelnen:
          </p>
          <BulletList items={[
            <span key="priv"><Highlight>Tarifanfragen (Privatkunden – Strom/Gas):</Highlight> Automatische Löschung nach 90 Tagen</span>,
            <span key="b2b"><Highlight>Unternehmensanfragen (B2B):</Highlight> Automatische Löschung nach 90 Tagen</span>,
            <span key="career"><Highlight>Bewerbungen (Karriere):</Highlight> Löschung nach spätestens 6 Monaten nach Abschluss des Bewerbungsverfahrens (§ 15 Abs. 4 AGG)</span>,
            <span key="dsgvo"><Highlight>DSGVO-Protokoll:</Highlight> Aufbewahrung gemäß Art. 30 DSGVO und § 147 AO (bis zu 10 Jahre für steuerlich relevante Dokumentation)</span>,
            <span key="logs"><Highlight>Server-Logfiles:</Highlight> Maximal 30 Tage (durch Hosting-Anbieter)</span>,
            <span key="cache"><Highlight>Rate-Limiting- und Duplikat-Cache:</Highlight> Maximal 60 Sekunden (keine personenbezogenen Daten, nur Hashes)</span>,
          ]} />
          <p style={{ marginTop: '0.75rem' }}>
            <Highlight>Automatische Löschung:</Highlight> Ein täglicher automatisierter Trigger prüft alle
            Datensätze in unserer Datenbank und löscht Einträge, deren Aufbewahrungsfrist
            abgelaufen ist. Jeder Löschvorgang wird im DSGVO-Protokoll dokumentiert und
            der Verantwortliche wird per E-Mail über die Anzahl der gelöschten Datensätze
            informiert – gemäß Art. 5 Abs. 1 lit. e DSGVO (Grundsatz der Speicherbegrenzung).
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Manuelles Löschungsrecht:</Highlight> Sie können jederzeit die vorzeitige Löschung
            Ihrer Daten verlangen (siehe Abschnitt 21 – Ihre Rechte). In diesem Fall werden
            Ihre Daten unverzüglich und vollständig aus allen Systemen entfernt und die
            Löschung im DSGVO-Protokoll dokumentiert.
          </p>
        </LegalSection>

        {/* ═══════════════════ 21. RECHTE ═══════════════════ */}
        <LegalSection id="rechte" title="21. Ihre Rechte als betroffene Person (Art. 15–22 DSGVO)">
          <p style={{ marginBottom: '0.75rem' }}>
            Ihnen stehen als betroffene Person nach der Datenschutz-Grundverordnung folgende
            Rechte zu. Zur Ausübung Ihrer Rechte richten Sie bitte eine formlose Mitteilung
            an{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />.
            Wir werden Ihr Anliegen unverzüglich, spätestens aber innerhalb eines Monats,
            bearbeiten (Art. 12 Abs. 3 DSGVO).
          </p>

          <SubSection title="a) Recht auf Auskunft (Art. 15 DSGVO)">
            <p style={{ margin: 0 }}>
              Sie haben das Recht, von uns eine Bestätigung darüber zu verlangen, ob wir
              personenbezogene Daten verarbeiten, die Sie betreffen. Ist dies der Fall, haben
              Sie ein Recht auf Auskunft über diese personenbezogenen Daten und auf die in
              Art. 15 DSGVO im Einzelnen aufgeführten Informationen, u. a. die
              Verarbeitungszwecke, die Kategorien der verarbeiteten Daten, die Empfänger,
              die geplante Speicherdauer sowie das Bestehen von Berichtigungs-, Löschungs-
              und Widerspruchsrechten.
            </p>
          </SubSection>

          <SubSection title="b) Recht auf Berichtigung (Art. 16 DSGVO)">
            <p style={{ margin: 0 }}>
              Sie haben das Recht, unverzüglich die Berichtigung unrichtiger
              personenbezogener Daten zu verlangen. Unter Berücksichtigung der Zwecke der
              Verarbeitung haben Sie das Recht, die Vervollständigung unvollständiger
              personenbezogener Daten zu verlangen.
            </p>
          </SubSection>

          <SubSection title="c) Recht auf Löschung (Art. 17 DSGVO)">
            <p style={{ marginBottom: '0.5rem' }}>
              Sie haben das Recht, die unverzügliche Löschung der Sie betreffenden
              personenbezogenen Daten zu verlangen, sofern einer der folgenden Gründe zutrifft:
            </p>
            <BulletList items={[
              'Die Daten sind für die Zwecke, für die sie erhoben wurden, nicht mehr notwendig.',
              'Sie widerrufen Ihre Einwilligung und es fehlt an einer anderweitigen Rechtsgrundlage.',
              'Sie legen Widerspruch ein und es liegen keine vorrangigen berechtigten Gründe vor.',
              'Die Daten wurden unrechtmäßig verarbeitet.',
              'Die Löschung ist zur Erfüllung einer rechtlichen Verpflichtung erforderlich.',
            ]} />
            <p style={{ marginTop: '0.5rem', margin: 0 }}>
              Das Recht auf Löschung besteht nicht, wenn die Verarbeitung zur Erfüllung
              einer rechtlichen Verpflichtung oder zur Geltendmachung, Ausübung oder
              Verteidigung von Rechtsansprüchen erforderlich ist.
            </p>
          </SubSection>

          <SubSection title="d) Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)">
            <p style={{ marginBottom: '0.5rem' }}>
              Sie haben das Recht, die Einschränkung der Verarbeitung zu verlangen, wenn:
            </p>
            <BulletList items={[
              'Sie die Richtigkeit der Daten bestreiten – für die Dauer der Überprüfung',
              'die Verarbeitung unrechtmäßig ist und Sie die Einschränkung statt der Löschung verlangen',
              'wir die Daten nicht mehr benötigen, Sie sie aber zur Geltendmachung von Rechtsansprüchen brauchen',
              'Sie Widerspruch eingelegt haben – bis zur Feststellung, ob unsere berechtigten Gründe überwiegen',
            ]} />
          </SubSection>

          <SubSection title="e) Recht auf Datenübertragbarkeit (Art. 20 DSGVO)">
            <p style={{ margin: 0 }}>
              Sie haben das Recht, die Sie betreffenden personenbezogenen Daten, die Sie
              uns bereitgestellt haben, in einem strukturierten, gängigen und
              maschinenlesbaren Format zu erhalten. Sie haben ferner das Recht, diese Daten
              einem anderen Verantwortlichen ohne Behinderung zu übermitteln, sofern die
              Verarbeitung auf einer Einwilligung oder einem Vertrag beruht und mithilfe
              automatisierter Verfahren erfolgt.
            </p>
          </SubSection>

          <SubSection title="f) Widerspruchsrecht (Art. 21 DSGVO)">
            <p style={{ marginBottom: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(212,255,62,0.3)' }}>
              <Highlight>Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation
              ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener
              Daten, die auf Grundlage von Art. 6 Abs. 1 S. 1 lit. f DSGVO (berechtigtes
              Interesse) erfolgt, Widerspruch einzulegen.</Highlight>
            </p>
            <p style={{ margin: 0 }}>
              Im Falle des Widerspruchs verarbeiten wir die betreffenden personenbezogenen
              Daten nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe für
              die Verarbeitung nachweisen, die Ihre Interessen, Rechte und Freiheiten
              überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder
              Verteidigung von Rechtsansprüchen.
            </p>
          </SubSection>

          <SubSection title="g) Recht auf Widerruf der datenschutzrechtlichen Einwilligung (Art. 7 Abs. 3 DSGVO)">
            <p style={{ margin: 0 }}>
              Sofern die Verarbeitung Ihrer personenbezogenen Daten auf einer Einwilligung
              beruht, haben Sie das Recht, diese Einwilligung jederzeit mit Wirkung für die
              Zukunft zu widerrufen. Durch den Widerruf der Einwilligung wird die
              Rechtmäßigkeit der aufgrund der Einwilligung bis zum Widerruf erfolgten
              Verarbeitung nicht berührt. Richten Sie Ihren Widerruf bitte an:{' '}
              <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
            </p>
          </SubSection>

          <SubSection title="h) Beschwerderecht bei der Aufsichtsbehörde (Art. 77 DSGVO)">
            <p style={{ marginBottom: '0.75rem' }}>
              Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen
              Rechtsbehelfs steht Ihnen das Recht auf Beschwerde bei einer Aufsichtsbehörde
              zu, wenn Sie der Ansicht sind, dass die Verarbeitung der Sie betreffenden
              personenbezogenen Daten gegen die DSGVO verstößt.
            </p>
            <p style={{ margin: 0, paddingLeft: '1rem', borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
              <Highlight>Zuständige Aufsichtsbehörde:</Highlight><br />
              Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg<br />
              Lautenschlagerstraße 20<br />
              70173 Stuttgart<br />
              Telefon: +49 711 615541-0<br />
              E-Mail: poststelle@lfdi.bwl.de<br />
              Website: <ExtLink href="https://www.baden-wuerttemberg.datenschutz.de">www.baden-wuerttemberg.datenschutz.de</ExtLink>
            </p>
          </SubSection>
        </LegalSection>

        {/* ═══════════════════ 22. AUTOMATISIERTE ENTSCHEIDUNGSFINDUNG ═══════════════════ */}
        <LegalSection id="automatisiert-entscheidung" title="22. Automatisierte Entscheidungsfindung einschließlich Profiling (Art. 22 DSGVO)">
          <p style={{ margin: 0 }}>
            Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling
            gemäß Art. 22 Abs. 1 und 4 DSGVO statt. Die serverseitigen Sicherheitsprüfungen
            (Honeypot, Timing, Rate-Limiting, Duplikat-Erkennung) dienen ausschließlich dem
            Schutz vor automatisiertem Missbrauch und stellen keine Entscheidung dar, die
            gegenüber der betroffenen Person rechtliche Wirkung entfaltet oder sie in
            ähnlicher Weise erheblich beeinträchtigt. Alle eingehenden Anfragen, die die
            Sicherheitsprüfungen bestehen, werden manuell durch den Verantwortlichen
            bearbeitet.
          </p>
        </LegalSection>

        {/* ═══════════════════ 23. MINDERJÄHRIGE ═══════════════════ */}
        <LegalSection id="minderjaehrige" title="23. Verarbeitung von Daten Minderjähriger">
          <p style={{ margin: 0 }}>
            Unser Angebot richtet sich grundsätzlich an volljährige Personen. Wir erheben
            wissentlich keine personenbezogenen Daten von Kindern unter 16 Jahren. Sollten
            wir erfahren, dass Daten von Personen unter 16 Jahren ohne entsprechende
            Einwilligung des Trägers der elterlichen Verantwortung erhoben wurden, werden
            wir diese Daten unverzüglich löschen (Art. 8 DSGVO i. V. m. § 25 Abs. 1 TTDSG).
          </p>
        </LegalSection>

        {/* ═══════════════════ 24. HAFTUNGSAUSSCHLUSS ═══════════════════ */}
        <LegalSection id="haftung" title="24. Haftung für Links">
          <p style={{ margin: 0 }}>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
            keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine
            Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
            Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden
            zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
            Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine
            permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete
            Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
            Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>
        </LegalSection>

        {/* ═══════════════════ 25. ÄNDERUNGEN ═══════════════════ */}
        <LegalSection id="aenderungen" title="25. Aktualität und Änderung dieser Datenschutzerklärung">
          <p style={{ margin: 0 }}>
            Diese Datenschutzerklärung ist aktuell gültig und hat den Stand: April 2026.
            Durch die Weiterentwicklung unserer Website und Angebote oder aufgrund
            geänderter gesetzlicher bzw. behördlicher Vorgaben kann es notwendig werden,
            diese Datenschutzerklärung zu ändern. Die jeweils aktuelle Datenschutzerklärung
            kann jederzeit auf dieser Seite von Ihnen abgerufen und ausgedruckt werden.
            Bei wesentlichen Änderungen werden wir Sie in geeigneter Weise darüber
            informieren.
          </p>
        </LegalSection>

        <p style={{ color: '#4A515C', fontSize: '0.8125rem', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          Stand: April 2026 | Diese Datenschutzerklärung wurde auf Grundlage der DSGVO (Verordnung (EU) 2016/679),
          des BDSG, des TTDSG sowie unter Berücksichtigung der Leitlinien des Europäischen Datenschutzausschusses (EDSA) erstellt.
        </p>
      </div>
    </div>
  )
}
