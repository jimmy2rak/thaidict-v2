import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Volume2, Star, FolderPlus, Layers, X, StickyNote } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  addBookmark,
  removeBookmark,
  isBookmarked,
  getFolders,
  addWordToFolder,
  createFolder,
  recordWordLookup,
} from '../lib/db/index.js'
import { transformWordData } from '../lib/utils.js'
import { speak } from '../utils/tts.js'
import { Card, Badge, IconButton, WordToken, Spinner } from '../components/UIComponents.jsx'
import MorphologySection from './subsections/MorphologySection.jsx'
import NoteEditorSection from './subsections/NoteEditorSection.jsx'

export default function WordDetailPage({ word }) {
  const app = useApp()
  const { userId, dbWordData, generatedWords, handleWordTap, goBack, goForward, navStack, navForward, toast, checkAndToastAchievements } = app

  const row = dbWordData[word]
  const gen = generatedWords[word]
  const data = gen || (row ? transformWordData(row) : null)

  const [bookmarked, setBookmarked] = useState(false)
  const [showFolder, setShowFolder] = useState(false)
  const [folders, setFolders] = useState([])
  const [newFolder, setNewFolder] = useState('')
  const [showMorph, setShowMorph] = useState(false)
  const [showNote, setShowNote] = useState(false)

  useEffect(() => {
    if (userId && word) {
      isBookmarked(userId, word).then(setBookmarked)
      recordWordLookup(userId, word)
    }
  }, [userId, word])

  const toggleBookmark = async () => {
    if (!userId) return app.toast('请先登录')
    if (bookmarked) await removeBookmark(userId, word)
    else await addBookmark(userId, word)
    setBookmarked(!bookmarked)
    if (!bookmarked) {
      await checkAndToastAchievements()
    }
  }

  const openFolder = async () => {
    setShowFolder(true)
    if (userId) setFolders(await getFolders(userId))
  }
  const onAddToFolder = async (folderId) => {
    await addWordToFolder(folderId, word)
    setShowFolder(false)
    app.toast('已加入文件夹')
  }
  const onCreateFolder = async () => {
    if (!newFolder.trim() || !userId) return
    const f = await createFolder(userId, newFolder.trim(), '#5B8C7E', 'word')
    setFolders(await getFolders(userId))
    if (f) await addWordToFolder(f.id, word)
    setNewFolder('')
    setShowFolder(false)
    app.toast('已创建并加入')
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  const rate = 1.0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={goBack} disabled={navStack.length === 0} title="返回"><ArrowLeft size={20} /></IconButton>
        <IconButton onClick={goForward} disabled={navForward.length === 0} title="前进"><ArrowRight size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>词条详情</div>
        <IconButton onClick={toggleBookmark} active={bookmarked} title="收藏"><Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} /></IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {/* 词头 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{data.word}</div>
            {data.romanization && <div style={{ fontSize: 14, color: 'var(--c-p500)' }}>{data.romanization}</div>}
          </div>
          <IconButton onClick={() => speak(data.word, { rate })} title="朗读"><Volume2 size={22} /></IconButton>
        </div>

        {/* 义项 */}
        {data.senses.map((s, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Badge color="var(--c-teal)">{s.pos || '—'}</Badge>
              <span style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{s.meaning}</span>
            </div>
            {s.examples?.map((ex, j) => (
              <div key={j} style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 4, fontFamily: 'var(--th-font)' }}>
                <span style={{ cursor: 'pointer' }} onClick={() => handleWordTap(ex.thai)}>{ex.thai}</span>
                <span style={{ color: 'var(--c-p500)', marginLeft: 6 }}>{ex.zh}</span>
              </div>
            ))}
          </Card>
        ))}

        {/* 近义词 / 反义词 */}
        {(data.synonyms.length > 0 || data.antonyms.length > 0) && (
          <Card style={{ marginBottom: 10 }}>
            {data.synonyms.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--c-teal)', marginBottom: 4 }}>近义词</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.synonyms.map((s, i) => (
                    <button key={i} onClick={() => handleWordTap(s.word)} style={relStyle('var(--c-teal)')}>{s.word}</button>
                  ))}
                </div>
              </div>
            )}
            {data.antonyms.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--c-rose)', marginBottom: 4 }}>反义词</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.antonyms.map((s, i) => (
                    <button key={i} onClick={() => handleWordTap(s.word)} style={relStyle('var(--c-rose)')}>{s.word}</button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* 学习联想 */}
        {data.learnerAssociations?.map((la, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-gold)', marginBottom: 4 }}>{la.category}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {la.words.map((w, j) => (
                <button key={j} onClick={() => handleWordTap(w)} style={relStyle('var(--c-gold)')}>{w}</button>
              ))}
            </div>
          </Card>
        ))}

        {/* 操作 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={openFolder} style={actionBtn('var(--c-teal)')}><FolderPlus size={16} /> 加入文件夹</button>
          <button onClick={() => setShowMorph(true)} style={actionBtn('var(--c-info)')}><Layers size={16} /> 词形分析</button>
          <button onClick={() => setShowNote(true)} style={actionBtn('var(--c-gold)')}><StickyNote size={16} /> 笔记</button>
        </div>
      </div>

      {/* 文件夹选择弹层 */}
      {showFolder && (
        <Picker onClose={() => setShowFolder(false)} title="选择文件夹">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="新建文件夹名称" style={pickerInput} />
            <button onClick={onCreateFolder} style={{ ...pickerBtn, background: 'var(--c-teal)', color: '#fff' }}><FolderPlus size={14} /></button>
          </div>
          {folders.filter((f) => f.folder_type === 'word').map((f) => (
            <button key={f.id} onClick={() => onAddToFolder(f.id)} style={pickerItem}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, display: 'inline-block', marginRight: 8 }} />
              {f.name} <span style={{ color: 'var(--c-s500)', fontSize: 12 }}>({f.wordCount || 0})</span>
            </button>
          ))}
          {folders.filter((f) => f.folder_type === 'word').length === 0 && <div style={{ color: 'var(--c-s500)', fontSize: 13 }}>暂无单词夹，先新建一个吧</div>}
        </Picker>
      )}

      {showMorph && <MorphologySection word={word} row={row} onClose={() => setShowMorph(false)} />}
      {showNote && <NoteEditorSection noteId={null} initialWord={word} onClose={() => setShowNote(false)} onSaved={() => setShowNote(false)} />}
    </div>
  )
}

const relStyle = (c) => ({
  background: 'color-mix(in srgb, ' + c + ' 12%, transparent)',
  color: c,
  border: 'none',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--th-font)',
})
const actionBtn = (c) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px',
  borderRadius: 12,
  border: '1px solid ' + c,
  color: c,
  background: 'transparent',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
})
const pickerInput = {
  flex: 1,
  padding: '10px 12px',
  border: '1px solid var(--c-p200)',
  borderRadius: 10,
  fontSize: 14,
  background: 'var(--c-bg)',
  color: 'var(--c-p800)',
  outline: 'none',
}
const pickerBtn = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
}
const pickerItem = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '10px 8px',
  background: 'var(--c-p100)',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  color: 'var(--c-p800)',
  cursor: 'pointer',
  marginBottom: 6,
}

function Picker({ children, title, onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--c-surface)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '70%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-p800)' }}>{title}</div>
          <IconButton onClick={onClose} title="关闭"><X size={18} /></IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}
