import { describe, expect, it } from 'vitest'
import { createChart, type Chart, type ChartProperties } from './chart'
import { cellOfNumber, numberOfCell } from './numbering'

const now = new Date('2026-10-25T10:00:00.000Z')

function chartNumbered(numbering: ChartProperties['numbering']): Chart {
  const chart = createChart(5, 3, now)
  return { ...chart, properties: { ...chart.properties, numbering } }
}

describe('numberOfCell', () => {
  it('counts rows bottom up and stitches right to left by default', () => {
    const chart = createChart(5, 3, now)

    expect(numberOfCell(chart, { row: 2, column: 4 })).toEqual({ row: 1, stitch: 1 })
    expect(numberOfCell(chart, { row: 0, column: 0 })).toEqual({ row: 3, stitch: 5 })
    expect(numberOfCell(chart, { row: 1, column: 3 })).toEqual({ row: 2, stitch: 2 })
  })

  it.each([
    [
      { rows: 'bottom-up', stitches: 'left-to-right' },
      { row: 3, stitch: 2 },
    ],
    [
      { rows: 'top-down', stitches: 'right-to-left' },
      { row: 1, stitch: 4 },
    ],
    [
      { rows: 'top-down', stitches: 'left-to-right' },
      { row: 1, stitch: 2 },
    ],
  ] as const)('follows numbering %o', (numbering, expected) => {
    expect(numberOfCell(chartNumbered(numbering), { row: 0, column: 1 })).toEqual(expected)
  })
})

describe('cellOfNumber', () => {
  it.each([
    { rows: 'bottom-up', stitches: 'right-to-left' },
    { rows: 'bottom-up', stitches: 'left-to-right' },
    { rows: 'top-down', stitches: 'right-to-left' },
    { rows: 'top-down', stitches: 'left-to-right' },
  ] as const)('undoes numberOfCell for every cell with numbering %o', (numbering) => {
    const chart = chartNumbered(numbering)
    for (let row = 0; row < chart.height; row++)
      for (let column = 0; column < chart.width; column++)
        expect(cellOfNumber(chart, numberOfCell(chart, { row, column }))).toEqual({ row, column })
  })

  it('puts row 1, stitch 1 in the bottom right corner by default', () => {
    expect(cellOfNumber(createChart(5, 3, now), { row: 1, stitch: 1 })).toEqual({
      row: 2,
      column: 4,
    })
  })
})
