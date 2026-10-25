import { describe, expect, it } from 'vitest'
import { createChart, defaultPalette, initialYarnSelection } from './chart'

const now = new Date('2026-10-25T10:00:00.000Z')

describe('defaultPalette', () => {
  it('is white then black with auto-assigned patterns', () => {
    expect(defaultPalette()).toEqual([
      { id: 1, color: '#ffffff', pattern: 'cross', name: '' },
      { id: 2, color: '#000000', pattern: 'circle-filled', name: '' },
    ])
  })

  it('starts with yarn 1 current and yarn 2 previous', () => {
    expect(initialYarnSelection(defaultPalette())).toEqual({ current: 1, previous: 2 })
  })
})

describe('createChart', () => {
  it('makes a chart of the given size with every cell empty and the default palette', () => {
    const chart = createChart(40, 30, now)

    expect(chart.width).toBe(40)
    expect(chart.height).toBe(30)
    expect(chart.cells).toHaveLength(1200)
    expect(chart.cells.every((id) => id === 0)).toBe(true)
    expect(chart.palette).toEqual(defaultPalette())
  })

  it('fills chart properties with their defaults', () => {
    expect(createChart(10, 10, now).properties).toEqual({
      title: '',
      notes: '',
      gauge: { stitches: 20, rows: 28 },
      cellAspect: { mode: 'manual', ratio: 1 },
      numbering: { rows: 'bottom-up', stitches: 'right-to-left' },
      majorStep: 10,
      createdAt: now,
      modifiedAt: now,
    })
  })

  it('rejects a size outside 1–500', () => {
    expect(() => createChart(0, 10, now)).toThrow(RangeError)
    expect(() => createChart(10, 501, now)).toThrow(RangeError)
  })
})
