// 仅服务端使用（API Route）。绝不在前端导入。
// 解析调用者身份并读取其 user_roles(role/permissions)，供管理类路由鉴权。
import { supabase } from './supabase.js'
import { getServerSupabase } from './supabaseServer.js'

// 返回 { userId, role, permissions } 或 null（未登录/无效 token）
export async function getCallerRoleRow(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: userData, error } = await supabase.auth.getUser(token)
  if (error || !userData?.user) return null
  const uid = userData.user.id
  const server = getServerSupabase()
  if (!server) return null
  const { data: row } = await server
    .from('user_roles')
    .select('role, permissions')
    .eq('user_id', uid)
    .maybeSingle()
  return { userId: uid, role: row?.role || 'user', permissions: row?.permissions || [] }
}

// 是否可管理系统内置 AI API：超管，或拥有 manage_system_ai 权限的管理员
export function canManageSystemAi(row) {
  if (!row) return false
  if (row.role === 'super_admin') return true
  if (row.role === 'admin' && (row.permissions || []).includes('manage_system_ai')) return true
  return false
}
