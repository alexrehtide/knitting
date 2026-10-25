import type { Chart } from './chart'
import type { GridCell } from './numbering'

/**
 * Indices of the 4-connected area of cells that hold the same yarn as `start`; empty cells make areas
 * as yarns do. Iterative, with its own stack, so a whole 500×500 chart does not overflow the call stack.
 */
export function fillCells(
  start: GridCell,
  grid: Pick<Chart, 'width' | 'height' | 'cells'>,
): number[] {
  const { width, height, cells } = grid
  const first = start.row * width + start.column
  const yarn = cells[first]
  const seen = new Uint8Array(width * height)
  const area: number[] = []
  const stack = [first]
  seen[first] = 1
  for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
    area.push(index)
    const column = index % width
    const row = (index - column) / width
    const neighbours = [
      column > 0 ? index - 1 : -1,
      column < width - 1 ? index + 1 : -1,
      row > 0 ? index - width : -1,
      row < height - 1 ? index + width : -1,
    ]
    for (const next of neighbours) {
      if (next < 0 || seen[next] || cells[next] !== yarn) continue
      seen[next] = 1
      stack.push(next)
    }
  }
  return area
}
