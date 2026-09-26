import { createClient } from '@supabase/supabase-js'
import {
  ANONYMISED_EMAIL,
  REDACTED_PLACEHOLDER_NOT_ALLOWED,
  filterEraseEligible,
  filterPhysicalEligible,
  filterRetentionEligible,
  isRedactedPlaceholderEmail,
} from './deletion-state.js'
import { resolveDeletionMode } from './deletion-mode.js'
import {
  anonymisePayload,
  emailAuditPseudonym,
} from './retention-privacy.js'

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function makeLeadRef(pageSource) {
  const prefix =
    pageSource === 'unternehmen'
      ? 'B2B'
      : pageSource === 'career'
        ? 'CAR'
        : pageSource === 'partner'
          ? 'PAR'
          : pageSource === 'general'
            ? 'GEN'
            : pageSource === 'hero-funnel'
              ? 'HER'
              : pageSource === 'main_funnel' || pageSource === 'privat'
                ? 'PRV'
                : 'LED'
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${stamp}-${rand}`
}

export async function insertLead(supabase, row) {
  const { data, error } = await supabase.from('leads').insert(row).select('id, lead_ref, created_at').single()
  return { data, error }
}

const LEAD_REPLAY_COLS =
  'id, lead_ref, created_at, status, email, page_source, firma, payload, mail_status, mail_mode, mail_sent_at'

export async function findLeadReplay(supabase, idempotencyKey) {
  if (!idempotencyKey) return { data: null, error: null }
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_REPLAY_COLS)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentLeadReplay(supabase, { email, pageSource, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_REPLAY_COLS)
    .eq('email', email)
    .eq('page_source', pageSource)
    .neq('status', 'deleted')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { duplicate: null, error }
  return { duplicate: data?.[0] || null, error: null }
}

export async function claimLeadMailRetry(supabase, leadId) {
  if (!leadId) return { claimed: false, error: null }
  const { data, error } = await supabase
    .from('leads')
    .update({ mail_status: 'retrying', updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('mail_status', 'failed')
    .select('id')
  if (error) return { claimed: false, error }
  return { claimed: Array.isArray(data) && data.length > 0, error: null }
}

export async function findLeadByIdempotencyKey(supabase, idempotencyKey) {
  if (!idempotencyKey) return { data: null, error: null }
  const { data, error } = await supabase
    .from('leads')
    .select('id, lead_ref, created_at, status, mail_status, mail_mode, mail_sent_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentDuplicate(supabase, { email, pageSource, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('leads')
    .select('id, lead_ref, created_at, mail_status, mail_mode, mail_sent_at')
    .eq('email', email)
    .eq('page_source', pageSource)
    .neq('status', 'deleted')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { duplicate: null, error }
  return { duplicate: data?.[0] || null, error: null }
}

export async function updateLeadMailMeta(supabase, leadId, { mailStatus, mailMode }) {
  if (!leadId) return { error: null }
  const patch = {
    updated_at: new Date().toISOString(),
    mail_status: mailStatus || null,
    mail_mode: mailMode || null,
  }
  if (mailStatus === 'accepted' || mailStatus === 'internal_sent') {
    patch.mail_sent_at = new Date().toISOString()
  }
  const { error } = await supabase.from('leads').update(patch).eq('id', leadId)
  return { error }
}

export async function writeAudit(supabase, { leadId = null, careerId = null, eventType, detail = {} }) {
  const row = {
    lead_id: leadId,
    event_type: eventType,
    detail,
  }
  if (careerId) row.career_id = careerId
  const { error } = await supabase.from('audit_events').insert(row)
  return { error }
}

export async function insertCareerApplication(supabase, row) {
  const { data, error } = await supabase
    .from('career_applications')
    .insert(row)
    .select('id, application_ref, created_at')
    .single()
  return { data, error }
}

const CAREER_REPLAY_COLS =
  'id, application_ref, created_at, status, email, full_name, payload, mail_status, mail_mode, mail_sent_at'

export async function findCareerReplay(supabase, idempotencyKey) {
  if (!idempotencyKey) return { data: null, error: null }
  const { data, error } = await supabase
    .from('career_applications')
    .select(CAREER_REPLAY_COLS)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentCareerReplay(supabase, { email, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('career_applications')
    .select(CAREER_REPLAY_COLS)
    .eq('email', email)
    .neq('status', 'deleted')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { duplicate: null, error }
  return { duplicate: data?.[0] || null, error: null }
}

export async function claimCareerMailRetry(supabase, careerId) {
  if (!careerId) return { claimed: false, error: null }
  const { data, error } = await supabase
    .from('career_applications')
    .update({ mail_status: 'retrying', updated_at: new Date().toISOString() })
    .eq('id', careerId)
    .eq('mail_status', 'failed')
    .select('id')
  if (error) return { claimed: false, error }
  return { claimed: Array.isArray(data) && data.length > 0, error: null }
}

export async function findCareerByIdempotencyKey(supabase, idempotencyKey) {
  if (!idempotencyKey) return { data: null, error: null }
  const { data, error } = await supabase
    .from('career_applications')
    .select('id, application_ref, created_at, status, mail_status, mail_mode, mail_sent_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentCareerDuplicate(supabase, { email, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('career_applications')
    .select('id, application_ref, created_at, mail_status, mail_mode, mail_sent_at')
    .eq('email', email)
    .neq('status', 'deleted')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { duplicate: null, error }
  return { duplicate: data?.[0] || null, error: null }
}

export async function updateCareerMailMeta(supabase, careerId, { mailStatus, mailMode }) {
  if (!careerId) return { error: null }
  const patch = {
    updated_at: new Date().toISOString(),
    mail_status: mailStatus || null,
    mail_mode: mailMode || null,
  }
  if (mailStatus === 'accepted' || mailStatus === 'internal_sent') {
    patch.mail_sent_at = new Date().toISOString()
  }
  const { error } = await supabase.from('career_applications').update(patch).eq('id', careerId)
  return { error }
}

const PRIVATE_SOURCES = ['privat', 'hero-funnel', 'main_funnel']

function applyLeadChannelFilter(query, channel) {
  if (channel === 'business') return query.eq('page_source', 'unternehmen')
  if (channel === 'private') return query.in('page_source', PRIVATE_SOURCES)
  return query
}

function deletionAuditDetail({ email, channel, mode, ids, careerIds }) {
  return {
    ...emailAuditPseudonym(email),
    channel,
    mode,
    count: ids.length,
    career_count: careerIds.length,
    lead_ids: ids,
    career_ids: careerIds,
  }
}

function rowsForMode(rows, mode) {
  if (mode === 'physical') return filterPhysicalEligible(rows)
  return filterEraseEligible(rows)
}

async function loadLeadsForDeletion(supabase, email, channel, mode) {
  let query = supabase
    .from('leads')
    .select('id, email, payload, firma, page_source, status, anonymized_at, legal_hold')
    .eq('email', email)
  query = applyLeadChannelFilter(query, channel)
  const { data, error } = await query
  return { rows: rowsForMode(data || [], mode), error }
}

async function loadCareersForDeletion(supabase, email, mode) {
  const { data, error } = await supabase
    .from('career_applications')
    .select('id, email, payload, full_name, status, anonymized_at, legal_hold')
    .eq('email', email)
  return { rows: rowsForMode(data || [], mode), error }
}

async function anonymiseLeadRow(supabase, row, now) {
  const keepFirma = row.page_source === 'unternehmen'
  const { error } = await supabase
    .from('leads')
    .update({
      status: 'deleted',
      deleted_at: now,
      updated_at: now,
      anonymized_at: now,
      email: ANONYMISED_EMAIL,
      firma: keepFirma ? row.firma || null : null,
      payload: anonymisePayload(row.payload, { keepFirma }),
      // legal_hold is never auto-set or cleared here
    })
    .eq('id', row.id)
  return error
}

async function anonymiseCareerRow(supabase, row, now) {
  const { error } = await supabase
    .from('career_applications')
    .update({
      status: 'deleted',
      deleted_at: now,
      updated_at: now,
      anonymized_at: now,
      email: ANONYMISED_EMAIL,
      full_name: null,
      payload: anonymisePayload(row.payload, { keepFirma: false }),
    })
    .eq('id', row.id)
  return error
}

/**
 * Soft-delete by email. Payload stays intact.
 * Soft-delete is not a legal hold. `legal_hold` is never auto-set here.
 * channel: 'all' | 'business' | 'private' | 'career'
 * Delete audits never store plaintext email.
 */
export async function softDeleteByEmail(supabase, email, { channel = 'all' } = {}) {
  return processLeadDeletion(supabase, email, { channel, mode: 'soft' })
}

/**
 * mode must be explicit:
 *   soft      — technical soft-deactivation (payload intact)
 *   redact    — PII minimisation (not legal anonymisation); `anonymise` is a deprecated alias
 *   physical  — row deleted
 * Soft-deleted rows with anonymized_at IS NULL remain eligible unless legal_hold=true.
 * Already-redacted rows are not rewritten and are never physical-deleted by email.
 * REDACTED_EMAIL is rejected — it is a shared placeholder, not a unique subject key.
 */
export async function processLeadDeletion(supabase, email, { channel = 'all', mode } = {}) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error: new Error('email required') }
  if (isRedactedPlaceholderEmail(normalized)) {
    return {
      updated: 0,
      careerUpdated: 0,
      ids: [],
      careerIds: [],
      error: new Error(REDACTED_PLACEHOLDER_NOT_ALLOWED),
      code: REDACTED_PLACEHOLDER_NOT_ALLOWED,
    }
  }
  const resolved = resolveDeletionMode(mode)
  if (!resolved.ok) {
    return {
      updated: 0,
      careerUpdated: 0,
      ids: [],
      careerIds: [],
      error: new Error(resolved.code),
      code: resolved.code,
    }
  }
  const resolvedMode = resolved.mode
  const now = new Date().toISOString()
  let ids = []
  let careerIds = []

  if (channel === 'all' || channel === 'business' || channel === 'private') {
    const loaded = await loadLeadsForDeletion(supabase, normalized, channel, resolvedMode)
    if (loaded.error) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error: loaded.error }
    for (const row of loaded.rows) {
      let error = null
      if (resolvedMode === 'physical') {
        ;({ error } = await supabase.from('leads').delete().eq('id', row.id))
      } else if (resolvedMode === 'redact') {
        error = await anonymiseLeadRow(supabase, row, now)
      } else {
        ;({ error } = await supabase
          .from('leads')
          .update({ status: 'deleted', deleted_at: now, updated_at: now })
          .eq('id', row.id))
      }
      if (error) return { updated: ids.length, careerUpdated: 0, ids, careerIds: [], error }
      ids.push(row.id)
    }
  }

  if (channel === 'all' || channel === 'career') {
    const loaded = await loadCareersForDeletion(supabase, normalized, resolvedMode)
    if (loaded.error) return { updated: ids.length, careerUpdated: 0, ids, careerIds: [], error: loaded.error }
    for (const row of loaded.rows) {
      let error = null
      if (resolvedMode === 'physical') {
        ;({ error } = await supabase.from('career_applications').delete().eq('id', row.id))
      } else if (resolvedMode === 'redact') {
        error = await anonymiseCareerRow(supabase, row, now)
      } else {
        ;({ error } = await supabase
          .from('career_applications')
          .update({ status: 'deleted', deleted_at: now, updated_at: now })
          .eq('id', row.id))
      }
      if (error) return { updated: ids.length, careerUpdated: careerIds.length, ids, careerIds, error }
      careerIds.push(row.id)
    }
  }

  if (ids.length || careerIds.length) {
    await writeAudit(supabase, {
      eventType: resolvedMode === 'physical' ? 'lead.deleted_physical' : 'lead.deleted_by_email',
      detail: deletionAuditDetail({ email: normalized, channel, mode: resolvedMode, ids, careerIds }),
    })
  }

  return { updated: ids.length, careerUpdated: careerIds.length, ids, careerIds, mode: resolvedMode, error: null }
}

async function loadExpiredLeads(supabase, { pageSources, cutoff }) {
  let query = supabase
    .from('leads')
    .select('id, email, payload, firma, page_source, status, anonymized_at, legal_hold')
    .is('anonymized_at', null)
    .lt('created_at', cutoff)
  if (pageSources.length === 1) query = query.eq('page_source', pageSources[0])
  else query = query.in('page_source', pageSources)
  const { data, error } = await query
  return { data: filterRetentionEligible(data || []), error }
}

/** Retention: redact/minimise expired rows. Skips legal_hold=true. Soft-delete is not a hold. */
export async function runRetention(
  supabase,
  {
    retentionDays = 90,
    privateRetentionDays = 90,
    careerRetentionDays = 183,
  } = {},
) {
  const now = new Date()
  const cutoffBusiness = new Date(now.getTime() - retentionDays * 86400000).toISOString()
  const cutoffPrivate = new Date(now.getTime() - privateRetentionDays * 86400000).toISOString()
  const cutoffCareer = new Date(now.getTime() - careerRetentionDays * 86400000).toISOString()
  const deletedAt = now.toISOString()

  const { data: business, error: e1 } = await loadExpiredLeads(supabase, {
    pageSources: ['unternehmen'],
    cutoff: cutoffBusiness,
  })
  if (e1) return { error: e1, business: 0, private: 0, career: 0 }

  const { data: privateRows, error: e2 } = await loadExpiredLeads(supabase, {
    pageSources: PRIVATE_SOURCES,
    cutoff: cutoffPrivate,
  })
  if (e2) return { error: e2, business: (business || []).length, private: 0, career: 0 }

  const { data: legacyCareer, error: e3 } = await loadExpiredLeads(supabase, {
    pageSources: ['career'],
    cutoff: cutoffCareer,
  })
  if (e3) {
    return {
      error: e3,
      business: (business || []).length,
      private: (privateRows || []).length,
      career: 0,
    }
  }

  const careerRes = await supabase
    .from('career_applications')
    .select('id, email, payload, full_name, status, anonymized_at, legal_hold')
    .is('anonymized_at', null)
    .lt('created_at', cutoffCareer)
  const e4 = careerRes.error
  const career = filterRetentionEligible(careerRes.data || [])
  if (e4) {
    return {
      error: e4,
      business: (business || []).length,
      private: (privateRows || []).length,
      career: 0,
    }
  }

  for (const row of business || []) {
    const error = await anonymiseLeadRow(supabase, row, deletedAt)
    if (error) return { error, business: 0, private: 0, career: 0 }
  }
  for (const row of privateRows || []) {
    const error = await anonymiseLeadRow(supabase, row, deletedAt)
    if (error) return { error, business: (business || []).length, private: 0, career: 0 }
  }
  for (const row of legacyCareer || []) {
    const error = await anonymiseLeadRow(supabase, row, deletedAt)
    if (error) {
      return {
        error,
        business: (business || []).length,
        private: (privateRows || []).length,
        career: 0,
      }
    }
  }
  for (const row of career || []) {
    const error = await anonymiseCareerRow(supabase, row, deletedAt)
    if (error) {
      return {
        error,
        business: (business || []).length,
        private: (privateRows || []).length,
        career: 0,
      }
    }
  }

  const businessIds = (business || []).map((r) => r.id)
  const privateIds = (privateRows || []).map((r) => r.id)
  const legacyCareerIds = (legacyCareer || []).map((r) => r.id)
  const careerIds = (career || []).map((r) => r.id)

  await writeAudit(supabase, {
    eventType: 'retention.completed',
    detail: {
      mode: 'anonymise',
      business_deleted: businessIds.length,
      private_deleted: privateIds.length,
      legacy_career_on_leads_deleted: legacyCareerIds.length,
      career_deleted: careerIds.length,
      cutoff_business: cutoffBusiness,
      cutoff_private: cutoffPrivate,
      cutoff_career: cutoffCareer,
    },
  })

  return {
    error: null,
    business: businessIds.length,
    private: privateIds.length,
    career: careerIds.length + legacyCareerIds.length,
    // backward-compatible aliases used by older scripts
    normal: businessIds.length + privateIds.length,
  }
}

const INBOX_LEAD_COLS =
  'id, lead_ref, page_source, lead_type, status, email, firma, source_page, created_at, mail_status, mail_mode, payload'
const INBOX_CAREER_COLS =
  'id, application_ref, status, email, full_name, source_page, created_at, mail_status, mail_mode, payload'

function clampInboxLimit(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n)) return 100
  return Math.min(200, Math.max(1, Math.trunc(n)))
}

/**
 * Ops inbox: full submitted payloads for authorized admin only.
 * Service-role client required (RLS has no public SELECT).
 */
export async function listOpsInbox(supabase, { limit = 100, includeDeleted = false } = {}) {
  const cap = clampInboxLimit(limit)
  let leadsQ = supabase
    .from('leads')
    .select(INBOX_LEAD_COLS)
    .order('created_at', { ascending: false })
    .limit(cap)
  let careerQ = supabase
    .from('career_applications')
    .select(INBOX_CAREER_COLS)
    .order('created_at', { ascending: false })
    .limit(cap)

  if (!includeDeleted) {
    leadsQ = leadsQ.neq('status', 'deleted')
    careerQ = careerQ.neq('status', 'deleted')
  }

  const [leadsRes, careerRes] = await Promise.all([leadsQ, careerQ])
  if (leadsRes.error) return { error: leadsRes.error, leads: [], careers: [] }
  if (careerRes.error) return { error: careerRes.error, leads: [], careers: [] }
  return {
    error: null,
    leads: leadsRes.data || [],
    careers: careerRes.data || [],
  }
}
