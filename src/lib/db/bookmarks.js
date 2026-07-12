// 单词收藏。mock 走 localStorage；real 走 Supabase user_bookmarks。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

function mockGet(userId) {
  return getUserColl(userId, 'bookmarks', [])
}
function mockAdd(userId, word) {
  const list = mockGet(userId)
  if (!list.some((b) => b.word === word)) {
    list.push({ word, created_at: new Date().toISOString() })
    setUserColl(userId, 'bookmarks', list)
  }
  return list
}
function mockRemove(userId, word) {
  const list = mockGet(userId).filter((b) => b.word !== word)
  setUserColl(userId, 'bookmarks', list)
  return list
}

export async function getBookmarks(userId) {
  if (!isSupabaseConfigured) return mockGet(userId)
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_bookmarks').select('*').eq('user_id', userId)
  )
  if (error) {
    console.error('[getBookmarks]', error.message)
    return []
  }
  return data || []
}

export async function addBookmark(userId, word) {
  if (!isSupabaseConfigured) return mockAdd(userId, word)
  if (!supabase || !userId || !word) return []
  const { error } = await safeQuery(
    supabase.from('user_bookmarks').upsert({ user_id: userId, word })
  )
  if (error) console.error('[addBookmark]', error.message)
  return getBookmarks(userId)
}

export async function removeBookmark(userId, word) {
  if (!isSupabaseConfigured) return mockRemove(userId, word)
  if (!supabase || !userId || !word) return []
  await safeQuery(supabase.from('user_bookmarks').delete().eq('user_id', userId).eq('word', word))
  return getBookmarks(userId)
}

export async function isBookmarked(userId, word) {
  if (!isSupabaseConfigured) return mockGet(userId).some((b) => b.word === word)
  if (!supabase || !userId || !word) return false
  const { data } = await safeQuery(
    supabase.from('user_bookmarks').select('word').eq('user_id', userId).eq('word', word).maybeSingle()
  )
  return !!data
}
