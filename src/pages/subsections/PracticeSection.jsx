import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Play, Check, X, RotateCcw, Volume2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getBookmarks, getWordByThai, savePracticeRecord, recordWrongWord } from '../../lib/db/index.js'
import { getGlobal } from '../../lib/mock/store.js'
import { speak } from '../../utils/tts.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

const PRESET = ['กิน', 'ไป', 'ดี', 'น้ำ', 'อาหาร', 'ข้าว', 'ชอบ', 'เรียน', 'บ้าน', 'คน', 'วัน', 'ภาษาไทย', 'รัก', 'ใหม่', 'แพง', 'สวัสดี']
const Q_COUNT = 5

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PracticeSection({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const [phase, setPhase] = useState('start') // start | quiz | result
  const [mode, setMode] = useState('th_zh')
  const [pool, setPool] = useState([])
  const [loading, setLoading] = useState(false)
  const [qIndex, setQIndex] = useState(0)
  const [current, setCurrent] = useState(null)
  const [picked, setPicked] = useState(null)
  const [correct, setCorrect] = useState(0)
  const [wrongWords, setWrongWords] = useState([])

  const buildPool = useCallback(async () => {
    const list = []
    const seen = new Set()
    const add = (row) => {
      if (!row) return
      const meaning = (row.senses && row.senses[0] && row.senses[0].meaning) || ''
      if (!meaning || seen.has(row.word)) return
      seen.add(row.word)
      list.push({ word: row.word, meaning })
    }
    const bms = userId ? await getBookmarks(userId) : []
    for (const b of bms) {
      if (list.length >= 30) break
      add(await getWordByThai(b.word))
    }
    // 补全：preset 词（mock 词典必含，real 视词典而定）
    for (const w of PRESET) {
      if (list.length >= 30) break
      if (seen.has(w)) continue
      add(await getWordByThai(w))
    }
    return list
  }, [userId])

  const start = async (m) => {
    setLoading(true)
    setMode(m)
    const p = await buildPool()
    if (p.length < 4) {
      toast('题库词量不足，先去收藏一些单词吧')
      setLoading(false)
      return
    }
    setPool(p)
    setCorrect(0)
    setWrongWords([])
    setQIndex(0)
    setCurrent(makeQuestion(p, m))
    setPhase('quiz')
    setLoading(false)
  }

  const makeQuestion = (p, m) => {
    const target = p[Math.floor(Math.random() * p.length)]
    const others = shuffle(p.filter((x) => x.word !== target.word)).slice(0, 3)
    let options
    if (m === 'th_zh') {
      options = shuffle([target, ...others]).map((x) => ({ label: x.meaning, word: x.word, isCorrect: x.word === target.word }))
      return { prompt: target.word, promptLang: 'th', options }
    } else {
      options = shuffle([target, ...others]).map((x) => ({ label: x.word, word: x.word, isCorrect: x.word === target.word }))
      return { prompt: target.meaning, promptLang: 'zh', options }
    }
  }

  const onPick = async (opt) => {
    if (picked) return
    setPicked(opt)
    if (opt.isCorrect) {
      setCorrect((c) => c + 1)
    } else {
      const wrong = current.options.find((o) => o.isCorrect)?.word
      setWrongWords((w) => [...w, wrong])
      if (userId) await recordWrongWord(userId, wrong)
    }
  }

  const next = async () => {
    if (qIndex + 1 >= Q_COUNT) {
      // 保存记录
      if (userId) {
        await savePracticeRecord(userId, {
          mode,
          correct_count: correct + (picked?.isCorrect ? 1 : 0),
          total_count: Q_COUNT,
          duration_seconds: 0,
        })
      }
      setPhase('result')
    } else {
      setQIndex((i) => i + 1)
      setPicked(null)
      setCurrent(makeQuestion(pool, mode))
    }
  }

  const finalCorrect = correct + (picked?.isCorrect && qIndex + 1 >= Q_COUNT ? 1 : 0)

  if (phase === 'start') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header onClose={onClose} title="练习测验" />
        <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 15, color: 'var(--c-p600)' }}>选择练习模式，共 {Q_COUNT} 题</div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ModeBtn onClick={() => !loading && start('th_zh')} disabled={loading} title="泰语 → 中文" desc="看泰文选正确中文释义" />
            <ModeBtn onClick={() => !loading && start('zh_th')} disabled={loading} title="中文 → 泰语" desc="看中文选正确泰文" />
          </div>
          {loading && <div style={{ textAlign: 'center', marginTop: 16 }}><Spinner /></div>}
        </div>
      </div>
    )
  }

  if (phase === 'quiz' && current) {
    const rate = 1.0
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header onClose={onClose} title={`练习 ${qIndex + 1}/${Q_COUNT}`} />
        <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: 22 }}>
            {mode === 'th_zh' ? (
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{current.prompt}</div>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-p800)' }}>{current.prompt}</div>
            )}
            {mode === 'th_zh' && (
              <button onClick={() => speak(current.prompt, { rate, lang: 'th-TH' })} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--c-teal)', fontSize: 13, background: 'none' }}>
                <Volume2 size={14} /> 朗读
              </button>
            )}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.options.map((opt, i) => {
              const isPicked = picked && picked.word === opt.word
              const showCorrect = picked && opt.isCorrect
              const showWrong = isPicked && !opt.isCorrect
              const bg = showCorrect ? 'color-mix(in srgb, var(--c-teal) 18%, transparent)' : showWrong ? 'color-mix(in srgb, var(--c-rose) 18%, transparent)' : 'var(--c-surface)'
              const border = showCorrect ? 'var(--c-teal)' : showWrong ? 'var(--c-rose)' : 'var(--c-p200)'
              return (
                <button
                  key={i}
                  onClick={() => onPick(opt)}
                  disabled={!!picked}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, border: '1px solid ' + border, background: bg, fontSize: 15, color: 'var(--c-p800)', cursor: picked ? 'default' : 'pointer' }}
                >
                  <span>{opt.label}</span>
                  {showCorrect && <Check size={18} color="var(--c-teal)" />}
                  {showWrong && <X size={18} color="var(--c-rose)" />}
                </button>
              )
            })}
          </div>

          {picked && (
            <Btn onClick={next} style={{ width: '100%', marginTop: 18 }}>
              {qIndex + 1 >= Q_COUNT ? '查看结果' : '下一题'}
            </Btn>
          )}
        </div>
      </div>
    )
  }

  // result
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header onClose={onClose} title="练习结果" />
      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 14, textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--c-teal)' }}>{finalCorrect}/{Q_COUNT}</div>
          <div style={{ fontSize: 14, color: 'var(--c-p600)', marginTop: 4 }}>
            正确率 {Math.round((finalCorrect / Q_COUNT) * 100)}%
          </div>
        </Card>
        {wrongWords.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-rose)', marginBottom: 6 }}>错题回顾</div>
            {wrongWords.map((w, i) => (
              <div key={i} style={{ fontFamily: 'var(--th-font)', fontSize: 15, color: 'var(--c-p700)', padding: '3px 0' }}>{w}</div>
            ))}
          </Card>
        )}
        <Btn onClick={() => start(mode)} style={{ width: '100%', marginBottom: 10 }}><RotateCcw size={16} /> 再来一次</Btn>
      </div>
    </div>
  )
}

function Header({ onClose, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
      <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{title}</div>
      <div style={{ width: 38 }} />
    </div>
  )
}

function ModeBtn({ onClick, disabled, title, desc }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 14, border: '1px solid var(--c-p200)', background: 'var(--c-surface)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, textAlign: 'left' }}>
      <Play size={18} color="var(--c-teal)" />
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{desc}</div>
      </div>
    </button>
  )
}
