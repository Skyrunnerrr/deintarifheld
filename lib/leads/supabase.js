import { createClient } from '@supabase/supabase-js'
import {
  ANONYMISED_EMAIL,
  anonymisePayload,
  emailAuditPseudonym,
  isDeletionMode,
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

async function loadLeadsForDeletion(supabase, email, channel) {
  let query = supabase
    .from('leads')
    .select('id, email, payload, firma, page_source, status')
    .eq('email', email)
    .neq('status', 'deleted')
  query = applyLeadChannelFilter(query, channel)
  const { data, error } = await query
  return { rows: data || [], error }
}

async function loadCareersForDeletion(supabase, email) {
  const { data, error } = await supabase
    .from('career_applications')
    .select('id, email, payload, full_name, status')
    .eq('email', email)
    .neq('status', 'deleted')
  return { rows: data || [], error }
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
 * Soft-delete / legal hold by email. Payload stays intact.
 * channel: 'all' | 'business' | 'private' | 'career'
 * Delete audits never store plaintext email.
 */
export async function softDeleteByEmail(supabase, email, { channel = 'all' } = {}) {
  return processLeadDeletion(supabase, email, { channel, mode: 'soft' })
}

/**
 * mode:
 *   soft       — status=deleted, payload intact (legal hold)
 *   anonymise  — status=deleted, identity/contact/message PII removed (default admin erase)
 *   physical   — row deleted
 */
export async function processLeadDeletion(supabase, email, { channel = 'all', mode = 'anonymise' } = {}) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error: new Error('email required') }
  const resolvedMode = isDeletionMode(mode) ? mode : 'anonymise'
  const now = new Date().toISOString()
  let ids = []
  let careerIds = []

  if (channel === 'all' || channel === 'business' || channel === 'private') {
    const loaded = await loadLeadsForDeletion(supabase, normalized, channel)
    if (loaded.error) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error: loaded.error }
    for (const row of loaded.rows) {
      let error = null
      if (resolvedMode === 'physical') {
        ;({ error } = await supabase.from('leads').delete().eq('id', row.id))
      } else if (resolvedMode === 'anonymise') {
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
    const loaded = await loadCareersForDeletion(supabase, normalized)
    if (loaded.error) return { updated: ids.length, careerUpdated: 0, ids, careerIds: [], error: loaded.error }
    for (const row of loaded.rows) {
      let error = null
      if (resolvedMode === 'physical') {
        ;({ error } = await supabase.from('career_applications').delete().eq('id', row.id))
      } else if (resolvedMode === 'anonymise') {
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
    .select('id, email, payload, firma, page_source, status')
    .neq('status', 'deleted')
    .is('anonymized_at', null)
    .lt('created_at', cutoff)
  if (pageSources.length === 1) query = query.eq('page_source', pageSources[0])
  else query = query.in('page_source', pageSources)
  return query
}

/** Retention: anonymise expired rows (not status-only). Soft-delete/legal hold is a separate mode. */
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

  const { data: career, error: e4 } = await supabase
    .from('career_applications')
    .select('id, email, payload, full_name, status')
    .neq('status', 'deleted')
    .is('anonymized_at', null)
    .lt('created_at', cutoffCareer)
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
