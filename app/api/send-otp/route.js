import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'
import { renderEmail } from '@/lib/emailTemplate'

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
      hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
    })
    console.log(`[send-otp] start email=${email} purpose=${purpose}`)

    const supabase = getServerSupabase()
    if (!supabase) {
      console.error('[send-otp] getServerSupabase returned null')
      return fail('服务端未配置 Supabase')
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
    if (!siteUrl) {
      console.error('[send-otp] NEXT_PUBLIC_SITE_URL 未配置，魔法链接无法生成')
    }

    // 限频检查改为「后台触发、不阻塞主流程」
    supabase
      .rpc('check_otp_rate_limit', { p_email: email })
      .then(({ data }) => {
        if (data === false) console.log('[send-otp] 限频：60 秒内已发过')
      })
      .catch(() => {})

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const token = randomBytes(24).toString('hex') // 48 位十六进制魔法令牌
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const magicLink = siteUrl ? `${siteUrl}/?magic_token=${token}` : ''

    // 写库 + 发邮件并行执行，总耗时 = max(写库, 发信)
    try {
      console.log('[send-otp] 并行：写库 + 发 Brevo')
      const [insRes, brevoOutcome] = await Promise.all([
        withTimeout(
          supabase
            .from('verification_tokens')
            .delete()
            .eq('email', email)
            .is('used_at', null)
            .then(() =>
              supabase
                .from('verification_tokens')
                .insert({ email, code, token, purpose, expires_at })
            ),
          4000,
          'verification_tokens 写入'
        ),
        withTimeout(
          sendBrevoEmail({
            to: email,
            subject: '中泰词典 · 邮箱登录验证码',
            ...renderEmail({
              heading: '中泰智能学习者词典登录验证',
              introHtml:
                '<p class="content">สวัสดี. 欢迎使用 ThaiDict 词典项目，请通过下方方式完成登录。</p>',
              code,
              codeLabel: '登录校验码（10 分钟有效）',
              primaryAction: magicLink
                ? { text: '或使用 Magic Link 一键登录', href: magicLink }
                : null,
              bottomTips:
                '链接仅单次可用，泄露请及时修改账号访问密钥。<br/>' +
                (magicLink
                  ? '一键登录按钮失效时，请复制链接访问：<span class="plain-link">' +
                    magicLink +
                    '</span><br/>'
                  : '') +
                '验证码十分钟内有效，超时需重新发送验证邮件；非本人操作可忽略。',
            }),
          }),
          8000,
          'Brevo 发送'
        )
          .then((r) => ({ ok: true, res: r }))
          .catch((e) => ({ ok: false, err: e })),
      ])
      if (insRes && insRes.error) {
        console.error('[send-otp] insert error:', insRes.error)
        return fail(insRes.error.message)
      }
      if (!brevoOutcome.ok) {
        console.error('[send-otp] Brevo 失败:', brevoOutcome.err)
        return fail('邮件发送失败：' + brevoOutcome.err.message)
      }
      console.log('[send-otp] Brevo 已接受 messageId=', brevoOutcome.res?.messageId || '(无)')
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
