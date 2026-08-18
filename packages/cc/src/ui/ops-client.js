export const CcNavItem = Object.freeze({
  OVERVIEW: { id: 'overview', href: '/', label: 'Übersicht' },
  INBOX: { id: 'inbox', href: '/inbox', label: 'Inbox' },
  CASES: { id: 'cases', href: '/vorgaenge', label: 'Vorgänge' },
  APPROVALS: { id: 'approvals', href: '/freigaben', label: 'Freigaben' },
  TASKS: { id: 'tasks', href: '/aufgaben', label: 'Aufgaben' },
  WORKFLOWS: { id: 'workflows', href: '/workflows', label: 'Workflows' },
  LIFECYCLE: { id: 'lifecycle', href: '/kunden', label: 'Kunden' },
  CONTROLS: { id: 'controls', href: '/steuerung', label: 'Steuerung' },
  AUDIT: { id: 'audit', href: '/audit', label: 'Audit' },
});

export const CC_NAV_ITEMS = Object.freeze([
  CcNavItem.OVERVIEW,
  CcNavItem.INBOX,
  CcNavItem.CASES,
  CcNavItem.APPROVALS,
  CcNavItem.TASKS,
  CcNavItem.WORKFLOWS,
  CcNavItem.LIFECYCLE,
  CcNavItem.CONTROLS,
  CcNavItem.AUDIT,
]);

export function createOpsReadClient({
  baseUrl = 'http://127.0.0.1:3099',
  getToken,
  fetchImpl = globalThis.fetch,
} = {}) {
  const writeAttempts = [];

  async function get(path, query = {}) {
    const full = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') full.searchParams.set(k, String(v));
    }
    const token = typeof getToken === 'function' ? getToken() : getToken;
    const headers = {};
    if (token) headers.authorization = `DTH-Local ${token}`;
    const res = await fetchImpl(full.toString(), {
      method: 'GET',
      headers,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = { ok: false, code: 'MALFORMED_RESPONSE' };
    }
    return { status: res.status, body, ok: res.ok };
  }

  function forbidWrite(method, path) {
    writeAttempts.push({ method, path, at: new Date().toISOString() });
    return {
      status: 405,
      ok: false,
      body: { ok: false, code: 'CC_WRITE_FORBIDDEN', UI_WRITE_REQUESTS_EXECUTED: 0 },
    };
  }

  async function postCommand(body, tokenOverride) {
    const token = tokenOverride || (typeof getToken === 'function' ? getToken() : getToken);
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `DTH-Local ${token}`;
    const res = await fetchImpl(new URL('/ops/v1/a11/commands', baseUrl).toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    let parsed = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = { ok: false, code: 'MALFORMED_RESPONSE' };
    }
    return { status: res.status, body: parsed, ok: res.ok };
  }

  return {
    CC_NAV_ITEMS,
    getWriteAttempts: () => [...writeAttempts],
    async bootstrapSession() {
      return get('/ops/v1/dev/session');
    },
    async health() {
      return get('/ops/v1/dev/health');
    },
    async listInbox({ limit } = {}) {
      return get('/ops/v1/a11/inbox', { limit });
    },
    async listCases({ limit } = {}) {
      return get('/ops/v1/a11/cases', { limit });
    },
    async getCaseDetail(id) {
      return get(`/ops/v1/a11/cases/${encodeURIComponent(id)}`);
    },
    async listTasks({ limit, caseId } = {}) {
      return get('/ops/v1/tasks', { limit, case_id: caseId });
    },
    async getTaskDetail(id) {
      return get(`/ops/v1/tasks/${encodeURIComponent(id)}/detail`);
    },
    async overview() {
      return get('/ops/v1/a11/overview');
    },
    postCommand,
    post: (path) => forbidWrite('POST', path),
    put: (path) => forbidWrite('PUT', path),
    patch: (path) => forbidWrite('PATCH', path),
    delete: (path) => forbidWrite('DELETE', path),
  };
}
