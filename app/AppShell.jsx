'use client'

// 应用外壳（Client Component）：等价于原 main.jsx 的挂载逻辑。
// 因为本文件由 app/page.jsx 以 dynamic(ssr:false) 引入，
// 所以它只在浏览器执行，服务端不会触碰 window / localStorage。
import React from 'react'
import { AppProvider } from '../src/context/AppContext.jsx'
import App from '../src/App.jsx'

// 错误边界：渲染异常时展示堆栈而非白屏（原 main.jsx 中同名组件）
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
  return (
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  )
}
