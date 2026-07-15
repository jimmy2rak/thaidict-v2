// 服务端泰语分词：共享词典加载，供 /api/thai-segment 与 /api/admin/backfill-segmented 使用。
// 仅服务端 import，不要在前端引用此文件。
import { getServerSupabase } from './supabaseServer'
import { tokenize, setDictWords } from '../utils/thaiToken'

let dictLoaded = false
let dictLoading = null

async function loadDictOnce() {
  const supabase = getServerSupabase()
  if (!supabase) {
    console.warn('[thaiSegmentServer] Supabase service_role 未配置，使用内置基础词库')
    setDictWords([])
    return
  }
  // 并发分页拉取，限制上限（避免 6 万词串行导致冷启动超时）
  const CAP = 20000
  const pages = Math.ceil(CAP / 1000)
  try {
    const results = await Promise.all(
      Array.from({ length: pages }, (_, p) =>
        supabase.from('dictionary_full').select('word').range(p * 1000, p * 1000 + 999)
      )
    )
    const words = []
    for (const { data } of results) {
      if (data && data.length) for (const r of data) if (r.word) words.push(r.word)
    }
    setDictWords(words.slice(0, CAP))
    console.log('[thaiSegmentServer] 词典加载完成，共', Math.min(words.length, CAP), '词')
  } catch (e) {
    console.error('[thaiSegmentServer] 拉取词典失败', e)
  }
}

async function ensureDict() {
  if (dictLoaded) return
  if (dictLoading) return dictLoading
  dictLoading = loadDictOnce()
  await dictLoading
  dictLoaded = true
  dictLoading = null
}

export async function serverTokenize(text) {
  await ensureDict()
  return tokenize(text)
}

export async function serverTokenizeToSegmented(text) {
  const tokens = await serverTokenize(text)
  return tokens
    .filter((t) => t.type !== 'space')
    .map((t) => ({ text: t.text, meaning: '' }))
}
