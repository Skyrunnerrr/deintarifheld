/**
 * Typed CC read client — GET only. Never issues write verbs.
 */

export const CcNavItem = Object.freeze({
  INBOX: { id: 'inbox', href: '/inbox', label: 'Inbox' },
  CASES: { id: 'cases', href: '/vorgaenge', label: 'Vorgänge' },
  TASKS: { id: 'tasks', href: '/aufgaben', label: 'Aufgaben' },
});

export const CC_NAV_ITEMS = Object.freeze([
  CcNavItem.INBOX,
  CcNavItem.CASES,
  CcNavItem.TASKS,
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
      return get('/ops/v1/inbox', { limit });
    },
    async listCases({ limit } = {}) {
      return get('/ops/v1/cases', { limit });
    },
    async getCaseDetail(id) {
      return get(`/ops/v1/cases/${encodeURIComponent(id)}/detail`);
    },
    async listTasks({ limit, caseId } = {}) {
      return get('/ops/v1/tasks', { limit, case_id: caseId });
    },
    async getTaskDetail(id) {
      return get(`/ops/v1/tasks/${encodeURIComponent(id)}/detail`);
    },
    // Hard gate — exposed only so tests can prove rejection
    post: (path) => forbidWrite('POST', path),
    put: (path) => forbidWrite('PUT', path),
    patch: (path) => forbidWrite('PATCH', path),
    delete: (path) => forbidWrite('DELETE', path),
  };
}
