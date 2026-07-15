// 社区共建词库。mock 走 localStorage；real 走 Supabase community_words。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'

export async function saveCommunityWord(entry, userId, zhHint) {
  if (!isSupabaseConfigured) {
    const list = getGlobal('community_words', [])
    const i = list.findIndex((w) => w.word.toLowerCase() === (entry.word || '').toLowerCase())
    const row = { ...entry, zh_hint: zhHint || '', updated_at: new Date().toISOString() }
    if (i >= 0) list[i] = row
    else list.push(row)
    setGlobal('community_words', list)
    return row
  }
  if (!supabase) return null
  // 真实库 community_words 列：word, senses, zh_hint, source, created_at。
  // 只提交这几列，避免传入 entry 里的 romanization/synonyms/antonyms/learner_associations 等触发 400。
  const row = {
    word: (entry.word || '').toLowerCase(),
    senses: entry.senses || [],
    zh_hint: zhHint || '',
    source: entry.source || 'community',
  }
  const { data, error } = await safeQuery(
    supabase.from('community_words').upsert(row, { onConflict: 'word' }).select().single()
  )
  if (error) {
    console.error('[saveCommunityWord]', error.message)
    return null
  }
  return data
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
