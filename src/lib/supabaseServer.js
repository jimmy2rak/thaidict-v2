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
    // 注意：magiclink 的 verify 端点字段名为 token_hash（非 token），且【不能】带 email，
    // 否则报 "Only the token_hash and type should be provided" / "Token has expired or is invalid"。
    body: JSON.stringify({ token_hash: hashedToken, type: 'magiclink' }),
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

// 确保邮箱用户存在并确认，再签发 Supabase 会话。供 verify-otp / magic-login 复用。
// 不依赖 Supabase 的 Email 开关：用户用 admin API 创建/确认，会话用 mintSessionByEmail 兑换。
export async function ensureUserAndMintSession(supabase, email) {
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
    console.error('[ensureUser] auth user error:', e)
    throw new Error('用户创建/更新失败：' + (e.message || e))
  }

  const tokens = await mintSessionByEmail(supabase, email)
  return {
    userId,
    session: { access_token: tokens.access_token, refresh_token: tokens.refresh_token },
  }
}
