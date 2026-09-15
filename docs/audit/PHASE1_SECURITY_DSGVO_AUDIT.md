# [DTH] Phase-1 Security / DSGVO Audit

**Status:** AUDIT ONLY — keine Produktfixes in diesem Workstream  
**Scope:** Sicherheit + DSGVO / Legal-text-vs-code. Keine Averion-Integration, keine Feature-Arbeit.  
**Repo-Stand:** `origin/main` @ `b21c2d9` (`fix(leads): harden lead intake mail status and admin auth`)  
**Datum:** 2026-09-12  
**Methode:** Code-Review (Auth, API, CORS, RLS-Migrationen, Mail, Legal-Pages, Headers, Secrets, Deps) + Ausführung der vorhandenen Offline-Tests + `npm audit`.  
**Nicht geprüft (kein Live-Zugriff):** Vercel-Env-Werte, echte `LEADS_MAIL_MODE`-Produktion, Supabase-Dashboard-RLS, AVV-Verträge, Google-Sheet-ACL, Checkdomain-Header in Produktion.

**Ready for Averion Anfragesystem integration? = NO**  
Gate: alle Critical- und High-Findings müssen zuerst geschlossen oder bewusst akzeptiert und rechtlich freigegeben sein.

---

## 1. Executive Summary

Das Lead-System ist **nicht ungesichert**, aber **nicht autonom-produktionsreif** für späteren Averion-Betrieb.

Was bereits senior-tauglich angelegt ist:

- Admin-Gate ist **fail-closed**, liest das Secret **nicht aus der Query-String**, und `CRON_SECRET` autorisiert **keine** Admin-Routen.
- Service-Role wird nur in Server-Routen verwendet; Client-Code importiert `@/lib/leads/supabase` nicht.
- CORS ist Allowlist ohne `*.vercel.app`-Wildcard.
- Mail-Default ist `mock`; unbekannte Modi fail-closed; `live` muss explizit gesetzt werden.
- Formular-Checkbox ist Kenntnisnahme, nicht Einwilligung — Formulartexte und `app/datenschutz/page.js` sind hier konsistent.
- `leadsLog` filtert E-Mail/Telefon/Secrets; Honeypot wird serverseitig ausgewertet.

Trotzdem ist das **Recht-jetzt-Gate (Sicherheit + DSGVO) nicht grün**:

1. **Bot-/Missbrauchsschutz ist überwiegend Client-Theater.** `_recaptchaToken` wird vom Browser geschickt, von der API **nicht verifiziert**. Origin/Referer dürfen fehlen. Timing greift nur, wenn der Client `_formLoadedAt` mitschickt. Rate-Limit ist In-Memory pro Serverless-Instanz.
2. **Admin ist ein geteiltes Bearer-Secret** ohne timing-safe Compare, ohne Brute-Force-Limit, ohne MFA. Inbox-HTML ist öffentlich; das Secret landet in `sessionStorage`.
3. **Vercel-API hat keine Security-Header** (`next.config.mjs` / `vercel.json`). Die öffentliche Inbox-HTML-Schale liegt ohne CSP/X-Frame-Options.
4. **Legal-text-vs-code ist an mehreren Stellen gebrochen.** AGB § 5 verspricht automatische Eingangsbestätigung mit Datenzusammenfassung; Code und Datenschutz § 10 tun das Gegenteil. reCAPTCHA (Google) und ProvenExpert werden geladen, stehen aber nicht in der Datenschutzerklärung. Cookie-Banner behauptet optionale Analyse und „keine Daten ohne Zustimmung an Dritte“.
5. **Löschung ist Soft-Delete.** `audit_events.detail` speichert die E-Mail bei Delete-by-Email. Alte Google-Sheets-Bestände (`google-apps-script.js`, feste Spreadsheet-ID) werden nicht angefasst.
6. **`npm audit`:** 1 Critical / 7 High / 1 Moderate / 1 Low, inkl. Next.js 15.5.14. Für dieses Hybrid-Setup (Static Checkdomain + API-Routen, kein Middleware, keine Server Actions) ist **kein unauthentifiziertes RCE/PII-Leak nachgewiesen**. Trotzdem kein Freigabe-Signal.

**Kein aktiv ausnutzbares Critical** mit kleinem, verhaltensneutralem Patch gefunden. Deshalb **keine Code-Härtung in Phase 1**.

---

## 2. Finding-Tabelle

Legende Severity: **Critical** = unauthentifizierter PII-/Secret-Zugriff oder triviales RCE. **High** = realistische Ausnutzung oder klare DSGVO-/Legal-Lücke. **Medium** = verstärkbar / Defense-in-depth. **Low** = Hygiene.

| ID | Severity | Area | Evidence | Risiko | Empfohlener Fix | LEGAL_REVIEW_REQUIRED |
|---|---|---|---|---|---|---|
| F-01 | High | Auth | `lib/leads/admin-auth.js` L10–16; `app/api/admin/leads/route.js`; `app/api/admin/leads/delete/route.js`; `app/api/cron/retention/route.js` L7–13 | Shared-Secret-Vergleich per `===` (kein `timingSafeEqual`). Kein Rate-Limit / Lockout auf Admin oder Cron. Schwaches Secret wäre online ratebar. Delete-by-Email ist mit demselben Secret vollständige Soft-Löschung. | `crypto.timingSafeEqual` nach Längen-Normalisierung; Mindestentropie erzwingen; Fail-closed belassen; Admin-Auth rate-limiten (z. B. 5/10min/IP); Cron- und Admin-Secrets getrennt und lang; optional IP-Allowlist / Vercel Protection. | NEIN |
| F-02 | Medium | Auth | `app/api/admin/inbox/route.js` (GET ohne Auth); `lib/leads/admin-inbox-html.js` L64–65, L123–160 | Inbox-Schale ist unauthentifiziert erreichbar (`/api/admin/inbox/`). Secret in `sessionStorage`. XSS auf dem API-Host würde das Ops-Secret lesen. | Inbox-HTML hinter dasselbe Admin-Gate; Secret nur im Speicher der Session, nicht `sessionStorage`; CSP; kurzes Idle-Timeout. | NEIN |
| F-03 | — (Kontrolle) | Auth | `lib/leads/admin-auth.js` L1–16; Tests `scripts/leads-admin-inbox-test.mjs`, `scripts/leads-duplicate-status-test.mjs` | **Kein Finding.** Fehlendes Secret → deny. Query-String wird nicht gelesen. `CRON_SECRET` wird in Admin-Code nicht referenziert. Tests bestätigen Isolation. | Beibehalten. Test ergänzen, der `request.url`/`searchParams` explizit auf Secret-Keys prüft (heutiger Test prüft nur Bearer-Suffix `?from=query`). | NEIN |
| F-04 | High | API | `app/api/leads/route.js` L107–146; `app/api/careers/route.js` L92–130; `lib/leads/validate-*.js` (kein Token-Check); `lib/leads/abuse-guard.js` L49–52, L101–116; Formulare senden `_recaptchaToken` | Serverseitig: kein reCAPTCHA-Verify. `isBlockedOrigin` lässt Requests **ohne** Origin/Referer durch (curl/Bot). `isTooFastSubmit` ist no-op, wenn `_formLoadedAt` fehlt. Rate-Limit 5/10min ist In-Memory, pro Instanz, mit Default-Salt `dth-leads-rl-v1`. | Server-Verify (reCAPTCHA Enterprise/v3 oder Alternative) **fail-closed** wenn Keys gesetzt; Origin-Policy für Browser-POSTs härten ohne Smoke-Tests zu brechen; Timing immer verlangen oder weglassen (kein halbes Control); verteiltes Rate-Limit (KV); eigenen Salt setzen. | JA (Google als Auftragsverarbeiter / Drittland, falls reCAPTCHA bleibt) |
| F-05 | Medium | CORS | `lib/leads/cors.js` L8–21; `lib/leads/abuse-guard.js` L12–30 | Produktions-API erlaubt `http://localhost:3000` / `127.0.0.1:3000` fest. Abuse-Guard erlaubt zusätzlich jedes `localhost:<port>`. CORS und Abuse-Guard sind nicht identisch. | Localhost nur wenn `VERCEL_ENV!==production` (oder eigenes Flag). Eine gemeinsame Allowlist-Funktion. | NEIN |
| F-06 | Medium | API | `app/api/leads/route.js` L124–132; analog careers | `content-length`-Cap 12 288 Bytes wird übersprungen, wenn Header fehlt/0. Danach `request.json()` ohne eigenes Byte-Limit. | Body immer über Readable-Stream mit hartem Limit lesen; fehlende/unechte Content-Length nicht vertrauen. | NEIN |
| F-07 | Medium | API | `lib/leads/cors.js` L36; `app/api/leads/route.js` L96–104 | CORS erlaubt Header `Authorization` auf öffentlichen Lead-Endpunkten. GET `/api/leads` / `/api/careers` ist unauthentifiziert und gibt `mailModeDefault` aus. | `Authorization` aus öffentlichen CORS-Allow-Headers entfernen. GET-Health ohne Mail-Mode oder hinter Ops. | NEIN |
| F-08 | — (Kontrolle, mit Rest-Risiko) | Secrets | `lib/leads/supabase.js` L3–9; nur API-Routen importieren das Modul; `.env.example` L4–5; `scripts/verify-static-production.mjs` L56–72 | Service-Role-Key ist **nicht** `NEXT_PUBLIC_*`. Client-Bundle-Import nicht vorhanden. **Aber:** URL heißt `NEXT_PUBLIC_SUPABASE_URL` (Footgun). Live-RLS nicht aus diesem Repo beweisbar. | URL auf `SUPABASE_URL` umbenennen; nach Deploy Static-Scan. Im Supabase-Dashboard: RLS an, **keine** anon-Policies, Service-Role nur Server. | NEIN |
| F-09 | Medium | Infra | `supabase/migrations/001_leads_phase_a.sql` L46–49; `002_leads_phase_b.sql` L75–91; `002` Header „Remote apply forbidden“ | Migrationen aktivieren RLS ohne Public-Policies und granten nur `service_role`. Ob das remote so gilt, ist hier **unbelegt**. Anon-Key im Client nicht gefunden. | Remote-Evidence: `\d+` / Policy-Dump. Kein `NEXT_PUBLIC_SUPABASE_ANON_KEY` im Frontend. | NEIN |
| F-10 | Medium | Mail | `lib/leads/mail.js` L403–485; `app/api/leads/route.js` L240–245; `.env.example` L15–19 | Default `mock` und unbekannte Werte fail-closed sind gut. `internal_live` und `live` senden echte PII-Mails. Ein Env-Tippfehler `live` aktiviert Kundenmails inkl. user-supplied Empfänger (E-Mail-Bombing / Legal-Bruch). GET verrät den Mode. | `live` zusätzlich an `ALLOW_CUSTOMER_MAIL=YES` koppeln. Mode nicht öffentlich echoen. Dual-Control für Prod-Env. | JA vor `live` |
| F-11 | High | PII | `lib/leads/supabase.js` L134–184, L187–277; `app/api/admin/leads/delete/route.js`; `app/api/cron/retention/route.js` L26–30 | Delete-by-Email und Retention setzen nur `status=deleted`. Payload/E-Mail bleiben in der Row. `writeAudit(..., detail.email)` persistiert die Adresse **nach** der Löschung. Inbox kann `includeDeleted=1` laden. | Hard-Delete oder Anonymisierung von `email`/`payload`/`full_name`/`firma` nach Legal-Frist; Audit nur Hash/lead_id; zweiter Job für physische Löschung; Backups in der Erklärung belassen. | JA |
| F-12 | Medium | Logging | `lib/leads/log.js` L16–41; `lib/leads/cors.js` L47–51 | Denylist deckt email/phone/message/secret, **nicht** name, firma, PLZ, IP, leadRef. Kommentar in `cors.js` („not PII“) ist falsch: `x-request-id` enthält die ersten 8 Zeichen der Client-IP. | Allowlist-Logging; Request-ID ohne IP (UUID). | NEIN |
| F-13 | High | PII | `lib/leads/mail.js` `buildInternalOpsMail` / `build*Mails`; `lib/leads/admin-inbox-html.js` L110–120 | Ops-Mail und Inbox enthalten absichtlich volle Anfrage-PII. Das ist betrieblich ok, aber: Shared Secret, keine Verschlüsselung at-rest jenseits Supabase, Resend-Inhalt = weiteres PII-Replikat. | Inbox + Mail auf Need-to-know; Resend-Retention prüfen; Admin-Zugang härten (F-01/F-02). | JA (Empfänger, Speicherdauer Resend) |
| F-14 | High | Consent | `components/ui/ProSealWidget.js` L54–79; `app/layout.js` L128–141; `components/ui/RecaptchaBox.jsx`; `components/ui/CookieBanner.jsx` L11–15, L33–41, L106–109 | ProvenExpert-Script wird **ohne** Consent geladen. reCAPTCHA lädt Google-Scripts auf Formularseiten unabhängig vom Banner. Banner speichert `analytics: true` in `localStorage`, `loadExternalScripts()` ist leer. Text: „keine Daten ohne deine Zustimmung an Dritte“. | Drittskripte hinter Consent **oder** als technisch notwendig begründen und im Datenschutz nennen. Banner-Text an reale Verarbeitung anpassen. Kein „Alle akzeptieren“, solange keine Analyse existiert. | JA (TTDSG/TDDDG + Art. 6 / Art. 13) |
| F-15 | High | Legal-text-vs-code | `app/agb/page.js` § 5 (2) L205–208; `app/datenschutz/page.js` § 10 L400–406; `lib/leads/mail.js` `internal_live` | AGB: automatische Eingangsbestätigung mit Auftragsnummer und Datenzusammenfassung. Datenschutz + Code: **keine** Kundenbestätigung. `forms:agb-privacy:test` prüft nur Checkbox≠Einwilligung, **nicht** § 5. | AGB § 5 an `internal_live` anpassen **oder** Code an AGB (dann `live` + Legal-Freigabe). | JA |
| F-16 | High | Legal-text-vs-code | `app/datenschutz/page.js` (kein reCAPTCHA, kein ProvenExpert, kein Cookie-/Analyse-Abschnitt); `docs/legal/DATENSCHUTZ_PUBLIC_PUBLISH_CANDIDATE.md` spiegelgleich | Art. 13 unvollständig zu Google reCAPTCHA und ProvenExpert. Dienstleisterliste (Abs. 13) nennt Checkdomain/Vercel/Supabase/Resend/TELESON, nicht Google/ProvenExpert. | Datenschutz um tatsächliche Empfänger, Zwecke, Drittland, Rechtsgrundlage ergänzen. Cookie-Banner und Texte angleichen. | JA |
| F-17 | Medium | Consent | `app/datenschutz/page.js` § 2–3, 8; Formulare `gdpr`/`dsgvo`; `docs/legal/DTH_09D_LEGAL_BASIS_DECISION_REGISTER.md` | Kenntnisnahme statt Einwilligung ist intern entschieden und in Formularen/Datenschutz/AGB § 6 weitgehend umgesetzt. Feldnamen `gdpr`/`consent_at` bleiben irreführend. | Feld semantisch belassen (Kompatibilität) oder umbenennen; Ops-Doku: `consent_at` = acknowledgement timestamp. | JA (nur wenn Umbenennung öffentlich wirkt) |
| F-18 | Medium | Legal-text-vs-code | `app/api/cron/retention/route.js` L26–30; `.env.example` L37–40; `app/datenschutz/page.js` § 12 | Defaults 90 / 90 / 183 Tage matchen den Datenschutz-Text. Wenn `CRON_SECRET` fehlt, ist Cron fail-closed → **keine** Löschung, Text wäre falsch. Soft-Delete ≠ „entfernt“. | Cron-Health/Alert; Secret Pflicht in Prod; Legal-Wortlaut „gekennzeichnet“ beibehalten, bis Hard-Delete existiert. | JA für verbindliche Fristen |
| F-19 | High | Infra | `next.config.mjs` (kein `headers()`); `vercel.json` nur Cron; `public/.htaccess` L23–30 | Checkdomain: nosniff, XFO DENY, Referrer-Policy, Permissions-Policy; **kein HSTS, kein CSP**. Vercel-API: **keine** dieser Header. Admin-Inbox und JSON-APIs ohne Clickjacking-/MIME-/Referrer-Schutz auf dem API-Host. | `headers()` in `next.config.mjs` für die API: `Content-Security-Policy` (Inbox), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. Checkdomain: HSTS + CSP. | NEIN |
| F-20 | Medium | Secrets | `google-apps-script.js` L12; `INTEGRATION_SUMMARY.md` L55; `RECAPTCHA_SETUP.md` L17, L50; `docs/legal/DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md` L18; `infra/checkdomain/config.example.env` L3–5 | Keine Service-Role-JWTs / Resend-Keys / Private Keys im aktuellen Tree (git-grep). **Wohl:** Google-Spreadsheet-ID, reCAPTCHA-Site-Key, Supabase-Projekt-Ref, Checkdomain-User + Remote-Pfad. Site-Keys sind öffentlich designed; Sheet-ID + historisches „anonymer Zugriff“ auf GAS ist Rest-Risiko für Alt-PII. | Sheet-ACL prüfen (nicht öffentlich); GAS deaktivieren; IDs aus Docs nehmen oder als öffentlich markieren; Hosting-User nicht ins Example, wenn vermeidbar. History: keine committed `.env`. CI-Secret-Scan ist zu schmal (`.github/workflows/dth-phase-a-ci.yml` L56–62). | JA für Altbestand-Sheets |
| F-21 | High | Deps | `package.json` L45–59; lock `next@15.5.14`; `npm audit` 2026-09-12: 10 Findings (1 critical, 7 high, 1 moderate, 1 low) | Next-Familie von npm als Critical geflaggt (u. a. RSC DoS, Middleware-Bypass, Image-Opt). Dieses Repo: **kein** `middleware`, **keine** `"use server"`, `images.unoptimized: true`, Public Site = Static Export. Axios liegt in `dependencies`, **wird nirgendwo importiert**, bringt eigene High-Advisories mit. | Gezieltes Next-Upgrade nach Compatibility-Check der API-Routen. Unused `axios` entfernen. `npm audit` in CI. Nicht blind `npm audit fix` auf main. | NEIN |
| F-22 | High | Deps / Theater | `lib/security.js` (gesamte Datei, Client); `INTEGRATION_SUMMARY.md` „Enterprise-Grade“, „99%+ Bot-Detection“; `components/business/BusinessForm.jsx` ohne `RecaptchaBox`; Hero/Funnel/Career/Unternehmen-legacy mit Client-Captcha | Client-Sanitize, Client-Honeypot, Client-Timing, Client-Rate-Limit sind umgehbar. Business-Form (`/unternehmen-neu`) hat **kein** Captcha, Legacy-Unternehmen schon — inkonsistent und beides ohne Server-Enforcement. | `lib/security.js` als UX belassen; Enforcement nur Server (F-04). INTEGRATION_SUMMARY als historisch markieren oder löschen. Captcha auf allen Kanälen gleich oder nirgends. | NEIN |
| F-23 | Medium | Infra | `app/layout.js` L120; JSON-LD L91–93 | Facebook-Domain-Verification-Meta ist kein Tracking-Pixel (Low). ProvenExpert `sameAs` + Widget = Verarbeitung. | Verification-Meta kann bleiben. Widget: F-14. | JA nur für ProvenExpert |
| F-24 | Medium | PII | `docs/legal/DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md` Abs. C; kein AVV im Repo | AVV/DPA Checkdomain, Vercel, Supabase, Resend, ggf. Google/ProvenExpert: im Repo **nicht** belegt. | Vertragsordner außerhalb Git; Audit nur „nicht nachgewiesen“. | JA |
| F-25 | Low | Deps | `package.json` axios, eslint@8 deprecated (npm ci Warnungen) | Tote/veraltete Tooling-Abhängigkeiten erhöhen die Advisory-Fläche. | Axios entfernen; ESLint 9 später, nicht in Phase-1-Security-Notfix. | NEIN |
| F-26 | Low | Logging | `lib/leads/admin-inbox-html.js` L38 Placeholder-Text `LEADS_ADMIN_SECRET` | Kein Secret-Wert, aber Endpoint-Entdeckung und Secret-Name. | Neutraler Placeholder. | NEIN |
| F-27 | Medium | API | `lib/leads/abuse-guard.js` vs `validate-*.js` honeypot | Honeypot-Felder werden serverseitig geprüft (positiv). Fake-`ok: true, bot: true` ohne Persistenz ist gut. Ohne Honeypot-Feld + ohne Timing + ohne Captcha bleibt der Pfad offen. | Teil von F-04. | NEIN |

---

## 3. Abdeckung der Pflichtpunkte

### 3.1 Admin-Auth

| Check | Ergebnis |
|---|---|
| Secret-Handling | Nur `LEADS_ADMIN_SECRET`. Header `Authorization: Bearer` oder `x-admin-secret`. |
| timing-safe compare? | **Nein.** |
| Query-String-Leakage | Code liest `searchParams` fürs Secret **nicht**. Inbox-Fetch nutzt nur Header. |
| Missing secret fail-closed? | **Ja.** `if (!secret) return false`. |
| CRON_SECRET als Admin? | **Nein.** Admin-Modul importiert `CRON_SECRET` nicht. Tests: `CRON_SECRET_ADMIN_DENIED=PASS`. |

### 3.2 Cron Retention

`authorized()` nur `CRON_SECRET` via Bearer oder `x-cron-secret`. Fail-closed. GET+POST. Retention-Tage aus Env, Defaults 90/90/183. Kein Admin-Bypass in die andere Richtung (Admin-Secret öffnet Cron nicht — separates Env).

### 3.3 Lead-APIs

Validierung mit Längen, E-Mail-Regex, Pflicht-Kenntnisnahme, Channel-Trennung, Career-Uploads rejected. Abuse-Guard + Honeypot **server**. Rate-Limit **schwach** (F-04). CORS Allowlist **ja**, inkl. Prod-Localhost (F-05).

### 3.4 Supabase Service Role

Nur Server. RLS in SQL ohne Public-Policies. Live-Anwendung **nicht** verifiziert. `NEXT_PUBLIC_SUPABASE_URL` ist Namens-Risiko, kein Key-Leak im aktuellen Client-Graph.

### 3.5 Mail-Modi

`mock` / `fail` / `internal_live` / `live` / sonst fail-closed. Tests: keine Kundenmail in `internal_live` (`CUSTOMER_CONFIRMATION_SEND_COUNT=0`). Accidental live = Env-Disziplin (F-10).

### 3.6 PII in Logs / Mails / Inbox

Logs: gute Denylist, Lücken bei Name/IP (F-12). Mails: volle Anfrage an intern (Absicht). Inbox: volle Payloads nach Auth (Absicht). Audit-Delete speichert E-Mail (F-11).

### 3.7 CookieBanner vs Tracking

Banner vorhanden, Analyse-Flag ohne Scripts. ProvenExpert + reCAPTCHA **nicht** an Consent gebunden. Datenschutz erwähnt beides nicht (F-14, F-16).

### 3.8 Retention vs Legaltexte; Delete-by-Email

Zahlen 90/183 stimmen mit `app/datenschutz` § 12 überein. Mechanisch: Soft-Delete + E-Mail im Audit. Skript `scripts/leads-delete-by-email.mjs` nutzt Admin-Bearer, nicht Cron. Alt-Sheets: explizit nicht abgedeckt (Datenschutz § 15).

### 3.9 Headers

Checkdomain `.htaccess`: Teilset, kein HSTS/CSP. Next/Vercel: **keine** Security-Header. Kein `middleware.js`.

### 3.10 Secrets im Repo

Keine committed `.env` / Service-Role / Resend-Key / SSH-Key. Upload-Skripte verbieten Passwort auf argv. Rest: Spreadsheet-ID, Site-Key, Hosting-User, Projekt-Ref (F-20).

### 3.11 Dependency- / Next-Haltung

Next 15.5.14, React 19. `npm audit` rot. Architektur reduziert viele Next-Server-CVEs, ersetzt aber kein Upgrade. Axios unused.

### 3.12 Client-Theater vs Server

`lib/security.js` = Browser only. Server erzwingt Validierung, Consent-Flag, Honeypot, schwaches Rate-Limit. **Nicht** erzwungen: Captcha, Client-Sanitize, Client-Cooldown.

---

## 4. Testdokumentation (ausgeführt 2026-09-12, nach `npm ci`)

| Script | npm | Ergebnis | Lücke |
|---|---|---|---|
| `leads:contract` | `scripts/leads-contract-test.mjs` | PASS | Statischer String-Match, kein Laufzeit-Abuse |
| `leads:admin:inbox` | `scripts/leads-admin-inbox-test.mjs` | PASS | Kein timing-safe; kein echter HTTP-Brute-Force |
| `leads:duplicate-status` | `scripts/leads-duplicate-status-test.mjs` | PASS | Cron≠Admin isoliert |
| `leads:mail:internal-live` | `scripts/leads-mail-internal-live-test.mjs` | PASS | Fetch gemockt; kein Live-Resend |
| `forms:privacy-semantics:test` | `scripts/form-privacy-semantics-test.mjs` | PASS | Keine AGB-§5-Mail-Aussage |
| `forms:agb-privacy:test` | `scripts/agb-privacy-consistency-test.mjs` | PASS | Nur Checkbox≠Einwilligung |
| `forms:career-partner:test` | `scripts/career-partner-copy-test.mjs` | PASS | Copy, keine Security |
| `browser-api:test` | `scripts/browser-api-contract-test.mjs` | PASS | URL-Normalisierung |
| `forms:intercept:test` | `scripts/form-request-intercept-test.mjs` | PASS | Kein GAS-Endpoint in Forms |
| `phase-b:verify` | aggregiert contract+admin+duplicate | PASS | — |
| CI `dth-phase-a-ci.yml` | contract-Job | nicht in dieser Session auf GitHub gelaufen | **CI enthält nicht** privacy-semantics, agb-privacy, career-partner, browser-api, intercept |
| `npm audit` | lockfile | 10 vulns (1 critical, 7 high, 1 moderate, 1 low) | Keine automatische Anwendbarkeitsprüfung je CVE |
| `leads:smoke*` / Live-Retention | brauchen Secrets/Netz | **nicht** ausgeführt | Absicht (Audit, kein Prod-Touch) |
| `verify:static:production` | braucht `out/` | **nicht** ausgeführt | Secret-Scan-Logik im Script ist gut, wenn Cutover gebaut wird |

**Fazit Tests:** Die vorhandenen Offline-Verträge sind grün und decken Mail-Modi, Admin≠Cron, Formular-Kenntnisnahme und GAS-Entkopplung ab. Sie **beweisen nicht** Server-Captcha, Header, Hard-Delete, timing-safe Auth, Live-RLS oder AGB§5↔Mail.

---

## 5. Top 10 Fix-Reihenfolge für Phase 2

1. **Server-Enforcement Missbrauch** — reCAPTCHA (oder Ersatz) serverseitig verify; verteiltes Rate-Limit; Timing/Origin ehrlich machen; Body-Size immer cappen. (F-04, F-06, F-22)
2. **Admin-Auth härten** — `timingSafeEqual`, Rate-Limit, Secret-Entropie, Inbox nicht öffentlich, kein `sessionStorage`. (F-01, F-02)
3. **Security-Header auf der Vercel-API** — CSP für Inbox, XFO, nosniff, Referrer, HSTS. (F-19)
4. **Legal-Pack** — AGB § 5 streichen/anpassen; Datenschutz um Google/ProvenExpert/Cookies/Resend-Inhalt; Cookie-Banner-Text. (F-15, F-16, F-14)
5. **Consent-Technik** — ProvenExpert und reCAPTCHA erst nach Opt-in **oder** rechtlich als erforderlich tragen und vollständig informieren. (F-14)
6. **Löschkonzept** — Soft-Delete → Anonymisierung/Hard-Delete; E-Mail aus `audit_events` entfernen; Cron-Monitoring. (F-11, F-18)
7. **Dependencies** — Next gezielt patchen; unused `axios` raus; `npm audit` in CI. (F-21, F-25)
8. **Altbestand** — GAS/Sheets-ACL, Deaktivierung, Legal zu historischen Daten. (F-20, Datenschutz § 15)
9. **Prod-CORS / Mail-Footguns** — kein Localhost in Prod-Allowlist; `live` doppelt schalten; GET ohne `mailModeDefault`. (F-05, F-07, F-10)
10. **Supabase-Live-Evidence + AVV** — Policy-Dump, kein Anon-Client, DPAs ablegen. (F-08, F-09, F-24)

Danach erst Averion-Schnittstelle (eigene Auth, eigene Zweckbindung, kein Service-Role im neuen Client).

---

## 6. Explizites Gate

```
READY_FOR_AVERION_INTEGRATION=NO
REASON=Critical/High not cleared (F-01, F-04, F-11, F-14, F-15, F-16, F-19, F-21, F-22)
PHASE1_CODE_PATCHES=NONE
ACTIVELY_EXPLOITABLE_CRITICAL_FOUND=NO
```

---

## 7. Annahmen vs. Fakten

**Fakten (Code/Tests):** siehe Evidence-Spalte und Abschnitt 4.

**Annahmen (ohne Live-Evidence):**

- Produktion nutzt `LEADS_MAIL_MODE=internal_live` laut älteren Legal-Reviews; aktueller Vercel-Wert hier unbekannt.
- Supabase-Projekt `ylvczlldcgaxyadlawtb` existiert noch; RLS remote entspricht den Migrationen.
- Checkdomain ausgeliefertes HTML entspricht dem aktuellen `app/datenschutz` / `app/agb` (Cutover-Docs widersprechen sich teilweise: `DATENSCHUTZ_CUTOVER_FINAL_REVIEW.md` sagt `LIVE_PUBLISH_AUTHORIZED=NO`, `DTH_09D_LEGAL_BASIS_DECISION_REGISTER.md` sagt `PUBLICATION_AUTHORIZED=YES`).
- Google-Sheet zur hardcoded ID ist nicht öffentlich — **muss operativ geprüft werden**.

**Nicht im Scope:** Averion-Anfragesystem, neue Features, Live-Writes, Secret-Rotation (außer Empfehlung).

---

## 8. Phase-2 Backlog (kurz, priorisiert)

| Prio | Item | Findings |
|---|---|---|
| P0 | Server-side abuse + body limit | F-04 F-06 F-22 |
| P0 | Admin timing-safe + rate-limit + inbox auth | F-01 F-02 |
| P0 | Vercel security headers | F-19 |
| P0 | AGB §5 + Datenschutz Drittanbieter + Banner | F-14 F-15 F-16 |
| P1 | Hard-delete / audit ohne E-Mail | F-11 F-18 |
| P1 | Next/axios audit remediation | F-21 F-25 |
| P1 | GAS/Sheets lock + CI secret scan erweitern | F-20 |
| P2 | CORS localhost / GET mailMode / live-guard | F-05 F-07 F-10 |
| P2 | Logging allowlist + request-id ohne IP | F-12 |
| P2 | Live RLS dump + AVV-Ordner | F-09 F-24 |
| P2 | Privacy-Tests um AGB-Mail und Header erweitern; CI erweitern | Abschn. 4 |

---

*Ende Phase-1-Audit. Keine Rechtsberatung. LEGAL_REVIEW_REQUIRED-Zeilen sind technische Hinweise an Legal/Noah, keine Freigabe.*
