// =====================================================================
//  thaiToken.ts —— 泰语分词工具（纯前端，无第三方依赖、无后端）
// ---------------------------------------------------------------------
//  复刻 PyThaiNLP newmm（正向最长匹配）思路：
//    1) 字符清洗 / normalize
//    2) 前引字(ห/อ/ฮ) / 双辅音(ทร/คร/...) / 堆叠元音 天然随「泰语字符连续段」合并
//    3) 正向最长词典匹配（内置基础词库 + 可扩展自定义词库）
//  支持浏览器与 Node 环境直接 import。
//  本文件刻意不依赖任何框架，便于在你的 Vite / React 项目中直接使用。
// =====================================================================

// ---------- 类型定义 ----------
export type TokenType = 'word' | 'punct' | 'space'
export interface Token {
  text: string
  type: TokenType
}
export interface TokenizeResult {
  origin: string // 原文
  cleanText: string // 标准化后文本
  wordList: string[] // 仅含 word / punct（不含空格）
  joinText: string // wordList 用 + 拼接
}

// ---------- 1. 字符判定与 normalize ----------
// 是否为泰语 Unicode 区块字符（U+0E00–U+0E7F，含辅音/元音/声调/数字/符号）
function isThai(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return c >= 0x0e00 && c <= 0x0e7f
}
// 是否为空白
function isWhitespace(ch: string): boolean {
  return (
    ch === ' ' ||
    ch === '\t' ||
    ch === '\n' ||
    ch === '\r' ||
    ch.charCodeAt(0) === 0x00a0
  )
}
// 泰语标点
const THAI_PUNCT = 'ฯ๏๚๛฿'
// 半角标点
const ASCII_PUNCT = '!?"\'.,;:()[]{}<>/\\|-_=+*~`@#$%^&'
// 中文/全角标点
const CJK_PUNCT = '，。！？；：、（）【】《》「」『』…—·“”‘’'
// 是否为标点（点击标点不触发查词）
function isPunct(ch: string): boolean {
  if (
    THAI_PUNCT.includes(ch) ||
    ASCII_PUNCT.includes(ch) ||
    CJK_PUNCT.includes(ch)
  )
    return true
  const c = ch.charCodeAt(0)
  // 控制字符 / 通用符号 / CJK 符号
  return (
    c < 0x20 ||
    (c >= 0x2000 && c <= 0x206f) ||
    (c >= 0x3000 && c <= 0x303f) ||
    (c >= 0xfe30 && c <= 0xfe4f)
  )
}

// 字符清洗：去零宽/BOM、统一空白、去首尾空格
export function normalize(s: string): string {
  if (!s) return ''
  // 去除零宽字符与 BOM
  s = s.replace(/[​\u200b\u200c\u200d\ufeff]/g, '')
  // 各类特殊空白统一为普通空格
  s = s.replace(/[ \u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// ---------- 2. 内置基础词库（常用泰语，可自行扩充） ----------
// 仅为「演示/兜底」用的基础高频词；专业词汇请通过 addCustomWord 追加。
const BUILTIN: string[] = [
  // 问候 / 语气词
  'สวัสดี', 'ค่ะ', 'ครับ', 'นะคะ', 'นะครับ', 'นะ', 'แล้ว', 'แล้วก็', 'ด้วย', 'ไหม', 'หรือ', 'และ', 'แต่',
  'ของ', 'ที่', 'ไป', 'มา', 'อยู่', 'ให้', 'ว่า', 'ได้', 'ไม่', 'อยาก', 'จะ', 'กำลัง', 'ยัง', 'เคย', 'ผ่าน',
  'จริง', 'หมด', 'ทุก', 'ทั้ง', 'มาก', 'น้อย', 'สุด', 'เอง', 'กัน', 'เถอะ', 'ซิ', 'นี่', 'นั่น', 'โน่น', 'อัน',
  'เรื่อง', 'อย่าง', 'แบบ', 'วิธี', 'ครั้ง', 'ที', 'ขณะ', 'ตอน', 'วันนี้', 'เมื่อวาน', 'พรุ่งนี้', 'นี้', 'นั้น', 'ก็', 'อะไร', 'ทำไม', 'ที่ไหน', 'เมื่อไหร่', 'อย่างไร',
  // 时间 / 数量
  'เวลา', 'วัน', 'คืน', 'เช้า', 'กลางวัน', 'บ่าย', 'เย็น', 'ดึก', 'ปี', 'เดือน', 'สัปดาห์', 'ชั่วโมง', 'นาที', 'วินาที',
  'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน',
  // 人称 / 亲属
  'ฉัน', 'ผม', 'เขา', 'เธอ', 'เรา', 'คุณ', 'พี่', 'น้อง', 'ลุง', 'ป้า', 'น้า', 'อา', 'ตา', 'ยาย', 'ปู่', 'ย่า',
  'แม่', 'พ่อ', 'ลูก', 'หลาน', 'สามี', 'ภรรยา', 'เพื่อน', 'ครู', 'หมอ', 'ตำรวจ', 'ทหาร', 'นักเรียน', 'นักศึกษา',
  'ครอบครัว', 'คน', 'ชาย', 'หญิง', 'เด็ก', 'ผู้ชาย', 'ผู้หญิง',
  // 动物 / 自然
  'หมา', 'แมว', 'วัว', 'ควาย', 'ไก่', 'ปลา', 'ช้าง', 'ลิง', 'หมู', 'กระต่าย', 'นก', 'ผีเสื้อ',
  'ต้นไม้', 'ดอกไม้', 'ป่า', 'ภูเขา', 'ทะเล', 'แม่น้ำ',
  // 物品 / 场所
  'บ้าน', 'อาคาร', 'โต๊ะ', 'เก้าอี้', 'ประตู', 'หน้าต่าง', 'เตียง', 'ตู้', 'ถุง', 'กล่อง',
  'รถ', 'รถไฟ', 'เครื่องบิน', 'เรือ', 'มอเตอร์ไซค์', 'จักรยาน', 'ถนน', 'สะพาน', 'เมือง', 'ประเทศ', 'หมู่บ้าน',
  'ตลาด', 'ห้าง', 'ร้าน', 'โรงเรียน', 'มหาวิทยาลัย', 'โรงพยาบาล', 'วัด', 'สนามบิน',
  // 食物
  'อาหาร', 'ข้าว', 'น้ำ', 'ก๋วยเตี๋ยว', 'ผลไม้', 'กล้วย', 'แอปเปิ้ล', 'ส้ม', 'มะม่วง', 'ไข่', 'เนื้อ', 'น้ำตาล',
  // 形容词
  'เค็ม', 'เปรี้ยว', 'หวาน', 'ร้อน', 'หนาว', 'อร่อย', 'ดี', 'สวย', 'หล่อ', 'ใหญ่', 'เล็ก', 'ยาว', 'สั้น',
  'หนา', 'บาง', 'หนัก', 'เบา', 'เร็ว', 'ช้า', 'แพง', 'ถูก', 'ใหม่', 'เก่า', 'สะอาด', 'สกปรก',
  'แดง', 'เขียว', 'น้ำเงิน', 'เหลือง', 'ดำ', 'ขาว', 'สี',
  // 动词
  'ชอบ', 'รัก', 'เกลียด', 'กิน', 'ดื่ม', 'นอน', 'ทำ', 'ทำงาน', 'อ่าน', 'เขียน', 'ฟัง', 'ดู', 'พูด', 'เรียน',
  'เล่น', 'วิ่ง', 'เดิน', 'ยืน', 'นั่ง', 'ว่าย', 'ร้อง', 'หัวเราะ', 'ร้องไห้', 'ซื้อ', 'ขาย', 'จ่าย', 'ยืม',
  'คืน', 'ช่วย', 'รู้', 'เข้าใจ', 'ลืม', 'จำ', 'คิด', 'ฝัน', 'หวัง', 'มอง', 'เห็น', 'ได้ยิน', 'สัมผัส',
  'ตาย', 'เกิด', 'เปิด', 'ปิด', 'หา', 'เจอ', 'พบ', 'ส่ง', 'รับ', 'โทร',
  // 科技 / 学习
  'อินเทอร์เน็ต', 'คอมพิวเตอร์', 'โทรศัพท์', 'หนังสือ', 'ปากกา', 'กระดาษ',
  'ภาษา', 'ไทย', 'จีน', 'อังกฤษ', 'ญี่ปุ่น', 'เกาหลี', 'ฝรั่งเศส', 'ต่างประเทศ',
  // 状态 / 节日
  'สุข', 'สบาย', 'เหนื่อย', 'ป่วย', 'หิว', 'กระหาย', 'กลัว', 'โกรธ', 'เศร้า', 'ดีใจ',
  'ขอบคุณ', 'ขอโทษ', 'เชิญ', 'ลาก่อน', 'จังหวัด', 'เขต', 'ภาค', 'เหนือ', 'ใต้', 'ออก', 'ตก',
  'ตะวันออก', 'ตะวันตก', 'กลาง',
  // 复合词（避免被错误拆开）
  'ผู้ชาย', 'ผู้หญิง', 'ต้นไม้', 'ดอกไม้', 'รถไฟ', 'เครื่องบิน', 'โทรศัพท์', 'วันเกิด', 'ปีใหม่',
  'โรงเรียน', 'โรงพยาบาล', 'มหาวิทยาลัย',
]

// ---------- 3. 自定义词库（持久化到 localStorage） ----------
const CUSTOM_KEY = 'thai_token_custom_dict'
// 在浏览器/Node 下安全地取 localStorage
const LS = (): Storage | undefined =>
  typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : undefined

let CUSTOM = new Set<string>(loadCustom())
let DICT = buildDict()

function loadCustom(): string[] {
  try {
    const raw = LS()?.getItem(CUSTOM_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}
function persistCustom(): void {
  try {
    LS()?.setItem(CUSTOM_KEY, JSON.stringify([...CUSTOM]))
  } catch {
    /* ignore */
  }
}
function buildDict(): Set<string> {
  const s = new Set<string>()
  for (const w of BUILTIN) s.add(w)
  for (const w of CUSTOM) s.add(w)
  return s
}

/**
 * 新增自定义词条（持久化，刷新不丢失）。
 * 之后分词会优先命中这些词，适合追加你的专业词汇。
 * @returns 归一化后的词，或 null（空词）
 */
export function addCustomWord(word: string): string | null {
  const w = normalize(word)
  if (!w) return null
  CUSTOM.add(w)
  persistCustom()
  DICT = buildDict() // 重建词典
  return w
}
export function addCustomWords(list: string[]): void {
  ;(list || []).forEach((w) => addCustomWord(w))
}
export function getCustomWords(): string[] {
  return [...CUSTOM]
}
export function getBuiltinWords(): string[] {
  return [...BUILTIN]
}
export function clearCustomWords(): void {
  CUSTOM = new Set()
  persistCustom()
  DICT = buildDict()
}

// ---------- 4. 正向最长匹配分词（newmm 核心） ----------
const MAX_WORD = 30 // 单个词最大字符数，防止异常长串卡死

export function tokenize(input: string): Token[] {
  const clean = normalize(input)
  const tokens: Token[] = []
  let i = 0
  const n = clean.length
  while (i < n) {
    const ch = clean[i]
    // 空白：作为分隔，单独成 token（渲染时跳过）
    if (isWhitespace(ch)) {
      let j = i + 1
      while (j < n && isWhitespace(clean[j])) j++
      tokens.push({ text: clean.slice(i, j), type: 'space' })
      i = j
      continue
    }
    // 标点：单独成 token，点击不触发查词
    if (isPunct(ch)) {
      let j = i + 1
      while (j < n && isPunct(clean[j])) j++
      tokens.push({ text: clean.slice(i, j), type: 'punct' })
      i = j
      continue
    }
    // 正向最长词典匹配
    let matched: string | null = null
    const maxLen = Math.min(MAX_WORD, n - i)
    for (let len = maxLen; len >= 1; len--) {
      const cand = clean.slice(i, i + len)
      if (DICT.has(cand)) {
        matched = cand
        break
      }
    }
    if (matched) {
      tokens.push({ text: matched, type: 'word' })
      i += matched.length
    } else {
      // 无词典命中：消费一段连续泰语字符。
      // 前引字(ห/อ/ฮ)+辅音、双辅音(ทร/คร)、堆叠元音 都落在同一泰语区块，
      // 因此会天然作为一个音节整体，不会在中间断开。
      let j = i
      while (j < n && isThai(clean[j])) j++
      const piece = clean.slice(i, j)
      if (piece.length > 0) {
        tokens.push({ text: piece, type: 'word' })
        i = j
      } else {
        // 其它字符（如拉丁字母）：整体消费
        tokens.push({ text: ch, type: 'word' })
        i++
      }
    }
  }
  return tokens
}

// 简易音节粗分（兜底用）：不查词典，直接按泰语字符连续段切分
export function simpleSyllableSplit(input: string): Token[] {
  const clean = normalize(input)
  const tokens: Token[] = []
  let i = 0
  const n = clean.length
  while (i < n) {
    const ch = clean[i]
    if (isWhitespace(ch)) {
      let j = i + 1
      while (j < n && isWhitespace(clean[j])) j++
      tokens.push({ text: clean.slice(i, j), type: 'space' })
      i = j
      continue
    }
    if (isPunct(ch)) {
      let j = i + 1
      while (j < n && isPunct(clean[j])) j++
      tokens.push({ text: clean.slice(i, j), type: 'punct' })
      i = j
      continue
    }
    let j = i
    while (j < n && isThai(clean[j])) j++
    const piece = clean.slice(i, j)
    if (piece.length > 0) {
      tokens.push({ text: piece, type: 'word' })
      i = j
    } else {
      tokens.push({ text: ch, type: 'word' })
      i++
    }
  }
  return tokens
}

// 完整返回（兼容原接口形状：origin / cleanText / wordList / joinText）
export function tokenizeFull(input: string): TokenizeResult {
  const origin = input || ''
  const clean = normalize(input)
  const tokens = tokenize(input)
  const wordList = tokens.filter((t) => t.type !== 'space').map((t) => t.text)
  return { origin, cleanText: clean, wordList, joinText: wordList.join('+') }
}

// ---------- 5. 前端请求客户端（永久缓存 + 300ms 防抖 + 异常兜底） ----------
const CACHE_PREFIX = 'thai_token_cache::' // localStorage 缓存前缀（永久保存）
const DEBOUNCE_MS = 300 // 防抖窗口：窗口内重复相同文本直接复用结果
const _memo = new Map<string, Promise<Token[]>>() // 进行中的请求
const _recent = new Map<string, { ts: number; value: Token[] }>() // 近期结果（防抖复用）

function getCache(key: string): Token[] | null {
  try {
    const raw = LS()?.getItem(CACHE_PREFIX + key)
    if (raw) return JSON.parse(raw) as Token[]
  } catch {
    /* ignore */
  }
  return null
}
function setCache(key: string, val: Token[]): void {
  try {
    LS()?.setItem(CACHE_PREFIX + key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

/**
 * 获取分词结果（返回 Promise，方便日后无缝替换为真实网络接口）。
 * 容错链路：
 *   主分词(newmm) → 失败则简易音节粗分 → 再失败则原句不拆分（保证页面不崩）。
 * 性能：
 *   - 同一句子永久缓存（localStorage），只分词一次；
 *   - 300ms 内重复提交相同文本，直接复用上一次结果（防抖）；
 *   - 进行中的相同请求复用同一个 Promise。
 */
export function getTokens(text: string): Promise<Token[]> {
  const key = (text || '').toString()
  // 1) 永久 localStorage 缓存（同一句子只分词一次）
  const cached = getCache(key)
  if (cached) return Promise.resolve(cached)
  // 2) 300ms 内重复提交相同文本 → 复用上一次结果（防抖）
  const r = _recent.get(key)
  if (r && Date.now() - r.ts < DEBOUNCE_MS) return Promise.resolve(r.value)
  // 3) 正在进行的请求 → 复用同一个 Promise
  const inflight = _memo.get(key)
  if (inflight) return inflight
  // 4) 新请求
  const p = Promise.resolve().then(() => {
    let result: Token[]
    try {
      result = tokenize(key) // 主分词（newmm + 词库）
    } catch (e) {
      console.warn('[thaiToken] 主分词异常，降级为简易音节粗分', e)
      try {
        result = simpleSyllableSplit(key) // 兜底：简易音节粗分
      } catch {
        result = [{ text: key, type: 'word' }] // 最终兜底：原句不拆分
      }
    }
    if (!result || result.length === 0) result = [{ text: key, type: 'word' }]
    setCache(key, result)
    _recent.set(key, { ts: Date.now(), value: result })
    return result
  })
  _memo.set(key, p)
  p.finally(() => _memo.delete(key))
  return p
}

// 清空所有分词缓存（调试用）
export function clearTokenCache(): void {
  try {
    const ls = LS()
    if (!ls) return
    const keys: string[] = []
    for (let k = 0; k < ls.length; k++) {
      const name = ls.key(k)
      if (name && name.startsWith(CACHE_PREFIX)) keys.push(name)
    }
    keys.forEach((k) => ls.removeItem(k))
  } catch {
    /* ignore */
  }
}
