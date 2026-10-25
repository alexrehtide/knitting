import type { Chart } from './chart'
import type { PropertyChanges } from './chartProperties'
import type { Palette, YarnId } from './palette'

/** One cell of a patch: its index in `Chart.cells` and the yarn id before and after (ADR-0001). */
export interface CellChange {
  readonly index: number
  readonly before: YarnId
  readonly after: YarnId
}

export interface CellsPatch {
  readonly kind: 'cells'
  readonly cells: readonly CellChange[]
}

/**
 * A palette patch holds the whole palette before and after: it is a short list, and cells refer to
 * yarn ids, so they do not change with it (ADR-0004).
 */
export interface PalettePatch {
  readonly kind: 'palette'
  readonly before: Palette
  readonly after: Palette
}

/** Holds the changed properties only, before and after; the dates are not in it. */
export interface PropertiesPatch {
  readonly kind: 'properties'
  readonly before: PropertyChanges
  readonly after: PropertyChanges
}

/** One side of a size patch: the grid's size and its non-empty cells the other grid has no place for. */
export interface SizedGrid {
  readonly width: number
  readonly height: number
  /** By their index in this grid. */
  readonly outside: readonly { readonly index: number; readonly yarn: YarnId }[]
}

/**
 * Changes the grid's size: the cells both grids share move by `offset`, the rest of the grid after is
 * empty but for its `outside` cells. The cut cells stay in the patch as `before.outside`, so the inverse
 * gives them back.
 */
export interface SizePatch {
  readonly kind: 'size'
  readonly before: SizedGrid
  readonly after: SizedGrid
  /** Where the top-left cell of the grid before lands in the grid after; negative when it is cut. */
  readonly offset: { readonly rows: number; readonly columns: number }
}

/** A patch that is not made of other patches. */
export type PlainPatch = CellsPatch | PalettePatch | PropertiesPatch | SizePatch

/**
 * A reversible change to a chart. A composite patch is one edit made of plain patches applied in order,
 * such as a yarn replacement with its removal.
 */
export type ChartPatch =
  PlainPatch | { readonly kind: 'composite'; readonly parts: readonly PlainPatch[] }

/** Applies the patch to the chart in place. */
export function applyPatch(chart: Chart, patch: ChartPatch): void {
  if (patch.kind === 'composite') for (const part of patch.parts) applyPatch(chart, part)
  else if (patch.kind === 'palette') chart.palette = patch.after
  else if (patch.kind === 'properties') chart.properties = { ...chart.properties, ...patch.after }
  else if (patch.kind === 'size') resize(chart, patch)
  else for (const { index, after } of patch.cells) chart.cells[index] = after
}

/** The patch that takes the chart back to where `patch` started. */
export function invertPatch<P extends ChartPatch>(patch: P): P
export function invertPatch(patch: ChartPatch): ChartPatch {
  if (patch.kind === 'composite')
    return { kind: 'composite', parts: patch.parts.map(invertPatch).reverse() }
  if (patch.kind === 'palette') return { kind: 'palette', before: patch.after, after: patch.before }
  if (patch.kind === 'properties')
    return { kind: 'properties', before: patch.after, after: patch.before }
  if (patch.kind === 'size')
    return {
      kind: 'size',
      before: patch.after,
      after: patch.before,
      offset: { rows: -patch.offset.rows, columns: -patch.offset.columns },
    }
  return {
    kind: 'cells',
    cells: patch.cells.map(({ index, before, after }) => ({ index, before: after, after: before })),
  }
}

function resize(chart: Chart, { before, after, offset }: SizePatch): void {
  const cells = new Uint16Array(after.width * after.height)
  const first = Math.max(0, offset.columns)
  const last = Math.min(after.width, before.width + offset.columns)
  const top = Math.max(0, offset.rows)
  const bottom = Math.min(after.height, before.height + offset.rows)
  for (let row = top; row < bottom && first < last; row++) {
    const from = (row - offset.rows) * before.width - offset.columns
    cells.set(chart.cells.subarray(from + first, from + last), row * after.width + first)
  }
  for (const { index, yarn } of after.outside) cells[index] = yarn
  chart.width = after.width
  chart.height = after.height
  chart.cells = cells
}
