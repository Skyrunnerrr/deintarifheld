import { createClient } from '@supabase/supabase-js'

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
    .select('id, lead_ref, created_at, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentDuplicate(supabase, { email, pageSource, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('leads')
    .select('id, lead_ref, created_at')
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
    .select('id, application_ref, created_at, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return { data, error }
}

export async function findRecentCareerDuplicate(supabase, { email, withinSeconds = 60 }) {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from('career_applications')
    .select('id, application_ref, created_at')
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

/**
 * Soft-delete by email across leads and career applications.
 * channel: 'all' | 'business' | 'private' | 'career'
 */
export async function softDeleteByEmail(supabase, email, { channel = 'all' } = {}) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error: new Error('email required') }

  const now = new Date().toISOString()
  let ids = []
  let careerIds = []

  if (channel === 'all' || channel === 'business' || channel === 'private') {
    let query = supabase
      .from('leads')
      .update({ status: 'deleted', deleted_at: now, updated_at: now })
      .eq('email', normalized)
      .neq('status', 'deleted')

    if (channel === 'business') query = query.eq('page_source', 'unternehmen')
    if (channel === 'private') {
      query = query.in('page_source', ['privat', 'hero-funnel', 'main_funnel'])
    }

    const { data, error } = await query.select('id')
    if (error) return { updated: 0, careerUpdated: 0, ids: [], careerIds: [], error }
    ids = (data || []).map((r) => r.id)
  }

  if (channel === 'all' || channel === 'career') {
    const { data, error } = await supabase
      .from('career_applications')
      .update({ status: 'deleted', deleted_at: now, updated_at: now })
      .eq('email', normalized)
      .neq('status', 'deleted')
      .select('id')
    if (error) return { updated: ids.length, careerUpdated: 0, ids, careerIds: [], error }
    careerIds = (data || []).map((r) => r.id)
  }

  if (ids.length || careerIds.length) {
    await writeAudit(supabase, {
      eventType: 'lead.deleted_by_email',
      detail: {
        email: normalized,
        channel,
        count: ids.length,
        career_count: careerIds.length,
        lead_ids: ids,
        career_ids: careerIds,
      },
    })
  }

  return { updated: ids.length, careerUpdated: careerIds.length, ids, careerIds, error: null }
}

/** Retention: soft-delete by channel cutoffs. */
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

  const { data: business, error: e1 } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .eq('page_source', 'unternehmen')
    .neq('status', 'deleted')
    .lt('created_at', cutoffBusiness)
    .select('id')
  if (e1) return { error: e1, business: 0, private: 0, career: 0 }

  const { data: privateRows, error: e2 } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .in('page_source', ['privat', 'hero-funnel', 'main_funnel'])
    .neq('status', 'deleted')
    .lt('created_at', cutoffPrivate)
    .select('id')
  if (e2) return { error: e2, business: (business || []).length, private: 0, career: 0 }

  // Legacy career rows that may still exist on leads table
  const { data: legacyCareer, error: e3 } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .eq('page_source', 'career')
    .neq('status', 'deleted')
    .lt('created_at', cutoffCareer)
    .select('id')
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
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .neq('status', 'deleted')
    .lt('created_at', cutoffCareer)
    .select('id')
  if (e4) {
    return {
      error: e4,
      business: (business || []).length,
      private: (privateRows || []).length,
      career: 0,
    }
  }

  const businessIds = (business || []).map((r) => r.id)
  const privateIds = (privateRows || []).map((r) => r.id)
  const legacyCareerIds = (legacyCareer || []).map((r) => r.id)
  const careerIds = (career || []).map((r) => r.id)

  await writeAudit(supabase, {
    eventType: 'retention.completed',
    detail: {
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
