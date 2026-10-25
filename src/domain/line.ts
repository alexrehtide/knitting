import type { Chart } from './chart'
import type { GridCell } from './numbering'

// The diagonal takes 35°…55°, narrower than an even split of 22.5°…67.5°, so a line at ~30° lies flat (#31).
const TAN_35 = Math.tan((35 * Math.PI) / 180)

/**
 * The end of a line from `from` snapped to 0°, 45° or 90°, in cells: the projection of `to` on the direction.
 * The diagonal is strictly 1:1.
 */
export function snapLineEnd(from: GridCell, to: GridCell): GridCell {
  const dc = to.column - from.column
  const dr = to.row - from.row
  const across = Math.abs(dc)
  const down = Math.abs(dr)
  if (down < across * TAN_35) return { row: from.row, column: to.column }
  if (across < down * TAN_35) return { row: to.row, column: from.column }
  const along = Math.round((across + down) / 2)
  return { row: from.row + Math.sign(dr) * along, column: from.column + Math.sign(dc) * along }
}

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
