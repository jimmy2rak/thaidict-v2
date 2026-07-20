// Brevo 事务邮件发送（服务端专用）。
// 依赖环境变量：BREVO_API_KEY / BREVO_SENDER_EMAIL / BREVO_SENDER_NAME
const BREVO_API = 'https://api.brevo.com/v3/smtp/email'

export async function sendBrevoEmail({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || senderEmail
  if (!apiKey || !senderEmail) {
    throw new Error('BREVO_API_KEY / BREVO_SENDER_EMAIL 未配置')
  }
  let res
  try {
    res = await fetch(BREVO_API, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        // ⚠️ Brevo v3 字段名是 htmlContent / textContent（不是 html / text）
        htmlContent: html || undefined,
        textContent: text || undefined,
      }),
    })
  } catch (netErr) {
    throw new Error('Brevo 请求网络异常: ' + netErr.message)
  }

  const raw = await res.text()
  // Brevo 正常返回 JSON；若拿到 HTML（如被代理/重定向到登录页、网关错误页），
  // 直接 JSON.parse 会报 "Unexpected token '<'"。这里先判别，抛出可读错误。
  const isHtml = raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')
  if (!res.ok) {
    throw new Error(`Brevo HTTP ${res.status}: ${isHtml ? raw.slice(0, 200) : raw}`)
  }
  if (isHtml) {
    throw new Error(`Brevo 返回了非 JSON（疑似网关/代理页）: ${raw.slice(0, 200)}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Brevo 响应无法解析为 JSON: ${raw.slice(0, 200)}`)
  }
}
