# ✅ reCAPTCHA Integration - QUICK START CHECKLIST

## 🎯 Status: Implementierung abgeschlossen ✅

Deine Tarifheld-Formulare haben jetzt eine professionelle **reCAPTCHA v3 Bot-Protection**.

---

## 📋 Sofort-Maßnahmen (KRITISCH)

### Es gibt nur EINEN manuellen Schritt:

1. **Google reCAPTCHA Admin öffnen**
   ```
   https://www.google.com/recaptcha/admin
   ```

2. **Secret Key kopieren**
   - Projekt: "deinTarifheld"
   - Bereich: "Secret Keys"
   - Kopiere den langen String (format: `6Le...qnZU`)

3. **Secret Key in Google Apps Script eintragen**
   - Öffne: https://script.google.com
   - Projekt: "deintarifheld - Lead Backend"
   - Zeile ~18 suchen:
     ```javascript
     RECAPTCHA_SECRET_KEY: '6Le4qjkqAAAAAKqhyujvyjxyKqnJkZJn0UDhXGjk',  // ← ERSETZEN
     ```
   - Den langen geheimen Schlüssel eintragen

4. **Bereitstellen (Deploy)**
   - Oben rechts: **"Bereitstellen" → "Neue Bereitstellung"**
   - Typ: Web-App
   - Alle ausführen als: Dein Google-Konto
   - Zugriff: "Jeder"
   - Deploy!

5. **Fertig! 🎉**
   - Deine Formulare sind jetzt geschützt
   - Verifiziere lokal: `npm run dev` → Test-Form → Browser Console prüfen

---

## 🔐 Sicherheits-Layers (was jetzt aktiv ist)

```
Nutzer trägt Form aus
    ↓
CLIENT-SIDE CHECKS:
  ✓ Honeypot-Botfalle
  ✓ Timing-Check (Form kann nicht in < 3s ausgefüllt werden)
  ✓ Rate-Limiting (max 1x pro 30s)
  ✓ Input-Sanitierung (XSS-schutz)
  ✓ reCAPTCHA v3 Token generiert ← NEU!
    ↓
SERVER-SIDE CHECKS (Google Apps Script):
  ✓ Payload-Größe geprüft
  ✓ Honeypot server-seitig geprüft
  ✓ Timing server-seitig geprüft
  ✓ DSGVO-Einwilligung geprüft
  ✓ reCAPTCHA Token validiert ← NEU! (Score prüfung: > 0.5)
  ✓ Server-side Rate Limiting geprüft
  ✓ Feld-Whitelist angewendet
  ✓ Duplikat-Erkennung
    ↓
SPEICHERN + EMAILS VERSENDEN
```

**Bots werden blockiert, aber bekommen eine Fake-Success-Nachricht** (um nicht zu wissen, dass sie erkannt wurden).

---

## 📊 Monitoring

Nach dem Deployment kannst du folgende Dinge überwachen:

### 1. Google reCAPTCHA Admin Panel
```
https://www.google.com/recaptcha/admin
→ Projekt "deinTarifheld"
→ Analytics
```
Zeigt:
- Requests über Zeit
- Score-Verteilung
- Blockierte Anfragen

### 2. Google Apps Script Logs
```
https://script.google.com
→ Projekt öffnen
→ "Ausführungen" tab
→ Neueste Runs checken
```
Suche nach:
- `reCAPTCHA Response:` (erfolgreiche Validierungen)
- `reCAPTCHA: Token valid` (durchgelassen)
- `REJECTED_RECAPTCHA` (blockierte Anfragen)

### 3. Google Sheets
Deine Lead-Sheets sollten weiterhin alle legitimen Leads enthalten.

---

## 🧪 Lokales Testing

```bash
# Dev-Server starten
npm run dev

# Oder mit Turbopack (schneller):
./node_modules/.bin/next dev --turbopack -p 3060
```

Öffne: `http://localhost:3060`

1. **Form ausfüllen und absenden** (mit Wartezeit > 3s)
2. **Browser Console öffnen** (F12)
3. **Solltest sehen**:
   ```
   [security.js] reCAPTCHA script loaded successfully
   [security.js] Token generated: eyJhbGc...
   ✅ Form submitted successfully
   ```
4. **Keine Error Messages** = ✅ Alles OK

### Fehlerbehandlung:
- **"reCAPTCHA script loading failed"**: Ad-Blocker oder Netzwerkfehler
  - Ad-Blocker: Disable für localhost:3000
  - Netzwerk: Firewall prüfen, `recaptcha.net` erlauben
  
- **"Failed to submit form"**: Google Apps Script entweder nicht bereitgestellt oder SECRET_KEY falsch
  - Deploy überprüfen
  - Secret Key in Zeile 18 prüfen

---

## 📁 Was wurde geändert?

### Frontend (Next.js)
- ✅ `lib/security.js`: `loadRecaptcha()`, `getRecaptchaToken()` Funktionen
- ✅ `components/sections/Hero.jsx`: reCAPTCHA Token in submitForm()
- ✅ `components/sections/FunnelSection.jsx`: reCAPTCHA Token in Step2 onSubmit()
- ✅ `components/sections/CareerSection.jsx`: reCAPTCHA Token in onSubmit()
- ✅ `.env.local`: RECAPTCHA_PUBLIC_KEY hinzugefügt

### Backend (Google Apps Script)
- ✅ `google-apps-script.js`:
  - `CFG.RECAPTCHA_SECRET_KEY` variable
  - `verifyRecaptchaToken()` Funktion
  - `doPost()` um Schritt 6 (reCAPTCHA Check) erweitert
  - `ALLOWED_FIELDS` um `_recaptchaToken` erweitert

### Dokumentation
- ✅ `RECAPTCHA_SETUP.md`: Vollständige Anleitung
- ✅ Dieser File: Quick-Start Checklist

---

## ❓ FAQ

**F: Kann ich den reCAPTCHA Score anpassen?**
A: Ja! In `google-apps-script.js` Zeile ~17:
```javascript
RECAPTCHA_MIN_SCORE: 0.5,  // 0.0-1.0, higher = stricter
```
Höher = strengerer, aber blockiert mehr legitime Nutzer.
Empfohlen: 0.5 (Standard)

**F: Ersetzt reCAPTCHA die anderen Sicherheits-Checks?**
A: Nein! reCAPTCHA ist nur EINE von 10+ Sicherheits-Ebenen.
Honeypot, Timing-Checks, Rate Limiting etc. laufen weiter.

**F: Können Nutzer das Token ablehnen (Datenschutz)?**
A: reCAPTCHA v3 ist invisible - es gibt keinen Dialog zum  Ablehnen.
Trotzdem: Privacy Policy muss aktualisiert werden (siehe RECAPTCHA_SETUP.md Punkt 8).

**F: Was wenn Google-API nicht erreichbar ist?**
A: Fail-Open-Strategie: Anfrage wird durchgelassen (legit-priorität).
Loggt: `reCAPTCHA validation error (fail open)`

**F: Speicherst du die reCAPTCHA Tokens?**
A: Nein! Tokens werden nach Validierung sofort verworfen.
Gespeichert: Nur true/false (blockiert oder erlaubt).

---

## 🚨 Troubleshooting

| Symptom | Lösung |
|---------|--------|
| Form wird IMMER blockiert | SECRET_KEY falsch eingegeben → Zeile 18 überprüfen |
| Logs zeigen "RECAPTCHA_SECRET_KEY nicht konfiguriert" | Placeholder nicht ersetzt → Copy-Paste Secret Key |
| "reCAPTCHA script loading failed" | Firewall blockiert `recaptcha.net` → Whitelist hinzufügen |
| Formulare funktionieren plötzlich nicht mehr | GAS nicht neu bereitgestellt → Schritt 4 wiederholen |
| Lokales Testing geht, aber Production blockiert | Domain nicht in reCAPTCHA Admin registriert → `www.deintarifheld.de` hinzufügen |

---

## 🎓 Weiterführende Ressourcen

- **reCAPTCHA Admin**: https://www.google.com/recaptcha/admin  
- **reCAPTCHA Docs**: https://developers.google.com/recaptcha
- **reCAPTCHA Best Practices**: https://developers.google.com/recaptcha/docs/v3
- **DSGVO + reCAPTCHA**: https://www.google.com/recaptcha/about (Privacy Tab)

---

## ✅ Deployment-Checkliste

- [ ] Secret Key kopiert
- [ ] Secret Key in google-apps-script.js eingefügt (Zeile ~18)
- [ ] Google Apps Script bereitgestellt (Deploy)
- [ ] Lokales Testing durchgeführt (npm run dev)
- [ ] Browser Console nach Errors checked
- [ ] Google reCAPTCHA Admin Analytics aufgerufen
- [ ] Produktions-Domain in reCAPTCHA Admin registriert
- [ ] Privacy Policy aktualisiert (reCAPTCHA erwähnen)
- [ ] Team informiert über neue Bot-Protection ✅

---

**Fertig!** 🎉 Deine Formulare sind jetzt mit reCAPTCHA v3 geschützt.

Bei Fragen: siehe RECAPTCHA_SETUP.md für ausführliche Dokumentation.
