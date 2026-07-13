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
} from '../lib/db/index.js'
import { speak } from '../utils/tts.js'
import { transformWordData, enrichSegmented } from '../lib/utils.js'
import { Card, Badge, Spinner, WordToken, EmptyState } from '../components/UIComponents.jsx'
import { getGlobal } from '../lib/mock/store.js'
import PhrasesSection from './subsections/PhrasesSection.jsx'
import PhraseDetailSection from './subsections/PhraseDetailSection.jsx'

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

  const dictMap = getGlobal('dictionary', []).reduce((m, r) => {
    m[r.word.toLowerCase()] = { word: r.word, meanings: (r.senses || []).map((s) => s.meaning) }
    return m
  }, {})

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '16px 16px 24px' }}>
      {/* 统计栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Stat icon={Flame} value={stats.streak} label="连续打卡" color="var(--c-gold)" />
        <Stat icon={BookA} value={stats.dict} label="词典词数" color="var(--c-teal)" />
        <Stat icon={Star} value={stats.bookmarks} label="收藏" color="var(--c-amber)" />
        <Stat icon={CalendarDays} value={stats.monthly} label="本月打卡" color="var(--c-info)" />
      </div>

      {/* 搜索 */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={18} color="var(--c-s500)" style={{ position: 'absolute', left: 14, top: 13 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索泰语单词、中文…"
          style={{
            width: '100%',
            padding: '12px 14px 12px 42px',
            border: '1px solid var(--c-p200)',
            borderRadius: 14,
            fontSize: 15,
            background: 'var(--c-surface)',
            color: 'var(--c-p800)',
            outline: 'none',
          }}
        />
        {searching && <Spinner size={16} color="var(--c-teal)" style={{ position: 'absolute', right: 14, top: 14 }} />}
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
          />
          {/* 每日一句 */}
          <DailySentenceCard
            sentence={daily.sentence}
            dictMap={dictMap}
            onRefresh={() => onRefresh('sentence')}
            onToken={(w) => handleWordTap(w)}
            onOpen={() => daily.sentence && setSelectedSentence(daily.sentence)}
            refreshing={refreshing}
          />
          {/* 短语库入口 */}
          <Card onClick={() => setPhrasesOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--c-gold) 16%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📚</span>
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
    <Card style={{ flex: 1, padding: '10px 8px', textAlign: 'center' }}>
      <Icon size={18} color={color} />
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-p800)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--c-p500)' }}>{label}</div>
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
            {(r.senses[0]?.meaning) || ''}
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

function DailyWordCard({ word, onRefresh, onTap, refreshing, rate }) {
  if (!word) return null
  const data = typeof word === 'object' ? transformWordData(word) : null
  const w = data || word
  const first = (w.senses && w.senses[0]) || {}
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }} onClick={() => onTap(w.word)}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{w.word}</div>
          {w.romanization && <div style={{ fontSize: 13, color: 'var(--c-p500)' }}>{w.romanization}</div>}
          <div style={{ fontSize: 14, color: 'var(--c-p600)', marginTop: 4 }}>{first.meaning}</div>
          {first.examples?.[0] && (
            <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 4 }}>
              {first.examples[0].thai} · {first.examples[0].zh}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <IconBtn onClick={() => speak(w.word, { rate })}><Volume2 size={18} /></IconBtn>
          <IconBtn onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></IconBtn>
        </div>
      </div>
    </Card>
  )
}

function DailySentenceCard({ sentence, dictMap, onRefresh, onToken, onOpen, refreshing }) {
  if (!sentence) return null
  const segs = enrichSegmented(sentence.segmented || [], dictMap)
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Badge color="var(--c-gold)">每日一句</Badge>
        <IconBtn onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></IconBtn>
      </div>
      <div style={{ fontFamily: 'var(--th-font)', fontSize: 16, color: 'var(--c-p800)', lineHeight: 1.5 }}>{sentence.thai}</div>
      <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 2 }}>{sentence.zh}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
        {segs.map((s, i) => (
          <WordToken key={i} text={s.text} meaning={s.meaning} onClick={() => onToken(s.text)} />
        ))}
      </div>
      <button
        onClick={onOpen}
        style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, color: 'var(--c-info)', background: 'none', border: 'none' }}
      >
        查看详情 <ChevronRight size={14} />
      </button>
    </Card>
  )
}

function IconBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'var(--c-p100)', border: 'none', color: 'var(--c-p700)', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}
