// 统一邮件模板（服务端专用）。
// 所有发往用户的邮件——登录验证码、Magic Link、学习提醒，以及将来任何发信事项——
// 都复用 renderEmail()，保证视觉一致（奶油底 + 琥珀色泰式纹样边框，左上角 logo = 项目 favicon）。
//
// 用法：
//   import { renderEmail } from '@/lib/emailTemplate'
//   const { html, text } = renderEmail({ heading, introHtml, code, codeLabel, primaryAction, bodyHtml, bottomTips })
//   await sendBrevoEmail({ to, subject, html, text })
//
// 注意：邮件客户端（尤其 Gmail）会拦截 SVG 与 data: URI 图片，因此 logo 使用
// 已转为 PNG 的项目 favicon（public/icons/icon-email.png）并以站点绝对地址引用。

const BRAND = 'ThaiDict'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaidict.182183.xyz').replace(/\/$/, '')
const LOGO_URL = `${SITE_URL}/icons/icon-email.png`

const CSS = `
body {
  margin: 0;
  padding: 0;
  background: #faf5eb;
  font-family: "思源宋体", SimSun, "Microsoft YaHei", serif;
}
.box {
  max-width: 560px;
  margin: 26px auto;
  background: #fffdf8;
  border: 1px solid #e6ddcc;
  border-radius: 6px;
  padding: 40px;
  position: relative;
  overflow: hidden;
}
.box::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 18px,
      rgba(166, 125, 71, 0.08) 18px,
      rgba(166, 125, 71, 0.08) 36px
    ),
    linear-gradient(
      90deg,
      rgba(166, 125, 71, 0.12) 0%,
      rgba(166, 125, 71, 0.12) 100%
    );
  opacity: 0.55;
}
.code-wrap {
  background:
    radial-gradient(circle at 12% 12%, rgba(166, 125, 71, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 88% 8%, rgba(166, 125, 71, 0.04) 0%, transparent 50%),
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 12px,
      rgba(166, 125, 71, 0.03) 12px,
      rgba(166, 125, 71, 0.03) 24px
    ),
    #f4ede0;
  padding: 24px 0;
  text-align: center;
  margin: 30px 0;
  border-radius: 4px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  color: #704f2b;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}
.logo-mark {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(166, 125, 71, 0.35);
  background: #fffdf8;
}
h2 {
  color: #704f2b;
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 12px;
}
.content {
  color: #825e37;
  font-size: 15px;
  line-height: 1.8;
  margin: 0 0 16px;
}
.auth-code {
  font-size: 36px;
  letter-spacing: 10px;
  color: #a67d47;
  font-weight: bold;
}
.magic-link {
  display: block;
  text-align: center;
  background: linear-gradient(135deg, #a67d47, #b88628);
  color: #fff;
  text-decoration: none;
  padding: 14px;
  border-radius: 4px;
  font-size: 16px;
  margin: 26px 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 3px rgba(112, 79, 43, 0.15);
}
.magic-link:hover {
  background: linear-gradient(135deg, #b88628, #c9942e);
}
.bottom-tips {
  margin-top: 34px;
  padding-top: 22px;
  border-top: 1px solid #ebe3d4;
  color: #8c673e;
  font-size: 13px;
  line-height: 1.7;
}
.plain-link {
  color: #a67d47;
  word-break: break-all;
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
 * @param {string} [opts.bodyHtml]     额外内容块（HTML 片段，如任务列表）
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
         <p style="margin:0 0 10px;color:#947043;">${codeLabel}</p>
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
  <div class="logo">
    <img class="logo-mark" src="${LOGO_URL}" alt="${BRAND}" width="42" height="42" />
    ${BRAND}
  </div>
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
