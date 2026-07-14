import React, { useState, useEffect, useCallback } from 'react'
import { Search, Volume2, RefreshCw, Flame, BookA, Star, CalendarDays, ChevronRight, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  searchWords,
  loadDailyPick,
  refreshDailyPick,
  getDictionaryCount,
  getBookmarks,
  getStreak,
  getMonthlyCheckinStreak,
  isBookmarked,
  addBookmark,
  removeBookmark,
  isSentenceBookmarked,
  bookmarkSentence,
} from '../lib/db/index.js'
import { speak } from '../utils/tts.js'
import { transformWordData } from '../lib/utils.js'
import { Card, Badge, Spinner, EmptyState } from '../components/UIComponents.jsx'
import ThaiSentence from '../components/ThaiSentence.jsx'
import PhraseCard from '../components/PhraseCard.jsx'
import PhrasesSection from './subsections/PhrasesSection.jsx'
import PhraseDetailSection from './subsections/PhraseDetailSection.jsx'
import { PagodaLine, LeafLine, BowlLine } from '../components/Decorations.jsx'

export default function HomePage() {
  const app = useApp()
  const { userId, handleWordTap, navigateTo, setSelectedSentence, colorMode } = app
  const rate = 1.0

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [daily, setDaily] = useState({ word: null, sentence: null })
  const [stats, setStats] = useState({ streak: 0, dict: 0, bookmarks: 0, monthly: 0 })
  const [refreshing, setRefreshing] = useState(false)
  const [phrasesOpen, setPhrasesOpen] = useState(false)
  const [phrase, setPhrase] = useState(null)

  useEffect(() => {
    loadDailyPick().then(setDaily)
    if (userId) {
      Promise.all([
        getStreak(userId),
        getDictionaryCount(),
        getBookmarks(userId).then((b) => b.length),
        getMonthlyCheckinStreak(userId),
      ]).then(([streak, dict, bm, monthly]) => setStats({ streak, dict, bookmarks: bm, monthly }))
    }
  }, [userId])

  // 搜索防抖（文档4.5.1）—— 必须放在所有 early return 之前，否则 hooks 数量随状态变化，会触发 "Rendered fewer hooks than expected"
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchWords(query.trim())
      setResults(r)
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  if (phrase) return <PhraseDetailSection sentence={phrase} onClose={() => setPhrase(null)} />
  if (phrasesOpen) return <PhrasesSection onClose={() => setPhrasesOpen(false)} onOpen={(s) => setPhrase(s)} />

  const onRefresh = async (type) => {
    setRefreshing(true)
    const d = await refreshDailyPick(type)
    setDaily(d)
    setRefreshing(false)
  }

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '12px 14px 20px' }}>
      {/* 品牌头部（新中式素雅） */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--zh-serif)', color: 'var(--c-p800)', letterSpacing: 3 }}>词笺</div>
          <div style={{ fontSize: 11, color: 'var(--c-p500)', letterSpacing: 2, marginTop: 3 }}>中泰双语 · 温柔相伴</div>
        </div>
        <PagodaLine size={42} color="var(--c-gold)" style={{ opacity: 0.85 }} />
      </div>

      {/* 统计栏 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Stat icon={Flame} value={stats.streak} label="连续打卡" color="var(--c-gold)" />
        <Stat icon={BookA} value={stats.dict} label="词典词数" color="var(--c-teal)" />
        <Stat icon={Star} value={stats.bookmarks} label="收藏" color="var(--c-amber)" />
        <Stat icon={CalendarDays} value={stats.monthly} label="本月打卡" color="var(--c-info)" />
      </div>

      {/* 搜索 */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={17} color="var(--c-s500)" style={{ position: 'absolute', left: 12, top: 11 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索泰语单词、中文…"
          style={{
            width: '100%',
            padding: '10px 12px 10px 38px',
            border: '1px solid var(--c-p200)',
            borderRadius: 14,
            fontSize: 14,
            background: 'var(--c-surface)',
            color: 'var(--c-p800)',
            outline: 'none',
          }}
        />
        {searching && <Spinner size={16} color="var(--c-teal)" style={{ position: 'absolute', right: 12, top: 12 }} />}
      </div>

      {query.trim() ? (
        <SearchResults
          results={results}
          onTap={handleWordTap}
          searching={searching}
          query={query}
          onAiSearch={(q) => navigateTo({ type: 'unknown', word: q })}
        />
      ) : (
        <>
          {/* 每日一词 */}
          <DailyWordCard
            word={daily.word}
            onRefresh={() => onRefresh('word')}
            onTap={handleWordTap}
            refreshing={refreshing}
            rate={rate}
            userId={userId}
          />
          {/* 每日一句 */}
          <DailySentenceCard
            sentence={daily.sentence}
            onRefresh={() => onRefresh('sentence')}
            onOpen={() => daily.sentence && setSelectedSentence(daily.sentence)}
            refreshing={refreshing}
            userId={userId}
          />
          {/* 短语库入口 */}
          <Card onClick={() => setPhrasesOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb, var(--c-gold) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-gold)' }}>
              <LeafLine size={24} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)' }}>短语库</div>
              <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>按主题浏览常用泰语短语</div>
            </div>
            <ChevronRight size={18} color="var(--c-s500)" />
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, value, label, color }) {
  return (
    <Card style={{ flex: 1, padding: '8px 6px', textAlign: 'center' }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-p800)', marginTop: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--c-p500)' }}>{label}</div>
    </Card>
  )
}

function SearchResults({ results, onTap, searching, query, onAiSearch }) {
  if (searching && results.length === 0) return <EmptyState icon={<Spinner />} text="搜索中…" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {results.map((r) => (
        <Card key={r.word} onClick={() => onTap(r.word)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 17, fontWeight: 600, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{r.word}</span>
              {r.romanization && <span style={{ fontSize: 12, color: 'var(--c-p500)', marginLeft: 8 }}>{r.romanization}</span>}
            </div>
            {r.pos && <Badge color="var(--c-teal)">{r.pos}</Badge>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 2 }}>
            {(r.senses?.[0]?.meaning) || ''}
          </div>
        </Card>
      ))}
      {!searching && results.length === 0 && (
        <EmptyState icon="🔍" text="没有找到相关词条" />
      )}
      {/* 需求 #3：检索结果后追加 AI 搜索入口（生成内容将进入待审批） */}
      {!searching && query?.trim() && (
        <button
          onClick={() => onAiSearch(query.trim())}
          style={{
            marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px', borderRadius: 12, border: '1px dashed var(--c-teal)',
            color: 'var(--c-teal)', background: 'color-mix(in srgb, var(--c-teal) 8%, transparent)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Sparkles size={16} /> 未找到词语？AI 搜索「{query.trim()}」
        </button>
      )}
    </div>
  )
}

function DailyWordCard({ word, onRefresh, onTap, refreshing, rate, userId }) {
  // hooks 必须放在任何 early return 之前，避免 word 由 null 变为有值时 hooks 数量不一致
  const [bookmarked, setBookmarked] = React.useState(false)
  React.useEffect(() => {
    const w = word ? (typeof word === 'object' ? (word.word || '') : word) : ''
    if (userId && w) isBookmarked(userId, w).then(setBookmarked)
  }, [userId, word])

  if (!word) return null
  const data = typeof word === 'object' ? transformWordData(word) : null
  const w = data || word
  const first = (w.senses && w.senses[0]) || {}

  const toggleBookmark = async (e) => {
    e?.stopPropagation?.()
    if (!userId) return
    if (bookmarked) {
      await removeBookmark(userId, w.word)
      setBookmarked(false)
    } else {
      await addBookmark(userId, w.word)
      setBookmarked(true)
    }
  }

  return (
    <Card style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onTap(w.word)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>
            <ThaiSentence text={w.word} type="word" style={{ fontSize: 18, fontWeight: 700 }} />
          </div>
          {w.romanization && <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 1 }}>{w.romanization}</div>}
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 2 }}>{first.meaning}</div>
          {first.examples?.[0] && (
            <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 2 }}>
              {first.examples[0].thai} · {first.examples[0].zh}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} onClick={e => e.stopPropagation()}>
          <IconBtn onClick={() => speak(w.word, { rate })} style={{ width: 32, height: 32 }}><Volume2 size={16} /></IconBtn>
          <IconBtn onClick={toggleBookmark} active={bookmarked} style={{ width: 32, height: 32 }}>
            <Star size={16} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
          </IconBtn>
          <IconBtn onClick={onRefresh} disabled={refreshing} style={{ width: 32, height: 32 }}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /></IconBtn>
        </div>
      </div>
    </Card>
  )
}

function DailySentenceCard({ sentence, onRefresh, onOpen, refreshing, userId }) {
  // hooks 必须放在任何 early return 之前
  const [bookmarked, setBookmarked] = React.useState(false)
  React.useEffect(() => {
    if (userId && sentence?.id) isSentenceBookmarked(userId, sentence.id).then(setBookmarked)
  }, [userId, sentence])

  if (!sentence) return null

  const toggleBookmark = async () => {
    if (!userId) return
    if (bookmarked) return
    await bookmarkSentence(userId, sentence.id)
    setBookmarked(true)
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BowlLine size={22} color="var(--c-primary)" style={{ opacity: 0.7 }} />
          <Badge color="var(--c-gold)">每日一句</Badge>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></IconBtn>
        </div>
      </div>
      <PhraseCard
        item={sentence}
        onOpen={onOpen}
        onBookmark={toggleBookmark}
        bookmarked={bookmarked}
        style={{ border: 'none', boxShadow: 'none', padding: 0 }}
      />
    </Card>
  )
}

function IconBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 10,
        background: active ? 'color-mix(in srgb, var(--c-amber) 16%, transparent)' : 'var(--c-p100)',
        border: 'none',
        color: active ? 'var(--c-amber)' : 'var(--c-p700)',
        cursor: 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
