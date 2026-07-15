// 句子库 / 句子收藏。mock 走 localStorage；real 走 Supabase sentences + user_sentence_bookmarks。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, getUserColl, setUserColl } from '../mock/store.js'

// 用户新增句子存于独立表 user_sentences（真实列：sentence_th / sentence_zh / submitter_id /
//   related_words / source / status / created_at），与 sentences 主表结构不同，
// 由本层在查询时 UNION 合并，前端统一读取——不改动 sentences 主表与 dictionary_full 视图。
import { getFolders, createFolder, addSentenceToFolder } from './folders.js'

// 把任意来源的句子行归一化成 PhraseCard 期望的安全结构。
// 真实 sentences 表字段：text(泰文) / category / literal_meaning(字面) / actual_meaning(实际)
//   / learner_tip(学习者建议) / source / difficulty / tags[] / segmented(json) / created_at
// 真实 user_sentences 表字段：sentence_th(泰文) / sentence_zh(中文) / related_words / source
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
// 把 sentences / user_sentences 真实表行归一化成 PhraseCard / SentenceDetailView 期望的结构。
export function normalizeSentence(raw) {
  if (!raw || typeof raw !== 'object') return null
  const thai = raw.sentence_th ?? raw.text ?? raw.thai ?? raw.content ?? raw.word ?? ''
  const category = raw.category ?? raw.type ?? raw.tag ?? null

  let segmented = raw.segmented
  if (typeof segmented === 'string') {
    try { segmented = JSON.parse(segmented) } catch { segmented = undefined }
  }
  if (!Array.isArray(segmented)) segmented = undefined

  // 字面 / 实际意义：优先真实列名（literal_meaning / actual_meaning）
  const literal = raw.literal_meaning ?? raw.literal ?? raw.literal_zh ?? ''
  const actual = raw.actual_meaning ?? raw.actual ?? raw.actual_zh ?? ''
  // 学习者建议：真实列名为 learner_tip
  const advice = raw.learner_tip ?? raw.advice ?? raw.note ?? raw.tip ?? raw.suggestion ?? ''
  const source = raw.source ?? ''
  const difficulty = raw.difficulty ?? 1

  // 中文兜底：优先实际/字面意义，其次 user_sentences 的 sentence_zh，未知 schema 时自动探测含中文字段
  const zh =
    actual || literal || raw.sentence_zh ||
    pickChinese(raw, ['thai', 'text', 'content', 'word', 'sentence_th', 'romanization', 'segmented']) || ''

  const id = raw.id != null ? raw.id : (thai || Math.random().toString(36).slice(2))
  return {
    id,
    thai: String(thai || ''),
    zh: String(zh || ''),
    category: category != null ? String(category) : null,
    segmented,
    origin: raw.origin || 'global',
    literal: String(literal || ''),
    actual: String(actual || ''),
    advice: String(advice || ''),
    difficulty,
    source: String(source || ''),
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
  // 全局 sentences 表带 category 列，可按分类过滤；user_sentences 真实表无 category 列，不按分类过滤。
  const gQ = supabase.from('sentences').select('*')
  if (category) gQ.eq('category', category)
  const [g, u] = await Promise.all([
    safeQuery(gQ),
    userId
      ? safeQuery(supabase.from('user_sentences').select('*').eq('submitter_id', userId))
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
  if (data) return normalizeSentence(data)
  if (userId) {
    const { data: ud } = await safeQuery(
      supabase
        .from('user_sentences')
        .select('*')
        .eq('id', id)
        .eq('submitter_id', userId)
        .maybeSingle()
    )
    if (ud) return normalizeSentence({ ...ud, origin: 'user' })
  }
  return null
}

// 读取当前用户新增的句子列表（real：user_sentences 按 submitter_id；mock：localStorage 集合）
export async function getUserSentencesList(userId) {
  if (!isSupabaseConfigured) return getUserSentences(userId)
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase.from('user_sentences').select('*').eq('submitter_id', userId)
  )
  return data || []
}

// 新增用户句子（写入 user_sentences，真实列：submitter_id / sentence_th / sentence_zh / related_words）
export async function addUserSentence(userId, sentence) {
  if (!sentence || !(sentence.thai || sentence.sentence_th)) return null
  if (!isSupabaseConfigured) {
    const list = getUserSentences(userId)
    const row = { ...sentence, id: `u_${Date.now()}`, submitted_by: userId, origin: 'user' }
    list.push(row)
    setUserColl(userId, 'user_sentences', list)
    return row
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase
      .from('user_sentences')
      .insert({
        submitter_id: userId,
        sentence_th: sentence.thai || sentence.sentence_th || '',
        sentence_zh: sentence.zh || sentence.sentence_zh || '',
        related_words: sentence.related_words || asArray(sentence.relatedWords) || [],
        source: sentence.source || 'user',
        status: sentence.status || 'pending',
      })
      .select()
      .single()
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
// 收藏句子时，同步进默认「我的收藏」句子夹，使「单词本 → 句子夹」中可见。
async function ensureInDefaultSentenceFolder(userId, sentenceId) {
  try {
    const { data: favRows } = await safeQuery(
      supabase
        .from('user_folders')
        .select('*')
        .eq('user_id', userId)
        .eq('folder_type', 'sentence')
        .eq('name', '我的收藏')
    )
    let fav = favRows && favRows[0]
    if (!fav) fav = await createFolder(userId, '我的收藏', '#D36B58', 'sentence')
    if (fav && fav.id) await addSentenceToFolder(fav.id, sentenceId)
  } catch (e) {
    console.error('[ensureInDefaultSentenceFolder]', e?.message || e)
  }
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
  // 同步进默认句子夹，让收藏出现在「单词本 → 句子夹」
  await ensureInDefaultSentenceFolder(userId, sentenceId)
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

// 取消句子收藏：删除扁平收藏记录，并从默认「我的收藏」句子夹移除，使星级可切换。
export async function removeSentenceBookmark(userId, sentenceId) {
  if (!isSupabaseConfigured) {
    const list = mockBookmarks(userId).filter((b) => b.sentence_id !== sentenceId)
    setUserColl(userId, 'sentence_bookmarks', list)
    return list
  }
  if (!supabase || !userId) return []
  await safeQuery(
    supabase.from('user_sentence_bookmarks').delete().eq('user_id', userId).eq('sentence_id', sentenceId)
  )
  try {
    const { data: fav } = await safeQuery(
      supabase
        .from('user_folders')
        .select('id')
        .eq('user_id', userId)
        .eq('folder_type', 'sentence')
        .eq('name', '我的收藏')
        .maybeSingle()
    )
    if (fav?.id) {
      await safeQuery(
        supabase.from('user_folder_sentences').delete().eq('folder_id', fav.id).eq('sentence_id', sentenceId)
      )
    }
  } catch (e) {
    console.error('[removeSentenceBookmark:folder]', e?.message || e)
  }
  return getSentenceBookmarks(userId)
}
