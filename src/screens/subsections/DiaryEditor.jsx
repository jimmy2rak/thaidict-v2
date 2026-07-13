import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, ImagePlus, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getDiary, createDiary, updateDiary, addDiaryImage } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

const MOODS = [
  { key: 'happy', emoji: '😊', label: '开心' },
  { key: 'neutral', emoji: '😐', label: '平静' },
  { key: 'sad', emoji: '😟', label: '低落' },
  { key: 'excited', emoji: '😆', label: '兴奋' },
  { key: 'tired', emoji: '😴', label: '疲惫' },
]

export default function DiaryEditor({ diaryId, onClose, onSaved }) {
  const app = useApp()
  const { userId, toast } = app
  const [loading, setLoading] = useState(!!diaryId)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('neutral')
  const [minutes, setMinutes] = useState(0)
  const [images, setImages] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!diaryId) return setLoading(false)
    getDiary(userId, diaryId).then((d) => {
      if (d) {
        setContent(d.content || '')
        setMood(d.mood || 'neutral')
        setMinutes(d.study_minutes || 0)
        setImages(d.images || [])
      }
      setLoading(false)
    })
  }, [diaryId, userId])

  const onPickImage = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setImages((im) => [...im, { id: 'img_' + Date.now() + Math.random(), image_url: reader.result, storage_type: 'local' }])
      reader.readAsDataURL(f)
    })
    e.target.value = ''
  }

  const onSave = async () => {
    if (!userId) return
    setSaving(true)
    let diary
    if (diaryId) {
      diary = await updateDiary(userId, diaryId, { content: content.trim(), mood, study_minutes: Number(minutes) || 0 })
    } else {
      diary = await createDiary(userId, { content: content.trim(), mood, study_minutes: Number(minutes) || 0 })
    }
    // 新选择的本地图片（storage_type=local 直接存 dataURL）
    if (diary && diary.id) {
      const existing = new Set((diary.images || []).map((x) => x.image_url))
      for (const im of images) {
        if (!existing.has(im.image_url)) await addDiaryImage(userId, diary.id, im.image_url, 'local')
      }
    }
    setSaving(false)
    toast('日记已保存')
    onSaved && onSaved()
  }

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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{diaryId ? '编辑日记' : '写日记'}</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>今天的心情</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(m.key)}
              title={m.label}
              style={{ fontSize: 26, padding: '6px 10px', borderRadius: 12, border: '1px solid ' + (mood === m.key ? 'var(--c-teal)' : 'var(--c-p200)'), background: mood === m.key ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)' }}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="今天学了什么？有什么感悟或疑问…"
          rows={8}
          style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--c-p200)', borderRadius: 12, background: 'var(--c-surface)', color: 'var(--c-p800)', fontSize: 14, lineHeight: 1.6, resize: 'none', outline: 'none' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--c-p600)' }}>学习时长（分钟）</span>
          <input type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ width: 90, padding: '8px 12px', border: '1px solid var(--c-p200)', borderRadius: 10, fontSize: 14, textAlign: 'right', background: 'var(--c-bg)', color: 'var(--c-p800)', outline: 'none' }} />
        </div>

        {/* 图片 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {images.map((im, i) => (
            <div key={im.id || i} style={{ position: 'relative', width: 72, height: 72 }}>
              <img src={im.image_url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--c-p200)' }} />
              <button onClick={() => setImages((a) => a.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--c-rose)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            </div>
          ))}
          <label style={{ width: 72, height: 72, borderRadius: 10, border: '1px dashed var(--c-p300)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--c-p500)', cursor: 'pointer', fontSize: 11 }}>
            <ImagePlus size={18} />
            添加
            <input type="file" accept="image/*" multiple onChange={onPickImage} style={{ display: 'none' }} />
          </label>
        </div>

        <Btn onClick={onSave} disabled={saving} style={{ width: '100%' }}>
          <Save size={16} /> {saving ? '保存中…' : '保存日记'}
        </Btn>
      </div>
    </div>
  )
}
