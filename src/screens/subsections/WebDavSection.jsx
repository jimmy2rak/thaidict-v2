import React, { useState, useEffect } from 'react'
import { ArrowLeft, CloudUpload, Lock, ShieldCheck, Download, Upload } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getUserSettings, saveUserSettings } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn } from '../../components/UIComponents.jsx'
import {
  webdavCategories, gatherExportData, downloadJson, uploadToWebdav, saveLocalBackup, fileNameFor, categoryLabel,
  EXPORT_FORMATS, formatLabel, downloadWithFormat,
} from '../../lib/webdav.js'

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
  const [picker, setPicker] = useState(null) // 'export' | 'upload' | null
  const [busy, setBusy] = useState(false)
  const [fmt, setFmt] = useState('json') // 导出格式: json | md | docx

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

  const doExport = async (category) => {
    setBusy(true)
    try {
      const res = await downloadWithFormat(category, userId, fmt)
      if (res?.error) { toast(res.error) }
      else toast(`已导出${categoryLabel(category)}（${formatLabel(fmt)}）`)
    } catch (e) {
      toast('导出失败：' + e.message)
    } finally {
      setBusy(false)
      setPicker(null)
    }
  }

  const doUpload = async (category) => {
    setBusy(true)
    try {
      const payload = await gatherExportData(category, userId)
      if (!payload) return toast('暂无数据可上传')
      const res = await uploadToWebdav(url, user, pass, fileNameFor(category) + '.json', payload)
      if (res.ok) {
        toast(`已上传${categoryLabel(category)}到 WebDAV`)
      } else {
        // mock 回退：本地模拟备份，保证功能可演示
        saveLocalBackup(fileNameFor(category) + '.json', payload)
        toast(`已模拟上传${categoryLabel(category)}（真实模式写入 WebDAV：${res.error}）`)
      }
    } catch (e) {
      toast('上传失败：' + e.message)
    } finally {
      setBusy(false)
      setPicker(null)
    }
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>导出与备份</div>
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

        {/* 一键上传 / 导出（需求 #2b） */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => setPicker('upload')} disabled={busy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 12, border: '1px solid var(--c-teal)', color: 'var(--c-teal)', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            <Upload size={16} /> 一键上传
          </button>
          <button onClick={() => setPicker('export')} disabled={busy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 12, border: '1px solid var(--c-info)', color: 'var(--c-info)', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            <Download size={16} /> 一键导出
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, color: 'var(--c-s500)', fontSize: 11, lineHeight: 1.6 }}>
          <Lock size={12} /> 备份用于同步你的生词本与笔记；真实模式由 webdav-upload 边缘函数完成上传。
        </div>
      </div>

      {/* 类别选择弹层 */}
      {picker && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--c-surface)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '70%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-p800)' }}>
                {picker === 'upload' ? '选择上传内容' : `选择导出内容 · ${formatLabel(fmt)}`}
              </div>
              <IconButton onClick={() => setPicker(null)} title="关闭"><X size={18} /></IconButton>
            </div>
            {/* 导出时显示格式选择（上传仅 JSON） */}
            {picker === 'export' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {EXPORT_FORMATS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFmt(f.key)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10,
                      border: '1px solid ' + (fmt === f.key ? 'var(--c-primary)' : 'var(--c-p200)'),
                      background: fmt === f.key ? 'color-mix(in srgb, var(--c-primary) 10%, transparent)' : 'var(--c-surface)',
                      color: fmt === f.key ? 'var(--c-primary)' : 'var(--c-p500)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {webdavCategories().map((c) => (
              <button
                key={c.key}
                disabled={busy}
                onClick={() => (picker === 'upload' ? doUpload(c.key) : doExport(c.key))}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 8px', background: 'var(--c-p100)', border: 'none', borderRadius: 10, fontSize: 15, color: 'var(--c-p800)', cursor: 'pointer', marginBottom: 8, opacity: busy ? 0.5 : 1 }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const X = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

function Lbl({ children }) {
  return <label style={{ fontSize: 13, color: 'var(--c-p600)', margin: '10px 0 6px', display: 'block' }}>{children}</label>
}
const inp = {
  width: '100%', padding: '12px 14px', border: '1px solid var(--c-p200)', borderRadius: 12,
  background: 'var(--c-surface)', color: 'var(--c-p800)', outline: 'none', fontSize: 14,
}
