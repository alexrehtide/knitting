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

/** A patch that is not made of other patches. */
export type PlainPatch = CellsPatch | PalettePatch | PropertiesPatch

/**
 * A reversible change to a chart. A composite patch is one edit made of plain patches applied in order,
 * such as a yarn replacement with its removal.
 * Size patches join this union with their edit.
 */
export type ChartPatch =
  PlainPatch | { readonly kind: 'composite'; readonly parts: readonly PlainPatch[] }

/** Applies the patch to the chart in place. */
export function applyPatch(chart: Chart, patch: ChartPatch): void {
  if (patch.kind === 'composite') for (const part of patch.parts) applyPatch(chart, part)
  else if (patch.kind === 'palette') chart.palette = patch.after
  else if (patch.kind === 'properties') chart.properties = { ...chart.properties, ...patch.after }
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
  return {
    kind: 'cells',
    cells: patch.cells.map(({ index, before, after }) => ({ index, before: after, after: before })),
  }
}
