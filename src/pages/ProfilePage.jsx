import React, { useState } from 'react'
import { Settings, KeyRound, CloudUpload, Bell, Award, LogOut, ChevronRight, User } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { signOut } from '../lib/db/index.js'
import { Card, IconButton } from '../components/UIComponents.jsx'

import SettingsSection from './subsections/SettingsSection.jsx'
import ApiKeysSection from './subsections/ApiKeysSection.jsx'
import WebDavSection from './subsections/WebDavSection.jsx'
import ReminderPage from './subsections/ReminderPage.jsx'
import AchievementsSection from './subsections/AchievementsSection.jsx'

export default function ProfilePage() {
  const app = useApp()
  const { user, userId, setSession, toast } = app
  const [view, setView] = useState('main')

  if (view === 'settings') return <SettingsSection onClose={() => setView('main')} />
  if (view === 'apikeys') return <ApiKeysSection onClose={() => setView('main')} />
  if (view === 'webdav') return <WebDavSection onClose={() => setView('main')} />
  if (view === 'reminder') return <ReminderPage onClose={() => setView('main')} />
  if (view === 'achievements') return <AchievementsSection onClose={() => setView('main')} />

  const name = user?.user_metadata?.username || user?.email?.split('@')[0] || '演示用户'
  const email = user?.email || 'demo@thaidict.local'
  const initial = (name || '?').slice(0, 1).toUpperCase()

  const rows = [
    { key: 'settings', icon: Settings, color: 'var(--c-teal)', label: '通用设置' },
    { key: 'apikeys', icon: KeyRound, color: 'var(--c-gold)', label: 'AI API 密钥' },
    { key: 'webdav', icon: CloudUpload, color: 'var(--c-info)', label: 'WebDAV 备份' },
    { key: 'reminder', icon: Bell, color: 'var(--c-rose)', label: '学习提醒' },
    { key: 'achievements', icon: Award, color: 'var(--c-amber)', label: '我的成就' },
  ]

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
              <span style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{r.label}</span>
              <ChevronRight size={18} color="var(--c-s500)" style={{ marginLeft: 'auto' }} />
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
