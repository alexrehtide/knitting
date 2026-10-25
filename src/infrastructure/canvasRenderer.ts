import type { ChartRenderer, Hover, Viewport } from '../application/chartRenderer'
import type { EditorEvent, EditorSession } from '../application/editorSession'
import type { Chart } from '../domain/chart'
import { isMajorGridLine } from '../domain/gridLines'
import type { GridCell } from '../domain/numbering'
import type { YarnId } from '../domain/palette'
import { drawRuler } from './rulers'

const OUTSIDE_COLOR = '#e4e4e7'
const EMPTY_COLOR = '#f1f1f3'
const EMPTY_HATCH_COLOR = '#a1a1aa'
const MINOR_LINE_COLOR = 'rgba(113, 113, 122, 0.45)'
const MAJOR_LINE_COLOR = 'rgba(39, 39, 42, 0.8)'
const HIGHLIGHT_COLOR = 'rgba(79, 70, 229, 0.18)'

// Thresholds by cell size in CSS px (#5): below 2 — colour only; from 2 — major lines; from 4 — every line.
const MAJOR_LINES_FROM = 2
const ALL_LINES_FROM = 4
// Below this many device px (e.g. 500×500 fitted) a hatch line cannot be drawn inside a cell,
// so empty cells get a flat fill in the hatch's light grey, still unlike any yarn colour.
const HATCH_FROM_DEVICE_PX = 4

/**
 * The chart's layers: the bitmap, a transparent overlay above it, and the rulers along its top and left.
 * Mirrors the type in presentation/editor/injection.ts: the core has no DOM types to share it through.
 */
export interface ChartCanvases {
  readonly chart: HTMLCanvasElement
  readonly overlay: HTMLCanvasElement
  readonly rulerX: HTMLCanvasElement
  readonly rulerY: HTMLCanvasElement
}

/**
 * Draws the chart in «colour» mode: a W×H bitmap, one pixel per cell, scaled with `drawImage`
 * without smoothing; empty cells are transparent in it and show the «нет петли» hatch beneath.
 * `patch` repaints the changed cells of the bitmap, `replaced` rebuilds it.
 * The overlay and the rulers follow the viewport and the hovered cell; a hover redraws them alone.
 */
export function createCanvasRenderer(
  canvases: ChartCanvases,
  session: EditorSession,
): ChartRenderer {
  const canvas = canvases.chart
  const ctx = context2d(canvas, { alpha: false })
  const overlay = context2d(canvases.overlay)
  const rulerX = context2d(canvases.rulerX, { alpha: false })
  const rulerY = context2d(canvases.rulerY, { alpha: false })

  let dpr = 1
  let viewport: Viewport = { cellSize: 1, originX: 0, originY: 0 }
  let hover: Hover = { cell: null, lines: false }
  let frame = 0
  const dirty = { chart: false, marks: false }
  let hatch: { size: number; pattern: CanvasPattern | string } | null = null

  let bitmap = createBitmap(session.state.chart)

  const unsubscribe = session.subscribe((event: EditorEvent) => {
    if (event.type === 'replaced') {
      bitmap = createBitmap(session.state.chart)
      schedule({ chart: true, marks: true })
    } else if (event.type === 'patch') {
      bitmap.paint(event.patch.cells)
      schedule({ chart: true })
    }
  })

  function schedule(layers: Partial<typeof dirty>) {
    dirty.chart ||= !!layers.chart
    dirty.marks ||= !!layers.marks
    if (frame === 0) frame = requestAnimationFrame(draw)
  }

  function draw() {
    frame = 0
    if (dirty.chart) drawChart()
    if (dirty.marks) drawMarks()
    dirty.chart = false
    dirty.marks = false
  }

  function drawChart() {
    const { chart } = session.state
    const { width, height } = chart
    const cell = Math.round(viewport.cellSize * dpr)
    const x0 = Math.round(viewport.originX * dpr)
    const y0 = Math.round(viewport.originY * dpr)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = OUTSIDE_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const c0 = Math.max(0, Math.floor(-x0 / cell))
    const c1 = Math.min(width, Math.ceil((canvas.width - x0) / cell))
    const r0 = Math.max(0, Math.floor(-y0 / cell))
    const r1 = Math.min(height, Math.ceil((canvas.height - y0) / cell))
    if (c0 >= c1 || r0 >= r1) return

    const left = x0 + c0 * cell
    const top = y0 + r0 * cell
    const w = (c1 - c0) * cell
    const h = (r1 - r0) * cell

    ctx.fillStyle = hatchPattern(cell, x0, y0)
    ctx.fillRect(left, top, w, h)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bitmap.canvas, c0, r0, c1 - c0, r1 - r0, left, top, w, h)

    drawGrid(chart, cell, x0, y0, { c0, c1, r0, r1 })
  }

  function drawMarks() {
    const { chart } = session.state
    // The hover may still be of the chart that was just replaced.
    const cell =
      hover.cell && hover.cell.row < chart.height && hover.cell.column < chart.width
        ? hover.cell
        : null
    drawRuler(rulerX, 'x', chart, viewport, dpr, cell?.column ?? null)
    drawRuler(rulerY, 'y', chart, viewport, dpr, cell?.row ?? null)
    drawOverlay(chart, cell)
  }

  function drawOverlay(chart: Chart, cell: GridCell | null) {
    overlay.setTransform(1, 0, 0, 1, 0, 0)
    overlay.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height)
    if (!cell || !hover.lines) return
    const size = Math.round(viewport.cellSize * dpr)
    const x0 = Math.round(viewport.originX * dpr)
    const y0 = Math.round(viewport.originY * dpr)
    overlay.fillStyle = HIGHLIGHT_COLOR
    // One path filled by the nonzero rule, so the crossing cell is not tinted twice.
    overlay.beginPath()
    overlay.rect(x0, y0 + cell.row * size, chart.width * size, size)
    overlay.rect(x0 + cell.column * size, y0, size, chart.height * size)
    overlay.fill()
  }

  function hatchPattern(cell: number, x0: number, y0: number): CanvasPattern | string {
    if (cell < HATCH_FROM_DEVICE_PX) return EMPTY_COLOR
    if (hatch?.size !== cell) {
      const tile = new OffscreenCanvas(cell, cell)
      const t = tile.getContext('2d')
      if (!t) return EMPTY_COLOR
      t.fillStyle = EMPTY_COLOR
      t.fillRect(0, 0, cell, cell)
      t.strokeStyle = EMPTY_HATCH_COLOR
      t.lineWidth = Math.max(1, Math.round(cell / 16))
      t.beginPath()
      t.moveTo(0, cell)
      t.lineTo(cell, 0)
      t.stroke()
      hatch = { size: cell, pattern: ctx.createPattern(tile, 'repeat') ?? EMPTY_COLOR }
    }
    if (typeof hatch.pattern !== 'string')
      hatch.pattern.setTransform(new DOMMatrix([1, 0, 0, 1, x0, y0]))
    return hatch.pattern
  }

  function drawGrid(
    chart: Chart,
    cell: number,
    x0: number,
    y0: number,
    { c0, c1, r0, r1 }: { c0: number; c1: number; r0: number; r1: number },
  ) {
    const cssCell = cell / dpr
    if (cssCell < MAJOR_LINES_FROM) return
    const isMajorX = (c: number) => isMajorGridLine(chart, 'vertical', c)
    const isMajorY = (r: number) => isMajorGridLine(chart, 'horizontal', r)

    const top = y0 + r0 * cell
    const bottom = y0 + r1 * cell
    const left = x0 + c0 * cell
    const right = x0 + c1 * cell
    const majorWidth = Math.max(2, Math.round(dpr * 1.5))
    const half = Math.floor(majorWidth / 2)

    if (cssCell >= ALL_LINES_FROM) {
      ctx.fillStyle = MINOR_LINE_COLOR
      ctx.beginPath()
      for (let c = c0; c <= c1; c++) if (!isMajorX(c)) ctx.rect(x0 + c * cell, top, 1, bottom - top)
      for (let r = r0; r <= r1; r++)
        if (!isMajorY(r)) ctx.rect(left, y0 + r * cell, right - left, 1)
      ctx.fill()
    }

    ctx.fillStyle = MAJOR_LINE_COLOR
    ctx.beginPath()
    for (let c = c0; c <= c1; c++) {
      if (isMajorX(c))
        ctx.rect(x0 + c * cell - half, top - half, majorWidth, bottom - top + majorWidth)
    }
    for (let r = r0; r <= r1; r++) {
      if (isMajorY(r))
        ctx.rect(left - half, y0 + r * cell - half, right - left + majorWidth, majorWidth)
    }
    ctx.fill()
  }

  return {
    setSize(size) {
      dpr = size.dpr
      const device = (css: number) => Math.max(1, Math.round(css * dpr))
      for (const c of [canvas, overlay.canvas]) {
        c.width = device(size.width)
        c.height = device(size.height)
      }
      // The rulers run along the chart canvas; their thickness is the layout's.
      rulerX.canvas.width = device(size.width)
      rulerX.canvas.height = device(rulerX.canvas.getBoundingClientRect().height)
      rulerY.canvas.width = device(rulerY.canvas.getBoundingClientRect().width)
      rulerY.canvas.height = device(size.height)
      // Resizing clears the canvases, so draw now rather than on the next frame to avoid a blank flash.
      cancelAnimationFrame(frame)
      dirty.chart = true
      dirty.marks = true
      draw()
    },
    setViewport(next) {
      viewport = next
      schedule({ chart: true, marks: true })
    },
    setHover(next) {
      hover = next
      schedule({ marks: true })
    },
    dispose() {
      cancelAnimationFrame(frame)
      frame = 0
      unsubscribe()
    },
  }
}

function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('Canvas 2D is unavailable')
  return context
}

/** One pixel per cell; a yarn's colour or transparent for an empty cell. */
function createBitmap(chart: Chart) {
  const { width, height, cells } = chart
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  const image = context.createImageData(width, height)
  const pixels = new Uint32Array(image.data.buffer)
  const colors = new Map<YarnId, number>(chart.palette.map((y) => [y.id, packColor(y.color)]))
  const colorOf = (id: YarnId) => (id === 0 ? 0 : (colors.get(id) ?? 0))

  for (let i = 0; i < cells.length; i++) pixels[i] = colorOf(cells[i] ?? 0)
  context.putImageData(image, 0, 0)

  return {
    canvas,
    paint(changes: readonly { index: number; after: YarnId }[]) {
      if (changes.length === 0) return
      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1
      for (const { index, after } of changes) {
        pixels[index] = colorOf(after)
        const x = index % width
        const y = (index - x) / width
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      context.putImageData(image, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1)
    },
  }
}

/** `#rrggbb` → opaque RGBA as one little-endian `Uint32` (bytes R, G, B, A in memory). */
function packColor(hex: string): number {
  const rgb = Number.parseInt(hex.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = rgb & 0xff
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0
}
