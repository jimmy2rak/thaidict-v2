// 成就 / 徽章（文档3.9）。mock 走 localStorage；real 走 Supabase user_achievements。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl, getGlobal } from '../mock/store.js'

export const ACHIEVEMENT_DEFS = [
  { key: 'streak_7', name: '一周坚持', desc: '连续打卡 7 天', icon: 'flame' },
  { key: 'bookmark_100', name: '百词斩', desc: '收藏 100 个词', icon: 'bookmark' },
  { key: 'book_done', name: '学以致用', desc: '完成一本单词书', icon: 'award' },
  { key: 'practice_10', name: '初露锋芒', desc: '完成 10 次练习', icon: 'target' },
]

export async function getAchievements(userId) {
  if (!isSupabaseConfigured) return getUserColl(userId, 'achievements', [])
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_achievements').select('*').eq('user_id', userId)
  )
  if (error) {
    console.error('[getAchievements]', error.message)
    return []
  }
  return data || []
}

export async function unlockAchievement(userId, key) {
  const def = (isSupabaseConfigured ? ACHIEVEMENT_DEFS : getGlobal('achievements_defs', ACHIEVEMENT_DEFS)).find((d) => d.key === key)
  if (!def) return { unlocked: false }
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'achievements', [])
    if (list.some((a) => a.badge_key === key)) return { unlocked: false }
    const entry = { id: uid(), user_id: userId, badge_key: key, unlocked_at: new Date().toISOString() }
    list.push(entry)
    setUserColl(userId, 'achievements', list)
    return { unlocked: true, def }
  }
  if (!supabase || !userId) return { unlocked: false }
  const { data, error } = await safeQuery(
    supabase.from('user_achievements').upsert({ user_id: userId, badge_key: key }, { onConflict: 'user_id,badge_key' }).select().single()
  )
  if (error) return { unlocked: false }
  return { unlocked: true, def }
}

// ctx: { streak, bookmarkCount, practiceCount, bookCompleted }
export async function checkAchievements(userId, ctx = {}) {
  const newly = []
  if (ctx.streak >= 7) {
    const r = await unlockAchievement(userId, 'streak_7')
    if (r.unlocked) newly.push(r.def)
  }
  if (ctx.bookmarkCount >= 100) {
    const r = await unlockAchievement(userId, 'bookmark_100')
    if (r.unlocked) newly.push(r.def)
  }
  if (ctx.bookCompleted) {
    const r = await unlockAchievement(userId, 'book_done')
    if (r.unlocked) newly.push(r.def)
  }
  if (ctx.practiceCount >= 10) {
    const r = await unlockAchievement(userId, 'practice_10')
    if (r.unlocked) newly.push(r.def)
  }
  return newly
}
