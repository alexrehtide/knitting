import type { Chart } from './chart'
import { cellAspectRatio } from './chartProperties'
import { cellOfNumber } from './numbering'

/** Sizes are in mm; the layout and the PDF generator share them. */
export const PDF_PAGE_MARGIN = 10
/** Depth of each of the four rulers around the grid. */
export const PDF_RULER_SIZE = 6
/** Height of the footer under the bottom ruler: title, sheet number, ranges and the sheet map. */
export const PDF_FOOTER_HEIGHT = 16
export const PDF_RULER_FONT_SIZE = 2
/** From this cell size along an axis the ruler numbers every cell, below it only every major step. */
export const PDF_RULER_EVERY_CELL_FROM = 4

export type PaperFormat = 'A4' | 'A3'
export type PageOrientation = 'portrait' | 'landscape'

export interface PdfLayoutOptions {
  readonly format: PaperFormat
  readonly orientation: PageOrientation
  /** Cell width in mm; the height is the width / cell aspect. */
  readonly cellWidth: number
  /** Stitches or rows the next sheet repeats at each inner joint. */
  readonly overlap: 0 | 1 | 2
}

/** Numbers along one axis in the chart's numbering, both ends included. */
export interface NumberRange {
  readonly first: number
  readonly last: number
}

export interface PdfSheet {
  /** 1-based, in print order. */
  readonly number: number
  /** Place in the sheet grid as it lies on screen, 0-based from the top left: for the sheet maps. */
  readonly position: { readonly row: number; readonly column: number }
  /** In the chart's numbering, overlap included. */
  readonly stitches: NumberRange
  readonly rows: NumberRange
  /** The same cells on screen: 0-based, rows from the top, columns from the left. */
  readonly cells: {
    readonly top: number
    readonly left: number
    readonly width: number
    readonly height: number
  }
  /** Repeated stitches and rows of the previous sheet, 0 on the first sheet along an axis. */
  readonly overlap: { readonly stitches: number; readonly rows: number }
  /** Chart grid boundary (as in `isMajorGridLine`) where the dashed glue line runs, `null` when none. */
  readonly glue: { readonly column: number | null; readonly row: number | null }
  /** Top left corner of the grid on the page, mm. */
  readonly origin: { readonly x: number; readonly y: number }
  /** Numbers written on the rulers, the same on both rulers of an axis. */
  readonly rulers: { readonly stitches: readonly number[]; readonly rows: readonly number[] }
}

export type PdfLayout =
  | {
      readonly ok: true
      readonly cell: { readonly width: number; readonly height: number }
      /** Stitches and rows a sheet can hold. */
      readonly capacity: { readonly stitches: number; readonly rows: number }
      readonly sheetGrid: { readonly columns: number; readonly rows: number }
      readonly sheets: readonly PdfSheet[]
      /** Sheets in the other orientation, `null` when it cannot lay the chart out; for the dialog hint. */
      readonly otherOrientationSheets: number | null
    }
  /** Not a single new stitch or row fits on a sheet. */
  | { readonly ok: false; readonly code: 'cell-too-large' }

const PAPER: Record<PaperFormat, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
}

export function pdfPageSize(
  format: PaperFormat,
  orientation: PageOrientation,
): { width: number; height: number } {
  const { width, height } = PAPER[format]
  return orientation === 'portrait' ? { width, height } : { width: height, height: width }
}

/** Where the grid of a sheet may lie: the page minus the margins, the rulers and the footer. */
export function pdfGridArea(
  format: PaperFormat,
  orientation: PageOrientation,
): { x: number; y: number; width: number; height: number } {
  const page = pdfPageSize(format, orientation)
  const inset = PDF_PAGE_MARGIN + PDF_RULER_SIZE
  return {
    x: inset,
    y: inset,
    width: page.width - 2 * inset,
    height: page.height - 2 * inset - PDF_FOOTER_HEIGHT,
  }
}

/** One sheet's share of an axis: its numbers and how many of the first ones repeat the previous sheet. */
export interface AxisPart extends NumberRange {
  readonly overlap: number
}

/** Absorbs float noise such as 249 / 8.3 so that an exact fit counts. */
const EPSILON = 1e-9

/**
 * Cuts 1…count into sheets. The unique part of a sheet is the largest multiple of the major step
 * within the capacity less the overlap (that value itself when it is below the step); every sheet
 * but the first also repeats the last `overlap` numbers of the previous one. `null` when the
 * count does not fit on one sheet and the overlap leaves no room for new numbers.
 */
export function sliceAxis(
  count: number,
  capacity: number,
  majorStep: number,
  overlap: number,
): AxisPart[] | null {
  if (count <= capacity) return [{ first: 1, last: count, overlap: 0 }]
  const room = capacity - overlap
  if (room < 1) return null
  const unique = room < majorStep ? room : room - (room % majorStep)
  const parts: AxisPart[] = []
  for (let start = 1; start <= count; start += unique) {
    const repeated = start === 1 ? 0 : overlap
    parts.push({
      first: start - repeated,
      last: Math.min(start + unique - 1, count),
      overlap: repeated,
    })
  }
  return parts
}

/** How the chart is cut into PDF sheets (docs/spec.md, «PDF»). */
export function layOutPdf(chart: Chart, options: PdfLayoutOptions): PdfLayout {
  const otherOrientation: PageOrientation =
    options.orientation === 'portrait' ? 'landscape' : 'portrait'
  const layout = layOutSheets(chart, options)
  if (!layout) return { ok: false, code: 'cell-too-large' }
  return {
    ok: true,
    ...layout,
    otherOrientationSheets:
      layOutSheets(chart, { ...options, orientation: otherOrientation })?.sheets.length ?? null,
  }
}

function layOutSheets(chart: Chart, { format, orientation, cellWidth, overlap }: PdfLayoutOptions) {
  const { majorStep } = chart.properties
  const cell = { width: cellWidth, height: cellWidth / cellAspectRatio(chart.properties) }
  const area = pdfGridArea(format, orientation)
  const capacity = {
    stitches: Math.floor(area.width / cell.width + EPSILON),
    rows: Math.floor(area.height / cell.height + EPSILON),
  }
  const stitchParts = sliceAxis(chart.width, capacity.stitches, majorStep, overlap)
  const rowParts = sliceAxis(chart.height, capacity.rows, majorStep, overlap)
  if (!stitchParts || !rowParts) return null

  const rulerNumbers = (part: NumberRange, size: number) => {
    const every = size + EPSILON >= PDF_RULER_EVERY_CELL_FROM ? 1 : majorStep
    const numbers: number[] = []
    for (let n = Math.ceil(part.first / every) * every; n <= part.last; n += every) numbers.push(n)
    return numbers
  }

  const { numbering } = chart.properties
  const sheets: PdfSheet[] = []
  rowParts.forEach((rows, r) => {
    stitchParts.forEach((stitches, s) => {
      // Opposite corners of the sheet, then the last repeated and the first new cell: the glue
      // line runs between those two.
      const start = cellOfNumber(chart, { row: rows.first, stitch: stitches.first })
      const end = cellOfNumber(chart, { row: rows.last, stitch: stitches.last })
      const lastRepeated = cellOfNumber(chart, {
        row: rows.first + rows.overlap - 1,
        stitch: stitches.first + stitches.overlap - 1,
      })
      const firstNew = cellOfNumber(chart, {
        row: rows.first + rows.overlap,
        stitch: stitches.first + stitches.overlap,
      })
      sheets.push({
        number: sheets.length + 1,
        position: {
          row: numbering.rows === 'bottom-up' ? rowParts.length - 1 - r : r,
          column: numbering.stitches === 'right-to-left' ? stitchParts.length - 1 - s : s,
        },
        stitches: { first: stitches.first, last: stitches.last },
        rows: { first: rows.first, last: rows.last },
        cells: {
          top: Math.min(start.row, end.row),
          left: Math.min(start.column, end.column),
          width: stitches.last - stitches.first + 1,
          height: rows.last - rows.first + 1,
        },
        overlap: { stitches: stitches.overlap, rows: rows.overlap },
        glue: {
          column: stitches.overlap === 0 ? null : Math.max(lastRepeated.column, firstNew.column),
          row: rows.overlap === 0 ? null : Math.max(lastRepeated.row, firstNew.row),
        },
        // Every sheet is pinned to the top left corner of the grid area, the partial ones too, so
        // the grid starts in the same place and one set of tiling patterns serves the document.
        origin: { x: area.x, y: area.y },
        rulers: {
          stitches: rulerNumbers(stitches, cell.width),
          rows: rulerNumbers(rows, cell.height),
        },
      })
    })
  })
  return {
    cell,
    capacity,
    sheetGrid: { columns: stitchParts.length, rows: rowParts.length },
    sheets,
  }
}
