// 角色与权限。mock 走 localStorage；real 走 Supabase user_roles。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'

export const ROLE_LABELS = {
  super_admin: '超级管理员',
  admin: '管理员',
  user: '用户',
}

export const PERMISSION_OPTIONS = [
  { key: 'approve_entries', label: '审批 AI 词条/句子入库' },
  { key: 'manage_users', label: '管理用户权限' },
  { key: 'manage_settings', label: '管理系统设置' },
  { key: 'manage_system_ai', label: '管理系统内置 AI API' },
  { key: 'view_stats', label: '查看全站统计' },
]

export async function getUserRole(userId) {
  if (!isSupabaseConfigured) {
    const roles = getGlobal('user_roles', [])
    return roles.find((r) => r.user_id === userId) || { user_id: userId, role: 'user', permissions: [] }
  }
  if (!supabase || !userId) return { user_id: userId, role: 'user', permissions: [] }
  const { data } = await safeQuery(
    supabase.from('user_roles').select('*').eq('user_id', userId).maybeSingle()
  )
  return data || { user_id: userId, role: 'user', permissions: [] }
}

export async function listUsers() {
  if (!isSupabaseConfigured) {
    return getGlobal('users', [])
  }
  if (!supabase) return []
  // 客户端无法直接查询 auth.users，这里返回 user_roles 表中的记录；
  // 真实环境建议通过 Edge Function 返回用户列表。
  const { data, error } = await safeQuery(supabase.from('user_roles').select('*'))
  if (error) {
    console.error('[listUsers]', error.message)
    return []
  }
  return (data || []).map((r) => ({
    id: r.user_id,
    email: r.user_id,
    username: r.user_id,
    ...r,
  }))
}

export async function setUserRole(targetUserId, role, permissions) {
  if (!isSupabaseConfigured) {
    const roles = getGlobal('user_roles', [])
    const i = roles.findIndex((r) => r.user_id === targetUserId)
    const row = {
      user_id: targetUserId,
      role,
      permissions: permissions || [],
      updated_at: new Date().toISOString(),
    }
    if (i >= 0) roles[i] = row
    else roles.push(row)
    setGlobal('user_roles', roles)
    return row
  }
  if (!supabase || !targetUserId) return null
  const { data, error } = await safeQuery(
    supabase
      .from('user_roles')
      .upsert(
        { user_id: targetUserId, role, permissions: permissions || [], updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single()
  )
  if (error) {
    console.error('[setUserRole]', error.message)
    return null
  }
  return data
}

export async function setAdminPermissions(targetUserId, permissions) {
  const current = await getUserRole(targetUserId)
  // 超管权限只能在数据库手动调整，UI 中不提升为 super_admin
  const role = current.role === 'super_admin' ? 'super_admin' : 'admin'
  return setUserRole(targetUserId, role, permissions)
}

export function hasPermission(roleRow, permission) {
  if (!roleRow) return false
  if (roleRow.role === 'super_admin') return true
  if (roleRow.permissions?.includes('all')) return true
  return roleRow.permissions?.includes(permission) || false
}

export function isSuperAdmin(roleRow) {
  return roleRow?.role === 'super_admin'
}

export function isAdmin(roleRow) {
  return roleRow?.role === 'admin' || roleRow?.role === 'super_admin'
}
