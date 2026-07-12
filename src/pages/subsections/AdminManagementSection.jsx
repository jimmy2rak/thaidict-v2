import React, { useState, useEffect } from 'react'
import { ArrowLeft, Shield, UserCog } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { listUsers, setUserRole, isSuperAdmin, hasPermission, PERMISSION_OPTIONS, ROLE_LABELS } from '../../lib/db/index.js'
import { Card, IconButton, Spinner } from '../../components/UIComponents.jsx'

export default function AdminManagementSection({ onClose }) {
  const { toast, userRole } = useApp()
  const [users, setUsers] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const data = await listUsers()
    setUsers(data)
  }

  if (!isSuperAdmin(userRole)) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-p500)', padding: 24, textAlign: 'center' }}>
          仅超级管理员可访问此页面
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header onClose={onClose} />
      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {selected ? (
          <UserEditor
            user={selected}
            onBack={() => setSelected(null)}
            onSaved={() => { setSelected(null); load(); toast('权限已更新') }}
          />
        ) : (
          <UserList users={users} onSelect={setSelected} />
        )}
      </div>
    </div>
  )
}

function Header({ onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
      <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>用户权限管理</div>
      <div style={{ width: 38 }} />
    </div>
  )
}

function UserList({ users, onSelect }) {
  if (users === null) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {users.map((u) => {
        const role = u.role || 'user'
        return (
          <Card key={u.id || u.user_id} onClick={() => onSelect(u)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--c-teal) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="var(--c-teal)" />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)' }}>{u.username || u.email || u.user_id}</div>
                <div style={{ fontSize: 12, color: 'var(--c-p500)' }}>{u.email || u.user_id}</div>
              </div>
              <Badge role={role} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function UserEditor({ user, onBack, onSaved }) {
  const [role, setRole] = useState(user.role || 'user')
  const [permissions, setPermissions] = useState(user.permissions || [])
  const [saving, setSaving] = useState(false)
  const superAdmin = isSuperAdmin(user)

  const toggle = (key) => {
    if (superAdmin) return
    setPermissions((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  const save = async () => {
    if (superAdmin) return
    setSaving(true)
    await setUserRole(user.id || user.user_id, role, permissions)
    setSaving(false)
    onSaved()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IconButton onClick={onBack} title="返回"><ArrowLeft size={18} /></IconButton>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{user.username || user.email || user.user_id}</span>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>角色</div>
        {superAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCog size={18} color="var(--c-info)" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)' }}>{ROLE_LABELS[user.role] || '用户'}</span>
          </div>
        ) : (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--c-p200)',
              background: 'var(--c-bg)', color: 'var(--c-p800)', fontSize: 14, outline: 'none',
            }}
          >
            <option value="user">用户</option>
            <option value="admin">管理员</option>
          </select>
        )}
        {superAdmin && (
          <div style={{ fontSize: 12, color: 'var(--c-gold)', marginTop: 8 }}>超级管理员只能在数据库中手动添加或移除，UI 中不可更改。</div>
        )}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>可授权权限（仅管理员）</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PERMISSION_OPTIONS.map((p) => {
            const checked = hasPermission({ role: user.role, permissions }, p.key) || permissions.includes(p.key)
            return (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: superAdmin ? 'not-allowed' : 'pointer', opacity: superAdmin ? 0.6 : 1 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={superAdmin}
                  onChange={() => toggle(p.key)}
                  style={{ accentColor: 'var(--c-teal)' }}
                />
                <span style={{ fontSize: 14, color: 'var(--c-p800)' }}>{p.label}</span>
              </label>
            )
          })}
        </div>
      </Card>

      {!superAdmin && (
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: 'var(--c-teal)', color: '#fff', fontSize: 15, fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '保存中…' : '保存权限'}
        </button>
      )}
    </div>
  )
}

function Badge({ role }) {
  const label = ROLE_LABELS[role] || '用户'
  const color = role === 'super_admin' ? 'var(--c-gold)' : role === 'admin' ? 'var(--c-teal)' : 'var(--c-s500)'
  return (
    <span style={{ padding: '3px 8px', borderRadius: 8, background: 'color-mix(in srgb, ' + color + ' 14%, transparent)', color, fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  )
}
