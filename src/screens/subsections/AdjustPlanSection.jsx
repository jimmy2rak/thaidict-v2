import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, Clock, Target, Plus, Trash2, X, Check, Pencil } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  getLearningPlan, saveLearningPlan,
  getCheckinTasks, createCheckinTask, updateCheckinTask, deleteCheckinTask,
} from '../../lib/db/index.js'
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
  const [tasks, setTasks] = useState([])
  const [plan, setPlan] = useState(null)

  // 计划表单
  const [dailyWords, setDailyWords] = useState(10)
  const [dailyMinutes, setDailyMinutes] = useState(15)
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6, 7])
  const [reminderTime, setReminderTime] = useState('20:00')

  // 任务编辑
  const [editing, setEditing] = useState(null) // null | 'new' | taskId
  const [draft, setDraft] = useState({ name: '', duration_minutes: 15, task_type: 'word', plan_days: [1, 2, 3, 4, 5, 6, 7] })

  const load = async () => {
    if (!userId) return setLoading(false)
    const [p, t] = await Promise.all([getLearningPlan(userId), getCheckinTasks(userId)])
    setPlan(p)
    if (p) {
      setDailyWords(p.daily_words ?? 10)
      setDailyMinutes(p.daily_minutes ?? 15)
      setDays(p.plan_days?.length ? p.plan_days : [1, 2, 3, 4, 5, 6, 7])
      setReminderTime(p.reminder_time || '20:00')
    }
    setTasks(t)
    setLoading(false)
  }
  useEffect(() => { load() }, [userId]) // eslint-disable-line

  const toggleDay = (v) => {
    setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort((a, b) => a - b)))
  }

  const onSavePlan = async () => {
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
  }

  const startNew = () => {
    setEditing('new')
    setDraft({ name: '', duration_minutes: 15, task_type: 'word', plan_days: [...days] })
  }

  const startEdit = (t) => {
    setEditing(t.id)
    setDraft({ name: t.name, duration_minutes: t.duration_minutes, task_type: t.task_type, plan_days: [...(t.plan_days || [])] })
  }

  const saveTask = async () => {
    if (!userId || !draft.name.trim()) return toast('请填写任务名称')
    const payload = {
      name: draft.name.trim(),
      duration_minutes: Number(draft.duration_minutes) || 10,
      task_type: draft.task_type || 'word',
      plan_days: draft.plan_days?.length ? draft.plan_days : [...days],
    }
    if (editing === 'new') {
      await createCheckinTask(userId, payload)
      toast('已添加打卡任务')
    } else {
      await updateCheckinTask(userId, editing, payload)
      toast('已更新打卡任务')
    }
    setEditing(null)
    setTasks(await getCheckinTasks(userId))
  }

  const removeTask = async (id) => {
    if (!userId) return
    await deleteCheckinTask(userId, id)
    toast('已删除打卡任务')
    setTasks(await getCheckinTasks(userId))
  }

  const toggleTaskDay = (v) => {
    setDraft((d) => ({
      ...d,
      plan_days: d.plan_days.includes(v) ? d.plan_days.filter((x) => x !== v).sort((a, b) => a - b) : [...d.plan_days, v].sort((a, b) => a - b),
    }))
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

      <div className="scroll-y" style={{ flex: 1, padding: 14 }}>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Target size={16} color="var(--c-teal)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>每日目标</span>
          </div>
          <Field label="每日新词数">
            <input type="number" min="0" value={dailyWords} onChange={(e) => setDailyWords(e.target.value)} style={numInput} />
          </Field>
          <Field label="每日学习分钟">
            <input type="number" min="0" value={dailyMinutes} onChange={(e) => setDailyMinutes(e.target.value)} style={numInput} />
          </Field>
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)', marginBottom: 10 }}>每周学习日</div>
          <DayPicker days={days} onToggle={toggleDay} />
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock size={16} color="var(--c-gold)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>提醒时间</span>
          </div>
          <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} style={numInput} />
        </Card>

        <Btn onClick={onSavePlan} disabled={saving} style={{ width: '100%', marginBottom: 14 }}>
          <Save size={16} /> {saving ? '保存中…' : '保存计划'}
        </Btn>

        {/* 打卡任务管理 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>打卡任务</span>
          <button onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-teal)', fontWeight: 600 }}>
            <Plus size={14} /> 新建任务
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {tasks.map((t) =>
            editing === t.id ? (
              <TaskEditor key={t.id} draft={draft} setDraft={setDraft} onSave={saveTask} onCancel={() => setEditing(null)} toggleDay={toggleTaskDay} />
            ) : (
              <Card key={t.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 2 }}>
                      {t.duration_minutes} 分钟 · {t.task_type === 'word' ? '单词' : '听力'} · {formatDays(t.plan_days)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <IconButton onClick={() => startEdit(t)} title="编辑" style={{ width: 30, height: 30 }}><Pencil size={15} /></IconButton>
                    <IconButton onClick={() => removeTask(t.id)} title="删除" style={{ width: 30, height: 30 }}><Trash2 size={16} color="var(--c-rose)" /></IconButton>
                  </div>
                </div>
              </Card>
            )
          )}
          {editing === 'new' && <TaskEditor draft={draft} setDraft={setDraft} onSave={saveTask} onCancel={() => setEditing(null)} toggleDay={toggleTaskDay} />}
          {tasks.length === 0 && editing !== 'new' && (
            <div style={{ textAlign: 'center', color: 'var(--c-p500)', fontSize: 13, padding: '16px 0' }}>还没有打卡任务，点右上角新建一个</div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskEditor({ draft, setDraft, onSave, onCancel, toggleDay }) {
  return (
    <Card style={{ background: 'var(--c-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="任务名称，如：背诵 20 个单词"
          style={{ ...inp, fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            min="1"
            value={draft.duration_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
            placeholder="分钟"
            style={{ ...inp, flex: 1, fontSize: 14 }}
          />
          <select
            value={draft.task_type}
            onChange={(e) => setDraft((d) => ({ ...d, task_type: e.target.value }))}
            style={{ ...inp, flex: 1, fontSize: 14 }}
          >
            <option value="word">单词</option>
            <option value="listening">听力</option>
            <option value="review">复习</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-p500)', marginBottom: 6 }}>安排在周几</div>
          <DayPicker days={draft.plan_days} onToggle={toggleDay} size="small" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Btn onClick={onSave} style={{ flex: 1 }}><Save size={14} /> 保存</Btn>
          <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--c-p200)', color: 'var(--c-p600)', background: 'var(--c-surface)', fontSize: 14, fontWeight: 600 }}>
            <X size={14} /> 取消
          </button>
        </div>
      </div>
    </Card>
  )
}

function DayPicker({ days, onToggle, size }) {
  const small = size === 'small'
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {WEEK.map((d) => {
        const active = days.includes(d.v)
        return (
          <button
            key={d.v}
            onClick={() => onToggle(d.v)}
            style={{
              flex: 1,
              padding: small ? '7px 0' : '9px 0',
              borderRadius: 10,
              border: '1px solid ' + (active ? 'var(--c-teal)' : 'var(--c-p200)'),
              background: active ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
              color: active ? 'var(--c-teal)' : 'var(--c-p500)',
              fontSize: small ? 12 : 13,
              fontWeight: 600,
            }}
          >
            {d.l}
          </button>
        )
      })}
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

function formatDays(arr) {
  if (!arr || arr.length === 0) return '未安排'
  if (arr.length === 7) return '每天'
  const map = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }
  return arr.map((v) => map[v]).join(' ')
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
const inp = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--c-p200)',
  borderRadius: 10,
  background: 'var(--c-surface)',
  color: 'var(--c-p800)',
  outline: 'none',
}
