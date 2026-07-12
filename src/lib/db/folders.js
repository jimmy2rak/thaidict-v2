// 文件夹（单词夹 / 句子夹）。mock 走 localStorage；real 走 Supabase。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

function mockFolders(userId) {
  const folders = getUserColl(userId, 'folders', [])
  const words = getUserColl(userId, 'folder_words', [])
  const sentences = getUserColl(userId, 'folder_sentences', [])
  return folders.map((f) => ({
    ...f,
    wordCount: words.filter((w) => w.folder_id === f.id).length,
    sentenceCount: sentences.filter((s) => s.folder_id === f.id).length,
  }))
}

export async function getFolders(userId) {
  if (!isSupabaseConfigured) return mockFolders(userId)
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_folders').select('*, word_count:user_folder_words(count), sentence_count:user_folder_sentences(count)').eq('user_id', userId)
  )
  if (error) {
    console.error('[getFolders]', error.message)
    return []
  }
  // 防御性解析嵌套 count（修复 Bug C-4）
  return (data || []).map((f) => ({
    ...f,
    wordCount: Array.isArray(f.word_count) ? f.word_count[0]?.count ?? 0 : (typeof f.word_count === 'number' ? f.word_count : 0),
    sentenceCount: Array.isArray(f.sentence_count)
      ? f.sentence_count[0]?.count ?? 0
      : (typeof f.sentence_count === 'number' ? f.sentence_count : 0),
  }))
}

export async function createFolder(userId, name, color, folderType) {
  if (!isSupabaseConfigured) {
    const folders = getUserColl(userId, 'folders', [])
    const f = { id: uid(), name, color: color || '#5B8C7E', folder_type: folderType, sort_order: folders.length }
    folders.push(f)
    setUserColl(userId, 'folders', folders)
    return f
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase.from('user_folders').insert({ user_id: userId, name, color, folder_type: folderType }).select().single()
  )
  if (error) {
    console.error('[createFolder]', error.message)
    return null
  }
  return data
}

export async function getFolderWords(folderId) {
  if (!isSupabaseConfigured) {
    return getUserColl('__', 'folder_words', []).filter((w) => w.folder_id === folderId)
  }
  if (!supabase) return []
  const { data } = await safeQuery(
    supabase.from('user_folder_words').select('word').eq('folder_id', folderId)
  )
  return (data || []).map((r) => ({ word: r.word }))
}

export async function getFolderSentences(folderId) {
  if (!isSupabaseConfigured) {
    const rel = getUserColl('__', 'folder_sentences', []).filter((s) => s.folder_id === folderId)
    return rel
  }
  if (!supabase) return []
  const { data } = await safeQuery(
    supabase.from('user_folder_sentences').select('sentence_id').eq('folder_id', folderId)
  )
  return data || []
}

export async function addWordToFolder(folderId, word) {
  if (!isSupabaseConfigured) {
    const list = getUserColl('__', 'folder_words', [])
    if (!list.some((w) => w.folder_id === folderId && w.word === word)) {
      list.push({ folder_id: folderId, word, created_at: new Date().toISOString() })
      setUserColl('__', 'folder_words', list)
    }
    return list
  }
  if (!supabase) return []
  await safeQuery(supabase.from('user_folder_words').upsert({ folder_id: folderId, word }))
  return getFolderWords(folderId)
}

export async function removeWordFromFolder(folderId, word) {
  if (!isSupabaseConfigured) {
    const list = getUserColl('__', 'folder_words', []).filter(
      (w) => !(w.folder_id === folderId && w.word === word)
    )
    setUserColl('__', 'folder_words', list)
    return list
  }
  if (!supabase) return []
  await safeQuery(
    supabase.from('user_folder_words').delete().eq('folder_id', folderId).eq('word', word)
  )
  return getFolderWords(folderId)
}

export async function addSentenceToFolder(folderId, sentenceId) {
  if (!isSupabaseConfigured) {
    const list = getUserColl('__', 'folder_sentences', [])
    if (!list.some((s) => s.folder_id === folderId && s.sentence_id === sentenceId)) {
      list.push({ folder_id: folderId, sentence_id: sentenceId, created_at: new Date().toISOString() })
      setUserColl('__', 'folder_sentences', list)
    }
    return list
  }
  if (!supabase) return []
  await safeQuery(
    supabase.from('user_folder_sentences').upsert({ folder_id: folderId, sentence_id: sentenceId })
  )
  return getFolderSentences(folderId)
}

export async function renameFolder(folderId, name) {
  if (!isSupabaseConfigured) {
    const folders = getUserColl('__', 'folders', [])
    const f = folders.find((x) => x.id === folderId)
    if (f) f.name = name
    setUserColl('__', 'folders', folders)
    return f
  }
  if (!supabase) return null
  const { data } = await safeQuery(
    supabase.from('user_folders').update({ name }).eq('id', folderId).select().single()
  )
  return data
}

export async function deleteFolder(folderId) {
  if (!isSupabaseConfigured) {
    setUserColl('__', 'folders', getUserColl('__', 'folders', []).filter((f) => f.id !== folderId))
    setUserColl('__', 'folder_words', getUserColl('__', 'folder_words', []).filter((w) => w.folder_id !== folderId))
    setUserColl('__', 'folder_sentences', getUserColl('__', 'folder_sentences', []).filter((s) => s.folder_id !== folderId))
    return
  }
  if (!supabase) return
  await safeQuery(supabase.from('user_folders').delete().eq('id', folderId))
}
