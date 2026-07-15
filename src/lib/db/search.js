// 搜索 / 词典查询。mock 走 localStorage（store.js）；real 走 Supabase + RPC。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { transformWordData, transformCommunityWord, safeQuery } from '../utils.js'
import { getGlobal } from '../mock/store.js'

// ---------- mock ----------
function mockSearch(query) {
  const q = (query || '').trim()
  if (!q) return []
  const lc = q.toLowerCase()
  const dict = getGlobal('dictionary', [])
  const comm = getGlobal('community_words', [])
  const all = [...dict, ...comm]
  const exact = all.filter((r) => r.word.toLowerCase() === lc)
  const fuzzy = all.filter((r) => r.word.toLowerCase().includes(lc) && !exact.includes(r))
  const zh = all.filter(
    (r) =>
      !exact.includes(r) &&
      !fuzzy.includes(r) &&
      (r.senses || []).some((s) => (s.meaning || '').includes(q))
  )
  const merged = [...exact, ...fuzzy, ...zh]
  const seen = new Set()
  const out = []
  for (const r of merged) {
    if (seen.has(r.word)) continue
    seen.add(r.word)
    out.push(r.source === 'community' ? transformCommunityWord(r) : transformWordData(r))
  }
  return out
}
function mockGetWordByThai(word) {
  if (!word) return null
  const dict = getGlobal('dictionary', [])
  const hit = dict.find((r) => r.word === word)
  if (hit) return hit
  const comm = getGlobal('community_words', [])
  return comm.find((r) => r.word === word) || null
}
function mockGetDictionaryCount() {
  return getGlobal('dictionary', []).filter((r) => r.enrichment_status === 'enriched').length
}
function mockSearchCommunity(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  return getGlobal('community_words', [])
    .filter((r) => r.word.toLowerCase().includes(q) || JSON.stringify(r.senses || '').includes(query))
    .map(transformCommunityWord)
}

// ---------- 导出（按 isSupabaseConfigured 分发） ----------
export async function searchWords(query) {
  if (!isSupabaseConfigured) return mockSearch(query)
  if (!supabase || !query) return []
  const q = query.trim()
  const lc = q.toLowerCase()
  const isZh = /[一-鿿]/.test(q)
  // dictionary_full_ext = dictionary_full ∪ community_words，一次覆盖主词典与社区词。
  // 注意：不使用 or() + senses::text 强转 jsonb 列——PostgREST 会解析失败返回 400。
  // 改用 eq + ilike 分别查询，中文释义检索走 search_words_zh RPC。
  const [exact, fuzzy] = await Promise.all([
    safeQuery(supabase.from('dictionary_full_ext').select('*').eq('word', q).limit(5)),
    safeQuery(supabase.from('dictionary_full_ext').select('*').ilike('word', `%${lc}%`).limit(40)),
  ])
  let rows = [
    ...(exact.data || []),
    ...(fuzzy.data || []).filter((r) => (r.word || '').toLowerCase() !== lc),
  ]
  // 中文释义检索：仅当输入含中文且泰文未命中时，走 RPC（视图内已对 senses jsonb 做 ilike）
  if (isZh && rows.length === 0) {
    const zh = await safeQuery(
      supabase.rpc('search_words_zh', { search_term: q, max_results: 40 })
    )
    if (zh.data && zh.data.length) rows = zh.data
  }
  const seen = new Set()
  const merged = []
  for (const r of rows) {
    if (seen.has(r.word)) continue
    seen.add(r.word)
    merged.push(r)
  }
  return merged.map((r) => (r.origin === 'community' ? transformCommunityWord(r) : transformWordData(r)))
}

export async function getWordByThai(word) {
  if (!isSupabaseConfigured) return mockGetWordByThai(word)
  if (!supabase || !word) return null
  const ext = await safeQuery(
    supabase.from('dictionary_full_ext').select('*').eq('word', word).maybeSingle()
  )
  if (!ext.error) return ext.data || null
  // 视图未创建 → 回退
  const { data } = await safeQuery(
    supabase.from('dictionary_full').select('*').eq('word', word).maybeSingle()
  )
  if (data) return data
  const { data: c } = await safeQuery(
    supabase.from('community_words').select('*').eq('word', word).maybeSingle()
  )
  return c || null
}

export async function getWordByText(text) {
  return getWordByThai(text)
}

// 词典总数（查 dictionary_full 视图，已综合映射词频/来源；写入仍落基表 dictionary）
export async function getDictionaryCount() {
  if (!isSupabaseConfigured) return mockGetDictionaryCount()
  if (!supabase) return 0
  const ext = await safeQuery(
    supabase
      .from('dictionary_full_ext')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriched')
  )
  if (!ext.error) return ext.count || 0
  // 回退
  const { count } = await safeQuery(
    supabase
      .from('dictionary_full')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriched')
  )
  return count || 0
}

export async function searchCommunityWords(query) {
  if (!isSupabaseConfigured) return mockSearchCommunity(query)
  if (!supabase || !query) return []
  const { data } = await safeQuery(
    supabase
      .from('community_words')
      .select('*')
      .ilike('word', `%${query}%`)
      .limit(20)
  )
  return (data || []).map(transformCommunityWord)
}

// 查询某词的汉语释义数组（用于详情页近反义词/学习者建议括号展示，需求 #5）。
// 命中词典或社区词库时返回含义字符串数组；未命中返回 null（不显示括号）。
export async function getWordMeanings(word) {
  if (!word) return null
  if (!isSupabaseConfigured) {
    const dictHit = getGlobal('dictionary', []).find((r) => r.word === word)
    if (dictHit) {
      const arr = (dictHit.senses || []).map((s) => s.meaning).filter(Boolean)
      if (arr.length) return arr
    }
    const commHit = getGlobal('community_words', []).find((r) => r.word === word)
    if (commHit) {
      const arr = (commHit.senses || []).map((s) => s.meaning).filter(Boolean)
      if (arr.length) return arr
    }
    return null
  }
  if (!supabase) return null
  const ext = await safeQuery(
    supabase.from('dictionary_full_ext').select('senses').eq('word', word).maybeSingle()
  )
  if (!ext.error && ext.data && ext.data.senses) {
    const arr = (ext.data.senses || []).map((s) => s.meaning).filter(Boolean)
    if (arr.length) return arr
    return null
  }
  // 回退
  const { data } = await safeQuery(
    supabase.from('dictionary_full').select('senses').eq('word', word).maybeSingle()
  )
  if (data && data.senses) {
    const arr = (data.senses || []).map((s) => s.meaning).filter(Boolean)
    if (arr.length) return arr
  }
  const { data: c } = await safeQuery(
    supabase.from('community_words').select('senses').eq('word', word).maybeSingle()
  )
  if (c && c.senses) {
    const arr = (c.senses || []).map((s) => s.meaning).filter(Boolean)
    if (arr.length) return arr
  }
  return null
}

// 将标准格式词条写入「主词典」（需求 #3：管理员审批通过后自动入库）。
// mock 写入 dictionary 全局集合；real 写入 dictionary 表。
export async function addDictionaryWord(entry) {
  if (!entry || !entry.word) return null
  const row = normalizeDictionaryRow(entry)
  if (!isSupabaseConfigured) {
    const dict = getGlobal('dictionary', [])
    const idx = dict.findIndex((r) => r.word === row.word)
    if (idx >= 0) dict[idx] = { ...dict[idx], ...row }
    else dict.push(row)
    setGlobal('dictionary', dict)
    return row
  }
  if (!supabase) return null
  // onConflict:'word'——word 有唯一约束，重复审批同一词走更新而非报错。
  const { data, error } = await safeQuery(
    supabase.from('dictionary').upsert(row, { onConflict: 'word' }).select().single()
  )
  if (error) {
    console.error('[addDictionaryWord]', error.message)
    return null
  }
  return data
}

// ⚠️ dictionary 基表：sense_count 是【生成列】(不可写)，且【无】freq_ttc 列(词频由
// dictionary_full 视图从 word_freqs 映射)。写这两列都会 400，务必排除。
function normalizeDictionaryRow(entry) {
  const senses = Array.isArray(entry.senses) ? entry.senses : []
  return {
    word: entry.word,
    romanization: entry.romanization || '',
    senses,
    synonyms: entry.synonyms || [],
    antonyms: entry.antonyms || [],
    learner_associations: entry.learner_associations || [],
    enrichment_status: 'enriched',
  }
}
