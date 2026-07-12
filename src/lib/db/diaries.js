// 学习日记（文档3.2）。mock 走 localStorage；real 走 Supabase user_diaries / user_diary_images。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

export async function getDiaries(userId) {
  if (!isSupabaseConfigured) {
    return getUserColl(userId, 'diaries', []).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_diaries').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  )
  if (error) {
    console.error('[getDiaries]', error.message)
    return []
  }
  return data || []
}

export async function getDiary(userId, id) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'diaries', []).find((d) => d.id === id) || null
  if (!supabase) return null
  const { data } = await safeQuery(supabase.from('user_diaries').select('*').eq('id', id).maybeSingle())
  return data || null
}

export async function createDiary(userId, { content = '', mood = 'neutral', study_minutes = 0 }) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'diaries', [])
    const d = { id: uid(), user_id: userId, content, mood, study_minutes, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), images: [] }
    list.push(d)
    setUserColl(userId, 'diaries', list)
    return d
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase.from('user_diaries').insert({ user_id: userId, content, mood, study_minutes }).select().single()
  )
  if (error) {
    console.error('[createDiary]', error.message)
    return null
  }
  return data
}

export async function updateDiary(userId, id, updates) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'diaries', [])
    const d = list.find((x) => x.id === id)
    if (d) Object.assign(d, updates, { updated_at: new Date().toISOString() })
    setUserColl(userId, 'diaries', list)
    return d
  }
  if (!supabase) return null
  const { data } = await safeQuery(
    supabase.from('user_diaries').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  )
  return data
}

export async function deleteDiary(userId, id) {
  if (!isSupabaseConfigured) {
    setUserColl(userId, 'diaries', getUserColl(userId, 'diaries', []).filter((d) => d.id !== id))
    return
  }
  if (!supabase) return
  await safeQuery(supabase.from('user_diaries').delete().eq('id', id))
}

export async function addDiaryImage(userId, diaryId, imageUrl, storageType = 'local') {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'diaries', [])
    const d = list.find((x) => x.id === diaryId)
    if (d) {
      d.images = d.images || []
      d.images.push({ id: uid(), image_url: imageUrl, storage_type: storageType })
    }
    setUserColl(userId, 'diaries', list)
    return d
  }
  if (!supabase) return null
  const { data } = await safeQuery(
    supabase.from('user_diary_images').insert({ diary_id: diaryId, image_url: imageUrl, storage_type: storageType }).select().single()
  )
  return data
}
