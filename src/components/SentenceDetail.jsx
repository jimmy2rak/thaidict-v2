import React, { useState, useEffect } from 'react'
import { ArrowLeft, Star, FolderPlus, Volume2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { bookmarkSentence, isSentenceBookmarked, getFolders, addSentenceToFolder, createFolder } from '../lib/db/index.js'
import { speak } from '../utils/tts.js'
import { enrichSegmented } from '../lib/utils.js'
import { getGlobal } from '../lib/mock/store.js'
import { Badge, IconButton, WordToken } from './UIComponents.jsx'

export default function SentenceDetail({ sentence, onClose }) {
  const app = useApp()
  const { userId, handleWordTap, toast } = app

  const [bookmarked, setBookmarked] = useState(false)
  const [showFolder, setShowFolder] = useState(false)
  const [folders, setFolders] = useState([])
  const [newFolder, setNewFolder] = useState('')

  useEffect(() => {
    if (userId && sentence) isSentenceBookmarked(userId, sentence.id).then(setBookmarked)
  }, [userId, sentence])

  const dictMap = getGlobal('dictionary', []).reduce((m, r) => {
    m[r.word.toLowerCase()] = { word: r.word, meanings: (r.senses || []).map((s) => s.meaning) }
    return m
  }, {})
  const segs = enrichSegmented(sentence.segmented || [], dictMap)

  const toggleBookmark = async () => {
    if (!userId) return toast('请先登录')
    if (bookmarked) return toast('已收藏')
    await bookmarkSentence(userId, sentence.id)
    setBookmarked(true)
    toast('已收藏句子')
  }
  const openFolder = async () => {
    setShowFolder(true)
    if (userId) setFolders(await getFolders(userId))
  }
  const onAdd = async (fid) => {
    await addSentenceToFolder(fid, sentence.id)
    setShowFolder(false)
    toast('已加入句子夹')
  }
  const onCreate = async () => {
    if (!newFolder.trim() || !userId) return
    const f = await createFolder(userId, newFolder.trim(), '#C4993D', 'sentence')
    setFolders(await getFolders(userId))
    if (f) await addSentenceToFolder(f.id, sentence.id)
    setNewFolder('')
    setShowFolder(false)
    toast('已创建并加入')
  }

  const rate = 1.0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>句子详情</div>
        <IconButton onClick={toggleBookmark} active={bookmarked} title="收藏"><Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} /></IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--th-font)', fontSize: 20, color: 'var(--c-p800)', lineHeight: 1.5, flex: 1 }}>{sentence.thai}</div>
          <IconButton onClick={() => speak(sentence.thai, { rate, lang: 'th-TH' })} title="朗读"><Volume2 size={20} /></IconButton>
        </div>
        <div style={{ fontSize: 15, color: 'var(--c-p600)', marginTop: 6 }}>{sentence.zh}</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
          {segs.map((s, i) => (
            <WordToken key={i} text={s.text} meaning={s.meaning} onClick={() => handleWordTap(s.text)} />
          ))}
        </div>

        {sentence.literal && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--c-gold)', marginBottom: 2 }}>字面意思</div>
            <div style={{ fontSize: 14, color: 'var(--c-p700)' }}>{sentence.literal}</div>
          </div>
        )}
        {sentence.note && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-info)', marginBottom: 2 }}>学习提示</div>
            <div style={{ fontSize: 14, color: 'var(--c-p600)' }}>{sentence.note}</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {sentence.difficulty ? (
            <span style={{ color: 'var(--c-gold)', fontSize: 13 }}>{'⭐'.repeat(sentence.difficulty)}</span>
          ) : null}
          {(sentence.tags || []).map((t, i) => (
            <Badge key={i} color="var(--c-info)">#{t}</Badge>
          ))}
        </div>

        <button onClick={openFolder} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--c-teal)', color: 'var(--c-teal)', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <FolderPlus size={16} /> 加入句子夹
        </button>
      </div>

      {showFolder && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--c-surface)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-p800)' }}>选择句子夹</div>
              <IconButton onClick={() => setShowFolder(false)} title="关闭"><ArrowLeft size={18} /></IconButton>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="新建句子夹" style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--c-p200)', borderRadius: 10, fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-p800)', outline: 'none' }} />
              <button onClick={onCreate} style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--c-teal)', color: '#fff', cursor: 'pointer' }}><FolderPlus size={14} /></button>
            </div>
            {folders.filter((f) => f.folder_type === 'sentence').map((f) => (
              <button key={f.id} onClick={() => onAdd(f.id)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 8px', background: 'var(--c-p100)', border: 'none', borderRadius: 10, fontSize: 14, color: 'var(--c-p800)', cursor: 'pointer', marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, display: 'inline-block', marginRight: 8 }} />
                {f.name} <span style={{ color: 'var(--c-s500)', fontSize: 12 }}>({f.sentenceCount || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
