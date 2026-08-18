/**
 * A11 operator read models. Projection only — canonical domain wins.
 * Bounded pagination. No raw job payload. No secrets.
 */
import { createHash } from 'node:crypto';
import {
  A11ReadLimit,
  ExceptionSeverity,
  WaitingOn,
  CaseStage,
  KillDomain,
  KILL_DOMAINS,
} from '@deintarifheld/shared';
import { getWorkflowRuntimeStats } from '../workflow/stats.js';
import { listA11LifecycleProjection } from '../a10/prepare.js';
import { deriveCaseStage, deriveWaitingOn, inboxSeverity, severityRank } from './stage.js';
import { getProductionReadinessView } from './readiness.js';

function clampLimit(limit) {
  const n = Number(limit || A11ReadLimit.DEFAULT);
  if (!Number.isFinite(n) || n < 1) return A11ReadLimit.DEFAULT;
  return Math.min(Math.floor(n), A11ReadLimit.MAX);
}

async function hasRel(pool, name) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS c`, [name]);
  return Boolean(rows[0]?.c);
}

function ageMs(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Date.now() - t);
}

function safeJobProjection(row) {
  return {
    id: row.id,
    workflowInstanceId: row.workflow_instance_id,
    jobType: row.job_type,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    scheduledAt: row.scheduled_at,
    leasedBy: row.lease_owner || null,
    lastErrorClass: row.last_error_class || null,
    lastErrorCode: row.last_error_code || null,
    correlationId: row.correlation_id || null,
    controlVersion: row.control_version != null ? Number(row.control_version) : null,
    caseId: row.payload_redacted?.case_id || row.case_id || null,
    payloadExposed: false,
  };
}

export function createA11ReadService({ pool }) {
  async function getOpsOverview() {
    const generatedAt = new Date().toISOString();
    const stats = await getWorkflowRuntimeStats(pool);
    let casesOpen = 0;
    if (await hasRel(pool, 'public.cases')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM public.cases
         WHERE deleted_at IS NULL AND coalesce(status,'open') NOT IN ('done','cancelled')`,
      );
      casesOpen = rows[0].n;
    }
    const waiting = await summarizeWaiting();
    const approvals = await countPendingApprovals();
    const exceptions = await listOpsInbox({ limit: A11ReadLimit.MAX });
    let switchesPending = 0;
    let activeCustomers = 0;
    let renewalsDue = 0;
    if (await hasRel(pool, 'ops.switch_cases')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.switch_cases
         WHERE status IN ('READY','SUBMITTING','APPROVAL_REQUIRED','OUTCOME_UNKNOWN','SUPPLIER_PENDING')`,
      );
      switchesPending = rows[0].n;
    }
    if (await hasRel(pool, 'ops.customer_lifecycles')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.customer_lifecycles WHERE is_current AND status='ACTIVE'`,
      );
      activeCustomers = rows[0].n;
      const { rows: r } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.customer_lifecycles
         WHERE is_current AND status IN ('RENEWAL_DUE','RENEWAL_EVALUATION_PENDING','RENEWAL_OFFER_PENDING','RENEWAL_DECISION_PENDING')`,
      );
      renewalsDue = r[0].n;
    }
    const { rows: takeovers } = await pool.query(
      `SELECT count(*)::int AS n FROM security.control_state WHERE scope='WORKFLOW' AND state='TAKEOVER'`,
    );
    const control = await getControlState();
    return {
      ok: true,
      generatedAt,
      freshness: generatedAt,
      realtime: false,
      workerHealth: 'LAST_JOB_ACTIVITY',
      lastJobActivityAgeS: stats.oldest_due_job_age_s,
      casesOpen,
      waitingCustomer: waiting.customer,
      waitingProvider: waiting.provider,
      approvalsRequired: approvals,
      exceptions: exceptions.count,
      criticalExceptions: exceptions.items.filter((i) => i.severity === ExceptionSeverity.CRITICAL).length,
      switchesPending,
      activeCustomers,
      renewalsDue,
      deadLetter: stats.dead_letter_jobs,
      takeoversActive: takeovers[0].n,
      globalKillActive: control.globalKillActive,
      domainKills: control.domains.filter((d) => d.active).map((d) => d.domain),
      controlVersion: control.controlVersion,
      jobs: {
        ready: stats.ready_jobs,
        leasedOrRunning: stats.running_leased_jobs,
        retryScheduled: stats.retry_jobs,
        deadLetter: stats.dead_letter_jobs,
      },
    };
  }

  async function summarizeWaiting() {
    let customer = 0;
    let provider = 0;
    if (await hasRel(pool, 'ops.qualification_requirements')) {
      const { rows } = await pool.query(
        `SELECT count(DISTINCT case_id)::int AS n FROM ops.qualification_requirements WHERE status='OPEN'`,
      );
      customer += rows[0].n;
    }
    if (await hasRel(pool, 'ops.outbound_intents')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.outbound_intents WHERE state IN ('OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED')`,
      );
      provider += rows[0].n;
    }
    if (await hasRel(pool, 'ops.appointments')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.appointments WHERE status IN ('OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED')`,
      );
      provider += rows[0].n;
    }
    if (await hasRel(pool, 'ops.switch_attempts')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.switch_attempts WHERE is_current AND state='OUTCOME_UNKNOWN'`,
      );
      provider += rows[0].n;
    }
    return { customer, provider };
  }

  async function countPendingApprovals() {
    let n = 0;
    if (await hasRel(pool, 'ops.offer_approvals')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.offer_approvals WHERE decision='PENDING'`,
      );
      n += rows[0].n;
    }
    if (await hasRel(pool, 'ops.switch_approvals')) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ops.switch_approvals WHERE decision='PENDING'`,
      );
      n += rows[0].n;
    }
    return n;
  }

  async function listOpsInbox({ limit, severity } = {}) {
    const lim = clampLimit(limit);
    const items = [];
    if (await hasRel(pool, 'workflow.jobs')) {
      const { rows } = await pool.query(
        `SELECT j.id, j.job_type, j.status, j.last_error_code, j.last_error_class, j.created_at,
                j.payload_redacted, w.case_id, w.id AS workflow_id
         FROM workflow.jobs j
         JOIN workflow.workflow_instances w ON w.id = j.workflow_instance_id
         WHERE j.status = 'DEAD_LETTER'
         ORDER BY j.created_at ASC
         LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `dlq:${r.id}`,
          domain: 'A1',
          caseId: r.case_id || r.payload_redacted?.case_id || null,
          reasonCode: r.last_error_code || 'DEAD_LETTER',
          explanation: 'Job is in dead letter. Reprocess through A1 only.',
          severity: ExceptionSeverity.CRITICAL,
          waitingOn: WaitingOn.AUTOMATION,
          recommendedAction: 'REPROCESS_JOB',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'JOB',
          targetId: r.id,
        });
      }
    }
    if (await hasRel(pool, 'ops.outbound_intents')) {
      const { rows } = await pool.query(
        `SELECT id, case_id, purpose, state, created_at FROM ops.outbound_intents
         WHERE state IN ('OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED')
         ORDER BY created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `comm:${r.id}`,
          domain: 'A4',
          caseId: r.case_id,
          reasonCode: r.state,
          explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT RESUBMIT BLINDLY.',
          severity: ExceptionSeverity.CRITICAL,
          waitingOn: WaitingOn.PROVIDER,
          recommendedAction: 'RECONCILE_COMMUNICATION',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'COMMUNICATION',
          targetId: r.id,
          providerUnknown: true,
        });
      }
    }
    if (await hasRel(pool, 'ops.appointments')) {
      const { rows } = await pool.query(
        `SELECT id, case_id, status, created_at FROM ops.appointments
         WHERE status IN ('OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED')
         ORDER BY created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `appt:${r.id}`,
          domain: 'A5',
          caseId: r.case_id,
          reasonCode: r.status,
          explanation: 'Calendar provider outcome unknown. Reconcile, do not recreate.',
          severity: ExceptionSeverity.CRITICAL,
          waitingOn: WaitingOn.PROVIDER,
          recommendedAction: 'RECONCILE_APPOINTMENT',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'APPOINTMENT',
          targetId: r.id,
          providerUnknown: true,
        });
      }
    }
    if (await hasRel(pool, 'ops.case_qualifications')) {
      const { rows } = await pool.query(
        `SELECT id, case_id, outcome, created_at FROM ops.case_qualifications
         WHERE is_current AND outcome='NEEDS_HUMAN_REVIEW'
         ORDER BY created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `qual:${r.id}`,
          domain: 'A3',
          caseId: r.case_id,
          reasonCode: r.outcome,
          explanation: 'Qualification needs human fact review.',
          severity: ExceptionSeverity.ACTION_REQUIRED,
          waitingOn: WaitingOn.HUMAN_APPROVAL,
          recommendedAction: 'REVIEW_QUALIFICATION',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'QUALIFICATION',
          targetId: r.id,
        });
      }
    }
    if (await hasRel(pool, 'ops.document_fact_conflicts')) {
      const { rows } = await pool.query(
        `SELECT c.id, c.case_id, c.fact_code, c.status, c.created_at
         FROM ops.document_fact_conflicts c
         WHERE c.status='OPEN'
         ORDER BY c.created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `doc:${r.id}`,
          domain: 'A6',
          caseId: r.case_id,
          reasonCode: r.fact_code || 'DOCUMENT_CONFLICT',
          explanation: 'Document facts conflict. Review evidence; do not invent values.',
          severity: ExceptionSeverity.HIGH,
          waitingOn: WaitingOn.HUMAN_APPROVAL,
          recommendedAction: 'REVIEW_DOCUMENT',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'DOCUMENT_CONFLICT',
          targetId: r.id,
        });
      }
    }
    if (await hasRel(pool, 'ops.offer_approvals')) {
      const { rows } = await pool.query(
        `SELECT a.id, a.offer_revision_id, a.created_at, o.case_id, r.is_current, r.commercial_snapshot_hash
         FROM ops.offer_approvals a
         JOIN ops.offer_revisions r ON r.id = a.offer_revision_id
         JOIN ops.offers o ON o.id = r.offer_id
         WHERE a.decision='PENDING'
         ORDER BY a.created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `offer-appr:${r.id}`,
          domain: 'A8',
          caseId: r.case_id,
          reasonCode: r.is_current ? 'OFFER_APPROVAL_REQUIRED' : 'STALE_APPROVAL',
          explanation: r.is_current
            ? 'Offer revision awaits operator approval.'
            : 'Approval is stale because the revision is no longer current.',
          severity: r.is_current ? ExceptionSeverity.HIGH : ExceptionSeverity.ACTION_REQUIRED,
          waitingOn: WaitingOn.HUMAN_APPROVAL,
          recommendedAction: 'APPROVE_OFFER',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'OFFER_APPROVAL',
          targetId: r.offer_revision_id,
          stale: !r.is_current,
          revision: r.commercial_snapshot_hash,
        });
      }
    }
    if (await hasRel(pool, 'ops.switch_approvals')) {
      const { rows } = await pool.query(
        `SELECT a.id, a.switch_attempt_id, a.payload_hash, a.created_at, t.is_current, s.case_id, t.state
         FROM ops.switch_approvals a
         JOIN ops.switch_attempts t ON t.id = a.switch_attempt_id
         JOIN ops.switch_cases s ON s.id = t.switch_case_id
         WHERE a.decision='PENDING'
         ORDER BY a.created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `switch-appr:${r.id}`,
          domain: 'A9',
          caseId: r.case_id,
          reasonCode: r.is_current ? 'SWITCH_APPROVAL_REQUIRED' : 'STALE_APPROVAL',
          explanation: 'Switch submission requires revision-bound approval.',
          severity: ExceptionSeverity.HIGH,
          waitingOn: WaitingOn.HUMAN_APPROVAL,
          recommendedAction: 'APPROVE_SWITCH_SUBMISSION',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'SWITCH_APPROVAL',
          targetId: r.switch_attempt_id,
          stale: !r.is_current,
          revision: r.payload_hash,
        });
      }
    }
    if (await hasRel(pool, 'ops.switch_attempts')) {
      const { rows } = await pool.query(
        `SELECT t.id, t.state, t.created_at, s.case_id
         FROM ops.switch_attempts t
         JOIN ops.switch_cases s ON s.id = t.switch_case_id
         WHERE t.is_current AND t.state='OUTCOME_UNKNOWN'
         ORDER BY t.created_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `switch-unk:${r.id}`,
          domain: 'A9',
          caseId: r.case_id,
          reasonCode: 'OUTCOME_UNKNOWN',
          explanation: 'EXTERNAL EFFECT MAY HAVE OCCURRED. DO NOT RESUBMIT BLINDLY.',
          severity: ExceptionSeverity.CRITICAL,
          waitingOn: WaitingOn.PROVIDER,
          recommendedAction: 'RECONCILE_SWITCH',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'SWITCH',
          targetId: r.id,
          providerUnknown: true,
        });
      }
    }
    if (await hasRel(pool, 'ops.customer_lifecycles')) {
      const { rows } = await pool.query(
        `SELECT id, case_id, status, exception_code, created_at
         FROM ops.customer_lifecycles
         WHERE is_current AND (status IN ('EXCEPTION','RENEWAL_DUE') OR exception_code IS NOT NULL)
         ORDER BY updated_at ASC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: `life:${r.id}`,
          domain: 'A10',
          caseId: r.case_id,
          reasonCode: r.exception_code || r.status,
          explanation: r.status === 'RENEWAL_DUE'
            ? 'Renewal window needs operator/customer attention.'
            : 'Lifecycle exception. Canonical A10 state wins.',
          severity: inboxSeverity({
            config: r.status === 'EXCEPTION',
            customer: r.status === 'RENEWAL_DUE',
          }),
          waitingOn: r.status === 'RENEWAL_DUE' ? WaitingOn.CUSTOMER : WaitingOn.PROVIDER,
          recommendedAction: r.status === 'EXCEPTION' ? 'RECONCILE_LIFECYCLE' : 'REVIEW_RENEWAL',
          createdAt: r.created_at,
          ageMs: ageMs(r.created_at),
          targetType: 'LIFECYCLE',
          targetId: r.id,
        });
      }
    }

    items.sort((a, b) => {
      const s = severityRank(b.severity) - severityRank(a.severity);
      if (s !== 0) return s;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    const filtered = severity ? items.filter((i) => i.severity === severity) : items;
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      realtime: false,
      limit: lim,
      count: Math.min(filtered.length, lim),
      items: filtered.slice(0, lim),
    };
  }

  async function listOpsCases({ limit, q } = {}) {
    const lim = clampLimit(limit);
    if (!(await hasRel(pool, 'public.cases'))) {
      return { ok: true, items: [], count: 0, limit: lim };
    }
    const params = [];
    let where = 'WHERE c.deleted_at IS NULL';
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim().slice(0, 80)}%`);
      where += ` AND (c.case_ref ILIKE $1 OR coalesce(c.title,'') ILIKE $1)`;
    }
    params.push(lim);
    const { rows } = await pool.query(
      `SELECT c.id, c.case_ref, c.title, c.status, c.created_at, c.updated_at
       FROM public.cases c
       ${where}
       ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    const ids = rows.map((r) => r.id);
    const signalsByCase = await loadCaseSignals(ids);
    const items = rows.map((r) => {
      const sig = signalsByCase.get(String(r.id)) || {};
      return {
        id: r.id,
        caseRef: r.case_ref,
        company: r.title || null,
        status: r.status,
        stage: deriveCaseStage(sig),
        waitingOn: deriveWaitingOn(sig),
        exceptionCount: sig.exceptionCount || 0,
        approvalCount: sig.approvalCount || 0,
        takeover: Boolean(sig.takeoverActive),
        lastActivity: r.updated_at || r.created_at,
      };
    });
    return { ok: true, generatedAt: new Date().toISOString(), limit: lim, count: items.length, items };
  }

  async function loadCaseSignals(caseIds) {
    const map = new Map();
    for (const id of caseIds) map.set(String(id), { exceptionCount: 0, approvalCount: 0 });
    if (!caseIds.length) return map;
    const { rows: wf } = await pool.query(
      `SELECT w.case_id, w.id, cs.state
       FROM workflow.workflow_instances w
       LEFT JOIN security.control_state cs
         ON cs.scope='WORKFLOW' AND cs.scope_key = w.id::text
       WHERE w.case_id = ANY($1::text[])`,
      [caseIds.map(String)],
    );
    for (const r of wf) {
      const s = map.get(String(r.case_id));
      if (!s) continue;
      if (r.state === 'TAKEOVER') s.takeoverActive = true;
    }
    const { rows: dlq } = await pool.query(
      `SELECT w.case_id, count(*)::int AS n
       FROM workflow.jobs j
       JOIN workflow.workflow_instances w ON w.id = j.workflow_instance_id
       WHERE j.status='DEAD_LETTER' AND w.case_id = ANY($1::text[])
       GROUP BY w.case_id`,
      [caseIds.map(String)],
    );
    for (const r of dlq) {
      const s = map.get(String(r.case_id));
      if (s) {
        s.deadLetter = true;
        s.criticalException = true;
        s.exceptionCount += r.n;
      }
    }
    if (await hasRel(pool, 'ops.case_qualifications')) {
      const { rows } = await pool.query(
        `SELECT case_id, outcome FROM ops.case_qualifications WHERE is_current AND case_id = ANY($1::uuid[])`,
        [caseIds],
      );
      for (const r of rows) {
        const s = map.get(String(r.case_id));
        if (!s) continue;
        if (r.outcome === 'MISSING_INFORMATION') s.waitingCustomer = true;
        if (r.outcome === 'NEEDS_HUMAN_REVIEW') s.qualifying = true;
        if (!r.outcome || r.outcome === 'IN_PROGRESS') s.qualifying = true;
      }
    }
    if (await hasRel(pool, 'ops.offer_approvals')) {
      const { rows } = await pool.query(
        `SELECT o.case_id, count(*)::int AS n
         FROM ops.offer_approvals a
         JOIN ops.offer_revisions r ON r.id = a.offer_revision_id
         JOIN ops.offers o ON o.id = r.offer_id
         WHERE a.decision='PENDING' AND o.case_id = ANY($1::uuid[])
         GROUP BY o.case_id`,
        [caseIds],
      );
      for (const r of rows) {
        const s = map.get(String(r.case_id));
        if (s) {
          s.approvalRequired = true;
          s.approvalCount += r.n;
        }
      }
    }
    if (await hasRel(pool, 'ops.switch_cases')) {
      const { rows } = await pool.query(
        `SELECT s.case_id, t.state
         FROM ops.switch_cases s
         LEFT JOIN ops.switch_attempts t ON t.id = s.current_attempt_id
         WHERE s.case_id = ANY($1::uuid[])`,
        [caseIds],
      );
      for (const r of rows) {
        const s = map.get(String(r.case_id));
        if (!s) continue;
        if (r.state && !['CONFIRMED', 'REJECTED', 'CANCELLED'].includes(r.state)) s.switchPending = true;
        if (r.state === 'OUTCOME_UNKNOWN') {
          s.providerUnknown = true;
          s.criticalException = true;
          s.exceptionCount += 1;
        }
      }
    }
    if (await hasRel(pool, 'ops.customer_lifecycles')) {
      const { rows } = await pool.query(
        `SELECT case_id, status FROM ops.customer_lifecycles WHERE is_current AND case_id = ANY($1::uuid[])`,
        [caseIds],
      );
      for (const r of rows) {
        const s = map.get(String(r.case_id));
        if (!s) continue;
        if (r.status === 'ACTIVE' || r.status === 'RENEWAL_MONITORING') s.lifecycleActive = true;
        if (String(r.status).startsWith('RENEWAL')) s.renewalDue = true;
        if (r.status === 'EXCEPTION') {
          s.criticalException = true;
          s.exceptionCount += 1;
        }
      }
    }
    if (await hasRel(pool, 'ops.tariff_evaluations')) {
      const { rows } = await pool.query(
        `SELECT case_id, status FROM ops.tariff_evaluations WHERE is_current AND case_id = ANY($1::uuid[])`,
        [caseIds],
      );
      for (const r of rows) {
        const s = map.get(String(r.case_id));
        if (s && r.status && !['READY', 'COMPLETED', 'ACCEPTED'].includes(r.status)) s.tariffPending = true;
      }
    }
    return map;
  }

  async function getOpsCaseDetail(caseId) {
    if (!caseId) return { ok: false, status: 422, code: 'CASE_ID_REQUIRED' };
    const { rows } = await pool.query(
      `SELECT * FROM public.cases WHERE id=$1 AND deleted_at IS NULL`,
      [caseId],
    );
    if (!rows[0]) return { ok: false, status: 404, code: 'CASE_NOT_FOUND' };
    const c = rows[0];
    const sigMap = await loadCaseSignals([c.id]);
    const sig = sigMap.get(String(c.id)) || {};
    const sections = {
      qualification: await optionalRows(
        'ops.case_qualifications',
        `SELECT id, outcome, revision, created_at FROM ops.case_qualifications WHERE case_id=$1 ORDER BY revision DESC LIMIT 5`,
        [caseId],
      ),
      communication: await optionalRows(
        'ops.outbound_intents',
        `SELECT id, purpose, state, created_at FROM ops.outbound_intents WHERE case_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [caseId],
      ),
      appointment: await optionalRows(
        'ops.appointments',
        `SELECT id, status, start_at_utc, exception_code, created_at FROM ops.appointments WHERE case_id=$1 ORDER BY created_at DESC LIMIT 10`,
        [caseId],
      ),
      documents: await optionalRows(
        'ops.documents',
        `SELECT id, source_kind, status, filename_sanitized, created_at FROM ops.documents WHERE case_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [caseId],
      ),
      tariff: await optionalRows(
        'ops.tariff_evaluations',
        `SELECT id, status, created_at FROM ops.tariff_evaluations WHERE case_id=$1 ORDER BY created_at DESC LIMIT 5`,
        [caseId],
      ),
      offers: await optionalRows(
        'ops.offers',
        `SELECT o.id, o.status, r.id AS revision_id, r.state, r.commercial_snapshot_hash, r.is_current
         FROM ops.offers o
         LEFT JOIN ops.offer_revisions r ON r.offer_id=o.id AND r.is_current
         WHERE o.case_id=$1 ORDER BY o.created_at DESC LIMIT 5`,
        [caseId],
      ),
      switching: await optionalRows(
        'ops.switch_cases',
        `SELECT s.id, s.status, t.id AS attempt_id, t.state, t.payload_hash, t.is_current
         FROM ops.switch_cases s
         LEFT JOIN ops.switch_attempts t ON t.id=s.current_attempt_id
         WHERE s.case_id=$1 ORDER BY s.created_at DESC LIMIT 5`,
        [caseId],
      ),
      lifecycle: await optionalRows(
        'ops.customer_lifecycles',
        `SELECT id, status, confirmed_supply_start, exception_code, energy_type FROM ops.customer_lifecycles
         WHERE case_id=$1 AND is_current ORDER BY created_at DESC LIMIT 5`,
        [caseId],
      ),
      tasks: await optionalRows(
        'public.tasks',
        `SELECT id, title, status, due_at, created_at FROM public.tasks WHERE case_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`,
        [caseId],
      ),
    };
    const inbox = await listOpsInbox({ limit: 100 });
    const exceptions = inbox.items.filter((i) => String(i.caseId) === String(caseId));
    const timeline = await listCaseTimeline(caseId);
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      realtime: false,
      item: {
        id: c.id,
        caseRef: c.case_ref,
        company: c.title || null,
        status: c.status,
        stage: deriveCaseStage(sig),
        waitingOn: deriveWaitingOn(sig),
        takeover: Boolean(sig.takeoverActive),
        createdAt: c.created_at,
      },
      exceptions,
      timeline,
      ...sections,
    };
  }

  async function optionalRows(rel, sql, params) {
    if (!(await hasRel(pool, rel))) return [];
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  async function listCaseTimeline(caseId) {
    const { rows } = await pool.query(
      `SELECT id, event_type, created_at, detail
       FROM public.audit_events
       WHERE detail->>'case_id' = $1 OR detail->>'caseId' = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [String(caseId)],
    );
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      domain: String(r.event_type || '').split('.')[0] || 'audit',
      eventType: r.event_type,
      state: r.detail?.state || null,
      actor: r.detail?.actor_type || r.detail?.actor || null,
      correlationId: r.detail?.correlation_id || null,
    }));
  }

  async function listOpsApprovals({ limit } = {}) {
    const lim = clampLimit(limit);
    const items = [];
    if (await hasRel(pool, 'ops.offer_approvals')) {
      const { rows } = await pool.query(
        `SELECT a.id, a.decision, a.created_at, a.decided_at, r.id AS revision_id, r.is_current,
                r.commercial_snapshot_hash, r.state AS revision_state, o.case_id, o.id AS offer_id
         FROM ops.offer_approvals a
         JOIN ops.offer_revisions r ON r.id = a.offer_revision_id
         JOIN ops.offers o ON o.id = r.offer_id
         ORDER BY a.created_at DESC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: r.id,
          domain: 'A8',
          action: 'APPROVE_OFFER',
          caseId: r.case_id,
          targetId: r.revision_id,
          decision: r.decision,
          stale: !r.is_current,
          revision: r.commercial_snapshot_hash,
          revisionState: r.revision_state,
          createdAt: r.created_at,
          decidedAt: r.decided_at,
          what: 'Offer revision commercial snapshot',
          ifApproved: 'Offer becomes READY and delivery may be enqueued',
        });
      }
    }
    if (await hasRel(pool, 'ops.switch_approvals')) {
      const { rows } = await pool.query(
        `SELECT a.id, a.decision, a.payload_hash, a.created_at, a.decided_at,
                t.id AS attempt_id, t.is_current, t.state, s.case_id
         FROM ops.switch_approvals a
         JOIN ops.switch_attempts t ON t.id = a.switch_attempt_id
         JOIN ops.switch_cases s ON s.id = t.switch_case_id
         ORDER BY a.created_at DESC LIMIT $1`,
        [lim],
      );
      for (const r of rows) {
        items.push({
          id: r.id,
          domain: 'A9',
          action: 'APPROVE_SWITCH_SUBMISSION',
          caseId: r.case_id,
          targetId: r.attempt_id,
          decision: r.decision,
          stale: !r.is_current,
          revision: r.payload_hash,
          revisionState: r.state,
          createdAt: r.created_at,
          decidedAt: r.decided_at,
          what: 'Supplier switch submission payload hash',
          ifApproved: 'Switch submit job may run; provider effect possible after submit',
        });
      }
    }
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { ok: true, generatedAt: new Date().toISOString(), limit: lim, count: Math.min(items.length, lim), items: items.slice(0, lim) };
  }

  async function listOpsJobs({ limit, deadLetterOnly } = {}) {
    const lim = clampLimit(limit);
    const { rows } = await pool.query(
      `SELECT j.*, w.case_id, w.workflow_type, w.status AS workflow_status, w.current_state
       FROM workflow.jobs j
       JOIN workflow.workflow_instances w ON w.id = j.workflow_instance_id
       WHERE ($2::bool IS NOT TRUE OR j.status='DEAD_LETTER')
       ORDER BY j.created_at DESC
       LIMIT $1`,
      [lim, Boolean(deadLetterOnly)],
    );
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      limit: lim,
      count: rows.length,
      items: rows.map((r) => ({
        ...safeJobProjection(r),
        workflowType: r.workflow_type,
        workflowStatus: r.workflow_status,
        currentState: r.current_state,
        reprocessEligible: r.status === 'DEAD_LETTER',
      })),
    };
  }

  async function listOpsLifecycle({ limit } = {}) {
    const lim = clampLimit(limit);
    if (!(await hasRel(pool, 'ops.customer_lifecycles'))) {
      return { ok: true, items: [], count: 0, limit: lim };
    }
    const rows = await listA11LifecycleProjection(pool);
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      limit: lim,
      count: Math.min(rows.length, lim),
      items: rows.slice(0, lim),
    };
  }

  async function getControlState() {
    const { rows: ver } = await pool.query(`SELECT version FROM security.control_version WHERE id=1`);
    if (!ver[0]) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE', controlVersion: null, globalKillActive: null };
    }
    const { rows: g } = await pool.query(
      `SELECT state FROM security.control_state WHERE scope='GLOBAL' AND scope_key='AUTOMATION'`,
    );
    const { rows: domains } = await pool.query(
      `SELECT scope_key, state, reason, updated_at FROM security.control_state WHERE scope='DOMAIN'`,
    );
    const byKey = Object.fromEntries(domains.map((d) => [d.scope_key, d]));
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      realtime: false,
      controlVersion: Number(ver[0].version),
      globalKillActive: g[0]?.state === 'ACTIVE',
      globalState: g[0]?.state || 'UNKNOWN',
      domains: KILL_DOMAINS.map((d) => ({
        domain: d,
        active: byKey[d]?.state === 'ACTIVE',
        state: byKey[d]?.state || 'INACTIVE',
        reason: byKey[d]?.reason || null,
        registered: true,
      })),
      unknownDomainsInvented: 0,
    };
  }

  async function listOpsAuditEvents({ limit } = {}) {
    const lim = clampLimit(limit);
    const { rows } = await pool.query(
      `SELECT id, event_type, created_at, detail
       FROM public.audit_events
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [lim],
    );
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      editable: false,
      limit: lim,
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        timestamp: r.created_at,
        eventType: r.event_type,
        actor: r.detail?.actor || r.detail?.actor_type || null,
        domain: String(r.event_type || '').split('.')[0] || null,
        action: r.event_type,
        target: r.detail?.target_id || r.detail?.case_id || null,
        result: r.detail?.result || r.detail?.code || null,
        correlationId: r.detail?.correlation_id || null,
        controlVersion: r.detail?.control_version || null,
      })),
    };
  }

  return {
    getOpsOverview,
    listOpsInbox,
    listOpsCases,
    getOpsCaseDetail,
    listOpsApprovals,
    listOpsJobs,
    listOpsLifecycle,
    getControlState,
    listOpsAuditEvents,
    getProductionReadiness: getProductionReadinessView,
    hashPayload(value) {
      return createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
    },
  };
}

export { CaseStage, WaitingOn };
