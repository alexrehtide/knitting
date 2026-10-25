import type { Chart } from './chart'
import type { YarnId } from './palette'

/** One cell of a patch: its index in `Chart.cells` and the yarn id before and after (ADR-0001). */
export interface CellChange {
  readonly index: number
  readonly before: YarnId
  readonly after: YarnId
}

/** A reversible change to a chart. Palette, size and property patches join this union with their edits. */
export type ChartPatch = { readonly kind: 'cells'; readonly cells: readonly CellChange[] }

/** Applies the patch to the chart in place. */
export function applyPatch(chart: Chart, patch: ChartPatch): void {
  for (const { index, after } of patch.cells) chart.cells[index] = after
}

/** The patch that takes the chart back to where `patch` started. */
export function invertPatch(patch: ChartPatch): ChartPatch {
  return {
    kind: 'cells',
    cells: patch.cells.map(({ index, before, after }) => ({ index, before: after, after: before })),
  }
}
