import type { Chart } from './chart'

/** A cell by its place on screen: 0-based, rows from the top, columns from the left, as in `cells`. */
export interface GridCell {
  readonly row: number
  readonly column: number
}

/** A cell as the knitter names it: 1-based row and stitch in the chart's numbering direction. */
export interface CellNumber {
  readonly row: number
  readonly stitch: number
}

export function numberOfCell(chart: Chart, { row, column }: GridCell): CellNumber {
  const { numbering } = chart.properties
  return {
    row: numbering.rows === 'bottom-up' ? chart.height - row : row + 1,
    stitch: numbering.stitches === 'right-to-left' ? chart.width - column : column + 1,
  }
}

export function cellOfNumber(chart: Chart, { row, stitch }: CellNumber): GridCell {
  const { numbering } = chart.properties
  return {
    row: numbering.rows === 'bottom-up' ? chart.height - row : row - 1,
    column: numbering.stitches === 'right-to-left' ? chart.width - stitch : stitch - 1,
  }
}
