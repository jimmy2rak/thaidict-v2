import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, Clock, Target } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getLearningPlan, saveLearningPlan } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

const WEEK = [
  { v: 1, l: '一' },
  { v: 2, l: '二' },
  { v: 3, l: '三' },
  { v: 4, l: '四' },
  { v: 5, l: '五' },
  { v: 6, l: '六' },
  { v: 7, l: '日' },
]

export default function AdjustPlanSection({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dailyWords, setDailyWords] = useState(10)
  const [dailyMinutes, setDailyMinutes] = useState(15)
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6, 7])
  const [reminderTime, setReminderTime] = useState('20:00')

  useEffect(() => {
    if (!userId) return setLoading(false)
    getLearningPlan(userId).then((p) => {
      if (p) {
        setDailyWords(p.daily_words ?? 10)
        setDailyMinutes(p.daily_minutes ?? 15)
        setDays(p.plan_days?.length ? p.plan_days : [1, 2, 3, 4, 5, 6, 7])
        setReminderTime(p.reminder_time || '20:00')
      }
      setLoading(false)
    })
  }, [userId])

  const toggleDay = (v) => {
    setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort((a, b) => a - b)))
  }

  const onSave = async () => {
    if (!userId) return
    setSaving(true)
    await saveLearningPlan(userId, {
      daily_words: Number(dailyWords) || 0,
      daily_minutes: Number(dailyMinutes) || 0,
      plan_days: days,
      reminder_time: reminderTime,
    })
    setSaving(false)
    toast('学习计划已保存')
    onClose && onClose()
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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>调整学习计划</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Target size={16} color="var(--c-teal)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>每日目标</span>
          </div>
          <Field label="每日新词数">
            <input type="number" min="0" value={dailyWords} onChange={(e) => setDailyWords(e.target.value)} style={numInput} />
          </Field>
          <Field label="每日学习分钟">
            <input type="number" min="0" value={dailyMinutes} onChange={(e) => setDailyMinutes(e.target.value)} style={numInput} />
          </Field>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)', marginBottom: 10 }}>每周学习日</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {WEEK.map((d) => {
              const active = days.includes(d.v)
              return (
                <button
                  key={d.v}
                  onClick={() => toggleDay(d.v)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: '1px solid ' + (active ? 'var(--c-teal)' : 'var(--c-p200)'),
                    background: active ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
                    color: active ? 'var(--c-teal)' : 'var(--c-p500)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {d.l}
                </button>
              )
            })}
          </div>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Clock size={16} color="var(--c-gold)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>提醒时间</span>
          </div>
          <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} style={numInput} />
        </Card>

        <Btn onClick={onSave} disabled={saving} style={{ width: '100%' }}>
          <Save size={16} /> {saving ? '保存中…' : '保存计划'}
        </Btn>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--c-p600)' }}>{label}</span>
      {children}
    </div>
  )
}

const numInput = {
  width: 110,
  padding: '8px 12px',
  border: '1px solid var(--c-p200)',
  borderRadius: 10,
  fontSize: 14,
  background: 'var(--c-bg)',
  color: 'var(--c-p800)',
  outline: 'none',
  textAlign: 'right',
}
