// AI 代理分发：mock 模式走规则生成；真实模式走 Supabase Edge Function `ai-proxy`。
// 重要：必须用 Edge Function 而非 Vercel function——Vercel Hobby 函数硬超时仅 10s，
// 而大模型推理超过 10s 会被 kill（Cloudflare 502）。老系统即用此 Edge Function，
// 其超时取决于 Supabase 计划，不受 Vercel 限制。密钥在服务端读取 system_config，前端不接触。
//
// ⚠️ 关键坑（2026-07-15）：Edge Function 会把收到的 `prompt` 原样放进 AI 的 messages[].content，
// 而 content 必须是【字符串】。之前前端传的是对象 { word, zhHint }，导致 AI 收到 "[object Object]"，
// 生成失败/乱码。现统一：对象 → buildWordPrompt 生成详细字符串 prompt 再发送。
import { isSupabaseConfigured, supabase } from './supabase.js'
import { generateMockWord, parsePrompt } from './mock/aiProxy.js'

// 参照 05_enrich_parallel.py 的 build_prompt：显式要求一词多义、例句、近反义、学习者联想，
// 并要求例句分词（segmented），全部元素齐全。单词单次输出可控，不会超时。
export function buildWordPrompt(word, zhHint = '') {
  const w = (word || '').trim()
  const hint = (zhHint || '').trim()
  const hintLine = hint ? `\n参考中文含义（用户提示）：${hint}\n` : '\n'
  return `请为泰语词「${w}」生成一份高质量的中泰词典条目。${hintLine}
## 核心要求：一词多义
许多泰语词有多个完全不同的含义，你必须：
1. 为每个【不同含义】创建一个独立义项（sense）；
2. 每个义项必须有自己专属的例句，不要跨义项共用；
3. 常见词通常 2-5 个义项，罕见词 1-2 个即可；
4. 义项按使用频率从高到低排列。

## 各字段说明（只要有的元素都要给全）
1. word：泰语词本身（原样，用正确泰语 Unicode，不要乱码或占位符）。
2. romanization：泰语罗马音（皇家泰语转写系统，带声调习惯）。
3. senses：义项数组，每个义项含：
   - pos：词性（名词/动词/形容词/副词/介词/连词/代词/量词/助词/叹词/其他）
   - meaning：简洁准确的中文释义
   - register：语体（正式/口语/书面/俚语/通用）
   - examples：该义项的 2 个例句，每句必须含：
     - th（泰语原文）
     - zh（中文翻译）
     - segmented（对 th 的分词结果，【必须】提供；数组，每个元素含 text（泰语）、pos（词性）、meaning（中文））
   - 分词必须拆到词典级词汇粒度，不要把长复合短语当作一个词，例如 "เขาสารภาพโทษ" 必须拆成 [เขา, สารภาพ, โทษ]。
4. synonyms：近义词数组，每项含 word（泰语）和 zh（中文）。
5. antonyms：反义词数组，每项含 word（泰语）和 zh（中文）。
6. learner_associations：学习者联想词，2-3 个，每项含 word（泰语）和 note（中文备注）。

## 输出格式（严格 JSON 对象，不要任何额外文字或解释）
{
  "word": "${w}",
  "romanization": "...",
  "senses": [
    {
      "pos": "动词",
      "meaning": "中文释义",
      "register": "通用",
      "examples": [
        {
          "th": "泰语例句",
          "zh": "中文翻译",
          "segmented": [
            { "text": "泰语词", "pos": "词性", "meaning": "中文" }
          ]
        }
      ],
    }
  ],
  "synonyms": [ { "word": "近义词", "zh": "中文" } ],
  "antonyms": [ { "word": "反义词", "zh": "中文" } ],
  "learner_associations": [ { "word": "联想词", "note": "中文备注" } ]
}`
}

// prompt 可为字符串（如学习计划）或 { word, zhHint }（查词生成词条）。
export async function callAiProxy(prompt, userApi = null) {
  if (!isSupabaseConfigured || !supabase) {
    const { word, zhHint } = parsePrompt(prompt)
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 600))
    return { data: generateMockWord(word, zhHint), error: null }
  }

  // 对象 → 详细字符串 prompt；字符串原样使用
  const promptStr =
    typeof prompt === 'string'
      ? prompt
      : buildWordPrompt(prompt?.word, prompt?.zhHint)

  try {
    const fnUrl = `${supabase.supabaseUrl}/functions/v1/ai-proxy`
    const { data: { session } } = await supabase.auth.getSession()

    const body = { prompt: promptStr }
    if (userApi?.key && userApi?.base_url) {
      body.user_api_key = userApi.key
      body.user_base_url = userApi.base_url
      body.user_model = userApi.model || 'gpt-4o'
      body.provider = 'user'
    } else {
      body.provider = 'system'
    }

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: session ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || json.details || 'AI proxy failed' }
    // 老 Edge Function 返回 { success, data, provider }
    return { data: json.data ?? json, error: null }
  } catch (e) {
    console.error('[ai-proxy]', e)
    return { data: null, error: e.message }
  }
}
