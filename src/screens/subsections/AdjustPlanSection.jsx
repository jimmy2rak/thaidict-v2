import React, { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, X, Sparkles, Flame, Plus, Check, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  getCheckinTasks, getCheckinCompletions, createCheckinTask, updateCheckinTask, deleteCheckinTask,
  getStreak,
  getActiveAiApi,
} from '../../lib/db/index.js'
import { callAiProxy } from '../../lib/ai-proxy.js'
import { getTodayCST, getCSTWeekday } from '../../lib/utils.js'
import { TASK_TYPES, typeLabels } from '../../lib/taskTypes.js'
import { IconButton, Card, Spinner, Badge, AsyncBadge } from '../../components/UIComponents.jsx'
import { loadCache, saveCache } from '../../lib/asyncCache.js'

const WEEK = [
  { v: 1, l: '一' }, { v: 2, l: '二' }, { v: 3, l: '三' }, { v: 4, l: '四' },
  { v: 5, l: '五' }, { v: 6, l: '六' }, { v: 7, l: '日' },
]
const WEEKDAY_LABEL = { 1: '星期一', 2: '星期二', 3: '星期三', 4: '星期四', 5: '星期五', 6: '星期六', 7: '星期日' }
const DURATIONS = [5, 10, 15, 20, 30, 45, 60]

export default function AdjustPlanSection({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const CACHE_KEY = 'adjust_plan'
  const cachedTasks = loadCache(CACHE_KEY)
  const [loading, setLoading] = useState(!cachedTasks)
  const [tasks, setTasks] = useState(cachedTasks || [])
  const [bgLoading, setBgLoading] = useState(false)

  // 今日数据卡片
  const [dateLabel, setDateLabel] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [streak, setStreak] = useState(0)

  // 任务表单（新增 / 编辑共用）
  const [editingId, setEditingId] = useState(null)
  const [selectedTypes, setSelectedTypes] = useState(['word'])
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [duration, setDuration] = useState(15)

  // AI 推荐
  const [aiPreview, setAiPreview] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const load = async () => {
    if (!userId) return setLoading(false)
    setBgLoading(true)
    const today = getTodayCST()
    const weekday = getCSTWeekday()
    const all = await getCheckinTasks(userId)
    const completed = await getCheckinCompletions(userId, today)
    const todayTasks = all.filter((t) => (t.plan_days || []).includes(weekday))
    const [y, m, d] = today.split('-')
    setDateLabel(`${y}年${Number(m)}月${Number(d)}日 ${WEEKDAY_LABEL[weekday]}`)
    setDoneCount(todayTasks.filter((t) => completed.includes(t.id)).length)
    setTotalCount(todayTasks.length)
    setStreak(await getStreak(userId))
    setTasks(all)
    setLoading(false)
    setBgLoading(false)
    saveCache(CACHE_KEY, all)
  }
  useEffect(() => { load() }, [userId]) // eslint-disable-line

  const resetForm = () => {
    setEditingId(null)
    setSelectedTypes(['word'])
    setCustomOpen(false)
    setCustomName('')
    setName('')
    setDays([1, 2, 3, 4, 5])
    setDuration(15)
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setSelectedTypes(t.task_types && t.task_types.length ? [...t.task_types] : [t.task_type || 'word'])
    setName(t.name)
    setDays(t.plan_days && t.plan_days.length ? [...t.plan_days] : [1, 2, 3, 4, 5])
    setDuration(t.duration_minutes || 15)
    window.scrollTo({ top: 9999, behavior: 'smooth' })
  }

  const toggleType = (v) => {
    setSelectedTypes((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))
  }
  const confirmCustom = () => {
    const c = customName.trim()
    if (!c) return
    setSelectedTypes((s) => (s.includes(c) ? s : [...s, c]))
    setCustomName('')
    setCustomOpen(false)
  }
  const toggleDay = (v) => {
    setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort((a, b) => a - b)))
  }

  const submitForm = async () => {
    if (!userId) return
    if (!name.trim()) return toast('请填写任务名称')
    let types = selectedTypes.filter(Boolean)
    if (types.length === 0) types = ['word']
    const payload = {
      name: name.trim(),
      task_types: types,
      duration_minutes: Number(duration) || 15,
      plan_days: days.length ? days : [1, 2, 3, 4, 5],
    }
    if (editingId) {
      await updateCheckinTask(userId, editingId, payload)
      toast('已更新打卡任务')
    } else {
      await createCheckinTask(userId, payload)
      toast('已添加打卡任务')
    }
    resetForm()
    setTasks(await getCheckinTasks(userId))
  }

  const removeTask = async (id) => {
    if (!userId) return
    await deleteCheckinTask(userId, id)
    toast('已删除打卡任务')
    if (editingId === id) resetForm()
    setTasks(await getCheckinTasks(userId))
  }

  // ---------- AI 推荐 ----------
  const generateAI = async () => {
    if (!userId) return toast('请先登录')
    setAiLoading(true)
    try {
      const userApi = await getActiveAiApi(userId)
      const current = tasks.map((t) => ({ name: t.name, task_types: t.task_types || [t.task_type], duration_minutes: t.duration_minutes, plan_days: t.plan_days }))
      const prompt = `你是一位泰语学习规划师。请根据我的水平和时间，为我制定一份每日泰语打卡计划${current.length ? '，避免与现有任务重复' : ''}。每个计划项必须包含：name（任务名称）, task_types（学习类型数组，可选：word/grammar/reading/listening/speaking/writing 或自定义字符串）, duration_minutes（预计时长，数字）, plan_days（每周重复日，1=周一…7=周日，数组）。请直接返回 JSON 数组，不要多余解释。格式示例：[{"name":"背诵泰语单词","task_types":["word"],"duration_minutes":15,"plan_days":[1,2,3,4,5,6,7]}]${current.length ? '\n现有任务：' + JSON.stringify(current) : ''}`
      const { data, error } = await callAiProxy(prompt, userApi)
      if (error || !data) {
        toast('AI 生成计划失败：' + (error || '未知错误'))
        setAiLoading(false)
        return
      }
      let plan
      try {
        plan = typeof data === 'string' ? JSON.parse(data) : data
        if (!Array.isArray(plan)) plan = [plan]
      } catch (e) {
        toast('AI 返回格式无法解析')
        console.error('[AI plan parse]', e)
        setAiLoading(false)
        return
      }
      setAiPreview(plan.map((r) => ({
        name: r.name || '未命名任务',
        task_types: Array.isArray(r.task_types) && r.task_types.length ? r.task_types : [r.task_type || 'word'],
        duration_minutes: Number(r.duration_minutes) || 15,
        plan_days: Array.isArray(r.plan_days) && r.plan_days.length ? r.plan_days : [1, 2, 3, 4, 5],
      })))
      toast('AI 推荐计划已生成')
    } catch (e) {
      console.error('[generateAI]', e)
      toast('AI 生成计划失败')
    }
    setAiLoading(false)
  }
  const applyAI = async () => {
    if (!userId || !aiPreview) return
    for (const r of aiPreview) {
      await createCheckinTask(userId, {
        name: r.name, task_types: r.task_types,
        duration_minutes: r.duration_minutes, plan_days: r.plan_days,
      })
    }
    toast('已应用 AI 推荐计划')
    setAiPreview(null)
    setTasks(await getCheckinTasks(userId))
  }
  const copyPrompt = async () => {
    const prompt = '你是一位泰语学习规划师。请根据初学者水平，为我制定一份每日打卡计划，包含：单词背诵、语法练习、阅读、听力、口语、写作，并给出各项的学习类型（task_types，可多选：word/grammar/reading/listening/speaking/writing）与预计时长（duration_minutes，分钟）以及每周重复日（plan_days，1=周一…7=周日）。请以 JSON 数组返回，格式：[{"name":"复习泰语基础词汇","task_types":["word"],"duration_minutes":15,"plan_days":[1,2,3,4,5,6,7]}]。'
    try {
      await navigator.clipboard.writeText(prompt)
      toast('Prompt 已复制到剪贴板')
    } catch {
      toast('复制失败，请手动复制')
    }
  }
  const applyImport = async () => {
    if (!userId) return
    let arr
    try { arr = JSON.parse(importText) } catch { return toast('JSON 解析失败') }
    if (!Array.isArray(arr)) return toast('请粘贴数组格式')
    let n = 0
    for (const r of arr) {
      if (!r || !r.name) continue
      const types = Array.isArray(r.task_types) && r.task_types.length ? r.task_types : [r.task_type || 'word']
      await createCheckinTask(userId, {
        name: r.name, task_types: types,
        duration_minutes: Number(r.duration_minutes) || 15,
        plan_days: Array.isArray(r.plan_days) && r.plan_days.length ? r.plan_days : [1, 2, 3, 4, 5],
      })
      n++
    }
    toast(`已导入 ${n} 个任务`)
    setImportOpen(false)
    setImportText('')
    setTasks(await getCheckinTasks(userId))
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
      {/* 顶部导航区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>调整学习计划</div>
        <div style={{ width: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <AsyncBadge loading={bgLoading} />
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 14 }}>
        {/* 今日数据卡片 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 6 }}>{dateLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{doneCount}/{totalCount} 项已完成</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: 'var(--c-gold)' }}>
              <Flame size={16} /> {streak}天
            </span>
          </div>
        </Card>

        {/* 已有任务条目 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          {tasks.map((t) => (
            <Card key={t.id} onClick={() => startEdit(t)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--c-p300)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                    <Badge color="var(--c-primary)">{typeLabels(t.task_types || [t.task_type])}</Badge>
                    <span style={{ fontSize: 11, color: 'var(--c-p500)' }}>{t.duration_minutes}分钟</span>
                    <span style={{ fontSize: 11, color: 'var(--c-p500)' }}>{formatDays(t.plan_days)}</span>
                  </div>
                </div>
                <IconButton onClick={(e) => { e.stopPropagation(); removeTask(t.id) }} title="删除" style={{ width: 30, height: 30 }}>
                  <Trash2 size={16} color="var(--c-rose)" />
                </IconButton>
              </div>
            </Card>
          ))}
          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--c-p500)', fontSize: 13, padding: '16px 0' }}>还没有打卡任务，在下方添加一个吧</div>
          )}
        </div>

        {/* 分割线 · 添加新任务 */}
        <Divider text="添加新任务" />

        {/* 新增任务表单卡片 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)', marginBottom: 10 }}>
            {editingId ? '编辑任务' : '添加新任务'}
          </div>

          <Label>学习类型</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TASK_TYPES.map((t) => {
              const active = selectedTypes.includes(t.v)
              return (
                <button key={t.v} onClick={() => toggleType(t.v)} style={chipStyle(active)}>
                  {active ? '●' : '○'} {t.l}
                </button>
              )
            })}
            <button
              onClick={() => setCustomOpen((o) => !o)}
              style={chipStyle(selectedTypes.some((x) => !TASK_TYPES.find((tt) => tt.v === x)))}
            >
              ⊕ 自定义
            </button>
          </div>
          {customOpen && (
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCustom()}
              onBlur={confirmCustom}
              placeholder="输入自定义类型，如：配音"
              style={{ ...inp, marginTop: 6, fontSize: 13 }}
              autoFocus
            />
          )}

          <Label>任务名称</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 复习泰语基础词汇"
            style={inp}
          />

          <Label>重复日</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {WEEK.map((d) => {
              const active = days.includes(d.v)
              return (
                <button
                  key={d.v}
                  onClick={() => toggleDay(d.v)}
                  style={{
                    flex: 1, aspectRatio: '1 / 1', borderRadius: '50%', border: '2px solid ' + (active ? 'var(--c-primary)' : 'var(--c-p200)'),
                    background: active ? 'var(--c-primary)' : 'var(--c-surface)',
                    color: active ? '#fff' : 'var(--c-p500)', fontSize: 12, fontWeight: 700,
                  }}
                >
                  {d.l}
                </button>
              )
            })}
          </div>

          <Label>预计时长</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DURATIONS.map((m) => {
              const active = duration === m
              return (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid ' + (active ? 'var(--c-primary)' : 'var(--c-p200)'),
                    background: active ? 'color-mix(in srgb, var(--c-primary) 14%, transparent)' : 'var(--c-surface)',
                    color: active ? 'var(--c-primary)' : 'var(--c-p600)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  {m}分钟
                </button>
              )
            })}
          </div>

          <button onClick={submitForm} style={{
            width: '100%', marginTop: 14, padding: '11px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--c-p200)', color: 'var(--c-p700)', fontSize: 14, fontWeight: 700,
          }}>
            {editingId ? '保存修改' : '添加任务'}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{
              width: '100%', marginTop: 8, padding: '9px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--c-p200)', background: 'transparent', color: 'var(--c-p600)', fontSize: 13, fontWeight: 600,
            }}>
              取消编辑
            </button>
          )}
        </Card>

        {/* 分割线 · AI推荐 */}
        <Divider text="AI推荐" />

        {/* AI智能推荐卡片 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={16} color="var(--c-primary)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>AI智能推荐</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-p500)', marginBottom: 10, lineHeight: 1.5 }}>
            根据你的水平和时间，AI为你定制最优打卡计划
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={generateAI} disabled={aiLoading} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--c-primary)', color: '#fff', fontSize: 13, fontWeight: 700,
              opacity: aiLoading ? 0.7 : 1,
            }}>
              {aiLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {aiLoading ? '生成中…' : 'AI生成计划'}
            </button>
            <button onClick={() => setImportOpen((o) => !o)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-p300)',
              background: 'transparent', color: 'var(--c-p700)', fontSize: 13, fontWeight: 600,
            }}>
              导入外部计划
            </button>
          </div>
          <button onClick={copyPrompt} style={{
            width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--c-p200)', background: 'transparent', color: 'var(--c-p500)', fontSize: 11, fontWeight: 600,
          }}>
            复制Prompt到外部AI
          </button>

          {aiPreview && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-p100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-p800)', marginBottom: 6 }}>推荐计划预览</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {aiPreview.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--c-p600)', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--c-primary)', fontWeight: 700 }}>{i + 1}.</span>
                    <span>{r.name} · {typeLabels(r.task_types)} · {r.duration_minutes}分钟 · {formatDays(r.plan_days)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={applyAI} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'var(--c-primary)', color: '#fff', fontSize: 13, fontWeight: 700,
                }}>应用推荐计划</button>
                <button onClick={() => setAiPreview(null)} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-p200)',
                  background: 'transparent', color: 'var(--c-p600)', fontSize: 13, fontWeight: 600,
                }}>取消</button>
              </div>
            </div>
          )}

          {importOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-p100)' }}>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='粘贴 JSON 计划数组，如：[{"name":"背单词","task_types":["word"],"duration_minutes":15,"plan_days":[1,2,3,4,5]}]'
                style={{ ...inp, minHeight: 88, fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={applyImport} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'var(--c-primary)', color: '#fff', fontSize: 13, fontWeight: 700,
                }}>导入并创建</button>
                <button onClick={() => { setImportOpen(false); setImportText('') }} style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-p200)',
                  background: 'transparent', color: 'var(--c-p600)', fontSize: 13, fontWeight: 600,
                }}>取消</button>
              </div>
            </div>
          )}
        </Card>

        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}

function Divider({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-p200)' }} />
      <span style={{ fontSize: 11, color: 'var(--c-p500)', whiteSpace: 'nowrap' }}>· {text} ·</span>
      <div style={{ flex: 1, height: 1, background: 'var(--c-p200)' }} />
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--c-p600)', margin: '10px 0 6px', fontWeight: 600 }}>{children}</div>
}

function chipStyle(active) {
  return {
    padding: '7px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid ' + (active ? 'var(--c-primary)' : 'var(--c-p200)'),
    background: active ? 'color-mix(in srgb, var(--c-primary) 14%, transparent)' : 'var(--c-surface)',
    color: active ? 'var(--c-primary)' : 'var(--c-p600)', fontSize: 12, fontWeight: 600,
  }
}

function formatDays(arr) {
  if (!arr || arr.length === 0) return '未安排'
  if (arr.length === 7) return '每天'
  const map = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }
  return arr.map((v) => map[v]).join(' ')
}

function recommendedPlan() {
  return [
    { name: '背诵新单词', task_types: ['word'], duration_minutes: 15, plan_days: [1, 2, 3, 4, 5, 6, 7] },
    { name: '语法专项练习', task_types: ['grammar'], duration_minutes: 10, plan_days: [2, 4, 6] },
    { name: '泰语阅读训练', task_types: ['reading'], duration_minutes: 15, plan_days: [1, 3, 5] },
    { name: '听力磨耳朵', task_types: ['listening'], duration_minutes: 10, plan_days: [1, 2, 3, 4, 5] },
    { name: '口语跟读', task_types: ['speaking'], duration_minutes: 10, plan_days: [3, 5, 7] },
  ]
}

const inp = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--c-p200)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--c-surface)',
  color: 'var(--c-p800)',
  outline: 'none',
  fontSize: 14,
}
