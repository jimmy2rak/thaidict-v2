'use client'

// 入口页（Client Component）：
// 整个原生 SPA（App + AppProvider + ErrorBoundary）通过 dynamic(ssr:false)
// 以纯客户端方式加载，完全复刻原 Vite 的「浏览器内渲染」行为，
// 避免在服务端渲染阶段触碰 window / localStorage 导致崩溃。
import dynamic from 'next/dynamic'

// ssr:false → 该组件只在浏览器加载，服务端只输出占位
const AppShell = dynamic(() => import('./AppShell'), {
  ssr: false,
  loading: () => null,
})

export default function Page() {
  // 复用原 index.css 中 #root 的「手机框」样式（max-width + 100dvh + flex 列）
  return (
    <div id="root">
      <AppShell />
    </div>
  )
}
