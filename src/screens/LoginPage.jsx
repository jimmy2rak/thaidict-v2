import React, { useState } from 'react'
import { Mail, Lock, KeyRound, Send, Github, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { MainLogo } from '../icons/CulturalIcons.jsx'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithOAuth,
  sendOtp,
  verifyBrevoOtp,
} from '../lib/db/index.js'
import { Btn, Card, Spinner } from '../components/UIComponents.jsx'

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--c-p200)',
  borderRadius: 12,
  fontSize: 15,
  background: 'var(--c-bg)',
  color: 'var(--c-p800)',
  outline: 'none',
}

// Google 彩色 "G" 图标（lucide 无品牌图标，内联 SVG）
function GoogleIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

const GITHUB_REPO = 'https://github.com/jimmy2rak/thaidict-v2'

export default function LoginPage({ onForgot }) {
  const app = useApp()
  const [method, setMethod] = useState('password') // 'password' | 'otp'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const finishLogin = (res) => {
    if (res?.error) {
      setError(res.error.message || '登录失败')
      setLoading(false)
      return
    }
    if (res?.data?.session) app.setSession(res.data.session)
    setLoading(false)
  }

  const onOAuth = async (provider) => {
    setLoading(true)
    const res = await signInWithOAuth(provider)
    if (res?.error) {
      setError(res.error.message)
      setLoading(false)
    } else if (!isSupabaseConfigured) {
      finishLogin(res)
    }
    // 真实模式会重定向到第三方登录页
  }

  // 密码登录/注册合一：先尝试登录，失败（未注册）则自动注册
  const onPasswordSubmit = async () => {
    if (!email || !password) return app.toast('请输入邮箱和密码')
    setError('')
    setLoading(true)
    const login = await signInWithEmail(email, password)
    if (login?.error) {
      const reg = await signUpWithEmail(email, password, '')
      if (reg?.error) {
        setError(reg.error.message || '操作失败')
        setLoading(false)
        return
      }
      if (reg?.data?.session) app.setSession(reg.data.session)
      else app.toast('注册成功，请查收确认邮件后登录')
      setLoading(false)
    } else {
      finishLogin(login)
    }
  }

  const onSendOtp = async () => {
    if (!email) return app.toast('请输入邮箱')
    setLoading(true)
    const res = await sendOtp(email, 'login')
    setLoading(false)
    if (res?.error) app.toast('发送失败：' + res.error)
    else {
      setOtpSent(true)
      app.toast('验证码已发送（经 Brevo 邮件）')
    }
  }
  const onVerifyOtp = async () => {
    if (!otpCode) return app.toast('请输入验证码')
    setLoading(true)
    const res = await verifyBrevoOtp(email, otpCode, 'login')
    setLoading(false)
    if (res?.error) app.toast('验证失败：' + res.error)
    else if (res?.data?.session) app.setSession(res.data.session)
  }

  const oauthBtn = {
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: '1px solid var(--c-p200)',
    background: 'var(--c-surface)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--c-p700)',
  }

  return (
    <div className="scroll-y" style={{ flex: 1, minHeight: 0, padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', fontFamily: 'var(--zh-serif)' }}>
      {/* 左上角品牌文字 + 右上角 GitHub 小猫图标 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-p800)', letterSpacing: 2 }}>词笺</div>
          <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 2 }}>中泰双语智能词典</div>
        </div>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          title="GitHub 仓库"
          style={{ color: 'var(--c-p400)', display: 'inline-flex', opacity: 0.7 }}
        >
          <Github size={20} />
        </a>
      </div>

      {/* Logo 完整展示、放大居中 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <MainLogo size={150} />
      </div>

      {/* Google / GitHub 圆形按钮：账号登录上方，作为首选 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 18 }}>
        <button onClick={() => onOAuth('google')} style={oauthBtn} title="使用 Google 登录" aria-label="Google 登录">
          <GoogleIcon size={24} />
        </button>
        <button onClick={() => onOAuth('github')} style={oauthBtn} title="使用 GitHub 登录" aria-label="GitHub 登录">
          <Github size={24} />
        </button>
      </div>

      {/* 细分割线 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--c-p200)' }} />
        <span style={{ fontSize: 11, color: 'var(--c-p400)', letterSpacing: 1 }}>或</span>
        <div style={{ flex: 1, height: 1, background: 'var(--c-p200)' }} />
      </div>

      <Card style={{ marginBottom: 14 }}>
        {/* 切换 Tab：密码登录 / 验证码·链接登录（分段控件，选中态为内缩白色圆角块） */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: 'var(--c-p100)',
            borderRadius: 14,
            padding: 6,
            marginBottom: 20,
          }}
        >
          {[
            { key: 'password', label: '密码登录' },
            { key: 'otp', label: '验证码/链接登录' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => { setMethod(m.key); setError(''); setOtpSent(false) }}
              style={{
                flex: 1,
                padding: '11px 0',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 10,
                border: 'none',
                background: method === m.key ? 'var(--c-surface)' : 'transparent',
                color: method === m.key ? 'var(--c-p800)' : 'var(--c-p500)',
                cursor: 'pointer',
                boxShadow: method === m.key ? '0 1px 3px rgba(112,79,43,0.12)' : 'none',
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'password' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: 'var(--c-p700)' }}>
                <Mail size={16} color="var(--c-p500)" />
                <span>邮箱</span>
              </div>
              <input
                style={inputStyle}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: 'var(--c-p700)' }}>
                <Lock size={16} color="var(--c-p500)" />
                <span>密码</span>
              </div>
              <input
                style={inputStyle}
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div style={{ color: 'var(--c-rose)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <Btn onClick={onPasswordSubmit} disabled={loading} style={{ width: '100%' }}>
              {loading ? <Spinner size={16} color="#fff" /> : '登录'}
            </Btn>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: 'var(--c-p700)' }}>
                <Mail size={16} color="var(--c-p500)" />
                <span>邮箱</span>
              </div>
              <input
                style={inputStyle}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {!otpSent ? (
              <Btn onClick={onSendOtp} disabled={loading} style={{ width: '100%' }}>
                {loading ? <Spinner size={16} color="#fff" /> : (<><Send size={15} /> 发送验证码 / 登录链接</>)}
              </Btn>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: 'var(--c-p700)' }}>
                    <KeyRound size={16} color="var(--c-p500)" />
                    <span>验证码</span>
                  </div>
                  <input
                    style={inputStyle}
                    placeholder="请输入 6 位验证码"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
                <Btn onClick={onVerifyOtp} disabled={loading} style={{ width: '100%' }}>
                  {loading ? <Spinner size={16} color="#fff" /> : '验证并登录'}
                </Btn>
              </>
            )}

            {otpSent && (
              <button onClick={() => setOtpSent(false)} style={{ marginTop: 12, fontSize: 12, color: 'var(--c-info)', background: 'none', border: 'none' }}>
                <ArrowLeft size={12} /> 重新发送验证码 / 链接
              </button>
            )}
            <p style={{ fontSize: 12, color: 'var(--c-p400)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
              邮件已同时包含验证码与一键登录链接
            </p>
          </>
        )}
      </Card>

      {/* 底部注册 / 找回密码 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 'auto' }}>
        <button
          onClick={() => setMethod('password')}
          style={{ color: 'var(--c-p500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          还没有账号？<span style={{ color: 'var(--c-primary)' }}>去注册</span>
        </button>
        <button onClick={onForgot} style={{ color: 'var(--c-p500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          找回密码
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--c-p400)', textAlign: 'center', lineHeight: 1.6, marginTop: 16 }}>
        登录即表示同意《用户协议》与《隐私政策》
      </div>
    </div>
  )
}
