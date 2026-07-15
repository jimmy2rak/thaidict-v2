// 为缺失 segmented 的例句补充分词（服务端 PyThaiNLP / 服务端 JS 兜底）
// 调用点：saveCommunityWord / addDictionaryWord 入库前，确保数据库金标准完整

/**
 * 对单个例句补充 segmented。如果已有 segmented 则跳过。
 * 返回：{ th, zh, segmented } 的新对象（不修改原对象）。
 */
export async function fillExampleSegment(example) {
  if (!example) return example
  const ex = { ...example }
  if (Array.isArray(ex.segmented) && ex.segmented.length > 0) {
    return ex
  }
  const th = ex.th ?? ex.thai ?? ex.text ?? ''
  if (!th || !th.trim()) return ex

  // 仅浏览器环境调用 API；服务端环境由批量脚本 / 后端处理
  if (typeof window === 'undefined') return ex

  try {
    const res = await fetch('/api/thai-segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: th }),
    })
    if (!res.ok) throw new Error('segment failed')
    const j = await res.json()
    if (Array.isArray(j.data) && j.data.length) {
      ex.segmented = j.data.map((t) => ({
        text: t.text,
        pos: t.pos || '',
        meaning: t.meaning || '',
      }))
    }
  } catch (e) {
    console.warn('[fillExampleSegment] 分词兜底失败', e)
  }
  return ex
}

/**
 * 对 sense 数组内所有 examples 批量补充分词。
 */
export async function fillSensesSegments(senses) {
  if (!Array.isArray(senses)) return senses
  const out = []
  for (const s of senses) {
    const sense = { ...s }
    if (Array.isArray(sense.examples)) {
      sense.examples = await Promise.all(sense.examples.map((ex) => fillExampleSegment(ex)))
    }
    out.push(sense)
  }
  return out
}

/**
 * 对单个 sense 的 examples 补充分词。
 */
export async function fillSenseSegments(sense) {
  if (!sense) return sense
  const s = { ...sense }
  if (Array.isArray(s.examples)) {
    s.examples = await Promise.all(s.examples.map((ex) => fillExampleSegment(ex)))
  }
  return s
}
