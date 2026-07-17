import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plus, NotebookPen, Clock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getDiaries } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, EmptyState } from '../../components/UIComponents.jsx'

const MOOD_EMOJI = { happy: '😊', neutral: '😐', sad: '😟', excited: '😆', tired: '😴' }

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function DiaryList({ onClose, onOpen, onNew }) {
  const app = useApp()
  const { userId } = app
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!userId) return setLoading(false)
    getDiaries(userId).then((r) => {
      setList(r)
      setLoading(false)
    })
  }
  useEffect(load, [userId])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>学习日记</div>
        <AsyncBadge loading={bgLoading} />
        <button onClick={() => onNew && onNew()} style={{ width: 38, display: 'flex', justifyContent: 'center', color: 'var(--c-teal)' }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon="📔" text="还没有日记，记录今天的学习感悟吧" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((d) => (
              <Card key={d.id} onClick={() => onOpen && onOpen(d)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{MOOD_EMOJI[d.mood] || '😐'}</span>
                  <span style={{ fontSize: 12, color: 'var(--c-p500)' }}>{fmtDate(d.created_at)}</span>
                  {d.study_minutes ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'var(--c-teal)' }}><Clock size={12} /> {d.study_minutes} 分</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 14, color: 'var(--c-p700)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                  {d.content || '（空）'}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
