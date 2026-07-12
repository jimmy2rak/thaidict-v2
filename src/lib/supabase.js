import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 关键切换点：配置了 Supabase 环境变量 → 真实后端；否则 → 模拟数据层（本地开发）
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

let supabase = null
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Prefer: 'return=representation' } },
  })
}

export { supabase }
