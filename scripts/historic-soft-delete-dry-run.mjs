#!/usr/bin/env node
/**
 * Historic soft-delete inventory. DRY RUN / INVENTORY ONLY. NO MUTATION.
 * Prints counts and safe refs only (lead_ref / application_ref / id).
 * Does not print email or payload.
 *
 * HISTORIC_CLEANUP_EXECUTION_READY=NO
 * There is no apply path in this script.
 */
import { getServiceSupabase } from '../lib/leads/supabase.js'
import { dryRunHistoricSoftDeletes } from '../lib/leads/historic-cleanup.js'

const supabase = getServiceSupabase()
if (!supabase) {
  console.log('HISTORIC_CLEANUP_DISCOVERY=DRY_RUN_NO_BACKEND')
  console.log('HISTORIC_CANDIDATE_LEADS=0')
  console.log('HISTORIC_CANDIDATE_CAREERS=0')
  console.log('HISTORIC_CLEANUP_EXECUTION=NO')
  console.log('HISTORIC_CLEANUP_EXECUTION_READY=NO')
  console.log('HISTORIC_CLEANUP_APPLIED=NO')
  console.log('PRODUCTION_DATA_MUTATED=NO')
  process.exit(0)
}

const result = await dryRunHistoricSoftDeletes(supabase)
if (!result.ok) {
  console.error('HISTORIC_CLEANUP_DISCOVERY=FAIL')
  console.error(result.error?.message || 'load failed')
  process.exit(1)
}

console.log('HISTORIC_CLEANUP_DISCOVERY=PASS')
console.log(`HISTORIC_CANDIDATE_LEADS=${result.leads.count}`)
console.log(`HISTORIC_CANDIDATE_CAREERS=${result.careers.count}`)
console.log(`HISTORIC_LEAD_REFS=${result.leads.refs.join(',')}`)
console.log(`HISTORIC_CAREER_REFS=${result.careers.refs.join(',')}`)
console.log('HISTORIC_CLEANUP_EXECUTION=NO')
console.log('HISTORIC_CLEANUP_EXECUTION_READY=NO')
console.log('HISTORIC_CLEANUP_APPLIED=NO')
console.log('PRODUCTION_DATA_MUTATED=NO')
process.exit(0)
