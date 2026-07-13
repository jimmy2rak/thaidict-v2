// 用户单词笔记（文档4 / 子功能：笔记）。mock 走 localStorage；real 走 Supabase user_notes（上线时建表并加 tags 列）。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

export async function getNotes(userId) {
  if (!isSupabaseConfigured) {
    return getUserColl(userId, 'notes', []).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  }
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  )
  if (error) {
    console.error('[getNotes]', error.message)
    return []
  }
  return data || []
}

export async function getNote(userId, id) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'notes', []).find((n) => n.id === id) || null
  if (!supabase) return null
  const { data } = await safeQuery(supabase.from('user_notes').select('*').eq('id', id).maybeSingle())
  return data || null
}

export async function getNoteForWord(userId, word) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'notes', []).find((n) => n.word === word) || null
  if (!supabase || !userId) return null
  const { data } = await safeQuery(
    supabase.from('user_notes').select('*').eq('user_id', userId).eq('word', word).maybeSingle()
  )
  return data || null
}

export async function saveNote(userId, { id, word, content, tags }) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'notes', [])
    const now = new Date().toISOString()
    if (id) {
      const e = list.find((n) => n.id === id)
      if (e) Object.assign(e, { word, content, tags: tags || [], updated_at: now })
    } else {
      list.push({ id: uid(), user_id: userId, word, content, tags: tags || [], created_at: now, updated_at: now })
    }
    setUserColl(userId, 'notes', list)
    return list
  }
  if (!supabase || !userId) return []
  const payload = { word, content, updated_at: new Date().toISOString() }
  // 注意：真实 Supabase 需要在 user_notes 表新增 tags 列；如未加列，上线前请先执行 ALTER TABLE user_notes ADD COLUMN tags text[] DEFAULT '{}'
  if (tags !== undefined) payload.tags = tags || []
  if (id) {
    await safeQuery(supabase.from('user_notes').update(payload).eq('id', id))
  } else {
    await safeQuery(supabase.from('user_notes').insert({ user_id: userId, ...payload }))
  }
  return getNotes(userId)
}

export async function deleteNote(userId, id) {
  if (!isSupabaseConfigured) {
    setUserColl(userId, 'notes', getUserColl(userId, 'notes', []).filter((n) => n.id !== id))
    return
  }
  if (!supabase) return
  await safeQuery(supabase.from('user_notes').delete().eq('id', id))
}
