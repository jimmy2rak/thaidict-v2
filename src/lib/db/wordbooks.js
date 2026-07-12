// 单词书（文档3.8）。mock 走 localStorage；real 走 Supabase word_books / word_book_entries / user_word_book_progress。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, getUserColl, setUserColl } from '../mock/store.js'

export async function getWordBooks() {
  if (!isSupabaseConfigured) return getGlobal('word_books', [])
  if (!supabase) return []
  const { data, error } = await safeQuery(supabase.from('word_books').select('*').order('sort_order'))
  if (error) {
    console.error('[getWordBooks]', error.message)
    return []
  }
  return data || []
}

export async function getWordBook(id) {
  if (!isSupabaseConfigured) return getGlobal('word_books', []).find((b) => b.id === id) || null
  if (!supabase) return null
  const { data } = await safeQuery(supabase.from('word_books').select('*').eq('id', id).maybeSingle())
  return data || null
}

export async function getWordBookProgress(userId, bookId) {
  if (!isSupabaseConfigured) {
    return getUserColl(userId, 'word_book_progress', []).find((p) => p.book_id === bookId) || null
  }
  if (!supabase || !userId) return null
  const { data } = await safeQuery(
    supabase.from('user_word_book_progress').select('*').eq('user_id', userId).eq('book_id', bookId).maybeSingle()
  )
  return data || null
}

export async function updateWordBookProgress(userId, bookId, { last_word_index = 0, completed = false }) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'word_book_progress', [])
    let p = list.find((x) => x.book_id === bookId)
    if (!p) {
      p = { id: bookId + '_' + userId, user_id: userId, book_id: bookId, last_word_index, completed }
      list.push(p)
    } else {
      p.last_word_index = last_word_index
      p.completed = completed
    }
    setUserColl(userId, 'word_book_progress', list)
    return p
  }
  if (!supabase || !userId) return null
  const { data } = await safeQuery(
    supabase
      .from('user_word_book_progress')
      .upsert({ user_id: userId, book_id: bookId, last_word_index, completed }, { onConflict: 'user_id,book_id' })
      .select()
      .single()
  )
  return data
}
