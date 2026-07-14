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
    const word = pick.daily_word_id ? await getWordByThai(pick.daily_word_id) : null
    const sentence = pick.daily_sentence_id ? await getSentenceById(pick.daily_sentence_id) : null
    return { word, sentence: sentence ? normalizeSentence(sentence) : null }
  }
  if (!supabase) return { word: null, sentence: null }
  const { data } = await safeQuery(supabase.from('daily_picks').select('*').maybeSingle())
  if (!data) {
    // daily_picks 空表：直接从词典/句子表随机取一个，避免首页无卡片
    const [w, s] = await Promise.all([
      safeQuery(supabase.rpc('get_random_word')),
      getDailySentence(),
    ])
    return { word: w.data || null, sentence: s || null }
  }
  const [word, sentence] = await Promise.all([
    data.daily_word_id ? getWordByThai(data.daily_word_id) : safeQuery(supabase.rpc('get_random_word')).then((r) => r.data),
    data.daily_sentence_id
      ? getSentenceById(data.daily_sentence_id).then((s) => s ? normalizeSentence(s) : null)
      : getDailySentence(),
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
