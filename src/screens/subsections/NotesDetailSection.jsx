import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Plus, StickyNote, ChevronRight, Search, X, Tag } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getNotes } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, EmptyState, Badge, AsyncBadge } from '../../components/UIComponents.jsx'
import { loadCache, saveCache } from '../../lib/asyncCache.js'

export default function NotesDetailSection({ onClose, onEdit }) {
  const app = useApp()
  const { userId } = app
  const CACHE_KEY = 'notes'
  const cachedNotes = loadCache(CACHE_KEY)
  const [notes, setNotes] = useState(cachedNotes || [])
  const [loading, setLoading] = useState(!cachedNotes)
  const [bgLoading, setBgLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [activeTag, setActiveTag] = useState(null)

  const load = () => {
    if (!userId) return setLoading(false)
    setBgLoading(true)
    getNotes(userId).then((n) => {
      setNotes(n)
      setLoading(false)
      setBgLoading(false)
      saveCache(CACHE_KEY, n)
    })
  }
  useEffect(load, [userId])

  const allTags = useMemo(() => {
    const set = new Set()
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)))
    return [...set].sort()
  }, [notes])

  const filtered = useMemo(() => {
    let list = notes
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((n) => (n.word || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
    }
    if (activeTag) {
      list = list.filter((n) => (n.tags || []).includes(activeTag))
    }
    return list
  }, [notes, query, activeTag])

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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>我的笔记</div>
        <AsyncBadge loading={bgLoading} />
        <IconButton onClick={() => setShowSearch((s) => !s)} title="搜索" active={showSearch}><Search size={18} /></IconButton>
        <IconButton onClick={() => onEdit && onEdit({ id: null, word: '', content: '', tags: [] })} title="新建笔记" active={false}><Plus size={22} /></IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 12 }}>
        {showSearch && (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={16} color="var(--c-s500)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索单词或笔记内容"
              style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--c-p200)', borderRadius: 12, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-p800)', outline: 'none' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 10, top: 9, color: 'var(--c-p500)' }}>
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => setActiveTag(null)}
              style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid ' + (activeTag ? 'var(--c-p200)' : 'var(--c-teal)'), background: activeTag ? 'var(--c-surface)' : 'color-mix(in srgb, var(--c-teal) 12%, transparent)', color: activeTag ? 'var(--c-p500)' : 'var(--c-teal)', fontSize: 11, fontWeight: 600 }}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid ' + (activeTag === tag ? 'var(--c-teal)' : 'var(--c-p200)'), background: activeTag === tag ? 'color-mix(in srgb, var(--c-teal) 12%, transparent)' : 'var(--c-surface)', color: activeTag === tag ? 'var(--c-teal)' : 'var(--c-p500)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <Tag size={10} /> {tag}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon="📝" text={query || activeTag ? '没有匹配的笔记' : '还没有笔记，去词条详情页点「笔记」开始记录吧'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((n) => (
              <Card key={n.id} onClick={() => onEdit && onEdit(n)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--th-font)', fontSize: 16, fontWeight: 700, color: 'var(--c-p800)' }}>{n.word || '（未命名）'}</span>
                  <ChevronRight size={16} color="var(--c-s500)" />
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-p600)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.content || '（空）'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(n.tags || []).map((t) => (
                      <Badge key={t} color="var(--c-info)">{t}</Badge>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--c-p500)' }}>{formatDate(n.updated_at)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
