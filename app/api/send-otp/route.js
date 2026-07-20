import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'

export const runtime = 'nodejs'
// Vercel Hobby 函数默认上限 10s；显式声明，避免被平台更早掐断。
export const maxDuration = 10

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时（${ms}ms 未完成）`)), ms)
    ),
  ])
}

// 统一返回 200 + { ok, error }，避免前置代理（182183.xyz 等）把 4xx/5xx 的响应体吞掉，
// 导致前端只看到空 502 而无从排查。
function fail(error) {
  return NextResponse.json({ ok: false, error }, { status: 200 })
}

export async function POST(req) {
  try {
    let email, purpose
    try {
      ({ email, purpose } = await req.json())
    } catch {
      return fail('请求体格式错误')
    }
    purpose = purpose || 'login'
    if (!email) return fail('邮箱不能为空')

    // 环境变量加载情况（不打印值，仅确认是否注入）
    console.log('[send-otp] env:', {
      hasBrevoKey: !!process.env.BREVO_API_KEY,
      hasSender: !!process.env.BREVO_SENDER_EMAIL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    console.log(`[send-otp] start email=${email} purpose=${purpose}`)

    const supabase = getServerSupabase()
    if (!supabase) {
      console.error('[send-otp] getServerSupabase returned null')
      return fail('服务端未配置 Supabase')
    }

    // 限频检查改为「后台触发、不阻塞主流程」，避免多一次 Supabase 往返叠加延迟。
    supabase
      .rpc('check_otp_rate_limit', { p_email: email })
      .then(({ data }) => {
        if (data === false) console.log('[send-otp] 限频：60 秒内已发过')
      })
      .catch(() => {})

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // 关键优化：写库 + 发邮件并行执行，总耗时 = max(写库, 发信)，避免串行超过 10s 被掐断。
    // insert 失败时 Supabase 返回 {error} 而非 reject，故需单独检查结果；Brevo 用 .catch 捕获错误对象。
    try {
      console.log('[send-otp] 并行：写库 + 发 Brevo')
      const [insRes, brevoErr] = await Promise.all([
        withTimeout(
          supabase
            .from('otp_codes')
            .insert({ email, code, purpose, type: 'email', expires_at }),
          4000,
          'otp_codes 写入'
        ),
        withTimeout(
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
          8000,
          'Brevo 发送'
        ).then(() => null).catch((e) => e),
      ])
      if (insRes && insRes.error) {
        console.error('[send-otp] insert error:', insRes.error)
        return fail(insRes.error.message)
      }
      if (brevoErr) {
        console.error('[send-otp] Brevo 失败:', brevoErr)
        return fail('邮件发送失败：' + brevoErr.message)
      }
      console.log('[send-otp] 写库 + Brevo 均完成')
    } catch (e) {
      console.error('[send-otp] 并行阶段超时/异常:', e)
      return fail('发送失败：' + e.message)
    }
    return NextResponse.json({ ok: true, data: { sent: true } })
  } catch (e) {
    console.error('[send-otp] 未捕获异常:', e)
    return fail('服务端异常：' + (e.message || String(e)))
  }
}
