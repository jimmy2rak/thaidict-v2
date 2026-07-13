import React from 'react'
import SentenceDetailView from '../../components/SentenceDetailView.jsx'

/**
 * PhraseDetailSection —— 短语详情
 * 复用 SentenceDetailView，保持与句子详情一致的结构。
 */
export default function PhraseDetailSection({ sentence, onClose }) {
  return <SentenceDetailView sentence={sentence} onClose={onClose} title="短语详情" />
}
