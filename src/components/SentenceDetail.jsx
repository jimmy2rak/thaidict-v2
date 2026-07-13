import React from 'react'
import SentenceDetailView from './SentenceDetailView.jsx'

/**
 * SentenceDetail —— 句子详情浮层
 * 复用 SentenceDetailView，保持与短语详情一致的结构。
 */
export default function SentenceDetail({ sentence, onClose }) {
  return <SentenceDetailView sentence={sentence} onClose={onClose} title="句子详情" />
}
