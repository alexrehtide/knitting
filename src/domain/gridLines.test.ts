import { describe, expect, it } from 'vitest'
import { createChart, type Chart } from './chart'
import { isMajorGridLine } from './gridLines'

const now = new Date('2026-10-25T10:00:00.000Z')

function majorLines(chart: Chart, axis: 'vertical' | 'horizontal') {
  const count = axis === 'vertical' ? chart.width : chart.height
  return Array.from({ length: count + 1 }, (_, i) => i).filter((i) =>
    isMajorGridLine(chart, axis, i),
  )
}

describe('isMajorGridLine', () => {
  it('counts every N-th line from where numbering starts, bottom right by default', () => {
    const chart = createChart(25, 12, now)

    expect(majorLines(chart, 'vertical')).toEqual([0, 5, 15, 25])
    expect(majorLines(chart, 'horizontal')).toEqual([0, 2, 12])
  })

  it('counts from the top left when numbering goes left to right and top down', () => {
    const base = createChart(25, 12, now)
    const chart: Chart = {
      ...base,
      properties: {
        ...base.properties,
        numbering: { rows: 'top-down', stitches: 'left-to-right' },
        majorStep: 5,
      },
    }

    expect(majorLines(chart, 'vertical')).toEqual([0, 5, 10, 15, 20, 25])
    expect(majorLines(chart, 'horizontal')).toEqual([0, 5, 10, 12])
  })
})
