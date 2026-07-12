// 最近查词。mock 走 localStorage；real 走 Supabase user_recent_words。
// 修复 Bug B-1：lookup_count 递增（先 update 再 insert）。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, getTodayCST } from '../utils.js'
import { getUserColl, setUserColl, getGlobal } from '../mock/store.js'
import { transformWordData } from '../utils.js'

export async function recordWordLookup(userId, word) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'recent_words', [])
    const e = list.find((r) => r.word === word)
    if (e) {
      e.lookup_count += 1
      e.looked_up_at = new Date().toISOString()
    } else {
      list.unshift({ word, lookup_count: 1, looked_up_at: new Date().toISOString() })
    }
    setUserColl(userId, 'recent_words', list)
    return list
  }
  if (!supabase || !userId || !word) return null
  const { data: existing } = await safeQuery(
    supabase.from('user_recent_words').select('lookup_count').eq('user_id', userId).eq('word', word).maybeSingle()
  )
  if (existing) {
    await safeQuery(
      supabase
        .from('user_recent_words')
        .update({ looked_up_at: new Date().toISOString(), lookup_count: (existing.lookup_count || 0) + 1 })
        .eq('user_id', userId)
        .eq('word', word)
    )
  } else {
    await safeQuery(
      supabase
        .from('user_recent_words')
        .insert({ user_id: userId, word, looked_up_at: new Date().toISOString(), lookup_count: 1 })
    )
  }
  return getUserRecentWords(userId)
}

export async function getUserRecentWords(userId, limit = 50) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'recent_words', []).slice(0, limit)
    const dict = getGlobal('dictionary', [])
    return list
      .map((r) => {
        const row = dict.find((d) => d.word === r.word)
        if (row) return { ...transformWordData(row), lookup_count: r.lookup_count }
        return { word: r.word, romanization: '', pos: '', senses: [], synonyms: [], antonyms: [], learnerAssociations: [], senseCount: 0, source: 'recent' }
      })
      .filter((r) => r.senses.length || r.word)
  }
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_recent_words').select('*').eq('user_id', userId).order('looked_up_at', { ascending: false }).limit(limit)
  )
  if (error) return []
  return data || []
}

export async function getRecentWordCount(userId) {
  const list = await getUserRecentWords(userId, 1000)
  return list.length
}
