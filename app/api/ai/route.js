import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
// Vercel 函数超时上限（Hobby 计划上限 60s，Pro 可到 300s）。
// 大模型推理可能耗时较长，必须抬高，否则函数被平台 kill → Cloudflare 502。
export const maxDuration = 60

const AI_KEY = 'SYSTEM_AI_API_KEY'
const AI_BASE_URL = 'SYSTEM_AI_BASE_URL'
const AI_MODEL = 'SYSTEM_AI_MODEL'
const ALL_KEYS = [AI_KEY, AI_BASE_URL, AI_MODEL]

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-pro' },
  custom: { baseUrl: '', defaultModel: '' },
}

// 给 promise 加超时，避免 Supabase 冷启动连接偶发挂起导致函数被平台 kill
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' 超时（>' + ms + 'ms）')), ms)),
  ])
}

// 安全解析：先取文本，再尝试 JSON，失败则保留文本
async function safeParse(res) {
  const text = await res.text()
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: null, text }
  }
}

export async function POST(req) {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
    }

    const { prompt, userApi } = body || {}
    if (!prompt) return NextResponse.json({ error: 'prompt 不能为空' }, { status: 400 })

    const supabase = getServerSupabase()
    if (!supabase) {
      console.error('[api/ai] server supabase 未配置（缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）')
      return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })
    }

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
      let rows
      try {
        const { data, error } = await withTimeout(
          supabase.from('system_config').select('key, value').in('key', ALL_KEYS),
          10000,
          '读取 system_config'
        )
        if (error) {
          console.error('[api/ai] read system_config error:', error.message)
          return NextResponse.json({ error: '读取系统 AI 配置失败：' + error.message }, { status: 500 })
        }
        rows = data || []
      } catch (e) {
        console.error('[api/ai] read system_config threw:', e)
        return NextResponse.json({ error: '读取系统 AI 配置异常：' + e.message }, { status: 500 })
      }
      const map = {}
      for (const r of rows) map[r.key] = r.value
      const baseUrl = map[AI_BASE_URL] || ''
      const model = map[AI_MODEL] || ''
      const apiKey = map[AI_KEY] || ''

      if (!apiKey || !baseUrl) {
        return NextResponse.json(
          { error: '未找到系统默认 AI 配置（system_config：SYSTEM_AI_API_KEY / SYSTEM_AI_BASE_URL）' },
          { status: 500 }
        )
      }
      config = {
        provider: 'openai',
        apiKey,
        baseUrl: baseUrl.replace(/\/$/, ''),
        model: model || 'gpt-4o',
      }
    }

    if (!config.apiKey) {
      return NextResponse.json({ error: 'AI 配置缺少 api_key' }, { status: 500 })
    }

    const url = `${config.baseUrl}/chat/completions`
    console.log('[api/ai] 请求上游:', url, 'model=', config.model)

    // 探针：以 __PROBE__ 开头的 prompt 不真正调用大模型，仅确认函数能跑完（定位 502 根因）
    if (typeof prompt === 'string' && prompt.startsWith('__PROBE__')) {
      return NextResponse.json({
        probe: true,
        hasKey: !!config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        userApi: !!userApi,
      })
    }

    const payload = {
      model: config.model,
      messages: [{ role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }],
      temperature: 0.7,
    }

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 55000) // 略低于 maxDuration，主动超时返回 JSON
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      console.error('[api/ai] fetch upstream error:', e)
      if (e.name === 'AbortError') {
        return NextResponse.json({ error: 'AI 服务响应超时（>55s），请稍后重试或更换模型' }, { status: 504 })
      }
      return NextResponse.json({ error: 'AI 服务网络异常：' + e.message }, { status: 502 })
    }
    clearTimeout(timer)

    const { json, text } = await safeParse(res)
    if (!res.ok) {
      console.error('[api/ai] upstream error status', res.status, 'body:', text.slice(0, 500))
      const msg = json?.error?.message || (text ? text.slice(0, 200) : `AI 调用失败（${res.status}）`)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    let content = json?.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content)
      } catch {
        // 保持字符串原样
      }
    }

    return NextResponse.json({ data: content ?? json })
  } catch (e) {
    // 任何未预期异常都返回 JSON，避免 Vercel 吐 HTML 502 页
    console.error('[api/ai] 未捕获异常:', e)
    return NextResponse.json({ error: 'AI 代理内部错误：' + (e?.message || String(e)) }, { status: 500 })
  }
}
