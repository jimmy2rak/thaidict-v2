// 打卡任务系统。mock 走 localStorage；real 走 Supabase。
// 修复 Bug B-6：study_minutes 以原子方式累加（real 走 add_study_minutes RPC）。
import { isSupabaseConfigured, supabase } from '../supabase.js'
import { safeQuery, uid, getTodayCST, getDateCST } from '../utils.js'
import { getUserColl, setUserColl } from '../mock/store.js'

function fmt(d) {
  return getDateCST(d)
}

// ---------- mock ----------
function mockTasks(userId) {
  return getUserColl(userId, 'checkin_tasks', [])
    .filter((t) => t.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}
function mockCompletions(userId) {
  return getUserColl(userId, 'checkin_completions', [])
}
function mockProgress(userId) {
  return getUserColl(userId, 'learning_progress', [])
}
function recomputeStreak(userId) {
  const completions = mockCompletions(userId)
  const dateSet = new Set(completions.map((c) => c.date))
  const progress = mockProgress(userId)
  for (const p of progress) {
    let streak = 0
    const d = new Date(p.date + 'T00:00:00')
    while (dateSet.has(fmt(d))) {
      streak++
      d.setDate(d.getDate() - 1)
    }
    p.streak_days = streak
  }
  setUserColl(userId, 'learning_progress', progress)
}

export async function getCheckinTasks(userId) {
  if (!isSupabaseConfigured) return mockTasks(userId)
  if (!supabase || !userId) return []
  const { data, error } = await safeQuery(
    supabase.from('user_checkin_tasks').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
  )
  if (error) {
    console.error('[getCheckinTasks]', error.message)
    return []
  }
  return data || []
}

export async function createCheckinTask(userId, task) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId, 'checkin_tasks', [])
    const t = {
      id: uid(),
      name: task.name,
      duration_minutes: task.duration_minutes || 10,
      task_type: task.task_type || 'word',
      plan_days: task.plan_days || [1, 2, 3, 4, 5, 6, 7],
      sort_order: task.sort_order ?? list.length,
      is_active: true,
    }
    list.push(t)
    setUserColl(userId, 'checkin_tasks', list)
    return t
  }
  if (!supabase || !userId) return null
  const { data, error } = await safeQuery(
    supabase
      .from('user_checkin_tasks')
      .insert({
        user_id: userId,
        name: task.name,
        duration_minutes: task.duration_minutes || 10,
        task_type: task.task_type || 'word',
        plan_days: task.plan_days || [1, 2, 3, 4, 5, 6, 7],
        sort_order: task.sort_order ?? 0,
        is_active: true,
      })
      .select()
      .single()
  )
  if (error) {
    console.error('[createCheckinTask]', error.message)
    return null
  }
  return data
}

export async function updateCheckinTask(userId, taskId, updates) {
  if (!isSupabaseConfigured) {
    const list = getUserColl(userId || '__', 'checkin_tasks', [])
    const t = list.find((x) => x.id === taskId)
    if (t) Object.assign(t, updates)
    setUserColl(userId || '__', 'checkin_tasks', list)
    return t
  }
  if (!supabase) return null
  const { data } = await safeQuery(
    supabase.from('user_checkin_tasks').update(updates).eq('id', taskId).select().single()
  )
  return data
}

export async function deleteCheckinTask(userId, taskId) {
  return updateCheckinTask(userId, taskId, { is_active: false })
}

export async function getCheckinCompletions(userId, date) {
  if (!isSupabaseConfigured) {
    return mockCompletions(userId)
      .filter((c) => c.date === date)
      .map((c) => c.task_id)
  }
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase.from('user_checkin_completions').select('task_id').eq('user_id', userId).eq('date', date)
  )
  return (data || []).map((r) => r.task_id)
}

// 切换打卡完成状态（Bug B-6 原子累加 study_minutes）
export async function toggleCheckinTaskCompletion(userId, taskId, date, completed) {
  if (!isSupabaseConfigured) {
    const tasks = getUserColl(userId || '__', 'checkin_tasks', [])
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return []
    const completions = mockCompletions(userId)
    const idx = completions.findIndex((c) => c.task_id === taskId && c.date === date)
    const progress = mockProgress(userId)
    let p = progress.find((x) => x.date === date)
    if (completed) {
      if (idx < 0) completions.push({ task_id: taskId, date, completed_at: new Date().toISOString() })
      if (!p) {
        p = { date, study_minutes: 0, streak_days: 0 }
        progress.push(p)
      }
      p.study_minutes += task.duration_minutes
    } else {
      if (idx >= 0) completions.splice(idx, 1)
      if (p) p.study_minutes = Math.max(0, p.study_minutes - task.duration_minutes)
    }
    setUserColl(userId, 'checkin_completions', completions)
    setUserColl(userId, 'learning_progress', progress)
    recomputeStreak(userId)
    return getCheckinCompletions(userId, date)
  }
  if (!supabase || !userId) return []
  const tasks = await getCheckinTasks(userId)
  const task = tasks.find((t) => t.id === taskId)
  const mins = (completed ? 1 : -1) * (task?.duration_minutes || 0)
  await safeQuery(
    supabase.rpc('add_study_minutes', { p_user_id: userId, p_date: date, p_minutes: mins })
  )
  await safeQuery(
    supabase
      .from('user_checkin_completions')
      .upsert({ user_id: userId, task_id: taskId, date, completed }, { onConflict: 'user_id,task_id,date' })
  )
  return getCheckinCompletions(userId, date)
}

export async function getCheckinHeatmapData(userId, days = 35) {
  if (!isSupabaseConfigured) {
    const completions = mockCompletions(userId)
    const out = []
    const base = new Date(getTodayCST() + 'T00:00:00')
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base)
      d.setDate(d.getDate() - i)
      const ds = fmt(d)
      out.push({ date: ds, count: completions.filter((c) => c.date === ds).length })
    }
    return out
  }
  if (!supabase || !userId) return []
  const { data } = await safeQuery(
    supabase
      .from('user_checkin_completions')
      .select('date')
      .eq('user_id', userId)
      .gte('date', getDateCST(new Date(Date.now() - (days - 1) * 86400000)))
  )
  const counts = {}
  ;(data || []).forEach((r) => (counts[r.date] = (counts[r.date] || 0) + 1))
  const out = []
  const base = new Date(getTodayCST() + 'T00:00:00')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const ds = fmt(d)
    out.push({ date: ds, count: counts[ds] || 0 })
  }
  return out
}

export async function getStreak(userId) {
  if (!isSupabaseConfigured) {
    const today = getTodayCST()
    const p = mockProgress(userId).find((x) => x.date === today)
    return p ? p.streak_days || 0 : 0
  }
  if (!supabase || !userId) return 0
  const { data } = await safeQuery(
    supabase.from('user_learning_progress').select('streak_days').eq('user_id', userId).order('date', { ascending: false }).limit(1)
  )
  return data?.[0]?.streak_days || 0
}

export async function getMonthlyCheckinStreak(userId) {
  if (!isSupabaseConfigured) {
    const ym = getTodayCST().slice(0, 7)
    const dates = new Set(mockCompletions(userId).filter((c) => c.date.startsWith(ym)).map((c) => c.date))
    return dates.size
  }
  if (!supabase || !userId) return 0
  const ym = getTodayCST().slice(0, 7)
  const { data } = await safeQuery(
    supabase.from('user_checkin_completions').select('date').eq('user_id', userId).like('date', ym + '%')
  )
  return new Set((data || []).map((r) => r.date)).size
}

export async function getWeeklyStudyMinutes(userId) {
  if (!isSupabaseConfigured) {
    const progress = mockProgress(userId)
    const today = new Date(getTodayCST() + 'T00:00:00')
    const dow = (today.getDay() + 6) % 7 // 周一=0
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)
    const out = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const ds = fmt(d)
      const p = progress.find((x) => x.date === ds)
      out.push(p ? p.study_minutes : 0)
    }
    return out
  }
  if (!supabase || !userId) return [0, 0, 0, 0, 0, 0, 0]
  const today = new Date(getTodayCST() + 'T00:00:00')
  const dow = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow)
  const start = fmt(monday)
  const end = fmt(new Date(monday.getTime() + 6 * 86400000))
  const { data } = await safeQuery(
    supabase
      .from('user_learning_progress')
      .select('date, study_minutes')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
  )
  const map = {}
  ;(data || []).forEach((r) => (map[r.date] = r.study_minutes))
  const out = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    out.push(map[fmt(d)] || 0)
  }
  return out
}
