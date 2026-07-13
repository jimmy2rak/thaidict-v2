import React, { useState } from 'react'
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { sendOtp, verifyBrevoOtp, updateUserPassword } from '../lib/db/index.js'
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

export default function ResetPasswordPage({ onBack }) {
  const app = useApp()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!email) return app.toast('请输入邮箱')
    setLoading(true)
    const res = await sendOtp(email, 'reset')
    setLoading(false)
    if (res?.error) app.toast('发送失败：' + res.error)
    else {
      setStep(2)
      app.toast('验证码已发送（演示码：123456）')
    }
  }
  const verify = async () => {
    setLoading(true)
    const res = await verifyBrevoOtp(email, code, 'reset')
    setLoading(false)
    if (res?.error) app.toast('验证失败：' + res.error)
    else setStep(3)
  }
  const reset = async () => {
    setLoading(true)
    const res = await updateUserPassword(pwd)
    setLoading(false)
    if (res?.error) app.toast('重置失败：' + res.error)
    else {
      app.toast('密码已重置，请重新登录')
      onBack()
    }
  }

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '40px 24px', display: 'flex', flexDirection: 'column' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', fontSize: 14, color: 'var(--c-p600)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> 返回登录
      </button>
      <h2 style={{ margin: '20px 0 4px', color: 'var(--c-p800)' }}>重置密码</h2>
      <p style={{ color: 'var(--c-p500)', fontSize: 13, marginBottom: 16 }}>通过邮箱验证码验证身份</p>

      {step === 1 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Mail size={18} color="var(--c-p500)" />
            <input style={inputStyle} placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Btn onClick={send} disabled={loading} style={{ width: '100%' }}>
            {loading ? <Spinner size={16} color="#fff" /> : '发送验证码'}
          </Btn>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <KeyRound size={18} color="var(--c-p500)" />
            <input style={inputStyle} placeholder="6 位验证码" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Btn onClick={verify} disabled={loading} style={{ width: '100%' }}>
            {loading ? <Spinner size={16} color="#fff" /> : '验证'}
          </Btn>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Lock size={18} color="var(--c-p500)" />
            <input style={inputStyle} type="password" placeholder="新密码" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <Btn onClick={reset} disabled={loading || pwd.length < 6} style={{ width: '100%' }}>
            {loading ? <Spinner size={16} color="#fff" /> : (<><CheckCircle2 size={15} /> 设置新密码</>)}
          </Btn>
        </Card>
      )}
    </div>
  )
}
