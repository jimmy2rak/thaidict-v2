// 通用工具：CST 时区、安全查询、数据转换

// 所有日期计算必须使用 CST（UTC+8）—— 文档4.3.4
export function getTodayCST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

export function getCSTWeekday() {
  const day = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' })
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[day] || 1
}

export function getDateCST(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d)
}

export function nowCSTISO() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T') + '+08:00'
}

// 安全并行查询包装
export const safeQuery = async (q) => {
  try {
    return await q
  } catch (e) {
    console.error('[safeQuery]', e)
    return { data: null, error: e }
  }
}

// ---------- 数据转换（DB row → 前端格式，文档4.3.3） ----------

// dictionary_full / community_words 行 → 前端词条对象
export function transformWordData(row) {
  if (!row) return null
  const senses = Array.isArray(row.senses) ? row.senses : []
  const firstSense = senses[0] || {}
  return {
    word: row.word,
    romanization: row.romanization || '',
    pos: firstSense.pos || '',
    senses: senses.map((s, i) => ({
      senseId: s.sense_id ?? i + 1,
      pos: s.pos || '',
      meaning: s.meaning || '',
      register: s.register || '通用',
      examples: Array.isArray(s.examples) ? s.examples : [],
      segmented: Array.isArray(s.segmented) ? s.segmented : [],
      source: s.source || 'ai',
    })),
    synonyms: normalizeRel(row.synonyms),
    antonyms: normalizeRel(row.antonyms),
    learnerAssociations: Array.isArray(row.learner_associations) ? row.learner_associations : [],
    senseCount: row.sense_count ?? senses.length,
    enrichmentStatus: row.enrichment_status || 'enriched',
    source: 'dictionary',
  }
}

export function transformCommunityWord(row) {
  const t = transformWordData(row)
  if (t) t.source = 'community'
  return t
}

function normalizeRel(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map((x) => {
    if (typeof x === 'string') return { word: x, meaning: '' }
    // AI 返回可能用 meaning 或 zh 承载中文
    if (x && x.word) return { word: x.word, meaning: x.meaning || x.zh || '' }
    return { word: String(x), meaning: '' }
  })
}

// 中文搜索结果行转换
export function transformSearchResult(row) {
  return transformWordData(row)
}

// 给分词结果补中文含义（逐词查词典）
export function enrichSegmented(segments, dictMap) {
  if (!Array.isArray(segments)) return []
  return segments.map((seg) => {
    const key = (seg.text || '').toLowerCase()
    const hit = dictMap?.[key]
    return {
      text: seg.text,
      meaning: seg.meaning || (hit ? hit.meanings?.[0] || '' : ''),
    }
  })
}

// 简易 uid（mock 主键）
export function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
