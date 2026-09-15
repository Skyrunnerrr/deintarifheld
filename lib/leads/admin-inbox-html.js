/** Unauthenticated login shell. No inbox JS, no secret persistence. */
export const ADMIN_LOGIN_HTML = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>DeinTarifheld · Anfragen</title>
  <link rel="stylesheet" href="/ops/inbox-login.css">
</head>
<body>
  <div class="wrap">
    <h1>Anfragen-Eingang</h1>
    <p class="sub">Nur für den Betrieb. Das Geheimnis wird nicht im Browser gespeichert.</p>
    <!--ERR-->
    <form method="post" action="/api/admin/inbox/">
      <input id="secret" name="secret" type="password" autocomplete="current-password" placeholder="Ops-Geheimnis" required>
      <button type="submit">Anmelden</button>
    </form>
  </div>
</body>
</html>
`

/** Authenticated ops inbox. Data is loaded with the HttpOnly session cookie. */
export const ADMIN_INBOX_HTML = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>DeinTarifheld · Anfragen</title>
  <link rel="stylesheet" href="/ops/inbox.css">
</head>
<body>
  <div class="wrap">
    <h1>Anfragen-Eingang</h1>
    <p class="sub">Alle Felder, die die Person abgeschickt hat. Sitzung gilt nur für diesen Browser und läuft automatisch ab.</p>
    <div id="toolbar" class="bar">
      <button id="reload" class="secondary" type="button">Aktualisieren</button>
      <form method="post" action="/api/admin/inbox/" class="inline-form">
        <input type="hidden" name="action" value="logout">
        <button id="logout" class="secondary" type="submit">Abmelden</button>
      </form>
      <label class="filter"><input id="failedOnly" type="checkbox"> Nur Mail fehlgeschlagen</label>
      <span id="counts" class="sub counts"></span>
    </div>
    <div id="err" class="err" hidden></div>
    <div id="list"></div>
  </div>
  <script src="/ops/inbox.js" defer></script>
</body>
</html>
`
