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
  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      html: html || undefined,
      text: text || undefined,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo ${res.status}: ${body}`)
  }
  return res.json()
}
