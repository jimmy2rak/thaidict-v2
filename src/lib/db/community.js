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
  const { data, error } = await safeQuery(
    supabase
      .from('community_words')
      .upsert({ ...entry, word: (entry.word || '').toLowerCase() }, { onConflict: 'word' })
      .select()
      .single()
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
