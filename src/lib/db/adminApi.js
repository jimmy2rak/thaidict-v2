// 前端管理封装：超管在「用户权限管理」中列出成员 / 调整角色。
// 真实模式走服务端代理（/api/admin/*，service_role 绕过 RLS）；
// mock 模式回退到本地 roles.js。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { listUsers, setUserRole } from './roles.js'

async function bearer() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || ''
}

// 拉取全部成员（含未分配角色者）
export async function fetchMembers() {
  if (!isSupabaseConfigured) return listUsers()
  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${await bearer()}` },
    })
    if (!res.ok) {
      console.error('[fetchMembers]', res.status)
      return []
    }
    const json = await res.json()
    return json.users || []
  } catch (e) {
    console.error('[fetchMembers]', e)
    return []
  }
}

// 调整成员角色（仅 user / admin；super_admin 由 DB 手动设置）
export async function adminSetRole(targetUserId, role, permissions) {
  if (!isSupabaseConfigured) return setUserRole(targetUserId, role, permissions)
  const res = await fetch('/api/admin/set-role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await bearer()}`,
    },
    body: JSON.stringify({ targetUserId, role, permissions }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '设置失败')
  return json
}
