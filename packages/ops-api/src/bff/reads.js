/**
 * P3-F3/F4 read surface — limited result sets; no full outbox payloads.
 * P3-F4 adds inbox projection over existing leads + career_applications (no new SoT).
 */

import {
  buildInboxItemFromLead,
  buildInboxItemFromCareer,
} from '@deintarifheld/shared';

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 100;

function clampLimit(limit) {
  const n = Number(limit || LIMIT_DEFAULT);
  if (!Number.isFinite(n) || n < 1) return LIMIT_DEFAULT;
  return Math.min(Math.floor(n), LIMIT_MAX);
}

/** Strip sensitive / bulky fields from case note list rows. */
function projectCaseNote(row) {
  return {
    id: row.id,
    case_id: row.case_id,
    // UI label may say „Interne Notiz“; canonical type remains CASE_NOTE
    canonical_resource_type: 'CASE_NOTE',
    body_preview:
      typeof row.body === 'string' ? row.body.slice(0, 240) : null,
    created_at: row.created_at,
    created_by_person_id: row.created_by_person_id,
  };
}

function projectCommunicationEvent(row) {
  return {
    id: row.id,
    case_id: row.case_id,
    sot_event_type: row.sot_event_type,
    channel: row.channel,
    direction: row.direction,
    metadata_redacted: row.metadata_redacted || {},
    created_at: row.created_at,
  };
}

export function createReadService({ pool }) {
  async function list(table, { limit, whereSql = '', params = [] } = {}) {
    const lim = clampLimit(limit);
    const sql = `SELECT * FROM public.${table} ${whereSql} ORDER BY created_at DESC NULLS LAST LIMIT ${lim}`;
    const { rows } = await pool.query(sql, params);
    return { ok: true, status: 200, items: rows, count: rows.length, limit: lim };
  }

  return {
    /**
     * Inbox read — projection over public.leads + public.career_applications.
     * Does not create an inbox table or dual-write SoT.
     */
    async listInbox({ limit } = {}) {
      const lim = clampLimit(limit);
      const leads = await pool.query(
        `SELECT l.id, l.lead_ref, l.lead_type, l.page_source, l.source_page,
                l.status, l.email, l.created_at,
                c.id AS linked_case_id
         FROM public.leads l
         LEFT JOIN public.cases c
           ON c.source_lead_id = l.id AND c.deleted_at IS NULL
         WHERE l.deleted_at IS NULL
         ORDER BY l.created_at DESC
         LIMIT ${lim}`,
      );
      const careers = await pool.query(
        `SELECT a.id, a.application_ref, a.status, a.email, a.source_page, a.created_at,
                c.id AS linked_case_id
         FROM public.career_applications a
         LEFT JOIN public.cases c
           ON c.source_career_application_id = a.id AND c.deleted_at IS NULL
         WHERE a.deleted_at IS NULL
         ORDER BY a.created_at DESC
         LIMIT ${lim}`,
      );
      const items = [
        ...leads.rows.map((r) => buildInboxItemFromLead(r, r.linked_case_id)),
        ...careers.rows.map((r) => buildInboxItemFromCareer(r, r.linked_case_id)),
      ]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, lim);
      return {
        ok: true,
        status: 200,
        items,
        count: items.length,
        limit: lim,
        projection: 'leads_and_career_applications',
        note: 'No inbox SoT table; contact fields redacted for list views',
      };
    },

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
    async getCaseDetail(id) {
      const base = await this.getCase(id);
      if (!base.ok) return base;
      const [notes, assignments, history, comms] = await Promise.all([
        this.listCaseNotes({ caseId: id, limit: 50 }),
        this.listAssignments({ caseId: id, limit: 50 }),
        this.listStatusHistory({ caseId: id, limit: 50 }),
        this.listCommunicationEvents({ caseId: id, limit: 50 }),
      ]);
      return {
        ok: true,
        status: 200,
        item: base.item,
        notes: (notes.items || []).map(projectCaseNote),
        assignments: assignments.items || [],
        statusHistory: history.items || [],
        communicationEvents: (comms.items || []).map(projectCommunicationEvent),
      };
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
    async getTaskDetail(id) {
      const { rows } = await pool.query(
        `SELECT * FROM public.tasks WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) return { ok: false, status: 404, code: 'TASK_NOT_FOUND' };
      const reminders = await pool.query(
        `SELECT id, task_id, remind_at, status, created_at
         FROM public.task_reminders
         WHERE task_id = $1 AND deleted_at IS NULL
         ORDER BY remind_at ASC
         LIMIT 50`,
        [id],
      );
      const task = rows[0];
      const dueAt = task.due_at ? new Date(task.due_at) : null;
      const overdue =
        Boolean(dueAt) &&
        dueAt.getTime() < Date.now() &&
        !['done', 'cancelled'].includes(task.status);
      return {
        ok: true,
        status: 200,
        item: {
          ...task,
          overdue,
        },
        reminders: reminders.rows,
      };
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
    async listStatusHistory({ caseId, targetType = 'case', limit } = {}) {
      if (caseId) {
        return list('status_history', {
          limit,
          whereSql: 'WHERE target_type = $1 AND target_id = $2',
          params: [targetType, caseId],
        });
      }
      return list('status_history', { limit });
    },
    async listCommunicationEvents({ caseId, limit } = {}) {
      if (caseId) {
        return list('communication_events', {
          limit,
          whereSql: 'WHERE case_id = $1 AND deleted_at IS NULL',
          params: [caseId],
        });
      }
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
