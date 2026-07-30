# 🛡️ reCAPTCHA v3 Integration für deinTarifheld

## Status
✅ **Frontend**: Vollständig implementiert (Next.js)  
✅ **Backend**: Vollständig implementiert (Google Apps Script)  
⚠️ **SECRET_KEY**: Noch zu konfigurieren (manueller Schritt)  

---

## 1️⃣ reCAPTCHA Admin Console Setup

### Schritt 1: Google reCAPTCHA Admin Console öffnen
1. Gehe zu: https://www.google.com/recaptcha/admin
2. Melde dich mit deinem Google-Konto an

### Schritt 2: Projekt auswählen oder erstellen
- Falls es bereits ein deinTarifheld-Projekt gibt (mit dem PUBLIC_KEY `6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS`), öffne es
- Falls nicht, klicke auf **"Create" (+)** und:
  - **Label**: `deinTarifheld`
  - **reCAPTCHA Type**: `reCAPTCHA v3`
  - **Domains**: `deintarifheld.de`, `www.deintarifheld.de`, `localhost:3000` (für lokales Testing)
  - Speichern

### Schritt 3: SECRET_KEY kopieren
1. Öffne die Projekt-Keys
2. Suche den Bereich **"Secret Keys"** (nicht Public Key)
3. Kopiere den **Secret Key** (Format: `6Le...XpKZ`)

---

## 2️⃣ SECRET_KEY in der Anwendung konfigurieren

### Ort A: Google Apps Script (KRITISCH!)
1. Gehe zu: https://script.google.com
2. Finde das Projekt: **"Lead Backend (Google Apps Script)"**
3. Öffne `google-apps-script.js`
4. Suche nach Zeile ~18:
   ```javascript
   RECAPTCHA_SECRET_KEY: 'REDACTED_SET_VIA_SCRIPT_PROPERTIES',  // ← HIER
   ```
5. Ersetze den Placeholder mit deinem **echten Secret Key**:
   ```javascript
   RECAPTCHA_SECRET_KEY: 'REDACTED_SET_VIA_SCRIPT_PROPERTIES',
   ```
6. **Bereitstellen** (Deploy) und versionieren

### Ort B: .env.local (Frontend, optional)
Die Datei `/Users/noahbez/Desktop/deinTarifheld/.env.local` ist bereits konfiguriert:
```env
NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY=6LdE67EsAAAAABFJWHewSLoZxsXnFaH-DxW-SqjS
RECAPTCHA_SECRET_KEY=DEINE_SECRET_KEY_HIER  # ← Nur für Referenz, wird nicht in Next.js verwendet
```

---

## 3️⃣ Sicherheits-Pipeline (End-to-End)

### Frontend (React/Next.js)
```
Formular enthält Daten
     ↓
[1] Client-side Honeypot Check ✓
     ↓
[2] Client-side Timing Check (< 3s = Bot) ✓
     ↓
[3] Client-side Rate Limit (30s Pro-Form) ✓
     ↓
[4] Sanitierung (XSS, Injection) ✓
     ↓
[5] reCAPTCHA v3 Token Generierung ← NEU! ✓
     Token wird mitgesendet
     ↓
JSON-Payload → Google Apps Script
```

### Backend (Google Apps Script)
```
POST-Request empfangen
     ↓
[6] Payload-Größe prüfen ✓
     ↓
[7] Honeypot Check (server-seitig) ✓
     ↓
[8] Timing Check (server-seitig) ✓
     ↓
[9] DSGVO-Einwilligung ✓
     ↓
[10] ⭐ reCAPTCHA Token Validierung ← NEU!
     - Token an Google-API senden
     - Score prüfen (min. 0.5)
     - Falls Bot erkannt: Fake-Success zurück
     ↓
[11] Server-side Rate Limiting ✓
     ↓
[12] Feld-Whitelist anwenden ✓
     ↓
[13] Duplikat-Erkennung ✓
     ↓
[14] Speichern in Google Sheets ✓
     ↓
[15] Bestätigungsmail ✓
     ↓
[16] Admin-Notification ✓
```

---

## 4️⃣ Testing & Überwachung

### Lokal testen (port 3000/3005/3060)
```bash
# Dev-Server starten
npm run dev

# Oder mit Turbopack
./node_modules/.bin/next dev --turbopack -p 3060
```

Öffne: `http://localhost:3060`
- Formular ausfüllen und abschicken
- Browser Console prüfen (DevTools: F12)
- Sollte keine Fehler bei reCAPTCHA zeigen

### Google Apps Script Logs prüfen
1. https://script.google.com
2. Projekt öffnen → Ausführungen
3. Logs nach "⭐ reCAPTCHA" prüfen
4. Erwartete Logs:
   - `reCAPTCHA Response: { success: true, score: 0.X, ... }`
   - `✅ reCAPTCHA: Token valid, Score 0.95`

### Admin-Panel überwachen
Beim Google reCAPTCHA Admin Panel: https://www.google.com/recaptcha/admin
- **Analytics**: Zeigt alle Requests, Scores, blockierte Anfragen
- Score-Verteilung sollte sich um 0.8-0.9 bewegen (menschliche Benutzer)

---

## 5️⃣ Score-Interpretationen

```
Score  │ Bedeutung                    │ Aktion
────────┼──────────────────────────────┼────────────────
0.9 +   │ Definitiv ein Mensch         │ ✅ Zulassen
0.7 - 0.9 │ Wahrscheinlich ein Mensch   │ ✅ Zulassen
0.5 - 0.7 │ Neutral/Borderline          │ ⚠️  Warnung im Log
0.3 - 0.5 │ Wahrscheinlich ein Bot      │ ❌ Blockieren
0.0 - 0.3 │ Definitiv ein Bot            │ ❌ Blockieren
```

**Aktueller Threshold**: `RECAPTCHA_MIN_SCORE = 0.5`
(Konfigurierbar in `google-apps-script.js`)

---

## 6️⃣ Fehlerbehandlung

### Fall 1: Kein Token erhalten
```javascript
// Ursache: Older Client oder reCAPTCHA konnte nicht laden
// Aktion: Formular wird mit Warnung durchgelassen (fail-open Strategie)
// Log: "⚠️ Kein reCAPTCHA-Token erhalten"
```

### Fall 2: SECRET_KEY nicht konfiguriert
```javascript
// Ursache: CFG.RECAPTCHA_SECRET_KEY = 'DEINE_SECRET_KEY_HIER' (Placeholder)
// Aktion: Anfrage wird blockiert
// Log: "❌ FEHLER: RECAPTCHA_SECRET_KEY nicht konfiguriert!"
```

### Fall 3: Google-API nicht erreichbar
```javascript
// Ursache: Netzwerkfehler, Google-Timeout
// Aktion: Anfrage wird mit Warnung durchgelassen (fail-open)
// Log: "❌ reCAPTCHA Validierung Fehler: ..."
```

---

## 7️⃣ Sicherheits-Checkliste

- [ ] SECRET_KEY aus Admin Console kopiert
- [ ] SECRET_KEY in `google-apps-script.js` Zeile ~18 eingefügt
- [ ] Google Apps Script neu bereitgestellt (Deploy)
- [ ] Frontend `.env.local` PUBLIC_KEY korrekt eingestellt
- [ ] Lokales Testing durchgeführt (kein Error in Console)
- [ ] Admin-Panel Analytics überprüft
- [ ] Production Domain in reCAPTCHA Admin registriert
- [ ] DSGVO-Policy aktualisiert (reCAPTCHA erwähnen)

---

## 8️⃣ DSGVO Datenschutz-Hinweise

### Benutzer müssen informiert werden über:
1. **reCAPTCHA v3 von Google**
   - Invisible Bot-Protection
   - Analysiert Nutzerverhalten
   
2. **Datenfluss**:
   - Formular-Daten → Lokale Sanitierung → Google Apps Script
   - reCAPTCHA Token → Google reCAPTCHA API (reCAPTCHA Privacy Policy)

3. **Speichersicherheit**:
   - Tokens werden NICHT gespeichert (nur validiert)
   - Scores werden NICHT gespeichert (nur Score-Ergebnis: blockiert/erlaubt)
   - Form-Daten bleiben unverändert (wie vorher)

### Privacy Policy Update erforderlich:
```markdown
**Bot-Protection (reCAPTCHA v3)**:
Wir nutzen Google reCAPTCHA v3 zur Erkennung von Spam und Missbrauch.
Dabei werden keine persönlichen Daten erfasst; stattdessen analysiert 
Google automatisiert dein Nutzerverhalten, um zu unterscheiden zwischen 
echten Menschen und Bots. Die reCAPTCHA-Token werden nach der Verifizierung 
nicht gespeichert. Weitere Infos: [Google Privacy Policy](https://policies.google.com/privacy)
```

---

## 9️⃣ Häufige Probleme & Lösungen

| Problem | Ursache | Lösung |
|---------|--------|--------|
| "reCAPTCHA Script laden failed" | Ad-Blocker / Netzwerk | reCAPTCHA Domain whitelist-en: `recaptcha.net`, `google.com` |
| Formular wird immer blockiert | Score zu niedrig oder geringe Aktivität | Score-Threshold in GAS erhöhen (von 0.5 → 0.3) oder bei Google prüfen |
| Logs zeigen "Score zu niedrig" | Bot-verdächtige Aktivität erkannt | Normal; blockiert automatisch. Im Admin-Panel Analytics prüfen |
| Token-Gen funktioniert, aber 503-Fehler | SECRET_KEY falsch | Eine extra Stelle kopiert? Erneut prüfen und ggf. neu eintragen |
| "RECAPTCHA_SECRET_KEY nicht konfiguriert" | Placeholder nicht ersetzt | `google-apps-script.js` Zeile 18 überprüfen |

---

## 🔟 Architektur-Ordner

```
Frontend (Next.js 15)
├─ lib/security.js          ← loadRecaptcha(), getRecaptchaToken()
├─ components/sections/
│  ├─ Hero.jsx              ← submitForm() mit Token
│  ├─ FunnelSection.jsx      ← Step2 onSubmit() mit Token
│  └─ CareerSection.jsx      ← onSubmit() mit Token
└─ .env.local               ← NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY

Backend (Google Apps Script)
├─ google-apps-script.js
│  ├─ CFG.RECAPTCHA_SECRET_KEY     ← SECRET_KEY (KAN-KRITISCH!)
│  ├─ verifyRecaptchaToken()       ← Validierungs-Logik (NEU!)
│  ├─ doPost(e)                    ← Security-Pipeline mit Schritt 6
│  └─ ALLOWED_FIELDS               ← Enthält '_recaptchaToken' (NEU!)
```

---

✅ **Integration abgeschlossen!** Deine Formulare haben jetzt eine professionelle Bot-Protection mit Multi-Layer Security.

Fragen? Logs überprüfen oder Admin-Panel Analytics anschauen! 🚀
