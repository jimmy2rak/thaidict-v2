import React, { useState, useEffect } from 'react'
import {
  Dumbbell, Target, BookText, BarChart3, StickyNote, Award, CalendarClock, Check,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  getCheckinTasks, getCheckinCompletions, toggleCheckinTaskCompletion,
  getStreak,
} from '../lib/db/index.js'
import { getCSTWeekday, getTodayCST } from '../lib/utils.js'
import { Card, Spinner, EmptyState, IconButton } from '../components/UIComponents.jsx'

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
  const today = getTodayCST()
  const weekday = getCSTWeekday()

  const refresh = async () => {
    if (!userId) return
    const [t, c, s] = await Promise.all([
      getCheckinTasks(userId),
      getCheckinCompletions(userId, today),
      getStreak(userId),
    ])
    setTasks(t)
    setCompleted(c)
    const todayTask = t.filter((x) => (x.plan_days || []).includes(weekday))
    const done = todayTask.filter((x) => c.includes(x.id))
    setStreak(s)
  }
  useEffect(() => { refresh() }, [userId]) // eslint-disable-line

  const onToggle = async (task) => {
    const isDone = completed.includes(task.id)
    const c = await toggleCheckinTaskCompletion(userId, task.id, today, !isDone)
    setCompleted(c)
    setStreak(await getStreak(userId))
  }

  const entries = [
    { key: 'practice', icon: Target, color: '#5B8C7E', label: '练习测验' },
    { key: 'diary', icon: BookText, color: '#C4993D', label: '学习日记' },
    { key: 'stats', icon: BarChart3, color: '#5B7E9E', label: '学习统计' },
    { key: 'notes', icon: StickyNote, color: '#C45B5B', label: '我的笔记' },
    { key: 'achievements', icon: Award, color: '#D4934D', label: '我的成就' },
    { key: 'adjust', icon: CalendarClock, color: '#8B7355', label: '调整计划' },
  ]

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '16px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Dumbbell size={20} color="var(--c-teal)" />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-p800)' }}>学习中心</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--c-gold)', fontWeight: 600 }}>🔥 连续 {streak} 天</span>
      </div>

      {/* 今日打卡 */}
      <div style={{ fontSize: 13, color: 'var(--c-p500)', marginBottom: 8, fontWeight: 600 }}>今日打卡</div>
      {tasks === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div>
      ) : tasks.filter((t) => (t.plan_days || []).includes(weekday)).length === 0 ? (
        <Card style={{ marginBottom: 16 }}><EmptyState icon="✅" text="今天没有安排打卡任务" /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {tasks.filter((t) => (t.plan_days || []).includes(weekday)).map((t) => {
            const done = completed.includes(t.id)
            return (
              <Card key={t.id} onClick={() => onToggle(t)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid ' + (done ? 'var(--c-teal)' : 'var(--c-p300)'), display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--c-teal)' : 'transparent', flexShrink: 0 }}>
                  {done && <Check size={14} color="#fff" />}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{t.duration_minutes} 分钟 · {t.task_type === 'word' ? '单词' : '听力'}</div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 快捷入口 */}
      <div style={{ fontSize: 13, color: 'var(--c-p500)', marginBottom: 8, fontWeight: 600 }}>学习工具</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {entries.map((e) => {
          const Icon = e.icon
          return (
            <button key={e.key} onClick={() => setView(e.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 8px', borderRadius: 14, background: 'var(--c-surface)', border: '1px solid var(--c-p100)' }}>
              <Icon size={22} color={e.color} />
              <span style={{ fontSize: 12, color: 'var(--c-p700)', fontWeight: 500 }}>{e.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
