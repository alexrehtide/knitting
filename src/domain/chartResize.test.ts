import { describe, expect, it } from 'vitest'
import { createChart, type Chart } from './chart'
import { MAX_CHART_DIMENSION } from './chartSize'
import { resizePatch, NO_SIDES } from './chartResize'
import { applyPatch, invertPatch } from './patch'

const now = new Date('2026-10-25T10:00:00.000Z')

/** A chart with the rows given top first; each digit is a yarn id, 0 an empty cell. */
function chartOf(...rows: string[]): Chart {
  const chart = createChart(rows[0]?.length ?? 0, rows.length, now)
  chart.cells.set(rows.join('').split('').map(Number))
  return chart
}

function rowsOf(chart: Chart): string[] {
  const rows: string[] = []
  for (let r = 0; r < chart.height; r++)
    rows.push([...chart.cells.subarray(r * chart.width, (r + 1) * chart.width)].join(''))
  return rows
}

describe('resizePatch', () => {
  it('adds empty columns on the left: 4×2 with +2 on the left is 6×2', () => {
    const chart = chartOf('1212', '2121')

    const resize = resizePatch(chart, { ...NO_SIDES, left: 2 })
    if (!resize) throw new Error('no patch')
    applyPatch(chart, resize.patch)

    expect([chart.width, chart.height]).toEqual([6, 2])
    expect(rowsOf(chart)).toEqual(['001212', '002121'])
    expect(resize.cut).toBe(0)
  })

  it('takes the top row away with −1 on the top', () => {
    const chart = chartOf('111', '202', '022')

    const resize = resizePatch(chart, { ...NO_SIDES, top: -1 })
    if (!resize) throw new Error('no patch')
    applyPatch(chart, resize.patch)

    expect([chart.width, chart.height]).toEqual([3, 2])
    expect(rowsOf(chart)).toEqual(['202', '022'])
  })

  it('adds and takes away on all four sides at once', () => {
    const chart = chartOf('123', '456', '789')

    const resize = resizePatch(chart, { top: 1, bottom: -1, left: -1, right: 2 })
    if (!resize) throw new Error('no patch')
    applyPatch(chart, resize.patch)

    expect(rowsOf(chart)).toEqual(['0000', '2300', '5600'])
  })

  it('counts the non-empty cells it cuts off', () => {
    const chart = chartOf('1020', '0002', '1100')

    expect(resizePatch(chart, { ...NO_SIDES, right: -2 })?.cut).toBe(2)
    expect(resizePatch(chart, { ...NO_SIDES, top: -1, left: -1 })?.cut).toBe(3)
    expect(resizePatch(chart, { ...NO_SIDES, bottom: 3 })?.cut).toBe(0)
  })

  it('rejects a size out of 1–500 on either axis', () => {
    const chart = chartOf('12', '21')

    expect(resizePatch(chart, { ...NO_SIDES, left: -1, right: -1 })).toBeNull()
    expect(resizePatch(chart, { ...NO_SIDES, top: -3 })).toBeNull()
    expect(resizePatch(chart, { ...NO_SIDES, right: MAX_CHART_DIMENSION - 1 })).toBeNull()
    expect(resizePatch(chart, { ...NO_SIDES, top: 0.5 })).toBeNull()
    expect(resizePatch(chart, { ...NO_SIDES, right: MAX_CHART_DIMENSION - 2 })).not.toBeNull()
  })

  it('makes no patch when no side changes', () => {
    expect(resizePatch(chartOf('12'), NO_SIDES)).toBeNull()
  })

  it('gives the size and the cells back when inverted, cut cells included', () => {
    const chart = chartOf('1020', '0002', '1100')
    const before = rowsOf(chart)
    const resize = resizePatch(chart, { top: -1, bottom: 2, left: 1, right: -3 })
    if (!resize) throw new Error('no patch')

    applyPatch(chart, resize.patch)
    applyPatch(chart, invertPatch(resize.patch))

    expect([chart.width, chart.height]).toEqual([4, 3])
    expect(rowsOf(chart)).toEqual(before)
    expect(invertPatch(invertPatch(resize.patch))).toEqual(resize.patch)
  })
})
