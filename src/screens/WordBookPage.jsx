import React, { useState, useEffect } from 'react'
import { Clock, FolderOpen, BookOpen, Library, ArrowLeft, Check } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  getUserRecentWords, getFolders, getFolderWords, getFolderSentences,
  getSentenceById, getWordBooks, getWordBook, getWordBookProgress, updateWordBookProgress,
} from '../lib/db/index.js'
import { Card, Badge, Spinner, EmptyState, IconButton } from '../components/UIComponents.jsx'
import ThaiSentence from '../components/ThaiSentence.jsx'
import PhraseCard from '../components/PhraseCard.jsx'

const TABS = [
  { key: 'recent', label: '最近', icon: Clock },
  { key: 'wordfolders', label: '单词夹', icon: FolderOpen },
  { key: 'sentencefolders', label: '句子夹', icon: BookOpen },
  { key: 'books', label: '单词书', icon: Library },
]

export default function WordBookPage() {
  const app = useApp()
  const { userId, handleWordTap, navigateTo, toast } = app
  const [tab, setTab] = useState('recent')
  const [detail, setDetail] = useState(null) // {type, id, name}

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 12px 6px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-p800)' }}>单词本</div>
      </div>

      <div style={{ display: 'flex', gap: 5, padding: '0 12px 6px' }}>
        {TABS.map((t) => {
          const active = tab === t.key && !detail
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => { setDetail(null); setTab(t.key) }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 0',
                borderRadius: 10, border: '1px solid ' + (active ? 'var(--c-primary)' : 'var(--c-p200)'),
                background: active ? 'color-mix(in srgb, var(--c-primary) 12%, transparent)' : 'var(--c-surface)',
                color: active ? 'var(--c-primary)' : 'var(--c-p500)', fontSize: 11, fontWeight: 600,
              }}
            >
              <Icon size={17} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '2px 14px 20px' }}>
        {!detail && tab === 'recent' && <RecentTab userId={userId} onTap={handleWordTap} />}
        {!detail && tab === 'wordfolders' && <FolderTab userId={userId} type="word" onOpen={(id, name) => setDetail({ type: 'wordfolder', id, name })} />}
        {!detail && tab === 'sentencefolders' && <FolderTab userId={userId} type="sentence" onOpen={(id, name) => setDetail({ type: 'sentencefolder', id, name })} />}
        {!detail && tab === 'books' && <BookTab onOpen={(id, name) => setDetail({ type: 'book', id, name })} />}

        {detail && detail.type === 'wordfolder' && <WordFolderDetail folderId={detail.id} name={detail.name} onBack={() => setDetail(null)} onTap={handleWordTap} />}
        {detail && detail.type === 'sentencefolder' && <SentenceFolderDetail folderId={detail.id} name={detail.name} onBack={() => setDetail(null)} onOpen={navigateTo} />}
        {detail && detail.type === 'book' && <BookDetail bookId={detail.id} name={detail.name} userId={userId} onBack={() => setDetail(null)} onTap={handleWordTap} toast={toast} />}
      </div>
    </div>
  )
}

// ---------- 最近查词 ----------
function RecentTab({ userId, onTap }) {
  const [list, setList] = useState(null)
  useEffect(() => { if (userId) getUserRecentWords(userId, 100).then(setList); else setList([]) }, [userId])
  if (list === null) return <CenterSpinner />
  if (list.length === 0) return <EmptyState icon="🕘" text="还没有查词记录" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((r) => (
        <Card key={r.word} onClick={() => onTap(r.word)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--th-font)', fontSize: 16, fontWeight: 700, color: 'var(--c-p800)', lineHeight: 1.35 }}>{r.word}</div>
              <div style={{ marginTop: 2 }}>
                <ThaiSentence text={r.word} type="sentence" separator=" + " style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--c-p500)' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--c-p500)', flexShrink: 0, marginLeft: 6 }}>查 {r.lookup_count || 1} 次</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-p600)', marginTop: 2 }}>{r.senses?.[0]?.meaning || ''}</div>
        </Card>
      ))}
    </div>
  )
}

// ---------- 文件夹列表 ----------
function FolderTab({ userId, type, onOpen }) {
  const [folders, setFolders] = useState(null)
  useEffect(() => {
    if (!userId) return setFolders([])
    getFolders(userId).then((f) => setFolders(f.filter((x) => x.folder_type === type)))
  }, [userId, type])
  if (folders === null) return <CenterSpinner />
  if (folders.length === 0) return <EmptyState icon="📁" text={type === 'word' ? '还没有单词夹，去词条页加入吧' : '还没有句子夹'} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {folders.map((f) => (
        <Card key={f.id} onClick={() => onOpen(f.id, f.name)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>{f.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-p500)' }}>
              {type === 'word' ? `${f.wordCount || 0} 词` : `${f.sentenceCount || 0} 句`}
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------- 单词夹详情 ----------
function WordFolderDetail({ folderId, name, onBack, onTap }) {
  const [words, setWords] = useState(null)
  useEffect(() => { getFolderWords(folderId).then(setWords) }, [folderId])
  if (words === null) return <DetailShell name={name} onBack={onBack}><CenterSpinner /></DetailShell>
  return (
    <DetailShell name={name} onBack={onBack}>
      {words.length === 0 ? <EmptyState icon="📭" text="文件夹为空" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {words.map((w, i) => (
            <Card key={i} onClick={() => onTap(w.word)} style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: 'var(--th-font)', fontSize: 16, fontWeight: 700, color: 'var(--c-p800)', lineHeight: 1.35 }}>{w.word}</div>
              <div style={{ marginTop: 2 }}>
                <ThaiSentence text={w.word} type="sentence" separator=" + " style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--c-p500)' }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </DetailShell>
  )
}

// ---------- 句子夹详情 ----------
function SentenceFolderDetail({ folderId, name, onBack, onOpen }) {
  const [sentences, setSentences] = useState(null)
  useEffect(() => {
    getFolderSentences(folderId).then(async (rels) => {
      const arr = await Promise.all(rels.map((r) => getSentenceById(r.sentence_id)))
      setSentences(arr.filter(Boolean))
    })
  }, [folderId])
  if (sentences === null) return <DetailShell name={name} onBack={onBack}><CenterSpinner /></DetailShell>
  return (
    <DetailShell name={name} onBack={onBack}>
      {sentences.length === 0 ? <EmptyState icon="📭" text="文件夹为空" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sentences.map((s) => (
            <PhraseCard
              key={s.id}
              item={s}
              onOpen={() => onOpen({ type: 'sentence', sentence: s })}
              showCategory
            />
          ))}
        </div>
      )}
    </DetailShell>
  )
}

// ---------- 单词书详情（功能 3.8） ----------
function BookDetail({ bookId, name, userId, onBack, onTap, toast }) {
  const [book, setBook] = useState(null)
  const [progress, setProgress] = useState(null)
  useEffect(() => {
    ;(async () => {
      const b = await getWordBook(bookId)
      const p = await getWordBookProgress(userId, bookId)
      setBook(b)
      setProgress(p)
    })()
  }, [bookId, userId])
  if (!book) return <DetailShell name={name} onBack={onBack}><CenterSpinner /></DetailShell>

  const entries = book.entries || []
  const done = progress?.completed

  const markComplete = async () => {
    await updateWordBookProgress(userId, bookId, { last_word_index: entries.length, completed: true })
    setProgress({ last_word_index: entries.length, completed: true })
    toast('已标记完成 🎉')
  }

  return (
    <DetailShell name={name} onBack={onBack}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-p600)' }}>{book.description}</div>
        <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 4 }}>共 {entries.length} 词 · {done ? '已完成 ✓' : '学习中'}</div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((w, i) => (
          <Card key={i} onClick={() => onTap(w)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--th-font)', fontSize: 16, fontWeight: 600, color: 'var(--c-p800)' }}>{w}</span>
            <span style={{ fontSize: 12, color: 'var(--c-p500)' }}>第 {i + 1} 词</span>
          </Card>
        ))}
      </div>
      {!done && (
        <button onClick={markComplete} style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--c-primary)', color: 'var(--c-primary)', background: 'transparent', fontSize: 15, fontWeight: 600 }}>
          <Check size={16} /> 标记全书完成
        </button>
      )}
    </DetailShell>
  )
}

// ---------- 单词书列表 ----------
function BookTab({ onOpen }) {
  const [books, setBooks] = useState(null)
  useEffect(() => { getWordBooks().then(setBooks) }, [])
  if (books === null) return <CenterSpinner />
  if (books.length === 0) return <EmptyState icon="📚" text="还没有单词书" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {books.map((b) => (
        <Card key={b.id} onClick={() => onOpen(b.id, b.name)} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{b.name}</div>
          <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 2 }}>
            {b.description ? b.description + ' · ' : ''}
            {(b.entries && b.entries.length) || 0} 词
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------- 通用 ----------
function DetailShell({ name, onBack, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconButton onClick={onBack} title="返回"><ArrowLeft size={18} /></IconButton>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{name}</span>
      </div>
      {children}
    </div>
  )
}
function CenterSpinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
}
