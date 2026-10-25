// ПРОТОТИП, выбросить. Всё состояние — в памяти, правок и undo нет.
import { reactive, computed } from 'vue'
import { GLYPHS } from './patterns.js'

const NAMES = ['Молочный', 'Графит', 'Брусника', 'Горчица', 'Мох', 'Индиго', 'Терракота', 'Лаванда',
  'Морская волна', 'Шоколад', 'Персик', 'Хаки', 'Сирень', 'Бирюза', 'Вишня', 'Песок']

function makePalette(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const h = (i * 47) % 360
    const l = [88, 22, 45, 62, 35, 55, 70, 30][i % 8]
    out.push({
      id: i + 1,
      color: hslToHex(h, 55, l),
      glyph: i % GLYPHS.length,
      name: i < NAMES.length ? `${NAMES[i]}${i % 3 === 0 ? ` · арт. ${1200 + i * 7}` : ''}` : '',
    })
  }
  return out
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')
}

function makeGrid(w, h) {
  const g = new Uint16Array(w * h).fill(1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (y % 10 < 2) g[i] = 2
    const cx = x - w / 2, cy = y - h / 2 - 2
    const heart = (cx * cx + cy * cy - 60) ** 3 - cx * cx * cy * cy * cy * 3 < 0
    if (heart) g[i] = 3
    if (heart && (x + y) % 6 === 0) g[i] = 4
    if (x < 3 && y > h - 6) g[i] = 0
  }
  return g
}

export const state = reactive({
  chart: {
    name: 'Варежки с сердечком',
    notes: 'Вязать от резинки вверх.',
    gauge: { stitches: 22, rows: 30 },
    aspectAuto: true,
    aspect: 1,
    rowsFrom: 'bottom', // bottom | top
    stitchesFrom: 'right', // right | left
    majorStep: 10,
    created: '2026-10-20',
    modified: '2026-10-25',
    w: 40, h: 40,
  },
  grid: makeGrid(40, 40),
  gridVersion: 0,
  palette: makePalette(30),
  current: 3,
  previous: 1,
  tool: 'brush',
  displayMode: 'color', // color | pattern | both
  zoom: 16,
  crosshair: true,
  cursor: null, // { x, y } во внутренних координатах
  dirty: true,
  autosave: 'Сохранено в браузере · 12:41',
  dialog: null, // new | resize | replace | unsaved | pdf | keys | props
  replace: null, // { fromId, mode: 'delete' | 'all' }
  // проверка поповера над холстом
  popoverGuard: 'none', // none | modal | swallow
  popoverOpen: false,
  popoverClosedAt: 0,
  log: [],
})

export const TOOLS = [
  { id: 'brush', label: 'Кисть', icon: 'i-lucide-brush', key: 'B' },
  { id: 'eraser', label: 'Ластик', icon: 'i-lucide-eraser', key: 'E' },
  { id: 'fill', label: 'Заливка', icon: 'i-lucide-paint-bucket', key: 'G' },
  { id: 'pipette', label: 'Пипетка', icon: 'i-lucide-pipette', key: 'I' },
  { id: 'line', label: 'Линия', icon: 'i-lucide-slash', key: 'L' },
  { id: 'rect', label: 'Прямоугольник', icon: 'i-lucide-square', key: 'R' },
]

export const MODES = [
  { id: 'color', label: 'Цвет', icon: 'i-lucide-palette' },
  { id: 'pattern', label: 'Узор', icon: 'i-lucide-asterisk' },
  { id: 'both', label: 'Цвет+узор', icon: 'i-lucide-layers' },
]

export function log(msg) {
  const t = new Date().toLocaleTimeString('ru-RU')
  state.log.unshift(`${t} ${msg}`)
  state.log.length = Math.min(state.log.length, 8)
}

export const yarnById = id => state.palette.find(y => y.id === id)
export const numberOf = id => state.palette.findIndex(y => y.id === id) + 1

export const counts = computed(() => {
  void state.gridVersion
  const m = new Map()
  for (const v of state.grid) m.set(v, (m.get(v) || 0) + 1)
  return m
})

export const glyphUsers = computed(() => {
  const m = new Map()
  for (const y of state.palette) if (y.glyph != null) m.set(y.glyph, (m.get(y.glyph) || 0) + 1)
  return m
})
export const hasClash = y => y.glyph != null && glyphUsers.value.get(y.glyph) > 1
export const clashCount = computed(() => state.palette.filter(hasClash).length)

export function selectYarn(id) {
  if (id === state.current) return
  state.previous = state.current
  state.current = id
}

export function addYarn() {
  const used = new Set(state.palette.map(y => y.id))
  let id = 1
  while (used.has(id)) id++
  const free = GLYPHS.findIndex((_, i) => !glyphUsers.value.has(i))
  let glyph = free
  if (free < 0) {
    let min = Infinity
    GLYPHS.forEach((_, i) => { const c = glyphUsers.value.get(i); if (c < min) { min = c; glyph = i } })
  }
  state.palette.push({ id, color: '#888888', glyph, name: '' })
  selectYarn(id)
  log(`добавлена нить ${state.palette.length}`)
}

export function requestDelete(id) {
  if ((counts.value.get(id) || 0) > 0) {
    state.replace = { fromId: id, mode: 'delete' }
    state.dialog = 'replace'
  } else {
    state.palette.splice(state.palette.findIndex(y => y.id === id), 1)
    log('нить удалена (не использовалась)')
  }
}

export function requestReplaceAll(id) {
  state.replace = { fromId: id, mode: 'all' }
  state.dialog = 'replace'
}

export function applyReplace(toId) {
  const { fromId, mode } = state.replace
  for (let i = 0; i < state.grid.length; i++) if (state.grid[i] === fromId) state.grid[i] = toId
  if (mode === 'delete') state.palette.splice(state.palette.findIndex(y => y.id === fromId), 1)
  if (state.current === fromId) state.current = toId || state.palette[0].id
  state.gridVersion++
  state.dirty = true
  log(mode === 'delete' ? 'нить удалена с заменой (одна правка)' : 'замена нити во всей схеме')
}

// «Новая» и «Импорт» спрашивают про несохранённые изменения
export function guardedReplaceChart(next) {
  if (state.dirty) { state.pendingAfterUnsaved = next; state.dialog = 'unsaved' }
  else if (next === 'new') state.dialog = 'new'
  else log('импорт .kchart (заглушка)')
}

export function displayLabel(x, y) {
  const c = state.chart
  const col = c.stitchesFrom === 'right' ? c.w - x : x + 1
  const row = c.rowsFrom === 'bottom' ? c.h - y : y + 1
  return { col, row }
}
