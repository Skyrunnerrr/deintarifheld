/**
 * Server-rendered CC HTML — read-only. No mutation controls.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CC_NAV_ITEMS } from './ops-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(__dirname, 'styles.css'), 'utf8');

export function countMutationControls(html) {
  // Buttons that imply writes — none should appear
  const forbidden = [
    /data-action=["'](assign|status|note|contact|delete|export|create|approve|kill)["']/gi,
    /type=["']submit["']/gi,
    /<(form)\b/gi,
  ];
  let count = 0;
  for (const re of forbidden) {
    const m = html.match(re);
    if (m) count += m.length;
  }
  return count;
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (['done', 'new', 'open'].includes(s)) return 'ok';
  if (['waiting', 'in_progress'].includes(s)) return 'warn';
  if (['spam', 'deleted', 'cancelled'].includes(s)) return 'danger';
  return 'muted';
}

function statusLabel(status) {
  const map = {
    new: 'Neu',
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    waiting: 'Wartend',
    done: 'Erledigt',
    cancelled: 'Abgebrochen',
    spam: 'Spam',
    deleted: 'Gelöscht',
    unassigned: 'Nicht zugeordnet',
    linked_to_case: 'Mit Vorgang verknüpft',
  };
  return map[status] || status || '—';
}

export function renderStateBlock(kind, message) {
  const titles = {
    loading: 'Daten werden geladen',
    empty: 'Keine Einträge',
    error: 'Verbindung zur lokalen Ops-API fehlgeschlagen',
    unauthorized: 'Nicht autorisiert',
    session_expired: 'Sitzung abgelaufen',
    malformed: 'Antwort ungültig',
  };
  const actions =
    kind === 'loading'
      ? ''
      : `<button type="button" data-retry="read">Erneut laden</button>`;
  return `
    <section class="dth-state" data-state="${esc(kind)}" role="status">
      <h2>${esc(titles[kind] || 'Hinweis')}</h2>
      <p>${esc(message)}</p>
      ${actions}
    </section>`;
}

export function renderShell({
  activeView,
  sessionLabel,
  connectionState = 'pending',
  connectionText = 'Ops-API: Prüfung…',
  mainHtml,
  opsBaseUrl,
}) {
  const nav = CC_NAV_ITEMS.map((item) => {
    const current = item.id === activeView ? ' aria-current="page"' : '';
    return `<a href="${item.href}"${current}>${esc(item.label)}</a>`;
  }).join('\n');

  const titles = {
    overview: 'Übersicht',
    inbox: 'Inbox',
    cases: 'Vorgänge',
    approvals: 'Freigaben',
    tasks: 'Aufgaben',
    workflows: 'Workflows',
    lifecycle: 'Kunden',
    controls: 'Steuerung',
    audit: 'Audit',
  };
  const leads = {
    overview: 'Operative Systemlage — Ausnahmen, Freigaben, Kill-Status. Kein Live-Ticker.',
    inbox: 'Ausnahmen und Handlungsbedarf über A1–A10 — Projektion, keine zweite Wahrheit.',
    cases: 'Vorgänge mit Stage-Projektion. Canonical Domain bleibt Autorität.',
    approvals: 'Konsolidierte Freigaben A8/A9 — revisionsgebunden.',
    tasks: 'Interne Aufgaben. Aufgabenstatus ändert keine Fachautorität.',
    workflows: 'Jobs und Dead Letter. Kein Roh-Payload.',
    lifecycle: 'A10 Lifecycle-Projektion.',
    controls: 'Dauerhaftes Kill/Takeover. Kein UI-only Toggle.',
    audit: 'Nur Lesen. Audit ist unveränderlich.',
  };

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(titles[activeView])} · DeinTarifHeld Command Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>${CSS}</style>
</head>
<body>
  <div class="dth-shell" data-view="${esc(activeView)}" data-mutation-controls="0">
    <aside class="dth-side" aria-label="Hauptnavigation">
      <p class="dth-brand">Dein<span>Tarif</span>Held</p>
      <div class="dth-local-badge">Lokal / E2 — Operator Control Plane</div>
      <div class="dth-session" id="dth-session">
        ${esc(sessionLabel || 'Keine lokale Sitzung')}
      </div>
      <nav class="dth-nav" aria-label="Bereiche">
        ${nav}
      </nav>
      <button type="button" class="dth-logout" id="dth-logout">Sitzung löschen</button>
    </aside>
    <main class="dth-main" id="dth-main">
      <div class="dth-topbar">
        <div>
          <h1 class="dth-title">${esc(titles[activeView])}</h1>
          <p class="dth-lead">${esc(leads[activeView])}</p>
        </div>
        <div class="dth-conn" id="dth-conn" data-state="${esc(connectionState)}">${esc(connectionText)}</div>
      </div>
      <div id="dth-content">
        ${mainHtml || renderStateBlock('loading', 'Bitte warten…')}
      </div>
    </main>
  </div>
  <script>
    window.__DTH_CC__ = {
      view: ${JSON.stringify(activeView)},
      opsBaseUrl: ${JSON.stringify(opsBaseUrl)},
      tokenKey: 'dth_cc_local_token'
    };
  </script>
  <script type="module" src="/assets/cc-client.js"></script>
</body>
</html>`;
}

export function renderInboxTable(items = []) {
  if (!items.length) {
    return renderStateBlock('empty', 'Derzeit keine eingehenden Anfragen in der lokalen Datenbank.');
  }
  const rows = items
    .map(
      (it) => `
    <tr>
      <td><code>${esc(it.canonicalRef || it.canonicalId)}</code></td>
      <td>${esc(it.requestKind === 'CAREER_APPLICATION' ? 'Karriere' : 'Lead')} · ${esc(it.requestType)}</td>
      <td>${esc(it.createdAt || '')}</td>
      <td><span class="dth-status" data-tone="${statusTone(it.status)}">${esc(statusLabel(it.status))}</span></td>
      <td>${esc(statusLabel(it.assignmentStatus))}</td>
      <td>${esc(it.contactRedacted)}</td>
      <td>${esc(it.source || '—')}</td>
    </tr>`,
    )
    .join('');
  return `
  <section class="dth-panel" aria-labelledby="inbox-heading">
    <h2 id="inbox-heading" class="visually-hidden" style="position:absolute;left:-9999px">Inbox-Liste</h2>
    <div class="dth-table-wrap">
      <table class="dth-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Anfrageart</th>
            <th scope="col">Erstellt</th>
            <th scope="col">Status</th>
            <th scope="col">Zuordnung</th>
            <th scope="col">Kontakt</th>
            <th scope="col">Quelle</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

export function renderCasesView({ items = [], detail = null, selectedId = null } = {}) {
  if (!items.length && !detail) {
    return renderStateBlock('empty', 'Keine Vorgänge in der lokalen Datenbank.');
  }
  const rows = items
    .map((c) => {
      const selected = c.id === selectedId ? ' data-selected="true"' : '';
      return `
      <tr${selected}>
        <td><button type="button" class="linkish" data-select-case="${esc(c.id)}">${esc(c.case_ref || c.id)}</button></td>
        <td>${esc(c.title || '—')}</td>
        <td><span class="dth-status" data-tone="${statusTone(c.status)}">${esc(statusLabel(c.status))}</span></td>
        <td>${esc(c.created_at || '')}</td>
      </tr>`;
    })
    .join('');

  let detailHtml = `<section class="dth-panel"><p class="dth-lead">Vorgang auswählen, um Details zu lesen.</p></section>`;
  if (detail?.item) {
    const notes = (detail.notes || [])
      .map(
        (n) =>
          `<li><strong>Interne Notiz</strong> <span class="dth-status" data-tone="muted">(${esc(n.canonical_resource_type)})</span> — ${esc(n.body_preview || '')} <small>${esc(n.created_at || '')}</small></li>`,
      )
      .join('') || '<li>Keine Notizen</li>';
    const history = (detail.statusHistory || [])
      .map(
        (h) =>
          `<li>${esc(h.from_status || '—')} → ${esc(h.to_status)} <small>${esc(h.created_at || '')}</small></li>`,
      )
      .join('') || '<li>Keine Statushistorie</li>';
    const comms = (detail.communicationEvents || [])
      .map(
        (e) =>
          `<li>${esc(e.sot_event_type)} · ${esc(e.channel || '—')} <small>${esc(e.created_at || '')}</small></li>`,
      )
      .join('') || '<li>Keine Kommunikationsereignisse</li>';
    const assigns = (detail.assignments || [])
      .map((a) => `<li>${esc(a.assigned_person_id || a.role || a.id)}</li>`)
      .join('') || '<li>Keine Zuweisung</li>';

    detailHtml = `
    <section class="dth-panel dth-detail" aria-labelledby="case-detail-heading">
      <h2 id="case-detail-heading" class="dth-subhead" style="margin-top:0">${esc(detail.item.title)}</h2>
      <dl>
        <dt>Referenz</dt><dd><code>${esc(detail.item.case_ref)}</code></dd>
        <dt>Status</dt><dd><span class="dth-status" data-tone="${statusTone(detail.item.status)}">${esc(statusLabel(detail.item.status))}</span></dd>
        <dt>Erstellt</dt><dd>${esc(detail.item.created_at || '')}</dd>
      </dl>
      <h3 class="dth-subhead">Zuweisungen</h3>
      <ul>${assigns}</ul>
      <h3 class="dth-subhead">Interne Notizen</h3>
      <ul>${notes}</ul>
      <h3 class="dth-subhead">Statushistorie</h3>
      <ul>${history}</ul>
      <h3 class="dth-subhead">Kommunikation</h3>
      <ul>${comms}</ul>
    </section>`;
  }

  return `
  <div class="dth-split">
    <section class="dth-panel" aria-labelledby="cases-heading">
      <h2 id="cases-heading" class="dth-subhead" style="margin-top:0">Vorgangsliste</h2>
      <div class="dth-table-wrap">
        <table class="dth-table">
          <thead>
            <tr>
              <th scope="col">Referenz</th>
              <th scope="col">Titel</th>
              <th scope="col">Status</th>
              <th scope="col">Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
    ${detailHtml}
  </div>`;
}

export function renderTasksView({ items = [], detail = null, selectedId = null } = {}) {
  if (!items.length && !detail) {
    return renderStateBlock('empty', 'Keine Aufgaben in der lokalen Datenbank.');
  }
  const rows = items
    .map((t) => {
      const due = t.due_at ? new Date(t.due_at) : null;
      const overdue =
        t.overdue === true ||
        (due && due.getTime() < Date.now() && !['done', 'cancelled'].includes(t.status));
      const selected = t.id === selectedId ? ' data-selected="true"' : '';
      return `
      <tr${selected}>
        <td><button type="button" class="linkish" data-select-task="${esc(t.id)}">${esc(t.title || t.id)}</button></td>
        <td><span class="dth-status" data-tone="${statusTone(t.status)}">${esc(statusLabel(t.status))}</span></td>
        <td>${esc(t.due_at || '—')}</td>
        <td>${overdue ? '<span class="dth-status" data-tone="danger">Überfällig</span>' : '<span class="dth-status" data-tone="muted">Im Plan</span>'}</td>
        <td>${esc(t.assigned_person_id || '—')}</td>
        <td><code>${esc(t.case_id || '—')}</code></td>
      </tr>`;
    })
    .join('');

  let detailHtml = `<section class="dth-panel"><p class="dth-lead">Aufgabe auswählen, um Details zu lesen.</p></section>`;
  if (detail?.item) {
    const reminders = (detail.reminders || [])
      .map(
        (r) =>
          `<li>${esc(r.remind_at)} · ${esc(r.status)} <small>${esc(r.id)}</small></li>`,
      )
      .join('') || '<li>Keine Wiedervorlagen</li>';
    detailHtml = `
    <section class="dth-panel dth-detail" aria-labelledby="task-detail-heading">
      <h2 id="task-detail-heading" class="dth-subhead" style="margin-top:0">${esc(detail.item.title)}</h2>
      <dl>
        <dt>Status</dt><dd><span class="dth-status" data-tone="${statusTone(detail.item.status)}">${esc(statusLabel(detail.item.status))}</span></dd>
        <dt>Fällig</dt><dd>${esc(detail.item.due_at || '—')}</dd>
        <dt>Überfällig</dt><dd>${detail.item.overdue ? 'Ja' : 'Nein'}</dd>
        <dt>Zuweisung</dt><dd>${esc(detail.item.assigned_person_id || '—')}</dd>
        <dt>Vorgang</dt><dd><code>${esc(detail.item.case_id || '—')}</code></dd>
      </dl>
      <h3 class="dth-subhead">Wiedervorlagen</h3>
      <ul>${reminders}</ul>
    </section>`;
  }

  return `
  <div class="dth-split">
    <section class="dth-panel" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading" class="dth-subhead" style="margin-top:0">Aufgabenliste</h2>
      <div class="dth-table-wrap">
        <table class="dth-table">
          <thead>
            <tr>
              <th scope="col">Titel</th>
              <th scope="col">Status</th>
              <th scope="col">Fällig</th>
              <th scope="col">Lage</th>
              <th scope="col">Zuweisung</th>
              <th scope="col">Vorgang</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
    ${detailHtml}
  </div>`;
}
