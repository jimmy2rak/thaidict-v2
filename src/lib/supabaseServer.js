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
