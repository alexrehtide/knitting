import type { Chart } from './chart'
import type { GridCell } from './numbering'

/** The cell nearest to `cell` on the grid: a corner dragged off the grid stays at its edge. */
export function clampToGrid(cell: GridCell, grid: Pick<Chart, 'width' | 'height'>): GridCell {
  return {
    row: Math.min(Math.max(cell.row, 0), grid.height - 1),
    column: Math.min(Math.max(cell.column, 0), grid.width - 1),
  }
}

/**
 * Indices of the cells of the rectangle with opposite corners `from` and `to`, each once: its outline,
 * or every cell when `filled`. A corner off the grid is taken at its edge (`clampToGrid`).
 */
export function rectangleCells(
  from: GridCell,
  to: GridCell,
  grid: Pick<Chart, 'width' | 'height'>,
  filled: boolean,
): number[] {
  const first = clampToGrid(from, grid)
  const second = clampToGrid(to, grid)
  const top = Math.min(first.row, second.row)
  const bottom = Math.max(first.row, second.row)
  const left = Math.min(first.column, second.column)
  const right = Math.max(first.column, second.column)
  const cells: number[] = []
  for (let row = top; row <= bottom; row++) {
    const start = row * grid.width
    if (filled || row === top || row === bottom) {
      for (let column = left; column <= right; column++) cells.push(start + column)
    } else {
      cells.push(start + left)
      if (right > left) cells.push(start + right)
    }
  }
  return cells
}
