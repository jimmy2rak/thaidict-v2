// 用户自带 AI API 密钥（Bug A-2 涉及的 user_api_keys 表）。mock 走 localStorage；real 走 Supabase。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

export async function getApiKeys(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'api_keys', [])
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_api_keys').select('*').eq('user_id', userId)
  )
  if (error) {
    console.error('[getApiKeys]', error.message)
    return []
  }
  return data || []
}

// key: { name, provider, key, base_url, model }
export async function saveApiKey(userId, key) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'api_keys', [])
    const entry = { id: key.id || uid(), user_id: userId, name: key.name || '我的密钥', provider: key.provider || 'openai', key: key.key, base_url: key.base_url || '', model: key.model || 'gpt-4o', is_active: true, created_at: new Date().toISOString() }
    if (key.id) {
      const i = list.findIndex((k) => k.id === key.id)
      if (i >= 0) list[i] = { ...list[i], ...entry }
    } else {
      list.push(entry)
    }
    setUserColl(userId, 'api_keys', list)
    return list
  }
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_api_keys').upsert({ id: key.id, user_id: userId, ...key }).select().single()
  )
  if (error) {
    console.error('[saveApiKey]', error.message)
    return []
  }
  return getApiKeys(userId)
}

export async function deleteApiKey(userId, keyId) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'api_keys', []).filter((k) => k.id !== keyId)
    setUserColl(userId, 'api_keys', list)
    return list
  }
  if (!supabase || !userId) return []
  await safeQuery(supabase.from('user_api_keys').delete().eq('id', keyId).eq('user_id', userId))
  return getApiKeys(userId)
}
