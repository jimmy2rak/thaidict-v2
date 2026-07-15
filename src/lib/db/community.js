// 社区共建词库。mock 走 localStorage；real 走 Supabase community_words。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'

export async function saveCommunityWord(entry, userId, zhHint) {
  if (!isSupabaseConfigured) {
    const list = getGlobal('community_words', [])
    const i = list.findIndex((w) => w.word.toLowerCase() === (entry.word || '').toLowerCase())
    const row = { ...entry, submitted_by: userId || null, zh_hint: zhHint || '', updated_at: new Date().toISOString() }
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
    senses: entry.senses || [],
    synonyms: entry.synonyms || [],
    antonyms: entry.antonyms || [],
    learner_associations: entry.learner_associations || [],
    zh_hint: zhHint || '',
    source: entry.source || 'community',
    submitted_by: userId || null,
  }
  const { data, error } = await safeQuery(
    supabase.from('community_words').upsert(row, { onConflict: 'word' }).select().single()
  )
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
