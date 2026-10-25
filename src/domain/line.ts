import type { Chart } from './chart'
import type { GridCell } from './numbering'

/**
 * Cells of the segment from `from` to `to`, ends included: Bresenham, 8-connected.
 * The ends may lie off the grid; only the cells inside it are given, so the slope is kept.
 */
export function lineCells(
  from: GridCell,
  to: GridCell,
  grid: Pick<Chart, 'width' | 'height'>,
): GridCell[] {
  const dc = Math.abs(to.column - from.column)
  const dr = -Math.abs(to.row - from.row)
  const sc = from.column < to.column ? 1 : -1
  const sr = from.row < to.row ? 1 : -1
  const cells: GridCell[] = []
  let { row, column } = from
  let error = dc + dr
  for (;;) {
    if (row >= 0 && row < grid.height && column >= 0 && column < grid.width)
      cells.push({ row, column })
    if (row === to.row && column === to.column) return cells
    const doubled = 2 * error
    if (doubled >= dr) {
      error += dr
      column += sc
    }
    if (doubled <= dc) {
      error += dc
      row += sr
    }
  }
}
