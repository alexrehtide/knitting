// ПРОТОТИП, выбросить. Значки — библиотека B из прототипа «Библиотека узоров заливки» (#6).
const L = (x1, y1, x2, y2, w = 0.1) => ({ t: 'L', x1, y1, x2, y2, w })
const D = (cx, cy, r) => ({ t: 'D', cx, cy, r })
const O = (cx, cy, r, w = 0.09) => ({ t: 'O', cx, cy, r, w })
const P = (...pts) => ({ t: 'P', pts })
const S = (pts, w = 0.09, closed = true) => ({ t: 'S', pts, w, closed })

// Порядок назначения: × ● ○ + ■ / △ ◆ — □ \ ▼ | ◇ ⊙ ✳
export const GLYPHS = [
  { ch: '×', name: 'Крест', prims: [L(0.25, 0.25, 0.75, 0.75), L(0.75, 0.25, 0.25, 0.75)] },
  { ch: '●', name: 'Точка', prims: [D(0.5, 0.5, 0.2)] },
  { ch: '○', name: 'Кольцо', prims: [O(0.5, 0.5, 0.24)] },
  { ch: '+', name: 'Плюс', prims: [L(0.22, 0.5, 0.78, 0.5), L(0.5, 0.22, 0.5, 0.78)] },
  { ch: '■', name: 'Квадрат', prims: [P(0.3, 0.3, 0.7, 0.3, 0.7, 0.7, 0.3, 0.7)] },
  { ch: '/', name: 'Косая', prims: [L(0.25, 0.75, 0.75, 0.25, 0.12)] },
  { ch: '△', name: 'Треугольник', prims: [S([0.5, 0.24, 0.78, 0.74, 0.22, 0.74])] },
  { ch: '◆', name: 'Ромб', prims: [P(0.5, 0.2, 0.8, 0.5, 0.5, 0.8, 0.2, 0.5)] },
  { ch: '—', name: 'Черта', prims: [L(0.22, 0.5, 0.78, 0.5, 0.12)] },
  { ch: '□', name: 'Квадрат-контур', prims: [S([0.28, 0.28, 0.72, 0.28, 0.72, 0.72, 0.28, 0.72])] },
  { ch: '\\', name: 'Обратная косая', prims: [L(0.25, 0.25, 0.75, 0.75, 0.12)] },
  { ch: '▼', name: 'Треугольник вниз', prims: [P(0.22, 0.28, 0.78, 0.28, 0.5, 0.78)] },
  { ch: '|', name: 'Вертикаль', prims: [L(0.5, 0.22, 0.5, 0.78, 0.12)] },
  { ch: '◇', name: 'Ромб-контур', prims: [S([0.5, 0.2, 0.8, 0.5, 0.5, 0.8, 0.2, 0.5])] },
  { ch: '⊙', name: 'Кольцо с точкой', prims: [O(0.5, 0.5, 0.28, 0.08), D(0.5, 0.5, 0.09)] },
  { ch: '✳', name: 'Звёздочка', prims: [L(0.28, 0.28, 0.72, 0.72, 0.08), L(0.72, 0.28, 0.28, 0.72, 0.08), L(0.5, 0.2, 0.5, 0.8, 0.08), L(0.2, 0.5, 0.8, 0.5, 0.08)] },
]

export function drawGlyph(ctx, glyph, x, y, w, h, color) {
  if (glyph == null) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w, h)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'butt'
  for (const p of GLYPHS[glyph].prims) {
    ctx.beginPath()
    if (p.t === 'L') { ctx.lineWidth = p.w; ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke() }
    else if (p.t === 'D') { ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2); ctx.fill() }
    else if (p.t === 'O') { ctx.lineWidth = p.w; ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2); ctx.stroke() }
    else {
      const a = p.pts
      ctx.moveTo(a[0], a[1])
      for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1])
      if (p.t === 'P') { ctx.closePath(); ctx.fill() } else { ctx.lineWidth = p.w; if (p.closed) ctx.closePath(); ctx.stroke() }
    }
  }
  ctx.restore()
}

export function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const inkFor = hex => (luminance(hex) > 0.18 ? '#000' : '#fff')
