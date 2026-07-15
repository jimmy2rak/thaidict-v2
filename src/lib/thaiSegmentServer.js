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
  const words = new Set()
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('dictionary_full')
      .select('word')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[thaiSegmentServer] 拉取词典失败', error.message)
      break
    }
    if (!data || data.length === 0) break
    data.forEach((r) => {
      if (r.word && typeof r.word === 'string') words.add(r.word)
    })
    if (data.length < PAGE) break
    from += PAGE
  }
  setDictWords([...words])
  console.log('[thaiSegmentServer] 词典加载完成，共', words.size, '词')
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
