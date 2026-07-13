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
 *   onBookmark  : () => void    收藏按钮
 *   bookmarked  : boolean
 *   showCategory: boolean       是否显示 category badge
 *   style       : 透传到 Card
 */
export default function PhraseCard({
  item,
  onOpen,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 完整原句（大字） */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'var(--th-font)',
            color: 'var(--c-p800)',
            lineHeight: 1.35,
          }}
        >
          {item.thai}
        </div>

        {/* 分词结构（小字） */}
        <div style={{ marginTop: 2 }}>
          <ThaiSentence
            text={item.thai}
            type="sentence"
            separator=" + "
            style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-p600)' }}
          />
        </div>
      </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <IconButton onClick={onPlay} title="朗读" style={{ width: 32, height: 32 }}><Volume2 size={16} /></IconButton>
          <IconButton
            onClick={(e) => { e?.stopPropagation?.(); onBookmark?.() }}
            active={bookmarked}
            title={bookmarked ? '已收藏' : '收藏'}
            style={{ width: 32, height: 32 }}
          >
            <Star size={16} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
          </IconButton>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--c-p600)', marginTop: 3, lineHeight: 1.45 }}>
        {item.actual || item.zh}
      </div>

      {showCategory && item.category && (
        <div style={{ marginTop: 6 }}>
          <Badge color="var(--c-gold)">{item.category}</Badge>
        </div>
      )}
    </Card>
  )
}
