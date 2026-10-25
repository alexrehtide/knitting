<script setup>
// ПРОТОТИП, выбросить. Упрощённый холст: одна canvas, линейки рисуются в ней же.
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { state, yarnById, selectYarn, log, displayLabel } from './state.js'
import { drawGlyph, inkFor } from './patterns.js'

const RULER = 28
const wrap = ref(null)
const cv = ref(null)
let ox = 0, oy = 0 // смещение сетки относительно области клеток, px
let painting = false, panning = false, spaceDown = false, last = null

const aspect = computed(() => {
  const c = state.chart
  return c.aspectAuto ? c.gauge.rows / c.gauge.stitches : c.aspect
})
const cw = () => state.zoom
const ch = () => state.zoom / aspect.value

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function draw() {
  const el = cv.value
  if (!el) return
  const dpr = devicePixelRatio
  const W = wrap.value.clientWidth, H = wrap.value.clientHeight
  if (el.width !== W * dpr || el.height !== H * dpr) {
    el.width = W * dpr; el.height = H * dpr
    el.style.width = W + 'px'; el.style.height = H + 'px'
  }
  const ctx = el.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const bg = cssVar('--ui-bg-muted', '#f4f4f5')
  const text = cssVar('--ui-text-muted', '#71717a')
  const accent = cssVar('--ui-primary', '#6366f1')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const { w, h, majorStep } = state.chart
  const cW = cw(), cH = ch()
  const x0 = RULER + ox, y0 = RULER + oy

  ctx.save()
  ctx.beginPath(); ctx.rect(RULER, RULER, W - RULER, H - RULER); ctx.clip()
  const showGlyph = Math.min(cW, cH) >= 8
  for (let y = 0; y < h; y++) {
    const py = y0 + y * cH
    if (py + cH < RULER || py > H) continue
    for (let x = 0; x < w; x++) {
      const px = x0 + x * cW
      if (px + cW < RULER || px > W) continue
      const id = state.grid[y * w + x]
      if (id === 0) {
        ctx.fillStyle = '#fff'; ctx.fillRect(px, py, cW, cH)
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(px, py + cH); ctx.lineTo(px + cW, py); ctx.stroke()
        continue
      }
      const yarn = yarnById(id)
      if (!yarn) continue
      const mode = state.displayMode
      if (mode === 'pattern' && showGlyph) {
        ctx.fillStyle = '#fff'; ctx.fillRect(px, py, cW, cH)
        drawGlyph(ctx, yarn.glyph, px, py, cW, cH, '#000')
      } else {
        ctx.fillStyle = yarn.color; ctx.fillRect(px, py, cW, cH)
        if (mode === 'both' && showGlyph) drawGlyph(ctx, yarn.glyph, px, py, cW, cH, inkFor(yarn.color))
      }
    }
  }
  if (cW >= 4) {
    for (let x = 0; x <= w; x++) {
      const major = state.chart.stitchesFrom === 'right' ? (w - x) % majorStep === 0 : x % majorStep === 0
      ctx.strokeStyle = major ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.18)'
      ctx.lineWidth = major ? 1.5 : 1
      ctx.beginPath(); ctx.moveTo(x0 + x * cW, y0); ctx.lineTo(x0 + x * cW, y0 + h * cH); ctx.stroke()
    }
    for (let y = 0; y <= h; y++) {
      const major = state.chart.rowsFrom === 'bottom' ? (h - y) % majorStep === 0 : y % majorStep === 0
      ctx.strokeStyle = major ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.18)'
      ctx.lineWidth = major ? 1.5 : 1
      ctx.beginPath(); ctx.moveTo(x0, y0 + y * cH); ctx.lineTo(x0 + w * cW, y0 + y * cH); ctx.stroke()
    }
  }
  const cur = state.cursor
  if (cur && state.crosshair) {
    ctx.fillStyle = 'rgba(99,102,241,.12)'
    ctx.fillRect(x0, y0 + cur.y * cH, w * cW, cH)
    ctx.fillRect(x0 + cur.x * cW, y0, cW, h * cH)
  }
  if (cur) {
    ctx.strokeStyle = accent; ctx.lineWidth = 2
    ctx.strokeRect(x0 + cur.x * cW, y0 + cur.y * cH, cW, cH)
  }
  ctx.restore()

  // линейки
  ctx.fillStyle = cssVar('--ui-bg', '#fff')
  ctx.fillRect(0, 0, W, RULER); ctx.fillRect(0, 0, RULER, H)
  ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const every = cW < 10 ? majorStep : cW < 18 ? 2 : 1
  for (let x = 0; x < w; x++) {
    const { col } = displayLabel(x, 0)
    const hot = cur && cur.x === x
    if (!hot && col % every !== 0 && col !== 1) continue
    const px = x0 + x * cW + cW / 2
    if (px < RULER || px > W) continue
    ctx.fillStyle = hot ? accent : text
    ctx.font = (hot || col % majorStep === 0 ? 'bold ' : '') + '10px system-ui'
    ctx.fillText(String(col), px, RULER / 2)
  }
  for (let y = 0; y < h; y++) {
    const { row } = displayLabel(0, y)
    const hot = cur && cur.y === y
    if (!hot && row % every !== 0 && row !== 1) continue
    const py = y0 + y * cH + cH / 2
    if (py < RULER || py > H) continue
    ctx.fillStyle = hot ? accent : text
    ctx.font = (hot || row % majorStep === 0 ? 'bold ' : '') + '10px system-ui'
    ctx.fillText(String(row), RULER / 2, py)
  }
  ctx.strokeStyle = cssVar('--ui-border', '#e4e4e7'); ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, RULER + 0.5); ctx.lineTo(W, RULER + 0.5); ctx.moveTo(RULER + 0.5, 0); ctx.lineTo(RULER + 0.5, H); ctx.stroke()
}

function cellAt(e) {
  const r = cv.value.getBoundingClientRect()
  const x = Math.floor((e.clientX - r.left - RULER - ox) / cw())
  const y = Math.floor((e.clientY - r.top - RULER - oy) / ch())
  if (x < 0 || y < 0 || x >= state.chart.w || y >= state.chart.h) return null
  return { x, y }
}

function apply(c) {
  if (!c) return
  const i = c.y * state.chart.w + c.x
  if (state.tool === 'pipette') { if (state.grid[i]) selectYarn(state.grid[i]); return }
  if (state.tool === 'fill') { fill(c); return }
  const v = state.tool === 'eraser' ? 0 : state.current
  if (state.grid[i] !== v) { state.grid[i] = v; state.gridVersion++; state.dirty = true }
}

function fill(c) {
  const { w, h } = state.chart
  const g = state.grid, from = g[c.y * w + c.x], to = state.current
  if (from === to) return
  const st = [c]
  while (st.length) {
    const { x, y } = st.pop()
    if (x < 0 || y < 0 || x >= w || y >= h || g[y * w + x] !== from) continue
    g[y * w + x] = to
    st.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }
  state.gridVersion++; state.dirty = true
}

function onDown(e) {
  if (e.button === 1 || (e.button === 0 && spaceDown)) {
    panning = true; last = { x: e.clientX, y: e.clientY }
    cv.value.setPointerCapture(e.pointerId); return
  }
  if (e.button !== 0) return
  // Проверка тикета: клик по холсту при открытом поповере цвета
  const sinceClose = performance.now() - state.popoverClosedAt
  if (state.popoverOpen || sinceClose < 80) {
    if (state.popoverGuard === 'swallow') { log('✓ клик закрыл поповер и проглочен — клетка не закрашена'); return }
    log('✗ клик при открытом поповере дошёл до холста — клетка закрашена')
  }
  const c = cellAt(e)
  if (!c) return
  painting = true
  cv.value.setPointerCapture(e.pointerId)
  apply(c)
}

function onMove(e) {
  if (panning) {
    ox += e.clientX - last.x; oy += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }
    draw(); return
  }
  const c = cellAt(e)
  if (c?.x !== state.cursor?.x || c?.y !== state.cursor?.y) state.cursor = c
  if (painting && c && state.tool !== 'fill') apply(c)
}

function onUp() { painting = false; panning = false }
function onLeave() { if (!painting) state.cursor = null }

function onWheel(e) {
  e.preventDefault()
  if (e.ctrlKey) {
    const r = cv.value.getBoundingClientRect()
    const mx = e.clientX - r.left - RULER, my = e.clientY - r.top - RULER
    const old = state.zoom
    const z = Math.max(2, Math.min(64, old * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    ox = mx - (mx - ox) * (z / old); oy = my - (my - oy) * (z / old)
    state.zoom = z
  } else {
    ox -= e.shiftKey ? e.deltaY : e.deltaX; oy -= e.shiftKey ? 0 : e.deltaY
    draw()
  }
}

function fit() {
  const W = wrap.value.clientWidth - RULER - 16, H = wrap.value.clientHeight - RULER - 16
  state.zoom = Math.max(2, Math.min(W / state.chart.w, (H / state.chart.h) * aspect.value))
  ox = (W + 16 - state.zoom * state.chart.w) / 2
  oy = (H + 16 - (state.zoom / aspect.value) * state.chart.h) / 2
  draw()
}
defineExpose({ fit })

const kd = e => { if (e.code === 'Space' && e.target === document.body) { spaceDown = true; e.preventDefault() } }
const ku = e => { if (e.code === 'Space') spaceDown = false }
let ro
onMounted(() => {
  ro = new ResizeObserver(() => draw())
  ro.observe(wrap.value)
  addEventListener('keydown', kd); addEventListener('keyup', ku)
  addEventListener('kchart:fit', fit)
  requestAnimationFrame(fit)
})
onBeforeUnmount(() => {
  ro.disconnect()
  removeEventListener('keydown', kd); removeEventListener('keyup', ku)
  removeEventListener('kchart:fit', fit)
})
watch(() => [state.gridVersion, state.zoom, state.cursor, state.displayMode, state.crosshair, state.chart,
  state.palette.map(y => y.color + y.glyph).join()], draw, { deep: true })
</script>

<template>
  <div ref="wrap" class="relative h-full w-full overflow-hidden select-none">
    <canvas ref="cv" class="absolute inset-0 touch-none" :class="state.tool === 'pipette' ? 'cursor-copy' : 'cursor-crosshair'"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onLeave" @wheel="onWheel"
      @contextmenu.prevent />
  </div>
</template>
