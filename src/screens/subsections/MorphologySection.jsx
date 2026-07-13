import React, { useState, useEffect, useMemo } from 'react'
import { X, Layers, ArrowRight, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getGlobal } from '../../lib/mock/store.js'
import { thaiSegment } from '../../utils/thaiSegment.js'
import { IconButton, Card, Badge, Spinner, EmptyState } from '../../components/UIComponents.jsx'

// 常见泰语词缀（前缀/后缀）启发式表（本地形态分析用）
const PREFIXES = [
  { t: 'การ', m: '名词化（行为/事物）' },
  { t: 'ความ', m: '名词化（性质/状态）' },
  { t: 'ผู้', m: '…的人（施事者）' },
  { t: 'คน', m: '人' },
  { t: 'นัก', m: '…者 / 从事…的人' },
  { t: 'ไม่', m: '不 / 否定' },
  { t: 'ได้', m: '能 / 可以' },
  { t: 'ถูก', m: '被（被动语态）' },
  { t: 'ที่', m: '的 / 关系代词' },
  { t: 'ปาก', m: '口语前缀' },
]
const SUFFIXES = [
  { t: 'ๆ', m: '叠词（重复 / 复数）' },
  { t: 'นะ', m: '语气词' },
  { t: 'ครับ', m: '男性礼貌词' },
  { t: 'ค่ะ', m: '女性礼貌词' },
  { t: 'ลง', m: '向下' },
  { t: 'ขึ้น', m: '向上' },
]

function buildDictMap() {
  const dict = getGlobal('dictionary', [])
  const m = {}
  for (const r of dict) m[r.word.toLowerCase()] = { word: r.word, meanings: (r.senses || []).map((s) => s.meaning) }
  return m
}

// 从词中找出词典里存在的最长词根（处理复合词，如 นักเรียน → เรียน）
function findRootInDict(remainder, dictMap) {
  if (!remainder) return null
  const lower = remainder.toLowerCase()
  if (dictMap[lower]) return dictMap[lower].word
  let best = null
  for (const key of Object.keys(dictMap)) {
    if (key.length >= 2 && lower.includes(key)) {
      if (!best || key.length > best.length) best = key
    }
  }
  return best ? dictMap[best].word : null
}

function analyze(word, dictMap) {
  const affixes = []
  let remainder = word
  // 剥离前缀（取最长匹配）
  let changed = true
  while (changed) {
    changed = false
    for (const p of PREFIXES) {
      if (remainder.toLowerCase().startsWith(p.t.toLowerCase()) && remainder.length > p.t.length) {
        affixes.push({ text: p.t, type: 'prefix', meaning: p.m })
        remainder = remainder.slice(p.t.length)
        changed = true
        break
      }
    }
  }
  // 剥离后缀
  changed = true
  while (changed) {
    changed = false
    for (const s of SUFFIXES) {
      if (remainder.toLowerCase().endsWith(s.t.toLowerCase()) && remainder.length > s.t.length) {
        affixes.push({ text: s.t, type: 'suffix', meaning: s.m })
        remainder = remainder.slice(0, remainder.length - s.t.length)
        changed = true
        break
      }
    }
  }
  const root = remainder || word
  const rootWord = findRootInDict(root, dictMap)
  const rootMeaning = rootWord ? (dictMap[rootWord.toLowerCase()]?.meanings?.[0] || '') : ''
  return { affixes, root, rootWord, rootMeaning, known: !!rootWord }
}

export default function MorphologySection({ word, onClose }) {
  const app = useApp()
  const dictMap = useMemo(() => buildDictMap(), [])
  const [result, setResult] = useState(null)

  useEffect(() => {
    setResult(analyze(word, dictMap))
  }, [word, dictMap])

  // 实时分词预览（功能 3.4）
  const segs = useMemo(() => thaiSegment(word, dictMap), [word, dictMap])

  if (!result) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><X size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>词形分析</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{word}</div>
          <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 4 }}>形态拆解与词根解析</div>
        </Card>

        {/* 词缀 */}
        {result.affixes.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--c-teal)', marginBottom: 8 }}>识别到的词缀</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.affixes.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge color={a.type === 'prefix' ? 'var(--c-gold)' : 'var(--c-info)'}>{a.type === 'prefix' ? '前缀' : '后缀'}</Badge>
                  <span style={{ fontFamily: 'var(--th-font)', fontSize: 16, color: 'var(--c-p800)' }}>{a.text}</span>
                  <ArrowRight size={14} color="var(--c-s500)" />
                  <span style={{ fontSize: 13, color: 'var(--c-p600)' }}>{a.meaning}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 词根 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--c-rose)', marginBottom: 8 }}>推测词根</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--th-font)', fontSize: 20, fontWeight: 600, color: 'var(--c-p800)' }}>{result.root}</div>
              {result.known && result.rootMeaning && (
                <div style={{ fontSize: 14, color: 'var(--c-p600)', marginTop: 2 }}>{result.rootMeaning}</div>
              )}
              {!result.known && <div style={{ fontSize: 13, color: 'var(--c-p500)', marginTop: 2 }}>（未匹配到词典词根，建议人工核对）</div>}
            </div>
            {result.rootWord && (
              <button
                onClick={() => { onClose(); app.handleWordTap(result.rootWord) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-teal)', color: 'var(--c-teal)', background: 'transparent', fontSize: 13, fontWeight: 600 }}
              >
                <Search size={14} /> 查词根
              </button>
            )}
          </div>
        </Card>

        {/* 分词预览（功能 3.4） */}
        <Card>
          <div style={{ fontSize: 12, color: 'var(--c-info)', marginBottom: 8 }}>分词预览</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {segs.map((s, i) => (
              <span key={i} style={{ background: 'var(--c-p100)', borderRadius: 8, padding: '4px 10px', fontFamily: 'var(--th-font)', fontSize: 14, color: 'var(--c-p800)' }}>
                {s.text}
                {s.meaning ? <span style={{ color: 'var(--c-p500)', marginLeft: 4, fontSize: 12 }}>· {s.meaning}</span> : null}
              </span>
            ))}
          </div>
        </Card>

        <div style={{ textAlign: 'center', color: 'var(--c-s500)', fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
          词形分析基于本地启发式词缀表，仅供参考。<br />复杂复合词建议结合词典人工确认。
        </div>
      </div>
    </div>
  )
}
