import React, { useState } from 'react'
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Btn, Card, Spinner } from '../components/UIComponents.jsx'

export default function UnknownWordPage({ word }) {
  const app = useApp()
  const { handleGenerated } = app
  const [zhHint, setZhHint] = useState('')
  const [generating, setGenerating] = useState(false)

  const onGenerate = async () => {
    setGenerating(true)
    await handleGenerated(word, zhHint)
    setGenerating(false)
  }

  return (
    <div className="scroll-y" style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => app.navigateTo({ type: 'close-unknown' })} style={{ background: 'none', border: 'none', color: 'var(--c-p600)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: 18, color: 'var(--c-p800)' }}>未知词条</h2>
      </div>

      <Card style={{ marginBottom: 16, textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)' }}>{word}</div>
        <div style={{ fontSize: 13, color: 'var(--c-p500)', marginTop: 6 }}>词典中未找到此词，可用 AI 生成词条</div>
      </Card>

      <label style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 6 }}>中文提示（可选）</label>
      <input
        value={zhHint}
        onChange={(e) => setZhHint(e.target.value)}
        placeholder="如：吃、去、你好…"
        style={{
          width: '100%',
          padding: '12px 14px',
          border: '1px solid var(--c-p200)',
          borderRadius: 12,
          fontSize: 15,
          background: 'var(--c-surface)',
          color: 'var(--c-p800)',
          outline: 'none',
          marginBottom: 16,
        }}
      />

      <Btn onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={16} className="spin" /> : (<><Sparkles size={16} /> AI 生成词条</>)}
      </Btn>
      {generating && <div style={{ textAlign: 'center', color: 'var(--c-p500)', fontSize: 12, marginTop: 10 }}>正在生成，请稍候…</div>}
    </div>
  )
}
