import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plus, StickyNote, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getNotes } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, EmptyState } from '../../components/UIComponents.jsx'

export default function NotesDetailSection({ onClose, onEdit }) {
  const app = useApp()
  const { userId } = app
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!userId) return setLoading(false)
    getNotes(userId).then((n) => {
      setNotes(n)
      setLoading(false)
    })
  }
  useEffect(load, [userId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>我的笔记</div>
        <button onClick={() => onEdit && onEdit({ id: null, word: '', content: '' })} style={{ width: 38, display: 'flex', justifyContent: 'center', color: 'var(--c-teal)' }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {notes.length === 0 ? (
          <EmptyState icon="📝" text="还没有笔记，去词条详情页点「笔记」开始记录吧" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map((n) => (
              <Card key={n.id} onClick={() => onEdit && onEdit(n)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--th-font)', fontSize: 17, fontWeight: 600, color: 'var(--c-p800)' }}>{n.word || '（未命名）'}</span>
                  <ChevronRight size={16} color="var(--c-s500)" />
                </div>
                <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.content || '（空）'}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
