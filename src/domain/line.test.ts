import { describe, expect, it } from 'vitest'
import { lineCells } from './line'
import type { GridCell } from './numbering'

const grid = { width: 20, height: 10 }

function isEightConnected(cells: readonly GridCell[]) {
  return cells.every((cell, i) => {
    const next = cells[i + 1]
    if (!next) return true
    const step = Math.max(Math.abs(next.row - cell.row), Math.abs(next.column - cell.column))
    return step === 1
  })
}

describe('lineCells', () => {
  it('gives the one cell of a zero-length line', () => {
    expect(lineCells({ row: 3, column: 4 }, { row: 3, column: 4 }, grid)).toEqual([
      { row: 3, column: 4 },
    ])
  })

  it('joins points 5 cells apart into an unbroken 8-connected chain, ends included', () => {
    const cells = lineCells({ row: 2, column: 1 }, { row: 4, column: 6 }, grid)

    expect(cells).toHaveLength(6)
    expect(cells[0]).toEqual({ row: 2, column: 1 })
    expect(cells.at(-1)).toEqual({ row: 4, column: 6 })
    expect(isEightConnected(cells)).toBe(true)
  })

  it('steps diagonally on a 45° line', () => {
    expect(lineCells({ row: 5, column: 5 }, { row: 2, column: 2 }, grid)).toEqual([
      { row: 5, column: 5 },
      { row: 4, column: 4 },
      { row: 3, column: 3 },
      { row: 2, column: 2 },
    ])
  })

  it('clips the line to the grid and keeps its slope', () => {
    const cells = lineCells({ row: -2, column: -4 }, { row: 2, column: 4 }, grid)

    expect(cells).toEqual(
      lineCells({ row: 8, column: 6 }, { row: 12, column: 14 }, { width: 100, height: 100 })
        .map((c) => ({ row: c.row - 10, column: c.column - 10 }))
        .filter((c) => c.row >= 0 && c.column >= 0),
    )
    expect(cells[0]).toEqual({ row: 0, column: 0 })
    expect(cells.at(-1)).toEqual({ row: 2, column: 4 })
  })

  it('gives nothing for a line wholly outside the grid', () => {
    expect(lineCells({ row: -1, column: 0 }, { row: -1, column: 19 }, grid)).toEqual([])
  })
})
