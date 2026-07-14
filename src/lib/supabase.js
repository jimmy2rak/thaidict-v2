import { createClient } from '@supabase/supabase-js'

// Next.js 环境：客户端可读的环境变量需加 NEXT_PUBLIC_ 前缀
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 关键切换点：配置了 Supabase 环境变量 → 真实后端；否则 → 模拟数据层（本地开发）
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

let supabase = null
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Prefer: 'return=representation' } },
    auth: {
      // 关闭易竞态的自动 URL 会话检测，改由 AppContext 显式处理回调（magic link / OTP / OAuth）
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  })
}

export { supabase }
