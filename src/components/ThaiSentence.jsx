import React, { useEffect, useState, useCallback } from 'react'
import { getTokens } from '../utils/thaiToken'
import { getWordMeanings } from '../lib/db/search.js'
import WordBubble from './WordBubble.jsx'

/**
 * ThaiSentence —— 泰语例句 / 单词 渲染组件
 * ------------------------------------------------------------------
 * 功能：
 *   1) 分词：长例句先读 localStorage 永久缓存，无缓存则本地分词并写回缓存；
 *            同一句子只分词一次；300ms 内重复相同文本直接复用结果（防抖）。
 *   2) 渲染：分词结果遍历渲染，每个单词包裹 <u> 下划线，单词之间用 separator 隔开。
 *   3) 点击：带下划线的单词被点击时，弹出悬浮气泡并查询释义；
 *            标点单独成词但点击不触发查词；查不到则提示「暂无该词条释义」。
 *   4) 容错：分词异常时降级简易音节粗分，再异常则原句不拆分，页面绝不崩。
 *
 * 用法：
 *   // 长例句（自动分词 + 缓存 + 点击查词）
 *   <ThaiSentence text="สวัสดีค่ะ ฉันชอบหมา" />
 *   // 数据库原生词条（不分词，直接加下划线、绑定点击）
 *   <ThaiSentence text="หมา" type="word" />
 *   // 自定义连接符 / 查词函数
 *   <ThaiSentence text="..." separator=" " lookup={myLookup} onWordClick={fn} />
 *
 * Props：
 *   text      : string  要渲染的泰语文本（必填）
 *   type      : 'sentence' | 'word'  默认 'sentence'（原生词条用 'word' 跳过求值）
 *   separator : string  单词间连接符，默认 '+'
 *   lookup    : (word)=>Promise<string[]|null>  查词函数，默认项目内置 getWordMeanings
 *   onWordClick: (word)=>void  额外点击回调（如同时打开详情页）
 *   className / style : 透传到根节点
 */
export default function ThaiSentence({
  text = '',
  type = 'sentence',
  separator = '+',
  lookup = getWordMeanings,
  className = '',
  style = {},
  onWordClick,
}) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(type !== 'word')
  const [bubble, setBubble] = useState(null) // { word, x, y, status, meanings }

  // 分词：原生词条直接下划线；长例句走缓存/分词客户端
  useEffect(() => {
    if (type === 'word') {
      setTokens([{ text, type: 'word' }])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getTokens(text)
      .then((toks) => {
        if (cancelled) return
        setTokens(toks)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setTokens([{ text, type: 'word' }])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [text, type])

  // 点击单词 → 弹气泡 + 查词
  const handleWordClick = useCallback(
    (word, e) => {
      onWordClick?.(word)
      const x = e.clientX ?? 80
      const y = (e.clientY ?? 120) + 12
      setBubble({ word, x, y, status: 'loading', meanings: [] })
      Promise.resolve(lookup(word))
        .then((res) => {
          const arr = Array.isArray(res) ? res : null
          setBubble((b) =>
            b && b.word === word
              ? { ...b, status: arr && arr.length ? 'done' : 'empty', meanings: arr || [] }
              : b
          )
        })
        .catch(() =>
          setBubble((b) => (b && b.word === word ? { ...b, status: 'empty', meanings: [] } : b))
        )
    },
    [lookup, onWordClick]
  )

  if (loading) {
    return (
      <span className={className} style={{ color: 'var(--c-p400)', ...style }}>
        …
      </span>
    )
  }

  // 仅非空格 token 参与渲染；单词之间用 separator 连接
  const visible = tokens.filter((t) => t.type !== 'space')

  return (
    <span className={className} style={{ fontFamily: 'var(--th-font)', ...style }}>
      {visible.map((t, idx) => (
        <React.Fragment key={idx}>
          {t.type === 'word' ? (
            <u
              onClick={(e) => {
                e.stopPropagation()
                handleWordClick(t.text, e)
              }}
              style={{
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                color: 'var(--c-p800)',
              }}
            >
              {t.text}
            </u>
          ) : (
            <span style={{ color: 'var(--c-p700)' }}>{t.text}</span>
          )}
          {idx < visible.length - 1 && <span style={{ opacity: 0.5 }}>{separator}</span>}
        </React.Fragment>
      ))}

      {bubble && (
        <WordBubble
          word={bubble.word}
          x={bubble.x}
          y={bubble.y}
          status={bubble.status}
          meanings={bubble.meanings}
          onClose={() => setBubble(null)}
        />
      )}
    </span>
  )
}
