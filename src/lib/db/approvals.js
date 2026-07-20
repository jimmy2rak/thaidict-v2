// AI 生成内容审批。mock 走 localStorage；real 走 Supabase pending_approvals。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'

export async function createPendingApproval({ type, payload, requestedBy }) {
  if (!isSupabaseConfigured) {
    const list = getGlobal('pending_approvals', [])
    const row = {
      id: uid(),
      type,
      payload,
      status: 'pending',
      requested_by: requestedBy,
      reviewed_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.push(row)
    setGlobal('pending_approvals', list)
    return row
  }
  if (!supabase) return null
  const { data, error } = await safeQuery(
    supabase.from('pending_approvals').insert({ type, payload, requested_by: requestedBy, status: 'pending' }).select().single()
  )
  if (error) {
    console.error('[createPendingApproval]', error.message)
    return null
  }
  return data
}

export async function listPendingApprovals() {
  if (!isSupabaseConfigured) {
    return getGlobal('pending_approvals', []).filter((a) => a.status === 'pending')
  }
  if (!supabase) return []
  const { data, error } = await safeQuery(
    supabase.from('pending_approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false })
  )
  if (error) {
    console.error('[listPendingApprovals]', error.message)
    return []
  }
  return data || []
}

export async function getApproval(id) {
  if (!isSupabaseConfigured) {
    return getGlobal('pending_approvals', []).find((a) => a.id === id) || null
  }
  if (!supabase || !id) return null
  const { data } = await safeQuery(supabase.from('pending_approvals').select('*').eq('id', id).maybeSingle())
  return data || null
}

export async function approveApproval(id, reviewerId) {
  if (!isSupabaseConfigured) {
    const list = getGlobal('pending_approvals', [])
    const a = list.find((x) => x.id === id)
    if (!a) return null
    a.status = 'approved'
    a.reviewed_by = reviewerId
    a.updated_at = new Date().toISOString()
    setGlobal('pending_approvals', list)
    return a
  }
  if (!supabase || !id) return null
  const { data, error } = await safeQuery(
    supabase.from('pending_approvals').update({ status: 'approved', reviewed_by: reviewerId, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  )
  if (error) {
    console.error('[approveApproval]', error.message)
    return null
  }
  return data
}

export async function rejectApproval(id, reviewerId, reason) {
  if (!isSupabaseConfigured) {
    const list = getGlobal('pending_approvals', [])
    const a = list.find((x) => x.id === id)
    if (!a) return null
    a.status = 'rejected'
    a.reviewed_by = reviewerId
    a.reject_reason = reason || ''
    a.updated_at = new Date().toISOString()
    setGlobal('pending_approvals', list)
    return a
  }
  if (!supabase || !id) return null
  const { data, error } = await safeQuery(
    supabase.from('pending_approvals').update({ status: 'rejected', reviewed_by: reviewerId, reject_reason: reason || '', updated_at: new Date().toISOString() }).eq('id', id).select().single()
  )
  if (error) {
    console.error('[rejectApproval]', error.message)
    return null
  }
  return data
}

/**
 * 提交待审批后，异步通知所有有审阅权限的管理员（fire-and-forget）。
 * 走服务端路由 /api/send-review-reminder，由其查询审阅者并发送邮件。
 * 失败不影响主提交流程。
 */
export async function notifyReviewers({ type, payload, requestedBy } = {}) {
  try {
    fetch('/api/send-review-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, requestedBy }),
      keepalive: true,
    }).catch((e) => console.error('[notifyReviewers] fetch 失败:', e))
  } catch (e) {
    console.error('[notifyReviewers]', e)
  }
}
