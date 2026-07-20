// 仅服务端使用（API Route / Server Component）。绝不在前端导入此文件。
// 使用 service_role 密钥，可绕过 RLS 写入 otp_codes 等服务端表。
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getServerSupabase() {
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// 服务端签发会话：用 admin generateLink（magiclink）拿到 hashed_token，
// 再直接调用官方 /auth/v1/verify 端点兑换 access_token / refresh_token。
// 关键点：admin generateLink 与 verify 端点均不受 Auth 面板「Email 登录关闭」限制，
// 因此本函数能在 Email provider 关闭的情况下完成登录（绕过 signInWithPassword）。
export async function mintSessionByEmail(supabase, email) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('服务端未配置 Supabase URL / Anon Key')

  // 1) 生成 magic link，取 token_hash（hashed_token）
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) throw linkErr
  const hashedToken = linkData?.properties?.hashed_token
  if (!hashedToken) throw new Error('生成登录链接失败：未返回 token')

  // 2) 直接调用 verify 端点兑换会话（复刻 supabase.auth.verifyToken，该版本 js 未暴露此方法）
  const verifyRes = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ token: hashedToken, type: 'magiclink', email }),
  })
  const verifyJson = await verifyRes.json().catch(() => ({}))
  if (!verifyRes.ok) {
    throw new Error(verifyJson?.msg || verifyJson?.message || `verify 失败(${verifyRes.status})`)
  }
  const access_token = verifyJson?.access_token
  const refresh_token = verifyJson?.refresh_token
  if (!access_token || !refresh_token) {
    throw new Error('兑换会话失败：未返回 access_token / refresh_token')
  }
  return { access_token, refresh_token }
}
