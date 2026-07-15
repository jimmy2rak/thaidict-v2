import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function POST(req) {
  let email, password, username
  try {
    ({ email, password, username } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  if (!email || !password) return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: '密码至少需要 6 位' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 直接创建已确认用户，跳过 Supabase 自带邮件验证
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: username ? { full_name: username } : {},
  })
  if (error) {
    if (error.message?.includes('already been registered')) {
      return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: { user: data.user } })
}
