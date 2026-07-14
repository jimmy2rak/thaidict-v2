// 打卡任务的学习类型定义（多选）。custom 为自定义字符串。
export const TASK_TYPES = [
  { v: 'word', l: '单词' },
  { v: 'grammar', l: '语法' },
  { v: 'reading', l: '阅读' },
  { v: 'listening', l: '听力' },
  { v: 'speaking', l: '口语' },
  { v: 'writing', l: '写作' },
]

export function typeLabel(v) {
  if (!v) return '单词'
  const hit = TASK_TYPES.find((t) => t.v === v)
  return hit ? hit.l : v // 自定义类型直接回显原字符串
}

export function typeLabels(arr) {
  if (!arr || !arr.length) return '单词'
  return arr.map(typeLabel).join('/')
}
