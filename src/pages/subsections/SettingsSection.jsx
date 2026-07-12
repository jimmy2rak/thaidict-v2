import React, { useState, useEffect } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getUserSettings, saveUserSettings, CHINESE_FONTS, THAI_FONTS } from '../../lib/db/index.js'
import { IconButton, Card, Spinner } from '../../components/UIComponents.jsx'

const COLOR_MODES = [
  { v: 'light', l: '浅色' },
  { v: 'dark', l: '深色' },
  { v: 'system', l: '跟随系统' },
]
const FONT_SIZES = [
  { v: 'small', l: '小' },
  { v: 'medium', l: '中' },
  { v: 'large', l: '大' },
]
const DIRS = [
  { v: 'th_to_zh', l: '泰 → 中' },
  { v: 'zh_to_th', l: '中 → 泰' },
]

export default function SettingsSection({ onClose }) {
  const app = useApp()
  const { userId, colorMode, setColorMode, toast, setChineseFont, setThaiFont } = app
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState(1.0)
  const [fontSize, setFontSize] = useState('medium')
  const [dir, setDir] = useState('th_to_zh')
  const [chineseFont, setChineseFontLocal] = useState('noto_sans_sc')
  const [thaiFont, setThaiFontLocal] = useState('noto_sans_thai')

  useEffect(() => {
    if (!userId) return setLoading(false)
    getUserSettings(userId).then((s) => {
      setRate(s.speech_rate ?? 1.0)
      setFontSize(s.font_size || 'medium')
      setDir(s.dict_direction || 'th_to_zh')
      setChineseFontLocal(s.chinese_font || 'noto_sans_sc')
      setThaiFontLocal(s.thai_font || 'noto_sans_thai')
      setLoading(false)
    })
  }, [userId])

  const save = async (patch) => {
    if (!userId) return
    const cur = { speech_rate: rate, font_size: fontSize, dict_direction: dir, ...patch }
    await saveUserSettings(userId, cur)
    toast('设置已保存')
  }

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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>通用设置</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>主题</div>
          <Seg options={COLOR_MODES} value={colorMode} onChange={setColorMode} />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>中文字体</div>
          <FontSelect
            options={CHINESE_FONTS}
            value={chineseFont}
            onChange={(v) => {
              setChineseFontLocal(v)
              setChineseFont(v)
              save({ chinese_font: v })
            }}
          />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>泰语字体</div>
          <FontSelect
            options={THAI_FONTS}
            value={thaiFont}
            onChange={(v) => {
              setThaiFontLocal(v)
              setThaiFont(v)
              save({ thai_font: v })
            }}
          />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>翻译方向</div>
          <Seg options={DIRS} value={dir} onChange={(v) => { setDir(v); save({ dict_direction: v }) }} />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>正文字号</div>
          <Seg options={FONT_SIZES} value={fontSize} onChange={(v) => { setFontSize(v); save({ font_size: v }) }} />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--c-p600)' }}>语音朗读速度</span>
            <span style={{ fontSize: 13, color: 'var(--c-teal)', fontWeight: 600 }}>{rate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            onMouseUp={() => save({ speech_rate: rate })}
            onTouchEnd={() => save({ speech_rate: rate })}
            style={{ width: '100%', accentColor: 'var(--c-teal)' }}
          />
        </Card>
      </div>
    </div>
  )
}

function FontSelect({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--c-p200)',
        background: 'var(--c-bg)',
        color: 'var(--c-p800)',
        fontSize: 14,
        outline: 'none',
      }}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  )
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '9px 0',
              borderRadius: 10,
              border: '1px solid ' + (active ? 'var(--c-teal)' : 'var(--c-p200)'),
              background: active ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
              color: active ? 'var(--c-teal)' : 'var(--c-p500)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {active && <Check size={13} />}
            {o.l}
          </button>
        )
      })}
    </div>
  )
}
