import { isValidChartDimension } from './chartSize'
import { addYarn, type Palette, type YarnId } from './palette'

export interface ChartProperties {
  readonly title: string
  readonly notes: string
  /** Stitches and rows per 10 cm. */
  readonly gauge: { readonly stitches: number; readonly rows: number }
  /** Cell width / height: from the gauge, or set by hand. */
  readonly cellAspect:
    { readonly mode: 'auto' } | { readonly mode: 'manual'; readonly ratio: number }
  readonly numbering: {
    readonly rows: 'bottom-up' | 'top-down'
    readonly stitches: 'right-to-left' | 'left-to-right'
  }
  /** Every N-th grid line and ruler mark is bolder. */
  readonly majorStep: number
  readonly createdAt: Date
  readonly modifiedAt: Date
}

export interface Chart {
  /** The size and the cells are replaced together by size patches. */
  width: number
  height: number
  /** Row-major, top row first; each cell holds a yarn id or 0 for an empty cell (ADR-0004). */
  cells: Uint16Array
  /** Replaced by palette patches, as cells are changed by cell patches. */
  palette: Palette
  /** Replaced by property patches; the editor also moves `modifiedAt` on each edit. */
  properties: ChartProperties
}

/** Two yarns, white then black, used for the first run and a new chart. */
export function defaultPalette(): Palette {
  let palette: Palette = []
  for (const color of ['#ffffff', '#000000']) {
    const result = addYarn(palette, { color })
    if (result.ok) palette = result.palette
  }
  return palette
}

/** Current and previous yarn after a chart is loaded: the first yarn, then the second (or the first again). */
export function initialYarnSelection(palette: Palette): { current: YarnId; previous: YarnId } {
  const [first, second = first] = palette
  if (first === undefined || second === undefined) throw new RangeError('A palette is never empty')
  return { current: first.id, previous: second.id }
}

/**
 * The selection after the palette changed: a yarn no longer in the palette gives way to the other selected
 * yarn, then to another yarn of the palette (the same one for both only when the palette has one yarn).
 */
export function repairYarnSelection(
  palette: Palette,
  selection: { current: YarnId; previous: YarnId },
): { current: YarnId; previous: YarnId } {
  const has = (id: YarnId) => palette.some((y) => y.id === id)
  const { current, previous } = selection
  if (has(current) && has(previous)) return selection
  const first = palette[0]
  if (first === undefined) throw new RangeError('A palette is never empty')
  const repaired = has(current) ? current : has(previous) ? previous : first.id
  return {
    current: repaired,
    previous:
      has(previous) && previous !== repaired
        ? previous
        : (palette.find((y) => y.id !== repaired)?.id ?? repaired),
  }
}

/** An empty chart with the default palette and default properties. */
export function createChart(width: number, height: number, now: Date): Chart {
  if (!isValidChartDimension(width) || !isValidChartDimension(height)) {
    throw new RangeError(`Chart size ${width}×${height} is out of range`)
  }
  return {
    width,
    height,
    cells: new Uint16Array(width * height),
    palette: defaultPalette(),
    properties: {
      title: '',
      notes: '',
      gauge: { stitches: 20, rows: 28 },
      cellAspect: { mode: 'manual', ratio: 1 },
      numbering: { rows: 'bottom-up', stitches: 'right-to-left' },
      majorStep: 10,
      createdAt: now,
      modifiedAt: now,
    },
  }
}
