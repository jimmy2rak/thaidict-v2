import React, { useState, useEffect } from 'react'
import { ArrowLeft, Bell, BellOff, Send } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getUserSettings, saveUserSettings } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

const FREQ = [
  { v: 'daily', l: '每天' },
  { v: 'weekly', l: '每周' },
  { v: 'custom', l: '自定义' },
]

// 输入校验（Bug F-3）：HH:MM，小时 00-23，分钟 00-59
function validateTime(t) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
}

export default function ReminderPage({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('20:00')
  const [freq, setFreq] = useState('daily')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!userId) return setLoading(false)
    getUserSettings(userId).then((s) => {
      setEnabled(!!s.reminder_enabled)
      setTime(s.reminder_time || '20:00')
      setFreq(s.reminder_frequency || 'daily')
      setLoading(false)
    })
  }, [userId])

  const onSave = async () => {
    if (!validateTime(time)) {
      setErr('时间格式应为 HH:MM（如 20:00）')
      return
    }
    setErr('')
    setSaving(true)
    await saveUserSettings(userId, { reminder_enabled: enabled, reminder_time: time, reminder_frequency: freq })
    setSaving(false)
    toast('提醒设置已保存')
  }

  const onTest = () => {
    if (!validateTime(time)) {
      setErr('请先填写有效时间')
      return
    }
    setErr('')
    // 模拟发送（真实模式由 pg_cron 调度 + send-reminder Edge Function，上线配置）
    toast('测试提醒已发送（模拟）')
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>学习提醒</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enabled ? <Bell size={18} color="var(--c-gold)" /> : <BellOff size={18} color="var(--c-s500)" />}
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>开启每日提醒</span>
            </div>
            <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} />
          </div>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>提醒时间</div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled}
            style={{ ...numInput, opacity: enabled ? 1 : 0.5 }}
          />
          {err ? <div style={{ fontSize: 12, color: 'var(--c-rose)', marginTop: 6 }}>{err}</div> : null}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>提醒频率</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {FREQ.map((f) => (
              <button
                key={f.v}
                onClick={() => setFreq(f.v)}
                disabled={!enabled}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: '1px solid ' + (freq === f.v ? 'var(--c-teal)' : 'var(--c-p200)'),
                  background: freq === f.v ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
                  color: freq === f.v ? 'var(--c-teal)' : 'var(--c-p500)',
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                {f.l}
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onTest} disabled={!enabled} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 12, border: '1px solid var(--c-info)', color: 'var(--c-info)', background: 'transparent', fontSize: 14, fontWeight: 600, opacity: enabled ? 1 : 0.5 }}>
            <Send size={15} /> 测试发送
          </button>
          <Btn onClick={onSave} disabled={saving} style={{ flex: 1 }}>{saving ? '保存中…' : '保存'}</Btn>
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-s500)', marginTop: 14, lineHeight: 1.6, textAlign: 'center' }}>
          本地为模拟提醒；上线后由 pg_cron 定时调度并调用 send-reminder 边缘函数
        </div>
      </div>
    </div>
  )
}

function Switch({ checked, onChange }) {
  return (
    <button onClick={onChange} style={{ width: 46, height: 26, borderRadius: 999, background: checked ? 'var(--c-teal)' : 'var(--c-p200)', position: 'relative', transition: 'background 0.2s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

const numInput = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--c-p200)', borderRadius: 10,
  fontSize: 15, background: 'var(--c-bg)', color: 'var(--c-p800)', outline: 'none',
}
