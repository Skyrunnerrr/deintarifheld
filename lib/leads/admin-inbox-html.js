/** Ops inbox shell. No secrets, no lead rows. Data is loaded after Bearer auth. */
export const ADMIN_INBOX_HTML = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>DeinTarifheld · Anfragen</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #152033; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 28px 16px 64px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    .sub { color: #5b6578; margin: 0 0 20px; line-height: 1.45; }
    .bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 0 0 20px; }
    [hidden] { display: none !important; }
    input, button, select { font: inherit; }
    input[type=password] { flex: 1; min-width: 200px; padding: 10px 12px; border: 1px solid #c5ccd6; border-radius: 8px; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; background: #0a5adb; color: #fff; cursor: pointer; }
    button.secondary { background: #e8edf3; color: #152033; }
    .err { background: #fff1f0; border: 1px solid #f5c2c0; color: #8a1f1b; padding: 10px 12px; border-radius: 8px; margin: 0 0 16px; }
    .card { background: #fff; border: 1px solid #d7dce3; border-radius: 12px; padding: 16px 18px; margin: 0 0 12px; }
    .card.mail-failed { border-color: #c0392b; background: #fff6f5; }
    .card h2 { font-size: 16px; margin: 0 0 8px; }
    .meta { color: #5b6578; font-size: 13px; margin: 0 0 12px; }
    .mail-failed .meta, .badge-failed { color: #8a1f1b; font-weight: 700; }
    label.filter { font-size: 14px; color: #152033; display: inline-flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; padding: 5px 10px 5px 0; font-size: 14px; }
    th { color: #5b6578; font-weight: 600; width: 180px; }
    .empty { color: #5b6578; padding: 24px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Anfragen-Eingang</h1>
    <p class="sub">Alle Felder, die die Person abgeschickt hat. Nur mit Ops-Geheimnis. Liegt auf der API, nicht auf der öffentlichen Website.</p>
    <div id="gate" class="bar">
      <input id="secret" type="password" autocomplete="current-password" placeholder="LEADS_ADMIN_SECRET">
      <button id="open" type="button">Anfragen laden</button>
    </div>
    <div id="toolbar" class="bar" hidden>
      <button id="reload" class="secondary" type="button">Aktualisieren</button>
      <button id="logout" class="secondary" type="button">Abmelden</button>
      <label class="filter"><input id="failedOnly" type="checkbox"> Nur Mail fehlgeschlagen</label>
      <span id="counts" class="sub" style="margin:0"></span>
    </div>
    <div id="err" class="err" hidden></div>
    <div id="list"></div>
  </div>
  <script>
    const HIDE = new Set(['website_url','company_fax','companyWebsite','fax_number','_formLoadedAt','honeypot'])
    const LABELS = {
      firma: 'Firma', ansprechpartner: 'Ansprechpartner', email: 'E-Mail',
      telefon: 'Telefon', phone: 'Telefon', plz: 'PLZ', zip: 'PLZ',
      energieart: 'Energieart', type: 'Tarifart', verbrauchStrom: 'Verbrauch Strom',
      verbrauchGas: 'Verbrauch Gas', usage: 'Verbrauch', standorte: 'Standorte',
      versorger: 'Versorger', provider: 'Anbieter', vertragslaufzeit: 'Vertragslaufzeit',
      nachricht: 'Nachricht', firstName: 'Name', name: 'Name', motivation: 'Motivation',
      page_source: 'Kanal', source_page: 'Quelle', lead_type: 'Typ',
      form_version: 'Formularversion', dsgvo: 'Einwilligung'
    }
    const KEY = 'dth_admin_secret'
    const $ = (id) => document.getElementById(id)
    function showErr(msg) {
      const el = $('err')
      el.hidden = !msg
      el.textContent = msg || ''
    }
    function label(key) { return LABELS[key] || key }
    function rowsFromPayload(payload) {
      const data = payload && typeof payload === 'object' ? payload : {}
      return Object.keys(data).filter((k) => !HIDE.has(k) && data[k] !== '' && data[k] != null)
        .map((k) => '<tr><th>' + esc(label(k)) + '</th><td>' + esc(fmt(data[k])) + '</td></tr>').join('')
    }
    function esc(value) {
      return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }
    function fmt(value) {
      if (value === true) return 'ja'
      if (value === false) return 'nein'
      return String(value)
    }
    function when(iso) {
      try { return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) } catch { return iso || '' }
    }
    function titleOf(item) {
      if (item.kind === 'career') return 'Karriere · ' + (item.full_name || item.email || item.application_ref)
      if (item.page_source === 'unternehmen') return 'Unternehmen · ' + (item.firma || item.email || item.lead_ref)
      return 'Privat · ' + ((item.payload && item.payload.firstName) || item.email || item.lead_ref)
    }
    let allItems = []
    let lastCounts = { leads: 0, careers: 0 }
    function mailStatusOf(item) {
      const raw = typeof item.mail_status === 'string' ? item.mail_status.trim() : ''
      if (raw === 'failed' || raw === 'internal_sent' || raw === 'accepted') return raw
      return 'unknown'
    }
    function isFailed(item) { return mailStatusOf(item) === 'failed' }
    function render() {
      const failedOnly = $('failedOnly').checked
      const items = failedOnly ? allItems.filter(isFailed) : allItems
      const failedCount = allItems.filter(isFailed).length
      $('counts').textContent = lastCounts.leads + ' Anfragen · ' + lastCounts.careers + ' Bewerbungen · ' + failedCount + ' Mail fehlgeschlagen'
      if (!items.length) {
        $('list').innerHTML = '<p class="empty">' + (failedOnly ? 'Keine fehlgeschlagenen Mails.' : 'Keine Einträge.') + '</p>'
        return
      }
      $('list').innerHTML = items.map((item) => {
        const ref = item.lead_ref || item.application_ref || ''
        const extra = rowsFromPayload(item.payload)
        const status = mailStatusOf(item)
        const failed = status === 'failed'
        return '<article class="card' + (failed ? ' mail-failed' : '') + '"><h2>' + esc(titleOf(item)) + '</h2>' +
          '<p class="meta' + (failed ? ' badge-failed' : '') + '">' + esc(ref) + ' · ' + esc(when(item.created_at)) + ' · Mail ' + esc(status) + '</p>' +
          '<table>' +
          '<tr><th>E-Mail</th><td>' + esc(item.email || '') + '</td></tr>' +
          extra +
          '</table></article>'
      }).join('')
    }
    async function load() {
      const secret = sessionStorage.getItem(KEY) || $('secret').value.trim()
      if (!secret) { showErr('Geheimnis fehlt.'); return }
      showErr('')
      const res = await fetch('/api/admin/leads/', {
        headers: { authorization: 'Bearer ' + secret }
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        showErr(json.code === 'unauthorized' ? 'Geheimnis falsch oder nicht gesetzt.' : (json.code || 'Laden fehlgeschlagen'))
        return
      }
      sessionStorage.setItem(KEY, secret)
      $('gate').hidden = true
      $('toolbar').hidden = false
      allItems = [
        ...(json.leads || []).map((row) => ({ ...row, kind: 'lead' })),
        ...(json.careers || []).map((row) => ({ ...row, kind: 'career' })),
      ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      lastCounts = { leads: (json.leads || []).length, careers: (json.careers || []).length }
      render()
    }
    $('open').onclick = load
    $('reload').onclick = load
    $('failedOnly').addEventListener('change', render)
    $('logout').onclick = () => {
      sessionStorage.removeItem(KEY)
      $('secret').value = ''
      $('failedOnly').checked = false
      allItems = []
      lastCounts = { leads: 0, careers: 0 }
      $('gate').hidden = false
      $('toolbar').hidden = true
      $('list').innerHTML = ''
      showErr('')
    }
    $('secret').addEventListener('keydown', (e) => { if (e.key === 'Enter') load() })
    if (sessionStorage.getItem(KEY)) load()
  </script>
</body>
</html>
`
