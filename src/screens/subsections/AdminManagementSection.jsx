import React, { useState, useEffect } from 'react'
import { ArrowLeft, Shield, UserCog, Copy, Check, Database, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { isSuperAdmin, hasPermission, PERMISSION_OPTIONS, ROLE_LABELS } from '../../lib/db/index.js'
import { fetchMembers, adminSetRole } from '../../lib/db/adminApi.js'
import { Card, IconButton, Spinner } from '../../components/UIComponents.jsx'

export default function AdminManagementSection({ onClose }) {
  const { toast, userRole } = useApp()
  const [users, setUsers] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const data = await fetchMembers()
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
          <>
            <DbGuideCard />
            <div style={{ height: 12 }} />
            <UserList users={users} onSelect={setSelected} />
          </>
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
  if (users.length === 0) return <div style={{ textAlign: 'center', color: 'var(--c-p500)', padding: 40 }}>暂无成员</div>
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username || u.email || u.user_id}</div>
                <div style={{ fontSize: 12, color: 'var(--c-p500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || u.user_id}</div>
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
    try {
      await adminSetRole(user.id || user.user_id, role, permissions)
      onSaved()
    } catch (e) {
      setSaving(false)
      alert(e.message || '保存失败')
    }
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
          <div style={{ fontSize: 12, color: 'var(--c-gold)', marginTop: 8 }}>超级管理员只能在数据库中手动添加或移除，UI 中不可更改（见下方「数据库操作指南」）。</div>
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
    <span style={{ padding: '3px 8px', borderRadius: 8, background: 'color-mix(in srgb, ' + color + ' 14%, transparent)', color, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
      {label}
    </span>
  )
}

/* ============ 数据库操作指南（仅超管可见） ============ */

const SQL_SET_SUPER = `-- 将指定邮箱用户设为「超级管理员」（自动解析 UUID，幂等）
insert into user_roles (user_id, role, permissions, updated_at)
select id, 'super_admin', array[]::text[], now()
from auth.users
where email = 'mindsoya@gmail.com'
on conflict (user_id)
do update set role = 'super_admin', permissions = array[]::text[], updated_at = now();`

const SQL_REMOVE_SUPER = `-- 取消某用户的超级管理员（降级为普通用户）
update user_roles
set role = 'user', permissions = array[]::text[], updated_at = now()
where user_id = (select id from auth.users where email = 'mindsoya@gmail.com');`

const SQL_PROMOTE_ADMIN = `-- 通过数据库直接将某用户提升为「管理员」（可选，UI 也可操作）
insert into user_roles (user_id, role, permissions, updated_at)
select id, 'admin', array['approve_entries','manage_users','manage_settings','view_stats'], now()
from auth.users
where email = 'someone@example.com'
on conflict (user_id)
do update set role = 'admin', updated_at = now();`

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 忽略
    }
  }
  return (
    <button
      onClick={onCopy}
      title="复制 SQL"
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8,
        border: '1px solid var(--c-p200)', background: 'var(--c-surface)', color: 'var(--c-p600)',
        fontSize: 12, cursor: 'pointer', flexShrink: 0,
      }}
    >
      {copied ? <Check size={13} color="var(--c-teal)" /> : <Copy size={13} />}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function SqlBlock({ title, sql }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-p700)' }}>{title}</span>
        <CopyBtn text={sql} />
      </div>
      <pre style={{
        margin: 0, padding: 12, borderRadius: 10, background: '#2b2722', color: '#f3ead7',
        fontSize: 12, lineHeight: 1.55, overflowX: 'auto', whiteSpace: 'pre',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}>{sql}</pre>
    </div>
  )
}

function DbGuideCard() {
  const [open, setOpen] = useState(false)
  return (
    <Card style={{ marginBottom: 0, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <Database size={18} color="var(--c-gold)" />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--c-p800)' }}>数据库操作指南（超级管理员）</span>
        <ChevronDown size={18} color="var(--c-p500)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--c-p500)', marginBottom: 12, lineHeight: 1.6 }}>
            超级管理员（super_admin）只能通过在 Supabase SQL Editor 手动执行以下指令设置，UI 无法创建或修改。
            在「用户权限管理」里你只能把成员提升为「管理员」（admin），不能提升为超级管理员。
          </div>
          <SqlBlock title="① 设为超级管理员" sql={SQL_SET_SUPER} />
          <SqlBlock title="② 取消超级管理员" sql={SQL_REMOVE_SUPER} />
          <SqlBlock title="③ （可选）数据库直接提升管理员" sql={SQL_PROMOTE_ADMIN} />
        </div>
      )}
    </Card>
  )
}
