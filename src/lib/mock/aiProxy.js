// 模拟 AI 词条生成：基于规则返回一个结构化的 community_words 行。
// 真实模式下由 Supabase Edge Function `ai-proxy` 替代。

export function generateMockWord(word, zhHint = '') {
  const w = (word || '').trim()
  const hint = (zhHint || '').trim()
  return {
    word: w,
    romanization: '',
    senses: [
      {
        sense_id: 1,
        pos: '?',
        meaning: hint || '（模拟生成：未提供中文提示）',
        register: '通用',
        examples: hint
          ? [{
              th: w,
              zh: hint,
              segmented: [{ text: w, pos: '?', meaning: hint }],
            }]
          : [],
        source: 'ai-mock',
      },
    ],
    synonyms: [],
    antonyms: [],
    learner_associations: [],
    sense_count: 1,
    enrichment_status: 'community',
  }
}

// 从自然语言 prompt 中尽量抽取泰语词与中文提示
export function parsePrompt(prompt) {
  if (!prompt) return { word: '', zhHint: '' }
  if (typeof prompt === 'object') return { word: prompt.word || '', zhHint: prompt.zhHint || '' }
  let word = ''
  const m = prompt.match(/[“"]([^”"]+)[”"]/)
  if (m) word = m[1]
  let zhHint = ''
  const h = prompt.match(/(?:提示|hint)[：:]\s*([^\n]+)/i)
  if (h) zhHint = h[1].trim()
  return { word, zhHint }
}
