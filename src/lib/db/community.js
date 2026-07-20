// 社区共建词库。mock 走 localStorage；real 走 Supabase community_words。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'
import { fillSensesSegments } from '../segmentExamples.js'

export async function saveCommunityWord(entry, userId, zhHint) {
  // 确保例句都有 segmented（AI 可能漏给，服务端兜底补全）
  const senses = await fillSensesSegments(entry.senses)
  if (!isSupabaseConfigured) {
    const list = getGlobal('community_words', [])
    const i = list.findIndex((w) => w.word.toLowerCase() === (entry.word || '').toLowerCase())
    const row = { ...entry, senses, submitted_by: userId || null, zh_hint: zhHint || '', updated_at: new Date().toISOString() }
    if (i >= 0) list[i] = row
    else list.push(row)
    setGlobal('community_words', list)
    return { data: row, error: null }
  }
  if (!supabase) return { data: null, error: 'Supabase 未配置' }
  // 真实库 community_words 列：word, romanization, senses, synonyms, antonyms,
  // learner_associations, zh_hint, source, submitted_by, created_at。
  // 只提交这几列，避免传入 entry 里的非表字段触发 400。
  const row = {
    word: (entry.word || '').toLowerCase(),
    romanization: entry.romanization || '',
    senses,
    synonyms: entry.synonyms || [],
    antonyms: entry.antonyms || [],
    learner_associations: entry.learner_associations || [],
    zh_hint: zhHint || '',
    source: entry.source || 'community',
    submitted_by: userId || null,
  }
  // ⚠️ 已有库 community_words 未必对 word 建唯一约束，upsert 的 onConflict:'word'
  // 会报「no unique or exclusion constraint matching the ON CONFLICT specification」。
  // 改为「先查后 insert / update」，不依赖唯一约束即可稳定写入社区贡献记录。
  const { data: existing } = await safeQuery(
    supabase.from('community_words').select('word').eq('word', row.word).maybeSingle()
  )
  let data = null
  let error = null
  if (existing) {
    const r = await safeQuery(
      supabase.from('community_words').update(row).eq('word', row.word).select().single()
    )
    data = r.data
    error = r.error
  } else {
    const r = await safeQuery(
      supabase.from('community_words').insert(row).select().single()
    )
    data = r.data
    error = r.error
  }
  if (error) {
    console.error('[saveCommunityWord]', error.message)
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

export async function getCommunityWord(word) {
  if (!isSupabaseConfigured) {
    return getGlobal('community_words', []).find((w) => w.word.toLowerCase() === (word || '').toLowerCase()) || null
  }
  if (!supabase || !word) return null
  const { data } = await safeQuery(
    supabase.from('community_words').select('*').eq('word', word.toLowerCase()).maybeSingle()
  )
  return data || null
}
