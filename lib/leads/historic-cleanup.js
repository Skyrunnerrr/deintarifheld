/**
 * Historic soft-delete inventory — dry-run only.
 * No apply / mutate path. Never invents legal_hold. Never prints email/payload PII.
 */

import { filterHistoricCleanupEligible, safeHistoricRef } from './deletion-state.js'

export const HISTORIC_CLEANUP_EXECUTION_READY = false

export const HISTORIC_CLEANUP_SELECT_LEADS =
  'id, lead_ref, status, anonymized_at, legal_hold, created_at, page_source'
export const HISTORIC_CLEANUP_SELECT_CAREERS =
  'id, application_ref, status, anonymized_at, legal_hold, created_at'

export function summarizeHistoricCandidates(rows, kind) {
  const eligible = filterHistoricCleanupEligible(rows)
  return {
    kind,
    count: eligible.length,
    refs: eligible.map((row) => safeHistoricRef(row, kind)).filter(Boolean),
  }
}

export function assertNoPiiInSummary(summary) {
  const dumped = JSON.stringify(summary)
  return !/@/.test(dumped) && !/nachricht|motivation|payload|ansprechpartner/i.test(dumped)
}

export async function loadHistoricSoftDeletes(supabase) {
  const leadsQ = supabase
    .from('leads')
    .select(HISTORIC_CLEANUP_SELECT_LEADS)
    .eq('status', 'deleted')
    .is('anonymized_at', null)
  const careersQ = supabase
    .from('career_applications')
    .select(HISTORIC_CLEANUP_SELECT_CAREERS)
    .eq('status', 'deleted')
    .is('anonymized_at', null)
  const [leadsRes, careerRes] = await Promise.all([leadsQ, careersQ])
  if (leadsRes.error) return { error: leadsRes.error, leads: [], careers: [] }
  if (careerRes.error) return { error: careerRes.error, leads: leadsRes.data || [], careers: [] }
  return {
    error: null,
    leads: leadsRes.data || [],
    careers: careerRes.data || [],
  }
}

export async function dryRunHistoricSoftDeletes(supabase) {
  const loaded = await loadHistoricSoftDeletes(supabase)
  if (loaded.error) return { ok: false, error: loaded.error, leads: null, careers: null }
  const leads = summarizeHistoricCandidates(loaded.leads, 'lead')
  const careers = summarizeHistoricCandidates(loaded.careers, 'career')
  return {
    ok: true,
    error: null,
    dryRun: true,
    applied: false,
    executionReady: HISTORIC_CLEANUP_EXECUTION_READY,
    leads,
    careers,
  }
}
