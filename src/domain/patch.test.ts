import { describe, expect, it } from 'vitest'
import { createChart } from './chart'
import { applyPatch, invertPatch, type ChartPatch } from './patch'

const now = new Date('2026-10-25T10:00:00.000Z')

const patch: ChartPatch = {
  kind: 'cells',
  cells: [
    { index: 0, before: 0, after: 1 },
    { index: 5, before: 0, after: 2 },
  ],
}

describe('cell patches', () => {
  it('set each cell to its «after» yarn', () => {
    const chart = createChart(3, 2, now)

    applyPatch(chart, patch)

    expect([...chart.cells]).toEqual([1, 0, 0, 0, 0, 2])
  })

  it('undo themselves when inverted', () => {
    const chart = createChart(3, 2, now)
    applyPatch(chart, patch)

    applyPatch(chart, invertPatch(patch))

    expect([...chart.cells]).toEqual([0, 0, 0, 0, 0, 0])
    expect(invertPatch(invertPatch(patch))).toEqual(patch)
  })
})

describe('palette patches', () => {
  it('replace the palette, and put it back when inverted', () => {
    const chart = createChart(3, 2, now)
    const before = chart.palette
    const after = before.slice(1)
    const palettePatch: ChartPatch = { kind: 'palette', before, after }

    applyPatch(chart, palettePatch)
    expect(chart.palette).toBe(after)

    applyPatch(chart, invertPatch(palettePatch))
    expect(chart.palette).toBe(before)
  })
})
