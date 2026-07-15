import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, KeyRound, Star, StarOff, Server, ShieldCheck, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getApiKeys, saveApiKey, deleteApiKey, setDefaultApi, isSuperAdmin, hasPermission } from '../../lib/db/index.js'
import { fetchSystemAi, updateSystemAi } from '../../lib/db/systemAiApi.js'
import { IconButton, Card, Spinner, Btn, EmptyState } from '../../components/UIComponents.jsx'

const PROVIDERS = [
  { v: 'openai', l: 'OpenAI' },
  { v: 'deepseek', l: 'DeepSeek' },
  { v: 'gemini', l: 'Gemini' },
  { v: 'custom', l: '自定义' },
]
const provLabel = (v) => PROVIDERS.find((p) => p.v === v)?.l || v

export default function ApiKeysSection({ onClose }) {
  const app = useApp()
  const { userId, toast, userRole } = app
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null=list, {} = new, {id,...} = edit
  const [form, setForm] = useState({ name: '', provider: 'openai', key: '', base_url: '', model: 'gpt-4o' })
  const [defaultId, setDefaultId] = useState(null)
  const [saving, setSaving] = useState(false)

  // 系统内置 AI API
  const [systemAi, setSystemAi] = useState(null)
  const [loadingSystem, setLoadingSystem] = useState(true)
  const [editingSystem, setEditingSystem] = useState(false)
  const [sysForm, setSysForm] = useState({ provider: 'openai', base_url: '', model: '', key: '' })
  const [savingSystem, setSavingSystem] = useState(false)

  const canEditSystem = isSuperAdmin(userRole) || hasPermission(userRole, 'manage_system_ai')

  const load = async () => {
    if (!userId) { setLoading(false); setLoadingSystem(false); return }
    const [keys, settings] = await Promise.all([
      getApiKeys(userId),
      import('../../lib/db/index.js').then((m) => m.getUserSettings(userId)),
    ])
    setList(keys)
    setDefaultId(settings.default_api_id || null)
    setLoading(false)

    const sys = await fetchSystemAi()
    setSystemAi(sys)
    setLoadingSystem(false)
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

  const openSystemEdit = () => {
    setSysForm({
      provider: systemAi?.provider || 'openai',
      base_url: systemAi?.base_url || '',
      model: systemAi?.model || '',
      key: '',
    })
    setEditingSystem(true)
  }
  const onSaveSystem = async () => {
    setSavingSystem(true)
    try {
      await updateSystemAi(sysForm)
      setSavingSystem(false)
      setEditingSystem(false)
      toast('系统内置 AI API 已更新')
      const sys = await fetchSystemAi()
      setSystemAi(sys)
    } catch (e) {
      setSavingSystem(false)
      alert(e.message || '保存失败')
    }
  }

  if (editingSystem) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
          <IconButton onClick={() => setEditingSystem(false)} title="返回"><ArrowLeft size={20} /></IconButton>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>编辑系统内置 AI API</div>
          <div style={{ width: 38 }} />
        </div>
        <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
          <Lbl>服务商</Lbl>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {PROVIDERS.map((p) => (
              <button key={p.v} onClick={() => setSysForm({ ...sysForm, provider: p.v })} style={chip(p.v === sysForm.provider)}>{p.l}</button>
            ))}
          </div>
          <Lbl>Base URL</Lbl>
          <input value={sysForm.base_url} onChange={(e) => setSysForm({ ...sysForm, base_url: e.target.value })} placeholder="https://api.openai.com/v1" style={inp} />
          <Lbl>模型</Lbl>
          <input value={sysForm.model} onChange={(e) => setSysForm({ ...sysForm, model: e.target.value })} placeholder="gpt-4o" style={inp} />
          <Lbl>API Key {systemAi?.keySet ? `（当前：${systemAi.keyMasked}）` : '（当前未配置）'}</Lbl>
          <input value={sysForm.key} onChange={(e) => setSysForm({ ...sysForm, key: e.target.value })} placeholder="留空则保留现有密钥" style={inp} type="password" />
          <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 6 }}>密钥仅存储于服务端 system_config，前端不以明文显示。</div>
          <Btn onClick={onSaveSystem} disabled={savingSystem} style={{ width: '100%', marginTop: 14 }}>{savingSystem ? '保存中…' : '保存'}</Btn>
        </div>
      </div>
    )
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
        {/* 系统内置 AI API（默认调用，密钥打码） */}
        <div style={{ fontSize: 12, color: 'var(--c-p500)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Server size={14} color="var(--c-gold)" /> 系统内置（默认调用，无需用户配置）
        </div>
        {loadingSystem || !systemAi ? (
          <Card style={{ marginBottom: 16, opacity: 0.7 }}><div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><Spinner /></div></Card>
        ) : (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={16} color="var(--c-gold)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>
                    系统内置 AI API
                    <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'color-mix(in srgb, var(--c-gold) 16%, transparent)', color: 'var(--c-gold)' }}>默认</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{provLabel(systemAi.provider)} · {systemAi.model || '—'}</div>
                </div>
              </div>
              {canEditSystem ? (
                <button onClick={openSystemEdit} style={{ color: 'var(--c-info)', fontSize: 13, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--c-p200)', background: 'var(--c-surface)' }}>编辑</button>
              ) : (
                <Lock size={15} color="var(--c-s500)" />
              )}
            </div>
            {systemAi.base_url ? <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 6, wordBreak: 'break-all' }}>{systemAi.base_url}</div> : null}
            <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} color={systemAi.keySet ? 'var(--c-teal)' : 'var(--c-s500)'} />
              {systemAi.keySet ? `已配置 · ${systemAi.keyMasked}` : '未配置密钥'}
            </div>
            {!canEditSystem && <div style={{ fontSize: 11, color: 'var(--c-p500)', marginTop: 6 }}>仅超级管理员或被授权管理员可编辑</div>}
          </Card>
        )}

        {/* 用户自己的密钥 */}
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
