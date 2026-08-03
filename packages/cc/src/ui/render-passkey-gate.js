/**
 * Minimal non-operational passkey gate shells for local CC (P4-H0b3b).
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} opts
 * @param {'hub'|'enroll'|'signin'|'entry'|'protected'} opts.mode
 * @param {string} [opts.publishableKey] — runtime only; never log
 * @param {string} opts.fapiUrl
 * @param {boolean} opts.publishableKeyConfigured
 */
export function renderPasskeyGatePage({
  mode,
  publishableKey = '',
  fapiUrl,
  publishableKeyConfigured,
} = {}) {
  const titles = {
    hub: 'Passkey-Zugang',
    enroll: 'Passkey registrieren',
    signin: 'Mit Passkey anmelden',
    entry: 'Lokaler CC-Eingang',
    protected: 'Geschützter CC-Eingang',
  };
  const title = titles[mode] || 'Passkey-Zugang';
  const fapi = String(fapiUrl || '').replace(/\/$/, '');
  const clerkUiSrc = `${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`;
  const clerkSrc = `${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
  const pkAttr = publishableKeyConfigured ? esc(publishableKey) : '';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} · DeinTarifHeld</title>
  <style>
    :root {
      --bg0: #0f1c18;
      --bg1: #1a2e26;
      --ink: #e8f0eb;
      --muted: #9bb0a6;
      --accent: #3d8f6e;
      --danger: #c45c4a;
      --line: rgba(232,240,235,.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(61,143,110,.28), transparent 55%),
        radial-gradient(900px 500px at 90% 0%, rgba(40,70,60,.45), transparent 50%),
        linear-gradient(165deg, var(--bg0), var(--bg1) 55%, #122019);
    }
    main {
      max-width: 40rem;
      margin: 0 auto;
      padding: 3.5rem 1.5rem 4rem;
    }
    .brand {
      font-size: clamp(2rem, 5vw, 2.75rem);
      letter-spacing: -0.03em;
      margin: 0 0 .35rem;
      font-weight: 700;
    }
    .brand span { color: var(--accent); }
    h1 {
      font-size: 1.15rem;
      font-weight: 600;
      margin: 1.75rem 0 .5rem;
      letter-spacing: 0.02em;
    }
    p { color: var(--muted); line-height: 1.55; margin: 0 0 1rem; }
    .panel {
      margin-top: 1.5rem;
      padding: 1.25rem 0;
      border-top: 1px solid var(--line);
    }
    .status {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: .8rem;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    .status[data-tone="ok"] { color: #7dcea0; }
    .status[data-tone="deny"] { color: var(--danger); }
    .actions { display: flex; flex-wrap: wrap; gap: .65rem; margin-top: 1rem; }
    button, a.btn {
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(61,143,110,.16);
      color: var(--ink);
      padding: .65rem 1rem;
      border-radius: 2px;
      font: inherit;
      font-size: .95rem;
      cursor: pointer;
      text-decoration: none;
    }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.primary, a.btn.primary {
      background: var(--accent);
      border-color: transparent;
      color: #06120e;
      font-weight: 600;
    }
    .shell {
      display: none;
      margin-top: 1.25rem;
      padding: 1rem 0;
      border-top: 1px solid var(--line);
    }
    .shell[data-visible="true"] { display: block; }
    .shell h2 { margin: 0 0 .5rem; font-size: 1.05rem; }
    .deny-note { color: var(--danger); }
  </style>
</head>
<body>
  <main>
    <p class="brand">Dein<span>Tarif</span>Held</p>
    <h1>${esc(title)}</h1>
    <p>Lokaler Development-Zugang. Kein operativer CRM-/Vorgangs-Zugriff. Kein Token wird angezeigt.</p>
    <div class="panel">
      <div class="status" id="dth-gate-status" data-tone="deny">Prüfung…</div>
      <div id="dth-gate-message"></div>
      <div class="actions" id="dth-gate-actions"></div>
      <div class="shell" id="dth-local-shell" data-visible="false">
        <h2>Nicht-operativer lokaler CC-Shell</h2>
        <p>Passkey-Verifikation abgeschlossen. Operative APIs und Schreibzugriffe bleiben verweigert (kein Person-Mapping).</p>
        <p class="deny-note">STRONG_AUTHZ_COMPLETE=NO · OPERATIONAL_API_ACCESS=NO</p>
      </div>
    </div>
  </main>
  <script>
    window.__DTH_PASSKEY_GATE__ = {
      mode: ${JSON.stringify(mode)},
      fapiUrl: ${JSON.stringify(fapi)},
      publishableKeyConfigured: ${publishableKeyConfigured ? 'true' : 'false'},
      clerkUiScriptUrl: ${JSON.stringify(clerkUiSrc)},
      clerkScriptUrl: ${JSON.stringify(clerkSrc)},
    };
    ${
      publishableKeyConfigured
        ? `window.__clerk_publishable_key = ${JSON.stringify(publishableKey)};`
        : ''
    }
  </script>
  ${
    publishableKeyConfigured
      ? `<script
    defer
    crossorigin="anonymous"
    src="${esc(clerkUiSrc)}"
    type="text/javascript"
  ></script>
  <script
    defer
    crossorigin="anonymous"
    data-clerk-publishable-key="${pkAttr}"
    src="${esc(clerkSrc)}"
    type="text/javascript"
  ></script>`
      : ''
  }
  <script defer src="/assets/passkey-gate-client.js"></script>
</body>
</html>`;
}

export function countPasskeyGateMutationControls(html) {
  const forms = (html.match(/<form\b/gi) || []).length;
  const writes = (html.match(/\b(contenteditable|mutation|POST|PUT|PATCH|DELETE)\b/gi) || [])
    .length;
  return forms + writes;
}
