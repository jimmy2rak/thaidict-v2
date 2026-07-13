import React from 'react'
import { useApp } from './context/AppContext.jsx'
import { Home, BookOpen, GraduationCap, User, X } from 'lucide-react'

import LoginPage from './screens/LoginPage.jsx'
import ResetPasswordPage from './screens/ResetPasswordPage.jsx'
import HomePage from './screens/HomePage.jsx'
import WordBookPage from './screens/WordBookPage.jsx'
import LearnPage from './screens/LearnPage.jsx'
import ProfilePage from './screens/ProfilePage.jsx'
import WordDetailPage from './screens/WordDetailPage.jsx'
import UnknownWordPage from './screens/UnknownWordPage.jsx'
import SentenceDetail from './components/SentenceDetail.jsx'

const TABS = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'words', label: '单词本', icon: BookOpen },
  { key: 'learn', label: '学习', icon: GraduationCap },
  { key: 'me', label: '我的', icon: User },
]

function TabBar({ page, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(var(--tabbar-height) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'var(--c-surface)',
        borderTop: '1px solid var(--c-p100)',
        flexShrink: 0,
      }}
    >
      {TABS.map((t) => {
        const active = page === t.key
        const Icon = t.icon
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--c-teal)' : 'var(--c-s500)',
            }}
          >
            <Icon size={22} strokeWidth={1.6} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--c-bg)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {children}
    </div>
  )
}

export default function App() {
  const app = useApp()

  if (app.loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <span style={{ width: 28, height: 28, border: '3px solid var(--c-teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!app.isLoggedIn) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
        {app.showReset ? (
          <ResetPasswordPage onBack={() => app.setShowReset(false)} />
        ) : (
          <LoginPage onForgot={() => app.setShowReset(true)} />
        )}
        <ToastLayer />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {app.visitedPages.has('home') && (
          <div style={{ display: app.page === 'home' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <HomePage />
          </div>
        )}
        {app.visitedPages.has('words') && (
          <div style={{ display: app.page === 'words' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <WordBookPage />
          </div>
        )}
        {app.visitedPages.has('learn') && (
          <div style={{ display: app.page === 'learn' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <LearnPage />
          </div>
        )}
        {app.visitedPages.has('me') && (
          <div style={{ display: app.page === 'me' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <ProfilePage />
          </div>
        )}

        {/* Overlays */}
        {app.detailWord && (
          <Overlay>
            <WordDetailPage word={app.detailWord} />
          </Overlay>
        )}
        {app.unknownWord && (
          <Overlay>
            <UnknownWordPage word={app.unknownWord} />
          </Overlay>
        )}
        {app.selectedSentence && (
          <Overlay>
            <SentenceDetail sentence={app.selectedSentence} onClose={() => app.navigateTo({ type: 'close-sentence' })} />
          </Overlay>
        )}
      </div>

      <TabBar page={app.page} onChange={app.setPage} />
      <ToastLayer />
    </div>
  )
}

function ToastLayer() {
  const app = useApp()
  if (!app.toastMsg) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(var(--tabbar-height) + 16px)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 500,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'var(--c-p800)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13,
          maxWidth: '80%',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        }}
      >
        {app.toastMsg}
      </div>
    </div>
  )
}
