// 学习计划 / 进度。mock 走 localStorage；real 走 Supabase。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

export async function getLearningPlan(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'learning_plan', null)
  if (!supabase || !userId) return null
  const { data } = await safeQuery(
    supabase.from('user_learning_plans').select('*').eq('user_id', userId).maybeSingle()
  )
  return data || null
}

export async function saveLearningPlan(userId, plan) {
  if (!isSupabaseConfigured) {
    const p = { id: uid(), user_id: userId, ...plan }
    setUserColl(userId, 'learning_plan', p)
    return p
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase.from('user_learning_plans').upsert({ user_id: userId, ...plan }).select().single()
  )
  if (error) {
    console.error('[saveLearningPlan]', error.message)
    return null
  }
  return data
}

export async function getLearningProgress(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'learning_progress', [])
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase.from('user_learning_progress').select('*').eq('user_id', userId)
  )
  return data || []
}
