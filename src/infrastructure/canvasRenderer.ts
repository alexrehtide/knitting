import type { ChartRenderer, Viewport } from '../application/chartRenderer'
import type { EditorEvent, EditorSession } from '../application/editorSession'
import type { Chart } from '../domain/chart'
import { isMajorGridLine } from '../domain/gridLines'
import type { YarnId } from '../domain/palette'

const OUTSIDE_COLOR = '#e4e4e7'
const EMPTY_COLOR = '#f1f1f3'
const EMPTY_HATCH_COLOR = '#a1a1aa'
const MINOR_LINE_COLOR = 'rgba(113, 113, 122, 0.45)'
const MAJOR_LINE_COLOR = 'rgba(39, 39, 42, 0.8)'

// Thresholds by cell size in CSS px (#5): below 2 — colour only; from 2 — major lines; from 4 — every line.
const MAJOR_LINES_FROM = 2
const ALL_LINES_FROM = 4
// Below this many device px (e.g. 500×500 fitted) a hatch line cannot be drawn inside a cell,
// so empty cells get a flat fill in the hatch's light grey, still unlike any yarn colour.
const HATCH_FROM_DEVICE_PX = 4

/**
 * Draws the chart in «colour» mode: a W×H bitmap, one pixel per cell, scaled with `drawImage`
 * without smoothing; empty cells are transparent in it and show the «нет петли» hatch beneath.
 * `patch` repaints the changed cells of the bitmap, `replaced` rebuilds it.
 */
export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  session: EditorSession,
): ChartRenderer {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Canvas 2D is unavailable')
  const ctx = context

  let dpr = 1
  let viewport: Viewport = { cellSize: 1, originX: 0, originY: 0 }
  let frame = 0
  let hatch: { size: number; pattern: CanvasPattern | string } | null = null

  let bitmap = createBitmap(session.state.chart)

  const unsubscribe = session.subscribe((event: EditorEvent) => {
    if (event.type === 'replaced') bitmap = createBitmap(session.state.chart)
    else if (event.type === 'patch') bitmap.paint(event.patch.cells)
    else return
    schedule()
  })

  function schedule() {
    if (frame === 0) frame = requestAnimationFrame(draw)
  }

  function draw() {
    frame = 0
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
      canvas.width = Math.max(1, Math.round(size.width * dpr))
      canvas.height = Math.max(1, Math.round(size.height * dpr))
      // Resizing clears the canvas, so draw now rather than on the next frame to avoid a blank flash.
      cancelAnimationFrame(frame)
      draw()
    },
    setViewport(next) {
      viewport = next
      schedule()
    },
    dispose() {
      cancelAnimationFrame(frame)
      frame = 0
      unsubscribe()
    },
  }
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
