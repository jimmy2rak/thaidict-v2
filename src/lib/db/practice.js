// 练习 / 测验（文档3.6）。mock 走 localStorage；real 走 Supabase user_practice_records / user_practice_wrong。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

export async function getPracticeRecords(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'practice_records', [])
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_practice_records').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  )
  if (error) {
    console.error('[getPracticeRecords]', error.message)
    return []
  }
  return data || []
}

export async function savePracticeRecord(userId, { mode, correct_count, total_count, duration_seconds }) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'practice_records', [])
    const r = { id: uid(), user_id: userId, mode, correct_count, total_count, duration_seconds, created_at: new Date().toISOString() }
    list.push(r)
    setUserColl(userId, 'practice_records', list)
    return list
  }
  if (!supabase || !userId) return []
  const { error } = await safeQuery(
    supabase.from('user_practice_records').insert({ user_id: userId, mode, correct_count, total_count, duration_seconds })
  )
  if (error) console.error('[savePracticeRecord]', error.message)
  return getPracticeRecords(userId)
}

export async function getPracticeWrong(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'practice_wrong', [])
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_practice_wrong').select('*').eq('user_id', userId).order('wrong_count', { ascending: false })
  )
  if (error) {
    console.error('[getPracticeWrong]', error.message)
    return []
  }
  return data || []
}

export async function recordWrongWord(userId, word) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'practice_wrong', [])
    const e = list.find((w) => w.word === word)
    if (e) e.wrong_count += 1
    else list.push({ id: uid(), user_id: userId, word, wrong_count: 1, last_wrong_at: new Date().toISOString() })
    setUserColl(userId, 'practice_wrong', list)
    return list
  }
  if (!supabase || !userId) return []
  await safeQuery(
    supabase
      .from('user_practice_wrong')
      .upsert({ user_id: userId, word, wrong_count: 1 }, { onConflict: 'user_id,word' })
  )
  return getPracticeWrong(userId)
}

export async function getPracticeStats(userId) {
  const records = await getPracticeRecords(userId)
  const wrong = await getPracticeWrong(userId)
  const total = records.reduce((s, r) => s + (r.total_count || 0), 0)
  const correct = records.reduce((s, r) => s + (r.correct_count || 0), 0)
  return { count: records.length, total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0, wrongCount: wrong.length }
}
