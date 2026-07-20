import { NextResponse } from 'next/server'
import { getServerSupabase, ensureUserAndMintSession } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function POST(req) {
  let token
  try {
    ({ token } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  if (!token) return NextResponse.json({ error: '缺少令牌' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 1. 按魔法令牌查找（未使用且未过期）
  const { data: rows, error } = await supabase
    .from('verification_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rec = rows?.[0]
  if (!rec) return NextResponse.json({ error: '登录链接无效或已使用' }, { status: 400 })
  if (new Date(rec.expires_at) < new Date()) return NextResponse.json({ error: '登录链接已过期' }, { status: 400 })

  // 2. 标记已使用（防重放）
  await supabase.from('verification_tokens').update({ used_at: new Date().toISOString() }).eq('id', rec.id)

  // 3. 创建/确认用户并签发会话（绕开 Email 开关）
  let result
  try {
    result = await ensureUserAndMintSession(supabase, rec.email)
  } catch (e) {
    console.error('[magic-login] mint session error:', e)
    return NextResponse.json({ error: '签发会话失败：' + (e.message || e) }, { status: 500 })
  }

  return NextResponse.json({
    data: { email: rec.email, user_id: result.userId, session: result.session },
  })
}
