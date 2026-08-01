# Datenschutzerklärung — Final Cutover Review (technisch)

STATUS=NOAH_AND_LEGAL_APPROVAL_REQUIRED  
LIVE_PUBLISH_AUTHORIZED=NO  
TECHNICAL_STATE=INTERNAL_LIVE_NOTIFICATION  
CUSTOMER_CONFIRMATION=OFF  
RESEND_DOMAIN_VERIFIED=NO

Dieser Text ist **nicht** die live geschaltete Datenschutzerklärung und ersetzt
keine Rechtsberatung. Er fasst den technischen Stand nach DTH-09C zusammen und
dient ausschließlich der Freigabeentscheidung durch Noah / Legal.

## A. Technisch belegte Tatsachen

- Öffentliche Website: Checkdomain-Static-Hosting (`www.deintarifheld.de` / Apex).
- Lead-/Career-API: Vercel-Projekt `deintarifheld-leads-api`
  (`https://deintarifheld-leads-api.vercel.app`).
- Datenbank: Supabase-Projekt `ylvczlldcgaxyadlawtb` (Service-Role nur serverseitig).
- Kanäle: Business (`business_energy`), Private (`private_energy`), Career
  (eigene Tabelle `career_applications`, keine Datei-Uploads).
- Mailvertrag (`LEADS_MAIL_MODE`):
  - `mock` — keine reale Zustellung
  - `fail` — kontrollierter Fehlerpfad
  - `internal_live` — genau eine interne Resend-Benachrichtigung, **keine**
    Kunden-/Bewerberbestätigung
  - `live` — interne + Kundenbestätigung (für späteren Domain-Betrieb; in DTH-09C
    nicht aktiviert)
- Temporärer Absenderpfad: Resend-Testdomain `onboarding@resend.dev` nur an die
  Resend-Kontoadresse (Account-Match nachgewiesen in Ops-Evidence, nicht in Git).
- Audit Events werden geschrieben (inkl. `*.internal_mail_sent` /
  `*.customer_confirmation_skipped` im temporären Modus).
- Retention-Cron und Admin-Löschung (E-Mail + Kanal) sind technisch vorhanden.
- Kein AI-Scoring, kein Newsletter-/Marketing-Versand im Leadpfad.
- Google Apps Script / Sheets sind nach Cutover **nicht** der vorgesehene aktive
  Leadpfad; Altbestände werden hier nicht migriert oder gelöscht.

## B. Rechtlich zu prüfende Formulierungen

- Zweckbindung und Rechtsgrundlagen je Kanal (Business / Private / Career)
- Betroffenenrechte-Texte (Auskunft, Berichtigung, Löschung, Widerspruch)
- Darstellung von Auftragsverarbeitern (Checkdomain, Vercel, Supabase, Resend)
- Hinweise zu Drittlandtransfers / Garantien, falls zutreffend
- Verbindliche Speicherdauern und Löschfristen
- Trennung Bewerbungsdaten vs. Tarif-/Unternehmensanfragen
- Klarstellung: keine automatische Kundenbestätigung im temporären Modus

## C. Offene Vertrags-/AVV-Nachweise

Ohne separate Evidence nicht behauptet vorhanden:

- AVV/DPA Checkdomain
- AVV/DPA Vercel
- AVV/DPA Supabase
- AVV/DPA Resend
- ggf. SCC / Transfer Impact Assessment

## D. Konkrete Änderungen gegenüber der Live-Datenschutzerklärung

Die derzeit öffentlich ausgelieferte Datenschutzerklärung (Checkdomain-Altbuild)
beschreibt den historischen Intake (u. a. Google-Apps-Script-/Sheets-Pfad) und
nicht den Phase-B-API-Pfad mit Supabase/Resend/`internal_live`.

Gegenüber dem Live-Text müssen später mindestens angepasst werden:

1. Empfänger / Auftragsverarbeiter (Checkdomain, Vercel, Supabase, Resend)
2. Formularzwecke inkl. getrennter Career-Speicherung
3. Wegfall von Google Apps Script / Sheets als aktivem Leadpfad
4. Temporärer interner Mailmodus ohne Kundenbestätigung (bis Domain-Verifikation)
5. Technische Speicherdauern / Retention-Hinweis (nach Legal-Freigabe)
6. Betroffenenrechte mit Verweis auf die tatsächlich verfügbaren Ops-Prozesse

## E. Exakter späterer Publish-Scope

Nur nach ausdrücklicher Freigabe (`LEGAL_TEXT_APPROVED=YES` + Hash) und im
separaten Workstream DTH-09D:

- Übernahme freigegebener Texte in `app/datenschutz/page.js` (und ggf. statische
  Spiegel)
- Merge des Cutover-Zweigs nach `main`
- `build:static:production` aus exaktem `origin/main`-SHA
- Checkdomain-Upload des freigegebenen Builds

**Nicht** im Publish-Scope dieses Reviews:

- DNS-/Domain-Änderungen
- Resend-Domain-Verifikation
- Aktivierung von `LEADS_MAIL_MODE=live` / Kundenbestätigungen
- Löschung historischer Google-Sheets-/Apps-Script-Bestände

## Quellen (technisch)

- `docs/legal/DATENSCHUTZ_CUTOVER_CANDIDATE.md`
- `docs/legal/DATENSCHUTZ_PHASE_B_DRAFT.md`
- `lib/leads/mail.js` (`internal_live`)
- `app/api/leads/route.js`, `app/api/careers/route.js`
- Cutover-Mail-Gate: `scripts/deploy/checkdomain/common.sh`
