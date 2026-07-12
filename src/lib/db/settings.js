// 用户设置。mock 走 localStorage；real 走 Supabase user_settings。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

const DEFAULTS = {
  dict_direction: 'th_to_zh',
  color_mode: 'light',
  speech_rate: 1.0,
  font_size: 'medium',
  chinese_font: 'noto_sans_sc',
  thai_font: 'noto_sans_thai',
  reminder_enabled: false,
  reminder_time: '20:00',
  reminder_frequency: 'daily',
  webdav_url: '',
  webdav_user: '',
  webdav_pass_enc: '',
  default_api_id: null,
}

export const CHINESE_FONTS = [
  { key: 'noto_sans_sc', label: 'Noto Sans SC', family: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif" },
  { key: 'noto_serif_sc', label: 'Noto Serif SC', family: "'Noto Serif SC', serif" },
]
export const THAI_FONTS = [
  { key: 'sarabun', label: 'Sarabun', family: "'Sarabun', sans-serif" },
  { key: 'noto_sans_thai', label: 'Noto Sans Thai', family: "'Noto Sans Thai', 'Sarabun', sans-serif" },
  { key: 'charm', label: 'Charm', family: "'Charm', 'Sarabun', cursive" },
]

export function getFontFamily(fontKey, fallback) {
  const all = [...CHINESE_FONTS, ...THAI_FONTS]
  return all.find((f) => f.key === fontKey)?.family || fallback
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
