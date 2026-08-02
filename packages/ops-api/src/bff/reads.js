/**
 * P3-F3 read surface — limited result sets; no full outbox payloads.
 */

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 100;

function clampLimit(limit) {
  const n = Number(limit || LIMIT_DEFAULT);
  if (!Number.isFinite(n) || n < 1) return LIMIT_DEFAULT;
  return Math.min(Math.floor(n), LIMIT_MAX);
}

export function createReadService({ pool }) {
  async function list(table, { limit, whereSql = '', params = [] } = {}) {
    const lim = clampLimit(limit);
    const sql = `SELECT * FROM public.${table} ${whereSql} ORDER BY created_at DESC NULLS LAST LIMIT ${lim}`;
    const { rows } = await pool.query(sql, params);
    return { ok: true, status: 200, items: rows, count: rows.length, limit: lim };
  }

  return {
    async listCases({ limit } = {}) {
      return list('cases', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async getCase(id) {
      const { rows } = await pool.query(
        `SELECT * FROM public.cases WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) return { ok: false, status: 404, code: 'CASE_NOT_FOUND' };
      return { ok: true, status: 200, item: rows[0] };
    },
    async listCaseNotes({ caseId, limit } = {}) {
      if (caseId) {
        return list('case_notes', {
          limit,
          whereSql: 'WHERE case_id = $1 AND deleted_at IS NULL',
          params: [caseId],
        });
      }
      return list('case_notes', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async listTasks({ caseId, limit } = {}) {
      if (caseId) {
        return list('tasks', {
          limit,
          whereSql: 'WHERE case_id = $1 AND deleted_at IS NULL',
          params: [caseId],
        });
      }
      return list('tasks', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async listReminders({ limit } = {}) {
      return list('task_reminders', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async listAssignments({ caseId, limit } = {}) {
      if (caseId) {
        return list('case_assignments', {
          limit,
          whereSql: 'WHERE case_id = $1 AND deleted_at IS NULL',
          params: [caseId],
        });
      }
      return list('case_assignments', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async listStatusHistory({ limit } = {}) {
      return list('status_history', { limit });
    },
    async listCommunicationEvents({ limit } = {}) {
      return list('communication_events', { limit, whereSql: 'WHERE deleted_at IS NULL' });
    },
    async listOpsAuditEvents({ limit } = {}) {
      return list('ops_audit_events', { limit });
    },
    async listApprovals({ limit } = {}) {
      const lim = clampLimit(limit);
      const req = await pool.query(
        `SELECT * FROM public.approval_requests ORDER BY requested_at DESC LIMIT ${lim}`,
      );
      const dec = await pool.query(
        `SELECT * FROM public.approval_decisions ORDER BY decided_at DESC LIMIT ${lim}`,
      );
      return {
        ok: true,
        status: 200,
        requests: req.rows,
        decisions: dec.rows,
      };
    },
    async outboxHealth({ limit } = {}) {
      const lim = clampLimit(limit);
      const { rows } = await pool.query(
        `SELECT id, event_type, aggregate_type, aggregate_id, status, attempt_count,
                available_at, locked_at, processed_at, last_error_class, correlation_id, created_at
         FROM public.transactional_outbox
         ORDER BY created_at DESC LIMIT ${lim}`,
      );
      return {
        ok: true,
        status: 200,
        items: rows,
        note: 'payload_redacted omitted from BFF health view',
      };
    },
  };
}
