import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, KeyRound, Star, StarOff } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getApiKeys, saveApiKey, deleteApiKey, setDefaultApi } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, Btn, EmptyState } from '../../components/UIComponents.jsx'

const PROVIDERS = [
  { v: 'openai', l: 'OpenAI' },
  { v: 'deepseek', l: 'DeepSeek' },
  { v: 'gemini', l: 'Gemini' },
  { v: 'custom', l: '自定义' },
]

export default function ApiKeysSection({ onClose }) {
  const app = useApp()
  const { userId, toast } = app
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null=list, {} = new, {id,...} = edit
  const [form, setForm] = useState({ name: '', provider: 'openai', key: '', base_url: '', model: 'gpt-4o' })
  const [defaultId, setDefaultId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!userId) return setLoading(false)
    const [keys, settings] = await Promise.all([getApiKeys(userId), import('../../lib/db/index.js').then((m) => m.getUserSettings(userId))])
    setList(keys)
    setDefaultId(settings.default_api_id || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [userId])

  const openNew = () => { setForm({ name: '', provider: 'openai', key: '', base_url: '', model: 'gpt-4o' }); setEditing({}) }
  const openEdit = (k) => { setForm({ name: k.name, provider: k.provider, key: k.key || '', base_url: k.base_url || '', model: k.model || 'gpt-4o' }); setEditing(k) }

  const onSave = async () => {
    if (!userId) return
    if (!form.key.trim() && !editing.id) return toast('请填写 API Key')
    setSaving(true)
    await saveApiKey(userId, { id: editing.id, ...form })
    setSaving(false)
    setEditing(null)
    toast('已保存密钥')
    load()
  }

  const onDelete = async (id) => {
    await deleteApiKey(userId, id)
    toast('已删除')
    load()
  }
  const onSetDefault = async (id) => {
    await setDefaultApi(userId, id)
    setDefaultId(id)
    toast('已设为默认')
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  if (editing) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
          <IconButton onClick={() => setEditing(null)} title="返回"><ArrowLeft size={20} /></IconButton>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{editing.id ? '编辑密钥' : '新增密钥'}</div>
          <div style={{ width: 38 }} />
        </div>
        <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
          <Lbl>名称</Lbl>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：我的 OpenAI" style={inp} />
          <Lbl>服务商</Lbl>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {PROVIDERS.map((p) => (
              <button key={p.v} onClick={() => setForm({ ...form, provider: p.v })} style={chip(p.v === form.provider)}>{p.l}</button>
            ))}
          </div>
          <Lbl>API Key</Lbl>
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="sk-..." style={inp} />
          <Lbl>Base URL（可选）</Lbl>
          <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.openai.com/v1" style={inp} />
          <Lbl>模型</Lbl>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o" style={inp} />
          <Btn onClick={onSave} disabled={saving} style={{ width: '100%', marginTop: 8 }}>{saving ? '保存中…' : '保存'}</Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>AI API 密钥</div>
        <button onClick={openNew} style={{ width: 38, display: 'flex', justifyContent: 'center', color: 'var(--c-teal)' }}><Plus size={20} /></button>
      </div>
      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {list.length === 0 ? (
          <EmptyState icon="🔑" text="还没有配置 API 密钥" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((k) => (
              <Card key={k.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={16} color="var(--c-gold)" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>{k.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{k.provider} · {k.model}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => onSetDefault(k.id)} title="设为默认" style={{ color: defaultId === k.id ? 'var(--c-amber)' : 'var(--c-s500)' }}>
                      {defaultId === k.id ? <Star size={18} fill="var(--c-amber)" /> : <StarOff size={18} />}
                    </button>
                    <button onClick={() => openEdit(k)} style={{ color: 'var(--c-info)', fontSize: 13, padding: '4px 8px' }}>编辑</button>
                    <button onClick={() => onDelete(k.id)} style={{ color: 'var(--c-rose)' }}><Trash2 size={16} /></button>
                  </div>
                </div>
                {defaultId === k.id && <div style={{ fontSize: 11, color: 'var(--c-amber)', marginTop: 4 }}>当前默认</div>}
              </Card>
            ))}
          </div>
        )}
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
const chip = (active) => ({
  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
  border: '1px solid ' + (active ? 'var(--c-teal)' : 'var(--c-p200)'),
  background: active ? 'color-mix(in srgb, var(--c-teal) 14%, transparent)' : 'var(--c-surface)',
  color: active ? 'var(--c-teal)' : 'var(--c-p500)',
})
