import React from 'react'

// 通用 UI 组件（inline style + CSS Variables，文档4.1.3）
export const COLORS = {
  teal: 'var(--c-teal)',
  gold: 'var(--c-gold)',
  rose: 'var(--c-rose)',
  info: 'var(--c-info)',
  amber: 'var(--c-amber)',
  p300: 'var(--c-p300)',
  p600: 'var(--c-p600)',
  p800: 'var(--c-p800)',
  s300: 'var(--c-s300)',
  s500: 'var(--c-s500)',
}

export function Card({ children, style, onClick, noPad }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--c-surface)',
        borderRadius: 14,
        padding: noPad ? 0 : '14px 16px',
        border: '1px solid var(--c-p100)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Badge({ children, color = 'var(--c-teal)', style }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: color,
        background: 'color-mix(in srgb, ' + color + ' 14%, transparent)',
        padding: '2px 8px',
        borderRadius: 999,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

export function Btn({ children, onClick, variant = 'primary', disabled, style, type = 'button' }) {
  const variants = {
    primary: { background: 'var(--c-teal)', color: '#fff' },
    ghost: { background: 'var(--c-p100)', color: 'var(--c-p700)' },
    danger: { background: 'var(--c-rose)', color: '#fff' },
    gold: { background: 'var(--c-gold)', color: '#fff' },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        borderRadius: 12,
        padding: '11px 16px',
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function IconButton({ onClick, title, active, children, style, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: 10,
        background: active ? 'color-mix(in srgb, var(--c-teal) 16%, transparent)' : 'transparent',
        color: active ? 'var(--c-teal)' : 'var(--c-p600)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Spinner({ size = 20, color = 'var(--c-teal)' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2.5px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 8px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-p500)', letterSpacing: 0.5 }}>{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--c-s500)', padding: '40px 20px', fontSize: 14 }}>
      <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      {text}
    </div>
  )
}

export function WordToken({ text, meaning, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: active ? 'color-mix(in srgb, var(--c-teal) 16%, transparent)' : 'var(--c-p100)',
        border: '1px solid var(--c-p200)',
        borderRadius: 10,
        padding: '6px 10px',
        margin: '3px',
        cursor: 'pointer',
        fontFamily: 'var(--th-font)',
      }}
      title={meaning}
    >
      <span style={{ fontSize: 15, color: 'var(--c-p800)', fontWeight: 500 }}>{text}</span>
      {meaning ? <span style={{ fontSize: 11, color: 'var(--c-p500)' }}>{meaning}</span> : null}
    </button>
  )
}
