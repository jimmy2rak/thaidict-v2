import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, Trash2, BookOpen, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getNote, getNoteForWord, saveNote, deleteNote } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

export default function NoteEditorSection({ noteId, initialWord, onClose, onSaved }) {
  const app = useApp()
  const { userId, handleWordTap, toast } = app
  const [loading, setLoading] = useState(!!noteId)
  const [word, setWord] = useState(initialWord || '')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingId, setExistingId] = useState(noteId || null)

  useEffect(() => {
    if (noteId) {
      getNote(userId, noteId).then((n) => {
        if (n) {
          setWord(n.word || '')
          setContent(n.content || '')
          setTags((n.tags || []).join(', '))
          setExistingId(n.id)
        }
        setLoading(false)
      })
    } else if (initialWord && userId) {
      getNoteForWord(userId, initialWord).then((n) => {
        if (n) {
          setWord(n.word || '')
          setContent(n.content || '')
          setTags((n.tags || []).join(', '))
          setExistingId(n.id)
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [noteId, initialWord, userId])

  const onSave = async () => {
    if (!userId || !word.trim()) return toast('请填写单词')
    setSaving(true)
    const tagArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    await saveNote(userId, { id: existingId || undefined, word: word.trim(), content: content.trim(), tags: tagArr })
    setSaving(false)
    toast('笔记已保存')
    onSaved && onSaved()
  }

  const onDelete = async () => {
    if (!existingId) return onClose && onClose()
    await deleteNote(userId, existingId)
    toast('已删除笔记')
    onSaved && onSaved()
  }

  const openWord = () => {
    if (!word.trim()) return
    onClose && onClose()
    handleWordTap(word.trim())
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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{existingId ? '编辑笔记' : '新建笔记'}</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 14 }}>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--c-p600)' }}>单词</label>
            <button onClick={openWord} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--c-info)', fontWeight: 600 }}>
              <BookOpen size={12} /> 查看词条
            </button>
          </div>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="如：กิน"
            disabled={!!initialWord}
            style={{ ...inp, opacity: initialWord ? 0.65 : 1, fontFamily: 'var(--th-font)', fontSize: 16, marginBottom: 0 }}
          />
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 6, display: 'block' }}>标签（用逗号分隔）</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="记忆法, 易混淆, 例句 …"
            style={{ ...inp, fontSize: 14 }}
          />
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 6, display: 'block' }}>笔记内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的记忆窍门、例句或疑问…"
            rows={7}
            style={{ ...inp, resize: 'none', fontSize: 14, lineHeight: 1.6 }}
          />
        </Card>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn onClick={onSave} disabled={saving} style={{ flex: 1 }}>
            <Save size={16} /> {saving ? '保存中…' : '保存'}
          </Btn>
          {existingId && (
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 16px', borderRadius: 12, border: '1.6px solid var(--c-rose)', color: 'var(--c-rose)', background: 'transparent', fontSize: 15, fontWeight: 600 }}>
              <Trash2 size={16} /> 删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const inp = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid var(--c-p200)',
  borderRadius: 12,
  background: 'var(--c-surface)',
  color: 'var(--c-p800)',
  outline: 'none',
}
