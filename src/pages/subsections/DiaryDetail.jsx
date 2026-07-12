import React from 'react'
import { ArrowLeft, Pencil, Trash2, Clock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { deleteDiary } from '../../lib/db/index.js'
import { IconButton, Card } from '../../components/UIComponents.jsx'

const MOOD_EMOJI = { happy: '😊', neutral: '😐', sad: '😟', excited: '😆', tired: '😴' }

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function DiaryDetail({ diary, onClose, onEdit, onDeleted }) {
  const app = useApp()
  const { userId, toast } = app

  const onDelete = async () => {
    if (!userId) return
    await deleteDiary(userId, diary.id)
    toast('已删除日记')
    onDeleted && onDeleted()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>日记详情</div>
        <div style={{ width: 38, display: 'flex', justifyContent: 'center' }}>
          <IconButton onClick={() => onEdit && onEdit(diary)} title="编辑"><Pencil size={18} /></IconButton>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>{MOOD_EMOJI[diary.mood] || '😐'}</span>
          <div>
            <div style={{ fontSize: 14, color: 'var(--c-p800)', fontWeight: 600 }}>学习日记</div>
            <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{fmtDate(diary.created_at)}</div>
          </div>
          {diary.study_minutes ? (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'var(--c-teal)' }}><Clock size={13} /> {diary.study_minutes} 分</span>
          ) : null}
        </div>

        <Card>
          <div style={{ fontSize: 15, color: 'var(--c-p800)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{diary.content || '（空）'}</div>
        </Card>

        {diary.images && diary.images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {diary.images.map((im, i) => (
              <img key={im.id || i} src={im.image_url} alt="" style={{ width: '48%', borderRadius: 12, border: '1px solid var(--c-p200)' }} />
            ))}
          </div>
        )}

        <button onClick={onDelete} style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--c-rose)', color: 'var(--c-rose)', background: 'transparent', fontSize: 15, fontWeight: 600 }}>
          <Trash2 size={16} /> 删除日记
        </button>
      </div>
    </div>
  )
}
