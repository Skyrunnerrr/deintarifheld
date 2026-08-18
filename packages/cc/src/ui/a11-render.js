import { esc } from './render.js';

function cmdButton(commandType, label, extra = {}) {
  const attrs = Object.entries(extra)
    .map(([k, v]) => `data-${k}="${esc(v)}"`)
    .join(' ');
  return `<button type="button" data-command="${esc(commandType)}" ${attrs}>${esc(label)}</button>`;
}

export function renderOverview(overview = {}) {
  const kill = overview.globalKillActive ? 'KILLED' : 'ON';
  return `
  <section class="dth-strip" aria-label="Steuerung">
    <p>GLOBAL AUTOMATION <strong>${esc(kill)}</strong>
    · Takeovers ${esc(overview.takeoversActive ?? 0)}
    · Critical ${esc(overview.criticalExceptions ?? 0)}
    · Worker: LAST JOB ACTIVITY
    · Stand ${esc(overview.freshness || overview.generatedAt || '')}
    · nicht live</p>
  </section>
  <section class="dth-panel">
    <h2 class="dth-subhead">Lage</h2>
    <ul>
      <li>Offene Cases: ${esc(overview.casesOpen ?? 0)}</li>
      <li>Wartet Kunde: ${esc(overview.waitingCustomer ?? 0)}</li>
      <li>Wartet Provider: ${esc(overview.waitingProvider ?? 0)}</li>
      <li>Freigaben: ${esc(overview.approvalsRequired ?? 0)}</li>
      <li>Ausnahmen: ${esc(overview.exceptions ?? 0)}</li>
      <li>Switch pending: ${esc(overview.switchesPending ?? 0)}</li>
      <li>Aktive Kunden: ${esc(overview.activeCustomers ?? 0)}</li>
      <li>Renewals: ${esc(overview.renewalsDue ?? 0)}</li>
      <li>Dead letter: ${esc(overview.deadLetter ?? 0)}</li>
    </ul>
  </section>`;
}

export function renderExceptionInbox(items = []) {
  if (!items.length) {
    return `<section class="dth-state" data-state="empty"><h2>Keine Ausnahmen</h2></section>`;
  }
  const rows = items
    .map(
      (it) => `<tr>
      <td>${esc(it.severity)}</td>
      <td>${esc(it.domain)}</td>
      <td>${esc(it.caseId)}</td>
      <td>${esc(it.reasonCode)}</td>
      <td>${esc(it.explanation)}</td>
      <td>${esc(it.waitingOn)}</td>
      <td>${esc(it.recommendedAction)}</td>
    </tr>`,
    )
    .join('');
  return `<section class="dth-panel"><div class="dth-table-wrap"><table class="dth-table">
    <thead><tr>
      <th>Schwere</th><th>Domäne</th><th>Case</th><th>Code</th><th>Erklärung</th><th>Wartet auf</th><th>Aktion</th>
    </tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function renderApprovals(items = []) {
  const rows = items
    .map(
      (it) => `<tr>
      <td>${esc(it.domain)}</td>
      <td>${esc(it.what)}</td>
      <td>${esc(it.ifApproved)}</td>
      <td><code>${esc(it.revision)}</code></td>
      <td>${it.stale ? 'STALE' : 'CURRENT'}</td>
      <td>${
        it.stale || it.decision !== 'PENDING'
          ? '—'
          : cmdButton(it.action, 'Freigeben', { target: it.targetId, revision: it.revision, confirm: 'true' })
      }</td>
    </tr>`,
    )
    .join('');
  return `<section class="dth-panel"><div class="dth-table-wrap"><table class="dth-table">
    <thead><tr>
      <th>Domäne</th><th>Was</th><th>Wenn freigegeben</th><th>Revision</th><th>Aktuell</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function renderControls(control = {}) {
  const killLabel = control.globalKillActive ? 'KILLED' : 'ON';
  const domains = (control.domains || [])
    .map((d) => `<li>${esc(d.domain)}: ${esc(d.state)}</li>`)
    .join('');
  return `<section class="dth-panel">
    <h2 class="dth-subhead">Global</h2>
    <p>CONTROL_VERSION ${esc(control.controlVersion)} · AUTOMATION ${esc(killLabel)}</p>
    <p>Zum Aktivieren „KILL“ eingeben, dann bestätigen.</p>
    <label for="dth-kill-confirm">Bestätigung</label>
    <input id="dth-kill-confirm" type="text" autocomplete="off" />
    ${cmdButton('SET_GLOBAL_KILL', 'Global kill setzen', { confirm: 'true', active: 'true' })}
    <h2 class="dth-subhead">Domains (Registry)</h2>
    <ul>${domains}</ul>
  </section>`;
}

export function renderReadiness(view = {}) {
  const gates = (view.gates || [])
    .map((g) => `<li>${esc(g.id)}: ${esc(g.status)} (${esc(g.evidence)})</li>`)
    .join('');
  return `<section class="dth-panel">
    <h2 class="dth-subhead">Production readiness</h2>
    <p>Maturity ${esc(view.maturity)} · overall ${esc(view.overall)} · false greens ${esc(view.falseGreens)}</p>
    <ul>${gates}</ul>
  </section>`;
}
