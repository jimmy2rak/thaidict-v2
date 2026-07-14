// 句子库 / 句子收藏。mock 走 localStorage；real 走 Supabase sentences + user_sentence_bookmarks。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, getUserColl, setUserColl } from '../mock/store.js'

// 用户新增句子存于独立表 user_sentences（与 sentences 同结构 + submitted_by 属主列），
// 由本层在查询时 UNION 合并，前端统一读取——不改动 sentences 主表与 dictionary_full 视图。

// 把任意来源的句子行归一化成 PhraseCard 期望的安全结构。
// 真实 sentences 表字段名可能不与代码假设一致（如 thai→content、zh→translation），
// 这里做多候选名兜底 + 中文自动探测 + 类型校正，确保既不崩、也能尽量正常显示。
function hasCJK(s) {
  return typeof s === 'string' && /[一-鿿]/.test(s)
}
// 在原始行里自动找出第一个含中文的字段值（排除泰文/英文候选键），兼容任意命名。
function pickChinese(raw, excludeKeys) {
  for (const [k, v] of Object.entries(raw)) {
    if (excludeKeys.includes(k)) continue
    if (hasCJK(v)) return v
  }
  return ''
}
function asArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v) return v.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  return []
}
function normalizeSentence(raw) {
  if (!raw || typeof raw !== 'object') return null
  const thai = raw.thai ?? raw.content ?? raw.text ?? raw.word ?? ''
  const category = raw.category ?? raw.type ?? raw.tag ?? null
  let segmented = raw.segmented
  if (typeof segmented === 'string') {
    try { segmented = JSON.parse(segmented) } catch { segmented = undefined }
  }
  if (!Array.isArray(segmented)) segmented = undefined

  // 中文：优先已知列名，否则自动探测含中文的字段（兼容任意命名）
  const zh =
    [raw.zh, raw.translation, raw.meaning, raw.zh_hint, raw.zh_cn, raw.chinese, raw.cn, raw.zh_meaning]
      .find((v) => v != null && String(v).trim() !== '') ??
    pickChinese(raw, ['thai', 'content', 'text', 'word', 'romanization', 'segmented'])
  // 字面/实际意义：优先已知列名，否则用探测到的中文兜底（避免空白）
  const literal =
    raw.literal ?? raw.literal_meaning ?? raw.literal_zh ?? pickChinese(raw, ['thai', 'content', 'text', 'word'])
  const actual =
    raw.actual ?? raw.actual_meaning ?? raw.actual_zh ?? (typeof zh === 'string' ? zh : '')
  const advice = raw.advice ?? raw.note ?? raw.tip ?? raw.suggestion ?? ''

  const id = raw.id != null ? raw.id : (raw.word || Math.random().toString(36).slice(2))
  return {
    id,
    thai: String(thai || ''),
    zh: String(zh || ''),
    category: category != null ? String(category) : null,
    segmented,
    origin: raw.origin || 'global',
    // 透传其它字段，供详情页使用
    literal: String(literal || ''),
    actual: String(actual || ''),
    advice: String(advice || ''),
    difficulty: raw.difficulty ?? 1,
    tags: asArray(raw.tags ?? raw.tag),
    romanization: raw.romanization ?? '',
  }
}

function getUserSentences(userId) {
  return getUserColl(userId, 'user_sentences', [])
}

export async function getSentencesByCategory(category, userId) {
  if (!isSupabaseConfigured) {
    const all = getGlobal('sentences', [])
    const userRows = userId ? getUserSentences(userId) : []
    const merged = [...all, ...userRows]
    const filtered = category ? merged.filter((s) => (s.category ?? s.type) === category) : merged
    return filtered.map((s) => normalizeSentence(s)).filter(Boolean)
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
  if (u.error) console.error('[getSentencesByCategory:user]', u.error.message)
  const globalRows = (g.data || []).map((s) => normalizeSentence({ ...s, origin: 'global' })).filter(Boolean)
  const userRows = (u.data || []).map((s) => normalizeSentence({ ...s, origin: 'user' })).filter(Boolean)
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
    return normalizeSentence(all[Math.floor(Math.random() * all.length)]) || null
  }
  if (!supabase) return null
  const { data } = await safeQuery(supabase.rpc('get_random_sentence'))
  return normalizeSentence(data) || null
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
