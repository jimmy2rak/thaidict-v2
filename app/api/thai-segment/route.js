import { NextResponse } from 'next/server'
import { serverTokenize } from '@/lib/thaiSegmentServer'

export const runtime = 'nodejs'

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
    const tokens = await serverTokenize(text)
    return NextResponse.json({ data: tokens })
  } catch (e) {
    console.error('[thai-segment] 分词异常', e)
    return NextResponse.json({ error: '分词失败：' + (e.message || e) }, { status: 500 })
  }
}
