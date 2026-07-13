import React, { useState, useEffect } from 'react'
import { ArrowLeft, Star, Volume2, FolderPlus, X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  bookmarkSentence,
  isSentenceBookmarked,
  getFolders,
  addSentenceToFolder,
  createFolder,
} from '../lib/db/index.js'
import { speak } from '../utils/tts.js'
import { Card, Badge, IconButton, SectionTitle } from './UIComponents.jsx'
import ThaiSentence from './ThaiSentence.jsx'

/**
 * SentenceDetailView —— 句子/短语详情（参考图结构）
 * ------------------------------------------------------------------
 * 布局：
 *   顶栏：返回、标题、收藏
 *   标题卡：泰语 + 实际意义 + 朗读/收藏按钮
 *   逐词分析：ThaiSentence 标准分词，单词可点击跳转词条
 *   字面意义 vs 实际意义：左右并排卡片
 *   学习者建议：带图标说明卡片
 *   标签分类：标签 chips
 *   操作：加入句子夹
 */
export default function SentenceDetailView({ sentence, onClose, title = '词语详情' }) {
  const app = useApp()
  const { userId, handleWordTap, toast } = app

  const [bookmarked, setBookmarked] = useState(false)
  const [showFolder, setShowFolder] = useState(false)
  const [folders, setFolders] = useState([])
  const [newFolder, setNewFolder] = useState('')

  useEffect(() => {
    if (userId && sentence) isSentenceBookmarked(userId, sentence.id).then(setBookmarked)
  }, [userId, sentence])

  if (!sentence) return null

  const literal = sentence.literal || ''
  const actual = sentence.actual || sentence.zh || ''
  const advice = sentence.advice || sentence.note || ''
  const tags = sentence.tags || []

  const onPlay = () => speak(sentence.thai, { rate: 1.0, lang: 'th-TH' })

  const toggleBookmark = async () => {
    if (!userId) return toast('请先登录')
    if (bookmarked) return toast('已收藏')
    await bookmarkSentence(userId, sentence.id)
    setBookmarked(true)
    toast('已收藏')
  }

  const openFolder = async () => {
    setShowFolder(true)
    if (userId) setFolders(await getFolders(userId))
  }
  const onAdd = async (fid) => {
    await addSentenceToFolder(fid, sentence.id)
    setShowFolder(false)
    toast('已加入句子夹')
  }
  const onCreate = async () => {
    if (!newFolder.trim() || !userId) return
    const f = await createFolder(userId, newFolder.trim(), '#C4993D', 'sentence')
    setFolders(await getFolders(userId))
    if (f) await addSentenceToFolder(f.id, sentence.id)
    setNewFolder('')
    setShowFolder(false)
    toast('已创建并加入')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
        <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>{title}</div>
        <IconButton
          onClick={toggleBookmark}
          active={bookmarked}
          title="收藏"
        >
          <Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
        </IconButton>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {/* 标题卡 */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--th-font)', color: 'var(--c-p800)', lineHeight: 1.4 }}>
                {sentence.thai}
              </div>
              <div style={{ fontSize: 14, color: 'var(--c-p600)', marginTop: 6, lineHeight: 1.5 }}>
                {actual}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <IconButton onClick={onPlay} title="朗读"><Volume2 size={20} /></IconButton>
              <IconButton onClick={toggleBookmark} active={bookmarked} title="收藏">
                <Star size={20} fill={bookmarked ? 'var(--c-amber)' : 'none'} color={bookmarked ? 'var(--c-amber)' : 'var(--c-p600)'} />
              </IconButton>
            </div>
          </div>
        </Card>

        {/* 逐词分析 */}
        <SectionTitle>逐词分析</SectionTitle>
        <Card style={{ marginBottom: 14 }}>
          <ThaiSentence
            text={sentence.thai}
            type="sentence"
            separator=" + "
            onWordClick={handleWordTap}
            style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--c-p800)' }}
          />
        </Card>

        {/* 字面意义 vs 实际意义 */}
        <SectionTitle>字面意义 vs 实际意义</SectionTitle>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <Card style={{ flex: 1, background: 'color-mix(in srgb, var(--c-gold) 6%, var(--c-surface))' }}>
            <div style={{ fontSize: 12, color: 'var(--c-gold)', marginBottom: 6, fontWeight: 600 }}>字面意义</div>
            <div style={{ fontSize: 14, color: 'var(--c-p700)', lineHeight: 1.6 }}>{literal || '—'}</div>
          </Card>
          <Card style={{ flex: 1, background: 'color-mix(in srgb, var(--c-teal) 6%, var(--c-surface))' }}>
            <div style={{ fontSize: 12, color: 'var(--c-teal)', marginBottom: 6, fontWeight: 600 }}>实际意义</div>
            <div style={{ fontSize: 14, color: 'var(--c-p700)', lineHeight: 1.6 }}>{actual}</div>
          </Card>
        </div>

        {/* 学习者建议 */}
        {advice && (
          <>
            <SectionTitle>学习者建议</SectionTitle>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'color-mix(in srgb, var(--c-info) 16%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--c-info)', fontSize: 16, flexShrink: 0,
                }}>✦</div>
                <div style={{ fontSize: 14, color: 'var(--c-p700)', lineHeight: 1.7 }}>{advice}</div>
              </div>
            </Card>
          </>
        )}

        {/* 标签分类 */}
        {tags.length > 0 && (
          <>
            <SectionTitle>标签分类</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {tags.map((t, i) => (
                <Badge key={i} color="var(--c-info)">{t}</Badge>
              ))}
            </div>
          </>
        )}

        {/* 操作 */}
        <button onClick={openFolder} style={actionBtn}>
          <FolderPlus size={16} /> 加入文件夹
        </button>
      </div>

      {/* 文件夹选择弹层 */}
      {showFolder && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--c-surface)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '70%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-p800)' }}>选择句子夹</div>
              <IconButton onClick={() => setShowFolder(false)} title="关闭"><X size={18} /></IconButton>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="新建句子夹"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--c-p200)', borderRadius: 10, fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-p800)', outline: 'none' }}
              />
              <button onClick={onCreate} style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--c-teal)', color: '#fff', cursor: 'pointer' }}><FolderPlus size={14} /></button>
            </div>
            {folders.filter((f) => f.folder_type === 'sentence').map((f) => (
              <button key={f.id} onClick={() => onAdd(f.id)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 8px', background: 'var(--c-p100)', border: 'none', borderRadius: 10, fontSize: 14, color: 'var(--c-p800)', cursor: 'pointer', marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, display: 'inline-block', marginRight: 8 }} />
                {f.name} <span style={{ color: 'var(--c-s500)', fontSize: 12 }}>({f.sentenceCount || 0})</span>
              </button>
            ))}
            {folders.filter((f) => f.folder_type === 'sentence').length === 0 && (
              <div style={{ color: 'var(--c-s500)', fontSize: 13 }}>暂无句子夹，先新建一个吧</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const actionBtn = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '12px',
  borderRadius: 12,
  border: '1px solid var(--c-teal)',
  color: 'var(--c-teal)',
  background: 'transparent',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
