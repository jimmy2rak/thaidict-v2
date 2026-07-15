import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

// 临时密码长度
const TEMP_PASSWORD_LEN = 32

function generatePassword(len = TEMP_PASSWORD_LEN) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+'
  let out = ''
  const buf = new Uint8Array(len)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  for (let i = 0; i < len; i++) {
    out += chars[buf[i] % chars.length]
  }
  return out
}

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

  // 3. 生成临时密码并创建/更新用户（邮箱自动确认，无需 Supabase 自带邮件验证）
  const tempPassword = generatePassword()
  let userId = null
  try {
    // 先按邮箱查找已有用户（listUsers 最多拉 1000 条，对一般项目足够）
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) throw listErr
    const existing = list?.users?.find((u) => u.email === email)
    if (existing) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
      })
      if (updErr) throw updErr
      userId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })
      if (createErr) throw createErr
      userId = created.user.id
    }
  } catch (e) {
    console.error('[verify-otp] auth user error:', e)
    return NextResponse.json({ error: '用户创建/更新失败：' + (e.message || e) }, { status: 500 })
  }

  // 4. 返回临时密码，前端用 supabase.auth.signInWithPassword 换取真实 session
  return NextResponse.json({
    data: {
      email,
      user_id: userId,
      password: tempPassword,
    },
  })
}
