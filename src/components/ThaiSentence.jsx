import React, { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react'
import { getTokens, getDictVersion, subscribeDictVersion, cacheTokens } from '../utils/thaiToken'
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
 *   showMeanings: boolean  是否在每个分好的词后显示（中文释义）括号，默认 false
 */
export default function ThaiSentence({
  text = '',
  type = 'sentence',
  separator = '+',
  lookup = getWordMeanings,
  className = '',
  style = {},
  onWordClick,
  tokens: presetTokens,
  showMeanings = false,
}) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(type !== 'word')
  const [bubble, setBubble] = useState(null) // { word, x, y, status, meanings }
  const [meaningMap, setMeaningMap] = useState({}) // 分词后预查的中文释义 { word: string[] }
  const triedServerRef = useRef('') // 已尝试服务端兜底过的文本，避免重复请求
  // 订阅字典版本：真实词库加载后自动重跑分词（避免缓存住「字典未加载」时的错误结果）
  const dictVersion = useSyncExternalStore(
    subscribeDictVersion,
    getDictVersion,
    () => 0
  )

  // 分词：优先使用外部传入的预分词（如短语数据的 segmented 金标准）；
  // 原生词条直接下划线；其余长例句走缓存/分词客户端
  useEffect(() => {
    if (presetTokens && presetTokens.length) {
      setTokens(presetTokens.map((t) => ({ ...t, type: 'word' })))
      setLoading(false)
      return
    }
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
        // 服务端兜底：客户端仍残留未切块(residual)时，用服务端完整词典再分一次，结果回写缓存
        if (
          toks.some((t) => t.type === 'residual') &&
          triedServerRef.current !== text &&
          text.trim().length > 2
        ) {
          triedServerRef.current = text
          fetch('/api/thai-segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (j && Array.isArray(j.data) && j.data.length) {
                cacheTokens(text, j.data)
                if (!cancelled) setTokens(j.data)
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        if (cancelled) return
        setTokens([{ text, type: 'word' }])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [text, type, presetTokens, dictVersion])

  // showMeanings 模式下：每个分词自动查词典，在划线词后括号显示中文释义（参考近反义词）
  useEffect(() => {
    if (!showMeanings || !tokens.length) return
    const words = tokens
      .filter((t) => t.type === 'word' && t.text && !t.meaning && !meaningMap[t.text])
      .map((t) => t.text)
    if (!words.length) return
    let cancelled = false
    Promise.all(
      words.map(async (word) => {
        try {
          const meanings = await lookup(word)
          return { word, meanings: Array.isArray(meanings) ? meanings : [] }
        } catch {
          return { word, meanings: [] }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const next = {}
      for (const r of results) next[r.word] = r.meanings
      setMeaningMap((prev) => ({ ...prev, ...next }))
    })
    return () => {
      cancelled = true
    }
  }, [tokens, showMeanings, lookup, meaningMap])

  // 点击单词 → 仅弹气泡 + 查词（跳转详情交给气泡内的主词点击，避免一点就跳页）
  const handleWordClick = useCallback(
    (word, e) => {
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
    [lookup]
  )

  if (loading) {
    return (
      <span className={className} style={{ color: 'var(--c-p400)', ...style }}>
        …
      </span>
    )
  }

  // 仅非空格 token 参与渲染；只有「分好词的词汇块」(type==='word') 之间才加分隔符，
  // 未切分词块(residual)/标点不加分隔符、也不拆成单字母。
  const visible = tokens.filter((t) => t.type !== 'space')

  return (
    <span className={className} style={{ fontFamily: 'var(--th-font)', ...style }}>
      {visible.map((t, idx) => {
        const isWord = t.type === 'word'
        const prev = visible[idx - 1]
        // 分隔符仅出现在「前一个也是词块、且当前也是词块」时（避免词块与未切块之间出现多余 +）
        const showSep = isWord && prev && prev.type === 'word'
        return (
          <React.Fragment key={idx}>
            {showSep && <span style={{ opacity: 0.5 }}>{separator}</span>}
            {isWord ? (
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
                {showMeanings && (t.meaning || meaningMap[t.text]?.length) ? (
                  <span style={{ fontFamily: 'var(--zh-font)', fontSize: '0.75em', color: 'var(--c-p500)', marginLeft: 1 }}>
                    （{t.meaning || meaningMap[t.text].slice(0, 3).join('；')}）
                  </span>
                ) : null}
              </u>
            ) : (
              <span style={{ color: t.type === 'punct' ? 'var(--c-p700)' : 'var(--c-p800)' }}>
                {t.text}
              </span>
            )}
          </React.Fragment>
        )
      })}

      {bubble && (
        <WordBubble
          word={bubble.word}
          x={bubble.x}
          y={bubble.y}
          status={bubble.status}
          meanings={bubble.meanings}
          onClose={() => setBubble(null)}
          onWordClick={onWordClick}
        />
      )}
    </span>
  )
}
