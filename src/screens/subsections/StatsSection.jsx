import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Flame, Target, CheckCircle2, BookMarked } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useApp } from '../../context/AppContext.jsx'
import {
  getStreak, getBookmarks, getPracticeStats, getWeeklyStudyMinutes,
  getCheckinHeatmapData, getUserRecentWords,
} from '../../lib/db/index.js'
import { getGlobal } from '../../lib/mock/store.js'
import { IconButton, Card, Spinner } from '../../components/UIComponents.jsx'

const PIE_COLORS = ['#9FB08E', '#C2A878', '#C08A7A', '#8FA3B0', '#C9A86A', '#9C8467']
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function StatsSection({ onClose }) {
  const app = useApp()
  const { userId } = app
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({ streak: 0, bookmarks: 0, practice: { count: 0, accuracy: 0, total: 0 } })
  const [weekly, setWeekly] = useState([])
  const [heatmap, setHeatmap] = useState([])
  const [pie, setPie] = useState([])

  useEffect(() => {
    if (!userId) return setLoading(false)
    ;(async () => {
      const [streak, bms, pstats, wk, heat, recent] = await Promise.all([
        getStreak(userId),
        getBookmarks(userId),
        getPracticeStats(userId),
        getWeeklyStudyMinutes(userId),
        getCheckinHeatmapData(userId, 35),
        getUserRecentWords(userId, 200),
      ])
      setOverview({ streak, bookmarks: bms.length, practice: pstats })
      setWeekly(wk.map((v, i) => ({ name: WEEK_LABELS[i], 分钟: v })))
      setHeatmap(heat)
      // 词性分布（来自最近查词；无则取词典样本）
      const dist = {}
      recent.forEach((r) => {
        const pos = (r.senses && r.senses[0] && r.senses[0].pos) || '其他'
        dist[pos] = (dist[pos] || 0) + 1
      })
      if (Object.keys(dist).length === 0) {
        getGlobal('dictionary', []).slice(0, 100).forEach((r) => {
          const pos = ((r.senses && r.senses[0] && r.senses[0].pos) || '其他')
          dist[pos] = (dist[pos] || 0) + 1
        })
      }
      setPie(Object.entries(dist).map(([name, value]) => ({ name, value })))
      setLoading(false)
    })()
  }, [userId])

  const maxHeat = useMemo(() => Math.max(1, ...heatmap.map((h) => h.count)), [heatmap])

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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>学习统计</div>
        <div style={{ width: 38 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {/* 概览 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <Ov icon={Flame} color="#C2A878" value={overview.streak} label="连续打卡" />
          <Ov icon={BookMarked} color="#C9A86A" value={overview.bookmarks} label="收藏词数" />
          <Ov icon={Target} color="#9FB08E" value={overview.practice.count} label="练习次数" />
          <Ov icon={CheckCircle2} color="#8FA3B0" value={overview.practice.accuracy + '%'} label="正确率" />
        </div>

        {/* 周学习时长 */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-p600)', marginBottom: 8 }}>本周学习时长（分钟）</div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={weekly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--c-p500)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--c-s500)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none' }} />
                <Bar dataKey="分钟" fill="#9FB08E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 月度热力图 */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-p600)', marginBottom: 10 }}>近 35 天打卡热力图</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {heatmap.map((h, i) => {
              const intensity = h.count / maxHeat
              const bg = h.count === 0 ? 'var(--c-p100)' : `rgba(159,176,142,${0.25 + intensity * 0.75})`
              return (
                <div
                  key={i}
                  title={h.date + (h.count ? ` · ${h.count} 次` : '')}
                  style={{ aspectRatio: '1 / 1', borderRadius: 5, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {h.count > 0 ? <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{h.count}</span> : null}
                </div>
              )
            })}
          </div>
        </Card>

        {/* 词性分布饼图 */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-p600)', marginBottom: 8 }}>学习词性分布</div>
          {pie.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--c-p500)', textAlign: 'center', padding: 20 }}>暂无数据</div>
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" outerRadius={70} label={(e) => e.name} labelLine={false}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Ov({ icon: Icon, color, value, label }) {
  return (
    <Card style={{ flex: 1, padding: '10px 6px', textAlign: 'center' }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-p800)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--c-p500)' }}>{label}</div>
    </Card>
  )
}
