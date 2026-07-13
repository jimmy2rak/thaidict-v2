import React, { useState, useEffect } from 'react'
import { ArrowLeft, Check, X, Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import {
  listPendingApprovals, approveApproval, rejectApproval, saveCommunityWord, addDictionaryWord,
  hasPermission, isSuperAdmin,
} from '../../lib/db/index.js'
import { Card, IconButton, Spinner, Badge } from '../../components/UIComponents.jsx'

export default function ApprovalCenterSection({ onClose }) {
  const { userId, userRole, toast, handleWordTap } = useApp()
  const [items, setItems] = useState(null)
  const [detail, setDetail] = useState(null)

  const canApprove = isSuperAdmin(userRole) || hasPermission(userRole, 'approve_entries')

  useEffect(() => {
    if (!canApprove) return
    load()
  }, [canApprove])

  const load = async () => {
    setItems(await listPendingApprovals())
  }

  const onApprove = async (id) => {
    const a = items.find((x) => x.id === id)
    if (!a) return
    await approveApproval(id, userId)
    // 批准后：写入社区词库（贡献记录）+ 按标准格式自动加入主词典（需求 #3）
    if (a.type === 'word') {
      const { zh_hint, ...entry } = a.payload || {}
      if (entry.word) {
        await saveCommunityWord(entry, a.requested_by, zh_hint || '')
        await addDictionaryWord(entry)
      }
    }
    // 后续可在此加入腾讯翻译君 API 校验 AI 词条是否与实际一致
    toast('已批准入库')
    setDetail(null)
    load()
  }

  const onReject = async (id) => {
    await rejectApproval(id, userId, '')
    toast('已拒绝')
    setDetail(null)
    load()
  }

  if (!canApprove) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-p500)', padding: 24, textAlign: 'center' }}>
          仅超级管理员或拥有审批权限的管理员可访问
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header onClose={onClose} count={items?.length} />
      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {items === null && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>}
        {items !== null && items.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--c-p500)', padding: 40 }}>
            <Sparkles size={32} style={{ marginBottom: 10, opacity: 0.6 }} />
            <div>暂无待审批内容</div>
          </div>
        )}
        {detail ? (
          <DetailView
            item={detail}
            onBack={() => setDetail(null)}
            onApprove={() => onApprove(detail.id)}
            onReject={() => onReject(detail.id)}
            onTapWord={handleWordTap}
          />
        ) : (
          items?.map((a) => (
            <Card key={a.id} onClick={() => setDetail(a)} style={{ cursor: 'pointer', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-p800)', fontFamily: 'var(--th-font)' }}>
                    {a.payload?.word || a.payload?.thai || 'AI 生成内容'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-p500)', marginTop: 2 }}>
                    {typeLabel(a.type)} · {new Date(a.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <Badge color="var(--c-gold)">待审批</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function Header({ onClose, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 8px', borderBottom: '1px solid var(--c-p100)' }}>
      <IconButton onClick={onClose} title="返回"><ArrowLeft size={20} /></IconButton>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>
        审批中心{count > 0 ? ` (${count})` : ''}
      </div>
      <div style={{ width: 38 }} />
    </div>
  )
}

function DetailView({ item, onBack, onApprove, onReject, onTapWord }) {
  const p = item.payload || {}
  const senses = p.senses || []
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IconButton onClick={onBack} title="返回"><ArrowLeft size={18} /></IconButton>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-p800)' }}>审批详情</span>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 4 }}>类型</div>
        <div style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{typeLabel(item.type)}</div>
      </Card>

      {p.word && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 4 }}>词条</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-p800)', fontFamily: 'var(--th-font)' }}>{p.word}</div>
          {p.romanization && <div style={{ fontSize: 13, color: 'var(--c-p500)' }}>{p.romanization}</div>}
        </Card>
      )}

      {senses.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 8 }}>义项</div>
          {senses.map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <Badge color="var(--c-teal)">{s.pos || '—'}</Badge>
              <span style={{ fontSize: 14, color: 'var(--c-p800)', marginLeft: 6 }}>{s.meaning}</span>
            </div>
          ))}
        </Card>
      )}

      {p.thai && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 4 }}>句子</div>
          <div style={{ fontSize: 16, color: 'var(--c-p800)', fontFamily: 'var(--th-font)' }}>{p.thai}</div>
          <div style={{ fontSize: 13, color: 'var(--c-p500)', marginTop: 4 }}>{p.zh}</div>
        </Card>
      )}

      {p.zh_hint && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--c-p600)', marginBottom: 4 }}>用户提示</div>
          <div style={{ fontSize: 14, color: 'var(--c-p800)' }}>{p.zh_hint}</div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onApprove} style={{ flex: 1, ...actionBtn('var(--c-teal)') }}><Check size={16} /> 批准入库</button>
        <button onClick={onReject} style={{ flex: 1, ...actionBtn('var(--c-rose)') }}><X size={16} /> 拒绝</button>
      </div>
    </div>
  )
}

function typeLabel(type) {
  return type === 'word' ? '词条' : type === 'sentence' ? '句子' : 'AI 生成'
}

function actionBtn(c) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '12px', borderRadius: 12, border: '1px solid ' + c, color: c,
    background: 'transparent', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  }
}
