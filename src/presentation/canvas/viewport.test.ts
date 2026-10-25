import { describe, expect, it } from 'vitest'
import { cellAt, fitViewport, scrollBy, zoomAt } from './viewport'

const chart = { width: 40, height: 30 }
const view = { width: 800, height: 600, dpr: 1 }

describe('cellAt', () => {
  const viewport = { cellSize: 10, originX: 100, originY: 50 }

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

  it('follows zoom and scroll', () => {
    const fitted = fitViewport(chart, view)
    const scrolled = scrollBy(fitted, 3 * fitted.cellSize, 2 * fitted.cellSize, chart, view)
    const centre = (v: typeof fitted, row: number, column: number) =>
      [v.originX + (column + 0.5) * v.cellSize, v.originY + (row + 0.5) * v.cellSize] as const

    expect(cellAt(scrolled, chart, ...centre(fitted, 10, 10))).toEqual({ row: 12, column: 13 })

    const [x, y] = centre(fitted, 5, 7)
    const zoomed = zoomAt(fitted, 1, x, y, chart, view)
    expect(zoomed.cellSize).toBeGreaterThan(fitted.cellSize)
    expect(cellAt(zoomed, chart, x, y)).toEqual({ row: 5, column: 7 })
    expect(cellAt(zoomed, chart, x + 2 * zoomed.cellSize, y)).toEqual({ row: 5, column: 9 })
  })
})
