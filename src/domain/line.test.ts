import { describe, expect, it } from 'vitest'
import { lineCells, snapLineEnd } from './line'
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

describe('snapLineEnd', () => {
  const from = { row: 10, column: 10 }

  it('lays a line at about 30° horizontally, its end under the pointer column', () => {
    // 6 rows over 10 columns: 31°.
    expect(snapLineEnd(from, { row: 4, column: 20 })).toEqual({ row: 10, column: 20 })
  })

  it('lays a line at about 40° on the diagonal, strictly 1:1, the end projected from the pointer', () => {
    // 8 rows over 10 columns: 39°; the projection on the diagonal is 9 cells along.
    expect(snapLineEnd(from, { row: 18, column: 0 })).toEqual({ row: 19, column: 1 })
  })

  it('lays a line at about 60° vertically', () => {
    expect(snapLineEnd(from, { row: 0, column: 4 })).toEqual({ row: 0, column: 10 })
  })

  it('keeps the diagonal up to 55° and gives way to the vertical past it', () => {
    // 7 rows over 5 columns: 54.5°; 3 rows over 2 columns: 56.3°.
    expect(snapLineEnd(from, { row: 17, column: 15 })).toEqual({ row: 16, column: 16 })
    expect(snapLineEnd(from, { row: 13, column: 12 })).toEqual({ row: 13, column: 10 })
  })

  it('leaves a zero-length line where it is', () => {
    expect(snapLineEnd(from, from)).toEqual(from)
  })
})
