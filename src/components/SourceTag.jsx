import React, { useState, useRef } from 'react'
import { getSourceMeta } from '../lib/sourceMeta.js'

/**
 * SourceTag —— 词源标签
 * ------------------------------------------------------------------
 * 展示「二字简称」（如 皇院 / 通用 / 分词 …）；点击后弹出一个小气泡，
 * 气泡以「数据源全称」为标题、「详细词源&用途说明」为内容。
 * 点击标签外部任意区域关闭气泡。
 *
 * @param {string} sourceKey  完整数据表名，如 'src_words_orst'
 * @param {string} color      标签主题色（默认雾霭蓝灰，呼应“来源”语义）
 */
export default function SourceTag({ sourceKey, color = 'var(--c-info)' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, below: false })
  const ref = useRef(null)

  const meta = getSourceMeta(sourceKey)
  const label = meta ? meta.abbr : sourceKey

  const toggle = (e) => {
    e.stopPropagation()
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      const vw = typeof window !== 'undefined' ? window.innerWidth : 360
      const bubbleW = 264
      const below = r.top < 150 // 上方空间不足则放到标签下方
      setPos({
        below,
        top: below ? r.bottom + 6 : r.top - 8,
        left: Math.min(Math.max(r.left, 8), vw - bubbleW - 8),
      })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <span ref={ref} style={{ display: 'inline-block' }}>
        <button
          type="button"
          onClick={toggle}
          title={meta ? meta.fullName : sourceKey}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
            padding: '2px 7px',
            borderRadius: 999,
            cursor: 'pointer',
            lineHeight: 1.4,
            fontFamily: 'var(--zh-font)',
          }}
        >
          {label}
        </button>
      </span>
      {open && (
        <>
          {/* 遮罩：点击任意外部区域关闭 */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          />
          {/* 气泡 */}
          <div
            style={{
              position: 'fixed',
              zIndex: 401,
              top: pos.top,
              left: pos.left,
              transform: pos.below ? 'none' : 'translateY(-100%)',
              width: 264,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-p200)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-p800)', marginBottom: 6 }}>
              {meta ? meta.fullName : sourceKey}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--c-p600)', lineHeight: 1.65 }}>
              {meta ? meta.description : '暂无该词源的详细说明。'}
            </div>
          </div>
        </>
      )}
    </>
  )
}
