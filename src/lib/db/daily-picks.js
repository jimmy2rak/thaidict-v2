// 每日推荐。mock 走 localStorage；real 模式走 Edge Function（修复 Bug B-4）。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'
import { getWordByThai } from './search.js'
import { getSentenceById } from './sentences.js'

export async function loadDailyPick() {
  if (!isSupabaseConfigured) {
    const pick = getGlobal('daily_picks', null)
    if (!pick) return { word: null, sentence: null }
    const word = pick.daily_word_id ? await getWordByThai(pick.daily_word_id) : null
    const sentence = pick.daily_sentence_id ? await getSentenceById(pick.daily_sentence_id) : null
    return { word, sentence }
  }
  if (!supabase) return { word: null, sentence: null }
  const { data } = await safeQuery(supabase.from('daily_picks').select('*').maybeSingle())
  if (!data) return { word: null, sentence: null }
  const [word, sentence] = await Promise.all([
    data.daily_word_id ? getWordByThai(data.daily_word_id) : null,
    data.daily_sentence_id ? getSentenceById(data.daily_sentence_id) : null,
  ])
  return { word, sentence }
}

// 刷新每日推荐（mock 本地随机；real 走 Edge Function refresh-daily-pick）
export async function refreshDailyPick(type = 'both') {
  if (!isSupabaseConfigured) {
    const dict = getGlobal('dictionary', [])
    const sentences = getGlobal('sentences', [])
    const pick = getGlobal('daily_picks', {})
    if (type === 'word' || type === 'both') {
      pick.daily_word_id = dict.length ? dict[Math.floor(Math.random() * dict.length)].word : pick.daily_word_id
    }
    if (type === 'sentence' || type === 'both') {
      pick.daily_sentence_id = sentences.length ? sentences[Math.floor(Math.random() * sentences.length)].id : pick.daily_sentence_id
    }
    pick.pick_date = new Date().toISOString().slice(0, 10)
    setGlobal('daily_picks', pick)
    return loadDailyPick()
  }
  // real 模式：由 Edge Function 使用 service_role 写入（Bug B-4）
  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/refresh-daily-pick`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ type }),
    })
    if (!res.ok) return loadDailyPick()
    return loadDailyPick()
  } catch (e) {
    console.error('[refreshDailyPick]', e)
    return loadDailyPick()
  }
}
