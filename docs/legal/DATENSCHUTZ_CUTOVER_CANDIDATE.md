# Datenschutzerklärung — Production Cutover Candidate (technisch)

STATUS=LEGAL_APPROVAL_REQUIRED  
LIVE_PUBLISH_AUTHORIZED=NO  
DRAFT_FOR_CUTOVER=YES

Dieser Text ist **nicht** die live geschaltete Datenschutzerklärung.
Er beschreibt die technische Zielarchitektur nach dem öffentlichen Website-Cutover
auf die Phase-B-API und muss rechtlich geprüft werden, bevor Inhalte in
`app/datenschutz/page.js` übernommen und auf Checkdomain veröffentlicht werden.

## Formularzwecke

- Private Tarif-/Kontaktanfragen (`page_source`: hero-funnel / main_funnel, `lead_type`: private_energy)
- Unternehmensanfragen B2B (`page_source`: unternehmen, `lead_type`: business_energy)
- Karriere-/Bewerbungsanfragen textbasiert (`page_source`: career) — **keine Datei-Uploads** in diesem Stand

## Technische Empfänger / Auftragsverarbeitung (geplant nach Cutover)

- Website-Hosting: Checkdomain GmbH (statische Auslieferung)
- API-/Edge-Verarbeitung: Vercel (Projekt `deintarifheld-leads-api`)
- Datenbank: Supabase (Postgres), Zugriff ausschließlich serverseitig via Service Role
- Transaktionsmails: Resend — **nur** im tatsächlich freigegebenen Betriebsmodus:
  - `LEADS_MAIL_MODE=mock`: keine reale Zustellung (Speicherung + Audit dennoch möglich)
  - `LEADS_MAIL_MODE=live`: Versand über verifizierte Domain / freigegebene Absender-/Empfängeradressen
  - Temporärer Resend-Testdomain-Betrieb (`onboarding@resend.dev`) ist **kein** dauerhafter Produktionsmodus und nur an die Resend-Kontoadresse gebunden

## Ablösung Altverfahren

Der aktive Lead-Intake über Google Apps Script / Google Sheets soll für die
öffentlichen Formularstrecken nach Cutover nicht mehr genutzt werden.
Ob und wie Altbestände migriert, archiviert oder gelöscht werden, unterliegt einer
gesonderten rechtlichen/operativen Entscheidung. In diesem Kandidaten wird keine
Löschung historischer Sheets behauptet.

## Kategorien der Daten

- Kontaktdaten (Name, E-Mail, Telefon)
- Tarifbezogene Angaben (Anbieter, Verbrauch, PLZ, Energieart)
- Unternehmensdaten (Firma, Ansprechpartner, Verbrauchs-/Standortangaben)
- Bewerbungsfreitext (Motivation), ohne Lebenslauf-/Dateiupload
- Technische Metadaten (Zeitstempel, Seitenquelle, Idempotency-/Request-IDs, Audit Events)

## Speicherdauer / Retention

Keine neue konkrete Rechtsfrist wird hier behauptet.
Technisch konfigurierbar:

- `LEADS_RETENTION_DAYS` (Business, Default 90)
- `LEADS_PRIVATE_RETENTION_DAYS` (Privat, Default = Business-Default)
- `LEADS_CAREER_RETENTION_DAYS` (Karriere, Default 183)

Automatisierte Soft-Deletion inkl. Audit Event ist vorgesehen (Retention-Cron).
`LEGAL_APPROVAL_REQUIRED` für verbindliche Fristen und Betroffenenrechte-Texte.

## Betroffenenrechte (technisch vorbereitet)

Auskunft, Berichtigung, Löschung und Widerspruch bleiben rechtlich zu formulieren.
Technisch stehen Admin-Löschung (E-Mail + Kanal) und Retention-Cron zur Verfügung.

## Nicht Bestandteil dieses Kandidaten

- KI-Lead-Scoring / Priorisierung
- Marketing-Automation / Newsletter ohne Einwilligung
- Datei-Uploads / Lebensläufe
- DNS-/Domain-Änderungen
- Live-Mailfreigabe ohne gesonderte Ops-Entscheidung
- Veröffentlichung ohne Legal Approval
