import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import {
  getWordByThai,
  createPendingApproval,
  recordWordLookup,
  getBookmarks,
  getStreak,
  getPracticeRecords,
  getWordBookProgress,
  getWordBooks,
  checkAchievements,
  getUserSettings,
  CHINESE_FONTS,
  THAI_FONTS,
  getFontFamily,
  loadSettingsCache,
  saveSettingsCache,
  getUserRole,
  getActiveAiApi,
  verifyMagicToken,
} from '../lib/db/index.js'
import { callAiProxy } from '../lib/ai-proxy.js'
import { transformWordData, transformCommunityWord } from '../lib/utils.js'
import { setDictWords as setSegmentDict } from '../utils/thaiSegment.js'
import { setDictWords as setTokenDict } from '../utils/thaiToken'
import { seedIfNeeded, getMockSession, getGlobal } from '../lib/mock/store.js'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // ---------- 鉴权 ----------
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id || null
  const isLoggedIn = !!session

  // ---------- 导航 ----------
  const [page, setPageState] = useState('home')
  const [visitedPages, setVisitedPages] = useState(() => new Set(['home']))
  // 每次切换底部 tab 自增，用于强制重挂载活动页，重置页内深层级导航状态（如 WordBookPage.detail）
  const [pageEpoch, setPageEpoch] = useState(0)
  const [navStack, setNavStack] = useState([])
  const [navForward, setNavForward] = useState([])
  const [detailWord, setDetailWord] = useState(null)
  const [unknownWord, setUnknownWord] = useState(null)
  const [selectedSentence, setSelectedSentence] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---------- 词条缓存 ----------
  const [dbWordData, setDbWordData] = useState({})
  // 登录页 / 重置密码切换
  const [showReset, setShowReset] = useState(false)
  // AI 生成的词条先缓存在【用户本地】（localStorage），审批通过入 dictionary_full 后可全局查到。
  // 本地缓存让生成者在审批前刷新页面仍能查到自己刚加的词。
  const [generatedWords, setGeneratedWords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('thaidict-generated-words') || '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('thaidict-generated-words', JSON.stringify(generatedWords))
    } catch {
      /* 配额满等异常忽略 */
    }
  }, [generatedWords])
  const pendingLookups = useRef(new Set())

  // ---------- 主题 ----------
  const [colorMode, setColorModeState] = useState(
    () => localStorage.getItem('thaidict-color-mode') || 'light'
  )

  // ---------- 字体 ----------
  // 初始值同步读取本地缓存（与 DEFAULTS 对齐为 serif/sarabun），
  // 配合 app/layout.jsx 的 <head> 内联脚本，实现「先展示缓存字体 → 再异步拉取自定义」且首屏零闪烁。
  const [chineseFont, setChineseFont] = useState(() => {
    if (typeof window === 'undefined') return 'noto_serif_sc'
    const c = loadSettingsCache()
    return (c && c.chinese_font) || 'noto_serif_sc'
  })
  const [thaiFont, setThaiFont] = useState(() => {
    if (typeof window === 'undefined') return 'sarabun'
    const c = loadSettingsCache()
    return (c && c.thai_font) || 'sarabun'
  })

  // ---------- 角色权限 ----------
  const [userRole, setUserRole] = useState({ role: 'user', permissions: [] })

  // ---------- Toast ----------
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)
  const toast = useCallback((msg) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  // 初始化：种子 + 会话 + 分词词典
  useEffect(() => {
    seedIfNeeded()
    if (isSupabaseConfigured) {
      // 显式处理 Supabase 回调（修复 magic link / OTP 登录无效）：
      //  - 隐式流：回调 URL 形如 #access_token=...&type=magiclink / type=recovery
      //  - PKCE 流（OAuth）：回调 URL 形如 ?code=...
      const handleAuthCallback = async () => {
        const hash = window.location.hash
        const search = new URLSearchParams(window.location.search)
        const code = search.get('code')
        const hasHashToken =
          hash.includes('access_token=') ||
          hash.includes('type=magiclink') ||
          hash.includes('type=recovery') ||
          hash.includes('type=signup')
        const hasError = hash.includes('error=') || !!search.get('error')

        try {
          // PKCE 流（OAuth：Google/GitHub，以及 PKCE magic link）：回调 URL 形如 ?code=...
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) console.error('[auth callback pkce]', error)
            if (data?.session) setSession(data.session)
            window.history.replaceState({}, '', window.location.pathname)
            setLoading(false)
            return
          }
          // 自建魔法链接登录：邮件链接形如 /?magic_token=...（绕开 Supabase 托管 action_link / Email 开关）
          const magicToken = search.get('magic_token')
          if (magicToken) {
            const { data, error } = await verifyMagicToken(magicToken)
            if (error) console.error('[magic-login]', error)
            if (data?.session) setSession(data.session)
            window.history.replaceState({}, '', window.location.pathname)
            setLoading(false)
            return
          }
          // 隐式流：回调 URL 形如 #access_token=...&refresh_token=...
          if (hasHashToken) {
            const hp = new URLSearchParams(hash.replace(/^#/, ''))
            const access_token = hp.get('access_token')
            const refresh_token = hp.get('refresh_token')
            if (access_token && refresh_token) {
              const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
              if (error) console.error('[auth callback implicit]', error)
              if (data?.session) setSession(data.session)
            }
            window.history.replaceState({}, '', window.location.pathname)
            setLoading(false)
            return
          }
          // 回调携带错误：清掉 URL 参数，避免刷新时反复处理
          if (hasError) {
            console.error('[auth callback error]', hash || window.location.search)
            window.history.replaceState({}, '', window.location.pathname)
          }
        } catch (e) {
          console.error('[auth callback]', e)
        }

        const { data } = await supabase.auth.getSession()
        setSession(data.session)
        setLoading(false)
      }

      handleAuthCallback()
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s)
        setLoading(false)
      })
      return () => sub.subscription.unsubscribe()
    } else {
      setSession(getMockSession())
      setLoading(false)
    }
  }, [])

  // 应用主题
  useEffect(() => {
    const apply = () => {
      let mode = colorMode
      if (mode === 'system') {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      document.documentElement.dataset.theme = mode
    }
    apply()
    if (colorMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [colorMode])

  // 加载角色权限
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserRole(userId).then((r) => {
      if (cancelled) return
      setUserRole(r || { role: 'user', permissions: [] })
    })
    return () => { cancelled = true }
  }, [userId])

  // 加载用户设置（字体、方向等），用于全局生效
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserSettings(userId).then((s) => {
      if (cancelled) return
      saveSettingsCache(s)
      if (s.chinese_font) setChineseFont(s.chinese_font)
      if (s.thai_font) setThaiFont(s.thai_font)
    })
    return () => { cancelled = true }
  }, [userId])

  // 应用字体
  useEffect(() => {
    const zhFamily = getFontFamily(chineseFont, CHINESE_FONTS[0].family)
    const thFamily = getFontFamily(thaiFont, THAI_FONTS[1].family)
    document.documentElement.style.setProperty('--zh-font', zhFamily)
    document.documentElement.style.setProperty('--th-font', thFamily)
  }, [chineseFont, thaiFont])

  // 加载分词词典（词典公开可读，登录前后都加载，保证未登录时首页/每日推荐也能正确分词）
  // 优化：限制拉取词量上限(DICT_CAP) + 并发分页（不再 6 万词串行）+ localStorage 缓存，
  //       避免旧实现「62k 词串行拉取」导致例句分词要等很久才分好。
  const DICT_CAP = 12000
  const DICT_CACHE_KEY = 'thai_dict_cache_v1'
  const DICT_CACHE_TTL = 24 * 3600 * 1000
  const readDictCache = () => {
    try {
      const raw = localStorage.getItem(DICT_CACHE_KEY)
      if (raw) {
        const obj = JSON.parse(raw)
        if (obj && Array.isArray(obj.words) && Date.now() - obj.ts < DICT_CACHE_TTL) return obj.words
      }
    } catch {
      /* ignore */
    }
    return null
  }
  const writeDictCache = (words) => {
    try {
      localStorage.setItem(DICT_CACHE_KEY, JSON.stringify({ ts: Date.now(), words }))
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    let cancelled = false
    const apply = (words) => {
      if (cancelled) return
      setSegmentDict(words)
      setTokenDict(words)
    }
    const load = async () => {
      if (!isSupabaseConfigured) {
        const dict = getGlobal('dictionary', [])
        apply(dict.map((r) => r.word))
        return
      }
      // 1) 命中本地缓存 → 秒回，无需网络
      const cached = readDictCache()
      if (cached && cached.length) {
        apply(cached)
        return
      }
      // 2) 并发分页拉取（上限 DICT_CAP，约 12 个请求而非 62 个串行）
      try {
        const pages = Math.ceil(DICT_CAP / 1000)
        const results = await Promise.allSettled(
          Array.from({ length: pages }, (_, p) =>
            supabase.from('dictionary_full').select('word').range(p * 1000, p * 1000 + 999)
          )
        )
        const words = []
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value?.data) {
            for (const r of res.value.data) if (r.word) words.push(r.word)
          }
        }
        const capped = words.slice(0, DICT_CAP)
        if (capped.length) {
          writeDictCache(capped)
          apply(capped)
        }
      } catch (e) {
        console.warn('[AppContext] 词典加载失败，降级基础词库', e)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session])

  // ---------- 导航操作 ----------
  const resetNav = useCallback(() => {
    setNavStack([])
    setNavForward([])
    setDetailWord(null)
    setUnknownWord(null)
    setSelectedSentence(null)
  }, [])

  const setPage = useCallback(
    (p) => {
      setPageState(p)
      setVisitedPages((v) => new Set(v).add(p))
      setPageEpoch((e) => e + 1)
      resetNav()
    },
    [resetNav]
  )

  const navigateTo = useCallback((target) => {
    if (target.type === 'detail') {
      setNavStack((prev) => (detailWord ? [...prev, detailWord] : prev))
      setNavForward([])
      setDetailWord(target.word)
      setUnknownWord(null)
    } else if (target.type === 'unknown') {
      setUnknownWord(target.word)
    } else if (target.type === 'sentence') {
      setSelectedSentence(target.sentence)
    } else if (target.type === 'close-sentence') {
      setSelectedSentence(null)
    } else if (target.type === 'close-unknown') {
      setUnknownWord(null)
    }
  }, [detailWord])

  const goBack = useCallback(() => {
    if (navStack.length === 0) {
      // 详情栈为空时，关闭详情浮层返回上一页（修复需求 #4：箭头不再“假死”）
      setNavForward([])
      setDetailWord(null)
      return
    }
    setNavStack((prev) => {
      const last = prev[prev.length - 1]
      setNavForward((f) => [detailWord, ...f])
      setDetailWord(last)
      return prev.slice(0, -1)
    })
  }, [navStack, navForward, detailWord])

  const goForward = useCallback(() => {
    setNavForward((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setNavStack((s) => [...s, detailWord])
      setDetailWord(next)
      return f.slice(1)
    })
  }, [detailWord])

  // ---------- 词条点击（修复 Bug B-2 竞态） ----------
  const handleWordTap = useCallback(
    async (word) => {
      if (!word) return
      if (pendingLookups.current.has(word)) return
      if (dbWordData[word] || generatedWords[word]) {
        navigateTo({ type: 'detail', word })
        return
      }
      pendingLookups.current.add(word)
      setDetailLoading(true)
      try {
        const row = await getWordByThai(word)
        if (row) {
          setDbWordData((prev) => ({ ...prev, [word]: row }))
          navigateTo({ type: 'detail', word })
        } else {
          setUnknownWord(word)
        }
      } catch (e) {
        console.error('[handleWordTap]', e)
      } finally {
        pendingLookups.current.delete(word)
        setDetailLoading(false)
      }
    },
    [dbWordData, generatedWords, navigateTo]
  )

  // ---------- AI 生成词条（先进入待审批） ----------
  const handleGenerated = useCallback(
    async (word, zhHint) => {
      const userApi = await getActiveAiApi(userId)
      const { data, error } = await callAiProxy({ word, zhHint }, userApi)
      if (error || !data || data.parseError || !data.word) {
        console.error('[handleGenerated]', error || data)
        toast(error ? `生成失败：${error}` : '生成失败，请重试')
        return
      }
      // 先缓存在用户本地（localStorage），生成者立即可查
      const transformed = transformCommunityWord(data)
      setGeneratedWords((prev) => ({ ...prev, [word]: transformed }))
      // 提交待审批：超管通过后写入 dictionary → dictionary_full，全局可查
      try {
        await createPendingApproval({ type: 'word', payload: { ...data, zh_hint: zhHint }, requestedBy: userId })
        toast('已生成，等待管理员审核后进入词典')
      } catch (e) {
        console.error('[createPendingApproval]', e)
        toast('已生成（本地），但提交审核失败')
      }
      setUnknownWord(null)
      navigateTo({ type: 'detail', word })
    },
    [userId, toast, navigateTo]
  )

  // ---------- 成就检查 ----------
  const checkAndToastAchievements = useCallback(async () => {
    if (!userId) return
    const [bookmarks, streak, records, books] = await Promise.all([
      getBookmarks(userId),
      getStreak(userId),
      getPracticeRecords(userId),
      getWordBooks(),
    ])
    const progresses = await Promise.all(books.map((b) => getWordBookProgress(userId, b.id)))
    const ctx = {
      streak,
      bookmarkCount: bookmarks.length,
      practiceCount: records.length,
      bookCompleted: progresses.some((p) => p?.completed),
    }
    const newly = await checkAchievements(userId, ctx)
    newly.forEach((d) => toast(`🏅 解锁成就：${d.name}`))
  }, [userId, toast])

  const setColorMode = useCallback((m) => {
    setColorModeState(m)
    localStorage.setItem('thaidict-color-mode', m)
  }, [])

  const value = {
    // auth
    session,
    user: session?.user || null,
    userId,
    isLoggedIn,
    loading,
    setSession,
    // nav
    page,
    setPage,
    pageEpoch,
    visitedPages,
    navStack,
    navForward,
    goBack,
    goForward,
    resetNav,
    navigateTo,
    // overlay
    detailWord,
    unknownWord,
    selectedSentence,
    setSelectedSentence,
    showReset,
    setShowReset,
    detailLoading,
    dbWordData,
    generatedWords,
    // theme
    colorMode,
    setColorMode,
    chineseFont,
    setChineseFont,
    thaiFont,
    setThaiFont,
    // role
    userRole,
    setUserRole,
    // actions
    handleWordTap,
    handleGenerated,
    checkAndToastAchievements,
    toast,
    toastMsg,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
