import type { Chart } from './chart'
import type { Palette, YarnId } from './palette'

/** One cell of a patch: its index in `Chart.cells` and the yarn id before and after (ADR-0001). */
export interface CellChange {
  readonly index: number
  readonly before: YarnId
  readonly after: YarnId
}

/**
 * A reversible change to a chart. A palette patch holds the whole palette before and after:
 * it is a short list, and cells refer to yarn ids, so they do not change with it (ADR-0004).
 * Size and property patches join this union with their edits.
 */
export type ChartPatch =
  | { readonly kind: 'cells'; readonly cells: readonly CellChange[] }
  | { readonly kind: 'palette'; readonly before: Palette; readonly after: Palette }

/** Applies the patch to the chart in place. */
export function applyPatch(chart: Chart, patch: ChartPatch): void {
  if (patch.kind === 'palette') chart.palette = patch.after
  else for (const { index, after } of patch.cells) chart.cells[index] = after
}

/** The patch that takes the chart back to where `patch` started. */
export function invertPatch(patch: ChartPatch): ChartPatch {
  if (patch.kind === 'palette') return { kind: 'palette', before: patch.after, after: patch.before }
  return {
    kind: 'cells',
    cells: patch.cells.map(({ index, before, after }) => ({ index, before: after, after: before })),
  }
}
