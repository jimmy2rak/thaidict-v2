import React, { useState } from 'react'
import { Settings, KeyRound, CloudUpload, Bell, Award, LogOut, ChevronRight, User, Shield, ClipboardCheck } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { signOut } from '../lib/db/index.js'
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

  if (view === 'settings') return <SettingsSection onClose={() => setView('main')} />
  if (view === 'apikeys') return <ApiKeysSection onClose={() => setView('main')} />
  if (view === 'webdav') return <WebDavSection onClose={() => setView('main')} />
  if (view === 'reminder') return <ReminderPage onClose={() => setView('main')} />
  if (view === 'achievements') return <AchievementsSection onClose={() => setView('main')} />
  if (view === 'admin') return <AdminManagementSection onClose={() => setView('main')} />
  if (view === 'approvals') return <ApprovalCenterSection onClose={() => setView('main')} />

  const name = user?.user_metadata?.username || user?.email?.split('@')[0] || '演示用户'
  const email = user?.email || 'demo@thaidict.local'
  const initial = (name || '?').slice(0, 1).toUpperCase()

  const rows = [
    { key: 'settings', icon: Settings, color: 'var(--c-teal)', label: '通用设置', desc: '主题、字体、字号、朗读速度、翻译方向' },
    { key: 'apikeys', icon: KeyRound, color: 'var(--c-gold)', label: 'AI API 密钥', desc: '管理大模型 API 与默认调用密钥' },
    { key: 'webdav', icon: CloudUpload, color: 'var(--c-info)', label: 'WebDAV 备份', desc: '学习数据加密备份与恢复' },
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
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--c-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
          {initial}
        </div>
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

      <div style={{ textAlign: 'center', color: 'var(--c-s500)', fontSize: 11, marginTop: 24 }}>
        ThaiDict · 中泰词典 · 本地开发中
      </div>
    </div>
  )
}
