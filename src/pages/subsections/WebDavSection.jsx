import React, { useState, useEffect } from 'react'
import { ArrowLeft, CloudUpload, Lock, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getUserSettings, saveUserSettings } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'

const enc = new TextEncoder()
const dec = new TextDecoder()
const SALT = enc.encode('thaidict-webdav-salt-v1')

function bufToB64(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function b64ToBuf(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function deriveKey(password) {
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptText(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return bufToB64(iv) + ':' + bufToB64(ct)
}

export default function WebDavSection({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [hasStored, setHasStored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    if (!userId) return setLoading(false)
    if (!window.crypto || !window.crypto.subtle) setUnsupported(true)
    getUserSettings(userId).then((s) => {
      setUrl(s.webdav_url || '')
      setUser(s.webdav_user || '')
      setHasStored(!!s.webdav_pass_enc)
      setLoading(false)
    })
  }, [userId])

  const onSave = async () => {
    if (!userId) return
    if (!url.trim() || !user.trim()) return toast('请填写 WebDAV 地址与用户名')
    if (!window.crypto || !window.crypto.subtle) {
      toast('当前环境不支持加密（需 https 或 localhost）')
      return
    }
    setSaving(true)
    let passEnc = ''
    if (pass.trim()) {
      try {
        const key = await deriveKey(userId + '::thaidict::webdav')
        passEnc = await encryptText(pass.trim(), key)
      } catch (e) {
        setSaving(false)
        toast('加密失败：' + e.message)
        return
      }
    }
    await saveUserSettings(userId, { webdav_url: url.trim(), webdav_user: user.trim(), webdav_pass_enc: passEnc || undefined })
    setHasStored(!!passEnc || hasStored)
    setPass('')
    setSaving(false)
    // 模拟上传（真实模式由 webdav-upload 边缘函数处理，上线部署）
    toast('WebDAV 配置已保存（模拟上传成功）')
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>WebDAV 备份</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'color-mix(in srgb, var(--c-teal) 10%, transparent)', borderRadius: 10, marginBottom: 14 }}>
          <ShieldCheck size={16} color="var(--c-teal)" />
          <span style={{ fontSize: 12, color: 'var(--c-p600)' }}>密码采用 AES-GCM 加密后本地保存，不上传明文</span>
        </div>

        {unsupported && (
          <div style={{ fontSize: 12, color: 'var(--c-rose)', marginBottom: 10 }}>当前环境不支持 Web Crypto，加密功能不可用（请使用 https 或 localhost）。</div>
        )}

        <Lbl>WebDAV 地址</Lbl>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://dav.example.com/remote.php/dav/files/" style={inp} />
        <Lbl>用户名</Lbl>
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="your-name" style={inp} />
        <Lbl>密码 {hasStored ? '（已加密保存，留空则不修改）' : ''}</Lbl>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" style={inp} />

        <Btn onClick={onSave} disabled={saving} style={{ width: '100%', marginTop: 8 }}>
          <CloudUpload size={16} /> {saving ? '保存中…' : '保存并测试上传'}
        </Btn>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, color: 'var(--c-s500)', fontSize: 11, lineHeight: 1.6 }}>
          <Lock size={12} /> 备份用于同步你的生词本与笔记；真实模式由 webdav-upload 边缘函数完成上传。
        </div>
      </div>
    </div>
  )
}

function Lbl({ children }) {
  return <label style={{ fontSize: 13, color: 'var(--c-p600)', margin: '10px 0 6px', display: 'block' }}>{children}</label>
}
const inp = {
  width: '100%', padding: '12px 14px', border: '1px solid var(--c-p200)', borderRadius: 12,
  background: 'var(--c-surface)', color: 'var(--c-p800)', outline: 'none', fontSize: 14,
}
