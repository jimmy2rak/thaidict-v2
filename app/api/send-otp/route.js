import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'

export const runtime = 'nodejs'

export async function POST(req) {
  let email, purpose
  try {
    ({ email, purpose } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  purpose = purpose || 'login'
  if (!email) return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 60 秒限频：check_otp_rate_limit 返回 true = 「60 秒内无发送记录，可以发」
  // ⚠️ 之前写成 if (limited) return 429，但该函数返回的是「可以发」，导致首条请求被误判限频、
  //    永远 429、Brevo 邮件永远发不出。改为判断「不允许才拦截」。
  let allowed = true
  try {
    const { data } = await supabase.rpc('check_otp_rate_limit', { p_email: email })
    allowed = !!data
  } catch {
    allowed = true // 限频函数缺失时放行，避免硬失败阻断登录/注册
  }
  if (!allowed) return NextResponse.json({ error: '发送过于频繁，请 60 秒后再试' }, { status: 429 })

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { error: insErr } = await supabase
    .from('otp_codes')
    .insert({ email, code, purpose, expires_at })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  try {
    await sendBrevoEmail({
      to: email,
      subject: '中泰词典 · 邮箱验证码',
      html:
        '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F8F5EF;border-radius:16px">' +
        '<h2 style="color:#A68A5B;margin:0 0 12px">中泰词典</h2>' +
        '<p style="color:#433B32;margin:0 0 8px">你的验证码是：</p>' +
        `<p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#433B32;margin:0">${code}</p>` +
        '<p style="color:#6E8CA0;margin:12px 0 0">10 分钟内有效，请勿泄露给他人。</p></div>',
      text: `你的验证码是：${code}（10 分钟内有效）`,
    })
  } catch (e) {
    return NextResponse.json({ error: '邮件发送失败：' + e.message }, { status: 502 })
  }
  return NextResponse.json({ data: { sent: true } })
}
