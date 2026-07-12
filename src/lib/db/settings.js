// 用户设置。mock 走 localStorage；real 走 Supabase user_settings。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

const DEFAULTS = {
  dict_direction: 'th_to_zh',
  color_mode: 'light',
  speech_rate: 1.0,
  font_size: 'medium',
  reminder_enabled: false,
  reminder_time: '20:00',
  reminder_frequency: 'daily',
  webdav_url: '',
  webdav_user: '',
  webdav_pass_enc: '',
  default_api_id: null,
}

export async function getUserSettings(userId) {
  if (!isSupabaseConfigured) {
    const s = getUserColl(userId, 'settings', null)
    return { ...DEFAULTS, ...(s || {}) }
  }
  if (!supabase || !userId) return { ...DEFAULTS }
  const { data, error } = await safeQuery(
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  )
  if (error) {
    console.error('[getUserSettings]', error.message)
    return { ...DEFAULTS }
  }
  return { ...DEFAULTS, ...(data || {}) }
}

// 修复 Bug B-5：数据库层合并（传入完整 settings 对象 upsert）
export async function saveUserSettings(userId, settings) {
  if (!isSupabaseConfigured) {
    const cur = getUserColl(userId, 'settings', null) || {}
    const merged = { ...cur, ...settings, user_id: userId, updated_at: new Date().toISOString() }
    setUserColl(userId, 'settings', merged)
    return merged
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase
      .from('user_settings')
      .upsert({ ...settings, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single()
  )
  if (error) {
    console.error('[saveUserSettings]', error.message)
    return null
  }
  return data
}

export async function getDefaultApi(userId) {
  const s = await getUserSettings(userId)
  return s.default_api_id || null
}
export async function setDefaultApi(userId, apiId) {
  return saveUserSettings(userId, { default_api_id: apiId })
}
