import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'

export const runtime = 'nodejs'

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时（${ms}ms 未完成）`)), ms)
    ),
  ])
}

export async function POST(req) {
  try {
    let email, purpose
    try {
      ({ email, purpose } = await req.json())
    } catch {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
    }
    purpose = purpose || 'login'
    if (!email) return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 })

    console.log(`[send-otp] start email=${email} purpose=${purpose}`)

    const supabase = getServerSupabase()
    if (!supabase) {
      console.error('[send-otp] getServerSupabase returned null')
      return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })
    }

    // 60 秒限频：check_otp_rate_limit 返回 true = 「60 秒内无发送记录，可以发」
    let allowed = true
    try {
      console.log('[send-otp] checking rate limit')
      const { data } = await withTimeout(
        supabase.rpc('check_otp_rate_limit', { p_email: email }),
        5000,
        '限频检查(check_otp_rate_limit)'
      )
      allowed = !!data
      console.log('[send-otp] rate limit allowed=', allowed)
    } catch (rlErr) {
      console.warn('[send-otp] rate limit error, allow:', rlErr.message)
      allowed = true
    }
    if (!allowed) {
      return NextResponse.json({ error: '发送过于频繁，请 60 秒后再试' }, { status: 429 })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    console.log('[send-otp] inserting otp record')
    const { error: insErr } = await withTimeout(
      supabase.from('otp_codes').insert({ email, code, purpose, type: 'email', expires_at }),
      5000,
      'otp_codes 写入'
    )
    if (insErr) {
      console.error('[send-otp] insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    console.log('[send-otp] insert ok')

    try {
      console.log('[send-otp] calling Brevo')
      await withTimeout(
        sendBrevoEmail({
          to: email,
          subject: '中泰词典 · 邮箱验证码',
          html:
            '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F8F5EF;border-radius:16px">' +
            '<h2 style="color:#A68A5B;margin:0 0 12px">中泰词典</h2>' +
            '<p style="color:#433B32;margin:0 0 8px">你的验证码是：</p>' +
            `<p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#433B32;margin:0">${code}</p>` +
            '<p style="color:#6E8CA0;margin:12px 0 0">10 分钟内有效，请勿泄露给他人。</p></div>',
          text: `你的验证码是：${code}（10 分钟内有效）`,
        }),
        10000,
        'Brevo 发送'
      )
      console.log('[send-otp] Brevo ok')
    } catch (e) {
      console.error('[send-otp] Brevo 发送失败:', e)
      return NextResponse.json({ error: '邮件发送失败：' + e.message }, { status: 502 })
    }
    return NextResponse.json({ data: { sent: true } })
  } catch (e) {
    console.error('[send-otp] 未捕获异常:', e)
    return NextResponse.json({ error: '服务端异常：' + (e.message || String(e)) }, { status: 500 })
  }
}
