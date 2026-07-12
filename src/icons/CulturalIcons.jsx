import React from 'react'

// 文化主题图标（内联 SVG，无外部依赖）
export function WatArunLogo({ size = 32, color = 'var(--c-gold)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L14 7 L12 9 L10 7 Z" fill={color} />
      <path d="M5 22 L5 12 L7 14 L7 22 Z" fill={color} opacity="0.8" />
      <path d="M19 22 L19 12 L17 14 L17 22 Z" fill={color} opacity="0.8" />
      <path d="M9 22 L9 10 L12 13 L15 10 L15 22 Z" fill={color} />
      <circle cx="12" cy="6" r="1.4" fill="#fff" />
    </svg>
  )
}

export function PalmLeafBook({ size = 22, color = 'var(--c-teal)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
      <path d="M4 5 C4 5 12 3 20 5 V19 C12 17 4 19 4 19 Z" />
      <path d="M4 12 H20" />
      <path d="M9 5 V19 M15 5 V19" opacity="0.5" />
    </svg>
  )
}

export function LotusLamp({ size = 22, color = 'var(--c-gold)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
      <path d="M12 4 C9 7 9 11 12 13 C15 11 15 7 12 4 Z" fill={color} opacity="0.5" />
      <path d="M6 11 C6 14 9 16 12 16 C15 16 18 14 18 11 C15 13 9 13 6 11 Z" />
      <path d="M5 20 H19" strokeWidth="1.4" />
    </svg>
  )
}

export function BuddhaHead({ size = 22, color = 'var(--c-p600)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="12" cy="10" r="6" />
      <path d="M6 9 C6 5 18 5 18 9" />
      <path d="M9 16 V20 M15 16 V20 M12 16 V21" />
    </svg>
  )
}
