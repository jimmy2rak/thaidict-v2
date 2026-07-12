// WebDAV 一键上传 / 导出工具（需求 #2b）。
// 导出：将学习数据序列化为 JSON 并触发浏览器下载。
// 上传：PUT 到 WebDAV 地址（mock 模式无真实服务器，失败则回退为本地模拟备份）。
import { getDiaries } from './db/diaries.js'
import { getNotes } from './db/notes.js'
import {
  getStreak, getBookmarks, getPracticeStats, getWeeklyStudyMinutes,
  getCheckinHeatmapData, getUserRecentWords,
} from './db/index.js'
import { getGlobal, setGlobal } from './mock/store.js'

const CATEGORY_LABELS = {
  diaries: '学习日记',
  notes: '我的笔记',
  stats: '学习统计',
}

export function webdavCategories() {
  return [
    { key: 'diaries', label: '学习日记' },
    { key: 'notes', label: '我的笔记' },
    { key: 'stats', label: '学习统计' },
  ]
}

export function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key
}

// 按类别聚合导出数据
export async function gatherExportData(category, userId) {
  const now = new Date().toISOString()
  if (category === 'diaries') {
    return { category, label: categoryLabel(category), exported_at: now, data: await getDiaries(userId) }
  }
  if (category === 'notes') {
    return { category, label: categoryLabel(category), exported_at: now, data: await getNotes(userId) }
  }
  if (category === 'stats') {
    const [streak, bookmarks, practice, weekly, heatmap, recent] = await Promise.all([
      getStreak(userId),
      getBookmarks(userId),
      getPracticeStats(userId),
      getWeeklyStudyMinutes(userId),
      getCheckinHeatmapData(userId),
      getUserRecentWords(userId, 200),
    ])
    return {
      category,
      label: categoryLabel(category),
      exported_at: now,
      data: { streak, bookmark_count: bookmarks?.length || 0, practice, weekly_study_minutes: weekly, checkin_heatmap: heatmap, recent_words: recent },
    }
  }
  return null
}

// 触发浏览器下载 JSON
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 上传到 WebDAV（Basic Auth）。返回 { ok, error }
export async function uploadToWebdav(url, user, pass, filename, obj) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: '请先填写有效的 WebDAV 地址（http/https）' }
  }
  const content = JSON.stringify(obj, null, 2)
  const target = url.replace(/\/$/, '') + '/' + filename
  const headers = { 'Content-Type': 'application/json' }
  if (user) headers['Authorization'] = 'Basic ' + btoa(unescape(encodeURIComponent(user + ':' + (pass || ''))))
  try {
    const res = await fetch(target, { method: 'PUT', headers, body: content })
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status + ' ' + res.statusText }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
}

// mock 回退：把上传内容存到本地集合，模拟「已备份」（真实模式由 webdav-upload 边缘函数完成）
export function saveLocalBackup(filename, obj) {
  const list = getGlobal('webdav_backups', [])
  list.push({ filename, saved_at: new Date().toISOString() })
  setGlobal('webdav_backups', list)
  return obj
}

export function fileNameFor(category) {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `thaidict-${category}-${stamp}.json`
}
