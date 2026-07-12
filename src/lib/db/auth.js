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
  return supabase.auth.signUp({ email, password, options: { data: { username } } })
}

export async function signInWithOAuth(provider) {
  if (!isSupabaseConfigured) {
    mockSetSession(MOCK_SESSION)
    return { data: { user: MOCK_USER, session: MOCK_SESSION }, error: null }
  }
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + '/auth/callback' },
  })
}

export async function sendMagicLink(email) {
  if (!isSupabaseConfigured) {
    return { data: {}, error: null }
  }
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
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

// OTP（Brevo）。mock 生成固定验证码；real 走 Edge Function。
export async function sendOtp(email, purpose) {
  if (!isSupabaseConfigured) {
    const code = '123456'
    localStorage.setItem(`thaidict:otp:${email}:${purpose}`, code)
    return { data: { code }, error: null }
  }
  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/send-otp`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email, purpose }),
    })
    const json = await res.json()
    return res.ok ? { data: json, error: null } : { data: null, error: json.error }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

export async function verifyBrevoOtp(email, code, purpose) {
  if (!isSupabaseConfigured) {
    const stored = localStorage.getItem(`thaidict:otp:${email}:${purpose}`)
    if (stored === String(code)) {
      mockSetSession(MOCK_SESSION)
      return { data: { email }, error: null }
    }
    return { data: null, error: '验证码错误' }
  }
  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/verify-otp`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email, code, purpose }),
    })
    const json = await res.json()
    if (res.ok) mockSetSession(MOCK_SESSION)
    return res.ok ? { data: json, error: null } : { data: null, error: json.error }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

export { MOCK_USER, MOCK_SESSION }
