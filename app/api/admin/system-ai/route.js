import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { supabase } from '@/lib/supabase'
import { getCallerRoleRow, canManageSystemAi } from '@/lib/serverAdminAuth'

export const runtime = 'nodejs'

const SYSTEM_AI_CONFIG_KEY = process.env.SYSTEM_AI_CONFIG_KEY || 'ai_system_api'

function readKey(raw) {
  const v = typeof raw === 'string' ? { api_key: raw } : raw || {}
  return v.api_key || v.apiKey || v.key || v.token || v.apiToken || v.secret || v.api_secret || ''
}

function detectKeyFields(raw) {
  const v = typeof raw === 'string' ? {} : raw || {}
  return Object.keys(v).filter((k) => /key|token|secret|api/i.test(k))
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 4) return '••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

// GET /api/admin/system-ai —— 任意登录用户可读，密钥打码返回
export async function GET(req) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { error: authErr } = await supabase.auth.getUser(token)
  if (authErr) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  const { data } = await server
    .from('system_config')
    .select('value')
    .eq('key', SYSTEM_AI_CONFIG_KEY)
    .maybeSingle()

  const v = data?.value || {}
  const apiKey = readKey(v)
  const keyFields = detectKeyFields(data?.value)
  return NextResponse.json({
    provider: v.provider || 'openai',
    base_url: v.base_url || v.baseUrl || v.endpoint || '',
    model: v.model || v.modelId || '',
    keySet: !!apiKey,
    keyMasked: maskKey(apiKey),
    configKey: SYSTEM_AI_CONFIG_KEY,
    notFound: !data,
    hint: data && !apiKey
      ? (keyFields.length
        ? `配置存在，但未识别出 api_key；已发现字段：${keyFields.join(', ')}`
        : '配置存在，但缺少可识别的 api_key/token/secret 字段')
      : !data
        ? `未在 system_config 中找到 key="${SYSTEM_AI_CONFIG_KEY}" 的配置`
        : '',
  })
}

// POST /api/admin/system-ai —— 仅超管或拥有 manage_system_ai 权限的管理员可写
export async function POST(req) {
  const row = await getCallerRoleRow(req.headers.get('authorization'))
  if (!canManageSystemAi(row)) {
    return NextResponse.json({ error: '仅超级管理员或被授权管理员可编辑系统内置 AI API' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const { provider, base_url, model, key } = body || {}
  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 读取现有配置，key 留空则保留原值
  const { data: existing } = await server
    .from('system_config')
    .select('value')
    .eq('key', SYSTEM_AI_CONFIG_KEY)
    .maybeSingle()
  const cur = existing?.value || {}
  const curKey = readKey(cur)

  const newVal = {
    provider: provider || cur.provider || 'openai',
    api_key: key && String(key).trim() ? String(key).trim() : curKey,
    base_url: base_url || cur.base_url || cur.baseUrl || '',
    model: model || cur.model || '',
  }

  const { error } = await server
    .from('system_config')
    .upsert(
      { key: SYSTEM_AI_CONFIG_KEY, value: newVal, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) {
    console.error('[api/admin/system-ai] upsert error:', error.message)
    return NextResponse.json({ error: '写入失败：' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
