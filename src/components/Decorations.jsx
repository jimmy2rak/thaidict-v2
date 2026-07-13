import React from 'react'

// 线性细描边装饰元素（新中式奶油轻泰式复古极简风）
// 全部使用 currentColor + 细描边，颜色由父级 opacity / color 控制，保持素雅。

const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 40, color = 'currentColor', style, children, viewBox }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      style={{ display: 'block', color, ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// 泰式佛塔（chedj / stupa）极简线条
export function PagodaLine({ size, color, style }) {
  return (
    <Svg size={size} color={color} style={style} viewBox="0 0 40 58">
      {/* 塔尖 */}
      <line x1="20" y1="3" x2="20" y2="9" {...BASE} />
      <circle cx="20" cy="3" r="1.6" {...BASE} />
      {/* 塔刹层叠 */}
      <path d="M17 11 H23" {...BASE} />
      <path d="M16 14 H24" {...BASE} />
      <path d="M15 17 H25" {...BASE} />
      {/* 钟形塔身 */}
      <path d="M15 17 C15 24 12 27 12 31 H28 C28 27 25 24 25 17" {...BASE} />
      {/* 台基 */}
      <path d="M10 31 H30" {...BASE} />
      <path d="M9 35 H31" {...BASE} />
      <path d="M7 39 H33" {...BASE} />
      <path d="M7 43 H33" {...BASE} />
      {/* 地面 */}
      <path d="M5 47 H35" {...BASE} />
    </Svg>
  )
}

// 粽叶 / 蕉叶 极简线条
export function LeafLine({ size, color, style }) {
  return (
    <Svg size={size} color={color} style={style} viewBox="0 0 48 48">
      <path d="M8 40 C8 20 24 8 40 8 C40 28 24 40 8 40 Z" {...BASE} />
      <path d="M12 36 C20 26 30 16 38 12" {...BASE} />
      <path d="M18 31 L24 27" {...BASE} />
      <path d="M24 25 L30 21" {...BASE} />
      <path d="M15 33 L21 29" {...BASE} />
    </Svg>
  )
}

// 碗盏（带热气）极简线条
export function BowlLine({ size, color, style }) {
  return (
    <Svg size={size} color={color} style={style} viewBox="0 0 48 44">
      {/* 碗体 */}
      <path d="M8 19 C8 31 18 37 24 37 C30 37 40 31 40 19 Z" {...BASE} />
      <line x1="6" y1="19" x2="42" y2="19" {...BASE} />
      {/* 圈足 */}
      <path d="M19 37 V40 H29 V37" {...BASE} />
      {/* 热气 */}
      <path d="M18 13 C16 10 20 8 18 5" {...BASE} />
      <path d="M26 13 C24 10 28 8 26 5" {...BASE} />
    </Svg>
  )
}
