'use client'

// 入口页（Client Component）：
// 整个原生 SPA（App + AppProvider + ErrorBoundary）以「客户端组件」方式渲染。
// 通过 app/AppShell.jsx 内部的 mounted 守卫，服务端只输出占位、不触碰
// window / localStorage，浏览器挂载后再渲染真实应用，事件正常绑定。
//
// 注意：这里直接 import AppShell（不再用 next/dynamic({ ssr:false })），
// 否则整 App 会被包成懒加载块，导致客户端事件委托错位、点击全部失效。
import AppShell from './AppShell'

export default function Page() {
  // 复用原 index.css 中 #root 的「手机框」样式（max-width + 100dvh + flex 列）
  return (
    <div id="root">
      <AppShell />
    </div>
  )
}
