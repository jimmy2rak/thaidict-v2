import React, { useState, useEffect } from 'react'
import { Settings, KeyRound, CloudUpload, Bell, Award, LogOut, ChevronRight, User, Shield, ClipboardCheck, Github, GitBranch, Download } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { signOut, updateUserPassword, updateUserMeta } from '../lib/db/auth.js'
import { Card, IconButton } from '../components/UIComponents.jsx'
import { isSuperAdmin, hasPermission } from '../lib/db/index.js'

import SettingsSection from './subsections/SettingsSection.jsx'
import ApiKeysSection from './subsections/ApiKeysSection.jsx'
import WebDavSection from './subsections/WebDavSection.jsx'
import ReminderPage from './subsections/ReminderPage.jsx'
import AchievementsSection from './subsections/AchievementsSection.jsx'
import AdminManagementSection from './subsections/AdminManagementSection.jsx'
import ApprovalCenterSection from './subsections/ApprovalCenterSection.jsx'

export default function ProfilePage() {
  const app = useApp()
  const { user, userId, setSession, toast, userRole } = app
  const [view, setView] = useState('main')

  const GITHUB_REPO = 'https://github.com/jimmy2rak/thaidict-v2'
  const GIT_HASH = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GIT_HASH || 'dev'
  const GIT_BRANCH = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GIT_BRANCH || 'local'

  // 头像/昵称持久化（仅 localStorage，不入数据库）
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thaidict:profile') || '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ avatar: '', nickname: '', curPass: '', newPass: '' })
  const [editBusy, setEditBusy] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('thaidict:profile', JSON.stringify(profile)) } catch {}
  }, [profile])

  // 第三方登录检测（Google/GitHub OAuth 无本地密码）
  const isThirdParty = !!(user?.app_metadata?.provider && user.app_metadata.provider !== 'email')

  if (view === 'settings') return <SettingsSection onClose={() => setView('main')} />
  if (view === 'apikeys') return <ApiKeysSection onClose={() => setView('main')} />
  if (view === 'webdav') return <WebDavSection onClose={() => setView('main')} />
  if (view === 'reminder') return <ReminderPage onClose={() => setView('main')} />
  if (view === 'achievements') return <AchievementsSection onClose={() => setView('main')} />
  if (view === 'admin') return <AdminManagementSection onClose={() => setView('main')} />
  if (view === 'approvals') return <ApprovalCenterSection onClose={() => setView('main')} />
  if (editing) return <EditProfileSection
    user={user} profile={profile} isThirdParty={isThirdParty}
    onClose={() => { setEditing(false); setEditForm({ avatar: '', nickname: '', curPass: '', newPass: '' }) }}
    onSave={(p) => { setProfile(p); setEditing(false); setEditForm({ avatar: '', nickname: '', curPass: '', newPass: '' }) }}
    editForm={editForm} setEditForm={setEditForm}
    editBusy={editBusy} setEditBusy={setEditBusy}
    toast={toast}
  />

  const name = profile.nickname || user?.user_metadata?.username || user?.email?.split('@')[0] || '演示用户'
  const email = user?.email || 'demo@thaidict.local'
  const initial = (name || '?').slice(0, 1).toUpperCase()
  const avatarUrl = profile.avatar || user?.user_metadata?.avatar_url || ''

  const rows = [
    { key: 'settings', icon: Settings, color: 'var(--c-teal)', label: '通用设置', desc: '主题、中泰字体、字号、朗读速度' },
    { key: 'apikeys', icon: KeyRound, color: 'var(--c-gold)', label: 'AI API 密钥', desc: '管理大模型 API 与默认调用密钥' },
    { key: 'webdav', icon: Download, color: 'var(--c-info)', label: '导出与备份', desc: '学习数据加密备份与多格式导出' },
    { key: 'reminder', icon: Bell, color: 'var(--c-rose)', label: '学习提醒', desc: '每日提醒时间、频率、启用开关' },
    { key: 'achievements', icon: Award, color: 'var(--c-amber)', label: '我的成就', desc: '打卡、收藏、练习、单词书解锁记录' },
    isSuperAdmin(userRole)
      ? { key: 'admin', icon: Shield, color: 'var(--c-gold)', label: '用户权限管理', desc: '查看用户、授权管理员、设置可访问权限' }
      : null,
    (isSuperAdmin(userRole) || hasPermission(userRole, 'approve_entries'))
      ? { key: 'approvals', icon: ClipboardCheck, color: 'var(--c-teal)', label: '审批中心', desc: 'AI 生成词条/句子入库审批' }
      : null,
  ].filter(Boolean)

  const onLogout = async () => {
    await signOut()
    setSession(null)
    toast('已退出登录')
  }

  return (
    <div className="scroll-y" style={{ flex: 1, padding: '16px 16px 24px' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px 20px' }}>
        <button
          onClick={() => { setEditForm({ avatar: avatarUrl, nickname: name, curPass: '', newPass: '' }); setEditing(true) }}
          title="点击编辑头像与昵称"
          style={{ width: 58, height: 58, borderRadius: '50%', background: avatarUrl ? 'transparent' : 'var(--c-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0, border: 'none', cursor: 'pointer', overflow: 'hidden', padding: 0 }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="头像" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            initial
          )}
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-p800)' }}>{name}</div>
          <div style={{ fontSize: 13, color: 'var(--c-p500)', marginTop: 2 }}>{email}</div>
        </div>
      </div>

      {/* 入口列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const Icon = r.icon
          return (
            <Card key={r.key} onClick={() => setView(r.key)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, ' + r.color + ' 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={r.color} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'var(--c-s500)', marginTop: 2, lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <ChevronRight size={18} color="var(--c-s500)" />
            </Card>
          )
        })}
      </div>

      <button onClick={onLogout} style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--c-p200)', color: 'var(--c-p600)', background: 'var(--c-surface)', fontSize: 15, fontWeight: 600 }}>
        <LogOut size={16} /> 退出登录
      </button>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          title="GitHub 仓库"
          style={{ display: 'inline-flex', color: 'var(--c-s500)', opacity: 0.6 }}
        >
          <Github size={18} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4, color: 'var(--c-s500)', fontSize: 10 }}>
          <GitBranch size={10} />
          <span>{GIT_BRANCH} · {GIT_HASH}</span>
        </div>
      </div>
    </div>
  )
}

/* ---- 编辑头像/昵称/密码浮层 ---- */
function EditProfileSection({ user, profile, isThirdParty, onClose, onSave, editForm, setEditForm, editBusy, setEditBusy, toast }) {
  const handleSave = async () => {
    setEditBusy(true)
    try {
      // 保存昵称和头像到 localStorage
      const newProfile = {
        ...profile,
        avatar: editForm.avatar.trim() || undefined,
        nickname: editForm.nickname.trim() || undefined,
      }
      // 清理空值
      if (!newProfile.avatar) delete newProfile.avatar
      if (!newProfile.nickname) delete newProfile.nickname

      onSave(newProfile)

      // 昵称写入 Supabase user_metadata（头像仅 localStorage）
      if (newProfile.nickname) {
        await updateUserMeta({ username: newProfile.nickname })
      }

      // 密码修改（仅非第三方登录且有输入）
      if (!isThirdParty && editForm.newPass && editForm.curPass) {
        const res = await updateUserPassword(editForm.newPass)
        if (res?.error) {
          toast('密码修改失败：' + (typeof res.error === 'string' ? res.error : res.error?.message || '未知错误'))
        } else {
          toast(profile.nickname ? '资料已更新，密码已修改' : '资料已更新（密码修改成功）')
        }
      } else if (!isThirdParty && editForm.newPass) {
        toast('资料已更新（密码未保存：缺少当前密码）')
      } else {
        toast('资料已更新')
      }
    } catch (e) {
      toast('保存失败：' + e.message)
    } finally {
      setEditBusy(false)
    }
  }

  const previewAv = editForm.avatar?.trim() || profile.avatar || '' 

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'var(--c-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>编辑个人资料</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {/* 头像 */}
        <label style={lbl}>头像图片链接</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--c-p100)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewAv ? (
              <img src={previewAv} alt="预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={32} color="var(--c-p400)" />
            )}
          </div>
          <input
            value={editForm.avatar}
            onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
            placeholder="粘贴图片 URL…"
            style={inputStyle}
          />
        </div>
        <div style={{ fontSize: 10, color: 'var(--c-p400)', marginTop: 4, lineHeight: 1.5 }}>
          粘贴图片链接后上方实时预览。头像仅保存在本地浏览器中，不会上传至服务器。
        </div>

        {/* 昵称 */}
        <label style={{ ...lbl, marginTop: 18 }}>昵称</label>
        <input
          value={editForm.nickname}
          onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
          placeholder="输入昵称…"
          style={inputStyle}
        />

        {/* 密码 */}
        <label style={{ ...lbl, marginTop: 18 }}>修改密码</label>
        {isThirdParty ? (
          <div style={{ fontSize: 12, color: 'var(--c-p400)', padding: '12px', borderRadius: 10, background: 'var(--c-p100)' }}>
            你通过第三方账号（Google / GitHub）登录，暂无本地密码。如需修改密码，请通过对应平台操作。
          </div>
        ) : (
          <>
            <input
              type="password"
              value={editForm.curPass}
              onChange={(e) => setEditForm({ ...editForm, curPass: e.target.value })}
              placeholder="当前密码（不填则仅改头像和昵称）"
              style={inputStyle}
            />
            <input
              type="password"
              value={editForm.newPass}
              onChange={(e) => setEditForm({ ...editForm, newPass: e.target.value })}
              placeholder="新密码"
              style={{ ...inputStyle, marginTop: 8 }}
            />
          </>
        )}

        <button
          onClick={handleSave}
          disabled={editBusy}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, marginTop: 22,
            border: '1px solid var(--c-primary)', color: '#fff', background: 'var(--c-primary)',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: editBusy ? 0.6 : 1,
          }}
        >
          {editBusy ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

const ArrowLeft = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const lbl = { fontSize: 13, color: 'var(--c-p600)', marginBottom: 6, display: 'block' }
const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid var(--c-p200)', borderRadius: 12,
  background: 'var(--c-surface)', color: 'var(--c-p800)', outline: 'none', fontSize: 14,
}
