#!/usr/bin/env node
/**
 * Historic soft-delete inventory. DRY-RUN by default.
 * Prints counts and safe refs only (lead_ref / application_ref / id).
 * Does not print email or payload. Does not mutate unless
 * APPLY_HISTORIC_CLEANUP=YES and EXPLICITLY_AUTHORIZED_CLEANUP=YES
 * on a non-production runtime — that apply path is not used by CI.
 */
import { getServiceSupabase } from '../lib/leads/supabase.js'
import { isProductionRuntime } from '../lib/leads/runtime-env.js'
import {
  cleanupAuthorization,
  dryRunHistoricSoftDeletes,
} from '../lib/leads/historic-cleanup.js'

const apply = (process.env.APPLY_HISTORIC_CLEANUP || '').trim().toUpperCase() === 'YES'
const explicit = (process.env.EXPLICITLY_AUTHORIZED_CLEANUP || '').trim().toUpperCase() === 'YES'
const auth = cleanupAuthorization({
  apply,
  explicitApply: explicit,
  productionRuntime: isProductionRuntime(),
})

if (apply && !auth.allowed) {
  console.error(`HISTORIC_SOFT_DELETE_CLEANUP=BLOCKED mode=${auth.mode}`)
  console.error('PRODUCTION_DATA_MUTATED=NO')
  process.exit(1)
}

const supabase = getServiceSupabase()
if (!supabase) {
  console.log('HISTORIC_SOFT_DELETE_CLEANUP=DRY_RUN_NO_BACKEND')
  console.log('HISTORIC_CANDIDATE_LEADS=0')
  console.log('HISTORIC_CANDIDATE_CAREERS=0')
  console.log('PRODUCTION_DATA_MUTATED=NO')
  console.log('APPLY=NO')
  process.exit(0)
}

const result = await dryRunHistoricSoftDeletes(supabase)
if (!result.ok) {
  console.error('HISTORIC_SOFT_DELETE_CLEANUP=FAIL')
  console.error(result.error?.message || 'load failed')
  process.exit(1)
}

console.log('HISTORIC_SOFT_DELETE_CLEANUP=DRY_RUN')
console.log(`HISTORIC_CANDIDATE_LEADS=${result.leads.count}`)
console.log(`HISTORIC_CANDIDATE_CAREERS=${result.careers.count}`)
console.log(`HISTORIC_LEAD_REFS=${result.leads.refs.join(',')}`)
console.log(`HISTORIC_CAREER_REFS=${result.careers.refs.join(',')}`)
console.log('PRODUCTION_DATA_MUTATED=NO')
console.log('APPLY=NO')
process.exit(0)
