import React, { useState, useEffect } from 'react'
import { Volume2, Star, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card } from './UIComponents.jsx'
import { isBookmarked, addBookmark, removeBookmark } from '../lib/db/index.js'
import { speak } from '../utils/tts.js'

// 词条卡（与「每日一词」结构统一）。可供首页每日一词、单词本「最近」「单词夹」复用。
// 支持：朗读、收藏（可取消）、可选刷新。卡片点击 → 打开词条详情。
export default function WordCard({
  word, // 泰语单词（字符串）
  romanization = '',
  meaning = '',
  example, // { th/thai, zh } 可选
  subtitle = '', // 例如「查 3 次」
  onTap,
  refreshable = false,
  onRefresh,
  refreshing = false,
}) {
  const app = useApp()
  const { userId } = app
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    if (userId && word) isBookmarked(userId, word).then(setBookmarked)
  }, [userId, word])

  const toggleBookmark = async (e) => {
    e?.stopPropagation?.()
    if (!userId) return app.toast('请先登录')
    if (bookmarked) {
      await removeBookmark(userId, word)
      setBookmarked(false)
    } else {
      await addBookmark(userId, word)
      setBookmarked(true)
    }
  }

  const onPlay = (e) => {
    e?.stopPropagation?.()
    speak(word)
  }

  return (
    <Card onClick={() => onTap?.(word)} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)', lineHeight: 1.35 }}>
            {word}
          </div>
          {romanization && <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 1 }}>{romanization}</div>}
          {meaning && <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 2 }}>{meaning}</div>}
          {example && (example.th || example.thai) && (
            <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 2 }}>
              {(example.th ?? example.thai)} · {example.zh}
            </div>
          )}
          {subtitle && <div style={{ fontSize: 10, color: 'var(--c-p500)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} onClick={(e) => e.stopPropagation()}>
          <IconBtn onClick={onPlay} title="朗读" style={{ width: 32, height: 32 }}>
            <Volume2 size={16} />
          </IconBtn>
          <IconBtn onClick={toggleBookmark} active={bookmarked} title={bookmarked ? '已收藏' : '收藏'} style={{ width: 32, height: 32 }}>
            <Star size={16} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
          </IconBtn>
          {refreshable && (
            <IconBtn onClick={(e) => { e.stopPropagation(); onRefresh?.() }} disabled={refreshing} title="换一个" style={{ width: 32, height: 32 }}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            </IconBtn>
          )}
        </div>
      </div>
    </Card>
  )
}

function IconBtn({ children, onClick, disabled, active, title, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 10,
        background: active ? 'color-mix(in srgb, var(--c-amber) 16%, transparent)' : 'var(--c-p100)',
        border: 'none',
        color: active ? 'var(--c-amber)' : 'var(--c-p700)',
        cursor: 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
