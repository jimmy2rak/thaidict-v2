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

// 词典总数（修复 Bug B-3：查 dictionary_full）
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
