import type { Chart } from './chart'
import { isValidChartDimension } from './chartSize'
import type { SizePatch } from './patch'

/** Rows or stitches added on each side as it is on screen; a negative number takes them away. */
export interface ResizeSides {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

export const NO_SIDES: ResizeSides = { top: 0, bottom: 0, left: 0, right: 0 }

/**
 * The patch that adds or takes away rows and stitches on the sides, with how many non-empty cells it
 * cuts off; `null` when no side changes or the size comes out of 1–500 on either axis. Added cells are
 * empty; the cut ones are kept in the patch, so its inverse gives them back.
 */
export function resizePatch(
  chart: Chart,
  sides: ResizeSides,
): { patch: SizePatch; cut: number } | null {
  const { top, bottom, left, right } = sides
  if (top === 0 && bottom === 0 && left === 0 && right === 0) return null
  const width = chart.width + left + right
  const height = chart.height + top + bottom
  if (!isValidChartDimension(width) || !isValidChartDimension(height)) return null
  const outside: { index: number; yarn: number }[] = []
  chart.cells.forEach((yarn, index) => {
    if (yarn === 0) return
    const row = Math.floor(index / chart.width) + top
    const column = (index % chart.width) + left
    if (row < 0 || row >= height || column < 0 || column >= width) outside.push({ index, yarn })
  })
  const patch: SizePatch = {
    kind: 'size',
    before: { width: chart.width, height: chart.height, outside },
    after: { width, height, outside: [] },
    offset: { rows: top, columns: left },
  }
  return { patch, cut: outside.length }
}
