// AI 代理分发：mock 模式走规则生成；真实模式走 Supabase Edge Function `ai-proxy`。
// 重要：必须用 Edge Function 而非 Vercel function——Vercel Hobby 函数硬超时仅 10s，
// 而 MiniCPM 等大模型推理超过 10s 会被 kill（Cloudflare 502）。老系统即用此 Edge Function，
// 其超时取决于 Supabase 计划（Pro 可达 100s+），不受 Vercel 限制。密钥在服务端读取 system_config，前端不接触。
import { isSupabaseConfigured, supabase } from './supabase.js'
import { generateMockWord, parsePrompt } from './mock/aiProxy.js'

export async function callAiProxy(prompt, userApi = null) {
  if (!isSupabaseConfigured || !supabase) {
    const { word, zhHint } = parsePrompt(prompt)
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 600))
    return { data: generateMockWord(word, zhHint), error: null }
  }

  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/ai-proxy`
    const { data: { session } } = await supabase.auth.getSession()

    const body = { prompt }
    if (userApi?.key && userApi?.base_url) {
      body.user_api_key = userApi.key
      body.user_base_url = userApi.base_url
      body.user_model = userApi.model || 'gpt-4o'
      body.provider = 'user'
    } else {
      body.provider = 'system'
    }

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: session ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'AI proxy failed' }
    // 老 Edge Function 返回 { success, data, provider }
    return { data: json.data ?? json, error: null }
  } catch (e) {
    console.error('[ai-proxy]', e)
    return { data: null, error: e.message }
  }
}
