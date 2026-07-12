// AI 代理分发：mock 模式走规则生成；真实模式走 Supabase Edge Function `ai-proxy`。
import { isSupabaseConfigured, supabase } from './supabase.js'
import { generateMockWord, parsePrompt } from './mock/aiProxy.js'

export async function callAiProxy(prompt, userApi = null) {
  if (!isSupabaseConfigured) {
    const { word, zhHint } = parsePrompt(prompt)
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 600))
    return { data: generateMockWord(word, zhHint), error: null }
  }

  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/ai-proxy`
    const { data: { session } } = await supabase.auth.getSession()
    const body = typeof prompt === 'string' ? { prompt } : { prompt: JSON.stringify(prompt) }
    if (userApi?.key) {
      body.user_api_key = userApi.key
      body.user_base_url = userApi.base_url
      body.user_model = userApi.model
      body.provider = 'user'
    } else {
      body.provider = 'system'
    }
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'ai-proxy failed' }
    return { data: json.data ?? json, error: null }
  } catch (e) {
    console.error('[ai-proxy]', e)
    return { data: null, error: e.message }
  }
}
