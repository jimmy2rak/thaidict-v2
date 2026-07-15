import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 校验调用者是否为超级管理员：
// 1) 用 anon client 解析 Bearer token 拿到 auth.uid()
// 2) 用 service_role 读该用户的 user_roles.role
// 返回 { userId, role } 或 null
async function requireSuperAdmin(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const uid = userData.user.id
  const server = getServerSupabase()
  if (!server) return null
  const { data: roleRow } = await server
    .from('user_roles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle()
  return { userId: uid, role: roleRow?.role || 'user' }
}

// GET /api/admin/users —— 返回全部成员（含尚未分配角色者）及其角色
export async function GET(req) {
  const caller = await requireSuperAdmin(req.headers.get('authorization'))
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: '仅超级管理员可访问' }, { status: 403 })
  }

  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 全部 auth 用户（含邮箱、注册时间）
  const { data: listData, error: listErr } = await server.auth.admin.listUsers({
    perPage: 1000,
  })
  if (listErr) {
    console.error('[api/admin/users] listUsers error:', listErr.message)
    return NextResponse.json({ error: '读取用户列表失败' }, { status: 500 })
  }

  // 全部角色行
  const { data: roles, error: roleErr } = await server.from('user_roles').select('*')
  if (roleErr) {
    console.error('[api/admin/users] roles error:', roleErr.message)
    return NextResponse.json({ error: '读取角色失败' }, { status: 500 })
  }

  const roleMap = new Map((roles || []).map((r) => [r.user_id, r]))
  const users = (listData?.users || []).map((u) => {
    const r = roleMap.get(u.id)
    return {
      id: u.id,
      user_id: u.id,
      email: u.email || '',
      username: (u.email || '').split('@')[0] || u.id,
      created_at: u.created_at,
      role: r?.role || 'user',
      permissions: r?.permissions || [],
    }
  })

  return NextResponse.json({ users })
}
