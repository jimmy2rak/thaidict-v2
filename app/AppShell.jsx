'use client'

// 应用外壳（Client Component）。
//
// 为什么不用 next/dynamic({ ssr:false }) 包裹整个 App？
// ------------------------------------------------------------------
// 在 Next.js App Router 里，如果用 dynamic(ssr:false) 把「整个应用」包成
// 一个懒加载块，客户端有时会出现「页面渲染出来了，但所有 onClick 都不生效」
// 的现象（事件委托根错位）。本项目从 Vite 迁移过来后，正好暴露了这个问题：
// 登录后主页的卡片、底部 TabBar 全部点不动。
//
// 正确做法（也是 Next 官方推荐的「纯客户端 App」写法）：
//   1. page.jsx 标记为 'use client'，直接 import 本组件（不再 dynamic）。
//   2. 本组件用 mounted 守卫：服务端渲染时只输出占位，不触碰 window/localStorage；
//      浏览器挂载完成（useEffect）后再渲染真正的 AppProvider + App。
//   这样整棵组件树是普通的客户端 React 树，React 18 的事件委托会正常绑定，
//   点击 / 输入全部恢复。
import React, { useState, useEffect, useRef } from 'react'
import { AppProvider } from '../src/context/AppContext.jsx'
import App from '../src/App.jsx'

// 错误边界：渲染异常时展示堆栈而非白屏
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: 'var(--c-rose)', fontFamily: 'var(--zh-font)' }}>
          <h3>出错了</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AppShell() {
  // 挂载守卫：仅在浏览器挂载后渲染真实应用，避免 SSR 触碰 window/localStorage
  const [mounted, setMounted] = useState(false)
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    setMounted(true)
  }, [])

  // 服务端 / 首帧：只渲染占位，不进入任何依赖浏览器的逻辑
  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <span style={{ width: 28, height: 28, border: '3px solid var(--c-teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  )
}
