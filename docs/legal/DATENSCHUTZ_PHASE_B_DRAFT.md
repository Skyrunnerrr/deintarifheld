# Datenschutzerklärung — Phase-B-Entwurf (technisch)

DRAFT=YES
STATUS=LEGAL_REVIEW_REQUIRED

Dieser Entwurf ist **nicht** die live geschaltete Datenschutzerklärung.
Er beschreibt die geplante technische Verarbeitungsarchitektur nach Phase B
und muss rechtlich geprüft werden, bevor Inhalte in `app/datenschutz/page.js`
übernommen werden.

## Zweck der Formularverarbeitung

- Private Tarif-/Kontaktanfragen
- Unternehmensanfragen (B2B)
- Karriere-/Bewerbungsanfragen (textbasiert, ohne Datei-Upload in Phase B)

## Technische Empfänger / Auftragsverarbeitung (geplant)

- Hosting/Edge: Vercel
- Datenbank: Supabase (Postgres), Zugriff ausschließlich serverseitig via Service Role
- Transaktionsmails: Resend (in Phase B weiterhin `LEADS_MAIL_MODE=mock`, kein Live-Versand in diesem Workstream)

## Abgrenzung zu Altverfahren

Die bisher dokumentierte Verarbeitung über Google Sheets / Google Apps Script
soll für die Phase-B-Strecken nicht weiter als aktives Backend genutzt werden.
Ob und wie Altbestände migriert oder gelöscht werden, unterliegt einer
gesonderten rechtlichen/operativen Entscheidung.

## Kategorien der Daten

- Kontaktdaten (Name, E-Mail, Telefon)
- Tarifbezogene Angaben (Anbieter, Verbrauch, PLZ, Energieart)
- Unternehmensdaten (Firma, Ansprechpartner, Verbrauchs-/Standortangaben)
- Bewerbungsfreitext (Motivation), ohne Lebenslauf-/Dateiupload in Phase B
- Technische Metadaten (Zeitstempel, Seitenquelle, Idempotency-/Request-IDs, Audit Events)

## Speicherdauer / Retention

Keine neue konkrete Rechtsfrist wird hier behauptet.
Technisch konfigurierbar über Environment:

- `LEADS_RETENTION_DAYS` (Business, Default 90)
- `LEADS_PRIVATE_RETENTION_DAYS` (Privat, Default = Business-Default)
- `LEADS_CAREER_RETENTION_DAYS` (Karriere, Default 183)

Automatisierte Soft-Deletion inkl. Audit Event ist vorgesehen.
`LEGAL_REVIEW_REQUIRED` für verbindliche Fristen und Betroffenenrechte-Texte.

## Betroffenenrechte

Auskunft, Berichtigung, Löschung und Widerspruch bleiben rechtlich zu
formulieren. Technisch stehen Admin-Löschung (E-Mail + Kanal) und Retention
Cron zur Verfügung.

## Nicht Bestandteil dieses Entwurfs

- KI-Lead-Scoring / Priorisierung
- Marketing-Automation / Newsletter ohne Einwilligung
- Datei-Uploads / Lebensläufe
- DNS-/Domain-Änderungen
- Live-Mailfreigabe
