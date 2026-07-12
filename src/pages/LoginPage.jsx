import React, { useState } from 'react'
import { Mail, Lock, User as UserIcon, ArrowLeft, KeyRound, Send } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { WatArunLogo } from '../icons/CulturalIcons.jsx'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithOAuth,
  sendMagicLink,
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

export default function LoginPage({ onForgot }) {
  const app = useApp()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // OTP
  const [otpMode, setOtpMode] = useState(false)
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

  const onLogin = async () => {
    setError('')
    setLoading(true)
    finishLogin(await signInWithEmail(email, password))
  }
  const onRegister = async () => {
    setError('')
    setLoading(true)
    const res = await signUpWithEmail(email, password, username)
    if (res?.error) {
      setError(res.error.message || '注册失败')
      setLoading(false)
    } else if (isSupabaseConfiguredReal()) {
      // 真实模式可能需邮箱确认（Bug D-2）
      app.toast('注册成功，请检查邮箱确认后登录')
      setLoading(false)
    } else {
      finishLogin(res)
    }
  }
  const onOAuth = async (provider) => {
    setLoading(true)
    const res = await signInWithOAuth(provider)
    if (res?.error) {
      setError(res.error.message)
      setLoading(false)
    } else if (!isSupabaseConfiguredReal()) {
      finishLogin(res)
    }
    // 真实模式会重定向
  }
  const onMagicLink = async () => {
    if (!email) return app.toast('请输入邮箱')
    setLoading(true)
    const res = await sendMagicLink(email)
    setLoading(false)
    if (res?.error) app.toast('发送失败：' + res.error)
    else app.toast('登录链接已发送到邮箱')
  }
  const onSendOtp = async () => {
    if (!email) return app.toast('请输入邮箱')
    setLoading(true)
    const res = await sendOtp(email, 'login')
    setLoading(false)
    if (res?.error) app.toast('发送失败：' + res.error)
    else {
      setOtpSent(true)
      app.toast('验证码已发送（演示码：123456）')
    }
  }
  const onVerifyOtp = async () => {
    setLoading(true)
    const res = await verifyBrevoOtp(email, otpCode, 'login')
    setLoading(false)
    if (res?.error) app.toast('验证失败：' + res.error)
    else if (res?.data?.session) app.setSession(res.data.session)
  }

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '40px 24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <WatArunLogo size={42} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-p800)' }}>词笺</div>
            <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>中泰双语智能词典</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError('')
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                background: mode === m ? 'var(--c-teal)' : 'var(--c-p100)',
                color: mode === m ? '#fff' : 'var(--c-p600)',
              }}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {!otpMode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Mail size={18} color="var(--c-p500)" />
              <input style={inputStyle} placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Lock size={18} color="var(--c-p500)" />
              <input style={inputStyle} type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {mode === 'register' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <UserIcon size={18} color="var(--c-p500)" />
                <input style={inputStyle} placeholder="用户名（可选）" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            )}
            {error && <div style={{ color: 'var(--c-rose)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            <Btn onClick={mode === 'login' ? onLogin : onRegister} disabled={loading} style={{ width: '100%' }}>
              {loading ? <Spinner size={16} color="#fff" /> : mode === 'login' ? '登录' : '注册并登录'}
            </Btn>
          </>
        ) : (
          <>
            {!otpSent ? (
              <Btn onClick={onSendOtp} disabled={loading} style={{ width: '100%' }}>
                {loading ? <Spinner size={16} color="#fff" /> : (<><Send size={15} /> 发送验证码</>)}
              </Btn>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <KeyRound size={18} color="var(--c-p500)" />
                  <input style={inputStyle} placeholder="6 位验证码" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                </div>
                <Btn onClick={onVerifyOtp} disabled={loading} style={{ width: '100%' }}>
                  {loading ? <Spinner size={16} color="#fff" /> : '验证并登录'}
                </Btn>
              </>
            )}
            <button onClick={() => setOtpMode(false)} style={{ marginTop: 10, fontSize: 13, color: 'var(--c-info)', background: 'none', border: 'none' }}>
              <ArrowLeft size={13} /> 返回密码登录
            </button>
          </>
        )}
      </Card>

      <div style={{ textAlign: 'center', color: 'var(--c-s500)', fontSize: 12, margin: '6px 0' }}>其他登录方式</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={() => onOAuth('google')} style={{ flex: 1 }}>Google</Btn>
        <Btn variant="ghost" onClick={() => onOAuth('github')} style={{ flex: 1 }}>GitHub</Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn variant="ghost" onClick={onMagicLink} style={{ width: '100%' }}>发送 Magic Link 邮件登录</Btn>
      </div>
      <button onClick={() => setOtpMode(!otpMode)} style={{ marginTop: 10, fontSize: 13, color: 'var(--c-info)', background: 'none', border: 'none' }}>
        使用邮箱验证码登录
      </button>
      <button onClick={onForgot} style={{ marginTop: 16, fontSize: 13, color: 'var(--c-p500)', background: 'none', border: 'none' }}>
        忘记密码？
      </button>
    </div>
  )
}

function isSupabaseConfiguredReal() {
  return isSupabaseConfigured
}
