// 根布局（Server Component）：只负责 html/body、全局样式、字体与元信息。
// 应用本体（含所有交互/状态）放在 app/page.jsx 里以「客户端」方式渲染，
// 因此这里不包含任何 window / localStorage 逻辑。
import '../src/index.css'

// 页面元信息（对应原 index.html 的 <title> / description / manifest）
export const metadata = {
  title: '词笺 — 中泰双语智能词典',
  description: '中泰双语智能词典：查词、例句分词、发音朗读、收藏、学习统计',
  manifest: '/manifest.json',
  applicationName: '词笺',
  appleWebApp: {
    capable: false,
    statusBarStyle: 'default',
    title: '词笺',
  },
}

// 视口设置（对应原 index.html 的 <meta name="viewport"> 与 theme-color）
// 注意：不再设置 maximumScale / user-scalable。原 user-scalable=no 已移除（Bug E-2 无障碍），
// 残余的 maximumScale:1 也在此一并去掉；缩放行为改为由 CSS .no-select / touch-action:manipulation 控制。
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F6F1E7',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        {/* Google Fonts：中文 Noto Sans/Serif SC，泰文 Noto Sans Thai / Sarabun / Charm */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Noto+Serif+SC:wght@400;600&family=Noto+Serif+Thai:wght@400;600&family=Charm:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
