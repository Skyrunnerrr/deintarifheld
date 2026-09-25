(function () {
  const HIDE = new Set(['website_url','company_fax','companyWebsite','fax_number','_formLoadedAt','_recaptchaToken','_recaptchaAction','honeypot'])
  const LABELS = {
    firma: 'Firma', ansprechpartner: 'Ansprechpartner', email: 'E-Mail',
    telefon: 'Telefon', phone: 'Telefon', plz: 'PLZ', zip: 'PLZ',
    energieart: 'Energieart', type: 'Tarifart', verbrauchStrom: 'Verbrauch Strom',
    verbrauchGas: 'Verbrauch Gas', usage: 'Verbrauch', standorte: 'Standorte',
    versorger: 'Versorger', provider: 'Anbieter', vertragslaufzeit: 'Vertragslaufzeit',
    nachricht: 'Nachricht', firstName: 'Name', name: 'Name', motivation: 'Motivation',
    page_source: 'Kanal', source_page: 'Quelle', lead_type: 'Typ',
    form_version: 'Formularversion', dsgvo: 'Kenntnisnahme'
  }
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
    if (item.kind === 'career') return 'Partner · ' + (item.full_name || item.email || item.application_ref)
    if (item.page_source === 'unternehmen') return 'Unternehmen · ' + (item.firma || item.email || item.lead_ref)
    return 'Privat · ' + ((item.payload && item.payload.firstName) || item.email || item.lead_ref)
  }
  let allItems = []
  let lastCounts = { leads: 0, careers: 0 }
  function mailStatusOf(item) {
    const raw = typeof item.mail_status === 'string' ? item.mail_status.trim() : ''
    if (raw === 'pending' || raw === 'failed' || raw === 'partial_failed' || raw === 'internal_sent' || raw === 'accepted') return raw
    return 'unknown'
  }
  function isFailed(item) { return ['pending', 'failed', 'partial_failed'].includes(mailStatusOf(item)) }
  function render() {
    const failedOnly = $('failedOnly').checked
    const items = failedOnly ? allItems.filter(isFailed) : allItems
    const failedCount = allItems.filter(isFailed).length
    $('counts').textContent = lastCounts.leads + ' Anfragen · ' + lastCounts.careers + ' Partneranfragen · ' + failedCount + ' Mailproblem'
    if (!items.length) {
      $('list').innerHTML = '<p class="empty">' + (failedOnly ? 'Keine fehlgeschlagenen Mails.' : 'Keine Einträge.') + '</p>'
      return
    }
    $('list').innerHTML = items.map((item) => {
      const ref = item.lead_ref || item.application_ref || ''
      const extra = rowsFromPayload(item.payload)
      const status = mailStatusOf(item)
      const failed = status === 'pending' || status === 'failed' || status === 'partial_failed'
      return '<article class="card' + (failed ? ' mail-failed' : '') + '"><h2>' + esc(titleOf(item)) + '</h2>' +
        '<p class="meta' + (failed ? ' badge-failed' : '') + '">' + esc(ref) + ' · ' + esc(when(item.created_at)) + ' · Mail ' + esc(status) + '</p>' +
        '<table>' +
        '<tr><th>E-Mail</th><td>' + esc(item.email || '') + '</td></tr>' +
        extra +
        '</table></article>'
    }).join('')
  }
  async function load() {
    showErr('')
    const res = await fetch('/api/admin/leads/', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401 || res.status === 429 || !res.ok || !json.ok) {
      showErr(json.code === 'unauthorized' ? 'Sitzung abgelaufen. Bitte neu anmelden.' : (json.code || 'Laden fehlgeschlagen'))
      if (res.status === 401) location.href = '/api/admin/inbox/'
      return
    }
    allItems = [
      ...(json.leads || []).map((row) => ({ ...row, kind: 'lead' })),
      ...(json.careers || []).map((row) => ({ ...row, kind: 'career' })),
    ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    lastCounts = { leads: (json.leads || []).length, careers: (json.careers || []).length }
    render()
  }
  $('reload').onclick = load
  $('failedOnly').addEventListener('change', render)
  load()
})()
