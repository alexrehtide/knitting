import { describe, expect, it } from 'vitest'
import { rectangleCells } from './rectangle'

/** A 6×5 grid, so cell (row, column) is at index `row * 6 + column`. */
const grid = { width: 6, height: 5 }

const at = (row: number, column: number) => row * grid.width + column

describe('rectangleCells', () => {
  it('gives the outline only, each cell once, whichever corner the drag starts from', () => {
    const cells = rectangleCells({ row: 3, column: 4 }, { row: 1, column: 1 }, grid, false)

    expect([...cells].sort((a, b) => a - b)).toEqual([
      at(1, 1),
      at(1, 2),
      at(1, 3),
      at(1, 4),
      at(2, 1),
      at(2, 4),
      at(3, 1),
      at(3, 2),
      at(3, 3),
      at(3, 4),
    ])
  })

  it('gives every cell of a filled rectangle', () => {
    const cells = rectangleCells({ row: 1, column: 1 }, { row: 2, column: 3 }, grid, true)

    expect([...cells].sort((a, b) => a - b)).toEqual([
      at(1, 1),
      at(1, 2),
      at(1, 3),
      at(2, 1),
      at(2, 2),
      at(2, 3),
    ])
  })

  it('gives one line of cells, each once, for a rectangle one cell high', () => {
    expect(rectangleCells({ row: 2, column: 1 }, { row: 2, column: 3 }, grid, false)).toEqual([
      at(2, 1),
      at(2, 2),
      at(2, 3),
    ])
  })

  it('keeps the corner dragged off the grid at its edge', () => {
    const cells = rectangleCells({ row: 2, column: 2 }, { row: 9, column: -4 }, grid, false)

    expect(Math.max(...cells)).toBe(at(4, 2))
    expect(cells).toContain(at(4, 0))
    expect(cells).toContain(at(2, 0))
    expect(cells).toContain(at(3, 0))
    expect(cells).not.toContain(at(3, 1))
    expect(cells).toHaveLength(8)
  })
})
