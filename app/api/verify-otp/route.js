import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function POST(req) {
  let email, code, purpose
  try {
    ({ email, code, purpose } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  purpose = purpose || 'login'
  if (!email || !code) return NextResponse.json({ error: '参数缺失' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  const { data: rows, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rec = rows?.[0]
  if (!rec) return NextResponse.json({ error: '验证码不存在或已过期' }, { status: 400 })
  if (new Date(rec.expires_at) < new Date()) return NextResponse.json({ error: '验证码已过期' }, { status: 400 })
  if (rec.code !== String(code)) return NextResponse.json({ error: '验证码错误' }, { status: 400 })

  await supabase.from('otp_codes').delete().eq('id', rec.id)
  return NextResponse.json({ data: { ok: true } })
}
