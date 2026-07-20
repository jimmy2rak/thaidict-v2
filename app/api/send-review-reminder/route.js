import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { sendBrevoEmail } from '@/lib/brevo'
import { renderEmail, SITE_URL } from '@/lib/emailTemplate'

export const runtime = 'nodejs'
export const maxDuration = 10

// 审阅者判定：超级管理员，或拥有「审批词条」权限的管理员。
function isReviewer(roleRow) {
  if (!roleRow) return false
  if (roleRow.role === 'super_admin') return true
  if (roleRow.role === 'admin') {
    return (roleRow.permissions || []).includes('approve_entries')
  }
  return false
}

// 把待审批词条 payload 渲染成邮件正文片段。
function buildWordHtml(payload = {}) {
  const word = payload.word || '（未命名词条）'
  const rom = payload.romanization || ''
  const senses = Array.isArray(payload.senses) ? payload.senses.slice(0, 3) : []
  const head = `<p class="content">泰文词条：<span class="thai word-title">${word}</span>${
    rom ? ` <span class="content">(${rom})</span>` : ''
  }</p>`

  const senseHtml = senses
    .map((s) => {
      const pos = s.pos || '—'
      const meaning = s.meaning || ''
      const ex = Array.isArray(s.examples) && s.examples[0] ? s.examples[0] : null
      const exHtml = ex
        ? `<p class="content" style="margin:4px 0 0;color:#947c5c;">例句：<span class="thai">${
            ex.th || ex.thai || ''
          }</span> ${ex.zh || ''}</p>`
        : ''
      return `<div style="margin:10px 0;padding-top:10px;border-top:1px solid #e9e2d5;">
        <p class="content" style="margin:0 0 4px;"><strong>词性：</strong>${pos}　<strong>释义：</strong>${meaning}</p>
        ${exHtml}
      </div>`
    })
    .join('')

  const more = Array.isArray(payload.senses) && payload.senses.length > 3
    ? `<p class="content" style="margin:8px 0 0;color:#947c5c;">（其余 ${
        payload.senses.length - 3
      } 个义项请在审批中心查看）</p>`
    : ''

  const hint = payload.zh_hint
    ? `<p class="content" style="margin:10px 0 0;color:#947c5c;">用户备注：${payload.zh_hint}</p>`
    : ''

  return head + senseHtml + more + hint
}

export async function POST(req) {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: '请求体格式错误' }, { status: 200 })
    }
    const { type, payload, requestedBy } = body || {}
    if (!type || !payload) {
      return NextResponse.json({ ok: false, error: '缺少 type / payload' }, { status: 200 })
    }

    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json({ ok: false, error: '服务端未配置 Supabase' }, { status: 200 })
    }

    console.log('[send-review-reminder] start type=', type, 'requestedBy=', requestedBy)

    // 1) 取所有角色行（service_role 绕过 RLS）
    const { data: roleRows, error: roleErr } = await supabase
      .from('user_roles')
      .select('user_id, role, permissions')
    if (roleErr) {
      console.error('[send-review-reminder] 读 user_roles 失败:', roleErr.message)
      return NextResponse.json({ ok: false, error: roleErr.message }, { status: 200 })
    }
    const reviewerIds = (roleRows || [])
      .filter(isReviewer)
      .map((r) => r.user_id)
    if (reviewerIds.length === 0) {
      console.log('[send-review-reminder] 无符合条件的审阅管理员')
      return NextResponse.json({ ok: true, sent: 0, total: 0 })
    }

    // 2) 取用户邮箱（含提交者）
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    })
    if (listErr) {
      console.error('[send-review-reminder] listUsers 失败:', listErr.message)
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 200 })
    }
    const users = listData?.users || []
    const byId = new Map(users.map((u) => [u.id, u]))
    const reviewerEmails = reviewerIds
      .map((id) => byId.get(id)?.email)
      .filter((e) => !!e)

    const submitter = requestedBy ? byId.get(requestedBy) : null
    const submitterName =
      submitter?.user_metadata?.username ||
      submitter?.email ||
      (requestedBy ? `用户(${String(requestedBy).slice(0, 8)})` : '某用户')

    // 3) 渲染邮件并逐个发送（单封失败不影响其余）
    const wordHtml = buildWordHtml(payload)
    const subject = `【待审阅】新${type === 'sentence' ? '句子' : '词条'}提交 · ${payload.word || ''}`
    const { html, text } = renderEmail({
      heading: '新内容待审阅',
      introHtml: `<p class="content">用户 <strong>${submitterName}</strong> 提交了一个新${
        type === 'sentence' ? '句子' : '词条'
      }，请登录后台审阅。</p>`,
      bodyHtml: wordHtml,
      primaryAction: { text: '前往审批中心', href: SITE_URL },
      bottomTips: '本邮件由系统自动发送，请勿直接回复。',
    })

    let sent = 0
    await Promise.all(
      reviewerEmails.map(async (to) => {
        try {
          await sendBrevoEmail({ to, subject, html, text })
          sent += 1
          console.log('[send-review-reminder] 已发 ->', to)
        } catch (e) {
          console.error('[send-review-reminder] 发给', to, '失败:', e.message)
        }
      })
    )

    console.log(`[send-review-reminder] 完成：共 ${reviewerEmails.length} 位审阅者，成功 ${sent}`)
    return NextResponse.json({ ok: true, sent, total: reviewerEmails.length })
  } catch (e) {
    console.error('[send-review-reminder] 未捕获异常:', e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 200 })
  }
}
