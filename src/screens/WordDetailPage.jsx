import React, { useState, useEffect, useMemo } from 'react'
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
  getWordMeanings,
} from '../lib/db/index.js'
import { transformWordData } from '../lib/utils.js'
import { speak } from '../utils/tts.js'
import { Card, Badge, IconButton, WordToken, Spinner } from '../components/UIComponents.jsx'
import ThaiSentence from '../components/ThaiSentence.jsx'
import SourceTag from '../components/SourceTag.jsx'
import { getSourceMeta } from '../lib/sourceMeta.js'
import MorphologySection from './subsections/MorphologySection.jsx'
import NoteEditorSection from './subsections/NoteEditorSection.jsx'

export default function WordDetailPage({ word }) {
  const app = useApp()
  const { userId, dbWordData, generatedWords, handleWordTap, goBack, goForward, navStack, navForward, toast, checkAndToastAchievements } = app

  const row = dbWordData[word]
  const gen = generatedWords[word]
  // 必须 memo：transformWordData(row) 每次都返回新对象，若直接放在渲染体里，
  // 下方 meaningMap 的 useEffect 依赖 [word, data] 会因 data 引用每次都变而无限重渲染 → 主线程卡死（无报错）。
  const data = useMemo(() => gen || (row ? transformWordData(row) : null), [gen, row])

  // dictionary_full 原始行的附加元数据（transformWordData 未透传的字段），按需展示。
  // row 即 getWordByThai 返回的 dictionary_full_ext 原行，含 senses/sources/freq_* 等全部列。
  const raw = row || {}
  const meta = {
    romanizationSource: raw.romanization_source || '',
    origin: raw.origin || '',
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    enrichmentStatus: raw.enrichment_status || '',
    senseCount: raw.sense_count ?? data?.senseCount ?? null,
    userSentenceCount: raw.user_sentence_count ?? null,
    freqTnc: raw.freq_tnc ?? null,
    freqTtc: raw.freq_ttc ?? null,
    freqPhupha: raw.freq_phupha ?? null,
  }

  const [bookmarked, setBookmarked] = useState(false)
  const [showFolder, setShowFolder] = useState(false)
  const [folders, setFolders] = useState([])
  const [newFolder, setNewFolder] = useState('')
  const [showMorph, setShowMorph] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [meaningMap, setMeaningMap] = useState({})
  const [noteMap, setNoteMap] = useState({})

  useEffect(() => {
    if (userId && word) {
      isBookmarked(userId, word).then(setBookmarked)
      recordWordLookup(userId, word)
    }
  }, [userId, word])

  // 近/反义词、学习者建议中单词的汉语释义（需求 #5：查不到则不显示括号）
  useEffect(() => {
    if (!data) return
    const words = new Set()
    const notes = {}
    ;(data.synonyms || []).forEach((s) => s.word && words.add(s.word))
    ;(data.antonyms || []).forEach((s) => s.word && words.add(s.word))
    ;(data.learnerAssociations || []).forEach((la) => {
      const list = Array.isArray(la.words) ? la.words : la.word ? [la.word] : []
      list.forEach((w) => {
        if (!w) return
        words.add(w)
        if (la.note && !notes[w]) notes[w] = la.note
      })
    })
    setNoteMap(notes)
    if (words.size === 0) return
    let cancelled = false
    Promise.all([...words].map(async (w) => [w, await getWordMeanings(w)])).then((pairs) => {
      if (cancelled) return
      const m = {}
      pairs.forEach(([w, arr]) => { m[w] = arr })
      setMeaningMap(m)
    })
    return () => { cancelled = true }
  }, [word, data])

  const toggleBookmark = async () => {
    if (!userId) return app.toast('请先登录')
    if (bookmarked) {
      await removeBookmark(userId, word)
      setBookmarked(false)
    } else {
      await addBookmark(userId, word)
      setBookmarked(true)
      await checkAndToastAchievements()
      // 收藏后自动弹出单词夹选择/新建菜单
      openFolder()
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
    const f = await createFolder(userId, newFolder.trim(), '#8FA98C', 'word')
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
        <IconButton onClick={goBack} title="返回"><ArrowLeft size={20} /></IconButton>
        <IconButton onClick={goForward} disabled={navForward.length === 0} title="前进"><ArrowRight size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>词条详情</div>
        <IconButton onClick={toggleBookmark} active={bookmarked} title="收藏"><Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} /></IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {/* 词头卡片 */}
        <Card style={{ marginBottom: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)', lineHeight: 1.3 }}>
                {data.word}
              </div>
              {data.romanization && (
                <div style={{ fontSize: 15, color: 'var(--c-p500)', marginTop: 4 }}>{data.romanization}</div>
              )}
              {meta.romanizationSource && (
                <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 2 }}>罗马音来源：{meta.romanizationSource}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {meta.senseCount != null && <Badge color="var(--c-primary)">{meta.senseCount} 个义项</Badge>}
                {meta.origin && <Badge color="var(--c-info)">{meta.origin}</Badge>}
                {meta.sources.map((src, i) => (
                  <SourceTag key={i} sourceKey={src} />
                ))}
              </div>
            </div>
            <IconButton onClick={() => speak(data.word, { rate })} title="朗读" style={{ width: 44, height: 44 }}>
              <Volume2 size={24} />
            </IconButton>
          </div>
        </Card>

        {/* 义项 */}
        {data.senses.map((s, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {data.senses.length > 1 && (
                <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'var(--c-p800)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.senseId ?? i + 1}</span>
              )}
              <Badge color="var(--c-p800)">{s.pos || '—'}</Badge>
              {(s.register && s.register !== '通用') && <Badge color="var(--c-info)">{s.register}</Badge>}
              {s.source && s.source !== 'ai' && (getSourceMeta(s.source) ? <SourceTag sourceKey={s.source} /> : <Badge color="var(--c-p500)">{s.source}</Badge>)}
              <span style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{s.meaning}</span>
            </div>
            {s.examples?.map((ex, j) => {
              const exThai = ex.th ?? ex.thai ?? ''
              return (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--c-p600)', marginTop: 8, fontFamily: 'var(--th-font)' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
                      <ThaiSentence
                        text={exThai}
                        type="sentence"
                        tokens={ex.segmented && ex.segmented.length ? ex.segmented : undefined}
                        onWordClick={handleWordTap}
                        style={{ fontFamily: 'var(--th-font)' }}
                      />
                    </div>
                    <div style={{ color: 'var(--c-p500)', lineHeight: 1.5, wordBreak: 'break-word', fontFamily: 'var(--zh-font)' }}>{ex.zh}</div>
                  </div>
                  <button
                    onClick={() => speak(exThai, { rate })}
                    title="朗读例句"
                    style={{ flexShrink: 0, marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--c-p100)', border: 'none', color: 'var(--c-p700)', cursor: 'pointer' }}
                  >
                    <Volume2 size={15} />
                  </button>
                </div>
              )
            })}
          </Card>
        ))}

        {/* 近义词 */}
        {data.synonyms.length > 0 && (
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-teal)', marginBottom: 4 }}>近义词</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.synonyms.map((s, i) => (
                <RelWord key={i} word={s.word} color="var(--c-teal)" meaning={s.meaning || meaningMap[s.word]} onClick={() => handleWordTap(s.word)} />
              ))}
            </div>
          </Card>
        )}

        {/* 反义词 */}
        {data.antonyms.length > 0 && (
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-rose)', marginBottom: 4 }}>反义词</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.antonyms.map((s, i) => (
                <RelWord key={i} word={s.word} color="var(--c-rose)" meaning={s.meaning || meaningMap[s.word]} onClick={() => handleWordTap(s.word)} />
              ))}
            </div>
          </Card>
        )}

        {/* 学习联想 */}
        {data.learnerAssociations && data.learnerAssociations.length > 0 && (
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-gold)', marginBottom: 4 }}>学习者联想</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.learnerAssociations.map((la, i) => {
                const w = la.word || (la.words && la.words[0])
                if (!w) return null
                const meaning = meaningMap[w] || (la.note ? [la.note] : null)
                return <RelWord key={i} word={w} color="var(--c-gold)" meaning={meaning} onClick={() => handleWordTap(w)} />
              })}
            </div>
          </Card>
        )}

        {/* 词典信息（dictionary_full 全部元数据字段） */}
        <Card style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--c-p500)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>词典信息</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meta.senseCount != null && <MetaRow label="义项数" value={String(meta.senseCount)} />}
            {meta.enrichmentStatus && <MetaRow label="丰富状态" value={meta.enrichmentStatus} />}
            {meta.origin && <MetaRow label="语料来源" value={meta.origin} />}
            {meta.sources.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
                <span style={{ flexShrink: 0, color: 'var(--c-p500)', minWidth: 64 }}>来源明细</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {meta.sources.map((src, i) => (
                    <SourceTag key={i} sourceKey={src} />
                  ))}
                </span>
              </div>
            )}
            {meta.userSentenceCount != null && <MetaRow label="用户句子数" value={String(meta.userSentenceCount)} />}
            <MetaRow
              label="词频"
              value={[
                meta.freqTnc != null ? `TNC ${meta.freqTnc}` : null,
                meta.freqTtc != null ? `TTC ${meta.freqTtc}` : null,
                meta.freqPhupha != null ? `Phupha ${meta.freqPhupha}` : null,
              ].filter(Boolean).join('　') || '—'}
            />
          </div>
        </Card>

        {/* 操作 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={openFolder} style={actionBtn('var(--c-primary)')}><FolderPlus size={16} /> 加入文件夹</button>
          <button onClick={() => setShowMorph(true)} style={actionBtn('var(--c-info)')}><Layers size={16} /> 词形分析</button>
          <button onClick={() => setShowNote(true)} style={actionBtn('var(--c-rose)')}><StickyNote size={16} /> 笔记</button>
        </div>
      </div>

      {/* 文件夹选择弹层 */}
      {showFolder && (
        <Picker onClose={() => setShowFolder(false)} title="选择文件夹">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="新建文件夹名称" style={pickerInput} />
            <button onClick={onCreateFolder} style={{ ...pickerBtn, background: 'var(--c-primary)', color: '#fff' }}><FolderPlus size={14} /></button>
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
// 近反义词/学习者建议单词：查到释义时附加中文括号（多义用分号分隔），查不到则不显示括号（需求 #5）
function RelWord({ word, color, meaning, onClick }) {
  return (
    <button onClick={onClick} style={relStyle(color)}>
      <span style={{ fontFamily: 'var(--th-font)' }}>{word}</span>
      {meaning && meaning.length > 0 && (
        <span style={{ fontFamily: 'var(--zh-font)', fontSize: 12 }}>（{meaning.join('；')}）</span>
      )}
    </button>
  )
}
// 词典信息：左右两栏的 label/value 行
function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
      <span style={{ flexShrink: 0, color: 'var(--c-p500)', minWidth: 64 }}>{label}</span>
      <span style={{ color: 'var(--c-p800)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
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
