import type { ChartRenderer, Hover, Viewport } from '../application/chartRenderer'
import type { DisplayMode, EditorEvent, EditorSession } from '../application/editorSession'
import type { Chart } from '../domain/chart'
import { isMajorGridLine } from '../domain/gridLines'
import type { GridCell } from '../domain/numbering'
import type { YarnId } from '../domain/palette'
import { createPatternLayer, type CellSize, type CellRange, type PatternMode } from './patternLayer'
import { drawRuler } from './rulers'

const OUTSIDE_COLOR = '#e4e4e7'
const EMPTY_COLOR = '#f1f1f3'
const EMPTY_HATCH_COLOR = '#a1a1aa'
const MINOR_LINE_COLOR = 'rgba(113, 113, 122, 0.45)'
const MAJOR_LINE_COLOR = 'rgba(39, 39, 42, 0.8)'
const HIGHLIGHT_COLOR = 'rgba(79, 70, 229, 0.18)'
const OUTLINE_COLOR = 'rgb(79, 70, 229)'
// Yarn cells in «узор»: the icon is black over a white cell.
const PLAIN_COLOR = '#ffffff'

// Thresholds by the shorter cell side in CSS px (#5): below 2 — colour only; from 2 — major lines;
// from 4 — every line; from 8 — fill patterns, below it «узор» shows the yarn colours.
const MAJOR_LINES_FROM = 2
const ALL_LINES_FROM = 4
const PATTERNS_FROM = 8
// Below this many device px on the shorter side (e.g. 500×500 fitted) a hatch line cannot be drawn inside a cell,
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
 * Draws the chart: a W×H bitmap, one pixel per cell, scaled with `drawImage` without smoothing; empty
 * cells are transparent in it and show the «нет петли» hatch beneath in every display mode. In «узор»
 * and «цвет+узор» the pattern layer puts the icons over it from a cell of 8 CSS px; in «узор» the
 * bitmap then has white yarn cells. A cell patch repaints the changed cells of the bitmap and of the
 * cached tiles; a palette or size patch and `replaced` rebuild the bitmap and drop the tiles.
 * A property patch (numbering, major step, cell aspect) redraws the grid lines and the rulers.
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
  let viewport: Viewport = { cellWidth: 1, cellHeight: 1, originX: 0, originY: 0 }
  let hover: Hover = { cell: null, lines: false }
  let frame = 0
  const dirty = { chart: false, marks: false }
  let hatch: { cell: CellSize; pattern: CanvasPattern | string } | null = null

  let displayMode: DisplayMode = session.state.displayMode
  // The bitmap has white yarn cells: «узор» with the patterns shown.
  let whiteYarnCells = false
  let bitmap = createBitmap(session.state.chart, whiteYarnCells)
  const patterns = createPatternLayer(() => session.state.chart)
  // The gesture preview as a bitmap of its own, transparent but for its cells, drawn as the chart is.
  let preview: { bitmap: Bitmap; cells: readonly number[] } | null = null

  const unsubscribe = session.subscribe((event: EditorEvent) => {
    if (event.type === 'replaced') {
      bitmap = createBitmap(session.state.chart, whiteYarnCells)
      patterns.reset()
      preview = null
      schedule({ chart: true, marks: true })
    } else if (event.type === 'patch') {
      // A palette patch may recolour any cell or change its pattern, so the bitmap is made afresh;
      // so does a size patch, which gives the chart other cells.
      if (event.patch.kind === 'palette' || event.patch.kind === 'size') {
        bitmap = createBitmap(session.state.chart, whiteYarnCells)
        patterns.reset()
        preview = null
      } else if (event.patch.kind === 'cells') {
        bitmap.paint(event.patch.cells)
        patterns.paint(event.patch.cells)
      }
      schedule({
        chart: true,
        marks: event.patch.kind === 'properties' || event.patch.kind === 'size',
      })
    } else if (event.type === 'preview') {
      showPreview()
      schedule({ marks: true })
    } else if (event.type === 'state' && session.state.displayMode !== displayMode) {
      displayMode = session.state.displayMode
      schedule({ chart: true, marks: true })
    }
  })

  function showPreview() {
    const { chart, preview: next } = session.state
    preview ??= {
      bitmap: createBitmap(
        { ...chart, cells: new Uint16Array(chart.cells.length) },
        whiteYarnCells,
      ),
      cells: [],
    }
    const cells = next?.cells ?? []
    // The old cells go empty first, so a cell in both stays painted.
    preview.bitmap.paint([
      ...preview.cells.map((index) => ({ index, after: 0 })),
      ...cells.map((index) => ({ index, after: next?.yarn ?? 0 })),
    ])
    preview.cells = cells
  }

  function schedule(layers: Partial<typeof dirty>) {
    dirty.chart ||= !!layers.chart
    dirty.marks ||= !!layers.marks
    if (frame === 0) frame = requestAnimationFrame(draw)
  }

  // Each layer is clean before it is drawn, so drawing may mark it dirty again for the next frame.
  function draw() {
    frame = 0
    if (dirty.chart) {
      dirty.chart = false
      drawChart()
    }
    if (dirty.marks) {
      dirty.marks = false
      drawMarks()
    }
  }

  /** The cell in device px, as drawn now. */
  function deviceCell(): CellSize {
    return { w: Math.round(viewport.cellWidth * dpr), h: Math.round(viewport.cellHeight * dpr) }
  }

  /** The icons shown at a cell of this size, or `null` for colours only. */
  function patternMode(cell: CellSize): PatternMode | null {
    return displayMode !== 'color' && shorter(cell) / dpr >= PATTERNS_FROM ? displayMode : null
  }

  /** Remakes the chart and preview bitmaps when their yarn cells go white or back to the yarn colours. */
  function recolorYarnCells(white: boolean) {
    if (white === whiteYarnCells) return
    whiteYarnCells = white
    bitmap = createBitmap(session.state.chart, whiteYarnCells)
    preview = null
    if (session.state.preview) showPreview()
    schedule({ marks: true })
  }

  function drawChart() {
    const { chart } = session.state
    const { width, height } = chart
    const cell = deviceCell()
    const x0 = Math.round(viewport.originX * dpr)
    const y0 = Math.round(viewport.originY * dpr)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = OUTSIDE_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const mode = patternMode(cell)
    recolorYarnCells(mode === 'pattern')

    const range = visibleRange(width, height, cell, x0, y0)
    if (!range) return
    const { c0, c1, r0, r1 } = range

    ctx.fillStyle = hatchPattern(cell, x0, y0)
    ctx.fillRect(x0 + c0 * cell.w, y0 + r0 * cell.h, (c1 - c0) * cell.w, (r1 - r0) * cell.h)

    drawCells(ctx, bitmap, cell, x0, y0, range)
    // Tiles left to bake come on the next frames; until then their cells show without icons.
    if (mode && !patterns.draw(ctx, cell, mode, x0, y0, range)) schedule({ chart: true })
    drawGrid(ctx, chart, cell, x0, y0, range)
  }

  /** The chart cells that fall on the canvas, as half-open column and row ranges; `null` when none do. */
  function visibleRange(width: number, height: number, cell: CellSize, x0: number, y0: number) {
    const c0 = Math.max(0, Math.floor(-x0 / cell.w))
    const c1 = Math.min(width, Math.ceil((canvas.width - x0) / cell.w))
    const r0 = Math.max(0, Math.floor(-y0 / cell.h))
    const r1 = Math.min(height, Math.ceil((canvas.height - y0) / cell.h))
    return c0 < c1 && r0 < r1 ? { c0, c1, r0, r1 } : null
  }

  /**
   * Paints the cells of a bitmap in their places on the canvas; the chart and the gesture preview go
   * through it alike, so the preview looks exactly as the cells will.
   */
  function drawCells(
    target: CanvasRenderingContext2D,
    source: Bitmap,
    cell: CellSize,
    x0: number,
    y0: number,
    { c0, c1, r0, r1 }: CellRange,
  ) {
    const w = (c1 - c0) * cell.w
    const h = (r1 - r0) * cell.h
    target.imageSmoothingEnabled = false
    target.drawImage(
      source.canvas,
      c0,
      r0,
      c1 - c0,
      r1 - r0,
      x0 + c0 * cell.w,
      y0 + r0 * cell.h,
      w,
      h,
    )
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
    const size = deviceCell()
    const x0 = Math.round(viewport.originX * dpr)
    const y0 = Math.round(viewport.originY * dpr)
    const range = visibleRange(chart.width, chart.height, size, x0, y0)
    if (preview && preview.cells.length > 0 && range) {
      drawCells(overlay, preview.bitmap, size, x0, y0, range)
      const mode = patternMode(size)
      const yarn = session.state.preview?.yarn ?? 0
      if (mode) patterns.drawCells(overlay, size, mode, x0, y0, preview.cells, yarn, range)
      // The grid lines over the preview cells only: elsewhere the chart canvas has them already.
      overlay.globalCompositeOperation = 'source-atop'
      drawGrid(overlay, chart, size, x0, y0, range)
      overlay.globalCompositeOperation = 'source-over'
    }
    if (!cell) return
    const left = x0 + cell.column * size.w
    const top = y0 + cell.row * size.h
    if (hover.lines) {
      overlay.fillStyle = HIGHLIGHT_COLOR
      // One path filled by the nonzero rule, so the crossing cell is not tinted twice.
      overlay.beginPath()
      overlay.rect(x0, top, chart.width * size.w, size.h)
      overlay.rect(left, y0, size.w, chart.height * size.h)
      overlay.fill()
    }
    // A thin outline inside the cell, so it does not hide the neighbours.
    const line = Math.max(1, Math.round(dpr))
    overlay.strokeStyle = OUTLINE_COLOR
    overlay.lineWidth = line
    overlay.strokeRect(left + line / 2, top + line / 2, size.w - line, size.h - line)
  }

  function hatchPattern(cell: CellSize, x0: number, y0: number): CanvasPattern | string {
    if (shorter(cell) < HATCH_FROM_DEVICE_PX) return EMPTY_COLOR
    if (hatch?.cell.w !== cell.w || hatch.cell.h !== cell.h) {
      const tile = new OffscreenCanvas(cell.w, cell.h)
      const t = tile.getContext('2d')
      if (!t) return EMPTY_COLOR
      t.fillStyle = EMPTY_COLOR
      t.fillRect(0, 0, cell.w, cell.h)
      t.strokeStyle = EMPTY_HATCH_COLOR
      t.lineWidth = Math.max(1, Math.round(shorter(cell) / 16))
      t.beginPath()
      t.moveTo(0, cell.h)
      t.lineTo(cell.w, 0)
      t.stroke()
      hatch = { cell, pattern: ctx.createPattern(tile, 'repeat') ?? EMPTY_COLOR }
    }
    if (typeof hatch.pattern !== 'string')
      hatch.pattern.setTransform(new DOMMatrix([1, 0, 0, 1, x0, y0]))
    return hatch.pattern
  }

  function drawGrid(
    target: CanvasRenderingContext2D,
    chart: Chart,
    cell: CellSize,
    x0: number,
    y0: number,
    { c0, c1, r0, r1 }: CellRange,
  ) {
    const cssCell = shorter(cell) / dpr
    if (cssCell < MAJOR_LINES_FROM) return
    const isMajorX = (c: number) => isMajorGridLine(chart, 'vertical', c)
    const isMajorY = (r: number) => isMajorGridLine(chart, 'horizontal', r)

    const top = y0 + r0 * cell.h
    const bottom = y0 + r1 * cell.h
    const left = x0 + c0 * cell.w
    const right = x0 + c1 * cell.w
    const majorWidth = Math.max(2, Math.round(dpr * 1.5))
    const half = Math.floor(majorWidth / 2)

    if (cssCell >= ALL_LINES_FROM) {
      target.fillStyle = MINOR_LINE_COLOR
      target.beginPath()
      for (let c = c0; c <= c1; c++)
        if (!isMajorX(c)) target.rect(x0 + c * cell.w, top, 1, bottom - top)
      for (let r = r0; r <= r1; r++)
        if (!isMajorY(r)) target.rect(left, y0 + r * cell.h, right - left, 1)
      target.fill()
    }

    target.fillStyle = MAJOR_LINE_COLOR
    target.beginPath()
    for (let c = c0; c <= c1; c++) {
      if (isMajorX(c))
        target.rect(x0 + c * cell.w - half, top - half, majorWidth, bottom - top + majorWidth)
    }
    for (let r = r0; r <= r1; r++) {
      if (isMajorY(r))
        target.rect(left - half, y0 + r * cell.h - half, right - left + majorWidth, majorWidth)
    }
    target.fill()
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

const shorter = (cell: CellSize) => Math.min(cell.w, cell.h)

type Bitmap = ReturnType<typeof createBitmap>

/** One pixel per cell: a yarn's colour, or white for every yarn when `whiteYarnCells`; transparent for an empty cell. */
function createBitmap(
  chart: Pick<Chart, 'width' | 'height' | 'cells' | 'palette'>,
  whiteYarnCells: boolean,
) {
  const { width, height, cells } = chart
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  const image = context.createImageData(width, height)
  const pixels = new Uint32Array(image.data.buffer)
  const colors = new Map<YarnId, number>(
    chart.palette.map((y) => [y.id, packColor(whiteYarnCells ? PLAIN_COLOR : y.color)]),
  )
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
