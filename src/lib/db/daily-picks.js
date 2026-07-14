// 每日推荐。mock 走 localStorage；real 模式走 Edge Function（修复 Bug B-4）。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery } from '../utils.js'
import { getGlobal, setGlobal } from '../mock/store.js'
import { getWordByThai } from './search.js'
import { getSentenceById, getDailySentence, normalizeSentence } from './sentences.js'

export async function loadDailyPick() {
  if (!isSupabaseConfigured) {
    const pick = getGlobal('daily_picks', null)
    if (!pick) return { word: null, sentence: null }
    const [word, sentence] = await Promise.all([
      pick.daily_word_id ? await getWordByThai(pick.daily_word_id) : null,
      pick.daily_sentence_id ? await getSentenceById(pick.daily_sentence_id) : null,
    ])
    return { word, sentence }
  }
  if (!supabase) return { word: null, sentence: null }

  // 兜底：直接 RPC 随机取
  const fetchRandomWord = async () => {
    const { data } = await safeQuery(supabase.rpc('get_random_word'))
    return data || null
  }
  const fetchRandomSentence = async () => getDailySentence()

  const { data: pick } = await safeQuery(supabase.from('daily_picks').select('*').maybeSingle())
  if (!pick) {
    const [word, sentence] = await Promise.all([fetchRandomWord(), fetchRandomSentence()])
    return { word, sentence }
  }

  // 若 daily_picks 配置了 word/sentence 但查不到（如已被删除），则回退随机取，避免首页空白
  const [word, sentence] = await Promise.all([
    pick.daily_word_id
      ? getWordByThai(pick.daily_word_id).then((w) => w || fetchRandomWord())
      : fetchRandomWord(),
    pick.daily_sentence_id
      ? getSentenceById(pick.daily_sentence_id).then((s) => s || fetchRandomSentence())
      : fetchRandomSentence(),
  ])
  return { word, sentence }
}

// 刷新每日推荐。优先走 Edge Function；失败或不存在时，前端直接从 sentences/dictionary_full 随机取并尝试回写 daily_picks。
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
  if (!supabase) return { word: null, sentence: null }

  // real 模式：先尝试 Edge Function（如已部署）
  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/refresh-daily-pick`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ type }),
    })
    if (res.ok) return loadDailyPick()
  } catch (e) {
    console.error('[refreshDailyPick] Edge Function 失败，回退前端随机', e)
  }

  // 回退：前端随机取，并尝试回写 daily_picks（有写权限则持久化，无则仅本次展示）
  const [word, sentence] = await Promise.all([
    (type === 'word' || type === 'both') ? safeQuery(supabase.rpc('get_random_word')).then((r) => r.data) : null,
    (type === 'sentence' || type === 'both') ? getDailySentence() : null,
  ])
  const current = await safeQuery(supabase.from('daily_picks').select('*').maybeSingle())
  const upsertData = {
    pick_date: new Date().toISOString().slice(0, 10),
    daily_word_id: word?.word ?? current?.data?.daily_word_id ?? null,
    daily_sentence_id: sentence?.id ?? current?.data?.daily_sentence_id ?? null,
  }
  await safeQuery(supabase.from('daily_picks').upsert({ id: current?.data?.id, ...upsertData }))
  return { word, sentence }
}
