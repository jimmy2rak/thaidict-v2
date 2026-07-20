import { NextResponse } from 'next/server'
import { getServerSupabase, mintSessionByEmail } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function POST(req) {
  let email, code, purpose
  try {
    ({ email, code, purpose } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  purpose = purpose || 'login'
  if (!email || !code) return NextResponse.json({ error: '参数缺失' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 1. 验证 OTP（只取最新一条，且未过期）
  const { data: rows, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rec = rows?.[0]
  if (!rec) return NextResponse.json({ error: '验证码不存在或已过期' }, { status: 400 })
  if (new Date(rec.expires_at) < new Date()) return NextResponse.json({ error: '验证码已过期' }, { status: 400 })
  if (rec.code !== String(code)) return NextResponse.json({ error: '验证码错误' }, { status: 400 })

  // 2. 删除已使用的 OTP
  await supabase.from('otp_codes').delete().eq('id', rec.id)

  // 3. 创建/更新用户（邮箱自动确认，无需 Supabase 自带邮件验证）
  let userId = null
  try {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) throw listErr
    const existing = list?.users?.find((u) => u.email === email)
    if (existing) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      })
      if (updErr) throw updErr
      userId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createErr) throw createErr
      userId = created.user.id
    }
  } catch (e) {
    console.error('[verify-otp] auth user error:', e)
    return NextResponse.json({ error: '用户创建/更新失败：' + (e.message || e) }, { status: 500 })
  }

  // 4. 服务端直接签发会话（绕开 signInWithPassword / Email 开关限制）
  let session
  try {
    const tokens = await mintSessionByEmail(supabase, email)
    session = { access_token: tokens.access_token, refresh_token: tokens.refresh_token }
  } catch (e) {
    console.error('[verify-otp] mint session error:', e)
    return NextResponse.json({ error: '签发会话失败：' + (e.message || e) }, { status: 500 })
  }

  return NextResponse.json({
    data: { email, user_id: userId, session },
  })
}

