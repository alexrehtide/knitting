import { describe, expect, it } from 'vitest'
import { cellAt, fitViewport, scrollBy, unboundedCellAt, zoomAt } from './viewport'

const chart = { width: 40, height: 30 }
const view = { width: 800, height: 600, dpr: 1 }

describe('cellAt', () => {
  const viewport = { cellWidth: 10, cellHeight: 10, originX: 100, originY: 50 }

  it('finds the cell under a canvas point', () => {
    expect(cellAt(viewport, chart, 100, 50)).toEqual({ row: 0, column: 0 })
    expect(cellAt(viewport, chart, 125, 79.9)).toEqual({ row: 2, column: 2 })
    expect(cellAt(viewport, chart, 499.9, 349.9)).toEqual({ row: 29, column: 39 })
  })

  it('gives no cell outside the grid', () => {
    expect(cellAt(viewport, chart, 99.9, 60)).toBeNull()
    expect(cellAt(viewport, chart, 150, 49.9)).toBeNull()
    expect(cellAt(viewport, chart, 500, 60)).toBeNull()
    expect(cellAt(viewport, chart, 150, 350)).toBeNull()
  })

  it('finds the cell off the grid too, for a gesture that leaves it', () => {
    expect(unboundedCellAt(viewport, 99.9, 30)).toEqual({ row: -2, column: -1 })
    expect(unboundedCellAt(viewport, 525, 60)).toEqual({ row: 1, column: 42 })
  })

  it('counts columns by the cell width and rows by its height', () => {
    const wide = { cellWidth: 14, cellHeight: 10, originX: 0, originY: 0 }

    expect(cellAt(wide, chart, 28, 25)).toEqual({ row: 2, column: 2 })
    expect(cellAt(wide, chart, 27.9, 9.9)).toEqual({ row: 0, column: 1 })
  })

  it('follows zoom and scroll', () => {
    const fitted = fitViewport(chart, view, 1)
    const scrolled = scrollBy(fitted, 3 * fitted.cellWidth, 2 * fitted.cellHeight, chart, view)
    const centre = (v: typeof fitted, row: number, column: number) =>
      [v.originX + (column + 0.5) * v.cellWidth, v.originY + (row + 0.5) * v.cellHeight] as const

    expect(cellAt(scrolled, chart, ...centre(fitted, 10, 10))).toEqual({ row: 12, column: 13 })

    const [x, y] = centre(fitted, 5, 7)
    const zoomed = zoomAt(fitted, 1, x, y, chart, view, 1)
    expect(zoomed.cellWidth).toBeGreaterThan(fitted.cellWidth)
    expect(cellAt(zoomed, chart, x, y)).toEqual({ row: 5, column: 7 })
    expect(cellAt(zoomed, chart, x + 2 * zoomed.cellWidth, y)).toEqual({ row: 5, column: 9 })
  })
})

describe('cell aspect', () => {
  it('fits the whole chart with cells as wide as the aspect says, in whole device px', () => {
    const fitted = fitViewport(chart, view, 1.4)

    expect(fitted.cellWidth / fitted.cellHeight).toBeCloseTo(1.4, 1)
    expect(Number.isInteger(fitted.cellWidth) && Number.isInteger(fitted.cellHeight)).toBe(true)
    expect(chart.width * fitted.cellWidth).toBeLessThanOrEqual(view.width)
    expect(chart.height * fitted.cellHeight).toBeLessThanOrEqual(view.height)
  })

  it('keeps the aspect as it zooms', () => {
    const fitted = fitViewport(chart, view, 0.5)
    const zoomed = zoomAt(fitted, 1, 400, 300, chart, view, 0.5)

    expect(zoomed.cellHeight).toBeGreaterThan(fitted.cellHeight)
    expect(zoomed.cellWidth / zoomed.cellHeight).toBeCloseTo(0.5, 1)
  })
})
