import React, { useEffect, useRef } from 'react'

/**
 * WordBubble —— 悬浮气泡弹窗（查词结果展示）
 * 由 ThaiSentence 在点击单词时调用；也可单独使用。
 * 展示内容：
 *   - status === 'loading' → 查询中…
 *   - status === 'done'    → 释义列表
 *   - status === 'empty'   → 暂无该词条释义
 * 点击气泡以外区域自动关闭。
 */
export default function WordBubble({ word, x, y, status, meanings, onClose }) {
  const ref = useRef(null)

  // 点击外部关闭
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  // 防止气泡超出右/下边界
  const W = 260
  const H = 170
  const vw = globalThis.innerWidth || 9999
  const vh = globalThis.innerHeight || 9999
  const left = Math.max(8, Math.min(x, vw - W - 8))
  const top = Math.max(8, Math.min(y, vh - H - 8))

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        width: W,
        zIndex: 1000,
        background: 'var(--c-surface)',
        border: '1px solid var(--c-p200)',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        padding: 12,
        fontFamily: 'var(--zh-font)',
        color: 'var(--c-p800)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--th-font)', fontSize: 16, fontWeight: 700 }}>{word}</span>
        <button
          onClick={onClose}
          title="关闭"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--c-p500)', fontSize: 18, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        {status === 'loading' && <span style={{ color: 'var(--c-p500)' }}>查询中…</span>}
        {status === 'empty' && <span style={{ color: 'var(--c-p500)' }}>暂无该词条释义</span>}
        {status === 'done' && (
          <div>
            {(meanings || []).map((m, i) => (
              <div key={i} style={{ marginBottom: 2 }}>· {m}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
