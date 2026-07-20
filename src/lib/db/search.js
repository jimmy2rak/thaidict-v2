// 搜索 / 词典查询。mock 走 localStorage（store.js）；real 走 Supabase + RPC。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { transformWordData, transformCommunityWord, safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'
import { fillSensesSegments } from '../segmentExamples.js'

// ---------- 搜索排序辅助 ----------
function toTextArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map((x) => {
    if (typeof x === 'string') return x
    if (x && typeof x === 'object') return x.word || x.zh || x.meaning || ''
    return String(x)
  })
}

function scoreSearchResult(row, q) {
  const raw = q || ''
  const lc = raw.toLowerCase()
  const word = (row.word || '').toLowerCase()
  let matchType = 5 // 兜底
  if (word === lc) matchType = 0
  else if (word.includes(lc)) matchType = 1
  else if (
    (row.senses || []).some((s) => (s.meaning || '').toLowerCase().includes(lc))
  )
    matchType = 2
  else if (
    (row.senses || []).some((s) =>
      (s.examples || []).some((ex) => {
        const text = ((ex.th || '') + ' ' + (ex.zh || '')).toLowerCase()
        return text.includes(lc)
      })
    )
  )
    matchType = 3
  else {
    const synonyms = toTextArray(row.synonyms)
    const antonyms = toTextArray(row.antonyms)
    if (
      synonyms.some((s) => s.toLowerCase().includes(lc)) ||
      antonyms.some((s) => s.toLowerCase().includes(lc))
    )
      matchType = 4
  }

  // word_freqs 分 corpus 存词频，dictionary_full_ext 已映射到 freq_tnc/freq_ttc/freq_phupha 三列
  // （量纲不同：phupha 亿级、tnc 十万级、ttc 万级）。
  // ⚠️ 不能写 freq_ttc ?? freq_tnc ?? freq_phupha（会永远先取最小的 ttc 列，导致排序失真），
  //    必须取三列【最大值】作为该词的综合词频。
  const fTnc = Number(row.freq_tnc || 0)
  const fTtc = Number(row.freq_ttc || 0)
  const fPhu = Number(row.freq_phupha || 0)
  const freq = Math.max(fTnc, fTtc, fPhu)
  const sortFreq = freq > 0 ? freq : Number.NEGATIVE_INFINITY // 三列全为 0/null 视为无词频
  return { freq: sortFreq, matchType }
}

function sortSearchResults(rows, q) {
  return rows.slice().sort((a, b) => {
    const sa = scoreSearchResult(a, q)
    const sb = scoreSearchResult(b, q)
    if (sa.freq !== sb.freq) return sb.freq - sa.freq
    return sa.matchType - sb.matchType
  })
}

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
      ((r.senses || []).some((s) => (s.meaning || '').toLowerCase().includes(lc)) ||
        (r.senses || []).some((s) =>
          (s.examples || []).some((ex) =>
            ((ex.th || '') + ' ' + (ex.zh || '')).toLowerCase().includes(lc)
          )
        ) ||
        toTextArray(r.synonyms).some((s) => s.toLowerCase().includes(lc)) ||
        toTextArray(r.antonyms).some((s) => s.toLowerCase().includes(lc)))
  )
  const merged = [...exact, ...fuzzy, ...zh]
  const seen = new Set()
  const out = []
  for (const r of merged) {
    if (seen.has(r.word)) continue
    seen.add(r.word)
    out.push(r.source === 'community' ? transformCommunityWord(r) : transformWordData(r))
  }
  return sortSearchResults(out, q)
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
  // 排序：有词频按词频降序；无词频按搜索关联度（义项 > 例句 > 近反义词）
  sortSearchResults(merged, q)
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
  // 确保例句都有 segmented（AI 可能漏给，服务端兜底补全）
  const senses = await fillSensesSegments(entry.senses)
  const row = normalizeDictionaryRow({ ...entry, senses })
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
