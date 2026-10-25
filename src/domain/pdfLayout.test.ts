import { describe, expect, it } from 'vitest'
import { createChart, type Chart, type ChartProperties } from './chart'
import {
  layOutPdf,
  PDF_FOOTER_HEIGHT,
  PDF_PAGE_MARGIN,
  PDF_RULER_SIZE,
  pdfGridArea,
  sliceAxis,
  type PdfLayoutOptions,
  type PdfSheet,
} from './pdfLayout'

const now = new Date('2026-10-25T10:00:00.000Z')

function chartOf(width: number, height: number, properties: Partial<ChartProperties> = {}): Chart {
  const chart = createChart(width, height, now)
  return { ...chart, properties: { ...chart.properties, ...properties } }
}

const a4: PdfLayoutOptions = { format: 'A4', orientation: 'portrait', cellWidth: 5, overlap: 0 }

function sheetsOf(chart: Chart, options: PdfLayoutOptions = a4): readonly PdfSheet[] {
  const layout = layOutPdf(chart, options)
  if (!layout.ok) throw new Error(layout.code)
  return layout.sheets
}

describe('sliceAxis', () => {
  it('fills sheets with the largest multiple of the major step, the last one gets the rest', () => {
    expect(sliceAxis(100, 64, 10, 0)).toEqual([
      { first: 1, last: 60, overlap: 0 },
      { first: 61, last: 100, overlap: 0 },
    ])
  })

  it('repeats the overlap at the start of the next sheet', () => {
    expect(sliceAxis(100, 64, 10, 2)).toEqual([
      { first: 1, last: 60, overlap: 0 },
      { first: 59, last: 100, overlap: 2 },
    ])
  })

  it('leaves the multiple out when the capacity is below the major step', () => {
    expect(sliceAxis(20, 7, 10, 0)?.map(({ first, last }) => last - first + 1)).toEqual([7, 7, 6])
  })

  it('takes the overlap out of the capacity before rounding to the step', () => {
    expect(sliceAxis(25, 11, 10, 2)).toEqual([
      { first: 1, last: 9, overlap: 0 },
      { first: 8, last: 18, overlap: 2 },
      { first: 17, last: 25, overlap: 2 },
    ])
  })

  it('makes one sheet when everything fits', () => {
    expect(sliceAxis(40, 64, 10, 2)).toEqual([{ first: 1, last: 40, overlap: 0 }])
  })
})

describe('layOutPdf', () => {
  it('gets the capacity from the grid area and the cell size', () => {
    const area = pdfGridArea('A4', 'portrait')
    expect(area).toEqual({
      x: PDF_PAGE_MARGIN + PDF_RULER_SIZE,
      y: PDF_PAGE_MARGIN + PDF_RULER_SIZE,
      width: 210 - 2 * (PDF_PAGE_MARGIN + PDF_RULER_SIZE),
      height: 297 - 2 * (PDF_PAGE_MARGIN + PDF_RULER_SIZE) - PDF_FOOTER_HEIGHT,
    })

    const layout = layOutPdf(chartOf(10, 10, { cellAspect: { mode: 'manual', ratio: 0.5 } }), a4)

    if (!layout.ok) throw new Error(layout.code)
    expect(layout.cell).toEqual({ width: 5, height: 10 })
    expect(layout.capacity).toEqual({
      stitches: Math.floor(area.width / 5),
      rows: Math.floor(area.height / 10),
    })
  })

  it('puts row 1 and stitch 1 on sheet 1, so by default it holds the bottom right corner', () => {
    const chart = chartOf(100, 100)
    const first = sheetsOf(chart)[0]!

    expect(first.number).toBe(1)
    expect(first.stitches.first).toBe(1)
    expect(first.rows.first).toBe(1)
    expect(first.cells.left + first.cells.width).toBe(chart.width)
    expect(first.cells.top + first.cells.height).toBe(chart.height)
  })

  it('orders the sheets along the stitches, then along the rows', () => {
    const sheets = sheetsOf(chartOf(70, 100), { ...a4, cellWidth: 10 })

    expect(sheets).toHaveLength(35)
    expect(sheets.slice(5, 9).map((s) => [s.stitches.first, s.rows.first])).toEqual([
      [51, 1],
      [61, 1],
      [1, 21],
      [11, 21],
    ])
    expect(sheets.map((s) => s.number)).toEqual(sheets.map((_, i) => i + 1))
  })

  it('places each sheet in the sheet grid as it lies on screen', () => {
    const layout = layOutPdf(chartOf(70, 100), { ...a4, cellWidth: 10 })
    if (!layout.ok) throw new Error(layout.code)

    expect(layout.sheetGrid).toEqual({ columns: 7, rows: 5 })
    expect(layout.sheets[0]?.position).toEqual({ row: 4, column: 6 })
    expect(layout.sheets[1]?.position).toEqual({ row: 4, column: 5 })
    expect(layout.sheets[7]?.position).toEqual({ row: 3, column: 6 })

    const topLeft = layOutPdf(
      chartOf(70, 100, { numbering: { rows: 'top-down', stitches: 'left-to-right' } }),
      { ...a4, cellWidth: 10 },
    )
    if (!topLeft.ok) throw new Error(topLeft.code)
    expect(topLeft.sheets[0]?.position).toEqual({ row: 0, column: 0 })
    expect(topLeft.sheets[8]?.position).toEqual({ row: 1, column: 1 })
  })

  it.each([
    [
      { rows: 'top-down', stitches: 'left-to-right' },
      { top: 0, left: 0 },
    ],
    [
      { rows: 'top-down', stitches: 'right-to-left' },
      { top: 0, left: 70 - 10 },
    ],
    [
      { rows: 'bottom-up', stitches: 'left-to-right' },
      { top: 100 - 20, left: 0 },
    ],
  ] as const)('follows numbering %o', (numbering, corner) => {
    const [first] = sheetsOf(chartOf(70, 100, { numbering }), { ...a4, cellWidth: 10 })

    expect(first?.cells).toEqual({ ...corner, width: 10, height: 20 })
  })

  it('maps the numbering ranges to screen cells, overlap included', () => {
    const sheets = sheetsOf(chartOf(100, 10), { ...a4, cellWidth: 2.5, overlap: 2 })
    const second = sheets[1]

    expect(second?.stitches).toEqual({ first: 59, last: 100 })
    expect(second?.cells).toEqual({ top: 0, left: 0, width: 42, height: 10 })
    expect(second?.overlap).toEqual({ stitches: 2, rows: 0 })
  })

  it('draws the glue line at the end of the repeated cells, only on repeating sheets', () => {
    const sheets = sheetsOf(chartOf(100, 10), { ...a4, cellWidth: 2.5, overlap: 2 })

    expect(sheets[0]?.glue).toEqual({ column: null, row: null })
    // Stitches 59–60 are columns 41 and 40; the line runs between column 40 and stitch 61 in column 39.
    expect(sheets[1]?.glue).toEqual({ column: 40, row: null })

    const ltr = sheetsOf(
      chartOf(100, 10, { numbering: { rows: 'top-down', stitches: 'left-to-right' } }),
      {
        ...a4,
        cellWidth: 2.5,
        overlap: 2,
      },
    )
    expect(ltr[1]?.glue).toEqual({ column: 60, row: null })
  })

  it('puts the glue line between rows too', () => {
    const sheets = sheetsOf(chartOf(10, 100), { ...a4, cellWidth: 5, overlap: 1 })
    const second = sheets[1]!

    expect(second.rows).toEqual({ first: 40, last: 80 })
    expect(second.overlap.rows).toBe(1)
    // Bottom up: the repeated row is the bottom one of the sheet.
    expect(second.glue.row).toBe(second.cells.top + second.cells.height - 1)

    const topDown = sheetsOf(
      chartOf(10, 100, { numbering: { rows: 'top-down', stitches: 'left-to-right' } }),
      { ...a4, cellWidth: 5, overlap: 1 },
    )[1]!
    // Top down: the repeated row is the top one of the sheet.
    expect(topDown.cells.top).toBe(39)
    expect(topDown.glue).toEqual({ column: null, row: 40 })
  })

  it('starts the grid in the same place modulo the cell on every sheet, partial ones included', () => {
    const options: PdfLayoutOptions = {
      format: 'A3',
      orientation: 'landscape',
      cellWidth: 4.5,
      overlap: 1,
    }
    const chart = chartOf(173, 141, { cellAspect: { mode: 'manual', ratio: 0.8 } })
    const layout = layOutPdf(chart, options)
    if (!layout.ok) throw new Error(layout.code)
    const { width, height } = layout.cell
    const mod = (a: number, b: number) => Math.round((((a % b) + b) % b) * 1e6) / 1e6

    expect(new Set(layout.sheets.map((s) => s.cells.width)).size).toBeGreaterThan(1)
    expect(new Set(layout.sheets.map((s) => s.cells.height)).size).toBeGreaterThan(1)
    expect(new Set(layout.sheets.map((s) => mod(s.origin.x, width))).size).toBe(1)
    expect(new Set(layout.sheets.map((s) => mod(s.origin.y, height))).size).toBe(1)
  })

  it('keeps every sheet inside the grid area', () => {
    const options: PdfLayoutOptions = {
      format: 'A4',
      orientation: 'landscape',
      cellWidth: 2,
      overlap: 2,
    }
    const area = pdfGridArea('A4', 'landscape')
    const layout = layOutPdf(chartOf(500, 500), options)
    if (!layout.ok) throw new Error(layout.code)

    for (const { origin, cells } of layout.sheets) {
      expect(origin.x).toBeGreaterThanOrEqual(area.x)
      expect(origin.y).toBeGreaterThanOrEqual(area.y)
      expect(origin.x + cells.width * layout.cell.width).toBeLessThanOrEqual(
        area.x + area.width + 1e-9,
      )
      expect(origin.y + cells.height * layout.cell.height).toBeLessThanOrEqual(
        area.y + area.height + 1e-9,
      )
    }
  })

  it('numbers every cell on the rulers from 4 mm, otherwise only every major step', () => {
    const [small] = sheetsOf(chartOf(30, 30), { ...a4, cellWidth: 3 })
    expect(small?.rulers).toEqual({ stitches: [10, 20, 30], rows: [10, 20, 30] })

    const [large] = sheetsOf(chartOf(12, 12), { ...a4, cellWidth: 5 })
    expect(large?.rulers.stitches).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(large?.rulers.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('decides the ruler labels for each axis by its own cell size', () => {
    const [sheet] = sheetsOf(chartOf(12, 12, { cellAspect: { mode: 'manual', ratio: 2 } }), {
      ...a4,
      cellWidth: 6,
    })

    expect(sheet?.rulers.stitches).toHaveLength(12)
    expect(sheet?.rulers.rows).toEqual([10])
  })

  it('labels the overlap numbers too', () => {
    const sheets = sheetsOf(chartOf(100, 5), { ...a4, cellWidth: 2.5, overlap: 2 })

    expect(sheets[1]?.rulers.stitches).toEqual([60, 70, 80, 90, 100])
  })

  it('counts the sheets in the other orientation', () => {
    const chart = chartOf(100, 40)
    const portrait = layOutPdf(chart, a4)
    const landscape = layOutPdf(chart, { ...a4, orientation: 'landscape' })
    if (!portrait.ok || !landscape.ok) throw new Error('no layout')

    expect(portrait.otherOrientationSheets).toBe(landscape.sheets.length)
    expect(landscape.otherOrientationSheets).toBe(portrait.sheets.length)
  })

  it('refuses a cell bigger than the grid area', () => {
    const chart = chartOf(10, 10, { cellAspect: { mode: 'manual', ratio: 0.01 } })

    expect(layOutPdf(chart, a4)).toEqual({ ok: false, code: 'cell-too-large' })
  })

  it('refuses a cell that leaves nothing but the overlap', () => {
    const chart = chartOf(10, 10, { cellAspect: { mode: 'manual', ratio: 0.1 } })
    // 20 mm × 200 mm on A4 portrait: one row fits, two overlap rows do not leave room for a new one.
    expect(layOutPdf(chart, { ...a4, cellWidth: 20, overlap: 2 })).toEqual({
      ok: false,
      code: 'cell-too-large',
    })
  })
})
