import type { DisplayMode } from '../application/editorSession'
import type { Chart } from '../domain/chart'
import { PATTERN_SHAPES, patternInk, type PatternPrimitive } from '../domain/fillPattern'
import type { YarnId } from '../domain/palette'

/** Side of a cached screen tile, in device px (#5). */
const TILE_PX = 512
/** Baking tiles takes at most this much of a frame; the rest wait for the next frame. */
const BAKE_BUDGET_MS = 6

const INK = { black: '#000000', white: '#ffffff' }

/** Half-open column and row ranges of chart cells. */
export interface CellRange {
  readonly c0: number
  readonly c1: number
  readonly r0: number
  readonly r1: number
}

/** A cell's width and height in device px; they differ when the cell aspect is not 1:1. */
export interface CellSize {
  readonly w: number
  readonly h: number
}

/** `pattern` — black icons over white cells; `color-pattern` — icons black or white by the yarn colour. */
export type PatternMode = Exclude<DisplayMode, 'color'>

/**
 * The fill pattern icons over the cells, on a transparent background (#5): each yarn gets a stamp of
 * its icon at the cell size in device px, and the stamps are baked into screen tiles of ~512² device px
 * kept in an LRU of about two screens, so a pan only copies tiles. A frame bakes the tiles it lacks for
 * up to 6 ms and reports that more are due.
 */
export function createPatternLayer(chartOf: () => Chart) {
  let cell: CellSize = { w: 0, h: 0 }
  let mode: PatternMode = 'pattern'
  /** Yarn → its stamp at `cell` in `mode`; `null` for a yarn without a pattern. */
  const stamps = new Map<YarnId, OffscreenCanvas | null>()
  /** `"column,row"` of a tile → the tile; Map order is the LRU order, oldest first. */
  const tiles = new Map<string, OffscreenCanvas>()
  /** Columns and rows of cells in a tile. */
  let tileColumns = 1
  let tileRows = 1

  /** Drops what was drawn for the palette, the mode and the cell size before. */
  function reset() {
    stamps.clear()
    tiles.clear()
  }

  /** Takes a new cell size or mode, dropping what was drawn for the old ones. */
  function configure(nextCell: CellSize, nextMode: PatternMode) {
    if (nextCell.w === cell.w && nextCell.h === cell.h && nextMode === mode) return
    cell = nextCell
    mode = nextMode
    tileColumns = Math.max(1, Math.floor(TILE_PX / cell.w))
    tileRows = Math.max(1, Math.floor(TILE_PX / cell.h))
    reset()
  }

  function stampOf(yarn: YarnId): OffscreenCanvas | null {
    if (yarn === 0) return null
    let stamp = stamps.get(yarn)
    if (stamp !== undefined) return stamp
    const found = chartOf().palette.find((y) => y.id === yarn)
    stamp = null
    if (found?.pattern) {
      const ink = mode === 'pattern' ? 'black' : patternInk(found.color)
      stamp = new OffscreenCanvas(cell.w, cell.h)
      const context = stamp.getContext('2d')
      if (context) drawPrimitives(context, PATTERN_SHAPES[found.pattern], cell.w, cell.h, INK[ink])
    }
    stamps.set(yarn, stamp)
    return stamp
  }

  function bake(column: number, row: number): OffscreenCanvas {
    const chart = chartOf()
    const c0 = column * tileColumns
    const r0 = row * tileRows
    const c1 = Math.min(chart.width, c0 + tileColumns)
    const r1 = Math.min(chart.height, r0 + tileRows)
    const tile = new OffscreenCanvas((c1 - c0) * cell.w, (r1 - r0) * cell.h)
    const context = tile.getContext('2d')
    if (!context) return tile
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) {
        const stamp = stampOf(chart.cells[r * chart.width + c] ?? 0)
        if (stamp) context.drawImage(stamp, (c - c0) * cell.w, (r - r0) * cell.h)
      }
    return tile
  }

  return {
    reset,

    /** Redraws the changed cells in the tiles that are cached; the others are baked afresh when shown. */
    paint(changes: readonly { index: number; after: YarnId }[]) {
      if (tiles.size === 0) return
      const { width } = chartOf()
      for (const { index, after } of changes) {
        const c = index % width
        const r = (index - c) / width
        const tile = tiles.get(`${Math.floor(c / tileColumns)},${Math.floor(r / tileRows)}`)
        const context = tile?.getContext('2d')
        if (!context) continue
        const x = (c % tileColumns) * cell.w
        const y = (r % tileRows) * cell.h
        context.clearRect(x, y, cell.w, cell.h)
        const stamp = stampOf(after)
        if (stamp) context.drawImage(stamp, x, y)
      }
    },

    /**
     * Draws the icons of the cells in range at a cell of `size`, the chart starting at (x0, y0);
     * `false` when some tiles are left to bake on a later frame.
     */
    draw(
      target: CanvasRenderingContext2D,
      size: CellSize,
      patternMode: PatternMode,
      x0: number,
      y0: number,
      { c0, c1, r0, r1 }: CellRange,
    ): boolean {
      configure(size, patternMode)
      const tc0 = Math.floor(c0 / tileColumns)
      const tc1 = Math.ceil(c1 / tileColumns)
      const tr0 = Math.floor(r0 / tileRows)
      const tr1 = Math.ceil(r1 / tileRows)
      const deadline = performance.now() + BAKE_BUDGET_MS
      let complete = true
      for (let row = tr0; row < tr1; row++)
        for (let column = tc0; column < tc1; column++) {
          const key = `${column},${row}`
          let tile = tiles.get(key)
          if (tile) tiles.delete(key)
          else if (performance.now() < deadline) tile = bake(column, row)
          else {
            complete = false
            continue
          }
          tiles.set(key, tile)
          target.drawImage(tile, x0 + column * tileColumns * cell.w, y0 + row * tileRows * cell.h)
        }
      // About two screens of tiles.
      const keep = 2 * (tc1 - tc0 + 1) * (tr1 - tr0 + 1)
      for (const key of tiles.keys()) {
        if (tiles.size <= keep) break
        tiles.delete(key)
      }
      return complete
    },

    /** Draws the icons of a yarn over the given cells in range, stamp by stamp (the gesture preview). */
    drawCells(
      target: CanvasRenderingContext2D,
      size: CellSize,
      patternMode: PatternMode,
      x0: number,
      y0: number,
      cells: readonly number[],
      yarn: YarnId,
      { c0, c1, r0, r1 }: CellRange,
    ) {
      configure(size, patternMode)
      const stamp = stampOf(yarn)
      if (!stamp) return
      const { width } = chartOf()
      for (const index of cells) {
        const c = index % width
        const r = (index - c) / width
        if (c >= c0 && c < c1 && r >= r0 && r < r1)
          target.drawImage(stamp, x0 + c * cell.w, y0 + r * cell.h)
      }
    },
  }
}

/**
 * Draws a pattern's primitives into a `width × height` box at the origin: the unit square stretches
 * with the box, and no line is thinner than 1 device px.
 */
function drawPrimitives(
  context: OffscreenCanvasRenderingContext2D,
  primitives: readonly PatternPrimitive[],
  width: number,
  height: number,
  color: string,
) {
  const side = Math.min(width, height)
  const lineWidth = (fraction: number) => Math.max(1, fraction * side)
  context.fillStyle = color
  context.strokeStyle = color
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const primitive of primitives) {
    context.beginPath()
    switch (primitive.kind) {
      case 'segment':
        context.moveTo(primitive.from[0] * width, primitive.from[1] * height)
        context.lineTo(primitive.to[0] * width, primitive.to[1] * height)
        context.lineWidth = lineWidth(primitive.width)
        context.stroke()
        break
      case 'disc':
      case 'circle': {
        const [x, y] = primitive.center
        const r = primitive.radius
        context.ellipse(x * width, y * height, r * width, r * height, 0, 0, 2 * Math.PI)
        if (primitive.kind === 'disc') context.fill()
        else {
          context.lineWidth = lineWidth(primitive.width)
          context.stroke()
        }
        break
      }
      case 'polygon':
      case 'polyline':
        for (const [x, y] of primitive.points) context.lineTo(x * width, y * height)
        if (primitive.kind === 'polygon') context.fill()
        else {
          if (primitive.closed) context.closePath()
          context.lineWidth = lineWidth(primitive.width)
          context.stroke()
        }
        break
    }
  }
}
