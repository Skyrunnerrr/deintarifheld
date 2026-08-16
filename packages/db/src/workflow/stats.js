/**
 * Lightweight queue / control observability queries for A1.
 */

export async function getWorkflowRuntimeStats(pool) {
  const { rows: jobCounts } = await pool.query(
    `SELECT status, count(*)::int AS n FROM workflow.jobs GROUP BY status`,
  );
  const byStatus = Object.fromEntries(jobCounts.map((r) => [r.status, r.n]));

  const { rows: wfCounts } = await pool.query(
    `SELECT status, count(*)::int AS n FROM workflow.workflow_instances GROUP BY status`,
  );
  const workflowsByStatus = Object.fromEntries(wfCounts.map((r) => [r.status, r.n]));

  const { rows: oldest } = await pool.query(
    `SELECT extract(epoch from (now() - min(scheduled_at)))::int AS age_s
     FROM workflow.jobs
     WHERE status IN ('READY','RETRY_SCHEDULED') AND scheduled_at <= now()`,
  );

  const { rows: kill } = await pool.query(
    `SELECT state FROM security.control_state WHERE scope='GLOBAL' AND scope_key='AUTOMATION'`,
  );
  const { rows: ver } = await pool.query(
    `SELECT version FROM security.control_version WHERE id=1`,
  );

  const { rows: failures } = await pool.query(
    `SELECT last_error_class, count(*)::int AS n
     FROM workflow.jobs
     WHERE last_error_class IS NOT NULL
     GROUP BY last_error_class
     ORDER BY n DESC
     LIMIT 20`,
  );

  return {
    ready_jobs: byStatus.READY || 0,
    running_leased_jobs: (byStatus.LEASED || 0) + (byStatus.RUNNING || 0),
    scheduled_jobs: byStatus.RETRY_SCHEDULED || 0,
    retry_jobs: byStatus.RETRY_SCHEDULED || 0,
    dead_letter_jobs: byStatus.DEAD_LETTER || 0,
    succeeded_jobs: byStatus.SUCCEEDED || 0,
    failed_permanent_jobs: byStatus.FAILED_PERMANENT || 0,
    cancelled_jobs: byStatus.CANCELLED || 0,
    oldest_due_job_age_s: oldest[0]?.age_s ?? null,
    workflow_count_by_state: workflowsByStatus,
    paused_workflow_count: workflowsByStatus.PAUSED || 0,
    global_kill_state: kill[0]?.state || null,
    control_version: ver[0] ? Number(ver[0].version) : null,
    recent_failure_classes: failures,
    jobs_by_status: byStatus,
  };
}
