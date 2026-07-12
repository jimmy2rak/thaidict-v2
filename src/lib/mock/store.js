// 模拟数据持久层：localStorage 封装 + 种子数据。仅本地开发使用。
import { mockDictionary } from '../../data/mockData.js'
import { mockSentences } from '../../data/phraseData.js'

const PREFIX = 'thaidict:'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, val) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(val))
  } catch (e) {
    console.error('[mock:store] write fail', key, e)
  }
}

// ---------- 全局（公开）集合 ----------
export function getGlobal(name, fallback = []) {
  return read('global:' + name, fallback)
}
export function setGlobal(name, val) {
  write('global:' + name, val)
  return val
}

// ---------- 用户（私有）集合 ----------
export function getUserColl(userId, name, fallback = []) {
  if (!userId) return fallback
  return read('user:' + userId + ':' + name, fallback)
}
export function setUserColl(userId, name, val) {
  if (!userId) return val
  write('user:' + userId + ':' + name, val)
  return val
}

// ---------- 种子 ----------
let seeded = false
export function seedIfNeeded() {
  if (seeded) return
  seeded = true
  if (!localStorage.getItem(PREFIX + 'seeded')) {
    setGlobal('dictionary', JSON.parse(JSON.stringify(mockDictionary)))
    setGlobal('sentences', JSON.parse(JSON.stringify(mockSentences)))
    setGlobal('community_words', [])
    setGlobal('daily_picks', {
      pick_date: new Date().toISOString().slice(0, 10),
      daily_word_id: mockDictionary[0]?.word || '',
      daily_sentence_id: mockSentences[0]?.id || null,
    })
    setGlobal('word_books', presetWordBooks())
    setGlobal('achievements_defs', presetAchievements())
    setGlobal('users', presetUsers())
    setGlobal('user_roles', presetRoles())
    setGlobal('pending_approvals', [])
    localStorage.setItem(PREFIX + 'seeded', '1')
  }
  // 已有数据迁移：确保新全局集合存在
  if (getGlobal('users', null) === null) setGlobal('users', presetUsers())
  if (getGlobal('user_roles', null) === null) setGlobal('user_roles', presetRoles())
  if (getGlobal('pending_approvals', null) === null) setGlobal('pending_approvals', [])
}

function presetWordBooks() {
  return [
    { id: 1, name: 'HSK 泰语对照 200 词', description: '基础高频词汇', level: 'beginner', cover_color: '#5B8C7E', sort_order: 0, entries: ['กิน', 'ไป', 'ดี', 'น้ำ', 'อาหาร', 'ข้าว', 'ชอบ', 'เรียน'] },
    { id: 2, name: '旅行必备 100 句', description: '出行实用表达', level: 'beginner', cover_color: '#C4993D', sort_order: 1, entries: ['สวัสดี', 'ไป', 'บ้าน', 'คน', 'วัน'] },
    { id: 3, name: '日常饮食词汇', description: '吃货专用', level: 'intermediate', cover_color: '#C45B5B', sort_order: 2, entries: ['กิน', 'อาหาร', 'น้ำ', 'ข้าว', 'ใหม่', 'แพง'] },
  ]
}

function presetAchievements() {
  return [
    { key: 'streak_7', name: '一周坚持', desc: '连续打卡 7 天', icon: 'flame' },
    { key: 'bookmark_100', name: '百词斩', desc: '收藏 100 个词', icon: 'bookmark' },
    { key: 'book_done', name: '学以致用', desc: '完成一本单词书', icon: 'award' },
    { key: 'practice_10', name: '初露锋芒', desc: '完成 10 次练习', icon: 'target' },
  ]
}

function presetUsers() {
  return [
    { id: 'mock-user-001', email: 'demo@thaidict.local', username: '演示用户', created_at: new Date().toISOString() },
    { id: 'mock-user-002', email: 'alice@example.com', username: 'Alice', created_at: new Date().toISOString() },
    { id: 'mock-user-003', email: 'bob@example.com', username: 'Bob', created_at: new Date().toISOString() },
  ]
}

function presetRoles() {
  return [
    { user_id: 'mock-user-001', role: 'super_admin', permissions: ['all'], updated_at: new Date().toISOString() },
    { user_id: 'mock-user-002', role: 'user', permissions: [], updated_at: new Date().toISOString() },
    { user_id: 'mock-user-003', role: 'admin', permissions: ['approve_entries'], updated_at: new Date().toISOString() },
  ]
}

// 模拟会话持久化（mock 认证使用）
export function getMockSession() {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + 'mock-session') || 'null')
  } catch {
    return null
  }
}
export function setMockSession(s) {
  if (s) localStorage.setItem(PREFIX + 'mock-session', JSON.stringify(s))
  else localStorage.removeItem(PREFIX + 'mock-session')
}

// 开发用：清空所有模拟数据
export function resetMockData() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
  seeded = false
  seedIfNeeded()
}
