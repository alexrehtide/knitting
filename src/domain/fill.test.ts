import { describe, expect, it } from 'vitest'
import { fillCells } from './fill'

/** A grid from rows of digits, one yarn id per cell, top row first. */
function grid(...rows: string[]) {
  const width = rows[0]?.length ?? 0
  return {
    width,
    height: rows.length,
    cells: Uint16Array.from(rows.join(''), Number),
  }
}

function sorted(indices: readonly number[]) {
  return [...indices].sort((a, b) => a - b)
}

describe('fillCells', () => {
  it('gives the 4-connected empty area of an empty cell, not a diagonal neighbour', () => {
    const chart = grid(
      '00100', //
      '11100',
      '00010',
      '00001',
    )

    expect(sorted(fillCells({ row: 0, column: 0 }, chart))).toEqual([0, 1])
  })

  it('gives the 4-connected area of a yarn', () => {
    const chart = grid(
      '22000', //
      '02000',
      '02200',
      '00002',
    )

    expect(sorted(fillCells({ row: 0, column: 0 }, chart))).toEqual([0, 1, 6, 11, 12])
  })

  it('fills a 500×500 chart whole without running out of stack', () => {
    const chart = { width: 500, height: 500, cells: new Uint16Array(500 * 500) }

    expect(fillCells({ row: 250, column: 250 }, chart)).toHaveLength(500 * 500)
  })
})
