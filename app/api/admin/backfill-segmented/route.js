import { NextResponse } from 'next/server'
import { getCallerRoleRow } from '@/lib/serverAdminAuth'
import { getServerSupabase } from '@/lib/supabaseServer'
import { serverTokenizeToSegmented } from '@/lib/thaiSegmentServer'

export const runtime = 'nodejs'

export async function POST(req) {
  const auth = req.headers.get('authorization')
  const caller = await getCallerRoleRow(auth)
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: '仅 super_admin 可执行' }, { status: 403 })
  }

  let body = {}
  try {
    body = await req.json()
  } catch { /* 无 body 也允许 */ }
  let { limit = 100, dryRun = false } = body
  if (typeof limit !== 'number' || limit < 1 || limit > 1000) limit = 100

  const server = getServerSupabase()
  if (!server) return NextResponse.json({ error: '服务端未配置 Supabase' }, { status: 500 })

  // 仅处理 sentences 表，且跳过已有 segmented 的数据
  const { data: rows, error } = await server
    .from('sentences')
    .select('id, text')
    .or('segmented.is.null,segmented.eq.[]')
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = []
  let updated = 0

  for (const row of rows || []) {
    const thai = row.text || ''
    if (!thai) {
      results.push({ id: row.id, skipped: true, reason: 'empty text' })
      continue
    }
    try {
      const segmented = await serverTokenizeToSegmented(thai)
      if (dryRun) {
        results.push({ id: row.id, dryRun: true, segmented })
        continue
      }
      const { error: updErr } = await server
        .from('sentences')
        .update({ segmented })
        .eq('id', row.id)
      if (updErr) {
        results.push({ id: row.id, error: updErr.message })
      } else {
        updated++
        results.push({ id: row.id, updated: true })
      }
    } catch (e) {
      results.push({ id: row.id, error: e.message || String(e) })
    }
  }

  return NextResponse.json({ processed: rows?.length || 0, updated, dryRun, results })
}
