/**
 * Hosted CC browser client — cookie session only. No localStorage authority.
 */
const cfg = window.__DTH_CC__ || {};
const opsBaseUrl = cfg.opsBaseUrl || '/api/command-center/ops';
const view = cfg.view || 'inbox';

function $(sel) {
  return document.querySelector(sel);
}

function setConn(state, text) {
  const el = $('#dth-conn');
  if (!el) return;
  el.dataset.state = state;
  el.textContent = text;
}

function setContent(html) {
  const el = $('#dth-content');
  if (el) el.innerHTML = html;
}

function stateHtml(kind, message) {
  const titles = {
    loading: 'Daten werden geladen',
    empty: 'Keine Einträge',
    error: 'Verbindung zur Ops-API fehlgeschlagen',
    unauthorized: 'Nicht autorisiert',
    session_expired: 'Sitzung abgelaufen',
    malformed: 'Antwort ungültig',
  };
  const retry =
    kind === 'loading' ? '' : `<button type="button" data-retry="read">Erneut laden</button>`;
  return `<section class="dth-state" data-state="${kind}" role="status">
    <h2>${titles[kind] || 'Hinweis'}</h2>
    <p>${message}</p>${retry}</section>`;
}

async function apiGet(path, query = {}) {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
  } catch {
    return { networkError: true };
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return { status: res.status, malformed: true };
  }
  return { status: res.status, body };
}

function tone(status) {
  const s = String(status || '').toLowerCase();
  if (['done', 'new', 'open'].includes(s)) return 'ok';
  if (['waiting', 'in_progress'].includes(s)) return 'warn';
  if (['spam', 'deleted', 'cancelled'].includes(s)) return 'danger';
  return 'muted';
}

function labelStatus(status) {
  const map = {
    new: 'Neu',
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    waiting: 'Wartend',
    done: 'Erledigt',
    cancelled: 'Abgebrochen',
    unassigned: 'Nicht zugeordnet',
    linked_to_case: 'Mit Vorgang verknüpft',
  };
  return map[status] || status || '—';
}

function renderInbox(items) {
  if (!items.length) {
    return stateHtml('empty', 'Derzeit keine eingehenden Anfragen.');
  }
  const rows = items
    .map(
      (it) => `<tr>
      <td><code>${it.canonicalRef || it.canonicalId}</code></td>
      <td>${it.requestKind === 'CAREER_APPLICATION' ? 'Karriere' : 'Lead'} · ${it.requestType || ''}</td>
      <td>${it.createdAt || ''}</td>
      <td><span class="dth-status" data-tone="${tone(it.status)}">${labelStatus(it.status)}</span></td>
      <td>${labelStatus(it.assignmentStatus)}</td>
      <td>${it.contactRedacted || ''}</td>
      <td>${it.source || '—'}</td>
    </tr>`,
    )
    .join('');
  return `<section class="dth-panel"><div class="dth-table-wrap"><table class="dth-table">
    <thead><tr>
      <th scope="col">ID</th><th scope="col">Anfrageart</th><th scope="col">Erstellt</th>
      <th scope="col">Status</th><th scope="col">Zuordnung</th><th scope="col">Kontakt</th><th scope="col">Quelle</th>
    </tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderCases(items, detail, selectedId) {
  if (!items.length) return stateHtml('empty', 'Keine Vorgänge.');
  const rows = items
    .map((c) => {
      const sel = c.id === selectedId ? ' data-selected="true"' : '';
      return `<tr${sel}>
        <td><button type="button" class="linkish" data-select-case="${c.id}">${c.case_ref || c.id}</button></td>
        <td>${c.title || '—'}</td>
        <td><span class="dth-status" data-tone="${tone(c.status)}">${labelStatus(c.status)}</span></td>
        <td>${c.created_at || ''}</td></tr>`;
    })
    .join('');
  let detailHtml =
    '<section class="dth-panel"><p class="dth-lead">Vorgang auswählen, um Details zu lesen.</p></section>';
  if (detail?.item) {
    detailHtml = `<section class="dth-panel dth-detail">
      <h2 class="dth-subhead" style="margin-top:0">${detail.item.title}</h2>
      <dl>
        <dt>Referenz</dt><dd><code>${detail.item.case_ref}</code></dd>
        <dt>Status</dt><dd><span class="dth-status" data-tone="${tone(detail.item.status)}">${labelStatus(detail.item.status)}</span></dd>
      </dl>
    </section>`;
  }
  return `<div class="dth-split">
    <section class="dth-panel"><h2 class="dth-subhead" style="margin-top:0">Vorgangsliste</h2>
      <div class="dth-table-wrap"><table class="dth-table">
        <thead><tr><th scope="col">Referenz</th><th scope="col">Titel</th><th scope="col">Status</th><th scope="col">Erstellt</th></tr></thead>
        <tbody>${rows}</tbody></table></div></section>${detailHtml}</div>`;
}

function renderTasks(items, detail, selectedId) {
  if (!items.length) return stateHtml('empty', 'Keine Aufgaben.');
  const rows = items
    .map((t) => {
      const overdue =
        t.overdue === true ||
        (t.due_at &&
          new Date(t.due_at).getTime() < Date.now() &&
          !['done', 'cancelled'].includes(t.status));
      const sel = t.id === selectedId ? ' data-selected="true"' : '';
      return `<tr${sel}>
        <td><button type="button" class="linkish" data-select-task="${t.id}">${t.title || t.id}</button></td>
        <td><span class="dth-status" data-tone="${tone(t.status)}">${labelStatus(t.status)}</span></td>
        <td>${t.due_at || '—'}</td>
        <td>${overdue ? '<span class="dth-status" data-tone="danger">Überfällig</span>' : '<span class="dth-status" data-tone="muted">Im Plan</span>'}</td>
        <td>${t.assigned_person_id || '—'}</td>
        <td><code>${t.case_id || '—'}</code></td></tr>`;
    })
    .join('');
  let detailHtml =
    '<section class="dth-panel"><p class="dth-lead">Aufgabe auswählen, um Details zu lesen.</p></section>';
  if (detail?.item) {
    detailHtml = `<section class="dth-panel dth-detail">
      <h2 class="dth-subhead" style="margin-top:0">${detail.item.title}</h2>
      <dl>
        <dt>Status</dt><dd><span class="dth-status" data-tone="${tone(detail.item.status)}">${labelStatus(detail.item.status)}</span></dd>
        <dt>Fällig</dt><dd>${detail.item.due_at || '—'}</dd>
      </dl>
    </section>`;
  }
  return `<div class="dth-split">
    <section class="dth-panel"><h2 class="dth-subhead" style="margin-top:0">Aufgabenliste</h2>
      <div class="dth-table-wrap"><table class="dth-table">
        <thead><tr>
          <th scope="col">Titel</th><th scope="col">Status</th><th scope="col">Fällig</th>
          <th scope="col">Lage</th><th scope="col">Zuweisung</th><th scope="col">Vorgang</th>
        </tr></thead><tbody>${rows}</tbody></table></div></section>${detailHtml}</div>`;
}

async function ensureHostedSession() {
  const res = await apiGet('/api/command-center/session');
  if (res.networkError) {
    setConn('err', 'Session: nicht erreichbar');
    setContent(stateHtml('error', 'Die Sitzungsprüfung ist fehlgeschlagen.'));
    return { ok: false };
  }
  if (res.status === 401 || res.body?.state === 'UNAUTHENTICATED') {
    window.location.href = '/command-center/login/';
    return { ok: false };
  }
  if (res.body?.state === 'MFA_REQUIRED') {
    window.location.href = '/command-center/mfa/';
    return { ok: false };
  }
  if (!res.body?.ok) {
    setContent(stateHtml('unauthorized', 'Kein Zugriff auf das Command Center.'));
    return { ok: false };
  }
  const sess = $('#dth-session');
  if (sess) {
    sess.textContent = res.body.label || 'Operator · AAL2';
  }
  return { ok: true };
}

async function loadView() {
  setContent(stateHtml('loading', 'Bitte warten…'));
  const sessionOk = await ensureHostedSession();
  if (!sessionOk.ok) return;

  setConn('ok', 'Ops-API: verbunden (hosted)');

  if (view === 'inbox') {
    const res = await apiGet(`${opsBaseUrl}/ops/v1/a11/inbox`, { limit: 50 });
    if (handleReadError(res)) return;
    setContent(renderInbox(res.body.items || []));
    return;
  }
  if (view === 'cases') {
    const res = await apiGet(`${opsBaseUrl}/ops/v1/a11/cases`, { limit: 50 });
    if (handleReadError(res)) return;
    const items = res.body.items || [];
    setContent(renderCases(items, null, null));
    wireCaseSelect(items);
    return;
  }
  if (view === 'tasks') {
    const res = await apiGet(`${opsBaseUrl}/ops/v1/tasks`, { limit: 50 });
    if (handleReadError(res)) return;
    const items = res.body.items || [];
    const annotated = items.map((t) => {
      const due = t.due_at ? new Date(t.due_at) : null;
      const overdue =
        Boolean(due) &&
        due.getTime() < Date.now() &&
        !['done', 'cancelled'].includes(t.status);
      return { ...t, overdue };
    });
    setContent(renderTasks(annotated, null, null));
    wireTaskSelect(annotated);
    return;
  }
  if (view === 'overview') {
    const res = await apiGet(`${opsBaseUrl}/ops/v1/a11/overview`);
    if (handleReadError(res)) return;
    setContent(`<section class="dth-panel"><pre>${JSON.stringify(res.body, null, 2)}</pre></section>`);
  }
}

function handleReadError(res) {
  if (res.networkError) {
    setConn('err', 'Ops-API: nicht erreichbar');
    setContent(stateHtml('error', 'Die Ops-API ist nicht erreichbar.'));
    return true;
  }
  if (res.malformed) {
    setContent(stateHtml('malformed', 'Die API-Antwort konnte nicht gelesen werden.'));
    return true;
  }
  if (res.status === 401) {
    window.location.href = '/command-center/login/';
    return true;
  }
  if (res.status === 403) {
    setContent(stateHtml('unauthorized', 'Kein Zugriff mit dem aktuellen Operator.'));
    return true;
  }
  if (res.status === 503 && res.body?.code === 'STAGING_OPS_DATABASE_UNAVAILABLE') {
    setContent(
      stateHtml(
        'error',
        'Ops-Datenbank-Laufzeit noch nicht konfiguriert (dth_ops_api). Auth-Transport aktiv — Business-Reads folgen mit M11P E4.',
      ),
    );
    return true;
  }
  if (!res.body?.ok && res.status >= 400) {
    setContent(stateHtml('error', 'Die Ops-API lieferte einen Fehler.'));
    return true;
  }
  return false;
}

function wireCaseSelect(items) {
  document.querySelectorAll('[data-select-case]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-select-case');
      const detail = await apiGet(`${opsBaseUrl}/ops/v1/a11/cases/${encodeURIComponent(id)}`);
      if (handleReadError(detail)) return;
      setContent(renderCases(items, detail.body, id));
      wireCaseSelect(items);
    });
  });
}

function wireTaskSelect(items) {
  document.querySelectorAll('[data-select-task]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-select-task');
      const detail = await apiGet(`${opsBaseUrl}/ops/v1/tasks/${encodeURIComponent(id)}/detail`);
      if (handleReadError(detail)) return;
      setContent(renderTasks(items, detail.body, id));
      wireTaskSelect(items);
    });
  });
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t && t.matches && t.matches('[data-retry="read"]')) {
    loadView();
  }
  if (t && t.id === 'dth-logout') {
    fetch('/api/command-center/logout', { method: 'POST', credentials: 'include' }).finally(() => {
      window.location.href = '/command-center/login/';
    });
  }
});

loadView();
