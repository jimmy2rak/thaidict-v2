import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

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

// POST /api/admin/set-role —— 提升/调整成员角色
// body: { targetUserId, role, permissions }
// 安全约束：UI 永远不能把任何人设为 super_admin（超管只能 DB 手动设置）
export async function POST(req) {
  const caller = await requireSuperAdmin(req.headers.get('authorization'))
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: '仅超级管理员可操作' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const { targetUserId, role, permissions } = body || {}
  if (!targetUserId || !role) {
    return NextResponse.json({ error: '缺少 targetUserId 或 role' }, { status: 400 })
  }
  if (!['user', 'admin'].includes(role)) {
    // 拒绝任何试图设置 super_admin 的请求
    return NextResponse.json(
      { error: '超级管理员只能通过数据库手动设置，UI 不可操作' },
      { status: 400 }
    )
  }

  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  const { error } = await server
    .from('user_roles')
    .upsert(
      {
        user_id: targetUserId,
        role,
        permissions: permissions || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[api/admin/set-role] upsert error:', error.message)
    return NextResponse.json({ error: '写入角色失败：' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
