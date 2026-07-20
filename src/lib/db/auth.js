// 认证。mock 模式模拟演示用户；real 模式走 Supabase Auth + Edge Function。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'

const MOCK_USER = {
  id: 'mock-user-001',
  email: 'demo@thaidict.local',
  user_metadata: { username: '演示用户', avatar_url: '' },
  app_metadata: {},
}
const MOCK_SESSION = { user: MOCK_USER, access_token: 'mock-token', expires_at: Date.now() + 86400000 }

function mockGetSession() {
  try {
    const raw = localStorage.getItem('thaidict:mock-session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function mockSetSession(s) {
  if (s) localStorage.setItem('thaidict:mock-session', JSON.stringify(s))
  else localStorage.removeItem('thaidict:mock-session')
}

// ---------- 导出 ----------
export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    mockSetSession(MOCK_SESSION)
    return { data: { user: MOCK_USER, session: MOCK_SESSION }, error: null }
  }
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email, password, username) {
  if (!isSupabaseConfigured) {
    // mock 跳过邮箱确认直接登录（修复 Bug D-2 的本地等价处理）
    mockSetSession(MOCK_SESSION)
    return { data: { user: MOCK_USER, session: MOCK_SESSION }, error: null }
  }
  try {
    const res = await fetch('/api/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error }
    // 注册成功后自动登录
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) return { data: null, error: signInErr.message }
    return { data: signInData, error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

// 规范回跳域名：优先用 NEXT_PUBLIC_SITE_URL（如 https://thaidict.182183.xyz），
// 确保 magic link / OAuth 回调始终回到同一域名，避免会话落在 vercel.app 而主域名读不到。
function redirectBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
}

export async function signInWithOAuth(provider) {
  if (!isSupabaseConfigured) {
    mockSetSession(MOCK_SESSION)
    return { data: { user: MOCK_USER, session: MOCK_SESSION }, error: null }
  }
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectBase() },
  })
}

export async function sendMagicLink(email) {
  if (!isSupabaseConfigured) {
    return { data: { sent: true }, error: null }
  }
  try {
    const res = await fetch('/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()
    return res.ok ? { data: json.data, error: null } : { data: null, error: json.error }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    mockSetSession(null)
    return { error: null }
  }
  return supabase.auth.signOut()
}

export async function updateUserPassword(newPassword) {
  if (!isSupabaseConfigured) return { data: {}, error: null }
  return supabase.auth.updateUser({ password: newPassword })
}

// 更新用户元数据（昵称、头像等），同时写入 Supabase user_metadata。
// mock 模式仅返回成功（localStorage 独立处理）。
export async function updateUserMeta(metadata) {
  if (!isSupabaseConfigured) return { data: { user: { ...MOCK_USER, user_metadata: { ...MOCK_USER.user_metadata, ...metadata } } }, error: null }
  return supabase.auth.updateUser({ data: metadata })
}

// OTP（Brevo）。mock 生成固定验证码；real 走 Next.js Route Handler（/api/send-otp）。
export async function sendOtp(email, purpose) {
  if (!isSupabaseConfigured) {
    const code = '123456'
    localStorage.setItem(`thaidict:otp:${email}:${purpose}`, code)
    return { data: { code }, error: null }
  }
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose }),
    })
    let json
    try {
      json = await res.json()
    } catch (parseErr) {
      const text = await res.text().catch(() => '')
      return {
        data: null,
        error: `服务端返回了非 JSON 响应（${res.status}）：${text.slice(0, 200)}`,
      }
    }
    return res.ok ? { data: json.data, error: null } : { data: null, error: json.error }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

export async function verifyBrevoOtp(email, code, purpose) {
  if (!isSupabaseConfigured) {
    const stored = localStorage.getItem(`thaidict:otp:${email}:${purpose}`)
    if (stored === String(code)) {
      mockSetSession(MOCK_SESSION)
      return { data: { email, session: MOCK_SESSION }, error: null }
    }
    return { data: null, error: '验证码错误' }
  }
  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, purpose }),
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error }
    // 后端已验证 OTP 并创建/更新用户，返回临时密码；前端用密码登录换取真实 session。
    const { password } = json.data || {}
    if (!password) return { data: null, error: '服务端未返回登录凭据' }
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInErr) return { data: null, error: signInErr.message }
    return { data: { session: signInData.session, user: signInData.user }, error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

export { MOCK_USER, MOCK_SESSION }
