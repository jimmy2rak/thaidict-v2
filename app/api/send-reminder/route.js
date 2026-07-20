import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'
import { renderEmail } from '@/lib/emailTemplate'
import { getTodayCST } from '@/lib/utils'
import { typeLabels } from '@/lib/taskTypes'

export const runtime = 'nodejs'

/**
 * 发送学习提醒邮件。
 * 认证：前端传入当前 session.access_token（Authorization: Bearer <token>）。
 * 内容：自动拉取用户今日未打卡的学习任务，通过 Brevo 发送邮件。
 */
export async function POST(req) {
  let token
  try {
    const auth = req.headers.get('Authorization') || ''
    token = auth.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('missing')
  } catch {
    return NextResponse.json({ error: '缺少登录凭证' }, { status: 401 })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ data: { sent: false, mock: true, uncheckedCount: 0 } })
  }

  // 验证用户并拿到邮箱
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user?.email) {
    return NextResponse.json({ error: '登录凭证无效' }, { status: 401 })
  }
  const user = userData.user
  const userId = user.id
  const email = user.email
  const today = getTodayCST()

  // 拉取今日任务
  const { data: tasks, error: tasksErr } = await supabase
    .from('user_checkin_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order')
  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 })
  }

  // 拉取今日已完成任务
  const { data: completions, error: compErr } = await supabase
    .from('user_checkin_completions')
    .select('task_id')
    .eq('user_id', userId)
    .eq('date', today)
  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 })
  }

  const completedIds = new Set((completions || []).map((c) => c.task_id))
  const unchecked = (tasks || []).filter((t) => !completedIds.has(t.id))

  const username = user.user_metadata?.username || email
  const taskListHtml = unchecked.length
    ? `<ul style="padding-left:20px;line-height:1.8;">${unchecked
        .map(
          (t) =>
            `<li><strong>${t.name}</strong>（${typeLabels(t.task_types)} · ${t.duration_minutes || 10} 分钟）</li>`
        )
        .join('')}</ul>`
    : '<p style="color:#8FA98C;">太棒了！今天的学习任务已全部完成 🎉</p>'
  const taskListText = unchecked.length
    ? unchecked
        .map((t) => `- ${t.name}（${typeLabels(t.task_types)} · ${t.duration_minutes || 10} 分钟）`)
        .join('\n')
    : '太棒了！今天的学习任务已全部完成 🎉'

  const subject = `词笺 · 今日学习提醒（${today}）`
  const { html, text } = renderEmail({
    heading: '今日学习提醒',
    introHtml: `<p class="content">你好，${username}！以下是今天（${today}）尚未打卡的学习任务：</p>`,
    bodyHtml: taskListHtml,
    primaryAction: { text: '👉 打开词笺', href: 'https://thaidict.182183.xyz' },
    bottomTips: '坚持就是胜利，快来词笺完成今日学习吧！',
  })

  try {
    await sendBrevoEmail({ to: email, subject, html, text })
    return NextResponse.json({ data: { sent: true, mock: false, uncheckedCount: unchecked.length } })
  } catch (e) {
    return NextResponse.json({ error: e.message || '邮件发送失败' }, { status: 500 })
  }
}
