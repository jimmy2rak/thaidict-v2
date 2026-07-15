import { NextResponse } from 'next/server'
import { serverTokenize } from '@/lib/thaiSegmentServer'

export const runtime = 'nodejs'

// 优先调用独立 PyThaiNLP 微服务；未配置或失败则回退到服务端 JS 分词器
const PY_SERVICE_URL = process.env.THAI_SEGMENT_SERVICE_URL || ''

async function callPythonService(text) {
  if (!PY_SERVICE_URL) return null
  // 兼容 /legacy 返回 { data: [...] } 和 /segment 返回 { tokens: [...] }
  const url = PY_SERVICE_URL.replace(/\/$/, '')
  const legacyUrl = url.endsWith('/legacy') ? url : `${url}/legacy`
  try {
    const res = await fetch(legacyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return null
    const j = await res.json()
    if (Array.isArray(j.data) && j.data.length) return j.data
    if (Array.isArray(j.tokens) && j.tokens.length) return j.tokens
    return null
  } catch (e) {
    console.warn('[thai-segment] Python service unavailable, fallback to serverTokenize', e?.message || e)
    return null
  }
}

export async function POST(req) {
  let text
  try {
    ({ text } = await req.json())
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text 参数缺失或格式错误' }, { status: 400 })
  }

  try {
    // 1. 优先 PyThaiNLP 微服务
    const pyTokens = await callPythonService(text)
    if (pyTokens && pyTokens.length) {
      return NextResponse.json({ data: pyTokens })
    }
    // 2. 回退：服务端 JS 分词器（加载 dictionary_full 词库）
    const tokens = await serverTokenize(text)
    return NextResponse.json({ data: tokens })
  } catch (e) {
    console.error('[thai-segment] 分词异常', e)
    return NextResponse.json({ error: '分词失败：' + (e.message || e) }, { status: 500 })
  }
}
