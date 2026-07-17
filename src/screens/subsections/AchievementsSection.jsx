import React, { useState, useEffect } from 'react'
import { ArrowLeft, Award, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getAchievements, ACHIEVEMENT_DEFS } from '../../lib/db/index.js'
import { IconButton, Card, Spinner, EmptyState, AsyncBadge } from '../../components/UIComponents.jsx'
import { loadCache, saveCache } from '../../lib/asyncCache.js'

const ICONS = {
  flame: '🔥',
  bookmark: '🔖',
  award: '🏅',
  target: '🎯',
}

export default function AchievementsSection({ onClose }) {
  const app = useApp()
  const { userId } = app
  const CACHE_KEY = 'achievements'
  const cached = loadCache(CACHE_KEY)
  const [unlocked, setUnlocked] = useState(() => new Set(cached || []))
  const [loading, setLoading] = useState(!cached)
  const [bgLoading, setBgLoading] = useState(false)

  useEffect(() => {
    if (!userId) return setLoading(false)
    setBgLoading(true)
    getAchievements(userId).then((list) => {
      const keys = list.map((a) => a.badge_key)
      setUnlocked(new Set(keys))
      setLoading(false)
      setBgLoading(false)
      saveCache(CACHE_KEY, keys)
    })
  }, [userId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>我的成就</div>
        <div style={{ width: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <AsyncBadge loading={bgLoading} />
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {ACHIEVEMENT_DEFS.length === 0 ? (
          <EmptyState icon="🏅" text="暂无成就定义" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ACHIEVEMENT_DEFS.map((d) => {
              const got = unlocked.has(d.key)
              return (
                <Card key={d.key} style={{ textAlign: 'center', padding: 16, opacity: got ? 1 : 0.55 }}>
                  <div style={{ fontSize: 34 }}>{got ? (ICONS[d.icon] || '🏅') : <Lock size={28} color="var(--c-s500)" />}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-p800)', marginTop: 6 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 2 }}>{d.desc}</div>
                </Card>
              )
            })}
          </div>
        )}
        <div style={{ textAlign: 'center', color: 'var(--c-s500)', fontSize: 11, marginTop: 16 }}>
          完成打卡、收藏、练习与单词书即可解锁成就
        </div>
      </div>
    </div>
  )
}
