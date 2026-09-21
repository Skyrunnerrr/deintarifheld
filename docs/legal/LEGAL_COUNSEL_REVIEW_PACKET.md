# DeinTarifheld — Review-Paket für qualifizierte Rechtsberatung

**Nur zur Prüfung durch qualifizierte deutsche Datenschutz-/Rechtsberatung.**  
Kein Rechtsgutachten. Keine Freigabe. Keine Geheimnisse.

| Feld | Wert |
|---|---|
| Repository | `Skyrunnerrr/deintarifheld` |
| PR | [#6](https://github.com/Skyrunnerrr/deintarifheld/pull/6) |
| SHA (Stand Erstellung) | `539d2189e0b2d007eb035fbe11400374ea2f1a41` |
| Datum der technischen Abstimmung | 2026-09-15 |
| Kundenmail | **AUS** (`ALLOW_CUSTOMER_MAIL=NO`, `LEADS_MAIL_MODE=internal_live`) |
| Live-Rechtstexte Checkdomain | **STALE** (Repo-Text noch nicht veröffentlicht) |
| Merge / Production-Release | **NEIN** |

---

## 1. Kurzüberblick

**Was das Angebot tut.** DeinTarifheld ist die öffentliche Website von Noah Bez für unverbindliche Strom-/Gas-Tarifanalyse und Vermittlung (Privat und Unternehmen) sowie Partneranfragen für eine selbstständige Zusammenarbeit. Es ist kein Energieversorger. Es gibt kein KI-Lead-Scoring und keine automatisierte Entscheidung mit Rechtswirkung im Code.

**Verantwortlicher / TELESON (so dokumentiert).** Verantwortlicher laut `app/datenschutz/page.js` und `app/agb/page.js`: Noah Bez, Lochheimer Str. 37, 69124 Heidelberg, selbständiger Vertriebspartner der TELESON Vertriebs GmbH / Handelsvertreter nach § 84 HGB. Ein etwaiger Energieliefervertrag kommt mit dem jeweiligen Versorger zustande. Eine automatisierte Weitergabe an TELESON oder Versorger ist im Repository **nicht** implementiert; manuelle operative Weiterleitung ist **UNKNOWN**.

**Architektur (verifiziert).**

- Öffentliche Website: statisch über Checkdomain (`https://deintarifheld.de`, `https://www.deintarifheld.de`).
- Formular-API: `https://deintarifheld-leads-api.vercel.app` (`/api/leads/`, `/api/careers/`).
- Speicherung: Supabase-Projekt `deintarifheld-phase-a` (serverseitig, Service-Role).
- Interne Ops-Mail: Resend, nur interne Betriebsadresse.
- Missbrauchsschutz: Standard Google reCAPTCHA v3 (nicht Enterprise) auf den Formularen.
- ProvenExpert: lokales Siegel ohne Netzwerkscript; externes Script nur nach optionaler Auswahl.

**Release-Status.** Technischer Code-Closure und faktische Text/Code-Ausrichtung im Repo: ja. Externe Anwaltsprüfung: **optional** (kein Merge-Blocker; keine erfundene Freigabe). Processor-/Transfernachweise: **PARTIAL**. Live-Rechtstexte: **veraltet**. Production-E2E: nicht ausgeführt. `PR6_MERGE_READY=YES`. `PRODUCTION_RELEASE_READY=NO`.

**Warum dieses Paket.** Es bleibt ein Eskalationsdokument, falls eine konkrete Rechtsfrage auftritt. Es ist **keine** Freigabe und **kein** Merge-Hindernis.

---

## 2. Genau diese öffentlichen Rechtstexte prüfen

| Datei | Route | Aufgabe |
|---|---|---|
| `app/datenschutz/page.js` | `/datenschutz` | Volltext Datenschutzerklärung (Quelle für den nächsten Checkdomain-Publish) |
| `app/agb/page.js` | `/agb` | Volltext AGB, insbesondere § 5 und § 6 |

Die derzeit **live** ausgespielten Checkdomain-Seiten entsprechen diesen Dateien **noch nicht**.

---

## 3. Wesentliche Textänderungen in PR #6 (Redline, kurz)

| Thema | Vorher (faktisch / live) | Jetzt im Repo |
|---|---|---|
| Google reCAPTCHA | Formulare nutzen es; Datenschutz nannte es nicht ausreichend | § 9.4: Standard v3, Missbrauchsschutz, Script/siteverify, keine Enterprise-Behauptung, keine erfundenen DPA/SCC/Fristen |
| ProvenExpert | Netzwerkscript-Verhalten nicht klar offengelegt | § 9.5: lokales Siegel ohne Script; `s.provenexpert.net` nur nach optionaler Banner-Auswahl |
| Browser-Speicher | `th_consent` / PE-Reload-Flag nicht benannt | § 12: `localStorage th_consent`, `sessionStorage dth_pe_withdraw_reload`; ausdrücklich keine HTTP-Cookies dieses Angebots |
| Aufbewahrung | Formulierung „als gelöscht gekennzeichnet“ | § 13: redigiert/minimiert; Zeile kann bleiben; `legal_hold` ausgenommen; keine rechtliche Anonymisierung |
| Rechte nach Redaktion | Lookup über Original-E-Mail impliziert | § 15: Zuordnung über die ursprüngliche E-Mail technisch nicht mehr möglich; gesetzliche Rechte unberührt |
| AGB § 5 | Versprechen automatischer Eingangsbestätigung / Auftragsnummer / Datenzusammenfassung | Kein vertraglicher Anspruch auf automatische Bestätigungsmail; Kontakt über angegebene Daten möglich |
| AGB § 6 | „TTDSG“ | „TDDDG (…; zuvor TTDSG)“ |

Kundenmail wurde **nicht** eingeschaltet, um die AGB anzupassen.

---

## 4. Technischer Datenfluss (nur belegte Fakten)

1. **Website-Aufruf.** Browser → Checkdomain. Mögliche Host-Zugriffsdaten (IP, Zeitpunkt, Ressource, User-Agent), soweit der Hoster sie erzeugt. Inhalt: statisches HTML/Assets.
2. **Formulare (Privat, Unternehmen, Partner).** Pflichtfelder + Kenntnisnahme-Checkbox (keine Einwilligung). Token von Google reCAPTCHA v3 wird erzeugt, sobald das Formular angezeigt wird — **unabhängig** vom Cookie-Banner. POST an die Vercel-API.
3. **reCAPTCHA.** Browser lädt `https://www.google.com/recaptcha/enterprise.js`. API prüft das Token über `https://recaptchaenterprise.googleapis.com/v1/projects/{PROJECT_ID}/assessments` (Token, Site Key, optional Request-IP/User-Agent, Action, Hostname, Score). CSP erlaubt zusätzlich u. a. `www.gstatic.com`, `www.recaptcha.net`.
4. **Vercel-API.** Entgegennahme, Origin-/Captcha-/Rate-Limit-Prüfungen, Speicherung, interne Mail, Retention-Cron.
5. **Supabase.** Leads und Partneranfragen getrennt; Audit-Ereignisse; gehashte Rate-Limit-Buckets. Zugriff nur serverseitig. Datenschutz nennt primäre DB-Region `eu-central-1`; das ist **nicht** unabhängig als Account-Region nachgewiesen.
6. **Resend.** Bei `internal_live` eine interne Ops-Mail mit Anfrageangaben. **Keine** Bestätigung an die Formular-E-Mail.
7. **ProvenExpert.** Ohne optionale Auswahl: nur lokales Siegel, kein `s.provenexpert.net`. Mit Auswahl: Netzwerkscript. Widerruf speichert die Auswahl, entfernt Script/DOM, ein kontrollierter Reload (`sessionStorage dth_pe_withdraw_reload`).
8. **TELESON / Versorger.** Kein automatisierter Codepfad. Datenschutz/AGB nennen eine Weitergabe nur soweit für ausdrücklich angefragte Tarifprüfung/Vertragsanbahnung erforderlich. Ob und wie das operativ geschieht: **UNKNOWN**.

Kein CRM, kein Averion, kein Newsletter-Pfad über diese Formulare.

---

## 5. Kundenmail — technische Wahrheit

| Steuerung | Belegter Stand |
|---|---|
| `LEADS_MAIL_MODE` | `internal_live` (human-verifiziert; Wert nicht gedruckt darüber hinaus) |
| `ALLOW_CUSTOMER_MAIL` | `NO` |
| Code-Doppelwächter | Kundenmail nur wenn Modus `live` **und** `ALLOW_CUSTOMER_MAIL=YES` (`customerMailDualGuardOpen`) |
| Automatische Kundenbestätigung | **Nein** |
| Was gesendet wird | Nur interne Ops-Benachrichtigung über Resend |
| Domain | `deintarifheld.de` bei Resend human-verifiziert |

Diese Steuerung darf für die Rechtsprüfung **nicht** geändert werden.

---

## 6. Aufbewahrung / Redaktion — technische Wahrheit

Code-Defaults in `app/api/cron/retention/route.js` (Betriebswerte können per Env ersetzt werden; gesetzliche Frist ist das nicht):

| Kanal | Env | Default |
|---|---|---|
| Privat | `LEADS_PRIVATE_RETENTION_DAYS` bzw. `LEADS_RETENTION_DAYS` | **90 Tage** |
| Unternehmen | `LEADS_RETENTION_DAYS` | **90 Tage** |
| Partner | `LEADS_CAREER_RETENTION_DAYS` | **183 Tage** |

Was der Cron tut: betroffene Zeilen **redigieren/minimieren** (E-Mail → gemeinsamer Platzhalter; Identitäts-/Kontakt-/Nachrichtenfelder entfernt; bei Unternehmen kann `firma` bleiben). Die Datenbankzeile kann weiter existieren. `legal_hold=true` wird übersprungen. Soft-Delete ist kein Hold. Code setzt `legal_hold` nicht automatisch. Das ist **keine** garantierte rechtliche Anonymisierung.

Admin-Löschung per Original-E-Mail ist nach Redaktion **nicht** verfügbar (Platzhalter ist geteilt und wird abgewiesen).

---

## 7. Auftragsverarbeitung / Drittland — Evidenzstand

Quelle: `docs/compliance/PROCESSOR_TRANSFER_EVIDENCE.md`.  
`GDPR_PROCESSOR_EVIDENCE=PARTIAL`. Öffentliche Vorlagen ≠ akzeptierter Vertrag.

| Stelle | Dokument öffentlich | Account akzeptiert | TIA | Region |
|---|---|---|---|---|
| Checkdomain | AVV-Pfad im Kundenbereich DOCUMENT_AVAILABLE | ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN |
| Vercel | DPA DOCUMENT_AVAILABLE (Text: Pro/Enterprise) | ACCOUNT_ACCEPTANCE_UNKNOWN; Plan UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN |
| Supabase | DPA DOCUMENT_AVAILABLE | ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN (Text nennt `eu-central-1`) |
| Resend | DPA DOCUMENT_AVAILABLE | ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN |
| Google reCAPTCHA Enterprise Assessment | Cloud-DPA existiert; Account-Akzeptanz **nicht** nachgewiesen | ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN |
| ProvenExpert | Datenschutzerklärung DOCUMENT_AVAILABLE; kein AVV-URL in der Recherche | ACCOUNT_ACCEPTANCE_UNKNOWN | TIA_UNKNOWN | REGION_UNKNOWN |
| TELESON / Versorger | — | UNKNOWN | TIA_UNKNOWN | UNKNOWN |

---

## 8. Prüfbitte an die Beratung (bitte entscheiden / bestätigen)

1. Sind die in § 3 der Datenschutzerklärung genannten Art.-6-Grundlagen für die beschriebenen Vorgänge angemessen?
2. Ist der Einsatz und die Offenlegung von reCAPTCHA v3 Enterprise Assessment in dieser Konfiguration (Formularladung ohne Banner-Steuerung, Assessment-API) rechtlich tragfähig?
3. Reichen Implementierung und Offenlegung von ProvenExpert (lokal vs. Netzwerkscript nach optionaler Auswahl)?
4. Sind die Angaben zu `localStorage` / `sessionStorage` und die Benennung TDDDG (zuvor TTDSG) in AGB § 6 angemessen?
5. Sind die betrieblichen Fristen 90 / 90 / 183 und die Redaktions-/Minimierungsformulierung akzeptabel?
6. Ist die Formulierung zu Betroffenenrechten nach Redaktion (keine technische Zuordnung über die alte E-Mail) akzeptabel, ohne gesetzliche Rechte zu verkürzen?
7. Reicht die bedingte TELESON-/Versorger-Offenlegung trotz fehlendem automatisierten Codepfad?
8. Welche AVV-/SCC-/TIA-Schritte sind **vor Veröffentlichung** zwingend, welche dürfen nachgezogen werden?
9. Sind AGB § 5 (keine automatische Bestätigungsmail) und § 6 akzeptabel?
10. Gibt es **zwingende** Text- oder Prozessänderungen vor der Veröffentlichung auf Checkdomain?

---

## 9. Entscheidungsfeld (nur durch die Beratung ausfüllen)

Nicht vorausgefüllt. Keine Freigabe durch Engineering.

```
LEGAL_REVIEW_DECISION=
APPROVED_WITHOUT_CHANGES=
APPROVED_WITH_CHANGES=
BLOCKED=
REQUIRED_CHANGES=
COUNSEL_NAME=
REVIEW_DATE=
```

---

## 10. Begleitdokumente im Repository

| Datei | Nutzen |
|---|---|
| `docs/compliance/LEGAL_ALIGNMENT_MATRIX.md` | Text/Code-Abgleich, MATCH/UNKNOWN |
| `docs/compliance/PROCESSOR_TRANSFER_EVIDENCE.md` | Vendor-Dokumente vs. Account-Evidenz |
| `docs/compliance/RECAPTCHA_DATA_FLOW.md` | Technischer reCAPTCHA-Fluss |
| `docs/compliance/COOKIE_CONSENT_TECH.md` | Banner steuert nur ProvenExpert, nicht reCAPTCHA |
| `docs/deployment/PRODUCTION_READINESS_MASTER_GATE.md` | Release-Gates; Merge bereit, Production-Release nicht |

**Nächster sicherer Schritt:** dieses Paket an qualifizierte Beratung senden. Nicht mergen. Nicht deployen. Kundenmail auslassen.
