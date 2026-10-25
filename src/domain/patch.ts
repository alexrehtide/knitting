import type { YarnId } from './palette'

/** One cell of a patch: its index in `Chart.cells` and the yarn id before and after (ADR-0001). */
export interface CellChange {
  readonly index: number
  readonly before: YarnId
  readonly after: YarnId
}

/** A reversible change to a chart. Palette, size and property patches join this union with their edits. */
export type ChartPatch = { readonly kind: 'cells'; readonly cells: readonly CellChange[] }
