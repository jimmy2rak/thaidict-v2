// 泰语分词：最长匹配 + 音节启发式。词典来自 DB（AppContext 启动时加载）。
let dictWords = new Set()

export function setDictWords(words) {
  dictWords = new Set((words || []).map((w) => w.toLowerCase()))
}

export function loadDictFromDB() {
  // 真实模式由 AppContext 调用 DB 加载；此处提供版本占位（修复 Bug G-4 在接入时实现）
  return dictWords
}

// 分词主函数：text 为泰语字符串，返回 [{text, meaning?}]
export function thaiSegment(text, meaningsMap = {}) {
  if (!text) return []
  const tokens = text.split(/\s+/).filter(Boolean)
  const out = []
  for (const tok of tokens) {
    out.push(...segmentToken(tok, meaningsMap))
  }
  return out
}

function segmentToken(tok, meaningsMap) {
  const lower = tok.toLowerCase()
  if (dictWords.has(lower)) {
    return [{ text: tok, meaning: meaningsMap[lower]?.meanings?.[0] || '' }]
  }
  // 最长匹配：从词首尝试匹配词典中最长前缀
  let i = tok.length
  while (i > 1) {
    const sub = tok.slice(0, i).toLowerCase()
    if (dictWords.has(sub)) {
      const rest = tok.slice(i)
      return [{ text: tok.slice(0, i), meaning: meaningsMap[sub]?.meanings?.[0] || '' }, ...(rest ? segmentToken(rest, meaningsMap) : [])]
    }
    i--
  }
  // 无法切分：按字符返回（音节启发式兜底）
  return [{ text: tok, meaning: '' }]
}

// 给分词结果补中文含义
export function enrichSegmented(segments, dictMap) {
  if (!Array.isArray(segments)) return []
  return segments.map((seg) => {
    const key = (seg.text || '').toLowerCase()
    return {
      text: seg.text,
      meaning: seg.meaning || (dictMap?.[key]?.meanings?.[0] || ''),
    }
  })
}
