import React, { useState, useEffect } from 'react'
import { ArrowLeft, Star, Volume2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { bookmarkSentence, isSentenceBookmarked } from '../../lib/db/index.js'
import { getGlobal } from '../../lib/mock/store.js'
import { enrichSegmented } from '../../lib/utils.js'
import { speak } from '../../utils/tts.js'
import { IconButton, Card, Badge, WordToken } from '../../components/UIComponents.jsx'

export default function PhraseDetailSection({ sentence, onClose }) {
  const app = useApp()
  const { userId, handleWordTap, toast } = app
  const [bookmarked, setBookmarked] = useState(false)

  const dictMap = getGlobal('dictionary', []).reduce((m, r) => {
    m[r.word.toLowerCase()] = { word: r.word, meanings: (r.senses || []).map((s) => s.meaning) }
    return m
  }, {})
  const segs = enrichSegmented(sentence.segmented || [], dictMap)

  useEffect(() => {
    if (userId && sentence) isSentenceBookmarked(userId, sentence.id).then(setBookmarked)
  }, [userId, sentence])

  const toggleBookmark = async () => {
    if (!userId) return toast('请先登录')
    if (bookmarked) return toast('已收藏')
    await bookmarkSentence(userId, sentence.id)
    setBookmarked(true)
    toast('已收藏短语')
  }

  const rate = 1.0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>短语详情</div>
        <IconButton onClick={toggleBookmark} active={bookmarked} title="收藏"><Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} /></IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--th-font)', fontSize: 20, color: 'var(--c-p800)', lineHeight: 1.5, flex: 1 }}>{sentence.thai}</div>
            <IconButton onClick={() => speak(sentence.thai, { rate, lang: 'th-TH' })} title="朗读"><Volume2 size={20} /></IconButton>
          </div>
          <div style={{ fontSize: 15, color: 'var(--c-p600)', marginTop: 6 }}>{sentence.zh}</div>
        </Card>

        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
          {segs.map((s, i) => (
            <WordToken key={i} text={s.text} meaning={s.meaning} onClick={() => handleWordTap(s.text)} />
          ))}
        </div>

        {sentence.literal && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--c-gold)', marginBottom: 2 }}>字面意思</div>
            <div style={{ fontSize: 14, color: 'var(--c-p700)' }}>{sentence.literal}</div>
          </Card>
        )}
        {sentence.note && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--c-info)', marginBottom: 2 }}>学习提示</div>
            <div style={{ fontSize: 14, color: 'var(--c-p600)' }}>{sentence.note}</div>
          </Card>
        )}
        {sentence.category && (
          <div style={{ marginTop: 12 }}><Badge color="var(--c-gold)">{sentence.category}</Badge></div>
        )}
      </div>
    </div>
  )
}
