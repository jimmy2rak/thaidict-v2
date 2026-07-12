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
  getUserRole,
} from '../lib/db/index.js'
import { callAiProxy } from '../lib/ai-proxy.js'
import { transformWordData, transformCommunityWord } from '../lib/utils.js'
import { setDictWords } from '../utils/thaiSegment.js'
import { seedIfNeeded, getMockSession, getGlobal } from '../lib/mock/store.js'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // ---------- 鉴权 ----------
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // ---------- 导航 ----------
  const [page, setPageState] = useState('home')
  const [visitedPages, setVisitedPages] = useState(() => new Set(['home']))
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
  const [generatedWords, setGeneratedWords] = useState({})
  const pendingLookups = useRef(new Set())

  // ---------- 主题 ----------
  const [colorMode, setColorModeState] = useState(
    () => localStorage.getItem('thaidict-color-mode') || 'light'
  )

  // ---------- 字体 ----------
  const [chineseFont, setChineseFont] = useState('noto_sans_sc')
  const [thaiFont, setThaiFont] = useState('noto_sans_thai')

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
      // OAuth PKCE / Magic Link 回调处理（修复 Bug D-1 / D-3）
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(() => {
          window.history.replaceState({}, '', window.location.pathname)
        })
      }
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        setLoading(false)
      })
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

  // 登录后加载分词词典
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const load = async () => {
      if (isSupabaseConfigured) {
        const words = new Set()
        let from = 0
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data } = await supabase.from('dictionary_full').select('word').range(from, from + 999)
          if (!data || data.length === 0) break
          data.forEach((r) => words.add(r.word))
          if (data.length < 1000) break
          from += 1000
        }
        if (!cancelled) setDictWords([...words])
      } else {
        const dict = getGlobal('dictionary', [])
        if (!cancelled) setDictWords(dict.map((r) => r.word))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session])

  const userId = session?.user?.id || null
  const isLoggedIn = !!session

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
    setNavStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setNavForward((f) => [detailWord, ...f])
      setDetailWord(last)
      return prev.slice(0, -1)
    })
  }, [detailWord])

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
      const { data, error } = await callAiProxy({ word, zhHint })
      if (error || !data) {
        toast('生成失败，请重试')
        return
      }
      const transformed = transformCommunityWord(data)
      setGeneratedWords((prev) => ({ ...prev, [word]: transformed }))
      try {
        await createPendingApproval({ type: 'word', payload: { ...data, zh_hint: zhHint }, requestedBy: userId })
      } catch (e) {
        console.error('[createPendingApproval]', e)
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
