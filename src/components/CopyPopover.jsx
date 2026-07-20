import React, { useState, useRef, useEffect } from 'react'
import { Copy } from 'lucide-react'
import { IconButton } from './UIComponents.jsx'

/**
 * CopyPopover —— 复制纯文本小气泡
 * 主词被分词展示时，用户难以直接复制纯文本主词/整句，
 * 故在喇叭按钮旁放置一个复制按钮，点击后弹出仅含纯文本的小气泡，
 * 由用户自行选中文字复制（不做自动复制到剪贴板，避免误触）。
 *
 * props:
 *   text        {string}  气泡内展示的纯文本（如 data.word / sentence.thai）
 *   title       {string}  按钮 title（无障碍）
 *   buttonStyle {object}  覆盖 IconButton 默认尺寸样式（默认 38x38）
 */
export default function CopyPopover({ text, title = '复制纯文本', buttonStyle }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <IconButton
        onClick={() => setOpen((v) => !v)}
        title={title}
        style={buttonStyle || { width: 38, height: 38 }}
      >
        <Copy size={20} />
      </IconButton>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 400,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-p200)',
            borderRadius: 12,
            padding: '10px 12px',
            maxWidth: 260,
            minWidth: 140,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--c-p500)', marginBottom: 6 }}>选中下方文字复制</div>
          <div
            style={{
              fontFamily: 'var(--th-font)',
              fontSize: 16,
              color: 'var(--c-p800)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
