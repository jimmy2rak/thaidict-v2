import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getSentencesByCategory, getSentenceBookmarks, bookmarkSentence } from '../../lib/db/index.js'
import { getGlobal } from '../../lib/mock/store.js'
import { IconButton, Spinner, EmptyState } from '../../components/UIComponents.jsx'
import PhraseCard from '../../components/PhraseCard.jsx'

const CATEGORIES = [
  { key: null, label: '全部' },
  { key: 'idioms', label: '成语' },
  { key: 'buddhist', label: '佛学' },
  { key: 'daily', label: '日常' },
]
const CAT_LABEL = { idioms: '成语', buddhist: '佛学', daily: '日常' }

export default function PhrasesSection({ onClose, onOpen }) {
  const app = useApp()
  const { userId, handleWordTap } = app

  const [category, setCategory] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookmarks, setBookmarks] = useState(new Set())

  // 分类列表（用于校验哪些分类有数据）
  const activeCats = useMemo(() => {
    const all = getGlobal('sentences', [])
    return new Set(all.map((s) => s.category).filter(Boolean))
  }, [])

  useEffect(() => {
    setLoading(true)
    getSentencesByCategory(category, userId).then((r) => {
      setList(r)
      setLoading(false)
    })
  }, [category, userId])

  useEffect(() => {
    if (!userId) return
    getSentenceBookmarks(userId).then((arr) => {
      setBookmarks(new Set((arr || []).map((b) => b.sentence_id || b.id)))
    })
  }, [userId])

  const visibleCats = CATEGORIES.filter((c) => c.key === null || activeCats.has(c.key))

  const handleBookmark = async (sentenceId) => {
    if (!userId) return app.toast('请先登录')
    if (bookmarks.has(sentenceId)) return
    await bookmarkSentence(userId, sentenceId)
    setBookmarks((prev) => new Set(prev).add(sentenceId))
    app.toast('已收藏')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 6px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>短语库</div>
        <div style={{ width: 38 }} />
      </div>

      {/* 分类切换：一个框里左右的按钮 */}
      <div style={{ padding: '8px 14px' }}>
        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--c-p200)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--c-surface)',
        }}>
          {visibleCats.map((c) => (
            <button
              key={c.key ?? 'all'}
              onClick={() => setCategory(c.key)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                borderRight: '1px solid var(--c-p200)',
                background: category === c.key ? 'var(--c-teal)' : 'var(--c-surface)',
                color: category === c.key ? '#fff' : 'var(--c-p500)',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '0 14px 14px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon="📚" text="该分类下暂无短语" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((s) => (
              <PhraseCard
                key={s.id}
                item={s}
                onOpen={() => onOpen && onOpen(s)}
                onBookmark={() => handleBookmark(s.id)}
                bookmarked={bookmarks.has(s.id)}
                showCategory
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
