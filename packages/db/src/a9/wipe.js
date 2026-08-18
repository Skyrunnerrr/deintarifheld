/**
 * Test wipe for A8 offer + A9 switching rows so A1–A8 resets can DELETE cases.
 */
export async function wipeOfferAndSwitchingDomain(pool) {
  const { rows: a9 } = await pool.query(`SELECT to_regclass('ops.switch_cases') AS c`);
  if (a9[0]?.c) {
    await pool.query(`DELETE FROM ops.lifecycle_handoffs`);
    await pool.query(`DELETE FROM ops.switch_provider_events`);
    await pool.query(`DELETE FROM ops.switch_submission_intents`);
    await pool.query(`DELETE FROM ops.switch_approvals`);
    await pool.query(`DELETE FROM ops.switch_requirements`);
    await pool.query(`DELETE FROM ops.switch_facts`);
    await pool.query(`UPDATE ops.switch_cases SET current_attempt_id = NULL`);
    await pool.query(`DELETE FROM ops.switch_attempts`);
    await pool.query(`DELETE FROM ops.switch_cases`);
  }
  const { rows: a8 } = await pool.query(`SELECT to_regclass('ops.offers') AS c`);
  if (a8[0]?.c) {
    await pool.query(`DELETE FROM ops.switch_preparations`).catch(() => {});
    await pool.query(`DELETE FROM ops.offer_customer_decisions`).catch(() => {});
    await pool.query(`DELETE FROM ops.offer_tokens`).catch(() => {});
    await pool.query(`DELETE FROM ops.offer_approvals`).catch(() => {});
    await pool.query(`DELETE FROM ops.offer_options`).catch(() => {});
    await pool.query(`UPDATE ops.offers SET current_revision_id = NULL`).catch(() => {});
    await pool.query(`DELETE FROM ops.offer_revisions`).catch(() => {});
    await pool.query(`DELETE FROM ops.offers`).catch(() => {});
  }
}
