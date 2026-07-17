// 轻量本地缓存层：用于「先显示缓存 → 后台静默拉取 → 有更新再更新」的常态化展示。
// 数据以 { ts, data } 形式存于 localStorage，仅做 JSON 序列化（非敏感的学习统计/推荐内容）。
import { useState, useEffect, useRef } from 'react'

const PREFIX = 'thaidict_cache_'

export function loadCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const obj = JSON.parse(raw)
    return obj && 'data' in obj ? obj.data : null
  } catch {
    return null
  }
}

export function saveCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* 存储不可用时静默忽略 */
  }
}

export function clearCache(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

// useAsyncCache：挂载即返回缓存（若有），随后后台拉取，拉到后实时更新。
// 返回 { data, loading, setData }；loading 表示后台拉取尚未完成。
export function useAsyncCache(key, fetcher, deps = []) {
  const cached = useRef(loadCache(key))
  const [data, setData] = useState(cached.current)
  const [loading, setLoading] = useState(cached.current == null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    setLoading(true)
    Promise.resolve()
      .then(() => fetcher())
      .then((d) => {
        if (!aliveRef.current) return
        if (d !== undefined && d !== null) {
          saveCache(key, d)
          setData(d)
        }
        setLoading(false)
      })
      .catch(() => {
        if (aliveRef.current) setLoading(false)
      })
    return () => {
      aliveRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, setData }
}
