// 前端读取/更新「系统内置 AI API」（system_config）。
// 真实模式走服务端代理（/api/admin/system-ai，密钥在服务端打码，不到前端）；
// 密钥本身从不直接落入前端，编辑时留空即保留原值。
import { isSupabaseConfigured, supabase } from '../supabase.js'

async function bearer() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || ''
}

// 读取（任意登录用户均可；返回打码后的配置）
export async function fetchSystemAi() {
  if (!isSupabaseConfigured) {
    return { provider: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-4o', keySet: false, keyMasked: '' }
  }
  try {
    const res = await fetch('/api/admin/system-ai', {
      headers: { Authorization: `Bearer ${await bearer()}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('[fetchSystemAi]', e)
    return null
  }
}

// 更新（需超管或被授权管理员；服务端鉴权）
export async function updateSystemAi(cfg) {
  if (!isSupabaseConfigured) return
  const res = await fetch('/api/admin/system-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await bearer()}`,
    },
    body: JSON.stringify(cfg),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '保存失败')
  return json
}
