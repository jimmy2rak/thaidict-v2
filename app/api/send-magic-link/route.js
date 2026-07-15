import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'

export const runtime = 'nodejs'

export async function POST(req) {
  let email
  try {
    ({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  if (!email) return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || 'https://thaidict.182183.xyz'

  // 生成 Supabase Magic Link（由 Brevo 发送，不走 Supabase 自带邮件服务）
  let actionLink
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    if (error) throw error
    actionLink = data?.properties?.action_link
    if (!actionLink) throw new Error('未生成登录链接')
  } catch (e) {
    console.error('[send-magic-link] generateLink error:', e)
    return NextResponse.json({ error: '生成登录链接失败：' + (e.message || e) }, { status: 500 })
  }

  try {
    await sendBrevoEmail({
      to: email,
      subject: '中泰词典 · 邮箱登录链接',
      html:
        '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F8F5EF;border-radius:16px">' +
        '<h2 style="color:#A68A5B;margin:0 0 12px">中泰词典</h2>' +
        '<p style="color:#433B32;margin:0 0 8px">点击以下链接即可登录：</p>' +
        `<a href="${actionLink}" style="display:inline-block;padding:12px 20px;background:#A68A5B;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">立即登录</a>` +
        '<p style="color:#6E8CA0;margin:12px 0 0">链接 10 分钟内有效，请勿泄露给他人。</p></div>',
      text: `点击以下链接登录中泰词典：${actionLink}（10 分钟内有效）`,
    })
  } catch (e) {
    return NextResponse.json({ error: '邮件发送失败：' + e.message }, { status: 502 })
  }
  return NextResponse.json({ data: { sent: true } })
}
