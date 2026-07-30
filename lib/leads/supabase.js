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

export async function writeAudit(supabase, { leadId = null, eventType, detail = {} }) {
  const { error } = await supabase.from('audit_events').insert({
    lead_id: leadId,
    event_type: eventType,
    detail,
  })
  return { error }
}

export async function softDeleteByEmail(supabase, email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return { updated: 0, error: new Error('email required') }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: now, updated_at: now })
    .eq('email', normalized)
    .neq('status', 'deleted')
    .select('id')

  if (error) return { updated: 0, ids: [], error }
  const ids = (data || []).map((r) => r.id)
  if (ids.length) {
    await writeAudit(supabase, {
      eventType: 'lead.deleted_by_email',
      detail: { email: normalized, count: ids.length, lead_ids: ids },
    })
  }
  return { updated: ids.length, ids, error: null }
}

/** Retention: soft-delete non-career leads older than retentionDays (default 90). */
export async function runRetention(supabase, { retentionDays = 90, careerRetentionDays = 183 } = {}) {
  const now = new Date()
  const cutoffNormal = new Date(now.getTime() - retentionDays * 86400000).toISOString()
  const cutoffCareer = new Date(now.getTime() - careerRetentionDays * 86400000).toISOString()
  const deletedAt = now.toISOString()

  const { data: normal, error: e1 } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .neq('page_source', 'career')
    .neq('status', 'deleted')
    .lt('created_at', cutoffNormal)
    .select('id')

  if (e1) return { error: e1, normal: 0, career: 0 }

  const { data: career, error: e2 } = await supabase
    .from('leads')
    .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
    .eq('page_source', 'career')
    .neq('status', 'deleted')
    .lt('created_at', cutoffCareer)
    .select('id')

  if (e2) return { error: e2, normal: (normal || []).length, career: 0 }

  const normalIds = (normal || []).map((r) => r.id)
  const careerIds = (career || []).map((r) => r.id)
  await writeAudit(supabase, {
    eventType: 'retention.completed',
    detail: {
      normal_deleted: normalIds.length,
      career_deleted: careerIds.length,
      cutoff_normal: cutoffNormal,
      cutoff_career: cutoffCareer,
    },
  })

  return { error: null, normal: normalIds.length, career: careerIds.length }
}
