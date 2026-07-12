import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, BookText, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getSentencesByCategory } from '../../lib/db/index.js'
import { getGlobal } from '../../lib/mock/store.js'
import { IconButton, Card, Spinner, EmptyState, Badge } from '../../components/UIComponents.jsx'

export default function PhrasesSection({ onClose, onOpen }) {
  const app = useApp()
  const [category, setCategory] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const categories = useMemo(() => {
    const all = getGlobal('sentences', [])
    return [...new Set(all.map((s) => s.category).filter(Boolean))]
  }, [])

  useEffect(() => {
    setLoading(true)
    getSentencesByCategory(category).then((r) => {
      setList(r)
      setLoading(false)
    })
  }, [category])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>短语库</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Chip active={category === null} onClick={() => setCategory(null)}>全部</Chip>
        {categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
        ))}
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon="📚" text="该分类下暂无短语" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((s) => (
              <Card key={s.id} onClick={() => onOpen && onOpen(s)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--th-font)', fontSize: 15, color: 'var(--c-p800)' }}>{s.thai}</span>
                  <ChevronRight size={16} color="var(--c-s500)" />
                </div>
                <div style={{ fontSize: 13, color: 'var(--c-p600)', marginTop: 2 }}>{s.zh}</div>
                {s.category && <div style={{ marginTop: 6 }}><Badge color="var(--c-gold)">{s.category}</Badge></div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        border: '1px solid ' + (active ? 'var(--c-teal)' : 'var(--c-p200)'),
        background: active ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
        color: active ? 'var(--c-teal)' : 'var(--c-p500)',
      }}
    >
      {children}
    </button>
  )
}
