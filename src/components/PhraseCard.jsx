import React, { useState, useEffect } from 'react'
import { Volume2, Star } from 'lucide-react'
import { Card, Badge, IconButton } from './UIComponents.jsx'
import ThaiSentence from './ThaiSentence.jsx'
import { speak } from '../utils/tts.js'

/**
 * PhraseCard —— 句子/短语卡片
 * ------------------------------------------------------------------
 * 功能：
 *   1) 卡片内直接展示泰语分词下划线（ThaiSentence），无需进入详情。
 *   2) 右上角固定收藏、播放按钮。
 *   3) 点击卡片空白处打开详情；点击下划线单词跳转词条详情并弹出释义气泡。
 *
 * Props：
 *   item        : { thai, zh, category?, tags?, ... }
 *   onOpen      : () => void    点击卡片主体
 *   onWordClick : (word) => void  点击单词（通常传 handleWordTap）
 *   onBookmark  : () => void    收藏按钮
 *   bookmarked  : boolean
 *   showCategory: boolean       是否显示 category badge
 *   style       : 透传到 Card
 */
export default function PhraseCard({
  item,
  onOpen,
  onWordClick,
  onBookmark,
  bookmarked,
  showCategory = false,
  style,
}) {
  if (!item) return null

  const onPlay = (e) => {
    e?.stopPropagation?.()
    speak(item.thai, { rate: 1.0, lang: 'th-TH' })
  }

  return (
    <Card onClick={onOpen} style={{ cursor: 'pointer', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ThaiSentence
            text={item.thai}
            type="sentence"
            separator=" + "
            onWordClick={onWordClick}
            style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--c-p800)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <IconButton onClick={onPlay} title="朗读"><Volume2 size={18} /></IconButton>
          <IconButton
            onClick={(e) => { e?.stopPropagation?.(); onBookmark?.() }}
            active={bookmarked}
            title={bookmarked ? '已收藏' : '收藏'}
          >
            <Star size={18} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
          </IconButton>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 6, lineHeight: 1.5 }}>
        {item.actual || item.zh}
      </div>

      {showCategory && item.category && (
        <div style={{ marginTop: 8 }}>
          <Badge color="var(--c-gold)">{item.category}</Badge>
        </div>
      )}
    </Card>
  )
}
