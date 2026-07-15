import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

// system_config 中系统默认 AI API 配置对应的 key。
// 用户可在 .env.local 覆盖；默认 'ai_system_api'。
const SYSTEM_AI_CONFIG_KEY = process.env.SYSTEM_AI_CONFIG_KEY || 'ai_system_api'

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-pro' },
  custom: { baseUrl: '', defaultModel: '' },
}

function resolveConfig(raw) {
  // 兼容 value 为纯字符串（直接是 key）或对象结构
  const v = typeof raw === 'string' ? { api_key: raw } : raw || {}
  const provider = v.provider || 'openai'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai
  return {
    provider,
    apiKey: v.api_key || v.apiKey || v.key || v.token || v.apiToken || v.secret || v.api_secret || '',
    baseUrl: v.base_url || v.baseUrl || v.endpoint || defaults.baseUrl,
    model: v.model || v.modelId || defaults.defaultModel,
  }
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const { prompt, userApi } = body || {}
  if (!prompt) return NextResponse.json({ error: 'prompt 不能为空' }, { status: 400 })

  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  let config
  if (userApi?.key) {
    const provider = userApi.provider || 'custom'
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom
    config = {
      provider,
      apiKey: userApi.key,
      baseUrl: (userApi.base_url || defaults.baseUrl).replace(/\/$/, ''),
      model: userApi.model || defaults.defaultModel,
    }
  } else {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', SYSTEM_AI_CONFIG_KEY)
      .maybeSingle()
    if (error) {
      console.error('[api/ai] read system_config error:', error.message)
      return NextResponse.json({ error: '读取系统 AI 配置失败' }, { status: 500 })
    }
    if (!data || !data.value) {
      return NextResponse.json(
        { error: `未找到系统默认 AI 配置（system_config.key=${SYSTEM_AI_CONFIG_KEY}）` },
        { status: 500 }
      )
    }
    config = resolveConfig(data.value)
  }

  if (!config.apiKey) {
    return NextResponse.json({ error: 'AI 配置缺少 api_key' }, { status: 500 })
  }

  const url = `${config.baseUrl}/chat/completions`
  const payload = {
    model: config.model,
    messages: [{ role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }],
    temperature: 0.7,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) {
      console.error('[api/ai] provider error:', json)
      return NextResponse.json(
        { error: json.error?.message || `AI 调用失败（${res.status}）` },
        { status: 502 }
      )
    }

    let content = json.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content)
        content = parsed
      } catch {
        // 保持字符串原样
      }
    }

    return NextResponse.json({ data: content ?? json })
  } catch (e) {
    console.error('[api/ai] fetch error:', e)
    return NextResponse.json({ error: 'AI 调用异常：' + e.message }, { status: 502 })
  }
}
