import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { supabase } from '@/lib/supabase'
import { getCallerRoleRow, canManageSystemAi } from '@/lib/serverAdminAuth'

export const runtime = 'nodejs'

const AI_KEY = 'SYSTEM_AI_API_KEY'
const AI_BASE_URL = 'SYSTEM_AI_BASE_URL'
const AI_MODEL = 'SYSTEM_AI_MODEL'
const ALL_KEYS = [AI_KEY, AI_BASE_URL, AI_MODEL]

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 4) return '••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

async function readRows(server) {
  const { data, error } = await server
    .from('system_config')
    .select('key, value')
    .in('key', ALL_KEYS)
  if (error) throw error
  const map = {}
  for (const r of data || []) {
    map[r.key] = r.value
  }
  return map
}

// GET /api/admin/system-ai —— 任意登录用户可读，密钥打码返回
export async function GET(req) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { error: authErr } = await supabase.auth.getUser(token)
  if (authErr) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  try {
    const map = await readRows(server)
    const apiKey = map[AI_KEY] || ''
    const baseUrl = map[AI_BASE_URL] || ''
    const model = map[AI_MODEL] || ''

    return NextResponse.json({
      provider: 'openai',
      base_url: baseUrl,
      model,
      keySet: !!apiKey,
      keyMasked: maskKey(apiKey),
      configKeys: ALL_KEYS,
      notFound: !map[AI_KEY] && !map[AI_BASE_URL] && !map[AI_MODEL],
      hint: apiKey
        ? ''
        : !map[AI_KEY] && !map[AI_BASE_URL] && !map[AI_MODEL]
          ? '未在 system_config 中找到 SYSTEM_AI_API_KEY / SYSTEM_AI_BASE_URL / SYSTEM_AI_MODEL 三行配置'
          : 'SYSTEM_AI_API_KEY 为空，请配置 API Key',
    })
  } catch (e) {
    console.error('[api/admin/system-ai] read error:', e.message)
    return NextResponse.json({ error: '读取失败：' + e.message }, { status: 500 })
  }
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

  const { base_url, model, key } = body || {}
  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  try {
    const map = await readRows(server)
    const rows = []
    if (base_url !== undefined) {
      rows.push({ key: AI_BASE_URL, value: String(base_url || '').trim(), updated_at: new Date().toISOString() })
    }
    if (model !== undefined) {
      rows.push({ key: AI_MODEL, value: String(model || '').trim(), updated_at: new Date().toISOString() })
    }
    // key 留空表示保留原值
    if (key !== undefined && String(key || '').trim()) {
      rows.push({ key: AI_KEY, value: String(key || '').trim(), updated_at: new Date().toISOString() })
    }

    if (rows.length) {
      const { error } = await server.from('system_config').upsert(rows, { onConflict: 'key' })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/admin/system-ai] write error:', e.message)
    return NextResponse.json({ error: '写入失败：' + e.message }, { status: 500 })
  }
}
