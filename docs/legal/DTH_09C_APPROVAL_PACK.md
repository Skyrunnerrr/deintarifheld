# DTH-09C Legal Approval Pack

STATUS=NOAH_AND_LEGAL_APPROVAL_REQUIRED  
LIVE_PUBLISH_AUTHORIZED=NO  
CURSOR_MUST_NOT_SELF_APPROVE=YES

## 1. Kurzbeschreibung des neuen Datenflusses

Formulare (Business / Private / Career) senden an die Vercel-API
`deintarifheld-leads-api`. Die API speichert in Supabase, schreibt Audit Events
und versendet im temporären Modus `LEADS_MAIL_MODE=internal_live` genau eine
interne Ops-Mail über Resend. An die Formular-E-Mail-Adresse wird keine
Bestätigung gesendet.

## 2. Eingesetzte Anbieter

| Rolle | Anbieter |
|---|---|
| Öffentliche Website | Checkdomain (Static) |
| API / Edge | Vercel (`deintarifheld-leads-api`) |
| Datenbank | Supabase |
| Transaktionsmail (temporär intern) | Resend (`onboarding@resend.dev` → Resend-Kontoadresse) |

## 3. Verarbeitete Datenkategorien

- Kontaktdaten (Name/Ansprechpartner, E-Mail, Telefon)
- Tarif-/Verbrauchs-/PLZ-Angaben (Private/Business)
- Unternehmensdaten (Firma, Energieart, optional weitere Felder)
- Bewerbungsfreitext (Motivation, gekürzt in interner Mail), ohne Datei-Upload
- Technische Metadaten (Zeitstempel, Seitenquelle, Idempotency-/Audit-IDs)

## 4. Technische Speicherdauern

Konfigurierbar, rechtlich noch freizugeben:

- `LEADS_RETENTION_DAYS` (Business, Default 90)
- `LEADS_PRIVATE_RETENTION_DAYS` (Default = Business)
- `LEADS_CAREER_RETENTION_DAYS` (Default 183)

Automatisierte Soft-Deletion inkl. Audit ist vorbereitet.

## 5. Business-/Private-/Career-Unterscheidung

- Business + Private: Tabelle `leads` mit `lead_type`
- Career: Tabelle `career_applications`, `fileUploads=false`
- Alle Kanäle nutzen denselben Mailmodus-Vertrag (`sendLeadEmails`)

## 6. Temporärer Resend-Modus

`LEADS_MAIL_MODE=internal_live`:

- eine interne Benachrichtigung
- Absender typischerweise `DeinTarifheld <onboarding@resend.dev>`
- Empfänger = nachgewiesene Resend-Konto-E-Mail
- `VERIFIED_CUSTOM_DOMAIN=NO`
- Follow-up: Domain-Verifikation `deintarifheld.de` vor Kundenmails

## 7. Keine Kundenbestätigung

Im temporären Modus:

- `CUSTOMER_CONFIRMATION=OFF`
- Audit `*.customer_confirmation_skipped`
- Response-Feld `customerConfirmation: "skipped"`

## 8. Offene AVV-/DPA-Punkte

Nachweise für Checkdomain, Vercel, Supabase, Resend (inkl. ggf. Transfers)
sind separat zu führen. Dieses Pack behauptet keine abgeschlossenen Verträge.

## 9. Exakte Textänderungen für die Live-Seite

Nach Freigabe in die Live-Datenschutzerklärung übernehmen (Inhalt aus
`DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md`, Abschnitte A–E, rechtlich redigiert):

- Auftragsverarbeiter / Empfänger
- Formularzwecke und Career-Trennung
- Ablösung Google Apps Script/Sheets als aktiver Leadpfad
- Temporärer interner Mailmodus ohne Kundenbestätigung
- Retention / Betroffenenrechte (nach Legal-Wortlaut)

## 10. Publish-Scope (Dateiliste, später)

Nur nach `LEGAL_TEXT_APPROVED=YES` und DTH-09D:

- `app/datenschutz/page.js` (freigegebener Text)
- ggf. statische Spiegel unter `public/` falls vorhanden
- daraus erzeugter Checkdomain-Static-Build aus gemergtem `main`

Nicht im Scope: DNS, Resend-Domain, `LEADS_MAIL_MODE=live`, Sheet-Löschungen.

## 11. Hash des finalen Review-Dokuments

```text
LEGAL_REVIEW_DOCUMENT=docs/legal/DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md
LEGAL_REVIEW_DOCUMENT_SHA256=dbed95b2348da769d141e3a305317655906ff82414fc20c10c42e88ac8b563f4
```

Bei inhaltlicher Änderung des Review-Dokuments muss dieser Hash neu berechnet
und hier aktualisiert werden, bevor Freigabe erteilt wird.

## 12. Freigabe-Token (nur Noah)

Cursor setzt dieses Token **nicht**.

```text
LEGAL_TEXT_APPROVED=YES
LEGAL_REVIEW_DOCUMENT_SHA256=dbed95b2348da769d141e3a305317655906ff82414fc20c10c42e88ac8b563f4
GO_DTH_09D_PUBLIC_CUTOVER=YES
```
