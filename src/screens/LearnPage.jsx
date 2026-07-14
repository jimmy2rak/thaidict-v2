import React, { useState, useEffect } from 'react'
import {
  Dumbbell, Target, BookText, BarChart3, StickyNote, Award, CalendarClock, Check,
  Flame, Clock, CheckCircle2, Calendar, Zap,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  getCheckinTasks, getCheckinCompletions, toggleCheckinTaskCompletion,
  getStreak, getCheckinHeatmapData, getWeeklyStudyMinutes, getLearningPlan,
} from '../lib/db/index.js'
import { getCSTWeekday, getTodayCST } from '../lib/utils.js'
import { typeLabels } from '../lib/taskTypes.js'
import { Card, Spinner, EmptyState, Btn } from '../components/UIComponents.jsx'

import StatsSection from './subsections/StatsSection.jsx'
import PracticeSection from './subsections/PracticeSection.jsx'
import AdjustPlanSection from './subsections/AdjustPlanSection.jsx'
import NotesDetailSection from './subsections/NotesDetailSection.jsx'
import NoteEditorSection from './subsections/NoteEditorSection.jsx'
import DiaryList from './subsections/DiaryList.jsx'
import DiaryEditor from './subsections/DiaryEditor.jsx'
import DiaryDetail from './subsections/DiaryDetail.jsx'
import AchievementsSection from './subsections/AchievementsSection.jsx'

export default function LearnPage() {
  const app = useApp()
  const { userId } = app
  const [view, setView] = useState('main')
  const [notesEditor, setNotesEditor] = useState(null) // note object or null
  const [diaryView, setDiaryView] = useState({ mode: 'list', diary: null })

  if (view === 'stats') return <StatsSection onClose={() => setView('main')} />
  if (view === 'practice') return <PracticeSection onClose={() => setView('main')} />
  if (view === 'adjust') return <AdjustPlanSection onClose={() => setView('main')} />
  if (view === 'achievements') return <AchievementsSection onClose={() => setView('main')} />
  if (view === 'notes') {
    if (notesEditor) return <NoteEditorSection noteId={notesEditor.id} initialWord={notesEditor.word} onClose={() => setNotesEditor(null)} onSaved={() => setNotesEditor(null)} />
    return <NotesDetailSection onClose={() => setView('main')} onEdit={(n) => setNotesEditor(n)} />
  }
  if (view === 'diary') {
    if (diaryView.mode === 'detail') return <DiaryDetail diary={diaryView.diary} onClose={() => setDiaryView({ mode: 'list' })} onEdit={(d) => setDiaryView({ mode: 'editor', diary: d })} onDeleted={() => setDiaryView({ mode: 'list' })} />
    if (diaryView.mode === 'editor') return <DiaryEditor diaryId={diaryView.diary?.id} onClose={() => setDiaryView({ mode: 'list' })} onSaved={() => setDiaryView({ mode: 'list' })} />
    return <DiaryList onClose={() => setView('main')} onOpen={(d) => setDiaryView({ mode: 'detail', diary: d })} onNew={() => setDiaryView({ mode: 'editor', diary: null })} />
  }

  return <MainView userId={userId} setView={setView} />
}

function MainView({ userId, setView }) {
  const app = useApp()
  const { toast } = app
  const [tasks, setTasks] = useState(null)
  const [completed, setCompleted] = useState([])
  const [streak, setStreak] = useState(0)
  const [heatmap, setHeatmap] = useState([])
  const [weeklyMins, setWeeklyMins] = useState([0, 0, 0, 0, 0, 0, 0])
  const [plan, setPlan] = useState(null)
  const today = getTodayCST()
  const weekday = getCSTWeekday()

  const dateLabel = new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long',
  })

  const refresh = async () => {
    if (!userId) return
    const [t, c, s, h, wm, p] = await Promise.all([
      getCheckinTasks(userId),
      getCheckinCompletions(userId, today),
      getStreak(userId),
      getCheckinHeatmapData(userId, 7),
      getWeeklyStudyMinutes(userId),
      getLearningPlan(userId),
    ])
    setTasks(t)
    setCompleted(c)
    setStreak(s)
    setHeatmap(h)
    setWeeklyMins(wm)
    setPlan(p)
  }
  useEffect(() => { refresh() }, [userId]) // eslint-disable-line

  const todayTasks = (tasks || []).filter((t) => (t.plan_days || []).includes(weekday))
  const doneCount = todayTasks.filter((t) => completed.includes(t.id)).length
  const totalCount = todayTasks.length
  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
  const todayMins = todayTasks
    .filter((t) => completed.includes(t.id))
    .reduce((sum, t) => sum + (t.duration_minutes || 0), 0)
  const weeklyTotal = (weeklyMins || []).reduce((a, b) => a + (b || 0), 0)
  const weeklyGoal = (plan?.daily_minutes || 15) * 7

  const onToggle = async (task) => {
    const isDone = completed.includes(task.id)
    const c = await toggleCheckinTaskCompletion(userId, task.id, today, !isDone)
    setCompleted(c)
    setStreak(await getStreak(userId))
    setHeatmap(await getCheckinHeatmapData(userId, 7))
    setWeeklyMins(await getWeeklyStudyMinutes(userId))
  }

  const markAllDone = async () => {
    const undone = todayTasks.filter((t) => !completed.includes(t.id))
    if (undone.length === 0) return
    for (const t of undone) {
      await toggleCheckinTaskCompletion(userId, t.id, today, true)
    }
    setCompleted(await getCheckinCompletions(userId, today))
    setStreak(await getStreak(userId))
    setHeatmap(await getCheckinHeatmapData(userId, 7))
    setWeeklyMins(await getWeeklyStudyMinutes(userId))
    toast(`完成 ${undone.length} 项打卡，真棒！`)
  }

  const entries = [
    { key: 'practice', icon: Target, color: 'var(--c-teal)', label: '练习测验' },
    { key: 'diary', icon: BookText, color: 'var(--c-gold)', label: '学习日记' },
    { key: 'stats', icon: BarChart3, color: 'var(--c-info)', label: '学习统计' },
    { key: 'notes', icon: StickyNote, color: 'var(--c-rose)', label: '我的笔记' },
    { key: 'achievements', icon: Award, color: 'var(--c-amber)', label: '我的成就' },
    { key: 'adjust', icon: CalendarClock, color: 'var(--c-primary)', label: '调整计划' },
  ]

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '12px 14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Dumbbell size={20} color="var(--c-teal)" />
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-p800)' }}>学习中心</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-gold)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Flame size={14} /> 连续 {streak} 天
        </span>
      </div>

      {/* 今日打卡 */}
      <Card style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <ProgressRing percent={percent} color="var(--c-teal)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-p800)' }}>今日打卡</div>
            <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 1 }}>{dateLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--c-teal)', fontWeight: 600, marginTop: 4 }}>
              {doneCount}/{totalCount} 完成 · {todayMins} 分钟
            </div>
          </div>
        </div>

        {tasks === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
        ) : totalCount === 0 ? (
          <EmptyState icon="✅" text="今天没有安排打卡任务" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayTasks.map((t) => {
              const done = completed.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => onToggle(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-p200)',
                    background: 'var(--c-bg)', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', border: '2px solid ' + (done ? 'var(--c-teal)' : 'var(--c-p300)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--c-teal)' : 'transparent', flexShrink: 0,
                  }}>
                    {done && <Check size={14} color="#fff" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-p800)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-p500)' }}>{t.duration_minutes} 分钟 · {typeLabels(t.task_types || [t.task_type])}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {tasks !== null && totalCount > 0 && doneCount < totalCount && (
          <button onClick={markAllDone} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1.6px dashed var(--c-teal)', color: 'var(--c-teal)', background: 'transparent', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Zap size={14} /> 一键完成今日打卡
          </button>
        )}
      </Card>

      {/* 今日与本周数据 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <MiniStat icon={Clock} value={todayMins} label="今日分钟" color="var(--c-info)" />
        <MiniStat icon={CheckCircle2} value={doneCount} label="已打卡" color="var(--c-teal)" />
        <MiniStat icon={Calendar} value={weeklyTotal} label="本周分钟" color="var(--c-gold)" />
      </div>

      {/* 近 7 天热力条 */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-p800)' }}>近 7 天打卡</span>
          <span style={{ fontSize: 11, color: 'var(--c-p500)' }}>目标 {weeklyGoal} 分钟</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48 }}>
          {(heatmap || []).map((h, i) => {
            const max = Math.max(1, ...(heatmap || []).map((x) => x.count || 0))
            const hgt = 8 + ((h.count || 0) / max) * 36
            const dayLabel = new Date(h.date + 'T00:00:00').toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'narrow' })
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ height: 36, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                  <div style={{ width: '80%', height: hgt, borderRadius: 4, background: (h.count || 0) ? 'var(--c-teal)' : 'var(--c-p200)', opacity: 0.6 + (h.count || 0) / max * 0.4 }} />
                </div>
                <span style={{ fontSize: 9, color: 'var(--c-p500)' }}>{dayLabel}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 学习工具 */}
      <div style={{ fontSize: 12, color: 'var(--c-p500)', marginBottom: 8, fontWeight: 600 }}>学习工具</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {entries.map((e) => {
          const Icon = e.icon
          return (
            <button key={e.key} onClick={() => setView(e.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '14px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--c-surface)', border: '1px solid var(--c-p100)' }}>
              <Icon size={20} color={e.color} />
              <span style={{ fontSize: 11, color: 'var(--c-p700)', fontWeight: 500 }}>{e.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <Card style={{ textAlign: 'center', padding: '10px 6px' }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)', marginTop: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--c-p500)' }}>{label}</div>
    </Card>
  )
}

function ProgressRing({ percent, color, size = 52 }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const dash = c * (percent / 100)
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-p200)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--c-p800)' }}>{percent}%</text>
    </svg>
  )
}
