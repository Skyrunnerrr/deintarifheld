import Link from 'next/link'
import { Zap } from 'lucide-react'
import { ObfuscatedEmail } from '@/components/ui/ObfuscatedEmail'

export const metadata = {
  title: 'Datenschutzerklärung – Dein Tarifheld',
  description:
    'Datenschutzhinweise für www.deintarifheld.de: Informationen zur Verarbeitung personenbezogener Daten bei Website, Formularen und Anfragen.',
  alternates: { canonical: 'https://www.deintarifheld.de/datenschutz/' },
  robots: { index: true, follow: true },
}

function LegalSection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: '2.5rem' }}>
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#F2F4F8',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {title}
      </h2>
      <div style={{ color: '#8E97A8', fontSize: '0.9375rem', lineHeight: 1.75 }}>{children}</div>
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
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.25rem' }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Highlight({ children }) {
  return <strong style={{ color: '#D9DEE4' }}>{children}</strong>
}

function ExtLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#8E97A8', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

export default function DatenschutzPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090B0F', paddingTop: '5rem' }}>
      <div
        className="legal-container"
        style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}
      >
        <style>{`
          @media (max-width: 767px) {
            .legal-container { padding: 2rem 1rem 3rem !important; }
            .legal-container h1 { font-size: 1.5rem !important; }
          }
        `}</style>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#8E97A8',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: '2.5rem',
            opacity: 0.9,
            minHeight: 44,
            padding: '8px 0',
          }}
        >
          ← Zurück zur Startseite
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#8E97A8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
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
          Informationen zur Verarbeitung personenbezogener Daten auf www.deintarifheld.de
        </p>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: '3rem' }} />

        <p style={{ color: '#8E97A8', fontSize: '0.9375rem', lineHeight: 1.75, marginBottom: '1rem' }}>
          Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Nachfolgend informieren wir
          Sie darüber, welche personenbezogenen Daten wir im Zusammenhang mit der Website{' '}
          <Highlight>www.deintarifheld.de</Highlight> verarbeiten, zu welchen Zwecken dies
          geschieht und welche Rechte Sie haben.
        </p>
        <p
          style={{
            color: '#8E97A8',
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            marginBottom: '2.5rem',
          }}
        >
          Diese Hinweise beschreiben den Datenfluss nach dem öffentlichen Website-Release, in dem
          die Formulare an unsere Anfrage-API angebunden sind. Ältere Datenbestände aus früheren
          Verfahren werden gesondert behandelt (siehe Abschnitt 15).
        </p>

        <LegalSection id="verantwortlicher" title="1. Verantwortlicher und Kontakt">
          <p style={{ marginBottom: '0.75rem' }}>
            Verantwortlicher für die Datenverarbeitung ist:
          </p>
          <p
            style={{
              margin: '0 0 0.75rem',
              paddingLeft: '1rem',
              borderLeft: '3px solid rgba(255,255,255,0.1)',
            }}
          >
            <Highlight>Noah Bez</Highlight>
            <br />
            Selbständiger Vertriebspartner der TELESON Vertriebs GmbH
            <br />
            Lochheimer Str. 37
            <br />
            69124 Heidelberg
            <br />
            Deutschland
            <br />
            <br />
            E-Mail: <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />
            <br />
            Website: <ExtLink href="https://www.deintarifheld.de">www.deintarifheld.de</ExtLink>
          </p>
          <p style={{ margin: 0 }}>
            Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Betroffenenrechte wenden Sie sich
            bitte an <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />.
          </p>
        </LegalSection>

        <LegalSection id="allgemein" title="2. Allgemeine Hinweise und Formular-Kenntnisnahme">
          <p style={{ marginBottom: '0.75rem' }}>
            Personenbezogene Daten sind alle Informationen, die sich auf eine identifizierte
            oder identifizierbare natürliche Person beziehen.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            Wir verarbeiten personenbezogene Daten nur, soweit dies für den Betrieb der Website,
            die Bearbeitung Ihrer Anfragen oder die Erfüllung gesetzlicher Pflichten erforderlich
            ist.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            Vor dem Absenden unserer Online-Formulare müssen Sie bestätigen, dass Sie die
            Datenschutzerklärung zur Kenntnis genommen haben. Diese Pflichtbestätigung ist keine
            Einwilligung und keine eigenständige Rechtsgrundlage der Verarbeitung. Sie dient allein
            dem Nachweis, dass Sie diese Hinweise vor dem Absenden zur Kenntnis nehmen konnten.
          </p>
          <p style={{ margin: 0 }}>
            Wir setzen kein KI-gestütztes Lead-Scoring und keine automatisierte
            Entscheidungsfindung mit Rechtswirkung ein. Über die Formulare werden keine Newsletter
            und keine Marketing-Serien ausgelöst.
          </p>
        </LegalSection>

        <LegalSection id="rechtsgrundlagen" title="3. Rechtsgrundlagen der Verarbeitung">
          <p style={{ marginBottom: '0.5rem' }}>
            Je nach Vorgang stützen wir die Verarbeitung insbesondere auf folgende Grundlagen der
            DSGVO:
          </p>
          <BulletList
            items={[
              'Websitebetrieb und Sicherheitsprotokolle: Art. 6 Abs. 1 lit. f DSGVO. Berechtigtes Interesse: sicherer, stabiler und missbrauchsgeschützter Betrieb.',
              'Private Tarifanfrage: Art. 6 Abs. 1 lit. b DSGVO. Verarbeitung auf Anfrage der betroffenen Person zur Bearbeitung und Vorbereitung einer möglichen Tarifvermittlung.',
              'Unternehmensanfrage durch den Unternehmer selbst: Art. 6 Abs. 1 lit. b DSGVO.',
              'Unternehmensanfrage durch einen Ansprechpartner: Art. 6 Abs. 1 lit. f DSGVO. Berechtigtes Interesse: Bearbeitung geschäftlicher Anfragen und Kommunikation mit dem Unternehmen.',
              'Selbstständige Partneranfrage: Art. 6 Abs. 1 lit. b DSGVO. Vorbereitung einer möglichen selbstständigen vertraglichen Zusammenarbeit.',
              'Audit, Missbrauchsschutz und technische Fehleranalyse: Art. 6 Abs. 1 lit. f DSGVO. Berechtigtes Interesse: Sicherheit, Nachvollziehbarkeit, Fehleranalyse und Vermeidung von Mehrfacheinreichungen.',
              'Weitergabe an die TELESON Vertriebs GmbH oder an Energieversorger: nur soweit für eine ausdrücklich angefragte Tarifprüfung oder Vertragsanbahnung erforderlich; keine pauschale Weitergabe.',
            ]}
          />
          <p style={{ marginTop: '0.75rem', margin: 0 }}>
            Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO ist nicht die Standardgrundlage unserer
            Formularanfragen. § 26 BDSG findet auf den aktuellen Partnerpfad keine Anwendung.
          </p>
        </LegalSection>

        <LegalSection id="hosting" title="4. Hosting der öffentlichen Website">
          <p style={{ marginBottom: '0.75rem' }}>
            Die öffentlich erreichbare Website wird als statisches Angebot über{' '}
            <Highlight>Checkdomain</Highlight> bereitgestellt (Domain deintarifheld.de /
            www.deintarifheld.de). Beim Aufruf der Seiten können technisch notwendige
            Verbindungsdaten (zum Beispiel IP-Adresse, Zeitpunkt, aufgerufene Ressource,
            User-Agent) in Server- bzw. Zugriffsprotokollen der Hosting-Umgebung anfallen, soweit
            dies für den Betrieb und die Sicherheit der Website erforderlich ist.
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 lit. f DSGVO.
          </p>
        </LegalSection>

        <LegalSection id="privat" title="5. Private Tarif- und Kontaktformulare">
          <p style={{ marginBottom: '0.75rem' }}>
            Über die privaten Tarif- und Kontaktformulare können Sie eine unverbindliche
            Tarifanalyse oder Kontaktaufnahme anfragen. Die Angaben werden an unsere API unter{' '}
            <ExtLink href="https://deintarifheld-leads-api.vercel.app/api/leads/">
              https://deintarifheld-leads-api.vercel.app/api/leads/
            </ExtLink>{' '}
            übermittelt.
          </p>
          <p style={{ marginBottom: '0.5rem' }}>Dabei können insbesondere verarbeitet werden:</p>
          <BulletList
            items={[
              'Name',
              'E-Mail-Adresse',
              'Telefonnummer',
              'Angaben zu Anbieter, Verbrauch, Postleitzahl und Energieart',
              'technische Angaben zur Anfrage (zum Beispiel Zeitpunkt, Seitenherkunft und Formularversion)',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <Highlight>Zweck:</Highlight> Bearbeitung Ihrer Anfrage, Kontaktaufnahme und – soweit
            gewünscht – Unterstützung im Zusammenhang mit einer Tarifoptimierung oder einem
            Anbieterwechsel.
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </LegalSection>

        <LegalSection id="unternehmen" title="6. Unternehmensformulare">
          <p style={{ marginBottom: '0.75rem' }}>
            Über die Unternehmensformulare können Betriebe eine unverbindliche Prüfung ihrer
            Strom- oder Gasversorgungssituation anfragen. Die Angaben werden an{' '}
            <ExtLink href="https://deintarifheld-leads-api.vercel.app/api/leads/">
              https://deintarifheld-leads-api.vercel.app/api/leads/
            </ExtLink>{' '}
            übermittelt.
          </p>
          <p style={{ marginBottom: '0.5rem' }}>Dabei können insbesondere verarbeitet werden:</p>
          <BulletList
            items={[
              'Firmenname',
              'Ansprechpartner',
              'geschäftliche E-Mail-Adresse und Telefonnummer',
              'Postleitzahl, Energieart, Verbrauchs- und Standortangaben',
              'optionale Nachricht',
              'technische Angaben zur Anfrage',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <Highlight>Zweck:</Highlight> Bearbeitung der Unternehmensanfrage, Kontaktaufnahme und
            Koordination geeigneter Angebote über ausgewählte Energiepartner.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 lit. b DSGVO, wenn die
            anfragende Person als Unternehmer selbst handelt; Art. 6 Abs. 1 lit. f DSGVO, wenn ein
            Ansprechpartner für ein Unternehmen anfragt.
          </p>
          <p style={{ margin: 0 }}>
            Soweit für die Tarifvermittlung erforderlich, können Daten im Rahmen des
            Handelsvertreterverhältnisses an die <Highlight>TELESON Vertriebs GmbH</Highlight>{' '}
            weitergegeben werden. Ein Liefervertrag kommt – sofern geschlossen – mit dem
            jeweiligen Energieversorger zustande. DeinTarifheld ist kein Energieversorger.
          </p>
        </LegalSection>

        <LegalSection id="partner" title="7. Partneranfragen (Karrierepfad)">
          <p style={{ marginBottom: '0.75rem' }}>
            Über das Formular unter /karriere/ können Sie Interesse an einer selbstständigen
            Tätigkeit als Energieberater oder Vertriebspartner bekunden. Es handelt sich um eine
            Partneranfrage, nicht um eine Bewerbung auf ein Arbeitsverhältnis. Ein
            Beschäftigungsverhältnis wird über diesen Pfad nicht angeboten. Datei-Uploads (zum
            Beispiel Lebenslaufdateien) sind nicht vorgesehen und werden technisch nicht
            angenommen.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            Die Angaben werden an{' '}
            <ExtLink href="https://deintarifheld-leads-api.vercel.app/api/careers/">
              https://deintarifheld-leads-api.vercel.app/api/careers/
            </ExtLink>{' '}
            übermittelt und getrennt von Privat- und Unternehmensanfragen gespeichert.
          </p>
          <p style={{ marginBottom: '0.5rem' }}>Dabei können insbesondere verarbeitet werden:</p>
          <BulletList
            items={[
              'Name',
              'E-Mail-Adresse',
              'Telefonnummer',
              'Freitext zu Ihrem Interesse',
              'technische Angaben zur Anfrage',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <Highlight>Zweck:</Highlight> Prüfung der Partneranfrage und Kontaktaufnahme zur
            möglichen Vorbereitung einer selbstständigen Zusammenarbeit.
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </LegalSection>

        <LegalSection id="bereitstellung" title="8. Bereitstellung der Angaben">
          <p style={{ marginBottom: '0.75rem' }}>
            Die Bereitstellung der als Pflichtfelder gekennzeichneten Angaben ist erforderlich,
            damit wir Ihre Anfrage bearbeiten können. Ohne diese Angaben kann das jeweilige
            Formular nicht erfolgreich abgesendet beziehungsweise die Anfrage nicht bearbeitet
            werden. Nicht als Pflichtfeld gekennzeichnete Angaben sind freiwillig.
          </p>
          <p style={{ margin: 0 }}>
            Vor dem Absenden müssen Sie außerdem bestätigen, dass Sie diese Datenschutzerklärung
            zur Kenntnis genommen haben. Diese Bestätigung ist keine Einwilligung und keine
            eigenständige Rechtsgrundlage der Verarbeitung.
          </p>
        </LegalSection>

        <LegalSection id="technik" title="9. Technische Verarbeitung der Formulare">
          <SubSection title="9.1 Vercel">
            <p style={{ margin: 0 }}>
              Die Entgegennahme und serverseitige Verarbeitung der Formularanfragen erfolgt über
              die API-Plattform <Highlight>Vercel</Highlight>. Vercel verarbeitet die
              übermittelten Anfragedaten als technischer Betriebsdienstleister der API,
              einschließlich der für den Betrieb erforderlichen technischen Protokolle.
            </p>
          </SubSection>
          <SubSection title="9.2 Supabase">
            <p style={{ marginBottom: '0.75rem' }}>
              Die Anfragedaten werden in einer <Highlight>Supabase</Highlight>-Datenbank
              gespeichert. Der Zugriff erfolgt serverseitig, nicht über öffentlich freigegebene
              Datenbankzugänge im Browser. Die primäre Datenbankregion ist{' '}
              <Highlight>eu-central-1</Highlight>. Die Zuweisung einer EU-Datenbankregion bedeutet
              nicht, dass jede unterstützende technische Verarbeitung ausschließlich in der
              Europäischen Union stattfinden muss.
            </p>
            <p style={{ margin: 0 }}>
              Privat- und Unternehmensanfragen werden als Lead-Anfragen mit Kennzeichnung des
              Anfragetyps geführt. Partneranfragen werden getrennt davon gespeichert.
            </p>
          </SubSection>
          <SubSection title="9.3 Resend">
            <p style={{ margin: 0 }}>
              Zur operativen Bearbeitung einer neuen Anfrage wird eine interne
              Benachrichtigungs-E-Mail über den Dienst <Highlight>Resend</Highlight> an eine
              interne Betriebsadresse versendet. Inhalt sind die für die Bearbeitung
              erforderlichen Anfrageangaben in datensparsamem Umfang.
            </p>
          </SubSection>
        </LegalSection>

        <LegalSection id="keine-bestaetigung" title="10. Keine automatische Bestätigung an Absender">
          <p style={{ margin: 0 }}>
            Es wird <Highlight>keine</Highlight> automatische Bestätigungs-E-Mail an die im
            Formular angegebene E-Mail-Adresse versendet. Es erfolgt weder eine Kundenbestätigung
            noch eine Bestätigung an Partnerinteressenten per Transaktionsmail. Marketing- oder
            Newsletter-Mails werden über diesen Anfragepfad nicht ausgelöst.
          </p>
        </LegalSection>

        <LegalSection id="protokolle" title="11. Technische Protokolle und Missbrauchsschutz">
          <p style={{ marginBottom: '0.75rem' }}>
            Zu Nachvollziehbarkeit, Missbrauchsschutz und Betriebszwecken werden technische
            Ereignisse erfasst, beispielsweise zur Annahme einer Anfrage oder zur internen
            Benachrichtigung. Solche Einträge können Kennungen der Anfrage und technische
            Statusinformationen enthalten. Zusätzlich können Plattformprotokolle der eingesetzten
            Betriebsdienstleister anfallen.
          </p>
          <p style={{ margin: 0 }}>
            <Highlight>Rechtsgrundlage:</Highlight> Art. 6 Abs. 1 lit. f DSGVO.
          </p>
        </LegalSection>

        <LegalSection id="speicherung" title="12. Speicherfristen und Löschung">
          <p style={{ marginBottom: '0.75rem' }}>
            Für die in Supabase gespeicherten Anfragen sind derzeit folgende technische
            Speichereinstellungen vorgesehen (betriebliche Konfiguration, keine gesetzliche
            Vorgabe):
          </p>
          <BulletList
            items={[
              'Privat- und Unternehmensanfragen: 90 Tage',
              'Partneranfragen: 183 Tage',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            Nach Ablauf dieser technischen Fristen werden betroffene Datensätze automatisiert als
            gelöscht gekennzeichnet und stehen dem normalen Betrieb nicht mehr als aktive Anfragen
            zur Verfügung. Zusätzlich können Datensätze auf Anfrage anhand der E-Mail-Adresse und
            des Kanals entfernt werden.
          </p>
          <p style={{ margin: 0 }}>
            Technische Protokolldaten können länger oder getrennt von den Anfragedatensätzen
            vorgehalten werden, soweit dies für Nachvollziehbarkeit, Sicherheit oder gesetzliche
            Pflichten erforderlich ist. Eine Garantie der sofortigen physischen Löschung
            sämtlicher Kopien einschließlich Backups wird nicht gegeben.
          </p>
        </LegalSection>

        <LegalSection id="dienstleister" title="13. Eingesetzte Dienstleister und internationale Verarbeitung">
          <p style={{ marginBottom: '0.5rem' }}>
            Im Zusammenhang mit dem beschriebenen Ablauf können insbesondere folgende
            Dienstleister eingesetzt werden:
          </p>
          <BulletList
            items={[
              'Checkdomain – Hosting der öffentlichen Website',
              'Vercel – Betrieb der Formular-API',
              'Supabase – Datenbankspeicherung',
              'Resend – interne E-Mail-Benachrichtigung',
              'TELESON Vertriebs GmbH – soweit für die Tarifvermittlung im Handelsvertreterverhältnis erforderlich',
              'jeweilige Energieversorger – nur wenn ein Lieferverhältnis vermittelt oder angebahnt wird',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            Diese Dienstleister können im Rahmen ihrer technischen Leistung personenbezogene Daten
            verarbeiten. Vercel und Resend können personenbezogene Daten auch in den USA oder in
            anderen Staaten außerhalb der Europäischen Union und des Europäischen Wirtschaftsraums
            verarbeiten. Soweit eine solche Übermittlung nicht auf einem Angemessenheitsbeschluss
            beruht, können insbesondere die von der Europäischen Kommission erlassenen
            Standardvertragsklauseln als geeignete Garantie eingesetzt werden. Weitere
            Informationen zu den für eine konkrete Übermittlung maßgeblichen Garantien oder eine
            Kopie der einschlägigen Regelungen können Sie unter{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} /> anfordern.
          </p>
          <p style={{ margin: 0 }}>
            Die Angabe der primären EU-Datenbankregion bei Supabase bedeutet weiterhin nicht, dass
            sämtliche unterstützenden Verarbeitungen ausschließlich innerhalb der Europäischen
            Union stattfinden.
          </p>
        </LegalSection>

        <LegalSection
          id="rechte"
          title="14. Auskunft, Berichtigung, Löschung und weitere Betroffenenrechte"
        >
          <p style={{ marginBottom: '0.5rem' }}>
            Sie haben nach Maßgabe der gesetzlichen Vorschriften insbesondere folgende Rechte:
          </p>
          <BulletList
            items={[
              'Auskunft über die Sie betreffenden personenbezogenen Daten',
              'Berichtigung unrichtiger Daten',
              'Löschung, sofern die gesetzlichen Voraussetzungen vorliegen',
              'Einschränkung der Verarbeitung',
              'Datenübertragbarkeit, soweit die gesetzlichen Voraussetzungen vorliegen',
              'Widerspruch gegen bestimmte Verarbeitungen, soweit die gesetzlichen Voraussetzungen vorliegen',
              'Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft, soweit eine Verarbeitung ausnahmsweise auf Einwilligung beruht',
              'Beschwerde bei einer Datenschutzaufsichtsbehörde',
            ]}
          />
          <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            Zur Ausübung Ihrer Rechte wenden Sie sich bitte an{' '}
            <ObfuscatedEmail style={{ color: '#8E97A8', textDecoration: 'none' }} />. Wir
            bearbeiten Ihr Anliegen unverzüglich, spätestens innerhalb der gesetzlichen Fristen.
          </p>
          <SubSection title="Zuständige Aufsichtsbehörde">
            <p
              style={{
                margin: 0,
                paddingLeft: '1rem',
                borderLeft: '3px solid rgba(255,255,255,0.1)',
              }}
            >
              Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit
              Baden-Württemberg
              <br />
              Lautenschlagerstraße 20
              <br />
              70173 Stuttgart
              <br />
              Telefon: +49 711 615541-0
              <br />
              E-Mail: poststelle@lfdi.bwl.de
              <br />
              Website:{' '}
              <ExtLink href="https://www.baden-wuerttemberg.datenschutz.de">
                www.baden-wuerttemberg.datenschutz.de
              </ExtLink>
            </p>
          </SubSection>
        </LegalSection>

        <LegalSection id="altbestaende" title="15. Alte Google Apps Script- und Google Sheets-Datenbestände">
          <p style={{ marginBottom: '0.75rem' }}>
            Vor dem Umstellungspunkt dieses Website-Releases wurden Anfragen teilweise über Google
            Apps Script und Google Sheets entgegengenommen und gespeichert. Diese Altbestände
            werden durch den neuen Löschprozess nicht automatisch entfernt. Ob und wie historische
            Bestände migriert, archiviert oder gelöscht werden, ist eine gesonderte operative
            Entscheidung und nicht Gegenstand der automatischen Fristen des neuen Systems.
          </p>
          <p style={{ margin: 0 }}>
            Google Apps Script und Google Sheets sind nach diesem Release nicht mehr der
            vorgesehene aktive Intake-Pfad der öffentlichen Formulare.
          </p>
        </LegalSection>

        <LegalSection id="aenderungen" title="16. Änderungen dieser Datenschutzhinweise">
          <p style={{ margin: 0 }}>
            Wir passen diese Hinweise an, wenn sich der technische Ablauf, eingesetzte
            Dienstleister oder rechtliche Anforderungen ändern. Es gilt die jeweils auf{' '}
            <ExtLink href="https://www.deintarifheld.de/datenschutz/">
              www.deintarifheld.de/datenschutz/
            </ExtLink>{' '}
            veröffentlichte Fassung.
          </p>
        </LegalSection>
      </div>
    </div>
  )
}
