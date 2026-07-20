// 统一邮件模板（服务端专用）。
// 所有发往用户的邮件——登录验证码、Magic Link、学习提醒、审阅提醒，以及将来任何发信事项——
// 都复用 renderEmail()，保证视觉一致（奶油底 + 琥珀棕简约风，无复杂纹样）。
//
// 字体约定（用户 2026-07-20 指定）：
//   中英文 → Noto Serif SC（思源宋体简体）
//   泰文   → Sriracha
// 通过 Google Fonts @import 引入；正文 font-family 把 Noto Serif SC 放前、Sriracha 放后，
// 浏览器按字形回退（中文/英文走 Noto Serif SC，泰文因前者无泰文字形而回退到 Sriracha）。
// 泰文内容也可显式加 .thai 类强制 Sriracha。
//
// 用法：
//   import { renderEmail } from '@/lib/emailTemplate'
//   const { html, text } = renderEmail({ heading, introHtml, code, codeLabel, primaryAction, bodyHtml, bottomTips })
//   await sendBrevoEmail({ to, subject, html, text })

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaidict.182183.xyz').replace(/\/$/, '')

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&family=Sriracha&display=swap');
body {
  margin: 0;
  padding: 0;
  background: #f8f5ee;
  font-family: "Noto Serif SC", "Sriracha", SimSun, serif;
}
.box {
  max-width: 560px;
  margin: 26px auto;
  background: #fffdf8;
  border: 1px solid #e6dfd0;
  border-radius: 4px;
  padding: 40px;
}
h2 {
  color: #7c5c36;
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 14px;
}
.content {
  color: #6d563b;
  font-size: 14px;
  line-height: 1.8;
}
.code-wrap {
  background: #f3eee3;
  padding: 20px 0;
  text-align: center;
  margin: 26px 0;
}
.auth-code {
  font-size: 30px;
  letter-spacing: 8px;
  color: #916c3c;
  font-weight: bold;
}
.magic-link {
  display: block;
  text-align: center;
  background: #916c3c;
  color: #fff;
  text-decoration: none;
  padding: 12px;
  border-radius: 2px;
  font-size: 14px;
  margin: 22px 0;
}
.bottom-tips {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e9e2d5;
  color: #947c5c;
  font-size: 13px;
  line-height: 1.7;
}
.plain-link {
  color: #916c3c;
  word-break: break-all;
}
.thai {
  font-family: "Sriracha", "Noto Serif SC", serif;
}
.word-title {
  font-size: 22px;
  letter-spacing: 1px;
  color: #916c3c;
  font-weight: 700;
}
`

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h2|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

/**
 * 渲染一封统一风格的邮件。
 * @param {Object} opts
 * @param {string} [opts.heading]      标题（如「中泰智能学习者词典登录验证」）
 * @param {string} [opts.introHtml]    标题下方的引导语（HTML 片段）
 * @param {string} [opts.code]         验证码（可选，存在则渲染 .code-wrap 校验码块）
 * @param {string} [opts.codeLabel]    验证码上方说明文字
 * @param {Object} [opts.primaryAction] 主操作按钮 { text, href }（如 Magic Link / 打开应用）
 * @param {string} [opts.bodyHtml]     额外内容块（HTML 片段，如任务列表、词条详情）
 * @param {string} [opts.bottomTips]   底部提示（HTML 片段，可含 .plain-link 回退链接）
 * @returns {{ html: string, text: string }}
 */
export function renderEmail(opts = {}) {
  const {
    heading = 'ThaiDict 通知',
    introHtml = '',
    code = '',
    codeLabel = '登录校验码',
    primaryAction = null,
    bodyHtml = '',
    bottomTips = '',
  } = opts

  const codeBlock = code
    ? `<div class="code-wrap">
         <p style="margin:0 0 10px;color:#8a6e4b;font-size:14px;">${codeLabel}</p>
         <div class="auth-code">${code}</div>
       </div>`
    : ''

  const actionBlock = primaryAction
    ? `<a href="${primaryAction.href}" class="magic-link">${primaryAction.text}</a>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
<style>${CSS}</style>
</head>
<body>
<div class="box">
  <h2>${heading}</h2>
  ${introHtml}
  ${codeBlock}
  ${actionBlock}
  ${bodyHtml}
  ${bottomTips ? `<div class="bottom-tips">${bottomTips}</div>` : ''}
</div>
</body>
</html>`

  // 纯文本版本
  const lines = []
  lines.push(heading)
  lines.push('')
  if (introHtml) lines.push(stripTags(introHtml))
  if (code) {
    lines.push('')
    lines.push(stripTags(codeLabel))
    lines.push(code)
  }
  if (primaryAction) {
    lines.push('')
    lines.push(`${primaryAction.text}：${primaryAction.href}`)
  }
  if (bodyHtml) {
    lines.push('')
    lines.push(stripTags(bodyHtml))
  }
  if (bottomTips) {
    lines.push('')
    lines.push(stripTags(bottomTips))
  }
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return { html, text }
}

export { SITE_URL }
