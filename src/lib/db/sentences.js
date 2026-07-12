// 句子库 / 句子收藏。mock 走 localStorage；real 走 Supabase sentences + user_sentence_bookmarks。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, getUserColl, setUserColl } from '../mock/store.js'

export async function getSentencesByCategory(category) {
  if (!isSupabaseConfigured) {
    const all = getGlobal('sentences', [])
    return category ? all.filter((s) => s.category === category) : all
  }
  if (!supabase) return []
  const q = supabase.from('sentences').select('*')
  if (category) q.eq('category', category)
  const { data, error } = await safeQuery(q)
  if (error) {
    console.error('[getSentencesByCategory]', error.message)
    return []
  }
  return data || []
}

export async function getSentenceById(id) {
  if (!isSupabaseConfigured) return getGlobal('sentences', []).find((s) => s.id === id) || null
  if (!supabase) return null
  const { data } = await safeQuery(supabase.from('sentences').select('*').eq('id', id).maybeSingle())
  return data || null
}

export async function getDailySentence() {
  if (!isSupabaseConfigured) {
    const all = getGlobal('sentences', [])
    return all[Math.floor(Math.random() * all.length)] || null
  }
  if (!supabase) return null
  const { data } = await safeQuery(supabase.rpc('get_random_sentence'))
  return data || null
}

function mockBookmarks(userId) {
  return getUserColl(userId, 'sentence_bookmarks', [])
}
export async function getSentenceBookmarks(userId) {
  if (!isSupabaseConfigured) return mockBookmarks(userId)
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase.from('user_sentence_bookmarks').select('*').eq('user_id', userId)
  )
  return data || []
}
export async function bookmarkSentence(userId, sentenceId) {
  if (!isSupabaseConfigured) {
    const list = mockBookmarks(userId)
    if (!list.some((b) => b.sentence_id === sentenceId)) {
      list.push({ sentence_id: sentenceId, created_at: new Date().toISOString() })
      setUserColl(userId, 'sentence_bookmarks', list)
    }
    return list
  }
  if (!supabase || !userId) return []
  await safeQuery(
    supabase.from('user_sentence_bookmarks').upsert({ user_id: userId, sentence_id: sentenceId })
  )
  return getSentenceBookmarks(userId)
}
export async function isSentenceBookmarked(userId, sentenceId) {
  if (!isSupabaseConfigured) return mockBookmarks(userId).some((b) => b.sentence_id === sentenceId)
  if (!supabase || !userId) return false
  const { data } = await safeQuery(
    supabase
      .from('user_sentence_bookmarks')
      .select('sentence_id')
      .eq('user_id', userId)
      .eq('sentence_id', sentenceId)
      .maybeSingle()
  )
  return !!data
}
