// AI 代理分发：mock 模式走规则生成；真实模式走 Next.js Route Handler /api/ai。
// system_config 中的系统默认 AI 密钥由服务端读取，前端不接触。
import { isSupabaseConfigured } from './supabase.js'
import { generateMockWord, parsePrompt } from './mock/aiProxy.js'

export async function callAiProxy(prompt, userApi = null) {
  if (!isSupabaseConfigured) {
    const { word, zhHint } = parsePrompt(prompt)
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 600))
    return { data: generateMockWord(word, zhHint), error: null }
  }

  try {
    const body = { prompt }
    if (userApi?.key) {
      body.userApi = {
        key: userApi.key,
        base_url: userApi.base_url,
        model: userApi.model,
        provider: userApi.provider || 'custom',
      }
    }
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
