// 句子库 / 句子收藏。mock 走 localStorage；real 走 Supabase sentences + user_sentence_bookmarks。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, getUserColl, setUserColl } from '../mock/store.js'

// 用户新增句子存于独立表 user_sentences（与 sentences 同结构 + submitted_by 属主列），
// 由本层在查询时 UNION 合并，前端统一读取——不改动 sentences 主表与 dictionary_full 视图。
function getUserSentences(userId) {
  return getUserColl(userId, 'user_sentences', [])
}

export async function getSentencesByCategory(category, userId) {
  if (!isSupabaseConfigured) {
    const all = getGlobal('sentences', [])
    const userRows = userId ? getUserSentences(userId) : []
    const merged = [...all, ...userRows]
    return category ? merged.filter((s) => s.category === category) : merged
  }
  if (!supabase) return []
  const buildQ = (tbl) => {
    const q = supabase.from(tbl).select('*')
    if (category) q.eq('category', category)
    return q
  }
  const [g, u] = await Promise.all([
    safeQuery(buildQ('sentences')),
    userId
      ? safeQuery(buildQ('user_sentences').eq('submitted_by', userId))
      : Promise.resolve({ data: [] }),
  ])
  if (g.error) console.error('[getSentencesByCategory]', g.error.message)
  const globalRows = (g.data || []).map((s) => ({ ...s, origin: 'global' }))
  const userRows = (u.data || []).map((s) => ({ ...s, origin: 'user' }))
  return [...globalRows, ...userRows]
}

export async function getSentenceById(id, userId) {
  if (!isSupabaseConfigured) {
    const g = getGlobal('sentences', []).find((s) => s.id === id)
    if (g) return g
    if (userId) {
      const u = getUserSentences(userId).find((s) => s.id === id)
      if (u) return u
    }
    return null
  }
  if (!supabase) return null
  const { data } = await safeQuery(
    supabase.from('sentences').select('*').eq('id', id).maybeSingle()
  )
  if (data) return data
  if (userId) {
    const { data: ud } = await safeQuery(
      supabase
        .from('user_sentences')
        .select('*')
        .eq('id', id)
        .eq('submitted_by', userId)
        .maybeSingle()
    )
    if (ud) return ud
  }
  return null
}

// 读取当前用户新增的句子列表（real：user_sentences 按 submitted_by；mock：localStorage 集合）
export async function getUserSentencesList(userId) {
  if (!isSupabaseConfigured) return getUserSentences(userId)
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase.from('user_sentences').select('*').eq('submitted_by', userId)
  )
  return data || []
}

// 新增用户句子（写入 user_sentences，带 submitted_by；与 sentences 同结构字段）
export async function addUserSentence(userId, sentence) {
  if (!sentence || !sentence.thai) return null
  if (!isSupabaseConfigured) {
    const list = getUserSentences(userId)
    const row = { ...sentence, id: `u_${Date.now()}`, submitted_by: userId, origin: 'user' }
    list.push(row)
    setUserColl(userId, 'user_sentences', list)
    return row
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase.from('user_sentences').insert({ ...sentence, submitted_by: userId }).select().single()
  )
  if (error) {
    console.error('[addUserSentence]', error.message)
    return null
  }
  return data
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
