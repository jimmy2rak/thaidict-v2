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
  const [exact, fuzzy, zh, comm] = await Promise.all([
    safeQuery(supabase.from('dictionary_full').select('*').eq('word', q).limit(5)),
    safeQuery(supabase.from('dictionary_full').select('*').ilike('word', `%${lc}%`).limit(20)),
    safeQuery(supabase.rpc('search_words_zh', { search_term: q, max_results: 20 })),
    safeQuery(
      supabase
        .from('community_words')
        .select('*')
        .or(`word.ilike.%${lc}%,senses::text.ilike.%${lc}%`)
        .limit(20)
    ),
  ])
  const rows = [
    ...(exact.data || []),
    ...(fuzzy.data || []).filter((r) => r.word.toLowerCase() !== lc),
    ...(zh.data || []),
    ...(comm.data || []),
  ]
  const seen = new Set()
  const merged = []
  for (const r of rows) {
    if (seen.has(r.word)) continue
    seen.add(r.word)
    merged.push(r)
  }
  return merged.map((r) => (r.source === 'community' ? transformCommunityWord(r) : transformWordData(r)))
}

export async function getWordByThai(word) {
  if (!isSupabaseConfigured) return mockGetWordByThai(word)
  if (!supabase || !word) return null
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
      .or(`word.ilike.%${query}%,senses::text.ilike.%${query}%`)
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
  const { data, error } = await safeQuery(
    supabase.from('dictionary').upsert(row).select().single()
  )
  if (error) {
    console.error('[addDictionaryWord]', error.message)
    return null
  }
  return data
}

function normalizeDictionaryRow(entry) {
  const senses = Array.isArray(entry.senses) ? entry.senses : []
  return {
    word: entry.word,
    romanization: entry.romanization || '',
    senses,
    synonyms: entry.synonyms || [],
    antonyms: entry.antonyms || [],
    learner_associations: entry.learner_associations || [],
    sense_count: senses.length,
    enrichment_status: 'enriched',
    freq_ttc: entry.freq_ttc || 0,
  }
}
